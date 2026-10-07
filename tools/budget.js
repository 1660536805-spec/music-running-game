/* 逐场景统计 draw calls / tris，用于性能预算核对
   用法: tools/budget.js  (需 PW_CHROME / NODE_PATH 环境变量) */
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROME,
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 836, height: 470 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

  const base = 'http://127.0.0.1:8777/%E5%A3%B0%E6%B5%AA%E6%98%9F%E7%90%83.html?scene=';
  for (const k of ['home', 'desert', 'cave', 'base']) {
    await page.goto(base + k + '&freeze=1', { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(2600);
    const info = await page.evaluate(() => (window.__info ? window.__info() : null)).catch(() => null);
    console.log(k.padEnd(7), 'calls=' + (info && info.calls), 'tris=' + (info && info.tris),
      'heroX=' + (info && info[k] && info[k].heroC && info[k].heroC[0]),
      'hPct=' + (info && info[k] && info[k].hPct));
  }
  if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
  await browser.close();
})();
