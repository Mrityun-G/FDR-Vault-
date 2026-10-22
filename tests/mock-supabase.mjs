// TEST ONLY — never deploy. Local Supabase stand-in for integration testing: serves the app (with a config.js pointing here) and
// emulates the Auth, PostgREST RPC and Storage endpoints used by backend.js, executing the real migration
// in PGlite under RLS as the signed-in user.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { analyzeDocument } from '../supabase/functions/analyze-document/extract.ts';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);

const APP = process.env.APP_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SB = path.join(APP, 'supabase');
const PORT = +(process.env.PORT || 8790);
const db = new PGlite();
const users = new Map();      // email -> { id, password, confirmed }
const tokens = new Map();     // access token -> user id
const files = new Map();      // storage path -> Buffer

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
  grant usage on schema storage to authenticated; grant select, insert on storage.objects to authenticated;
  grant execute on function storage.foldername(text) to authenticated;
  grant usage on schema public to authenticated, anon;
`);
for (const m of fs.readdirSync(path.join(SB, 'migrations')).filter(f => f.endsWith('.sql')).sort()) await db.exec(fs.readFileSync(path.join(SB, 'migrations', m), 'utf8'));
await db.exec(fs.readFileSync(path.join(SB, 'seed.sql'), 'utf8'));

async function createUser(email, password, meta = {}, confirmed = true) {
  const id = (await db.query('insert into auth.users(email, raw_user_meta_data) values ($1, $2) returning id', [email, meta])).rows[0].id;
  users.set(email.toLowerCase(), { id, password, confirmed });
  return id;
}
await createUser('principal@dits-delhi.edu.in', 'Dits@2026');
await createUser('director@bce-bangalore.edu.in', 'Bce@2026');
await createUser('reviewer.mehta@aicte-india.org', 'Rev@2026');
await createUser('admin.verma@aicte-india.org', 'Admin@2026');
await db.exec(`
  select public.admin_link_user('principal@dits-delhi.edu.in', '1-10928371');
  select public.admin_link_user('director@bce-bangalore.edu.in', '1-14829104');
  select public.admin_link_user('reviewer.mehta@aicte-india.org', null, 'REVIEWER');
  select public.admin_link_user('admin.verma@aicte-india.org', null, 'ADMIN');
  update public.profiles set full_name = 'Dr. Rajesh Sharma', designation = 'Principal & Director', mobile = '+91 90000 10001' where email like 'principal%';
  update public.profiles set full_name = 'Prof. Ananya Rao', designation = 'Director', mobile = '+91 90000 10002' where email like 'director%';
  update public.profiles set full_name = 'Dr. Sunil K. Mehta', designation = 'Scrutiny Officer' where email like 'reviewer%';
  update public.profiles set full_name = 'Shri R. C. Verma', designation = 'Advisor' where email like 'admin%';
`);

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
function session(u, email) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: u.id, email, role: 'authenticated', exp })}.${crypto.randomBytes(16).toString('base64url')}`;
  tokens.set(access, u.id);
  return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: crypto.randomUUID(), user: { id: u.id, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } };
}
const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'content-type': type, 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' });
  res.end(body === undefined ? '' : (type === 'application/json' ? JSON.stringify(body) : body));
};
const readBody = req => new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });
const pgArg = v => v === null || v === undefined ? null : Array.isArray(v) && v.every(x => typeof x === 'string') ? `{${v.map(x => `"${x}"`).join(',')}}` : typeof v === 'object' ? JSON.stringify(v) : v;

async function asUser(uid, fn) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid || '']);
  await db.exec(uid ? 'set role authenticated' : 'set role anon');
  try { return await fn(); } finally { await db.exec('reset role'); }
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.pdf': 'application/pdf' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const p = url.pathname;
  if (req.method === 'OPTIONS') return send(res, 204);
  const bearer = (req.headers.authorization || '').replace(/^Bearer /, '');
  const uid = tokens.get(bearer) || null;
  try {
    // ---- test control: run SQL as service role (reviewer/admin actions)
    if (p === '/__sql' && req.method === 'POST') { const r = await db.exec((await readBody(req)).toString()); return send(res, 200, r[r.length - 1].rows); }
    if (p === '/__expire') { tokens.clear(); return send(res, 200, { ok: true }); }
    // ---- auth
    if (p === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
      const b = JSON.parse(await readBody(req)); const u = users.get(String(b.email).toLowerCase());
      if (!u || u.password !== b.password) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 400, msg: 'Invalid login credentials' });
      return send(res, 200, session(u, b.email));
    }
    if (p === '/auth/v1/signup') {
      const b = JSON.parse(await readBody(req));
      if (users.has(b.email.toLowerCase())) return send(res, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
      const id = await createUser(b.email, b.password, b.data || {}, false);
      return send(res, 200, { id, aud: 'authenticated', role: 'authenticated', email: b.email, user_metadata: b.data || {}, created_at: new Date().toISOString(), confirmation_sent_at: new Date().toISOString() });
    }
    if (p === '/auth/v1/logout') { tokens.delete(bearer); return send(res, 204); }
    if (p === '/auth/v1/user') { if (!uid) return send(res, 401, { msg: 'invalid JWT' }); return send(res, 200, { id: uid, aud: 'authenticated' }); }
    if (p === '/auth/v1/recover' || p === '/auth/v1/otp') return send(res, 200, {});
    // ---- PostgREST RPC
    const rpc = /^\/rest\/v1\/rpc\/(\w+)$/.exec(p);
    if (rpc) {
      if (bearer && !uid) return send(res, 401, { code: 'PGRST301', message: 'JWT expired', details: null, hint: null });
      const args = JSON.parse((await readBody(req)).toString() || '{}');
      const names = Object.keys(args);
      const sql = `select public.${rpc[1]}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`;
      try {
        const r = await asUser(uid, () => db.query(sql, names.map(n => pgArg(args[n]))));
        const v = r.rows[0].r;
        return v === null || v === undefined ? send(res, 204) : send(res, 200, v);
      } catch (e) { return send(res, /permission denied/.test(e.message) ? 401 : 400, { code: e.code || 'P0001', message: e.message, details: e.detail || null, hint: null }); }
    }
    // ---- Edge Function: analyze-document. Runs the REAL analyzeDocument()/crossCheck(); only the Claude call is faked:
    //      the fake "reads" the declared values back, unless the test PDF contains TAMPER_AMOUNT / OTHER_INSTITUTION markers.
    if (p === '/functions/v1/analyze-document' && req.method === 'POST') {
      if (!uid) return send(res, 401, { code: 'FORBIDDEN', message: 'Sign in required' });
      if (process.env.AI_DOWN) return send(res, 503, { code: 'AI_NOT_CONFIGURED', message: 'AI service is not configured.' });
      const b = JSON.parse((await readBody(req)).toString());
      const inst = (await asUser(uid, () => db.query('select public.my_institution_id() id'))).rows[0].id;
      if (!inst || !String(b.storagePath).startsWith(inst + '/')) return send(res, 403, { code: 'FORBIDDEN', message: "Document is not in your institution's folder." });
      const buf = files.get(b.storagePath);
      if (!buf) return send(res, 404, { code: 'NOT_FOUND', message: 'Document not found in storage.' });
      const name = (await db.query('select name, pid from public.institutions where id = $1', [inst])).rows[0];
      const text = buf.toString('latin1'), d = b.declared || {};
      const extraction = {
        documentKind: b.docType, matchesExpectedType: true, legibility: 'clear',
        institutionNameInDocument: text.includes('OTHER_INSTITUTION') ? 'Deccan Institute of Advanced Studies' : name.name,
        issuingAuthority: d.bankName || 'Issuing authority', referenceNumber: '', issueDate: d.issueDate || '', validTill: d.validTill || '',
        amountInr: d.amountInr ? String(text.includes('TAMPER_AMOUNT') ? d.amountInr - 2000000 : d.amountInr) : '', fdrNumber: d.fdrNumber || '',
        bankName: d.bankName || '', lienHolder: d.fdrNumber ? 'Regional Officer, Northern Regional Office, AICTE' : '', maturityDate: d.maturityDate || '',
        facultyProfessors: d.professors != null ? String(d.professors) : '', facultyAssociate: d.associateProfessors != null ? String(d.associateProfessors) : '',
        facultyAssistant: d.assistantProfessors != null ? String(d.assistantProfessors) : '',
        keyFields: [{ label: 'Document', value: b.docType, page: 1, sourceLine: text.split('\n')[1] || '' }], anomalies: [], summary: `Mock reading of ${b.docType}.`, confidence: 0.9,
      };
      const fake = { beta: { messages: { create: async () => ({ model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_details: null, content: [{ type: 'text', text: JSON.stringify(extraction) }] }) } } };
      const result = await analyzeDocument(fake, { base64: buf.toString('base64'), mediaType: b.mimeType }, b.docType, { institutionName: name.name, pid: name.pid, ...d });
      return send(res, 200, result);
    }
    // ---- storage
    const up = /^\/storage\/v1\/object\/([\w-]+)\/(.+)$/.exec(p);
    if (up && req.method === 'POST' && !p.includes('/object/sign/')) {
      if (!uid) return send(res, 401, { statusCode: '401', error: 'Unauthorized', message: 'Unauthorized' });
      const objPath = decodeURIComponent(up[2]); const body = await readBody(req);
      try {
        await asUser(uid, () => db.query('insert into storage.objects(bucket_id, name) values ($1, $2)', [up[1], objPath]));
      } catch (e) { return send(res, 403, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' }); }
      files.set(objPath, body);
      return send(res, 200, { Key: `${up[1]}/${objPath}`, Id: crypto.randomUUID() });
    }
    const sign = /^\/storage\/v1\/object\/sign\/([\w-]+)\/(.+)$/.exec(p);
    if (sign && req.method === 'POST') {
      const objPath = decodeURIComponent(sign[2]);
      const ok = await asUser(uid, () => db.query('select 1 from storage.objects where bucket_id = $1 and name = $2', [sign[1], objPath]));
      if (!ok.rows.length) return send(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
      return send(res, 200, { signedURL: `/object/sign/${sign[1]}/${objPath}?token=t` });
    }
    if (sign && req.method === 'GET') return send(res, 200, files.get(decodeURIComponent(sign[2])) || Buffer.from('missing'), 'application/pdf');
    if (p.startsWith('/realtime/')) return send(res, 404, {});
    // ---- static app (config.js points at this server)
    if (p === '/config.js') return send(res, 200, `window.AICTE_CONFIG = { SUPABASE_URL: 'http://127.0.0.1:${PORT}', SUPABASE_ANON_KEY: 'anon-test-key', STORAGE_BUCKET: 'institution-documents', SSO_DOMAIN: '', SUPABASE_JS_URL: '/__supabase.js' };`, 'text/javascript');
    if (p === '/__supabase.js') return send(res, 200, fs.readFileSync(path.join(path.dirname(require.resolve('@supabase/supabase-js')), '..', 'umd', 'supabase.js')), 'text/javascript');
    if (p === '/sw.js') return send(res, 404, '', 'text/plain');
    const file = path.join(APP, p === '/' ? 'index.html' : p);
    if (file.startsWith(APP) && fs.existsSync(file) && fs.statSync(file).isFile()) return send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
    send(res, 404, { message: 'not found' });
  } catch (e) { console.error(e); send(res, 500, { message: e.message }); }
}).listen(PORT, () => console.log(`mock supabase + app on http://127.0.0.1:${PORT}`));
