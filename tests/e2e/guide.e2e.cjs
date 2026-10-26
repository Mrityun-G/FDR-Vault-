// FDR Vault Guide (built-in help chat): opens inside the app, answers questions, "Take me there", tour, fit.
// Run:  npm run serve:demo   (terminal 1)   then   npm run test:e2e:guide
const puppeteer = require('puppeteer-core');
const path = require('path');
const BASE = (process.env.APP_URL || 'http://127.0.0.1:8765') + '/index.html';
const OUT = path.join(__dirname, '..', 'output');
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) failed++; };

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--disable-gpu'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(BASE + '?demo=dits&guide=1', { waitUntil: 'networkidle0' });
  await page.evaluate(() => { const s = document.querySelector('#sheet'); s.classList.remove('open'); s.innerHTML = ''; DB.acked[me().id] = true; });
  const log = () => page.evaluate(() => document.querySelector('.gd-log').innerText);
  const ask = async q => { await page.type('.gd-form input', q); await page.click('.gd-form button'); await wait(400); };
  const clickChip = t => page.evaluate(t => [...document.querySelectorAll('.gd-acts button')].reverse().find(b => b.textContent.includes(t)).click(), t);

  const fab = await page.evaluate(() => { const f = document.querySelector('.gd-fab'), a = document.getElementById('app').getBoundingClientRect(), r = f.getBoundingClientRect(); return { inApp: f.parentElement.id === 'app', inside: r.right <= a.right && r.bottom <= a.bottom, w: r.width, aboveTabs: r.bottom <= document.querySelector('.tabbar').getBoundingClientRect().top + 1 }; });
  ok(fab.inApp && fab.inside && fab.aboveTabs && fab.w >= 44, 'guide button sits inside the app screen, above the tab bar, 44px+ touch target');
  await page.click('.gd-fab'); await wait(500);
  ok(await page.evaluate(() => document.querySelector('.gd-panel').classList.contains('open')) && (await log()).includes('FDR Vault Guide'), 'opens with a greeting');
  ok(await page.evaluate(() => document.activeElement === document.querySelector('.gd-form input')), 'question box is focused');
  await ask('How do I renew my FDR?');
  ok((await log()).includes('FDR renewal and replacement'), 'answers "How do I renew my FDR?" from the knowledge base');
  await ask('which technology is used');
  const tech = await log();
  ok(tech.includes('PostgreSQL') && !/Supabase/i.test(tech), 'technology answer describes the current Node.js + PostgreSQL backend');
  await ask('qwerty zxcv');
  ok((await log()).includes('I’m not sure about that one'), 'unknown question gets topic suggestions instead of a wrong answer');
  await ask('how to submit a new application');
  await clickChip('Take me there'); await wait(500);
  ok(await page.evaluate(() => currentRoute()) === 'apptype' && !(await page.evaluate(() => document.querySelector('.gd-panel').classList.contains('open'))), '"Take me there" opens the matching screen and closes the guide');
  await page.click('.gd-fab'); await wait(300);
  await clickChip('Start the 5-minute tour'); await wait(300);
  await clickChip('Next step'); await wait(300);
  ok((await log()).includes('Step 2'), 'guided tour advances step by step');
  const fit = await page.evaluate(() => { const p = document.querySelector('.gd-panel').getBoundingClientRect(), a = document.getElementById('app').getBoundingClientRect(), l = document.querySelector('.gd-log'); return { same: Math.abs(p.width - a.width) < 2 && Math.abs(p.height - a.height) < 2, x: l.scrollWidth - l.clientWidth }; });
  ok(fit.same && fit.x <= 0, 'panel fills exactly the app screen with no horizontal overflow');
  await page.screenshot({ path: path.join(OUT, 'guide.png') });
  await page.keyboard.press('Escape'); await wait(200);
  ok(!(await page.evaluate(() => document.querySelector('.gd-panel').classList.contains('open'))), 'Escape closes the guide');
  await page.goto(BASE + '?demo=dits', { waitUntil: 'networkidle0' });
  ok(!(await page.$('.gd-fab')), 'automated tests run without the guide unless ?guide=1');
  ok(errs.length === 0, `no JS errors ${errs.join(' | ')}`);
  await browser.close();
  console.log(failed ? `\n${failed} check(s) failed` : '\nGUIDE CHECKS PASSED');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
