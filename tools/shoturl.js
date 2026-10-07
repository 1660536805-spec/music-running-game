/* 通用定帧渲染：指定 html 文件名 → 四场景 ?freeze=1 截图到指定目录
   用法: node tools/_shoturl.js <文件名.html> <输出目录>  (需 PW_CHROME / NODE_PATH) */
const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const file = process.argv[2];
  const outdir = process.argv[3];
  const w = 836, h = 470;
  const base = 'http://127.0.0.1:8777/' + encodeURIComponent(file) + '?scene=';
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROME,
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  for (const k of ['home', 'desert', 'cave', 'base']) {
    await page.goto(base + k + '&freeze=1', { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(2600);
    const info = await page.evaluate(() => (window.__info ? window.__info() : null)).catch(() => null);
    await page.screenshot({ path: path.join(outdir, k + '.png') });
    console.log(k.padEnd(7), 'heroC=' + JSON.stringify(info && info[k] && info[k].heroC));
  }
  if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
  await browser.close();
})();
