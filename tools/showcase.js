const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const w = 1672, h = 941;
  const base = 'http://127.0.0.1:8777/%E5%A3%B0%E6%B5%AA%E6%98%9F%E7%90%83.html';
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROME,
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

  // 1) showcase 2x2 split
  await page.goto(base + '?showcase=1&freeze=1', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(3200);
  const info = await page.evaluate(() => (window.__info ? window.__info() : null)).catch(() => null);
  await page.screenshot({ path: '/Users/leo/WorkBuddy/腾讯黑客松/out/showcase.png' });
  console.log('=== showcase ===');
  console.log('calls=' + (info && info.calls) + ' tris=' + (info && info.tris));

  // 2) single home at full acceptance resolution (HUD check)
  await page.goto(base + '?scene=home&freeze=1', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: '/Users/leo/WorkBuddy/腾讯黑客松/out/full_home.png' });

  if (errs.length) console.log('ERRORS:\n' + errs.join('\n')); else console.log('no console errors');
  await browser.close();
})();
