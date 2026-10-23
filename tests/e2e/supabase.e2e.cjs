// Supabase-mode integration test: real app + real supabase-js + real migration (PGlite) behind a local stand-in.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const BASE = 'http://127.0.0.1:8790';
const OUT = path.join(__dirname, '..', 'output', 'remote');
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0, step = 0;
const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) failed++; };
const sql = async q => (await fetch(`${BASE}/__sql`, { method: 'POST', body: q })).json();
const pdf = (name, seed, pages = 2) => {
  const p = path.join(OUT, name);
  fs.writeFileSync(p, `%PDF-1.4\n% ${seed}\n` + Array.from({ length: pages }, (_, k) => `${k + 3} 0 obj<</Type /Page /Parent 2 0 R>>endobj\n`).join('') + 'trailer<<>>\n%%EOF\n');
  return p;
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--disable-gpu', ...(process.env.BLOCK_WEBFONTS ? ['--host-resolver-rules=MAP fonts.gstatic.com ~NOTFOUND'] : [])], protocolTimeout: 120000 });
  const newPage = async () => {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    page.errors = [];
    page.on('pageerror', e => page.errors.push(e.message));
    return page;
  };
  const helpers = page => ({
    text: () => page.evaluate(() => document.body.innerText),
    has: async s => (await page.evaluate(() => document.body.innerText)).includes(s),
    shot: n => page.screenshot({ path: path.join(OUT, `${String(++step).padStart(2, '0')}-${n}.png`) }),
    click: async (t, scope = '') => {
      const okk = await page.evaluate((t, s) => { const el = [...document.querySelectorAll(`${s} button, ${s} label, ${s} .li, ${s} .type-card`)].find(e => e.offsetParent !== null && e.textContent.replace(/\s+/g, ' ').trim().includes(t)); if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true; } return false; }, t, scope);
      if (!okk) throw new Error('not found: ' + t);
      await wait(350);
    },
    type: async (sel, v) => { await page.waitForSelector(sel); await page.$eval(sel, el => { el.value = ''; }); await page.type(sel, v); },
    waitText: async (s, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await page.evaluate(() => document.body.innerText)).includes(s)) return true; await wait(200); } return false; },
  });

  console.log('Boot & authentication (Supabase mode)');
  let page = await newPage(); let h = helpers(page);
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle0' });
  ok(await h.waitText('Get Started') || await h.waitText('Next'), 'boots to onboarding via Supabase client');
  await h.click('Login', '.splash-actions');
  ok(!(await h.has('Quick Fill')), 'no demo credentials shown in Supabase mode');
  await h.type('input[name=email]', '1-10928371'); await h.type('input[name=password]', 'x1234'); await h.click('Login', 'form'); await wait(600);
  ok(await h.has('registered official email'), 'PID login rejected — email required');
  await h.type('input[name=email]', 'reviewer.mehta@aicte-india.org'); await h.type('input[name=password]', 'Rev@2026'); await h.click('Login', 'form');
  ok(await h.waitText('Complete your registration'), 'reviewer account is asked to register an institution (no refusal)');
  await h.click('Use another account'); await wait(400);
  await h.type('input[name=email]', 'principal@dits-delhi.edu.in'); await h.type('input[name=password]', 'wrong-pass'); await h.click('Login', 'form');
  ok(await h.waitText('Invalid User ID or Password'), 'wrong password rejected');
  await h.type('input[name=password]', 'Dits@2026'); await h.click('Login', 'form');
  ok(await h.waitText('I Understand'), 'signed in; prototype notice shown');
  await h.click('I Understand');
  ok(await h.has('Delhi Institute of Technology & Science') && await h.has('Total Applications'), 'dashboard loaded from server');
  const keys = await page.evaluate(() => Object.keys(localStorage));
  ok(!keys.includes('aicte-irvp-institution-mobile-v1'), `no institution records persisted on device (keys: ${keys.join(', ')})`);
  await h.shot('dashboard');

  console.log('\nApplication with real uploads → server validation → idempotent submit');
  await h.click('New Application'); await h.click('Extension of Approval'); await h.click('Next'); await h.click('Next');
  ok(await h.has('SBI-FDR-99201-2024'), 'FDR on record listed from server');
  await h.click('Next');
  ok(!(await h.has('Use sample')), 'sample documents disabled in Supabase mode');
  const types = ['LAND_TITLE', 'BUILDING_NOC', 'FIRE_SAFETY', 'FDR_CORPUS', 'AFFILIATION', 'STATE_NOC', 'FACULTY_CADRE'];
  const deed = pdf('deed.pdf', 'dits-deed-unique-' + Date.now(), 3);
  for (const t of types) {
    const f = t === 'LAND_TITLE' ? deed : pdf(`${t}.pdf`, `${t}-${crypto.randomUUID()}${t === 'FDR_CORPUS' ? ' TAMPER_AMOUNT' : ''}`);
    const input = await page.$(`input[type=file][data-doc="${t}"]`);
    await input.uploadFile(f);
    for (let i = 0; i < 40 && await page.evaluate(t => !document.querySelector(`[data-act=removeDoc][data-doc="${t}"]`), t); i++) await wait(150);
  }
  for (const t of ['BUILDING_NOC', 'FIRE_SAFETY', 'AFFILIATION']) await page.$eval(`input[data-live=validTill][data-doc="${t}"]`, el => { el.value = '2029-06-30'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  ok(await h.has('7/7 mandatory'), '7 documents uploaded to private storage');
  const objs = await sql(`select count(*)::int c from storage.objects where name like (select id::text from public.institutions where pid='1-10928371') || '/%'`);
  ok(objs[0].c >= 7, `storage objects stored under the institution folder (${objs[0].c})`);
  await h.click('Validate');
  ok(await h.waitText('verified by the AICTE server', 15000), 'rule findings verified by server');
  if (process.env.AI_DOWN) {
    ok(await h.has('AI document reading is unavailable'), 'AI service down → clearly labelled on-device preview');
    ok(!(await page.$eval('[data-go=review]', b => b.disabled)), 'AI outage does not block continuing to submission');
  } else {
    ok(await h.has('Documents read by AI (claude-opus-5-5)'), 'documents read by the AI Edge Function');
    ok(await h.has('Amount in document (₹8000000) differs from the declared ₹10000000'), 'AI caught the FDR amount that differs from the form');
    ok(await h.has('AI read the institution name consistently'), 'AI institution-name check recorded (advisory)');
  }
  await h.shot('ai-server');
  await h.click('Continue');
  await page.click('input[name=declared]'); await wait(300);
  await h.click('Sign & Submit');
  await h.click('DSC Token'); await h.type('#dscPin', '1234');
  await h.click('Sign & Submit', '.sheet');
  ok(await h.waitText('Application Submitted Successfully', 10000), 'submission confirmed by server');
  const appNo = await page.evaluate(() => (document.body.innerText.match(/APP-\d{4}-EOA-\d{5}/) || [])[0]);
  ok(!!appNo, `server-assigned number ${appNo}`);
  const row = await sql(`select a.id, a.status, a.idempotency_key is not null k, (select count(*)::int from public.application_documents d where d.application_id = a.id) docs, (select count(*)::int from public.findings f where f.application_id = a.id) f from public.applications a where application_number = '${appNo}'`);
  ok(row.length === 1 && row[0].status === 'SUBMITTED' && row[0].docs === 7 && row[0].f === 6 && row[0].k, `persisted: 7 docs, 6 server findings, idempotency key`);
  const appId = row[0].id;
  await h.shot('submitted');

  console.log('\nPersistence, reviewer query, compliance response');
  await page.reload({ waitUntil: 'networkidle0' });
  ok(await h.waitText('Institution Portal'), 'session persists across app restart');
  const rev = (await sql(`select id from auth.users where email = 'reviewer.mehta@aicte-india.org'`))[0].id;
  await sql(`select set_config('request.jwt.claim.sub', '${rev}', false); select public.review_start('${appId}'); select public.review_request_clarification('${appId}', array['Upload DFS renewal receipt for Fire NOC'], 'Fire NOC renewal evidence pending'); select set_config('request.jwt.claim.sub', '', false);`);
  await page.reload({ waitUntil: 'networkidle0' }); await h.waitText('Institution Portal');
  await page.click('[data-tab=alerts]'); await wait(400);
  ok(await h.has('Scrutiny Deficiency Notice issued'), 'reviewer notice delivered as notification');
  await h.click('Inspect');
  ok(await h.waitText('Action Required'), 'notification opens the application with the query');
  await h.click('Docs (7)'); await wait(300);
  await page.evaluate(() => document.querySelector('details.acc').open = true);
  const popup = new Promise(r => page.browserContext().once('targetcreated', t => r(t)));
  await h.click('View document');
  const target = await Promise.race([popup, wait(5000).then(() => null)]);
  await wait(800);
  const tUrl = target ? target.url() : '';
  if (target) { const tp = await target.page().catch(() => null); if (tp) await tp.close().catch(() => {}); }
  await page.bringToFront();
  ok(target && /\/storage\/v1\/object\/sign\//.test(tUrl), `secure signed link opened (${tUrl.split('?')[0].slice(-40) || 'none'})`);
  await h.click('Overview'); await h.click('Submit Response');
  await page.$$eval('#respForm textarea', els => els.forEach(e => { e.value = 'DFS renewal receipt attached for verification.'; }));
  await (await page.$('input[type=file][data-attach=respond]')).uploadFile(pdf('dfs-receipt.pdf', 'dfs-' + Date.now()));
  await h.waitText('1 file(s) attached');
  await page.click('input[name=certify]');
  await h.click('Submit', '.footer-bar');
  ok(await h.waitText('Compliance response submitted'), 'compliance response accepted by server');
  const st = await sql(`select status, current_version from public.applications where id = '${appId}'`);
  ok(st[0].status === 'UNDER_SCRUTINY' && st[0].current_version === 2, 'server: UNDER_SCRUTINY, version 2');

  console.log('\nFDR requests, notifications, profile');
  await page.click('[data-tab=fdrs]'); await wait(400);
  await h.click('SBI-FDR-41207-2016'); await h.click('Process Renewal / Replacement'); await h.click('Submit Statutory Renewal');
  ok(await h.waitText('Renewal request pending'), 'renewal stored as pending server request');
  await page.click('[data-tab=fdrs]'); await wait(300);
  await h.click('PNB-FDR-30115-2016'); await h.click('Initiate Release Request');
  await page.click('input[name=certify]'); await h.click('Submit Discharge Application');
  ok(await h.waitText('Release Pending Bureau Approval'), 'lien release pending Bureau approval');
  await page.click('[data-tab=alerts]'); await wait(300);
  await h.click('Mark all read'); await wait(800);
  ok(await h.has('Unread (0)'), 'notifications marked read on server');
  await page.click('[data-tab=profile]'); await h.click('Grievance'); await h.click('Raise New Ticket');
  await h.type('input[name=subject]', 'Lien endorsement delay'); await h.type('textarea[name=desc]', 'Bank has not endorsed the lien for 10 days.');
  await h.click('Submit Ticket');
  ok(await h.waitText('TKT-'), 'ticket created by server');
  const audit = await sql(`select count(*)::int c, bool_and(e.prev_hash is not distinct from (select sha256_hash from public.audit_events p where p.institution_id = e.institution_id and p.id < e.id order by p.id desc limit 1)) chain from public.audit_events e where institution_id = (select id from public.institutions where pid='1-10928371')`);
  ok(audit[0].c > 8 && audit[0].chain, `server audit trail: ${audit[0].c} hash-chained events`);

  console.log('\nOffline & session expiry');
  await page.setOfflineMode(true); await page.evaluate(() => window.dispatchEvent(new Event('offline'))); await wait(300);
  ok(await h.has("You're offline"), 'offline banner shown');
  await page.setOfflineMode(false); await page.evaluate(() => window.dispatchEvent(new Event('online'))); await wait(500);
  ok(!(await h.has("You're offline")), 'banner cleared when back online');
  await fetch(`${BASE}/__expire`);
  await page.evaluate(() => { if (me()) Backend.markRead(null).catch(e => handleError(e)); });
  ok(await h.waitText('Authentication Failed') && /session (has )?(expired|ended)/i.test(await h.text()) && await page.evaluate(() => !!document.querySelector('form[data-form=login]')), 'revoked/expired session returns to Login with a message');
  ok(page.errors.length === 0, `no JS errors ${page.errors.join(' | ')}`);
  await h.shot('expired');

  console.log('\nCross-institution duplicate (BCE re-uses DITS deed) & registration');
  page = await newPage(); h = helpers(page);
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle0' }); await h.waitText('Login');
  await h.click('Login', '.splash-actions');
  await h.type('input[name=email]', 'director@bce-bangalore.edu.in'); await h.type('input[name=password]', 'Bce@2026'); await h.click('Login', 'form');
  await h.waitText('I Understand'); await h.click('I Understand');
  await h.click('New Application'); await h.click('Change in Program Details');
  await h.click('Next'); await h.type('input[name="prog.programme"]', 'B.Tech AI & DS'); await h.click('Next'); await h.click('Next');
  await (await page.$('input[type=file][data-doc="LAND_TITLE"]')).uploadFile(deed);
  for (let i = 0; i < 40 && await page.evaluate(() => !document.querySelector('[data-act=removeDoc][data-doc="LAND_TITLE"]')); i++) await wait(150);
  await h.click('Validate'); await h.click('Continue Anyway');
  ok(await h.waitText('verified by the AICTE server', 15000), 'server validation ran for BCE');
  ok(await h.has('Delhi Institute of Technology & Science') && await h.has('Cross-Application SHA-256 Duplicate Collision'), 'server flagged DITS deed re-use (invisible to BCE client)');
  await h.shot('bce-duplicate');
  await page.click('[data-act=back]'); await wait(300);
  page = await newPage(); h = helpers(page);
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle0' }); await h.waitText('Next');
  await h.click('Login', '.splash-actions'); await h.click('Register');
  await h.type('input[name=name]', 'New Horizon Institute of Technology'); await h.type('input[name=district]', 'Lucknow');
  await h.type('input[name=head]', 'Dr. Meera Iyer'); await h.type('input[name=email]', 'principal@nhit.edu.in'); await h.type('input[name=mobile]', '9876543210');
  await h.type('input[name=password]', 'Nhit@2026!'); await h.type('input[name=confirm]', 'Nhit@2026!');
  await page.click('input[name=agree]'); await h.click('Register', 'form');
  ok(await h.waitText('Confirm your email'), 'registration asks only for email confirmation');
  const reg = await sql(`select r.request_no, p.status from public.registration_requests r join public.profiles p on p.id = r.user_id where p.email = 'principal@nhit.edu.in'`);
  ok(reg.length === 1 && reg[0].status === 'ACTIVE', `server: ${reg[0] && reg[0].request_no} ACTIVE without approval`);
  await h.click('Done');
  await h.type('input[name=password]', 'Nhit@2026!'); await h.click('Login', 'form');
  ok(await h.waitText('New Horizon Institute of Technology'), 'registered account signs straight in');
  ok(page.errors.length === 0, `no JS errors ${page.errors.join(' | ')}`);

  await browser.close();
  console.log(failed ? `\n${failed} check(s) failed` : '\nALL SUPABASE-MODE CHECKS PASSED');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
