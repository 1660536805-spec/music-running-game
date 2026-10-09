/* P8 · 声浪画廊视觉核对：causeway 非定帧，seek 到指定时刻后截图
   用法: node tools/shot_gallery.js [t1,t2,...]   (需 PW_CHROME / NODE_PATH) */
'use strict';
const { chromium } = require('playwright-core');
const path = require('path');

const OUT = '/Users/leo/WorkBuddy/腾讯黑客松/out';
const URL = 'http://127.0.0.1:8777/%E5%A3%B0%E6%B5%AA%E6%98%9F%E7%90%83.html?scene=causeway&dbg=1';

(async () => {
  const times = (process.argv[2] || '4,26,52,72').split(',').map(Number);
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROME,
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2600);
  await page.mouse.click(640, 400);          /* 手势：解锁音频 */
  await page.waitForTimeout(400);

  for (const t of times) {
    await page.evaluate(tt => window.__cwSeek(tt), t).catch(() => {});
    await page.waitForTimeout(1100);
    const g = await page.evaluate(() => window.__info().cw.gallery).catch(() => null);
    const lens = await page.evaluate(() => window.__info().cw.lens).catch(() => null);
    console.log('t=' + t, 'gallery=' + JSON.stringify(g), 'lens=' + (lens && lens.lens));
    await page.screenshot({ path: path.join(OUT, 'gallery-t' + String(t).replace('.', '_') + '.png') });
  }
  if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
  await browser.close();
})();
