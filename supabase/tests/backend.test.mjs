// Backend test-suite: runs the real migration + seed in an embedded Postgres (PGlite) with Supabase's
// auth/storage schemas stubbed, then exercises the workflow as different users under RLS.
// Usage:  npm i @electric-sql/pglite@0.2.17  &&  node supabase/tests/backend.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const dir = process.env.SUPABASE_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new PGlite();
let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) { passed++; console.log('  ✓', msg); } else { failed++; console.log('  ✗', msg); } };

// ---- Supabase platform stubs (auth.uid() from a session setting, roles, storage schema)
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
  grant usage on schema storage to authenticated; grant select, insert on storage.objects to authenticated;
  grant execute on function storage.foldername(text) to authenticated;
  grant usage on schema public to authenticated, anon;
`);
for (const m of fs.readdirSync(path.join(dir, 'migrations')).filter(f => f.endsWith('.sql')).sort()) await db.exec(fs.readFileSync(path.join(dir, 'migrations', m), 'utf8'));
await db.exec(fs.readFileSync(path.join(dir, 'seed.sql'), 'utf8'));
console.log('migration + seed applied');

// ---- users (sign-up trigger creates PENDING profiles), then activation by service role
const mkUser = async (email, meta = {}) => (await db.query('insert into auth.users(email, raw_user_meta_data) values ($1, $2) returning id', [email, meta])).rows[0].id;
const U = {
  dits: await mkUser('principal@dits-delhi.edu.in'),
  bce: await mkUser('director@bce-bangalore.edu.in'),
  rev: await mkUser('reviewer.mehta@aicte-india.org'),
  adm: await mkUser('admin.verma@aicte-india.org'),
  bank: await mkUser('fdr.officer@sbi.co.in'),
  pending: await mkUser('new@college.edu.in', { registration: { name: 'New College', head: 'Dr. New', mobile: '9000000000' } }),
};
await db.exec(`
  select public.admin_link_user('principal@dits-delhi.edu.in', '1-10928371');
  select public.admin_link_user('director@bce-bangalore.edu.in', '1-14829104');
  select public.admin_link_user('reviewer.mehta@aicte-india.org', null, 'REVIEWER');
  select public.admin_link_user('admin.verma@aicte-india.org', null, 'ADMIN');
  select public.admin_link_user('fdr.officer@sbi.co.in', null, 'BANK_OFFICIAL');
  update public.profiles set full_name = 'Dr. Rajesh Sharma', designation = 'Principal & Director' where email = 'principal@dits-delhi.edu.in';
  update public.profiles set full_name = 'Dr. Sunil K. Mehta', designation = 'Scrutiny Officer' where email like 'reviewer%';
  update public.profiles set full_name = 'Shri R. C. Verma', designation = 'Advisor' where email like 'admin%';
  update public.profiles set full_name = 'Shri Amitesh Kumar', bank_name = 'State Bank of India' where email like 'fdr.officer%';
`);

// Run as an authenticated user (RLS applies), or as service (postgres).
const as = async (user, sql, params = []) => {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user || '']);
  if (user) await db.exec('set role authenticated');
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
};
const err = async (user, sql, params = []) => { try { await as(user, sql, params); return null; } catch (e) { return e.message; } };
const rpc = async (user, sql, params = []) => (await as(user, sql, params)).rows[0];
const putObject = async (inst, name) => { const p = `${inst}/${crypto.randomUUID()}/${name}`; await db.query(`insert into storage.objects(bucket_id, name) values ('institution-documents', $1)`, [p]); return p; };
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

console.log('\nAuthentication & roles');
const st = (await rpc(U.dits, 'select public.get_portal_state() s')).s;
ok(st.institution.pid === '1-10928371' && st.apps.length === 2 && st.fdrs.length === 3, `DITS state: ${st.apps.length} apps, ${st.fdrs.length} FDRs, ${st.notifs.length} notifications`);
ok(st.apps.every(a => a.institutionId === st.institution.id), 'state only contains own institution');
ok(/ACCOUNT_PENDING/.test(await err(U.pending, 'select public.get_portal_state()')), 'unverified registration is refused (ACCOUNT_PENDING)');
ok((await db.query(`select count(*)::int c from public.registration_requests where user_id = $1`, [U.pending])).rows[0].c === 1, 'sign-up creates a registration request');
ok(/ROLE_MISMATCH/.test(await err(U.rev, 'select public.get_portal_state()')), 'reviewer cannot use the institution portal (ROLE_MISMATCH)');
await db.exec('set role anon');
try { await db.query('select public.get_portal_state()'); ok(false, 'anonymous call rejected'); } catch (e) { ok(/permission denied/.test(e.message), 'anonymous (anon key) call rejected'); } finally { await db.exec('reset role'); }

console.log('\nRow-level security / institution isolation');
ok((await as(U.dits, 'select count(*)::int c from public.applications')).rows[0].c === 2, 'DITS sees only its 2 applications');
ok((await as(U.bce, 'select count(*)::int c from public.fdrs')).rows[0].c === 1, 'BCE sees only its own FDR');
ok((await as(U.dits, `select count(*)::int c from public.applications where application_number = 'APP-2026-INTAKE-4491'`)).rows[0].c === 0, 'DITS cannot read BCE application by number');
ok(/permission denied/.test(await err(U.dits, `update public.applications set status = 'APPROVED'`)), 'direct UPDATE of status is denied');
ok(/permission denied/.test(await err(U.dits, `insert into public.notifications(institution_id, title, message, type) values ($1, 'x', 'y', 'INFO')`, [st.institution.id])), 'direct INSERT is denied');
ok((await as(U.rev, 'select count(*)::int c from public.applications')).rows[0].c === 4, 'reviewer (staff) sees all applications');
ok((await as(U.dits, 'select count(*)::int c from public.review_notes')).rows[0].c === 0, 'institution cannot read staff notes');

console.log('\nSubmission: validation, findings, idempotency');
const inst = st.institution.id;
const docs = [];
for (const t of ['LAND_TITLE', 'BUILDING_NOC', 'FIRE_SAFETY', 'FDR_CORPUS', 'AFFILIATION', 'STATE_NOC', 'FACULTY_CADRE']) {
  docs.push({ docType: t, fileName: t + '.pdf', fileSizeBytes: 2048, mimeType: 'application/pdf', fileHash: sha('dits-' + t), pageCount: 2,
    storagePath: await putObject(inst, t + '.pdf'), validTill: ['BUILDING_NOC', 'FIRE_SAFETY', 'AFFILIATION'].includes(t) ? '2029-06-30' : '' });
}
const ditsFdr = st.fdrs.find(f => f.fdrNumber === 'SBI-FDR-99201-2024');
const base = { type: 'NEW_PROGRAMME', inst: { academicYear: '2026-27', address: 'Alipur, Delhi' },
  prog: { programme: 'M.Tech CPS', programmeIntake: '30', currentTotalIntake: '600', proposedTotalIntake: '630', totalStudents: '2400', professors: '14', associateProfessors: '28', assistantProfessors: '82', totalBuiltUpAreaSqM: '19850' },
  fdr: { mode: 'existing', existingId: ditsFdr.id }, docs, declared: true, esign: { method: 'AADHAAR', ref: 'ESIGN-TEST' } };

const bad = await err(U.dits, 'select public.submit_application($1, $2)', [{ ...base, prog: { ...base.prog, programme: '', professors: '' }, esign: null }, crypto.randomUUID()]);
ok(/VALIDATION/.test(bad), 'missing fields rejected with VALIDATION');
const dry = (await rpc(U.dits, 'select public.submit_application($1, null, true) r', [base])).r;
ok(dry.findings.length === 6 && dry.findings.every(f => f.severity === 'PASSED'), `dry-run evaluates 6 server rules: ${dry.findings.map(f => f.ruleCode.split('-')[1] + ':' + f.severity).join(' ')}`);

const key = crypto.randomUUID();
const r1 = (await rpc(U.dits, 'select public.submit_application($1, $2) r', [base, key])).r;
const r2 = (await rpc(U.dits, 'select public.submit_application($1, $2) r', [base, key])).r;
ok(/^APP-\d{4}-NEW-\d{5}$/.test(r1.applicationNumber) && r1.status === 'SUBMITTED', `submitted ${r1.applicationNumber}`);
ok(r2.replayed && r2.applicationId === r1.applicationId, 'retry with same idempotency key returns the same application (no duplicate)');
ok((await as(U.dits, 'select count(*)::int c from public.applications')).rows[0].c === 3, 'exactly one new application persisted');
ok((await as(U.dits, 'select count(*)::int c from public.application_documents where application_id = $1', [r1.applicationId])).rows[0].c === 7, '7 documents linked to the application');
ok(/BCE|FORBIDDEN/.test(await err(U.bce, 'select public.submit_application($1, $2)', [base, key])) , 'another institution cannot replay a foreign idempotency key');

const noObj = await err(U.dits, 'select public.submit_application($1, $2)', [{ ...base, docs: [{ ...docs[0], storagePath: `${inst}/missing/x.pdf` }] }, crypto.randomUUID()]);
ok(/VALIDATION/.test(noObj), 'document not present in storage is rejected');
const foreignPath = await err(U.dits, 'select public.submit_application($1, $2)', [{ ...base, docs: [{ ...docs[0], storagePath: `${st.institution.id}x/a.pdf` }] }, crypto.randomUUID()]);
ok(/VALIDATION/.test(foreignPath), 'document outside own storage folder is rejected');

// BCE re-uses DITS land deed (same SHA-256) — only the server can see the other institution's filing.
const bceState = (await rpc(U.bce, 'select public.get_portal_state() s')).s;
const bceDocs = [{ ...docs[0], storagePath: await putObject(bceState.institution.id, 'deed.pdf') }];
const bceDry = (await rpc(U.bce, 'select public.submit_application($1, null, true) r', [{ ...base, fdr: { mode: 'existing', existingId: bceState.fdrs[0].id }, docs: bceDocs }])).r;
const dup = bceDry.findings.find(f => f.ruleCode === 'RULE-DUPLICATE-HASH-04');
ok(dup.severity === 'CRITICAL' && /Delhi Institute/.test(dup.description), 'cross-institution duplicate deed detected server-side (CRITICAL)');
ok(bceDry.findings.find(f => f.ruleCode === 'RULE-CHECKLIST-01').severity === 'CRITICAL', 'missing mandatory documents flagged CRITICAL');

const lowFdr = (await rpc(U.dits, 'select public.submit_application($1, null, true) r', [{ ...base, fdr: { mode: 'new', fdrNumber: 'HDFC-FDR-11111-2026', bankName: 'HDFC Bank Ltd', branchName: 'CP', ifscCode: 'HDFC0000043', amount: 5000000, issueDate: '2026-10-01', maturityDate: '2030-10-01' } }])).r;
ok(lowFdr.findings.find(f => f.ruleCode === 'RULE-FDR-CORPUS-07').severity === 'CRITICAL', 'under-funded, short-tenure new FDR flagged CRITICAL');

console.log('\nWorkflow & status transitions');
ok(/FORBIDDEN/.test(await err(U.dits, `select public.review_record_decision($1, 'APPROVED', 'self approval attempt')`, [r1.applicationId])), 'institution cannot approve its own application');
ok(/INVALID_TRANSITION/.test(await err(U.rev, `select public.review_record_decision($1, 'APPROVED', 'skipping scrutiny is not allowed')`, [r1.applicationId])), 'reviewer cannot jump SUBMITTED → APPROVED');
await rpc(U.rev, 'select public.review_start($1)', [r1.applicationId]);
const notice = (await rpc(U.rev, `select public.review_request_clarification($1, array['Upload Fire NOC renewal receipt'], 'Fire NOC renewal evidence pending') n`, [r1.applicationId])).n;
ok(/^AICTE\/NORO\/DEF\/\d{4}\/\d{4}$/.test(notice), `deficiency notice ${notice} issued`);
let s2 = (await rpc(U.dits, 'select public.get_portal_state() s')).s;
let app = s2.apps.find(a => a.id === r1.applicationId);
ok(app.status === 'DEFICIENCIES_NOTED' && app.scrutinyRecommendation.deficiencyPoints.length === 1, 'institution sees DEFICIENCIES_NOTED with the query');
ok(s2.notifs.some(n => n.type === 'CRITICAL' && n.link.id === r1.applicationId), 'institution notified with link to the application');
ok(/VALIDATION/.test(await err(U.dits, 'select public.submit_compliance_response($1, $2, $3)', [r1.applicationId, [{ point: 'x', response: '' }], []])), 'empty compliance response rejected');
const evidence = { fileName: 'renewal.pdf', fileSizeBytes: 999, mimeType: 'application/pdf', fileHash: sha('renewal'), storagePath: await putObject(inst, 'renewal.pdf') };
const resp = (await rpc(U.dits, 'select public.submit_compliance_response($1, $2, $3) r', [r1.applicationId, [{ point: 'Upload Fire NOC renewal receipt', response: 'DFS renewal receipt attached.' }], [evidence]])).r;
ok(resp.version === 2, 'compliance response creates version 2');
ok(/INVALID_STATE/.test(await err(U.dits, 'select public.submit_compliance_response($1, $2, $3)', [r1.applicationId, [{ point: 'p', response: 'again please' }], []])), 'duplicate response blocked while under review');
await rpc(U.rev, `select public.review_record_decision($1, 'SCRUTINY_CLEARED', 'All deficiencies resolved')`, [r1.applicationId]);
ok(/INVALID_TRANSITION/.test(await err(U.rev, `select public.review_record_decision($1, 'APPROVED', 'reviewer final approval')`, [r1.applicationId])), 'only ADMIN can give the final approval');
await rpc(U.adm, `select public.review_record_decision($1, 'APPROVED', 'Approved by Regulation Bureau')`, [r1.applicationId]);
s2 = (await rpc(U.dits, 'select public.get_portal_state() s')).s;
app = s2.apps.find(a => a.id === r1.applicationId);
ok(app.status === 'APPROVED' && app.history.map(h => h.to).join('>') === 'SUBMITTED>UNDER_SCRUTINY>DEFICIENCIES_NOTED>UNDER_SCRUTINY>SCRUTINY_CLEARED>APPROVED', `history: ${app.history.map(h => h.to).join(' > ')}`);

console.log('\nFDR lifecycle');
const expiring = s2.fdrs.find(f => f.fdrNumber === 'SBI-FDR-41207-2016');
const matured = s2.fdrs.find(f => f.fdrNumber === 'PNB-FDR-30115-2016');
ok(/VALIDATION/.test(await err(U.dits, `select public.request_fdr_renewal($1, '{"mode":"extension","maturityDate":"2020-01-01"}')`, [expiring.id])), 'renewal with earlier maturity rejected');
const ren = (await rpc(U.dits, `select public.request_fdr_renewal($1, '{"mode":"extension","maturityDate":"2036-12-29"}') r`, [expiring.id])).r;
ok(!!ren.requestId, 'renewal request created (PENDING)');
ok(/INVALID_STATE/.test(await err(U.dits, `select public.request_fdr_renewal($1, '{"mode":"extension","maturityDate":"2037-12-29"}')`, [expiring.id])), 'second pending request blocked');
ok(/INVALID_STATE/.test(await err(U.dits, `select public.request_lien_release($1, 'Lock-in complete with no liabilities', true)`, [ditsFdr.id])), 'release of a non-matured FDR blocked');
ok(/VALIDATION/.test(await err(U.dits, `select public.request_lien_release($1, 'Lock-in complete with no liabilities', false)`, [matured.id])), 'release requires certification');
await rpc(U.dits, `select public.request_lien_release($1, 'Lock-in complete with no liabilities', true)`, [matured.id]);
ok(/FORBIDDEN/.test(await err(U.dits, 'select public.decide_fdr_request($1, true, $2)', [ren.requestId, 'self'])), 'institution cannot approve its own FDR request');
await rpc(U.adm, 'select public.decide_fdr_request($1, true, $2)', [ren.requestId, 'Renewal receipt verified']);
const newFdr = (await rpc(U.dits, 'select public.submit_fdr($1) r', [{ fdrNumber: 'HDFC-FDR-77777-2026', bankName: 'HDFC Bank Ltd', branchName: 'CP', ifscCode: 'HDFC0000043', amount: 10000000, issueDate: '2026-10-01', maturityDate: '2036-09-30', evidence: { ...evidence, storagePath: await putObject(inst, 'fdr.pdf') } }])).r;
ok(/FORBIDDEN/.test(await err(U.bank, 'select public.bank_endorse_lien($1, $2)', [newFdr.fdrId, 'CBS-HDFC-123456'])), 'SBI official cannot endorse an HDFC deposit');
await rpc(U.bank, 'select public.bank_endorse_lien($1, $2)', [expiring.id, 'CBS-SBI-RENEW-41207']);
s2 = (await rpc(U.dits, 'select public.get_portal_state() s')).s;
ok(s2.fdrs.find(f => f.id === expiring.id).maturityDate === '2036-12-29' && s2.fdrs.find(f => f.id === expiring.id).renewalStatus === 'RENEWED', 'approved renewal extends maturity');
ok(s2.fdrs.find(f => f.id === matured.id).releaseRequest.status === 'PENDING', 'release request pending Bureau approval');
ok(s2.fdrs.find(f => f.id === newFdr.fdrId).isLienConfirmed === false, 'new FDR awaits bank endorsement');

console.log('\nNotifications, tickets, profile, audit');
const unread = s2.notifs.filter(n => !n.isRead).length;
const marked = (await rpc(U.dits, 'select public.mark_notifications_read(null) n')).n;
ok(marked === unread, `mark all read updated ${marked} notification(s)`);
const bceUnreadBefore = (await rpc(U.bce, 'select public.get_portal_state() s')).s.notifs.filter(n => !n.isRead).length;
ok(bceUnreadBefore > 0, 'other institution notifications untouched');
const t = (await rpc(U.dits, `select public.raise_ticket('FDR', null, 'Lien delay', 'Bank has not endorsed for 10 days') r`)).r;
ok(/^TKT-\d{4}-\d{5}$/.test(t.ticketNo), `ticket ${t.ticketNo}`);
ok(/VALIDATION/.test(await err(U.dits, `select public.update_contact_details('{"name":"A","designation":"B","mobile":"123"}')`)), 'invalid mobile rejected');
await rpc(U.dits, `select public.update_institution_profile('{"address":"New Address, Delhi","district":"North Delhi","state":"Delhi","name":"Hacked Name"}')`);
ok((await db.query(`select name from public.institutions where pid = '1-10928371'`)).rows[0].name === 'Delhi Institute of Technology & Science', 'institution name cannot be changed via profile update');
ok(/FORBIDDEN/.test(await err(U.dits, `select public.log_client_event('DECISION_APPROVED', 'x')`)), 'client cannot forge privileged audit events');
const chain = (await db.query(`select id, prev_hash, sha256_hash from public.audit_events where institution_id = $1 order by id`, [inst])).rows;
ok(chain.every((e, k) => k === 0 || e.prev_hash === chain[k - 1].sha256_hash), `audit chain intact across ${chain.length} events`);
await rpc(null, 'select public.generate_expiry_reminders()');
const again = (await rpc(null, 'select public.generate_expiry_reminders() n')).n;
const dupCount = (await db.query(`select count(*)::int c from (select dedupe_key from public.notifications where dedupe_key is not null group by institution_id, dedupe_key having count(*) > 1) x`)).rows[0].c;
ok(again >= 0 && dupCount === 0, 'expiry reminders are deduplicated');

console.log('\nGoogle sign-in (pre-approved emails)');
await rpc(null, `select public.admin_invite_user('Google.Head@Gmail.com', '1-10928371')`);
const g = await mkUser('google.head@gmail.com', { name: 'Google Head', full_name: 'Google Head' });
const gs = (await rpc(g, 'select public.get_portal_state() s')).s;
ok(gs.institution.pid === '1-10928371' && gs.me.name === 'Google Head', 'invited Google account is active on first sign-in, with its Google name');
const late = await mkUser('late.google@gmail.com', { name: 'Late User' });
ok(/ACCOUNT_PENDING/.test(await err(late, 'select public.get_portal_state()')), 'uninvited Google account lands as pending');
await rpc(null, `select public.admin_invite_user('late.google@gmail.com', '1-14829104')`);
ok((await rpc(late, 'select public.get_portal_state() s')).s.institution.pid === '1-14829104', 'inviting an existing account activates it');
ok(!!(await err(U.dits, `select public.admin_invite_user('x@gmail.com', '1-10928371')`)), 'institution users cannot invite');
ok((await as(U.dits, 'select count(*)::int c from public.user_invites')).rows[0].c === 0, 'invite list is hidden from institutions');
ok((await as(U.rev, 'select count(*)::int c from public.user_invites')).rows[0].c === 0, 'invite list is hidden from reviewers');
ok((await as(U.adm, 'select count(*)::int c from public.user_invites')).rows[0].c >= 1, 'admins can read the invite list');
ok(/NOT_FOUND/.test(await err(null, `select public.admin_invite_user('y@gmail.com', '9-99999999')`)), 'unknown PID rejected');

console.log('\nStaff web portal');
const bankFdrs = (await as(U.bank, 'select bank_name from public.fdrs')).rows;
ok(bankFdrs.length > 0 && bankFdrs.every(r => r.bank_name === 'State Bank of India'), `bank official sees only own-bank FDRs (${bankFdrs.length})`);
ok((await as(U.bank, 'select count(*)::int c from public.applications')).rows[0].c === 0, 'bank official cannot read applications');
ok((await as(U.bank, 'select count(*)::int c from public.institutions')).rows[0].c > 0, 'bank official sees institutions behind its FDRs');
ok((await as(U.rev, 'select count(*)::int c from public.registration_requests')).rows[0].c >= 1, 'reviewer can see pending registrations');
ok((await as(U.dits, 'select count(*)::int c from public.registration_requests')).rows[0].c === 0, 'institution cannot see registrations');
const warn = (await db.query(`select id from public.findings where severity = 'WARNING' limit 1`)).rows[0].id;
ok(/FORBIDDEN/.test(await err(U.dits, `select public.review_override_finding($1, 'Institution tries to clear this', 'APH 1.1')`, [warn])), 'institution cannot override a finding');
ok(/VALIDATION/.test(await err(U.rev, `select public.review_override_finding($1, 'short', 'APH 1.1')`, [warn])), 'override needs a reasoned justification');
await rpc(U.rev, `select public.review_override_finding($1, 'Renewal receipt verified offline with DFS', 'APH Clause 3.2')`, [warn]);
const ov = (await db.query('select override from public.findings where id = $1', [warn])).rows[0].override;
ok(ov && ov.citation === 'APH Clause 3.2' && /Mehta/.test(ov.by), 'reviewer override recorded with name and citation');
ok(/already/.test(await err(U.rev, `select public.review_override_finding($1, 'Second override attempt here', 'APH 3.2')`, [warn])), 'a finding can be overridden only once');
ok(/FORBIDDEN/.test(await err(U.rev, `select public.admin_invite_staff('new.rev@aicte-india.org', 'REVIEWER', 'Dr. New Reviewer')`)), 'reviewer cannot invite staff');
ok(/bank name/.test(await err(U.adm, `select public.admin_invite_staff('pnb@pnb.co.in', 'BANK_OFFICIAL', 'PNB Officer')`)), 'bank official invite needs a bank');
await rpc(U.adm, `select public.admin_invite_staff('pnb.officer@pnb.co.in', 'BANK_OFFICIAL', 'Shri PNB Officer', 'Branch Manager', 'Punjab National Bank')`);
const pnb = await mkUser('pnb.officer@pnb.co.in', { name: 'From Google' });
const pnbRows = (await as(pnb, 'select bank_name from public.fdrs')).rows;
ok(pnbRows.length > 0 && pnbRows.every(r => r.bank_name === 'Punjab National Bank'), 'invited bank official is active on first sign-in and sees only PNB FDRs');
ok((await db.query('select full_name from public.profiles where id = $1', [pnb])).rows[0].full_name === 'Shri PNB Officer', 'invite name wins over the Google name');
ok(/FORBIDDEN/.test(await err(U.adm, `select public.admin_set_user_status($1, 'DISABLED')`, [U.adm])), 'admin cannot disable own account');
await rpc(U.adm, `select public.admin_set_user_status($1, 'DISABLED')`, [pnb]);
ok((await as(pnb, 'select count(*)::int c from public.fdrs')).rows[0].c === 0, 'disabled bank official loses access');
ok(/institution/.test(await err(U.adm, `select public.admin_set_user_status($1, 'ACTIVE')`, [U.pending])), 'unlinked institution account cannot be activated');
const regNo = (await db.query('select request_no from public.registration_requests where user_id = $1', [U.pending])).rows[0].request_no;
await rpc(U.adm, `select public.admin_reject_registration($1, 'Not an AICTE-recognised institution')`, [regNo]);
ok((await db.query('select status from public.registration_requests where request_no = $1', [regNo])).rows[0].status === 'REJECTED', 'admin can reject a registration');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
