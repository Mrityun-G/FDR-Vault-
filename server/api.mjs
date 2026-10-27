// Data API (replaces Supabase's REST, Storage, Edge Function and Realtime services).
// Everything a client reads or changes runs through asUser(): the database's grants and row-level security
// policies — unchanged from the Supabase project — decide what each signed-in user may do.
import express from 'express';
import pg from 'pg';
import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.mjs';
import { pool, asUser, asService, query } from './db.mjs';
import { signPath, verifyPathSig } from './tokens.mjs';
import { requireUser } from './auth.mjs';
import { analyzeDocument, buildResult, DOC_TYPES, MEDIA_TYPES, RefusedError } from '../supabase/functions/analyze-document/extract.ts';
import { readWithoutAi, readerName } from './read-pdf.mjs';

export const apiRouter = express.Router();
const fail = (res, status, message, extra = {}) => res.status(status).json({ message, ...extra });
const pgError = (res, e) => {
  if (!e.code) { console.error(e); return fail(res, 500, 'Unexpected server error'); }
  fail(res, e.code === '42501' ? 403 : 400, e.message, { code: e.code, details: e.detail || null, hint: e.hint || null });
};

// ---------------------------------------------------------------- database functions (was PostgREST /rpc)

// Callable functions = exactly those the schema grants to signed-in users; read from the catalog, never hard-coded.
let callable = null;
async function loadCallable() {
  const { rows } = await query(`
    select p.proname as name, coalesce(p.proargnames[1:p.pronargs], '{}') as args,
           array(select format_type(t, null) from unnest(p.proargtypes::oid[]) t) as types
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace and has_function_privilege('authenticated', p.oid, 'EXECUTE')`);
  callable = new Map(rows.map(r => [r.name, { args: r.args, types: r.types }]));
}

apiRouter.post('/rpc/:fn', requireUser, async (req, res) => {
  if (!callable) await loadCallable();
  const fn = callable.get(req.params.fn);
  if (!fn) return fail(res, 404, `Could not find the function public.${req.params.fn}`);
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const names = Object.keys(body).filter(k => body[k] !== undefined);
  const bad = names.find(n => !fn.args.includes(n));
  if (bad) return fail(res, 400, `Unknown argument ${bad} for ${req.params.fn}`);
  const values = names.map(n => {
    const v = body[n], type = fn.types[fn.args.indexOf(n)];
    return v !== null && /^jsonb?$/.test(type) ? JSON.stringify(v) : v;
  });
  const sql = `select public.${pg.escapeIdentifier(req.params.fn)}(${names.map((n, i) => `${pg.escapeIdentifier(n)} => $${i + 1}`).join(', ')}) as r`;
  try {
    const { rows } = await asUser(req.uid, c => c.query(sql, values));
    res.json(rows[0].r ?? null);
  } catch (e) { pgError(res, e); }
});

// ---------------------------------------------------------------- staff-portal reads (was PostgREST table selects)
// Fixed queries returning the same nested shape as before. They run as the caller, so RLS filters every table.

const one = (table, fk, cols) => `(select jsonb_build_object(${cols.map(c => `'${c}', e.${c}`).join(', ')}) from public.${table} e where e.id = t.${fk})`;
const many = (table, fk) => `coalesce((select jsonb_agg(to_jsonb(e.*)) from public.${table} e where e.${fk} = t.id), '[]'::jsonb)`;
const VIEWS = {
  me: `select to_jsonb(t.*) || jsonb_build_object('institutions', ${one('institutions', 'institution_id', ['name', 'pid', 'region'])}) as j
         from public.profiles t where t.id = auth.uid()`,
  applications: `select to_jsonb(t.*) || jsonb_build_object(
           'institutions', ${one('institutions', 'institution_id', ['name', 'pid', 'region', 'state', 'city', 'required_fdr_lakhs'])},
           'application_documents', ${many('application_documents', 'application_id')}, 'findings', ${many('findings', 'application_id')},
           'scrutiny', (select to_jsonb(e.*) from public.scrutiny e where e.application_id = t.id limit 1),
           'compliance_responses', ${many('compliance_responses', 'application_id')}, 'status_history', ${many('status_history', 'application_id')}) as j
         from public.applications t order by t.last_updated_at desc`,
  fdrs: `select to_jsonb(t.*) || jsonb_build_object('institutions', ${one('institutions', 'institution_id', ['name', 'pid'])},
           'fdr_requests', ${many('fdr_requests', 'fdr_id')}) as j from public.fdrs t order by t.maturity_date asc`,
  audit_events: `select to_jsonb(t.*) as j from public.audit_events t order by t.id desc limit 500`,
  profiles: `select to_jsonb(t.*) || jsonb_build_object('institutions', ${one('institutions', 'institution_id', ['name', 'pid'])}) as j
         from public.profiles t order by t.created_at desc`,
  registration_requests: `select to_jsonb(t.*) as j from public.registration_requests t order by t.created_at desc`,
  user_invites: `select to_jsonb(t.*) as j from public.user_invites t order by t.created_at desc`,
  institutions: `select jsonb_build_object('name', t.name, 'pid', t.pid) as j from public.institutions t order by t.name`,
};

apiRouter.get('/data/:view', requireUser, async (req, res) => {
  const sql = Object.hasOwn(VIEWS, req.params.view) && VIEWS[req.params.view];
  if (!sql) return fail(res, 404, 'Unknown view');
  try {
    const { rows } = await asUser(req.uid, c => c.query(sql));
    res.json(req.params.view === 'me' ? (rows[0] ? rows[0].j : null) : rows.map(r => r.j));
  } catch (e) { pgError(res, e); }
});

// ---------------------------------------------------------------- private document storage (was Supabase Storage)

const objectPath = req => [].concat(req.params.path).join('/');
const validPath = p => p && !p.startsWith('/') && !p.split('/').some(s => !s || s === '.' || s === '..') && p.length <= 400;

apiRouter.post('/storage/object/:bucket/*path', requireUser, express.raw({ type: () => true, limit: '12mb' }), async (req, res) => {
  const name = objectPath(req), mime = String(req.headers['content-type'] || 'application/octet-stream').split(';')[0];
  if (!validPath(name)) return fail(res, 400, 'Invalid object path');
  const { rows: [b] } = await query('select * from storage.buckets where id = $1', [req.params.bucket]);
  if (!b) return fail(res, 404, 'Bucket not found');
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (b.file_size_limit && body.length > b.file_size_limit) return fail(res, 413, 'The object exceeded the maximum allowed size');
  if (b.allowed_mime_types && !b.allowed_mime_types.includes(mime)) return fail(res, 415, `mime type ${mime} is not supported`);
  try {
    await asUser(req.uid, c => c.query('insert into storage.objects(bucket_id, name, mime_type, size_bytes, content) values ($1, $2, $3, $4, $5)',
      [b.id, name, mime, body.length, body]));
    res.json({ Key: `${b.id}/${name}` });
  } catch (e) {
    if (e.code === '23505') return fail(res, 409, 'The resource already exists');
    if (e.code === '42501') return fail(res, 403, 'new row violates row-level security policy');
    pgError(res, e);
  }
});

// A signed link is issued only if the caller may read the object (storage RLS); the link then works for a short time.
apiRouter.post('/storage/sign/:bucket/*path', requireUser, async (req, res) => {
  const name = objectPath(req), seconds = Math.min(Math.max(+req.body.expiresIn || 60, 10), 3600);
  try {
    const { rowCount } = await asUser(req.uid, c => c.query('select 1 from storage.objects where bucket_id = $1 and name = $2', [req.params.bucket, name]));
    if (!rowCount) return fail(res, 404, 'Object not found');
    const key = `${req.params.bucket}/${name}`, exp = Math.floor(Date.now() / 1000) + seconds;
    res.json({ signedUrl: `${config.publicUrl}/storage/signed/${key.split('/').map(encodeURIComponent).join('/')}?exp=${exp}&sig=${signPath(config.jwtSecret, key, exp)}` });
  } catch (e) { pgError(res, e); }
});

apiRouter.get('/storage/signed/:bucket/*path', async (req, res) => {
  const name = objectPath(req), key = `${req.params.bucket}/${name}`;
  if (!verifyPathSig(config.jwtSecret, key, req.query.exp, req.query.sig)) return fail(res, 400, 'Signed link is invalid or has expired');
  const { rows: [o] } = await query('select mime_type, content from storage.objects where bucket_id = $1 and name = $2', [req.params.bucket, name]);
  if (!o) return fail(res, 404, 'Object not found');
  res.set({ 'content-type': o.mime_type || 'application/octet-stream', 'cache-control': 'private, no-store',
    'content-disposition': `inline; filename="${name.split('/').pop().replace(/[^\w.-]/g, '_')}"` }).send(o.content);
});

// ---------------------------------------------------------------- AI document reading (was Edge Function analyze-document)

const anthropic = config.anthropicApiKey ? new Anthropic({ apiKey: config.anthropicApiKey }) : null;
// Test hook: a fake Anthropic client, or a function ({ content, docType, declared }) returning one. Never set in production.
export const aiOverride = { client: null };
// The document reader for this server: the test override, the configured Claude client, or null when AI is off.
export const aiClient = () => aiOverride.client || anthropic;

apiRouter.post('/functions/analyze-document', requireUser, async (req, res) => {
  const { storagePath = '', docType = '', mimeType = '', declared: d = {} } = req.body || {};
  const { rows: [me] } = await asUser(req.uid, c => c.query('select public.my_institution_id() as id'));
  if (!me || !me.id) return fail(res, 403, 'Only active institution accounts can analyse documents.', { code: 'FORBIDDEN' });
  if (!String(storagePath).startsWith(`${me.id}/`) || String(storagePath).includes('..')) return fail(res, 403, "Document is not in your institution's folder.", { code: 'FORBIDDEN' });
  if (!(docType in DOC_TYPES)) return fail(res, 400, 'Unknown document type.', { code: 'VALIDATION' });
  if (!MEDIA_TYPES.includes(mimeType)) return fail(res, 400, 'Only PDF, JPG or PNG documents can be analysed.', { code: 'VALIDATION' });
  const { rows: [o] } = await query(`select content from storage.objects where bucket_id = 'institution-documents' and name = $1`, [storagePath]);
  if (!o) return fail(res, 404, 'Document not found in storage.', { code: 'NOT_FOUND' });
  if (o.content.length > 10 * 1024 * 1024) return fail(res, 413, 'Document exceeds 10 MB.', { code: 'VALIDATION' });
  const { rows: [inst] } = await query('select name, pid from public.institutions where id = $1', [me.id]);
  const declared = { institutionName: inst?.name ?? '', pid: inst?.pid ?? '', fdrNumber: d.fdrNumber, amountInr: d.amountInr, bankName: d.bankName, issueDate: d.issueDate,
    maturityDate: d.maturityDate, validTill: d.validTill, professors: d.professors, associateProfessors: d.associateProfessors, assistantProfessors: d.assistantProfessors };
  // Without AI, text PDFs are still read: the PDF's text with fixed rules, through the same cross-checks.
  if (!aiOverride.client && !anthropic) {
    const r = await readWithoutAi(o.content, mimeType, docType, declared).catch(() => ({}));
    if (!r.extraction) return fail(res, 503, 'AI service is not configured.', { code: 'AI_NOT_CONFIGURED' });
    const result = buildResult(r.extraction, docType, declared, readerName(r.extraction));
    await query(`select public._audit(p_inst => $1, p_actor => null, p_actor_name => 'Document Reader (rules)', p_actor_role => 'SYSTEM', p_action => 'DOCUMENT_READ_BY_RULES',
        p_target_type => 'DOCUMENT', p_target_id => $2, p_details => $3)`, [me.id, storagePath.split('/').pop(), `${docType}: ${result.status.toUpperCase()} (${readerName(r.extraction)}); ${result.mismatches.length} mismatch(es) with declared values.`]).catch(() => {});
    return res.json(result);
  }
  const ai = typeof aiOverride.client === 'function' ? aiOverride.client({ content: o.content, docType, declared }) : aiOverride.client || anthropic;
  try {
    const result = await analyzeDocument(ai, { base64: o.content.toString('base64'), mediaType: mimeType }, docType, declared);
    await query(`select public._audit(p_inst => $1, p_actor => null, p_actor_name => 'AI Document Reader', p_actor_role => 'SYSTEM', p_action => 'AI_DOCUMENT_ANALYSIS',
        p_target_type => 'DOCUMENT', p_target_id => $2, p_details => $3)`, [me.id, storagePath.split('/').pop(),
      `${docType}: ${result.status.toUpperCase()} (${result.analysis.modelUsed}, confidence ${result.analysis.confidence}); ${result.mismatches.length} mismatch(es) with declared values.`]).catch(() => {});
    res.json(result);
  } catch (e) {
    if (e instanceof RefusedError) return fail(res, 422, e.message, { code: 'AI_DECLINED' });
    if (e instanceof Anthropic.RateLimitError) return fail(res, 429, 'AI service is busy — try again shortly.', { code: 'RATE_LIMITED' });
    if (e instanceof Anthropic.AuthenticationError) return fail(res, 503, 'AI service is not configured.', { code: 'AI_NOT_CONFIGURED' });
    if (e instanceof Anthropic.APIError) return fail(res, 502, `AI service error (${e.status}).`, { code: 'AI_UNAVAILABLE' });
    fail(res, 500, e instanceof Error ? e.message : 'Analysis failed.', { code: 'AI_FAILED' });
  }
});

// ---------------------------------------------------------------- live updates (was Supabase Realtime)
// Table triggers pg_notify('aicte_changes'); this relays "table X changed" to each connected client it concerns.
// Institutions only hear about their own institution; clients then reload through the protected functions.

const listeners = new Set();
let listenClient = null;
export async function startChangeListener() {
  const c = new pg.Client({ connectionString: config.databaseUrl, ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined });
  c.on('notification', msg => {
    let ev; try { ev = JSON.parse(msg.payload); } catch { return; }
    for (const l of listeners) if (l.all || (l.institution && l.institution === ev.institution_id)) l.send({ table: ev.table });
  });
  c.on('error', () => { listenClient = null; setTimeout(() => startChangeListener().catch(() => {}), 3000); });
  await c.connect();
  await c.query('listen aicte_changes');
  listenClient = c;
}
export const stopChangeListener = () => listenClient && listenClient.end().catch(() => {});

apiRouter.get('/events', requireUser, async (req, res) => {
  const { rows: [who] } = await asUser(req.uid, c => c.query(
    `select public.my_institution_id() as inst, coalesce((select roles && array['REVIEWER','ADMIN','BANK_OFFICIAL'] and status = 'ACTIVE' from public.profiles where id = auth.uid()), false) as staff`));
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' });
  res.write(': connected\n\n');
  const l = { all: who.staff, institution: who.inst, send: ev => res.write(`data: ${JSON.stringify(ev)}\n\n`) };
  listeners.add(l);
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
  req.on('close', () => { clearInterval(ping); listeners.delete(l); });
});

// ---------------------------------------------------------------- scheduled job (was pg_cron, 01:30 UTC daily)

export function startScheduler() {
  const runAt = () => { const n = new Date(), t = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 1, 30)); if (t <= n) t.setUTCDate(t.getUTCDate() + 1); return t - n; };
  const run = async () => {
    try { const { rows } = await asService(c => c.query('select public.generate_expiry_reminders() as n')); console.log(`[scheduler] FDR expiry reminders: ${rows[0].n}`); }
    catch (e) { console.error('[scheduler]', e.message); }
    setTimeout(run, runAt()).unref();
  };
  setTimeout(run, runAt()).unref();
}

export const health = async (req, res) => { await pool.query('select 1'); res.json({ ok: true }); };
