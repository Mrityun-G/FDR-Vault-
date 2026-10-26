// API server test-suite: real PostgreSQL 17 (embedded-postgres) + the real Express app over HTTP.
// Covers auth (password, confirmation, OTP, reset, refresh, logout, Google via a local fake), RPC permissions,
// row-level security, storage, live updates, the AI function (fake model) and the scheduled job.
// Usage: npm run test:server
import http from 'node:http';
import crypto from 'node:crypto';
import { startPostgres } from './embedded-pg.mjs';

const db = await startPostgres(54331);
const GOOGLE_PORT = 8799, API_PORT = 8798, API = `http://127.0.0.1:${API_PORT}`;
Object.assign(process.env, {
  DATABASE_URL: db.url, JWT_SECRET: crypto.randomBytes(32).toString('hex'), PUBLIC_URL: API, PORT: String(API_PORT),
  ALLOWED_ORIGINS: 'http://localhost:5180,http://localhost:8765', REQUIRE_EMAIL_CONFIRMATION: 'true', RUN_SCHEDULER: 'false',
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret',
  GOOGLE_AUTH_URL: `http://127.0.0.1:${GOOGLE_PORT}/auth`, GOOGLE_TOKEN_URL: `http://127.0.0.1:${GOOGLE_PORT}/token`,
});
const { migrate } = await import('../../server/migrate.mjs');
await migrate(db.url, { seed: true, log: () => {} });
const { createApp } = await import('../../server/app.mjs');
const { startChangeListener, stopChangeListener, aiOverride } = await import('../../server/api.mjs');
const { outbox } = await import('../../server/mail.mjs');
const { asService, pool } = await import('../../server/db.mjs');
await startChangeListener();
const server = createApp().listen(API_PORT);

// Fake Google: /auth bounces straight back with a code; /token returns an ID token for the account in GOOGLE_USER.
let GOOGLE_USER = null;
const google = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/auth') { res.writeHead(302, { location: `${API}/auth/callback?code=fake-code&state=${encodeURIComponent(u.searchParams.get('state'))}` }); return res.end(); }
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const id = b64({ iss: 'https://accounts.google.com', aud: 'test-client', exp: Math.floor(Date.now() / 1000) + 300, email_verified: true, ...GOOGLE_USER });
  res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ id_token: `${b64({ alg: 'RS256' })}.${id}.sig` }));
}).listen(GOOGLE_PORT);

let passed = 0, failed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('  ✓', m); } else { failed++; console.log('  ✗', m); } };
async function call(method, path, { token, body, raw, type } = {}) {
  const r = await fetch(API + path, { method, redirect: 'manual',
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(raw ? { 'content-type': type } : body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: r.status, body: json, location: r.headers.get('location') };
}
const login = async (email, password = 'Sih@2026Demo') => (await call('POST', '/auth/token?grant_type=password', { body: { email, password } })).body;
const rpc = (token, fn, args = {}) => call('POST', `/rpc/${fn}`, { token, body: args });
const lastMail = to => [...outbox].reverse().find(m => m.to === to);

try {
  console.log('\nPassword sign-in & sessions');
  const inst = await login('sih_demo.institution@example.com');
  ok(inst.access_token && inst.refresh_token && inst.user.email === 'sih_demo.institution@example.com', 'demo institution signs in with password');
  ok((await call('POST', '/auth/token?grant_type=password', { body: { email: 'sih_demo.institution@example.com', password: 'wrong' } })).body.message === 'Invalid login credentials', 'wrong password rejected');
  const st = await rpc(inst.access_token, 'get_portal_state');
  ok(st.status === 200 && st.body.institution.pid === '1-10928371' && st.body.apps.length === 2, `get_portal_state via API: ${st.body.apps?.length} apps, ${st.body.fdrs?.length} FDRs`);
  ok((await rpc(null, 'get_portal_state')).status === 401, 'RPC without sign-in rejected');
  ok((await rpc(inst.access_token, '_audit', {})).status === 404, 'internal (ungranted) function not callable');
  ok(/^FORBIDDEN/.test((await rpc(inst.access_token, 'review_start', { p_application_id: st.body.apps[0].id })).body.message), 'institution cannot call reviewer function (FORBIDDEN from the database)');
  ok((await rpc(inst.access_token, 'get_portal_state', { p_bogus: 1 })).status === 400, 'unknown argument rejected');
  const ref = await call('POST', '/auth/token?grant_type=refresh_token', { token: 'stale', body: { refresh_token: inst.refresh_token } });
  ok(ref.status === 200 && ref.body.refresh_token !== inst.refresh_token, 'refresh token rotates (even with a stale bearer attached)');
  ok((await call('POST', '/auth/token?grant_type=refresh_token', { body: { refresh_token: inst.refresh_token } })).status === 401, 'old refresh token no longer works');
  const tmp = await login('sih_demo.institution@example.com');
  await call('POST', '/auth/logout', { token: tmp.access_token });
  const after = await rpc(tmp.access_token, 'get_portal_state');
  ok(after.status === 401 && after.body.message === 'JWT expired', 'logout revokes the session immediately');

  console.log('\nRow-level security through the API');
  const officer = await login('sih_demo.officer@example.com'), admin = await login('sih_demo.admin@example.com'), bank = await login('sih_demo.bank@example.com');
  const allApps = (await call('GET', '/data/applications', { token: officer.access_token })).body;
  const instApps = (await call('GET', '/data/applications', { token: inst.access_token })).body;
  ok(allApps.length > instApps.length && instApps.every(a => a.institution_id === st.body.institution.id), `officer sees ${allApps.length} applications, institution only its own ${instApps.length}`);
  ok(allApps[0].institutions && Array.isArray(allApps[0].application_documents) && 'scrutiny' in allApps[0], 'applications view keeps the nested shape (institutions, documents, scrutiny…)');
  ok((await call('GET', '/data/user_invites', { token: officer.access_token })).body.length === 0 && (await call('GET', '/data/user_invites', { token: admin.access_token })).body.length >= 0, 'invites readable per role');
  const me = (await call('GET', '/data/me', { token: bank.access_token })).body;
  ok(me.role === 'BANK_OFFICIAL' && me.bank_name === 'State Bank of India', 'staff profile view (me)');
  ok((await call('GET', '/data/fdrs', { token: bank.access_token })).body.length > 0, 'bank official reads FDRs');
  ok((await call('GET', '/data/nope', { token: admin.access_token })).status === 404 && (await call('GET', '/data/fdrs')).status === 401, 'unknown view 404, anonymous 401');

  console.log('\nPrivate document storage');
  const instId = st.body.institution.id, path = `${instId}/${crypto.randomUUID()}/fdr.pdf`;
  const pdf = '%PDF-1.4\n% test\n1 0 obj<</Type /Page>>endobj\n%%EOF\n';
  ok((await call('POST', `/storage/object/institution-documents/${path}`, { token: inst.access_token, raw: pdf, type: 'application/pdf' })).status === 200, 'institution uploads into its own folder');
  const other = (await call('GET', '/data/applications', { token: officer.access_token })).body.find(a => a.institution_id !== instId).institution_id;
  ok((await call('POST', `/storage/object/institution-documents/${other}/x/evil.pdf`, { token: inst.access_token, raw: pdf, type: 'application/pdf' })).status === 403, "upload into another institution's folder refused (storage RLS)");
  ok((await call('POST', `/storage/object/institution-documents/${instId}/x/a.exe`, { token: inst.access_token, raw: 'MZ', type: 'application/x-msdownload' })).status === 415, 'disallowed file type refused');
  const signed = await call('POST', `/storage/sign/institution-documents/${path}`, { token: inst.access_token, body: { expiresIn: 120 } });
  const dl = await fetch(signed.body.signedUrl);
  ok(dl.status === 200 && (await dl.text()) === pdf, 'signed link downloads the original');
  ok((await fetch(signed.body.signedUrl.replace(/sig=[^&]+/, 'sig=forged'))).status === 400, 'tampered link refused');
  ok((await call('POST', `/storage/sign/institution-documents/${path}`, { token: officer.access_token, body: {} })).status === 200, 'AICTE staff can open institution documents');
  const bce = (await call('GET', '/data/profiles', { token: admin.access_token })).body;
  ok(Array.isArray(bce), 'admin directory view');

  console.log('\nFDR workflow + live updates');
  const events = [];
  const ctrl = new AbortController();
  fetch(`${API}/events`, { headers: { authorization: `Bearer ${inst.access_token}` }, signal: ctrl.signal }).then(async r => {
    const reader = r.body.getReader(), dec = new TextDecoder();
    for (;;) { const { value, done } = await reader.read(); if (done) break; for (const m of dec.decode(value).matchAll(/data: (.*)/g)) events.push(JSON.parse(m[1])); }
  }).catch(() => {});
  await new Promise(r => setTimeout(r, 300));
  const fdr = await rpc(inst.access_token, 'submit_fdr', { p: { fdrNumber: 'SBI-FDR-77001-2026', bankName: 'State Bank of India', branchName: 'Vasant Kunj', ifscCode: 'SBIN0001234',
    amount: 10000000, amountRs: '10000000', issueDate: '2026-01-01', maturityDate: '2035-12-31', applicationNumber: '',
    evidence: { fileName: 'fdr.pdf', fileSizeBytes: pdf.length, fileSizeKb: 1, mimeType: 'application/pdf', fileHash: crypto.createHash('sha256').update(pdf).digest('hex'), storagePath: path, pageCount: 1 } } });
  ok(fdr.status === 200 && fdr.body.fdrId, 'institution submits a new FDR with uploaded evidence');
  const endorse = await rpc(bank.access_token, 'bank_endorse_lien', { p_fdr_id: fdr.body.fdrId, p_token: 'CBS-TEST-1' });
  ok(endorse.status === 200, 'bank official endorses the lien');
  await new Promise(r => setTimeout(r, 500));
  ok(events.some(e => e.table === 'fdrs') && events.some(e => e.table === 'notifications'), `institution received live updates (${[...new Set(events.map(e => e.table))].join(', ')})`);
  ctrl.abort();
  const fdrs = (await rpc(inst.access_token, 'get_portal_state')).body.fdrs;
  ok(fdrs.find(f => f.id === fdr.body.fdrId).isLienConfirmed === true, 'FDR shows lien confirmed');

  console.log('\nRegistration with email confirmation');
  const reg = { name: 'Rajdhani Institute of Engineering & Technology', pid: '', state: 'Delhi', district: 'South West Delhi', type: 'Unaided - Private', head: 'Dr. Anita Verma', mobile: '9876543210', role: 'INSTITUTION' };
  const su = await call('POST', '/auth/signup', { body: { email: 'new.college@example.com', password: 'New@2026x', data: { full_name: reg.head, registration: reg }, redirect_to: 'http://localhost:8765/' } });
  ok(su.status === 200 && su.body.session === null, 'sign-up returns no session until the email is confirmed');
  ok((await call('POST', '/auth/token?grant_type=password', { body: { email: 'new.college@example.com', password: 'New@2026x' } })).body.message === 'Email not confirmed', 'unconfirmed email cannot sign in');
  ok((await call('POST', '/auth/signup', { body: { email: 'NEW.college@example.com', password: 'New@2026x' } })).body.message === 'User already registered', 'duplicate email rejected');
  const link = lastMail('new.college@example.com').text.match(/https?:\S+/)[0];
  const v = await call('GET', link.replace(API, ''));
  const back = new URL(v.location);
  ok(v.status === 302 && back.origin === 'http://localhost:8765' && back.searchParams.get('auth_type') === 'signup', 'confirmation link redirects back to the app with a one-time code');
  const ex = await call('POST', '/auth/exchange', { body: { code: back.searchParams.get('auth_code') } });
  ok(ex.status === 200 && ex.body.access_token, 'code exchanged for a session');
  ok((await call('POST', '/auth/exchange', { body: { code: back.searchParams.get('auth_code') } })).status === 400, 'code is single-use');
  const newSt = await rpc(ex.body.access_token, 'get_portal_state');
  ok(newSt.status === 200 && newSt.body.institution.name === reg.name, 'self-registered institution is ACTIVE at once (no approval)');
  ok((await call('POST', '/auth/signup', { body: { email: 'evil@example.com', password: 'Evil@2026x', redirect_to: 'https://evil.example/' } })).status === 200
     && !/evil\.example/.test(lastMail('evil@example.com').text), 'foreign redirect address is dropped');

  console.log('\nEmail OTP & password reset');
  ok((await call('POST', '/auth/otp', { body: { email: 'nobody@example.com' } })).status === 422, 'OTP only for existing accounts');
  await call('POST', '/auth/otp', { body: { email: 'sih_demo.officer@example.com' } });
  const code = lastMail('sih_demo.officer@example.com').text.match(/\b\d{6}\b/)[0];
  ok((await call('POST', '/auth/verify', { body: { email: 'sih_demo.officer@example.com', token: '000000' === code ? '111111' : '000000', type: 'email' } })).status === 400, 'wrong OTP rejected');
  const otp = await call('POST', '/auth/verify', { body: { email: 'sih_demo.officer@example.com', token: code, type: 'email' } });
  ok(otp.status === 200 && otp.body.session.access_token, 'correct OTP signs in');
  ok((await call('POST', '/auth/otp', { body: { email: 'sih_demo.officer@example.com' } })).status === 429, 'OTP resend rate-limited (60 s)');
  await call('POST', '/auth/recover', { body: { email: 'new.college@example.com', redirect_to: 'http://localhost:8765/' } });
  const rl = new URL((await call('GET', lastMail('new.college@example.com').text.match(/https?:\S+/)[0].replace(API, ''))).location);
  ok(rl.searchParams.get('auth_type') === 'recovery', 'recovery link returns with type recovery');
  const rs = (await call('POST', '/auth/exchange', { body: { code: rl.searchParams.get('auth_code') } })).body;
  ok((await call('PUT', '/auth/user', { token: rs.access_token, body: { password: 'Changed@2026' } })).status === 200, 'new password set from the recovery session');
  ok((await login('new.college@example.com', 'Changed@2026')).access_token, 'sign in with the new password');

  console.log('\nGoogle sign-in');
  ok((await call('GET', '/auth/authorize?provider=google&redirect_to=https://evil.example/')).status === 400, 'Google sign-in refuses foreign redirect');
  GOOGLE_USER = { sub: 'g-123', email: 'officer.new@gmail.com', name: 'New Officer' };
  const a1 = await call('GET', '/auth/authorize?provider=google&redirect_to=http://localhost:5180/officer&prompt=select_account');
  ok(a1.status === 302 && a1.location.startsWith(process.env.GOOGLE_AUTH_URL) && a1.location.includes('prompt=select_account'), 'redirects to Google');
  const g1 = await fetch(a1.location, { redirect: 'manual' }).then(r => r.headers.get('location'));
  const cb = await call('GET', g1.replace(API, ''));
  const gb = new URL(cb.location);
  ok(gb.origin + gb.pathname === 'http://localhost:5180/officer' && gb.searchParams.get('auth_code'), 'callback returns to the portal with a code');
  const gs = (await call('POST', '/auth/exchange', { body: { code: gb.searchParams.get('auth_code') } })).body;
  const gp = (await call('GET', '/data/me', { token: gs.access_token })).body;
  ok(gp && gp.needs_registration === true, 'new Google account is asked for registration details once (needs_registration)');
  GOOGLE_USER = { sub: 'g-999', email: 'sih_demo.admin@example.com', name: 'Admin' };
  const a2 = await call('GET', '/auth/authorize?provider=google&redirect_to=http://localhost:5180/admin');
  const cb2 = await call('GET', (await fetch(a2.location, { redirect: 'manual' }).then(r => r.headers.get('location'))).replace(API, ''));
  const gs2 = (await call('POST', '/auth/exchange', { body: { code: new URL(cb2.location).searchParams.get('auth_code') } })).body;
  ok((await call('GET', '/data/me', { token: gs2.access_token })).body.role === 'ADMIN', 'Google account with an existing email links to that account');

  console.log('\nAI document reading (fake model) & scheduled job');
  ok((await call('POST', '/functions/analyze-document', { token: inst.access_token, body: { storagePath: path, docType: 'FDR_CORPUS', mimeType: 'application/pdf' } })).body.code === 'AI_NOT_CONFIGURED', 'no API key: AI_NOT_CONFIGURED');
  aiOverride.client = { beta: { messages: { create: async () => ({ model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_details: null, content: [{ type: 'text', text: JSON.stringify({
    documentKind: 'FDR_CORPUS', matchesExpectedType: true, legibility: 'clear', institutionNameInDocument: st.body.institution.name, issuingAuthority: 'SBI', referenceNumber: '', issueDate: '2026-01-01',
    validTill: '', amountInr: '10000000', fdrNumber: 'SBI-FDR-77001-2026', bankName: 'State Bank of India', lienHolder: 'Regional Officer, AICTE', maturityDate: '2035-12-31',
    facultyProfessors: '', facultyAssociate: '', facultyAssistant: '', keyFields: [], anomalies: [], summary: 'ok', confidence: 0.9 }) }] }) } } };
  const ai = await call('POST', '/functions/analyze-document', { token: inst.access_token, body: { storagePath: path, docType: 'FDR_CORPUS', mimeType: 'application/pdf', declared: { fdrNumber: 'SBI-FDR-77001-2026', amountInr: 10000000 } } });
  ok(ai.status === 200 && ai.body.analysis && Array.isArray(ai.body.mismatches), `document analysed (status ${ai.body.status})`);
  ok((await call('POST', '/functions/analyze-document', { token: inst.access_token, body: { storagePath: `${other}/x/y.pdf`, docType: 'FDR_CORPUS', mimeType: 'application/pdf' } })).status === 403, "cannot analyse another institution's document");
  const tz = (await pool.query('show timezone')).rows[0].TimeZone;
  ok(tz === 'Asia/Kolkata', `database dates follow India Standard Time (${tz})`);
  const n = (await asService(c => c.query('select public.generate_expiry_reminders() n'))).rows[0].n;
  ok(Number.isInteger(n), `daily FDR reminder job runs as a server job (${n} reminder(s))`);
} catch (e) {
  failed++; console.error(e);
} finally {
  server.close(); google.close(); await stopChangeListener(); await pool.end(); await db.stop();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
