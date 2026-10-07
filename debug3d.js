const { chromium } = require('/Users/leo/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const URL = 'http://127.0.0.1:8777/' + encodeURIComponent('声浪星球-3D原型.html');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, { timeout: 90000 });
  await page.waitForTimeout(400);

  const info = await page.evaluate(() => {
    // 找到场景与 hero
    const out = { hero: null, cam: null, candidates: [] };
    let sc = null;
    // three 场景可通过渲染器拿不到，改为遍历：从 __debug 钩子拿
    return window.__dbg ? window.__dbg() : { note: 'no __dbg hook' };
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
