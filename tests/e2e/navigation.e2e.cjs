// Back and Refresh controls, unsaved-form protection and phone-width layout (demo mode).
// Run:  npm run serve:demo   (terminal 1)   then   npm run test:e2e:navigation
const puppeteer = require('puppeteer-core');
const BASE = (process.env.APP_URL || 'http://127.0.0.1:8765') + '/index.html';
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) failed++; };

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--disable-gpu'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const text = () => page.evaluate(() => document.body.innerText);
  const route = () => page.evaluate(() => currentRoute());
  const act = sel => page.evaluate(s => { const el = [...document.querySelectorAll(s)].find(e => e.offsetParent !== null); el.click(); }, sel);
  const clickText = t => page.evaluate(t => { const el = [...document.querySelectorAll('button, a')].find(e => e.offsetParent !== null && e.textContent.replace(/\s+/g, ' ').includes(t)); el.click(); }, t);
  const open = async q => { await page.goto(BASE + q, { waitUntil: 'networkidle0' }); await page.evaluate(() => { const s = document.querySelector('#sheet'); s.classList.remove('open'); s.innerHTML = ''; DB.acked[me().id] = true; }); };

  console.log('Back button');
  await open('?demo=dits');
  ok(!(await page.$('.hdr [data-act=back]')), 'no Back on a bottom-tab root screen (dashboard)');
  await act('[data-tab=fdrs]'); await wait(300);
  await clickText('SBI-FDR'); await wait(300);
  ok(await route() === 'fdrDetail' && !!(await page.$('.hdr [data-act=back]')), 'deposit details shows a Back button');
  await act('.hdr [data-act=back]'); await wait(400);
  ok(await route() === 'fdrs', 'Back returns to the FDR list');
  await clickText('SBI-FDR'); await wait(300);
  await page.goBack(); await wait(400);
  ok(await route() === 'fdrs', 'browser Back also returns to the FDR list');
  await open('?demo=dits&screen=appDetail&id=app-1');
  const before = page.url();
  await act('.hdr [data-act=back]'); await wait(400);
  ok(['dashboard', 'apps'].includes(await route()) && page.url().startsWith(before.split('?')[0]), `opened directly: Back goes to a parent page inside the app (${await route()})`);

  console.log('\nUnsaved form protection');
  await open('?demo=dits&screen=fdrNew');
  await page.type('input[name=fdrNumber]', 'HDFC-FDR-55501-2026');
  await act('.hdr [data-act=back]'); await wait(300);
  ok((await text()).includes('Leave this screen?'), 'Back on a changed form asks before leaving');
  await clickText('Keep editing'); await wait(300);
  ok(await route() === 'fdrNew' && await page.$eval('input[name=fdrNumber]', e => e.value) === 'HDFC-FDR-55501-2026', 'Keep editing stays with the typed value intact');
  await act('.hdr [data-act=back]'); await wait(300);
  await clickText('Leave without saving'); await wait(400);
  ok(await route() !== 'fdrNew', 'Leave without saving navigates back');
  await open('?demo=dits&screen=fdrNew');
  await act('.hdr [data-act=back]'); await wait(400);
  ok(!(await text()).includes('Leave this screen?') && await route() !== 'fdrNew', 'an untouched form leaves without a prompt');
  await open('?demo=dits');
  await clickText('New Application'); await wait(300);
  await clickText('Extension of Approval'); await wait(300);
  await page.$eval('textarea[name="inst.address"]', el => { el.value = 'Plot 7, Sector 21, Dwarka'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await act('.hdr [data-act=back]'); await wait(300);
  ok((await text()).includes('Save draft & leave'), 'leaving the application wizard offers to save a draft');
  await clickText('Save draft & leave'); await wait(800);
  ok(await route() === 'apptype' && await page.evaluate(() => myApps().some(a => a.status === 'DRAFT' && a.draft.inst.address.includes('Dwarka'))), 'draft saved with the typed address, then Back completes');

  console.log('\nRefresh button');
  await open('?demo=dits&screen=apps');
  await clickText('Under Review'); await wait(200);
  await page.type('[data-live=appsSearch]', 'APP'); await wait(200);
  await page.evaluate(() => { const b = Backend.refresh; Backend.refresh = async () => { await new Promise(r => setTimeout(r, 300)); return b.call(Backend); }; });
  await act('.fv-refresh');
  await wait(120);
  ok(await page.$eval('.fv-refresh', b => b.classList.contains('spinning') && b.getAttribute('aria-busy') === 'true'), 'icon spins while refreshing');
  await act('.fv-refresh');   // a second tap while running is ignored
  await wait(900);
  const after = await page.evaluate(() => ({ spin: !!document.querySelector('.fv-refresh.spinning'), filter: UI.appsFilter, q: document.querySelector('[data-live=appsSearch]').value, t: document.body.innerText }));
  ok(!after.spin && /Updated \d/.test(after.t), 'spinner stops and an "Updated hh:mm" confirmation appears');
  ok(after.filter === 'REVIEW' && after.q === 'APP', 'filter and search text are kept');
  await page.evaluate(() => { Backend.refresh = () => Promise.reject(new Error('Network down')); });
  await wait(3400);
  await act('.fv-refresh'); await wait(800);
  ok((await text()).includes('Could not refresh') && !(await page.$('.fv-refresh.spinning')), 'a failed refresh shows an error and stops the spinner');
  for (const [q, name] of [['?demo=dits', 'dashboard'], ['?demo=dits&screen=fdrs', 'FDR list'], ['?demo=dits&screen=alerts', 'notifications'], ['?demo=dits&screen=fdrDetail&id=fdr-d1', 'deposit details'], ['?demo=dits&screen=appDetail&id=app-1', 'application details']]) {
    await open(q);
    ok(!!(await page.$('.fv-refresh')), `${name} has a Refresh button`);
  }
  await open('?demo=dits&screen=fdrNew');
  ok(!(await page.$('.fv-refresh')), 'form-only screens have no Refresh');

  console.log('\nPhone widths');
  for (const w of [320, 375, 390, 430]) {
    await page.setViewport({ width: w, height: 800, isMobile: true, hasTouch: true });
    let bad = [];
    for (const q of ['?demo=dits', '?demo=dits&screen=apps', '?demo=dits&screen=fdrs', '?demo=dits&screen=alerts', '?demo=dits&screen=profile', '?demo=dits&screen=fdrDetail&id=fdr-d1', '?demo=dits&screen=appDetail&id=app-1']) {
      await open(q);
      const m = await page.evaluate(() => {
        const c = document.querySelector('.content'), h1 = document.querySelector('.hdr h1');
        const btns = [...document.querySelectorAll('.hdr button')].map(b => b.getBoundingClientRect());
        const overlap = h1 ? btns.some(r => { const t = h1.getBoundingClientRect(); return r.left < t.right - 1 && r.right > t.left + 1 && t.width > 0; }) : false;
        return { x: document.documentElement.scrollWidth - innerWidth, cx: c.scrollWidth - c.clientWidth, overlap, small: btns.some(r => r.width < 40 || r.height < 40) };
      });
      if (m.x > 0 || m.cx > 0 || m.overlap || m.small) bad.push(`${q} ${JSON.stringify(m)}`);
    }
    ok(!bad.length, `${w}px: no horizontal overflow, header buttons ≥40px and clear of the title${bad.length ? ' — ' + bad.join(' | ') : ''}`);
  }
  ok(errs.length === 0, `no JS errors ${errs.join(' | ')}`);
  await browser.close();
  console.log(failed ? `\n${failed} check(s) failed` : '\nNAVIGATION CHECKS PASSED');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
