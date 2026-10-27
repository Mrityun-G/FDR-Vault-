// Regulatory Assistant test-suite: real PostgreSQL 17 + the Express app over HTTP, with a fake document reader.
// Scenarios: A new FDR end to end, B missing document, C conflicting documents, D unverified requirement,
// E access by another institution, F no submission channel, plus renewal, compliance reply and no-AI fallback.
// Usage: npm run test:assistant
import crypto from 'node:crypto';
import { startPostgres } from './embedded-pg.mjs';
import { makePdf, adviceLines } from './make-pdf.mjs';

const db = await startPostgres(54335);
const API_PORT = 8794, API = `http://127.0.0.1:${API_PORT}`;
Object.assign(process.env, { DATABASE_URL: db.url, JWT_SECRET: crypto.randomBytes(32).toString('hex'), PUBLIC_URL: API, PORT: String(API_PORT), RUN_SCHEDULER: 'false', ALLOWED_ORIGINS: 'http://localhost' });
const { migrate } = await import('../../server/migrate.mjs');
await migrate(db.url, { seed: true, log: () => {} });
const { createApp } = await import('../../server/app.mjs');
const { aiOverride } = await import('../../server/api.mjs');
const { Rules } = await import('../../server/assistant.mjs');
const { pool, asService } = await import('../../server/db.mjs');
const server = createApp().listen(API_PORT);

let passed = 0, failed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('  ✓', m); } else { failed++; console.log('  ✗', m); } };
async function call(method, path, { token, body, raw, type } = {}) {
  const r = await fetch(API + path, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': raw ? type : 'application/json' },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: r.status, body: json };
}
const login = async email => (await call('POST', '/auth/token?grant_type=password', { body: { email, password: 'Sih@2026Demo' } })).body.access_token;
const today = (await pool.query('select current_date::text d')).rows[0].d;
const plusYears = n => `${Number(today.slice(0, 4)) + n}${today.slice(4)}`;

// A second institution account (BCE Bangalore) for isolation and the compliance reply.
await asService(async c => {
  await c.query(`insert into auth.users(email, encrypted_password, email_confirmed_at) values ('bce.test@example.com', crypt('Sih@2026Demo', gen_salt('bf', 4)), now())`);
  await c.query(`select public.admin_link_user('bce.test@example.com', '1-14829104')`);
});
const dits = await login('sih_demo.institution@example.com'), bce = await login('bce.test@example.com'), admin = await login('sih_demo.admin@example.com');
const ditsId = (await pool.query(`select id from public.institutions where pid = '1-10928371'`)).rows[0].id;
const bceId = (await pool.query(`select id from public.institutions where pid = '1-14829104'`)).rows[0].id;

// Fake reader: returns whatever the test queued for the next document.
let reading = null;
const extraction = o => ({ documentKind: 'Fixed deposit advice', matchesExpectedType: true, legibility: 'clear', institutionNameInDocument: 'Delhi Institute of Technology & Science',
  issuingAuthority: 'State Bank of India', referenceNumber: '', issueDate: '', validTill: '', amountInr: '', fdrNumber: '', bankName: 'State Bank of India', lienHolder: '',
  maturityDate: '', facultyProfessors: '', facultyAssociate: '', facultyAssistant: '', keyFields: [], anomalies: [], summary: 'Deposit advice.', confidence: 0.92, ...o });
const fake = () => ({ beta: { messages: { create: async () => ({ model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_details: null, content: [{ type: 'text', text: JSON.stringify(reading) }] }) } } });

async function upload(token, inst, name, bytes = `%PDF-1.4 ${name} ${Math.random()}`) {
  const path = `${inst}/${crypto.randomUUID()}/${name}`, buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const r = await call('POST', `/storage/object/institution-documents/${path}`, { token, raw: buf, type: 'application/pdf' });
  if (r.status !== 200) throw new Error(`upload ${r.status}`);
  return { fileName: name, fileSizeBytes: buf.length, mimeType: 'application/pdf', fileHash: crypto.createHash('sha256').update(buf).digest('hex'), storagePath: path, pageCount: 1 };
}
const start = async (token, workflow) => (await call('POST', '/assistant/sessions', { token, body: workflow ? { workflow } : {} })).body;
const answer = async (token, id, key, value) => (await call('POST', `/assistant/sessions/${id}/answer`, { token, body: { key, value } })).body;
const attach = async (token, id, docKey, file) => call('POST', `/assistant/sessions/${id}/documents`, { token, body: { docKey, file } });
const item = (s, k) => s.checklist.find(i => i.docKey === k);
const field = (s, k) => s.form.find(f => f.key === k);

try {
  console.log('Catalog and rules');
  const cat = (await call('GET', '/assistant/catalog', { token: dits })).body;
  ok(cat.requirements.length === Rules.REQUIREMENTS.length && Rules.REQUIREMENTS.every(r => cat.requirements.some(x => x.workflow === r.workflow && x.docKey === r.docKey && x.applicability === r.applicability && x.sourceId === r.sourceId && x.condition === r.condition)),
    `database catalog matches assistant-rules.js (${cat.requirements.length} requirements)`);
  ok(cat.sources.find(s => s.id === 'SRC-APH-2024-27').status === 'UNVERIFIED', 'handbook source is marked UNVERIFIED (no clause invented)');
  ok((await call('GET', '/assistant/catalog')).status === 401, 'assistant needs a signed-in user');
  ok((await call('POST', '/assistant/sessions', { token: admin })).status === 403, 'staff accounts cannot open institution assistant applications');

  console.log('\nScenario A: new FDR, from the question to the portal');
  aiOverride.client = null;
  const cl = (await call('POST', '/assistant/classify', { token: dits, body: { text: 'We want to submit a new FDR for our security deposit' } })).body;
  ok(cl.workflow === 'NEW_FDR' && cl.method === 'rules', `free text classified as ${cl.workflow} (${cl.method}, no AI configured)`);
  let a = await start(dits);
  ok(a.state === 'DRAFT', 'new application starts as DRAFT');
  a = (await call('POST', `/assistant/sessions/${a.id}/answer`, { token: dits, body: { workflow: 'NEW_FDR' } })).body;
  ok(a.state === 'QUESTIONS_IN_PROGRESS' && a.nextQuestion.key === 'purpose', 'asks one question at a time (first: linked application)');
  ok(!Rules.QUESTIONS.NEW_FDR.some(q => /institution|pid|state|district/i.test(q.key)), 'never asks for profile data (institution name, PID, location)');
  ok((await answer(dits, a.id, 'bankName', 'Some Bank')).code === 'VALIDATION', 'an answer outside the options is refused');
  await answer(dits, a.id, 'purpose', null); await answer(dits, a.id, 'bankName', 'State Bank of India'); await answer(dits, a.id, 'lienMarked', 'no');
  a = await answer(dits, a.id, 'signatory', 'head');
  ok(a.state === 'DOCUMENTS_REQUIRED' && a.destination.role.includes('bank'), `checklist ready; destination: ${a.destination.role} (${a.destination.verified})`);
  ok(item(a, 'FDR_ADVICE').blocking && item(a, 'FDR_ADVICE').source.status === 'PORTAL_RULE' && !item(a, 'BANK_LIEN_LETTER').applies && !item(a, 'AUTHORITY_LETTER').applies,
    'checklist: FDR advice mandatory (portal rule); lien letter and authorisation not applicable');

  console.log('\nScenario B: missing document blocks submission');
  ok(a.blockers.some(b => /Missing: FDR certificate/.test(b)), 'missing mandatory document is listed');
  ok((await call('POST', `/assistant/sessions/${a.id}/review`, { token: dits, body: { open: true } })).body.code === 'BLOCKED', 'final review refused while requirements are unmet');
  ok((await call('POST', `/assistant/sessions/${a.id}/submit`, { token: dits, body: { confirm: true, declaration: true } })).status === 400, 'submission refused while requirements are unmet');

  console.log('\nNo AI configured: rule-based reading of the PDF text');
  let f1 = await upload(dits, ditsId, 'fdr-advice.pdf');
  a = (await attach(dits, a.id, 'FDR_ADVICE', f1)).body;
  ok(item(a, 'FDR_ADVICE').validation.status === 'AMBER' && /could not be read automatically \(the PDF could not be opened/.test(item(a, 'FDR_ADVICE').validation.issues[0].message), 'damaged PDF: AMBER (manual review) with the reason, never GREEN');
  ok(field(a, 'fdrNumber').status === 'MISSING', 'no values are guessed when the document was not read');
  const cert = await upload(dits, ditsId, 'Oracle-Certificate.pdf', makePdf([['Oracle Certified Professional', 'This certifies that Mrityunjai has completed the Java SE 17 Developer exam.']]));
  a = (await attach(dits, a.id, 'FDR_ADVICE', cert)).body;
  ok(item(a, 'FDR_ADVICE').validation.status === 'RED' && /not a fdr certificate/i.test(item(a, 'FDR_ADVICE').validation.issues.map(i => i.message).join(' ')), 'a certificate uploaded as the FDR advice is RED (wrong document), without AI');
  const real = await upload(dits, ditsId, 'SBI-advice.pdf', makePdf([adviceLines({ fdr: 'SBI-FDR-55500-2026' })]));
  a = (await attach(dits, a.id, 'FDR_ADVICE', real)).body;
  const rv = item(a, 'FDR_ADVICE').validation;
  ok(rv.status === 'GREEN' && rv.checks.some(c => /rules, no AI/.test(c)), `text PDF advice read without AI: ${rv.status} (${rv.checks[2]})`);
  ok(field(a, 'fdrNumber').value === 'SBI-FDR-55500-2026' && field(a, 'amountRs').value === '10000000' && field(a, 'maturityDate').value === '2036-10-01'
    && field(a, 'fdrNumber').source.page === 1 && /FDR No\./.test(field(a, 'fdrNumber').source.line), 'form filled from the PDF text, with page and source line');

  aiOverride.client = fake;
  reading = extraction({ fdrNumber: 'SBI-FDR-55501-2026', amountInr: '10000000', issueDate: '2026-10-01', maturityDate: '2036-10-01', lienHolder: 'Regional Officer, Northern Regional Office, AICTE',
    keyFields: [{ label: 'FDR No.', value: 'SBI-FDR-55501-2026', page: 1, sourceLine: 'Receipt No. SBI-FDR-55501-2026' }] });
  f1 = await upload(dits, ditsId, 'fdr-advice-v2.pdf');
  a = (await attach(dits, a.id, 'FDR_ADVICE', f1)).body;
  ok(item(a, 'FDR_ADVICE').validation.status === 'GREEN' && /does not confirm that the document is genuine/.test(item(a, 'FDR_ADVICE').validation.note), 'readable advice is GREEN, with the authenticity disclaimer');
  const fn = field(a, 'fdrNumber');
  ok(fn.value === 'SBI-FDR-55501-2026' && fn.status === 'EXTRACTED' && fn.source.page === 1 && /Receipt No/.test(fn.source.line), 'form field filled from the document with page and source line');
  ok(field(a, 'institution').status === 'VERIFIED' && field(a, 'branchName').status === 'MISSING', 'profile values reused; values not in the document left MISSING');
  ok((await call('POST', `/assistant/sessions/${a.id}/form`, { token: dits, body: { values: { institution: 'Fake College', ifscCode: 'SBIN001' } } })).body.form.find(f => f.key === 'institution').value.includes('Delhi Institute'),
    'read-only profile fields cannot be overwritten');
  a = (await call('POST', `/assistant/sessions/${a.id}/form`, { token: dits, body: { values: { branchName: 'Institutional Area Branch, New Delhi', ifscCode: 'SBIN0001234' } } })).body;
  ok(!a.blockers.length && a.counts.satisfied === 1 && a.counts.required === 1, `no blockers; ${a.counts.satisfied} of ${a.counts.required} required checklist items satisfied`);
  ok((await call('POST', `/assistant/sessions/${a.id}/submit`, { token: dits, body: { confirm: true, declaration: true } })).body.code === 'INVALID_STATE', 'cannot submit without opening the final review');
  a = (await call('POST', `/assistant/sessions/${a.id}/review`, { token: dits, body: { open: true } })).body;
  ok(a.state === 'AWAITING_USER_CONFIRMATION', 'final review: AWAITING_USER_CONFIRMATION');
  ok((await call('POST', `/assistant/sessions/${a.id}/submit`, { token: dits, body: { confirm: true } })).body.code === 'VALIDATION', 'declaration is required');
  a = (await call('POST', `/assistant/sessions/${a.id}/submit`, { token: dits, body: { confirm: true, declaration: true } })).body;
  const fdr = (await pool.query(`select * from public.fdrs where fdr_number = 'SBI-FDR-55501-2026'`)).rows[0];
  ok(fdr && fdr.institution_id === ditsId && Number(fdr.amount) === 10000000 && fdr.evidence.fileHash === f1.fileHash, 'submitted through submit_fdr with the uploaded advice as evidence');
  ok(a.submission.reference === fdr.id && a.state === 'UNDER_REVIEW' && /bank/.test(a.stateDetail), `reference is the real FDR id; state ${a.state} (${a.stateDetail})`);
  ok((await call('POST', `/assistant/sessions/${a.id}/form`, { token: dits, body: { values: { branchName: 'x' } } })).status === 409, 'a submitted application can no longer be changed');
  const audit = (await pool.query(`select action from public.audit_events where institution_id = $1 and action like 'ASSISTANT_%'`, [ditsId])).rows.map(r => r.action);
  ok(['ASSISTANT_STARTED', 'ASSISTANT_DOCUMENT_UPLOADED', 'ASSISTANT_SUBMITTED'].every(x => audit.includes(x)), 'start, uploads and submission are in the audit trail');

  console.log('\nScenario C: conflicting information');
  let c = await start(dits, 'NEW_FDR');
  await answer(dits, c.id, 'purpose', null); await answer(dits, c.id, 'bankName', 'State Bank of India'); await answer(dits, c.id, 'lienMarked', 'yes');
  c = await answer(dits, c.id, 'signatory', 'head');
  ok(item(c, 'BANK_LIEN_LETTER').applies && !item(c, 'BANK_LIEN_LETTER').blocking && item(c, 'BANK_LIEN_LETTER').needsHumanReview, 'lien letter applies, but its source is unverified: shown for human review, not blocking');
  reading = extraction({ fdrNumber: 'SBI-FDR-55502-2026', amountInr: '10000000', issueDate: '2026-10-02', maturityDate: '2036-10-02', lienHolder: 'Regional Officer, AICTE' });
  await attach(dits, c.id, 'FDR_ADVICE', await upload(dits, ditsId, 'advice-c.pdf'));
  reading = extraction({ documentKind: 'Bank lien letter', fdrNumber: 'SBI-FDR-99999-2026', lienHolder: 'Regional Officer, AICTE' });
  c = (await attach(dits, c.id, 'BANK_LIEN_LETTER', await upload(dits, ditsId, 'lien-c.pdf'))).body;
  ok(item(c, 'FDR_ADVICE').validation.status === 'RED' && c.state === 'NEEDS_CORRECTION', 'different FDR numbers in two documents: RED, NEEDS_CORRECTION');
  reading = extraction({ institutionNameInDocument: 'Sunrise College of Pharmacy', fdrNumber: 'SBI-FDR-55502-2026', amountInr: '10000000', issueDate: '2026-10-02', maturityDate: '2031-10-02', lienHolder: 'Sunrise Educational Trust' });
  c = (await attach(dits, c.id, 'FDR_ADVICE', await upload(dits, ditsId, 'advice-c2.pdf'))).body;
  const msgs = item(c, 'FDR_ADVICE').validation.issues.map(i => i.message).join(' | ');
  ok(/Sunrise College/.test(msgs) && /shorter than 10 years/.test(msgs) && /not AICTE/.test(msgs), 'wrong institution, short tenure and wrong lien holder are each explained');
  ok(item(c, 'FDR_ADVICE').validation.issues.every(i => i.fix), 'every issue says how to fix it');
  const dup = await upload(dits, ditsId, 'same.pdf', 'identical bytes');
  reading = extraction({ fdrNumber: 'SBI-FDR-55502-2026' });
  await attach(dits, c.id, 'FDR_ADVICE', dup);
  c = (await attach(dits, c.id, 'BANK_LIEN_LETTER', { ...dup })).body;
  ok(item(c, 'BANK_LIEN_LETTER').validation.issues.some(i => /same file/.test(i.message)), 'the same file used for two checklist items is flagged');
  c = (await call('POST', `/assistant/sessions/${c.id}/form`, { token: dits, body: { values: { bankName: 'Canara Bank', ifscCode: 'SBIN0001234' } } })).body;
  ok(c.blockers.some(b => /IFSC of Canara Bank starts with CNRB/.test(b)), 'IFSC that does not belong to the bank is a blocker');

  console.log('\nScenario D: requirement without a verified source');
  let d = await start(dits, 'NEW_FDR');
  await answer(dits, d.id, 'purpose', null); await answer(dits, d.id, 'bankName', 'State Bank of India'); await answer(dits, d.id, 'lienMarked', 'no');
  d = await answer(dits, d.id, 'signatory', 'delegated');
  const auth = item(d, 'AUTHORITY_LETTER');
  ok(auth.applies && auth.needsHumanReview && !auth.blocking && auth.source.status === 'UNVERIFIED', 'authorisation letter: flagged for human confirmation, not presented as a rule');
  ok(d.warnings.some(w => /not confirmed by an official source/.test(w)), 'the user is told the requirement is not confirmed');
  // An administrator verifies the source: it then becomes a real, blocking requirement.
  ok((await call('POST', '/rpc/admin_save_source', { token: admin, body: { p: { id: 'SRC-APH-2024-27', title: 'AICTE Approval Process Handbook 2024-25 to 2026-27', issuingAuthority: 'AICTE', status: 'VERIFIED' } } })).status === 400,
    'a source cannot be marked VERIFIED without section and excerpt');
  ok((await call('POST', '/rpc/admin_save_source', { token: dits, body: { p: { id: 'SRC-X', title: 'Fake', issuingAuthority: 'Me', status: 'VERIFIED' } } })).status >= 400, 'institutions cannot edit regulatory sources');
  ok((await call('POST', '/rpc/admin_save_requirement', { token: admin, body: { p: { workflow: 'NEW_FDR', docKey: 'AUTHORITY_LETTER', docType: 'OTHER', name: 'Authorisation of the signatory', purpose: 'Shows that the person submitting may act for the institution.', applicability: 'CONDITIONAL', condition: 'signatory=delegated', sourceId: 'SRC-APH-2024-27', version: '2026.1', effectiveFrom: '2026-10-27', active: false } } })).status === 200,
    'administrator can switch a requirement off');
  ok(!(await call('GET', `/assistant/sessions/${d.id}`, { token: dits })).body.checklist.some(i => i.docKey === 'AUTHORITY_LETTER'), 'an inactive requirement leaves the checklist');

  console.log('\nScenario E: another institution');
  ok((await call('GET', `/assistant/sessions/${a.id}`, { token: bce })).status === 404, "BCE cannot open DITS's application");
  ok((await call('POST', `/assistant/sessions/${c.id}/answer`, { token: bce, body: { workflow: 'OTHER' } })).status === 404, "BCE cannot change DITS's application");
  const e = await start(bce, 'NEW_FDR');
  await answer(bce, e.id, 'purpose', null); await answer(bce, e.id, 'bankName', 'State Bank of India'); await answer(bce, e.id, 'lienMarked', 'no'); await answer(bce, e.id, 'signatory', 'head');
  ok((await attach(bce, e.id, 'FDR_ADVICE', f1)).status === 400, "BCE cannot attach a file stored in DITS's folder");
  ok((await answer(bce, e.id, 'purpose', (await pool.query(`select id from public.applications where institution_id = $1 limit 1`, [ditsId])).rows[0].id)).code === 'VALIDATION', "BCE cannot link DITS's application");
  const bceList = (await call('GET', '/assistant/sessions', { token: bce })).body;
  ok(bceList.length === 1 && bceList[0].id === e.id, 'session list shows only own applications');

  console.log('\nScenario F: no submission channel');
  let o = await start(dits, 'OTHER');
  o = await answer(dits, o.id, 'details', 'We need a certificate of our deposit history for a state government audit.');
  ok(o.destination.verified === 'NEEDS_CONFIRMATION' && o.integration === false, 'destination flagged for human confirmation');
  o = (await call('POST', `/assistant/sessions/${o.id}/package`, { token: dits })).body;
  ok(o.state === 'READY_FOR_SUBMISSION' && !o.submission, 'package prepared: READY_FOR_SUBMISSION, not SUBMITTED');
  ok((await call('POST', `/assistant/sessions/${o.id}/submit`, { token: dits, body: { confirm: true, declaration: true } })).body.code === 'NO_INTEGRATION', 'submission refused: no authorised channel');

  console.log('\nRenewal, and status that follows the real request');
  let r = await start(dits, 'RENEW_FDR');
  const f41207 = (await pool.query(`select id from public.fdrs where fdr_number = 'SBI-FDR-41207-2016'`)).rows[0].id;
  const f30115 = (await pool.query(`select id from public.fdrs where fdr_number = 'PNB-FDR-30115-2016'`)).rows[0].id;
  ok((await answer(dits, r.id, 'fdrId', (await pool.query(`select id from public.fdrs where institution_id = $1 limit 1`, [bceId])).rows[0].id)).code === 'VALIDATION', "another institution's FDR cannot be chosen");
  await answer(dits, r.id, 'fdrId', f41207); r = await answer(dits, r.id, 'renewalDone', 'yes');
  reading = extraction({ fdrNumber: 'SBI-FDR-41207-2016', amountInr: '5000000', issueDate: '2016-12-30', maturityDate: '2036-12-29', lienHolder: 'Regional Officer, AICTE', referenceNumber: 'CBS-SBI-REN-41207' });
  r = (await attach(dits, r.id, 'RENEWAL_ADVICE', await upload(dits, ditsId, 'renewal.pdf'))).body;
  ok(field(r, 'maturityDate').value === '2036-12-29' && field(r, 'fdrNumber').status === 'VERIFIED' && !r.blockers.length, 'renewal form: FDR from the portal record, new maturity from the advice');
  await call('POST', `/assistant/sessions/${r.id}/review`, { token: dits, body: { open: true } });
  r = (await call('POST', `/assistant/sessions/${r.id}/submit`, { token: dits, body: { confirm: true, declaration: true } })).body;
  ok(r.state === 'UNDER_REVIEW', `renewal request created: ${r.state}`);
  await call('POST', '/rpc/decide_fdr_request', { token: admin, body: { p_request_id: r.submission.reference, p_approve: true, p_note: 'Verified with SBI CBS.' } });
  r = (await call('GET', `/assistant/sessions/${r.id}`, { token: dits })).body;
  ok(r.state === 'APPROVED', 'after the administrator approves, the assistant shows APPROVED');
  const rel = await start(dits, 'RELEASE_FDR');
  ok((await answer(dits, rel.id, 'fdrId', (await pool.query(`select id from public.fdrs where fdr_number = 'SBI-FDR-99201-2024'`)).rows[0].id)).code === 'VALIDATION', 'release refused for an FDR that has not matured');
  ok((await answer(dits, rel.id, 'fdrId', f30115)).nextQuestion === null, 'matured, endorsed FDR can be chosen for release');

  console.log('\nCompliance reply to a deficiency notice');
  let q = await start(bce, 'RESPOND_DEFICIENCY');
  const app2 = (await pool.query(`select id from public.applications where application_number = 'APP-2026-INTAKE-4491'`)).rows[0].id;
  q = await answer(bce, q.id, 'applicationId', app2);
  ok(q.checklist.length === 2 && q.checklist.every(i => i.source.status === 'VERIFIED' && /Deficiency notice/.test(i.source.title)), 'checklist built from the notice itself (one item per point)');
  ok(q.form.filter(f => /^r\d$/.test(f.key)).every(f => f.status === 'MISSING'), 'responses are never written for the user');
  q = (await call('POST', `/assistant/sessions/${q.id}/form`, { token: bce, body: { values: { r0: '18 faculty recruited on 5-Nov-2026; appointment orders attached.', r1: '9 Professors appointed; selection committee minutes attached.' } } })).body;
  await call('POST', `/assistant/sessions/${q.id}/review`, { token: bce, body: { open: true } });
  q = (await call('POST', `/assistant/sessions/${q.id}/submit`, { token: bce, body: { confirm: true, declaration: true } })).body;
  ok(q.state === 'UNDER_REVIEW' && /APP-2026-INTAKE-4491 v3/.test(q.submission.reference), `compliance reply submitted (${q.submission.reference})`);

  console.log('\nRLS on the new tables');
  const { asUser } = await import('../../server/db.mjs');
  const bceUid = (await pool.query(`select id from auth.users where email = 'bce.test@example.com'`)).rows[0].id;
  const seen = (await asUser(bceUid, c2 => c2.query('select count(*)::int n, count(*) filter (where institution_id <> $1)::int other from public.assistant_sessions', [bceId]))).rows[0];
  ok(seen.n >= 2 && seen.other === 0, `institution reads only its own assistant rows (${seen.n})`);
  ok(!!(await asUser(bceUid, c2 => c2.query(`update public.assistant_sessions set submission = '{}' where institution_id = $1`, [bceId]).catch(err => err))).message, 'institutions cannot write assistant rows directly');
} catch (err) {
  failed++; console.error(err);
} finally {
  server.close(); await pool.end(); await db.stop();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
