// Onboarding layout + interaction checks at common phone sizes (demo mode).
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, '..', 'output', 'onboard');
fs.mkdirSync(OUT, { recursive: true });
const SIZES = [[320, 568], [360, 740], [375, 667], [375, 812], [390, 844], [430, 932]];
const URL0 = (process.env.APP_URL || 'http://127.0.0.1:8765') + '/index.html';
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--disable-gpu', ...(process.env.BLOCK_WEBFONTS ? ['--host-resolver-rules=MAP fonts.gstatic.com ~NOTFOUND'] : [])] });
  let failed = 0;
  const check = (ok, msg) => { console.log(`  ${ok ? '✓' : '✗'} ${msg}`); if (!ok) failed++; };
  for (const [w, h] of SIZES) {
    console.log(`\n${w}x${h}`);
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(URL0, { waitUntil: 'networkidle0' });
    await wait(300);
    const m = await page.evaluate(() => {
      const r = s => document.querySelector(s).getBoundingClientRect();
      const c = document.querySelector('.content');
      const img = document.querySelector('.building-image'), logo = document.querySelector('.ob-logo');
      const vis = ['.ob-brand', '.ob-carousel', '.ob-figure', '.splash-actions'].map(s => r(s));
      let overlap = false;
      for (let i = 1; i < vis.length; i++) if (vis[i].top < vis[i - 1].bottom - 0.5) overlap = true;
      const btns = [...document.querySelectorAll('.splash-actions .btn')].map(b => b.getBoundingClientRect());
      return {
        docOverflowX: document.documentElement.scrollWidth - window.innerWidth,
        contentOverflowX: c.scrollWidth - c.clientWidth, contentOverflowY: c.scrollHeight - c.clientHeight,
        fill: [...document.querySelectorAll('.ob-shot')].every(sh => { const a = sh.getBoundingClientRect(), b = sh.querySelector('img').getBoundingClientRect(), f = r('.ob-figure'); return Math.abs(a.width - f.width) < 1 && Math.abs(a.height - f.height) < 1 && Math.abs(b.width - a.width) < 1 && Math.abs(b.height - a.height) < 1; }),
        imgLoaded: [...document.querySelectorAll('.building-image')].every(i => i.complete && i.naturalWidth > 0 && getComputedStyle(i).objectFit === 'cover'), logo: logo.complete && getComputedStyle(logo).objectFit === 'contain',
        overlap, btns: btns.map(b => [Math.round(b.width), Math.round(b.height)]), skip: (b => ({ width: b.width, height: b.height }))(r('.ob-skip')),
        nextLabel: document.querySelector('#obNext').textContent.trim(),
      };
    });
    check(m.docOverflowX <= 0 && m.contentOverflowX <= 0, `no horizontal overflow`);
    check(m.contentOverflowY <= 0, `fits without vertical scroll (overflow ${m.contentOverflowY}px)`);
    check(m.imgLoaded && m.fill, 'Delhi & Mumbai photos loaded, each fills the frame (cover, no distortion/gaps)');
    check(m.logo, 'logo sharp (object-fit contain)');
    check(!m.overlap, 'sections do not overlap');
    check(m.btns.every(b => b[1] >= 48 && b[0] === m.btns[0][0]), `buttons equal width, ≥48px tall`);
    check(m.skip.height >= 40 && m.skip.width >= 48, 'Skip is a comfortable touch target');
    check(m.nextLabel.startsWith('Next'), 'first slide shows Next');
    await page.screenshot({ path: path.join(OUT, `${w}x${h}.png`) });

    if (w === 390) {
      await page.bringToFront();
      const pos = () => page.evaluate(() => { const f = document.querySelector('.ob-figure').getBoundingClientRect(); const m = document.querySelector('.ob-shot[data-city*="Mumbai"]').getBoundingClientRect(); return { left: Math.round(m.left - f.left), w: Math.round(f.width), cap: document.querySelector('#obCity').textContent.trim() }; });
      const p0 = await pos();
      check(/Delhi/.test(p0.cap) && p0.left <= -p0.w + 1, `launch shows Delhi; Mumbai waits off-frame on the left (${p0.left}px)`);
      const trace = await page.evaluate(() => new Promise(res => {
        const f = document.querySelector('.ob-figure'), out = [], t0 = performance.now();
        const tick = () => {
          const m = document.querySelector('.ob-shot[data-city*="Mumbai"]').getBoundingClientRect();
          out.push({ t: Math.round(performance.now() - t0), left: Math.round(m.left - f.getBoundingClientRect().left), cap: document.querySelector('#obCity').textContent.trim() });
          if (performance.now() - t0 < 5200) requestAnimationFrame(tick); else res(out);
        };
        tick();
      }));
      const moving = trace.filter(x => x.left > -p0.w + 2 && x.left < -2);
      const rightward = moving.every((x, k) => k === 0 || x.left >= moving[k - 1].left);
      check(moving.length >= 5 && rightward, `Mumbai glides in left → right (${moving.length} frames, ${moving[0] ? moving[0].left : '?'} → ${moving.length ? moving[moving.length - 1].left : '?'} px)`);
      const shown = trace.find(x => /Mumbai/.test(x.cap));
      check(trace.some(x => /Mumbai/.test(x.cap) && Math.abs(x.left) <= 1), 'Mumbai fully in view, caption updated');
      await page.screenshot({ path: path.join(OUT, '390-mumbai.png') });
      const p3 = await page.evaluate(() => new Promise(res => { const t0 = performance.now(); const tick = () => { const f = document.querySelector('.ob-figure').getBoundingClientRect(); const d = document.querySelector('.ob-shot[data-city*="Delhi"]').getBoundingClientRect(); const c = document.querySelector('#obCity').textContent.trim(); if ((/Delhi/.test(c) && Math.abs(d.left - f.left) <= 1) || performance.now() - t0 > 5000) res({ left: Math.round(d.left - f.left), cap: c }); else requestAnimationFrame(tick); }; tick(); }));
      check(Math.abs(p3.left) <= 1 && /Delhi/.test(p3.cap), 'then Delhi returns from the left — continuous loop');
    }
    await page.click('#obNext'); await wait(800);
    check(await page.evaluate(() => document.querySelector('#dots .on') === document.querySelectorAll('#dots button')[1]), 'Next advances to slide 2');
    await page.click('#dots button:nth-child(3)'); await wait(800);
    const last = await page.evaluate(() => ({ label: document.querySelector('#obNext').textContent.trim(), skip: getComputedStyle(document.querySelector('#obSkip')).visibility }));
    check(last.label.startsWith('Get Started') && last.skip === 'hidden', 'final slide shows Get Started, hides Skip');
    if (w === 390) await page.screenshot({ path: path.join(OUT, `${w}-final.png`) });
    await page.click('#obNext'); await wait(300);
    check(await page.evaluate(() => !!document.querySelector('form[data-form=register]')), 'Get Started → Register');
    await page.goBack(); await wait(400);
    await page.click('[data-act=legal][data-v=privacy]'); await wait(300);
    check(await page.evaluate(() => /Privacy Policy/.test(document.querySelector('#sheet').textContent)), 'Privacy Policy opens');
    await page.click('#sheet .sheet-head [data-act=closeSheet]'); await wait(200);
    await page.click('[data-act=legal][data-v=terms]'); await wait(200);
    check(await page.evaluate(() => /Terms of Use/.test(document.querySelector('#sheet').textContent)), 'Terms of Use opens');
    await page.click('#sheet .sheet-head [data-act=closeSheet]'); await wait(200);
    await page.click('[data-act=legal][data-v=help]'); await wait(200);
    check(await page.evaluate(() => /Regulation Bureau IT Cell/.test(document.querySelector('#sheet').textContent)), 'Help & Support opens');
    await page.click('#sheet .sheet-head [data-act=closeSheet]'); await wait(200);
    await page.click('#obSkip'); await wait(300);
    check(await page.evaluate(() => !!document.querySelector('form[data-form=login]')), 'Skip → Login');
    await page.reload({ waitUntil: 'load', timeout: 60000 }); await wait(600);
    check(await page.evaluate(() => !!document.querySelector('form[data-form=login]') && !document.querySelector('.ob')), 'onboarding remembered: next launch opens Login');
    await page.click('[data-act=showIntro]'); await wait(300);
    check(await page.evaluate(() => !!document.querySelector('.ob')), 'Introduction link re-opens onboarding');
    check(errs.length === 0, `no JS errors ${errs.join('; ')}`);
    await ctx.close();
  }

  console.log('\nImage failure fallback');
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.setRequestInterception(true);
  page.on('request', r => (/delhi\.webp|mumbai\.webp|emblem\.png/.test(r.url()) ? r.abort() : r.continue()));
  await page.goto(URL0, { waitUntil: 'networkidle0' }); await wait(400);
  const fb = await page.evaluate(() => ({ fig: document.querySelectorAll('.ob-shot.failed').length === 2, logo: !!document.querySelector('.ob-logo-fallback') }));
  check(fb.fig && fb.logo, 'broken building/logo images show graceful fallbacks');
  await page.screenshot({ path: path.join(OUT, 'fallback.png') });
  console.log('Reduced motion');
  const ctx2 = await browser.createBrowserContext(); const p2 = await ctx2.newPage();
  await p2.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p2.setViewport({ width: 390, height: 844, isMobile: true });
  await p2.goto(URL0, { waitUntil: 'networkidle0' }); await wait(4500);
  check(/Delhi/.test(await p2.evaluate(() => document.querySelector('#obCity').textContent)), 'slideshow stays still when reduced motion is requested');
  await browser.close();
  console.log(failed ? `\n${failed} check(s) failed` : '\nALL CHECKS PASSED');
  process.exit(failed ? 1 : 0);
})();
