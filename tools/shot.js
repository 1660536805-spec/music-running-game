const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const target = process.argv[2] || 'http://127.0.0.1:8777/声浪星球.html?showcase=1&freeze=1';
  const out = process.argv[3] || path.join(__dirname, 'shots', 'showcase.png');
  const w = parseInt(process.argv[4] || '1672', 10);
  const h = parseInt(process.argv[5] || '941', 10);

  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROME || undefined,
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader',
           '--ignore-gpu-blocklist', '--enable-gpu-rasterization']
  });
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

  await page.goto(target, { waitUntil: 'load', timeout: 60000 });
  // wait for scenes ready
  await page.waitForTimeout(3500);
  const info = await page.evaluate(() => (window.__info ? window.__info() : null)).catch(() => null);
  await page.screenshot({ path: out });
  console.log('saved', out);
  console.log('info', JSON.stringify(info));
  if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
  await browser.close();
})();
