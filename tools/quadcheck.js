/* ============================================================================
   quadcheck.js — 四场景 heroC 零漂移「断言门禁」（quad.js 的记录器升级版）
   ----------------------------------------------------------------------------
   背景：quad.js 只打印 + 截图，无内嵌基线、无容差、无 exit 码，四场景红线靠人工比对。
   本脚本把该比对自动化，作为与 causeway.js 并列的第 6 道门禁：
     ① 四场景 ?scene=<k>&freeze=1 下 heroC 必须与 M1 基线**逐位一致**（容差 0）
     ② 逐场景 draw calls 必须低于性能红线（home/desert < 700 · cave < 1900 · base < 1000）
     ③ 零 console / pageerror
   任一不满足 → process.exit(1)。
   基线出处：docs/声浪星球-游戏设计方案.md:979 / docs/声浪星球-跑酷音游-开发文档.md:105,157
   用法: node tools/quadcheck.js            # 断言模式
        node tools/quadcheck.js --record    # 只打印实测（用于重定标，不判失败）
   ============================================================================ */
'use strict';
const { chromium } = require('playwright-core');
const path = require('path');

/* 四场景 heroC 基线（屏幕占比中心 NDC；容差 0 = 逐位一致）+ calls 红线 */
const SCENES = [
  { k: 'home',   heroC: [0.551, 0.712], callsMax: 700  },
  { k: 'desert', heroC: [0.512, 0.762], callsMax: 700  },
  { k: 'cave',   heroC: [0.373, 0.635], callsMax: 1900 },
  { k: 'base',   heroC: [0.397, 0.766], callsMax: 1000 }
];
const OUT = '/Users/leo/WorkBuddy/腾讯黑客松/out';
const URL = 'http://127.0.0.1:8777/%E5%A3%B0%E6%B5%AA%E6%98%9F%E7%90%83.html';

(async () => {
  const record = process.argv.includes('--record');
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROME,
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 836, height: 470 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  const fails = [];

  for (const s of SCENES) {
    await page.goto(URL + '?scene=' + s.k + '&freeze=1', { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(2600);
    const full = await page.evaluate(() => (window.__info ? window.__info() : null)).catch(() => null);
    const e = full && full[s.k];
    await page.screenshot({ path: path.join(OUT, s.k + '.png') });

    console.log('=== ' + s.k + ' ===');
    if (!e) { console.log('  (未取到 __info 条目)'); fails.push(s.k + ': 未取到 __info 条目'); continue; }

    const hc = e.heroC, calls = full.calls, tris = full.tris;
    console.log('  heroC=' + JSON.stringify(hc) + '  hPct=' + e.hPct + '  calls=' + calls + '  tris=' + tris);

    if (record) {
      console.log('  [record] BASELINE = ' + JSON.stringify({ heroC: hc, calls: calls }));
      continue;
    }

    /* ① heroC 逐位一致（容差 0） */
    if (!hc || hc.length < 2) { fails.push(s.k + ': heroC 缺失'); }
    else if (hc[0] !== s.heroC[0] || hc[1] !== s.heroC[1]) {
      fails.push(s.k + ': heroC 漂移 ' + JSON.stringify(hc) + ' ≠ ' + JSON.stringify(s.heroC));
    }
    /* ② calls 红线 */
    if (calls >= s.callsMax) fails.push(s.k + ': draw calls ' + calls + ' 触红线 (≥' + s.callsMax + ')');
  }

  if (errs.length) { fails.push('控制台报错:\n' + errs.join('\n')); }

  console.log('');
  if (record) { console.log('RECORD 模式：仅打印实测，不判失败。'); }
  else if (fails.length) {
    console.log('RESULT: FAIL (' + fails.length + ')');
    fails.forEach(f => console.log('  ✗ ' + f));
    await browser.close();
    process.exit(1);
  } else {
    console.log('RESULT: PASS — 四场景 heroC 逐位一致，calls 均低于红线，零报错。');
  }
  await browser.close();
})();
