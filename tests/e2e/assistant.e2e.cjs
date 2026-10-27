// Regulatory Assistant in the institution app (demo mode): chat, checklist, uploads, form, review and submission.
// Run:  npm run serve:demo   (terminal 1)   then   npm run test:e2e:assistant
const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer-core');
const BASE = (process.env.APP_URL || 'http://127.0.0.1:8765') + '/index.html';
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) failed++; };

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'asst-'));
  const good = path.join(tmp, 'Renewed_FDR_Advice.pdf'), locked = path.join(tmp, 'Locked.pdf');
  fs.writeFileSync(good, '%PDF-1.4\n1 0 obj << /Type /Page >> endobj\n%%EOF\n');
  fs.writeFileSync(locked, '%PDF-1.4\n1 0 obj << /Encrypt 2 0 R >> endobj\n%%EOF\n');

  const browser = await puppeteer.launch({ executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--disable-gpu'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const text = () => page.evaluate(() => document.body.innerText);
  const route = () => page.evaluate(() => currentRoute());
  const clickText = async t => {
    await page.evaluate(t => { const el = [...document.querySelectorAll('button, a, label')].find(e => e.offsetParent !== null && e.textContent.replace(/\s+/g, ' ').includes(t)); if (!el) throw new Error('No button: ' + t); el.click(); }, t);
    await wait(350);
  };
  const until = async (fn, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await page.evaluate(fn)) return true; await wait(100); } return false; };
  const noScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const tab = async k => { await page.click(`[data-act=asstTab][data-v=${k}]`); await wait(300); };
  const startNew = async () => { await page.evaluate(() => goTab('dashboard')); await wait(200); await clickText('AI Regulatory Assistant'); await clickText('Start a new request'); await until(() => document.body.innerText.includes('What would you like to do today?')); };

  try {
    await page.goto(BASE + '?demo=dits', { waitUntil: 'networkidle0' });
    await page.evaluate(() => { const s = document.querySelector('#sheet'); s.classList.remove('open'); s.innerHTML = ''; DB.acked[me().id] = true; DB.assist = []; save(); });

    console.log('Entry and welcome');
    ok((await text()).includes('AI Regulatory Assistant'), 'dashboard shows the assistant entry');
    await clickText('AI Regulatory Assistant');
    ok(await route() === 'assistant', 'opens the assistant screen');
    await clickText('Start a new request');
    await until(() => document.body.innerText.includes('Welcome to the AICTE Regulatory Assistant'));
    const t0 = await text();
    ok(t0.includes('What would you like to do today?') && t0.includes('Renew an existing FDR') && t0.includes('Request release / refund'), 'greets and offers the request types');

    console.log('\nFree text, then questions one at a time');
    await page.type('#asstAsk', 'Our FDR is expiring next month and we need to extend it');
    await page.click('[data-act=asstAsk]');
    ok(await until(() => document.body.innerText.includes('It sounds like you want to: Renew an existing FDR')), 'free text understood as a renewal and confirmed with the user');
    await clickText('Yes, continue');
    ok(await until(() => document.body.innerText.includes('Which FDR do you want to renew?')), 'asks which FDR');
    ok((await text()).includes('I already have your institution'), 'explains that profile details are reused, not asked');
    await clickText('SBI-FDR-41207-2016');
    ok(await until(() => document.body.innerText.includes('Has the bank already renewed')), 'next question asked');
    await clickText('Yes');
    ok(await until(() => document.body.innerText.includes('Where this goes')), 'destination explained after the questions');
    const t1 = await text();
    ok(t1.includes('AICTE administrator') && t1.includes('Portal routing') && t1.includes('Your document checklist is ready'), 'shows role, reason, verification status and the checklist prompt');
    await page.type('#asstAsk', 'What is IFSC?');
    await page.click('[data-act=asstAsk]');
    ok(await until(() => document.body.innerText.includes('11-character code')), 'answers a question about a term in plain English');

    console.log('\nChecklist and uploads');
    await clickText('Open checklist');
    const t2 = await text();
    ok(t2.includes('Renewed FDR advice from the bank') && t2.includes('Mandatory') && t2.includes('0 of 1 document(s) uploaded'), 'checklist item with mandatory tag and progress');
    ok(t2.includes('Source: FDR Vault portal rules v2026.1') && t2.includes('Portal rule (AICTE clause not verified)'), 'each item names its source and verification status');
    await (await page.$('input[type=file][data-asst-doc=RENEWAL_ADVICE]')).uploadFile(locked);
    ok(await until(() => document.body.innerText.includes('password-protected')), 'password-protected PDF refused with a clear message');
    await (await page.$('input[type=file][data-asst-doc=RENEWAL_ADVICE]')).uploadFile(good);
    ok(await until(() => document.body.innerText.includes('Needs review')), 'real upload without a document reader is AMBER (Needs review), never GREEN');
    ok((await text()).includes('could not be checked') && (await text()).includes('1 of 1 document(s) uploaded'), 'explains why, and progress updates');
    await clickText('Remove');
    await clickText('Use sample (demo)');
    ok(await until(() => document.body.innerText.includes('Checks passed')), 'sample advice passes the checks (GREEN)');
    ok((await text()).includes('does not confirm that the document is genuine'), 'GREEN carries the authenticity disclaimer');

    console.log('\nForm, review and submission');
    await tab('form');
    const t3 = await text();
    ok(t3.includes('New maturity date') && t3.includes('Read from document') && t3.includes('From portal record'), 'form filled from the document and the portal record, with sources');
    await clickText('Final review');
    ok(await until(() => document.body.innerText.includes('Confirm and submit')), 'final review opens');
    const t4 = await text();
    ok(t4.includes('1 of 1 required checklist items satisfied') && t4.includes('not an AICTE approval'), 'completion count and disclaimer shown');
    await clickText('Confirm and submit');
    ok((await text()).includes('Please confirm the declaration'), 'declaration is required');
    await page.click('#asstDecl');
    await clickText('Confirm and submit');
    ok(await until(() => document.body.innerText.includes('Reference')), 'submitted: reference shown');
    ok(await page.evaluate(() => DB.fdrs.find(f => f.fdrNumber === 'SBI-FDR-41207-2016').renewalStatus === 'RENEWAL_SUBMITTED'), 'renewal request created through the portal function');
    ok((await text()).includes('Under review'), 'status follows the real request (Under review)');

    console.log('\nNew FDR with a missing document, then fixed');
    await startNew();
    await clickText('Submit a new security deposit');
    await clickText('Not linked to an application');
    await clickText('State Bank of India');
    await clickText('No');
    await clickText('The Head of Institution');
    await tab('form');
    ok((await page.$eval('[data-act=asstReview]', b => b.disabled)), 'final review disabled while the mandatory advice is missing');
    await tab('review');
    ok((await text()).includes('Missing: FDR certificate / deposit advice'), 'the missing document is named');
    await tab('checklist');
    await clickText('Use sample (demo)');
    await tab('form');
    await page.type('input[name=branchName]', 'Institutional Area Branch, New Delhi');
    await page.type('input[name=ifscCode]', 'PUNB0301100');
    await clickText('Save & re-check');
    ok((await text()).includes('IFSC of State Bank of India starts with SBIN'), 'IFSC that does not belong to the bank is caught');
    await page.$eval('input[name=ifscCode]', e => { e.value = ''; });
    await page.type('input[name=ifscCode]', 'SBIN0001234');
    await clickText('Save & re-check');
    await clickText('Final review');
    await page.click('#asstDecl');
    await clickText('Confirm and submit');
    ok(await until(() => document.body.innerText.includes('Waiting for the bank')), 'new FDR submitted; waiting for the bank endorsement');
    ok(await page.evaluate(() => DB.fdrs.some(f => f.status === 'UNDER_VERIFICATION' && /^SBI-FDR-/.test(f.fdrNumber) && f.evidence)), 'FDR recorded with its evidence file');

    console.log('\nRequest the portal cannot submit');
    await startNew();
    await clickText('Other regulatory requirement');
    await page.type('#asstText', 'We need a certificate of our deposit history for a state audit.');
    await clickText('Send');
    ok(await until(() => document.body.innerText.includes('Needs human confirmation')), 'destination flagged for human confirmation');
    await tab('review');
    await clickText('Prepare submission package');
    ok(await until(() => document.body.innerText.includes('Ready for submission — not submitted')), 'READY FOR SUBMISSION, clearly not submitted');
    ok(!(await page.$('[data-act=asstSubmit]')), 'no submit button without an authorised channel');

    console.log('\nResume and layout');
    await page.evaluate(() => goTab('dashboard')); await wait(200);
    await clickText('AI Regulatory Assistant');
    const t5 = await text();
    ok((t5.match(/Submitted/g) || []).length >= 2 && t5.includes('Ready for submission'), 'request list shows every request with its status (resume)');
    ok(await noScroll(), 'no horizontal scroll at phone width (390 px)');
    ok(!errs.length, `no script errors${errs.length ? ': ' + errs.join(' | ') : ''}`);
  } catch (e) { failed++; console.error(e); }
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})();
