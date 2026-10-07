/* M3-OP 换道冒烟：自动前进 + 键盘/指针换道 + 越界软墙
   用法: node tools/_lanetest.js  (需 PW_CHROME / NODE_PATH) */
const { chromium } = require('playwright-core');

(async () => {
  const base = 'http://127.0.0.1:8777/%E5%A3%B0%E6%B5%AA%E6%98%9F%E7%90%83.html';
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROME,
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  const m1 = () => page.evaluate(() => window.__info().m1);

  await page.goto(base + '?scene=desert', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(600);
  const a = await m1();
  console.log('A init      lane=' + JSON.stringify(a.lane) + '  heroX=' + a.heroX + ' heroZ=' + a.heroZ + ' stopped=' + a.stopped);

  await page.waitForTimeout(400);
  const b = await m1();
  console.log('B +400ms    heroZ=' + b.heroZ + '  autoForward=' + (b.heroZ < a.heroZ) + '  speed=' + a.autoSpeed);

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(60);
  const c = await m1();
  await page.waitForTimeout(260);
  const d = await m1();
  console.log('C +60ms(键)  lane=' + JSON.stringify(c.lane));
  console.log('D +320ms(键) lane=' + JSON.stringify(d.lane) + '  heroX=' + d.heroX + '  switched+1=' + (d.lane.target === a.lane.target + 1));

  for (let i = 0; i < 6; i++){ await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150); }
  const e = await m1();
  console.log('E 越界边界   lane=' + JSON.stringify(e.lane));

  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(320);
  const e2 = await m1();
  console.log('E2 左移一步  lane=' + JSON.stringify(e2.lane) + '  heroX=' + e2.heroX);

  await page.mouse.click(1200, 700);   /* 右半区轻点 */
  await page.waitForTimeout(60);
  const f = await m1();
  await page.waitForTimeout(280);
  const g = await m1();
  console.log('F +60ms(指针) lane=' + JSON.stringify(f.lane));
  console.log('G +340ms(指针) lane=' + JSON.stringify(g.lane));

  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors');
  await browser.close();
})();
