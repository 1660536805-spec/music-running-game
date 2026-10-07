// 渲染 声浪星球-3D原型.html（CC0 资产版）在 5 个歌曲段落下的画面
const { chromium } = require('/Users/leo/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const path = require('path');

const URL = 'http://127.0.0.1:8777/' + encodeURIComponent('声浪星球-3D原型.html');
const OUT = path.resolve(__dirname, 'shots');
const SHOTS = [
  { pct: 3,  name: '00-start', desc: '俯冲降落（开场）' },
  { pct: 30, name: '01-low',   desc: '贴地跟随（主歌）' },
  { pct: 56, name: '02-high',  desc: '拉高俯瞰（副歌）' },
  { pct: 81, name: '03-drop',  desc: '环绕飞行（Drop）' },
  { pct: 98, name: '04-final', desc: '绕星球环拍（尾声）' },
];

(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl',
           '--ignore-gpu-blocklist', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('requestfailed', (r) => console.log('[reqfail]', r.url().split('/').pop(), r.failure() && r.failure().errorText));

  await page.goto(URL, { waitUntil: 'load' });

  // 等待所有 glb 加载完成
  await page.waitForFunction(() => window.__ready === true, { timeout: 90000 });
  console.log('assets ready');
  await page.waitForTimeout(600);

  await page.click('#startBtn');
  await page.waitForTimeout(300);

  for (const s of SHOTS) {
    await page.waitForFunction(
      (goal) => parseInt(document.getElementById('progressTxt').textContent, 10) >= goal,
      s.pct, { timeout: 120000 }
    );
    const prog = await page.evaluate(() => document.getElementById('progressTxt').textContent);
    await page.screenshot({ path: path.join(OUT, s.name + '.png') });
    console.log(`saved ${s.name}.png  target=${s.pct}%  actual=${prog}  (${s.desc})`);
  }

  await browser.close();
  console.log('done');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
