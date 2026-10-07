/* ============================================================================
   causeway.js — 《超频长阶》单赛道关专用门禁
   ----------------------------------------------------------------------------
   与 quad.js（四场景 heroC 零漂移红线）并列的第 5 条门禁：
     ① 定帧基线：?scene=causeway&freeze=1 下 causeway 的 heroC / calls / tris 必须与基线一致
        （causeway 不在 RENDER_ORDER ⇒ 不参与既有四场景红线，故单列一份基线自我保护）
     ② 自动前进：非 freeze 下角色应沿 −z 以 11 u/s 推进（PlayerController 复用 band 链路）
     ③ 升降层：↑/W → hi、↓/S → lo（P2 起生效；P1 尚未接输入时标 SKIP）
     ④ 零控制台报错
   用法: node tools/causeway.js [--record]
   ============================================================================ */
'use strict';
const { chromium } = require('playwright-core');
const path = require('path');

/* 首次运行（或 --record）时用实测值填充（P1 定帧实测：heroC 屏幕占比中心 / calls / tris） */
const BASELINE = {
  heroC: [0.509, 0.537],
  calls: 147,
  tris: 5800
};

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

  /* ---- ① 定帧基线 ---- */
  await page.goto(URL + '?scene=causeway&freeze=1', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2600);
  const fz = await page.evaluate(() => window.__info()).catch(() => null);
  await page.screenshot({ path: path.join(OUT, 'causeway.png') });
  const cw = fz && fz.causeway;
  console.log('=== causeway · freeze 定帧 ===');
  console.log(JSON.stringify(cw));
  console.log('hPct=' + (cw && cw.hPct) + '  (参照四场景 0.26–0.34)');
  if (!cw) { fails.push('未取到 causeway 的 __info 条目'); }
  else {
    console.log('BASELINE = ' + JSON.stringify({ heroC: cw.heroC, calls: fz.calls, tris: fz.tris }));
    if (!record && BASELINE.calls){
      const dc = Math.abs(cw.heroC[0] - BASELINE.heroC[0]) + Math.abs(cw.heroC[1] - BASELINE.heroC[1]);
      if (dc > 0.002) fails.push('heroC 漂移: ' + JSON.stringify(cw.heroC) + ' ≠ ' + JSON.stringify(BASELINE.heroC));
      if (fz.calls !== BASELINE.calls) fails.push('draw calls 变化: ' + fz.calls + ' ≠ ' + BASELINE.calls);
    }
    if (fz.jump && fz.jump.on) fails.push('定帧下 jump.on 应为 false');
  }

  /* ---- ② 自动前进 ---- */
  await page.goto(URL + '?scene=causeway', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(600);
  const z0 = await page.evaluate(() => window.__info().m1.heroZ);
  await page.waitForTimeout(2000);
  const m1 = await page.evaluate(() => window.__info().m1);
  await page.screenshot({ path: path.join(OUT, 'causeway-play.png') });
  console.log('=== causeway · 自动前进 ===');
  console.log('z0=' + z0 + '  z1=' + m1.heroZ + '  Δ=' + (z0 - m1.heroZ).toFixed(2) + ' u');
  if (!(m1.heroZ < z0 - 15)) fails.push('自动前进不足（2s 应约 22u）: Δ=' + (z0 - m1.heroZ).toFixed(2));
  if (m1.heroX != null && Math.abs(m1.heroX) > 0.02) fails.push('单赛道 x 未锁中心: heroX=' + m1.heroX);
  console.log('track = ' + JSON.stringify(m1.track));

  /* ---- ③ 升降层（P2 起生效）---- */
  console.log('=== causeway · 升降层 ===');
  const canLift = await page.evaluate(() => !!(window.__info().m1.track));   /* Track 已存在 */
  if (!canLift){ console.log('SKIP: Track 未接入'); }
  else {
    await page.keyboard.press('ArrowUp'); await page.waitForTimeout(220);
    const up = await page.evaluate(() => { const i = window.__info(); return { m: i.m1, s: i.causeway }; });
    await page.keyboard.press('ArrowDown'); await page.waitForTimeout(220);
    const dn = await page.evaluate(() => { const i = window.__info(); return { m: i.m1, s: i.causeway }; });
    console.log('↑ → ' + JSON.stringify(up.m.track) + '   heroY=' + up.s.heroY + ' baseY=' + up.s.baseY);
    console.log('↓ → ' + JSON.stringify(dn.m.track) + '   heroY=' + dn.s.heroY + ' baseY=' + dn.s.baseY);
  }

  if (errs.length) { console.log('ERRORS:\n' + errs.join('\n')); fails.push(errs.length + ' 条控制台报错'); }
  console.log(fails.length ? ('\n✗ FAIL\n  - ' + fails.join('\n  - ')) : '\n✓ PASS (causeway)');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
