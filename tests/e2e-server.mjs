// TEST ONLY — never deploy. Integration-test backend: a throw-away real PostgreSQL 17 with the real migrations and seed,
// the real API server (server/app.mjs), and the institution app served from the same origin (config.js points here).
// Only the Claude call is faked: the fake "reads" the declared values back, unless the uploaded test PDF contains
// TAMPER_AMOUNT / OTHER_INSTITUTION markers. Test-only control endpoints: /__sql (SQL as the server), /__expire, /__mail.
//   npm run e2e:server      (then run tests/e2e/server.e2e.cjs or, with npm run web:test-server, staff-portal.e2e.cjs)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { startPostgres } from './server/embedded-pg.mjs';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.env.PORT || 8790), BASE = `http://127.0.0.1:${PORT}`;
const db = await startPostgres(+(process.env.PG_PORT || 54332));
Object.assign(process.env, {
  DATABASE_URL: db.url, JWT_SECRET: crypto.randomBytes(32).toString('hex'), PUBLIC_URL: BASE,
  ALLOWED_ORIGINS: `${BASE},http://127.0.0.1:3100,http://localhost:3100`, REQUIRE_EMAIL_CONFIRMATION: 'true', RUN_SCHEDULER: 'false',
});
const { migrate } = await import('../server/migrate.mjs');
const { createApp } = await import('../server/app.mjs');
const { startChangeListener, aiOverride } = await import('../server/api.mjs');
const { pool } = await import('../server/db.mjs');
const { outbox } = await import('../server/mail.mjs');

await migrate(db.url, { log: () => {} });
const c = await pool.connect();
await c.query(fs.readFileSync(path.join(APP, 'supabase', 'seed.sql'), 'utf8'));
const mkUser = (email, password) => c.query(`insert into auth.users(email, encrypted_password, email_confirmed_at) values ($1, crypt($2, gen_salt('bf', 4)), now())`, [email, password]);
await mkUser('principal@dits-delhi.edu.in', 'Dits@2026');
await mkUser('director@bce-bangalore.edu.in', 'Bce@2026');
await mkUser('reviewer.mehta@aicte-india.org', 'Rev@2026');
await mkUser('admin.verma@aicte-india.org', 'Admin@2026');
await c.query(`select set_config('aicte.service', 'on', false)`);
await c.query(`select public.admin_invite_staff('fdr.officer@sbi.co.in', 'BANK_OFFICIAL', 'Shri Amitesh Kumar', 'Branch Manager', 'State Bank of India')`);
await mkUser('fdr.officer@sbi.co.in', 'Bank@2026');
await c.query(`
  select public.admin_link_user('principal@dits-delhi.edu.in', '1-10928371');
  select public.admin_link_user('director@bce-bangalore.edu.in', '1-14829104');
  select public.admin_link_user('reviewer.mehta@aicte-india.org', null, 'REVIEWER');
  select public.admin_link_user('admin.verma@aicte-india.org', null, 'ADMIN');
  update public.profiles set full_name = 'Dr. Rajesh Sharma', designation = 'Principal & Director', mobile = '+91 90000 10001' where email like 'principal%';
  update public.profiles set full_name = 'Prof. Ananya Rao', designation = 'Director', mobile = '+91 90000 10002' where email like 'director%';
  update public.profiles set full_name = 'Dr. Sunil K. Mehta', designation = 'Scrutiny Officer' where email like 'reviewer%';
  update public.profiles set full_name = 'Shri R. C. Verma', designation = 'Advisor' where email like 'admin%';
  select set_config('aicte.service', '', false);`);
c.release();

if (!process.env.AI_DOWN) {
  aiOverride.client = ({ content, docType, declared: d }) => {
    const text = content.toString('latin1');
    const extraction = {
      documentKind: docType, matchesExpectedType: true, legibility: 'clear',
      institutionNameInDocument: text.includes('OTHER_INSTITUTION') ? 'Deccan Institute of Advanced Studies' : d.institutionName,
      issuingAuthority: d.bankName || 'Issuing authority', referenceNumber: '', issueDate: d.issueDate || '', validTill: d.validTill || '',
      amountInr: d.amountInr ? String(text.includes('TAMPER_AMOUNT') ? d.amountInr - 2000000 : d.amountInr) : '', fdrNumber: d.fdrNumber || '',
      bankName: d.bankName || '', lienHolder: d.fdrNumber ? 'Regional Officer, Northern Regional Office, AICTE' : '', maturityDate: d.maturityDate || '',
      facultyProfessors: d.professors != null ? String(d.professors) : '', facultyAssociate: d.associateProfessors != null ? String(d.associateProfessors) : '',
      facultyAssistant: d.assistantProfessors != null ? String(d.assistantProfessors) : '',
      keyFields: [{ label: 'Document', value: docType, page: 1, sourceLine: text.split('\n')[1] || '' }], anomalies: [], summary: `Mock reading of ${docType}.`, confidence: 0.9,
    };
    return { beta: { messages: { create: async () => ({ model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_details: null, content: [{ type: 'text', text: JSON.stringify(extraction) }] }) } } };
  };
}
await startChangeListener();

const app = express();
// SQL as the server's own database role (reviewer/admin actions in tests). Returns the rows of the last statement.
app.post('/__sql', express.text({ type: () => true }), async (req, res) => {
  const client = await pool.connect();
  try { const r = await client.query(req.body); res.json((Array.isArray(r) ? r[r.length - 1] : r).rows || []); }
  catch (e) { res.status(400).json({ message: e.message }); }
  finally { await client.query('reset all').catch(() => {}); client.release(); }
});
app.get('/__expire', async (req, res) => { await pool.query('update auth.sessions set revoked_at = now() where revoked_at is null'); res.json({ ok: true }); });
app.get('/__mail', (req, res) => res.json(outbox.filter(m => !req.query.to || m.to === req.query.to)));
app.get('/config.js', (req, res) => res.type('text/javascript').send(`window.AICTE_CONFIG = { API_URL: '${BASE}', STORAGE_BUCKET: 'institution-documents', SSO_DOMAIN: '', API_CLIENT_URL: 'api-client.js' };`));
app.get('/sw.js', (req, res) => res.status(404).end());
for (const f of ['index.html', 'styles.css', 'data.js', 'backend.js', 'api-client.js', 'app.js', 'guide.js', 'i18n.js', 'manifest.webmanifest', 'emblem.png', 'fdr-vault-logo.png', 'fdr-vault-mark.png', 'delhi.webp', 'mumbai.webp', 'icon-192.png', 'icon-512.png'])
  app.get(`/${f}`, (req, res) => res.sendFile(path.join(APP, f)));
app.get('/', (req, res) => res.sendFile(path.join(APP, 'index.html')));
app.use('/members', express.static(path.join(APP, 'members')));
app.use(createApp());
app.listen(PORT, () => console.log(`API server + app (real PostgreSQL) on ${BASE}`));

const stop = async () => { await db.stop().catch(() => {}); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
