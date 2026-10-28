// FDR lifecycle and security test-suite: real PostgreSQL 17 (embedded-postgres) + the real Express app over HTTP.
// Covers the daily reminder job (windows, institution, duplicates, restart, lock), who confirmed a joint lien,
// the lien release lifecycle (request -> AICTE decision -> bank discharge), and access control between
// institutions and roles, documents, the audit trail and sessions.
// Usage: npm run test:lifecycle
import crypto from 'node:crypto';
import { startPostgres } from './embedded-pg.mjs';

const db = await startPostgres(54332);
const API_PORT = 8797, API = `http://127.0.0.1:${API_PORT}`;
Object.assign(process.env, {
  DATABASE_URL: db.url, JWT_SECRET: crypto.randomBytes(32).toString('hex'), PUBLIC_URL: API, PORT: String(API_PORT),
  ALLOWED_ORIGINS: 'http://localhost:5180,http://localhost:8765', REQUIRE_EMAIL_CONFIRMATION: 'false', RUN_SCHEDULER: 'false',
});
const { migrate, DEMO_PASSWORD } = await import('../../server/migrate.mjs');
await migrate(db.url, { seed: true, log: () => {} });
const { createApp } = await import('../../server/app.mjs');
const { runReminders, startScheduler, stopScheduler } = await import('../../server/api.mjs');
const { outbox } = await import('../../server/mail.mjs');
const { signJwt } = await import('../../server/tokens.mjs');
const { asService, asUser, pool, query } = await import('../../server/db.mjs');
const server = createApp().listen(API_PORT);

let passed = 0, failed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('  ✓', m); } else { failed++; console.log('  ✗', m); } };
async function call(method, path, { token, body, raw, type } = {}) {
  const r = await fetch(API + path, { method, redirect: 'manual',
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(raw ? { 'content-type': type } : body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: r.status, body: json };
}
const login = async (email, password = DEMO_PASSWORD) => (await call('POST', '/auth/token?grant_type=password', { body: { email, password } })).body;
const rpc = (s, fn, args = {}) => call('POST', `/rpc/${fn}`, { token: s.access_token, body: args });
const code = r => String(r.body && r.body.message || '').split(':')[0];
const sql = (text, params) => query(text, params).then(r => r.rows);
const day = n => new Date(Date.now() + n * 864e5 + 5.5 * 36e5).toISOString().slice(0, 10);   // India date, n days from today

// An extra account: a staff invite (or institution link) first, then the login itself, as migrate.mjs does for the demo accounts.
async function account(email, link) {
  await asService(async c => {
    if (link.role === 'INSTITUTION') {
      await c.query(`insert into auth.users(email, encrypted_password, email_confirmed_at) values ($1, crypt($2, gen_salt('bf', 10)), now())`, [email, DEMO_PASSWORD]);
      await c.query('select public.admin_link_user($1, $2)', [email, link.pid]);
    } else {
      await c.query('select public.admin_invite_staff($1, $2, $3, $4, $5)', [email, link.role, link.name, 'Officer', link.bank || null]);
      await c.query(`insert into auth.users(email, encrypted_password, email_confirmed_at) values ($1, crypt($2, gen_salt('bf', 10)), now())`, [email, DEMO_PASSWORD]);
    }
  });
  return login(email);
}
async function addFdr(inst, number, maturity, { bank = 'State Bank of India', confirmed = true, released = false } = {}) {
  const [f] = await sql(`insert into public.fdrs(institution_id, fdr_number, amount, bank_name, branch_name, ifsc_code, issue_date, maturity_date, joint_lien_holder,
      is_lien_confirmed, lien_endorsement_token, released) values ($1, $2, 10000000, $3, 'Test Branch', $4, ($5::date - interval '10 years')::date, $5, 'Regional Officer, AICTE', $6, $7, $8)
    returning id`, [inst, number, bank, bank === 'State Bank of India' ? 'SBIN0001234' : 'PUNB0301100', maturity, confirmed, confirmed ? `CBS-${number}` : null, released]);
  return f.id;
}

try {
  const instA = await login('sih_demo.institution@example.com'), officer = await login('sih_demo.officer@example.com');
  const admin = await login('sih_demo.admin@example.com'), bank = await login('sih_demo.bank@example.com');
  const instB = await account('principal.bce@example.com', { role: 'INSTITUTION', pid: '1-14829104' });
  const pnb = await account('manager.pnb@example.com', { role: 'BANK_OFFICIAL', name: 'PNB Manager', bank: 'Punjab National Bank' });
  const [{ id: A }] = await sql(`select id from public.institutions where pid = '1-10928371'`);
  const [{ id: B }] = await sql(`select id from public.institutions where pid = '1-14829104'`);
  ok(instA.access_token && instB.access_token && pnb.access_token, 'two institutions and two banks signed in');

  console.log('\nTask 1: daily maturity reminders');
  const due = { d170: await addFdr(A, 'SBI-FDR-T170-2016', day(170)), d50: await addFdr(A, 'SBI-FDR-T050-2016', day(50)), d20: await addFdr(A, 'SBI-FDR-T020-2016', day(20)),
    matured: await addFdr(A, 'SBI-FDR-TM05-2016', day(-5)) };
  const quiet = [await addFdr(A, 'SBI-FDR-T400-2016', day(400)), await addFdr(A, 'SBI-FDR-TREL-2016', day(-30), { released: true })];
  const dueB = await addFdr(B, 'SBI-FDR-B020-2016', day(20));
  const r1 = await runReminders({ force: true });
  ok(r1.ran && r1.created >= 5, `job ran: ${r1.checked} FDR(s) in a reminder window, ${r1.created} new notification(s), ${r1.emailed} email(s)`);
  const notes = await sql(`select institution_id, title, type, link->>'id' as fdr from public.notifications where dedupe_key like 'fdr-expiry-%'`);
  const of = id => notes.filter(n => n.fdr === id);
  ok(of(due.d170).length === 1 && of(due.d170)[0].type === 'WARNING' && /Upcoming FDR Expiry/.test(of(due.d170)[0].title), '180-day window: one WARNING reminder');
  ok(of(due.d50).length === 1 && of(due.d50)[0].type === 'CRITICAL', '60-day window: one CRITICAL reminder');
  ok(of(due.d20).length === 1 && of(due.d20)[0].type === 'CRITICAL', '30-day window: one CRITICAL reminder');
  ok(of(due.matured).length === 1 && /matured/.test(of(due.matured)[0].title), 'matured FDR: "eligible for lien release" reminder');
  ok(quiet.every(id => !of(id).length), 'no reminder for an FDR beyond 180 days or already released');
  ok(Object.values(due).every(id => of(id)[0].institution_id === A) && of(dueB).length === 1 && of(dueB)[0].institution_id === B, 'each reminder goes to the FDR\'s own institution');
  const stA = (await rpc(instA, 'get_portal_state')).body, stB = (await rpc(instB, 'get_portal_state')).body;
  ok(stA.notifs.some(n => n.link && n.link.id === due.d20) && !stA.notifs.some(n => n.link && n.link.id === dueB), 'institution A sees its reminders in the app, not B\'s');
  ok(stB.notifs.some(n => n.link && n.link.id === dueB) && !stB.notifs.some(n => n.link && n.link.id === due.d20), 'institution B sees only its own reminder');
  ok(outbox.some(m => m.to === 'sih_demo.institution@example.com' && /Upcoming FDR Expiry/.test(m.subject)) && outbox.some(m => m.to === 'principal.bce@example.com'),
    'reminders are emailed to each institution\'s own accounts');
  const mails = outbox.length;
  const r2 = await runReminders({ force: true });
  ok(r2.ran && r2.created === 0 && r2.emailed === 0 && outbox.length === mails, 'running again the same day creates no duplicate notifications or emails');
  ok((await runReminders()).ran === false, 'scheduled call after today\'s run does nothing (once per India date)');
  const holder = await pool.connect();
  await holder.query(`select pg_advisory_lock(hashtext('job:fdr-expiry-reminders'))`);
  const locked = await runReminders({ force: true });
  await holder.query(`select pg_advisory_unlock(hashtext('job:fdr-expiry-reminders'))`); holder.release();
  ok(locked.ran === false && /Another server/.test(locked.reason), 'a second server instance skips the job while another holds the lock');
  // Restart: today's runs forgotten, then a fresh start-up (as after a deploy or a sleeping free instance waking up).
  await sql(`delete from public.job_runs`);
  const afterSeven = new Date(Date.now() + 5.5 * 36e5).getUTCHours() >= 7;
  startScheduler(60 * 60_000); await new Promise(r => setTimeout(r, 1500)); stopScheduler();
  const runs = await sql(`select trigger, created from public.job_runs where job = 'fdr-expiry-reminders' and error is null`);
  ok(afterSeven ? runs.length === 1 && runs[0].trigger === 'SCHEDULE' && runs[0].created === 0 : runs.length === 0,
    afterSeven ? 'after a restart the job catches up at start-up (no duplicates created)' : 'after a restart before 07:00 IST the job waits for 07:00');
  const status = await rpc(admin, 'reminder_job_status');
  ok(status.status === 200 && Array.isArray(status.body.recent) && status.body.ranToday === afterSeven, `admin sees the job status (ran today: ${status.body.ranToday})`);
  ok((await rpc(admin, 'run_daily_reminders')).body.ran === true, 'admin can run the job now ("Run now")');
  ok(code(await rpc(officer, 'run_daily_reminders')) === 'FORBIDDEN' && code(await rpc(instA, 'reminder_job_status')) === 'FORBIDDEN', 'officers and institutions cannot run or read the job');

  console.log('\nTask 2: who confirmed the joint lien');
  const src = st => Object.fromEntries(st.fdrs.map(f => [f.fdrNumber, f.bankConfirmation.source]));
  const seeded = src(stA);
  ok(seeded['PNB-FDR-30115-2016'] === 'DEMO_SIMULATED' && seeded['SBI-FDR-99201-2024'] === 'UNRECORDED', 'seeded demo FDR is "simulated"; an FDR without an endorsement on file is "unrecorded", never "bank confirmed"');
  const subm = await addFdr(A, 'SBI-FDR-NEW1-2026', day(3650), { confirmed: false }), subm2 = await addFdr(A, 'SBI-FDR-NEW2-2026', day(3650), { confirmed: false });
  ok(src((await rpc(instA, 'get_portal_state')).body)['SBI-FDR-NEW1-2026'] === 'PENDING', 'submitted FDR: bank confirmation pending');
  ok(code(await rpc(pnb, 'bank_endorse_lien', { p_fdr_id: subm, p_token: 'CBS-PNB-123456' })) === 'FORBIDDEN', 'another bank cannot confirm the lien');
  ok(code(await rpc(instA, 'bank_endorse_lien', { p_fdr_id: subm, p_token: 'CBS-SELF-123456' })) === 'FORBIDDEN', 'the institution cannot confirm its own lien');
  ok((await rpc(bank, 'bank_endorse_lien', { p_fdr_id: subm, p_token: 'CBS-SBI-777001' })).status === 200, 'SBI official confirms the lien');
  ok((await rpc(admin, 'bank_endorse_lien', { p_fdr_id: subm2, p_token: 'CBS-SBI-777002' })).status === 200, 'AICTE admin records a lien from a bank token');
  const conf = Object.fromEntries((await rpc(instA, 'get_portal_state')).body.fdrs.map(f => [f.fdrNumber, f.bankConfirmation]));
  ok(conf['SBI-FDR-NEW1-2026'].source === 'BANK_OFFICIAL' && /Demo Bank Official \(State Bank of India\)/.test(conf['SBI-FDR-NEW1-2026'].by), 'bank official\'s confirmation: BANK_OFFICIAL, with name and bank');
  ok(conf['SBI-FDR-NEW2-2026'].source === 'AICTE_RECORDED', 'admin entry: AICTE_RECORDED, not shown as bank confirmed');
  const staffRow = (await call('GET', '/data/fdrs', { token: officer.access_token })).body.find(f => f.fdr_number === 'SBI-FDR-NEW2-2026');
  ok(staffRow.lien_confirmation_source === 'AICTE_RECORDED', 'staff portal receives the confirmation source');

  console.log('\nTask 3: lien release lifecycle');
  const rel = due.matured;
  ok(code(await rpc(instB, 'request_lien_release', { p_fdr_id: rel, p_reason: 'Lock-in completed, no liabilities.', p_certified: true })) === 'NOT_FOUND', 'another institution cannot request release of this FDR');
  const req = await rpc(instA, 'request_lien_release', { p_fdr_id: rel, p_reason: 'Completion of mandatory 10-year lock-in period.', p_certified: true });
  ok(req.status === 200 && req.body.requestId, 'institution submits a release request');
  const rid = req.body.requestId, approve = { p_request_id: rid, p_approve: true, p_note: 'Lock-in completed with no outstanding liabilities.', p_evidence: { orderNumber: 'AICTE/NRO/LR/2026/014' } };
  for (const [who, s] of [['scrutiny officer', officer], ['bank official', bank], ['institution', instA]]) ok(code(await rpc(s, 'decide_fdr_request', approve)) === 'FORBIDDEN', `${who} cannot approve the release`);
  ok(code(await rpc(admin, 'decide_fdr_request', { ...approve, p_note: 'ok' })) === 'VALIDATION', 'approval without a reasoned note is refused');
  ok(code(await rpc(admin, 'decide_fdr_request', { ...approve, p_evidence: null })) === 'VALIDATION', 'release approval without the AICTE release order number is refused');
  ok(code(await rpc(bank, 'bank_discharge_lien', { p_fdr_id: rel, p_reference: 'CBS-DIS-000001' })) === 'INVALID_STATE', 'bank cannot discharge before AICTE approves');
  ok((await rpc(admin, 'decide_fdr_request', approve)).status === 200, 'administrator approves with note and release order');
  const [row] = await sql(`select f.released, f.released_at, f.release_request_id, r.status, r.decided_by_name, r.decided_at, r.decision_note, r.decision_evidence
    from public.fdrs f join public.fdr_requests r on r.id = f.release_request_id where f.id = $1`, [rel]);
  ok(row && row.released && row.released_at && row.status === 'APPROVED' && row.decided_by_name && row.decided_at && row.decision_evidence.orderNumber === 'AICTE/NRO/LR/2026/014',
    'decision recorded: status, decided by, timestamp, note and release order');
  ok(code(await rpc(admin, 'decide_fdr_request', approve)) === 'NOT_FOUND', 'a decided request cannot be decided again');
  let rr = (await rpc(instA, 'get_portal_state')).body.fdrs.find(f => f.id === rel).release;
  ok(rr && rr.orderNumber === 'AICTE/NRO/LR/2026/014' && rr.approvedBy && !rr.dischargedAt, 'institution app: release approved, bank discharge pending');
  ok(code(await rpc(pnb, 'bank_discharge_lien', { p_fdr_id: rel, p_reference: 'CBS-DIS-000001' })) === 'FORBIDDEN', 'another bank cannot discharge the lien');
  ok(code(await rpc(admin, 'bank_discharge_lien', { p_fdr_id: rel, p_reference: 'CBS-DIS-000001' })) === 'FORBIDDEN', 'AICTE admin cannot record the bank\'s discharge');
  ok((await rpc(bank, 'bank_discharge_lien', { p_fdr_id: rel, p_reference: 'CBS-SBI-DIS-55021' })).status === 200, 'the FDR\'s bank records the lien discharge');
  ok(code(await rpc(bank, 'bank_discharge_lien', { p_fdr_id: rel, p_reference: 'CBS-SBI-DIS-55022' })) === 'INVALID_STATE', 'discharge is recorded once');
  rr = (await rpc(instA, 'get_portal_state')).body.fdrs.find(f => f.id === rel).release;
  ok(rr.dischargedAt && rr.dischargeRef === 'CBS-SBI-DIS-55021' && /State Bank of India/.test(rr.dischargedBy), 'institution app: lien discharged, with bank reference');
  const trail = (await sql(`select action, actor_role, details from public.audit_events where target_id = 'SBI-FDR-TM05-2016' order by id`)).map(a => a.action);
  ok(['FDR_LIEN_RELEASE_REQUESTED', 'FDR_RELEASE_APPROVED', 'FDR_LIEN_DISCHARGED'].every(a => trail.includes(a)), `audit trail: ${trail.join(' → ')}`);
  const rej = await rpc(instA, 'request_lien_release', { p_fdr_id: (await sql(`select id from public.fdrs where fdr_number = 'PNB-FDR-30115-2016'`))[0].id, p_reason: 'Completion of mandatory lock-in period.', p_certified: true });
  ok((await rpc(admin, 'decide_fdr_request', { p_request_id: rej.body.requestId, p_approve: false, p_note: 'Pending student fee refund complaint.' })).status === 200
    && !(await sql(`select released from public.fdrs where fdr_number = 'PNB-FDR-30115-2016'`))[0].released, 'a rejected release keeps the lien in place');

  console.log('\nTask 5: access control, documents, audit trail, sessions');
  const fdrsB = (await call('GET', '/data/fdrs', { token: instB.access_token })).body;
  ok(fdrsB.length > 0 && fdrsB.every(f => f.institution_id === B), `institution B reads only its own FDRs (${fdrsB.length})`);
  ok((await call('GET', '/data/applications', { token: instB.access_token })).body.every(a => a.institution_id === B), 'institution B reads only its own applications');
  ok((await call('GET', '/data/audit_events', { token: instB.access_token })).body.every(a => a.institution_id === B), 'institution B reads only its own audit events');
  ok((await rpc(instB, 'get_portal_state')).body.fdrs.every(f => f.institutionId === B), 'portal state holds only its own FDRs');
  ok(code(await rpc(instB, 'request_fdr_renewal', { p_fdr_id: due.d20, p: { maturityDate: day(3700) } })) === 'NOT_FOUND', "institution B cannot file a renewal on A's FDR");
  const pdf = '%PDF-1.4\n% private\n%%EOF\n', docA = `${A}/${crypto.randomUUID()}/advice.pdf`;
  ok((await call('POST', `/storage/object/institution-documents/${docA}`, { token: instA.access_token, raw: pdf, type: 'application/pdf' })).status === 200, 'institution A uploads a document');
  ok((await call('POST', `/storage/sign/institution-documents/${docA}`, { token: instB.access_token, body: {} })).status === 404, "institution B cannot get a link to A's document");
  ok((await call('POST', `/storage/sign/institution-documents/${docA}`, { body: {} })).status === 401, 'no link without signing in');
  ok((await call('POST', `/storage/sign/institution-documents/${docA}`, { token: bank.access_token, body: {} })).status === 404, 'bank officials cannot open institution documents');
  for (const p of [`/storage/object/institution-documents/${docA}`, `/storage/object/public/institution-documents/${docA}`, `/storage/v1/object/public/institution-documents/${docA}`])
    ok([401, 404].includes((await fetch(API + p)).status), `no public address serves the document (${p.split('/').slice(0, 4).join('/')}/…)`);
  const link = (await call('POST', `/storage/sign/institution-documents/${docA}`, { token: instA.access_token, body: { expiresIn: 10 } })).body.signedUrl;
  ok((await fetch(link)).status === 200, 'owner\'s signed link works');
  ok((await fetch(link.replace(/exp=\d+/, `exp=${Math.floor(Date.now() / 1000) - 5}`))).status === 400, 'a signed link stops working after it expires (exp cannot be changed)');
  ok(code(await rpc(bank, 'review_start', { p_application_id: (await sql(`select id from public.applications limit 1`))[0].id })) === 'FORBIDDEN', 'bank official cannot review applications');
  // Audit trail: append-only for every client, and each institution's chain of hashes is intact.
  const [{ id: uidA }] = await sql(`select id from auth.users where email = 'sih_demo.institution@example.com'`);
  let tamper = null; try { await asUser(uidA, c => c.query(`update public.audit_events set details = 'x'`)); } catch (e) { tamper = e.code; }
  let erase = null; try { await asUser(uidA, c => c.query(`delete from public.audit_events`)); } catch (e) { erase = e.code; }
  ok(tamper === '42501' && erase === '42501', 'audit events cannot be changed or deleted by a signed-in user');
  const chain = await sql(`select id, prev_hash, sha256_hash, encode(sha256(convert_to(concat_ws('|', prev_hash, action, target_type, target_id, details, actor_id::text, created_at::text), 'UTF8')), 'hex') as recomputed,
      lag(sha256_hash) over (order by id) as previous from public.audit_events where institution_id = $1 order by id`, [A]);
  ok(chain.length > 5 && chain.every(e => e.recomputed === e.sha256_hash) && chain.slice(1).every(e => e.prev_hash === e.previous), `institution A's audit hash chain verifies (${chain.length} events)`);
  // Sessions.
  const [{ id: uidB }] = await sql(`select id from auth.users where email = 'principal.bce@example.com'`);
  const [{ id: sid }] = await sql(`select id from auth.sessions where user_id = $1 and revoked_at is null order by created_at desc limit 1`, [uidB]);
  const stale = signJwt({ sub: uidB, sid, email: 'principal.bce@example.com', exp: Math.floor(Date.now() / 1000) - 1 }, process.env.JWT_SECRET);
  const exp = await call('POST', '/rpc/get_portal_state', { token: stale, body: {} });
  ok(exp.status === 401 && exp.body.code === 'SESSION_EXPIRED', 'expired access token refused (client refreshes or signs out)');
  const s2 = await login('principal.bce@example.com');
  await sql(`update auth.sessions set expires_at = now() - interval '1 second' where id <> $1 and user_id = $2`, [sid, uidB]);
  ok((await rpc(s2, 'get_portal_state')).status === 401 && (await call('POST', '/auth/token?grant_type=refresh_token', { body: { refresh_token: s2.refresh_token } })).status === 401,
    'an expired session ends: access and refresh tokens both refused');
  const s3 = await login('principal.bce@example.com'), s4 = await login('principal.bce@example.com');
  ok((await call('PUT', '/auth/user', { token: s3.access_token, body: { password: 'Changed@2026x' } })).status === 200, 'password changed in one session');
  ok((await rpc(s4, 'get_portal_state')).status === 401 && (await rpc(s3, 'get_portal_state')).status === 200, 'changing the password signs out the other sessions, keeps this one');
  ok((await login('principal.bce@example.com')).message === 'Invalid login credentials' && (await login('principal.bce@example.com', 'Changed@2026x')).access_token, 'old password refused, new password works');
  await call('POST', '/auth/logout', { token: s3.access_token });
  ok((await rpc(s3, 'get_portal_state')).status === 401 && (await call('POST', '/auth/token?grant_type=refresh_token', { body: { refresh_token: s3.refresh_token } })).status === 401,
    'logout ends the session: access and refresh tokens refused');
  const [{ id: pnbId }] = await sql(`select id from public.profiles where email = 'manager.pnb@example.com'`);
  ok((await rpc(admin, 'admin_set_user_status', { p_user_id: pnbId, p_status: 'DISABLED' })).status === 200, 'administrator disables an account');
  ok(code(await rpc(pnb, 'bank_endorse_lien', { p_fdr_id: subm2, p_token: 'CBS-PNB-999999' })) === 'FORBIDDEN', 'a disabled account can no longer act');
} catch (e) {
  failed++; console.error(e);
} finally {
  stopScheduler(); server.close(); await pool.end(); await db.stop();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
