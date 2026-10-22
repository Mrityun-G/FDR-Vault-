// Staff web portal (web-portal/) end-to-end test against the local Supabase stand-in (real SQL, real RLS).
// Run:  npm run mock:supabase   (terminal 1)
//       npm run web:test-server (terminal 2)  -> web portal dev server on :3100 pointed at the stand-in
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
  const browser = await puppeteer.launch({ executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--disable-gpu'], protocolTimeout: 120000 });
  const errors = [];
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1440, height: 950 });
  page.on('pageerror', e => errors.push(e.message));

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
  const login = async (email, password) => {
    await page.goto(WEB, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.goto(WEB, { waitUntil: 'networkidle0' });
    await fill('#staff-email', email);
    await fill('#staff-password', password);
    await page.click('button[type=submit]');
    await wait(1500);
  };
  const logout = async () => {
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /^\s*Logout\s*$/.test(b.textContent))?.click());
    await waitText('Staff Sign-in');
  };

  try {
    console.log('Access control');
    await login('principal@dits-delhi.edu.in', 'Dits@2026');
    ok((await text()).includes('institution account'), 'institution account is refused on the staff portal (points to the mobile app)');
    await login('admin.verma@aicte-india.org', 'wrong-password');
    ok((await text()).includes('Invalid email or password'), 'wrong password shows a clear error');

    console.log('\nAdministrator');
    await login('admin.verma@aicte-india.org', 'Admin@2026');
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
    await page.reload({ waitUntil: 'networkidle0' });
    await waitText('Shri R. C. Verma');
    await click('Renewals & Replacements');
    await waitText('Requests awaiting a decision');
    ok((await text()).includes('2036-12-29'), 'renewal request filed by the institution appears with its proposed maturity');
    await click('Approve');
    await click('Approve request');
    await waitText('request for SBI-FDR-41207-2016 approved');
    const renewed = await one(`select f.maturity_date::text m, r.status from public.fdrs f join public.fdr_requests r on r.fdr_id = f.id where f.id = '${fdr}' order by r.requested_at desc limit 1`);
    ok(renewed.status === 'APPROVED' && renewed.m === '2036-12-29', 'renewal approved and the deposit maturity updated');

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
