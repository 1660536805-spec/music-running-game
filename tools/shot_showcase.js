/* 专辑展示页 · 响应式截图核对
   用法: node tools/shot_showcase.js            → 桌面 1440x900 + 移动 390x844
         node tools/shot_showcase.js 1920x1080  → 自定义视口(可多组,空格分隔)
   需 PW_CHROME / NODE_PATH ; 服务必须用 tools/serve.py（带 Range）：http://127.0.0.1:8781/ */
'use strict';
const { chromium } = require('playwright-core');
const path = require('path');

const OUT = '/Users/leo/WorkBuddy/腾讯黑客松/out';
/* 必须走 tools/serve.py（带 Range）的端口：否则 <audio> 无 seekable 区间，跳转无效 */
const BASE = process.env.SHOW_BASE || 'http://127.0.0.1:8781';
const URL = BASE + '/%E5%A3%B0%E6%B5%AA%E6%98%9F%E7%90%83-%E4%B8%93%E8%BE%91%E5%B1%95%E7%A4%BA.html';
const SEEN = [8, 42, 76, 120];   /* 观察时刻：前奏 / 主歌 / 预副歌 / 副歌 */

(async () => {
  const vps = (process.argv[2] || '1440x900,390x844').split(/[\s,]+/).filter(Boolean).map(s => {
    const [w, h] = s.split('x').map(Number); return { w, h };
  });
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROME,
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
           '--autoplay-policy=no-user-gesture-required']
  });

  for (const vp of vps) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
    page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(1400);
    const tag = vp.w + 'x' + vp.h;
    await page.screenshot({ path: path.join(OUT, 'show-' + tag + '-boot.png') });

    await page.click('#go').catch(() => {});
    await page.waitForTimeout(1600);

    for (const t of SEEN) {
      await page.evaluate(tt => window.__Showcase.seek(tt), t).catch(() => {});
      await page.waitForTimeout(1300);
      const i = await page.evaluate(() => window.__Showcase.info()).catch(e => ({ err: String(e) }));
      console.log('[' + tag + '] t=' + t + ' ' + JSON.stringify(i));
      await page.screenshot({ path: path.join(OUT, 'show-' + tag + '-t' + t + '.png') });
    }

    /* 超出/溢出检测：是否有元素把页面撑出视口 */
    const over = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll('#world *').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > innerWidth + 2 || r.bottom > innerHeight + 2 || r.left < -2 || r.top < -2)) {
          bad.push((el.id || el.className) + ' @' + Math.round(r.left) + ',' + Math.round(r.top) +
                   ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
        }
      });
      return { scrollH: document.documentElement.scrollHeight, innerH: innerHeight, bad: bad.slice(0, 12) };
    });
    console.log('[' + tag + '] overflow ' + JSON.stringify(over));
    if (errs.length) console.log('[' + tag + '] ERRORS:\n' + errs.join('\n'));
    else console.log('[' + tag + '] console clean');
    await page.close();
  }
  await browser.close();
})();
