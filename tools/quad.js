const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const w = 836, h = 470;
  const base = 'http://127.0.0.1:8777/%E5%A3%B0%E6%B5%AA%E6%98%9F%E7%90%83.html';
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROME,
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

  const keys = ['home', 'desert', 'cave', 'base'];
  for (const k of keys) {
    await page.goto(base + '?scene=' + k + '&freeze=1', { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(2600);
    const info = await page.evaluate(() => (window.__info ? window.__info() : null)).catch(() => null);
    await page.screenshot({ path: path.join('/Users/leo/WorkBuddy/腾讯黑客松/out', k + '.png') });
    console.log('=== ' + k + ' ===');
    console.log(JSON.stringify(info && info[k]));
  }
  if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
  await browser.close();
})();
