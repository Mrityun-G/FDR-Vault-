// Hindi interface: coverage report (untranslated UI strings per screen), layout at narrow widths, language switching.
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const BASE = (process.env.APP_URL || 'http://127.0.0.1:8765') + '/index.html';
const OUT = path.join(__dirname, '..', 'output', 'hindi');
fs.mkdirSync(OUT, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) failed++; };

// Visible English text nodes that are UI, not data (data: ids, numbers, names, codes, emails, dates).
const LEFTOVER = () => {
  const out = new Set();
  const w = document.createTreeWalker(document.querySelector('#app'), NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const n = w.currentNode, el = n.parentElement, t = n.nodeValue.replace(/\s+/g, ' ').trim();
    if (!t || !/[a-z]{3,}/.test(t) || el.closest('[translate="no"], .mono, .letter, script, style')) continue;
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
    if (/@|^APP-|^[A-Z]{2,}[-\/]|^PID|^₹|\d{4}-\d{2}|^www\.|^SHA|RULE-|Clause|Appendix|Institute|College|Academy|Dr\.|Prof\.|Shri|Bank|Delhi|Bangalore|Pune|Karnataka|Maharashtra|Region$|Regional Office|Northern|Western|Southern/.test(t)) continue;
    out.add(t);
  }
  return [...out];
};

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--disable-gpu', ...(process.env.BLOCK_WEBFONTS ? ['--host-resolver-rules=MAP fonts.gstatic.com ~NOTFOUND'] : [])] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });

  console.log('Language switch');
  await page.click('[data-act=toggleLang]'); await wait(400);
  const ob = await page.evaluate(() => ({ lang: document.documentElement.lang, text: document.body.innerText }));
  ok(ob.lang === 'hi' && ob.text.includes('अखिल भारतीय तकनीकी शिक्षा परिषद') && ob.text.includes('शुरू करें') === false && ob.text.includes('आगे'), 'onboarding switches to Hindi instantly');
  await page.screenshot({ path: path.join(OUT, '01-onboarding.png') });

  const report = {};
  const visit = async (name, q) => {
    await page.goto(BASE + q, { waitUntil: 'networkidle0' }); await wait(500);
    report[name] = await page.evaluate(LEFTOVER);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  };
  await visit('splash', '?x=1');
  await visit('login', '?x=2&screen=login');
  await visit('dashboard', '?demo=dits');
  await visit('apptype', '?demo=dits&screen=apptype');
  for (const st of [1, 2, 3, 4]) await visit(`wizard-${st}`, `?demo=dits&screen=wizard&type=NEW_PROGRAMME&step=${st}`);
  await visit('ai', '?demo=dits&screen=ai&type=EOA&step=4');
  await wait(4500); report.ai = await page.evaluate(LEFTOVER); await page.screenshot({ path: path.join(OUT, 'ai.png') });
  await visit('review', '?demo=dits&screen=review&type=EOA&step=4');
  await visit('apps', '?demo=dits&screen=apps');
  await visit('appDetail', '?demo=dits&screen=appDetail&id=app-1');
  await visit('fdrs', '?demo=dits&screen=fdrs');
  await visit('fdrDetail', '?demo=dits&screen=fdrDetail&id=fdr-d1');
  await visit('alerts', '?demo=dits&screen=alerts');
  await visit('profile', '?demo=dits&screen=profile');

  console.log('\nUntranslated UI text by screen (data such as names, numbers and codes excluded):');
  let total = 0;
  for (const [k, v] of Object.entries(report)) { total += v.length; console.log(`  ${k} (${v.length}): ${v.slice(0, 40).join(' | ')}`); }
  fs.writeFileSync(path.join(OUT, 'leftovers.json'), JSON.stringify(report, null, 1));

  console.log('\nLayout in Hindi');
  for (const [w, h] of [[320, 568], [390, 844]]) {
    await page.setViewport({ width: w, height: h, isMobile: true });
    await page.goto(BASE + '?y=' + w, { waitUntil: 'networkidle0' }); await page.evaluate(() => { localStorage.clear(); localStorage.setItem('aicte-lang', 'hi'); });
    await page.reload({ waitUntil: 'networkidle0' }); await wait(400);
    const m = await page.evaluate(() => { const c = document.querySelector('.content'); return { x: c.scrollWidth - c.clientWidth, y: c.scrollHeight - c.clientHeight }; });
    ok(m.x <= 0, `${w}x${h}: no horizontal overflow`);
    ok(m.y <= 24, `${w}x${h}: onboarding fits (overflow ${m.y}px)`);
    await page.screenshot({ path: path.join(OUT, `onboarding-${w}.png`) });
  }
  await page.goto(BASE + '?demo=dits&screen=profile', { waitUntil: 'networkidle0' }); await wait(300);
  await page.evaluate(() => [...document.querySelectorAll('[data-act=toggleLang]')].find(b => b.offsetParent).click()); await wait(400);
  ok(await page.evaluate(() => document.documentElement.lang === 'en' && document.body.innerText.includes('Profile & Settings')), 'switching back restores English');
  ok(errs.length === 0, `no JS errors ${errs.join(' | ')}`);
  await browser.close();
  console.log(`\n${total} untranslated UI string(s) total`);
  console.log(failed ? `${failed} check(s) failed` : 'HINDI CHECKS PASSED');
  process.exit(failed ? 1 : 0);
})();
