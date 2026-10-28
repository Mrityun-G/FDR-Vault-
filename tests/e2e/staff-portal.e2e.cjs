// Staff web portal (web-portal/) end-to-end test against the real API server and PostgreSQL (real SQL, real RLS).
// Run:  npm run e2e:server      (terminal 1)
//       npm run web:test-server (terminal 2)  -> web portal dev server on :3100 pointed at the API server
//       node tests/e2e/staff-portal.e2e.cjs
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const API = 'http://127.0.0.1:8790';
const WEB = process.env.WEB_URL || 'http://127.0.0.1:3100';
const OUT = path.join(__dirname, '..', 'output', 'staff-portal');
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) failed++; };
const sql = async q => (await fetch(`${API}/__sql`, { method: 'POST', body: q })).json();
const one = async q => (await sql(q))[0] || {};

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--disable-gpu', ...(process.env.BLOCK_WEBFONTS ? ['--host-resolver-rules=MAP fonts.gstatic.com ~NOTFOUND'] : [])], protocolTimeout: 120000 });
  const errors = [];
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1440, height: 950 });
  page.on('pageerror', e => errors.push(e.message));
  await (await page.createCDPSession()).send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: OUT });

  const text = () => page.evaluate(() => document.body.innerText);
  const waitText = async (t, timeout = 15000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) { if ((await text()).includes(t)) return true; await wait(200); }
    throw new Error(`timed out waiting for "${t}"`);
  };
  // Click the innermost visible element whose text contains `t` (buttons and table cells first).
  const click = async t => {
    const done = await page.evaluate(t => {
      const els = [...document.querySelectorAll('button, td, a, label, [role=button], div, span, p, h4')].filter(e => e.offsetParent !== null && e.textContent.replace(/\s+/g, ' ').includes(t));
      const inner = els.filter(e => ![...e.children].some(c => c.textContent.replace(/\s+/g, ' ').includes(t)));
      const pick = inner.find(e => e.closest('button')) || inner[0];
      if (!pick) return false;
      (pick.closest('button') || pick.closest('tr') || pick).click();
      return true;
    }, t);
    if (!done) throw new Error(`click: "${t}" not found`);
    await wait(350);
  };
  const fill = async (selector, value) => {
    await page.waitForSelector(selector, { visible: true });
    await page.$eval(selector, el => { el.focus(); el.select && el.select(); });
    await page.keyboard.press('Backspace');
    await page.type(selector, value);
  };
  const login = async (email, password, portal = '/officer') => {
    await page.goto(WEB + portal, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.goto(WEB + portal, { waitUntil: 'networkidle0' });
    await fill('#staff-email', email);
    await fill('#staff-password', password);
    await page.click('button[type=submit]');
    await wait(1500);
  };
  const logout = async () => {
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /^\s*Logout\s*$/.test(b.textContent))?.click());
    await waitText('Sign-in');
  };

  try {
    console.log('Separate portals');
    await page.goto(WEB, { waitUntil: 'networkidle0' });
    const chooser = await text();
    ok(['Officer Portal', 'Admin Console', 'Institution App'].every(t => chooser.includes(t)), 'root page links to the Officer portal, Admin console and institution app');
    await page.goto(WEB + '/admin', { waitUntil: 'networkidle0' });
    ok((await text()).includes('Admin Console Sign-in'), '/admin opens the Admin Console');
    await login('admin.verma@aicte-india.org', 'Admin@2026', '/officer');
    // One account may use every portal (multi-role): a portal the account is not registered for asks for its details once, and shows nothing else.
    const gate = t => t.includes('Complete your registration') && !t.includes('Logout');
    ok(gate(await text()), 'administrator on the Officer portal must register as an officer first (no access before)');
    await login('reviewer.mehta@aicte-india.org', 'Rev@2026', '/admin');
    ok(gate(await text()), 'scrutiny officer on the Admin Console must register as an administrator first (no access before)');

    console.log('\nAccess control');
    await login('principal@dits-delhi.edu.in', 'Dits@2026');
    ok(gate(await text()), 'institution account gets no staff access without registering as staff');
    await login('admin.verma@aicte-india.org', 'wrong-password', '/admin');
    ok((await text()).includes('Invalid email or password'), 'wrong password shows a clear error');

    console.log('\nAdministrator');
    await login('admin.verma@aicte-india.org', 'Admin@2026', '/admin');
    await waitText('Shri R. C. Verma');
    ok(true, 'admin signs in with email and password');
    await page.screenshot({ path: path.join(OUT, '1-dashboard.png') });
    await click('Verification Center');
    await waitText('APP-2026-INFRA-3312');
    const queue = await text();
    ok(['APP-2026-EOA-1082', 'APP-2026-INTAKE-4491', 'APP-2026-NEW-9021', 'APP-2026-INFRA-3312'].every(a => queue.includes(a)), 'scrutiny queue lists all 4 applications from the database');

    // Deficiency notice on a newly submitted application
    await click('APP-2026-INFRA-3312');
    await click('Issue Official Scrutiny Deficiencies');
    await fill('input[placeholder="Add deficiency point..."]', 'Upload the occupancy certificate for the new academic block');
    await click('Add');
    await click('Submit Official Recommendation');
    await waitText('Deficiency notice issued');
    const infra = await one(`select a.status, s.official_notice_number n, (select count(*)::int from public.notifications x where x.institution_id = a.institution_id and x.title = 'Scrutiny Deficiency Notice issued') c from public.applications a join public.scrutiny s on s.application_id = a.id where a.application_number = 'APP-2026-INFRA-3312'`);
    ok(infra.status === 'DEFICIENCIES_NOTED' && /^AICTE\//.test(infra.n) && infra.c >= 1, `deficiency notice ${infra.n} saved and the institution notified`);

    // Reviewer override on a warning finding
    await click('APP-2026-EOA-1082');
    await click('Reviewer Override...');
    await fill('textarea[placeholder^="Provide detailed statutory reason"]', 'DFS renewal receipt verified with the issuing authority on 20 Oct 2026');
    await click('Authorize Override');
    await waitText('Override recorded');
    const ov = await one(`select f.override->>'by' b from public.findings f join public.applications a on a.id = f.application_id where a.application_number = 'APP-2026-EOA-1082' and f.override is not null`);
    ok(/Verma/.test(ov.b || ''), 'finding override stored with the officer name');

    // Final approval of a scrutiny-cleared application
    await click('APP-2026-NEW-9021');
    await click('Grant Final Approval (EoA)');
    await click('Approve & Issue EoA');
    await waitText('approved. The institution has been notified');
    ok((await one(`select status from public.applications where application_number = 'APP-2026-NEW-9021'`)).status === 'APPROVED', 'administrator final approval recorded (SCRUTINY_CLEARED → APPROVED)');
    ok((await text()).includes('View Extension of Approval Letter'), 'EoA letter available after approval');
    await page.screenshot({ path: path.join(OUT, '2-workbench.png') });

    // FDR renewal requested from the mobile app, decided here
    const dits = (await one(`select id from public.profiles where email = 'principal@dits-delhi.edu.in'`)).id;
    const fdr = (await one(`select id from public.fdrs where fdr_number = 'SBI-FDR-41207-2016'`)).id;
    await sql(`select set_config('request.jwt.claim.sub', '${dits}', false); select public.request_fdr_renewal('${fdr}', '{"mode":"extension","maturityDate":"2036-12-29","token":"CBS-SBI-RENEW-41207"}'::jsonb); select set_config('request.jwt.claim.sub', '', false);`);
    await page.reload({ waitUntil: 'networkidle2' });   // signed in: the live-update stream stays open, so not networkidle0
    await waitText('Shri R. C. Verma');
    await click('Renewals & Replacements');
    await waitText('Requests awaiting a decision');
    ok((await text()).includes('2036-12-29'), 'renewal request filed by the institution appears with its proposed maturity');
    await click('Approve');
    await click('Approve request');
    await waitText('request for SBI-FDR-41207-2016 approved');
    const renewed = await one(`select f.maturity_date::text m, r.status from public.fdrs f join public.fdr_requests r on r.fdr_id = f.id where f.id = '${fdr}' order by r.requested_at desc limit 1`);
    ok(renewed.status === 'APPROVED' && renewed.m === '2036-12-29', 'renewal approved and the deposit maturity updated');

    // Lien release: the institution's request, approved here with the AICTE release order (the bank discharges it later)
    const ditsInst = (await one(`select institution_id i from public.profiles where email = 'principal@dits-delhi.edu.in'`)).i;
    const relId = (await one(`insert into public.fdrs(institution_id, fdr_number, amount, bank_name, branch_name, ifsc_code, issue_date, maturity_date, joint_lien_holder, is_lien_confirmed, lien_endorsement_token)
      values ('${ditsInst}', 'SBI-FDR-E2E01-2016', 10000000, 'State Bank of India', 'Institutional Area', 'SBIN0001234', '2016-01-01', '2026-01-01', 'Regional Officer, AICTE', true, 'CBS-E2E-01') returning id`)).id;
    await sql(`select set_config('request.jwt.claim.sub', '${dits}', false); select public.request_lien_release('${relId}', 'Completion of the mandatory 10-year lock-in.', true); select set_config('request.jwt.claim.sub', '', false);`);
    await page.reload({ waitUntil: 'networkidle2' });
    await waitText('Shri R. C. Verma');
    await click('Lien Release Requests');
    await waitText('FDR Lien Release Desk');
    ok(!(await text()).toLowerCase().includes('refund'), 'release desk makes no refund claim');
    await click('Approve release');
    await waitText('AICTE release order number');
    ok(await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Approve request').disabled), 'approval is blocked until the release order number is entered');
    await fill('input[placeholder^="e.g. AICTE/"]', 'AICTE/NRO/LR/2026/101');
    await click('Approve request');
    await waitText('request for SBI-FDR-E2E01-2016 approved');
    const rel = await one(`select f.released, f.released_at is not null at, r.decision_evidence->>'orderNumber' o from public.fdrs f join public.fdr_requests r on r.id = f.release_request_id where f.id = '${relId}'`);
    ok(rel.released === true && rel.at && rel.o === 'AICTE/NRO/LR/2026/101', 'release approved with its order number recorded on the FDR');
    await waitText('Approved, awaiting bank discharge');
    ok((await text()).includes('Waiting for State Bank of India to record the lien discharge'), 'desk shows the release waiting for the bank');

    // Reports from live records
    await click('Reports');
    await waitText('Download all reports (CSV)');
    const rep = await text();
    ok(['FDR register', 'Pending verification', 'Missing or incomplete documents', 'Approaching or past maturity', 'Requests awaiting action'].every(t => rep.includes(t)), 'Reports page lists the five reports');
    ok(!/100% CBS Verified|2\.4 Working Days|88\.5%/.test(rep), 'no hard-coded figures on the Reports page');
    await click('Requests awaiting action');
    await waitText('LIEN DISCHARGE');
    ok((await text()).includes('SBI-FDR-E2E01-2016'), 'awaiting-action report shows the release waiting for the bank');
    await click('Export CSV');
    await wait(1000);
    const csvFile = fs.readdirSync(OUT).find(f => /^AICTE_awaiting-action_.*\.csv$/.test(f));
    ok(csvFile && fs.readFileSync(path.join(OUT, csvFile), 'utf8').includes('"LIEN DISCHARGE","SBI-FDR-E2E01-2016"'), 'report exported as CSV');
    await fill('input[aria-label="Filter by institution name or PID"]', 'no-such-institution');
    await click('FDR register');
    await waitText('Nothing to report.');
    ok(true, 'institution filter narrows the reports');
    await page.screenshot({ path: path.join(OUT, '2b-reports.png') });

    // Daily reminder job
    await click('Settings');
    await waitText('Daily FDR maturity reminders');
    await click('Run now');
    await waitText('Run complete:');
    ok((await one(`select count(*)::int n from public.job_runs where trigger = 'ADMIN' and error is null`)).n >= 1, 'admin ran the reminder job from Settings; the run is logged');

    // Staff invitation
    await click('User Management');
    await waitText('Stakeholder Accounts');
    ok(await waitText('Dr. Sunil K. Mehta').catch(() => false), 'user directory lists real accounts');
    await click('Invite staff');
    await fill('form input[type=email]', 'new.reviewer@aicte-india.org');
    const inputs = await page.$$('form input:not([type=email])');
    await inputs[0].type('Dr. Kavita Iyer');
    await page.click('form button[type=submit]');
    await waitText('can now sign in as reviewer');
    ok((await one(`select role from public.user_invites where email = 'new.reviewer@aicte-india.org'`)).role === 'REVIEWER', 'administrator invited a new scrutiny officer');
    await page.screenshot({ path: path.join(OUT, '3-users.png') });
    await logout();

    console.log('\nScrutiny officer');
    await login('reviewer.mehta@aicte-india.org', 'Rev@2026');
    await waitText('Dr. Sunil K. Mehta');
    await click('Verification Center');
    await click('APP-2026-NEW-9021');
    const rv = await text();
    ok(!rv.includes('Grant Final Approval'), 'reviewer has no final-approval button');
    await click('Renewals & Replacements');
    ok(!(await text()).includes('Approve request'), 'reviewer cannot decide FDR requests');
    await logout();

    console.log('\nBank official');
    await sql(`update public.fdrs set is_lien_confirmed = false, lien_endorsement_token = null, lien_endorsed_at = null where fdr_number = 'SBI-FDR-44012-2025'`);
    await login('fdr.officer@sbi.co.in', 'Bank@2026');
    await waitText('Bank Official FDR Verification Portal');
    const bank = await text();
    ok(bank.includes('SBI-FDR-44012-2025') && !bank.includes('PNB-FDR'), 'bank official sees only State Bank of India deposits');
    ok(!bank.includes('Scrutiny Committee Workbench'), 'bank official has no scrutiny workbench');
    await fill('input[aria-label="CBS lien reference"]', 'CBS-SBI-LIEN-2026-04412');
    await click('Confirm & Endorse Joint Lien with AICTE');
    await waitText('Joint lien on SBI-FDR-44012-2025 recorded');
    const lien = await one(`select is_lien_confirmed c, lien_endorsement_token t from public.fdrs where fdr_number = 'SBI-FDR-44012-2025'`);
    ok(lien.c === true && lien.t === 'CBS-SBI-LIEN-2026-04412', 'bank lien endorsement recorded with the CBS reference');
    // Lien discharge after the AICTE release
    ok((await text()).includes('Lien discharges: released by AICTE') && (await text()).includes('AICTE/NRO/LR/2026/101'), 'bank sees the released FDR with the AICTE release order');
    await fill('input[aria-label="CBS discharge reference for SBI-FDR-E2E01-2016"]', 'CBS-SBI-DIS-2026-0101');
    await click('Record discharge');
    await waitText('Lien discharge on SBI-FDR-E2E01-2016 recorded');
    const dis = await one(`select lien_discharge_ref r, lien_discharged_at is not null at from public.fdrs where fdr_number = 'SBI-FDR-E2E01-2016'`);
    ok(dis.r === 'CBS-SBI-DIS-2026-0101' && dis.at, 'bank recorded the lien discharge with its CBS reference');
    await page.screenshot({ path: path.join(OUT, '4-bank.png') });
    await logout();
  } catch (e) {
    failed++;
    console.log('  ✗', e.message);
    await page.screenshot({ path: path.join(OUT, 'failure.png') });
  }

  ok(errors.length === 0, `no JS errors ${errors.join('; ')}`);
  await browser.close();
  console.log(failed ? `\n${failed} check(s) failed` : '\nALL STAFF-PORTAL CHECKS PASSED');
  process.exit(failed ? 1 : 0);
})();
