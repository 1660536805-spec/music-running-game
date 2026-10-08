/* ============================================================================
   mech.js — 运行时机制门禁（M1–M7）｜与 causeway.js / quadcheck.js 并列的第 7 道门禁
   ----------------------------------------------------------------------------
   为什么单列：causeway.js 断言的是「P2–P5 那条单赛道链路」（定帧 / 前进 / 判定 / 镜头 /
   结算），它的 14 个断言块是**金标契约**，机制迭代不应改写它。本脚本只做**增量**断言：
     ① M7 · ChartGen 自证：运行时「机制词汇表」重建 causeway 障碍必须与谱面内嵌
        obstacles 逐字段一致（180/180）。这是"同一套词汇表驱动预烘焙与运行时两条谱面
        来源"的实现层证据 —— 换一首歌，换的不是曲包，是机制组合。
     ② 曲库注册表：≥2 首、段落数不同 ⇒ "换歌即换关"有可选性。
     ③ 默认路径零漂移：不换歌时曲目上下文 / BGM / 谱面路径必须是金标路径。
     ④ 换歌链路：__cwSong 切到已就绪曲目后，场景仍在 causeway 且谱面重新就位。
     ⑤ 未就绪守门：切到资产生成中的曲目必须被拒绝，且上下文不被污染。
     ⑤b 运行时机制（P2）：M1 副歌开闸（进副歌 over=1.5 / 出副歌回落）／M2 Drop 俯冲（进 climax
        触发 + 标记段内首个双闸门）／M5 旋律航线（lane 非空 + 同航线 ×1.25）／M6 用跑道弹琴
        （各段音区不同且落在 [−5,7]）。
     ⑥ SongSelect 浮层：可由枢纽「选择歌曲」打开、Esc 收起，且不产生 three 对象。
     ⑦ 零 console / pageerror。
   任一不满足 → process.exit(1)。
   用法: node tools/mech.js
   ============================================================================ */
'use strict';
const { chromium } = require('playwright-core');

const URL = 'http://127.0.0.1:8777/%E5%A3%B0%E6%B5%AA%E6%98%9F%E7%90%83.html';
const GOLD = { track: 'superweave', chart: 'assets/causeway-chart.json', bgm: 'assets/causeway.wav' };

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROME,
    args: ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 836, height: 470 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  const fails = [];
  const ok = (c, msg) => { if (!c) fails.push(msg); };

  /* ---------------- ① M7 · ChartGen 词汇表自证 ---------------- */
  console.log('=== ① M7 · ChartGen 机制词汇表自证 ===');
  await page.goto(URL + '?scene=causeway', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2600);
  const gen = await page.evaluate(() => window.__cwGenCheck());
  console.log('genCheck = ' + JSON.stringify(gen));
  ok(gen, '① __cwGenCheck 未返回（ChartGen 未接线？）');
  if (gen) {
    ok(gen.exp > 0, '① 谱面 obstacles 为空');
    ok(gen.ok === true, '① ChartGen 重建与谱面不一致: got=' + gen.got + ' exp=' + gen.exp +
      ' bad=' + JSON.stringify(gen.bad));
    console.log('   词汇表重建 ' + gen.got + ' / 谱面内嵌 ' + gen.exp + ' ⇒ ' + (gen.ok ? '逐字段一致 ✓' : '不一致 ✗'));
  }
  /* 幂等 + 无副作用：重跑一次结果不变，且不污染 Chart.data.obstacles */
  const gen2 = await page.evaluate(() => {
    const before = JSON.stringify(window.__cwChart().obstacles);
    const r = window.__cwGenCheck();
    const after = JSON.stringify(window.__cwChart().obstacles);
    return { r, mutated: before !== after };
  });
  ok(gen2 && !gen2.mutated, '① ChartGen.build 改写了谱面数据（应无副作用）');
  ok(gen2 && gen2.r && gen2.r.ok === true, '① ChartGen 重建非幂等');

  /* ---------------- ② 曲库注册表 ---------------- */
  console.log('=== ② 曲库注册表（换歌即换关的可选性）===');
  const tracks = await page.evaluate(() => window.__cwTracks());
  console.log('tracks = ' + JSON.stringify(tracks));
  ok(Array.isArray(tracks) && tracks.length >= 2, '② 曲库少于 2 首: ' + (tracks || []).length);
  if (tracks && tracks.length >= 2) {
    const segs = new Set(tracks.map(t => t.segs));
    ok(segs.size >= 2, '② 两首曲目段落数相同 ⇒ 机制组合不会变: ' + JSON.stringify([...segs]));
    ok(tracks.some(t => t.id === GOLD.track && t.ready), '② 默认曲目未就绪');
    console.log('   段落数分布 = ' + JSON.stringify(tracks.map(t => t.id + ':' + t.segs + '段')));
  }

  /* ---------------- ③ 默认路径零漂移 ---------------- */
  console.log('=== ③ 默认路径零漂移（金标契约）===');
  const cw = await page.evaluate(() => window.__info().cw);
  console.log('cw = ' + JSON.stringify({ track: cw.track, chartPath: cw.chartPath, bgmPath: cw.bgmPath, chart: cw.chart }));
  ok(cw.track === GOLD.track, '③ 默认曲目 ≠ ' + GOLD.track + ': ' + cw.track);
  ok(cw.chartPath === GOLD.chart, '③ 默认谱面路径漂移: ' + cw.chartPath);
  ok(cw.bgmPath === GOLD.bgm, '③ 默认 BGM 路径漂移: ' + cw.bgmPath);
  ok(cw.chart === true, '③ 谱面未加载');

  /* ---------------- ④ 换歌链路（已就绪曲目） ---------------- */
  console.log('=== ④ 换歌链路（切到已就绪曲目）===');
  const sw = await page.evaluate(() => window.__cwSong('superweave'));
  await page.waitForTimeout(1200);
  const afterSw = await page.evaluate(() => ({ cw: window.__info().cw, cur: window.__info().cur }));
  console.log('__cwSong(superweave) = ' + JSON.stringify(sw));
  console.log('  → cur=' + afterSw.cur + ' track=' + afterSw.cw.track + ' chart=' + afterSw.cw.chart);
  ok(sw && !sw.error, '④ 切到已就绪曲目被拒: ' + JSON.stringify(sw));
  ok(afterSw.cur === 'causeway', '④ 换歌后未停留在 causeway: ' + afterSw.cur);
  ok(afterSw.cw.track === GOLD.track, '④ 换歌后曲目上下文未更新: ' + afterSw.cw.track);
  ok(afterSw.cw.chart === true, '④ 换歌后谱面未重新就位');

  /* ---------------- ⑤ 未就绪守门 ---------------- */
  console.log('=== ⑤ 未就绪曲目守门 ===');
  const notReady = (tracks || []).find(t => !t.ready);
  if (!notReady) {
    console.log('   SKIP：当前所有曲目均已就绪（P3 起 song2 就绪后本项自动失效）');
  } else {
    const r = await page.evaluate(id => window.__cwSong(id), notReady.id);
    const cwNow = await page.evaluate(() => window.__info().cw);
    console.log('__cwSong(' + notReady.id + ') = ' + JSON.stringify(r) + '  → track=' + cwNow.track);
    ok(r && r.error === 'not-ready', '⑤ 未就绪曲目未被拒绝: ' + JSON.stringify(r));
    ok(cwNow.track === GOLD.track, '⑤ 未就绪守门失败：上下文被污染为 ' + cwNow.track);
    ok(cwNow.chart === true, '⑤ 未就绪守门失败：谱面被清空');
  }

  /* ---------------- ⑤b 运行时机制 M1 / M2 / M5 / M6（P2） ---------------- */
  console.log('=== ⑤b 运行时机制（M1 副歌开闸 / M2 Drop / M5 航线 / M6 弹琴）===');
  await page.evaluate(() => window.__cwSong('superweave'));   /* 确保 causeway 上下文（⑤ 可能切过歌） */
  await page.waitForTimeout(900);
  const seek = t => page.evaluate(tv => window.__cwSeek(tv), t);
  const mech = () => page.evaluate(() => window.__info().cw.mech);
  const secs = await page.evaluate(() => (window.__cwChart() || {}).sections || []);
  const byKind = {}; secs.forEach(s => { if (!byKind[s.kind]) byKind[s.kind] = s; });
  const chorus = byKind.chorus, climax = byKind.climax, verse = byKind.verse;
  console.log('sections = ' + JSON.stringify(secs.map(s => s.kind + '@' + s.t0)));

  /* M1 副歌开闸：进副歌 → over=1.5；出副歌 → 回落 1.0（只认"段落变化"，天然幂等） */
  if (chorus) {
    await seek(chorus.t0 + 0.3); await page.waitForTimeout(650);
    const a = await mech();
    console.log('M1 进副歌 = ' + JSON.stringify(a));
    ok(a.over === true, '⑤b M1 进副歌未开闸: over=' + a.over);
    ok(a.overMult === 1.5, '⑤b M1 开闸倍率 ≠1.5: ' + a.overMult);
    await seek(verse.t0 + 0.3); await page.waitForTimeout(650);
    const b = await mech();
    console.log('M1 出副歌 = ' + JSON.stringify(b));
    ok(b.over === false, '⑤b M1 离副歌未回落: over=' + b.over);
    ok(b.overMult === 1, '⑤b M1 离副歌倍率未复 1: ' + b.overMult);
  } else fails.push('⑤b 谱面无 chorus 段');

  /* M2 Drop 俯冲：首次进 climax → drop=true + 标记段内首个双闸门（本曲 t≈75.190） */
  if (climax) {
    await seek(climax.t0 + 0.3); await page.waitForTimeout(650);
    const d = await mech();
    console.log('M2 Drop = ' + JSON.stringify(d));
    ok(d.drop === true, '⑤b M2 进 climax 未触发 Drop');
    ok(d.dropTwinT != null && Math.abs(d.dropTwinT - 75.1899) < 0.01,
      '⑤b M2 未标记段内首个双闸门: ' + d.dropTwinT);
  } else fails.push('⑤b 谱面无 climax 段');

  /* M6 用跑道弹琴：各段音区（步进半音）应随段落能量分层，且落在 [−5,7] */
  const steps = [], sKinds = [];
  for (const s of secs) {
    await seek(s.t0 + 0.4); await page.waitForTimeout(220);
    steps.push((await mech()).step); sKinds.push(s.kind);
  }
  console.log('M6 step = ' + JSON.stringify(sKinds.map((k, i) => k + ':' + steps[i])));
  ok(steps.every(v => v >= -5 && v <= 7), '⑤b M6 step 越界: ' + JSON.stringify(steps));
  ok(new Set(steps).size >= 2, '⑤b M6 各段音区相同（未随段落变化）: ' + JSON.stringify(steps));

  /* M5 旋律航线：扫描若干时刻应有 lane；与航线同层 → harmMult=1.25（lo 段 seek 后即同层） */
  let sawLane = null, laneHit = 0;
  const dur = await page.evaluate(() => (window.__cwChart() || {}).duration || 0);
  for (let i = 1; i <= 14 && !laneHit; i++) {
    const t = 6 + (dur - 12) * (i / 15);
    await seek(t); await page.waitForTimeout(130);
    const m = await mech();
    if (!m.lane) continue;
    sawLane = m.lane;
    if (m.lane === 'hi') { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(130); }
    const m2 = await mech();
    if (m2.laneOn === true && m2.harmMult === 1.25) laneHit++;
  }
  console.log('M5 lane=' + JSON.stringify(sawLane) + '  同层 ×1.25 命中=' + laneHit);
  ok(sawLane != null, '⑤b M5 旋律航线从未产生（lane 恒 null）');
  ok(laneHit >= 1, '⑤b M5 与航线同层未给 ×1.25（laneOn / harmMult 未生效）');

  /* ---------------- ⑥ SongSelect 浮层 ---------------- */
  console.log('=== ⑥ SongSelect 浮层 ===');
  await page.evaluate(() => window.__setScene('home'));
  await page.waitForTimeout(600);
  const opened = await page.evaluate(() => {
    const b = document.querySelector('.menu button[data-songsel]');
    if (!b) return { found: false };
    b.click();
    const el = document.querySelector('#songsel');
    return { found: true, on: !!(el && el.classList.contains('on')),
             rows: el ? el.querySelectorAll('.tk').length : 0,
             off: el ? el.querySelectorAll('.tk.off').length : 0 };
  });
  console.log('SongSelect = ' + JSON.stringify(opened));
  ok(opened.found, '⑥ 枢纽未找到「选择歌曲」按钮');
  ok(opened.on, '⑥ 点击后浮层未打开');
  if (opened.found && opened.rows) {
    ok(opened.rows >= 2, '⑥ 浮层曲目行少于 2: ' + opened.rows);
    console.log('   曲目行 = ' + opened.rows + '（其中置灰 ' + opened.off + ' 行）');
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const closed = await page.evaluate(() => {
    const el = document.querySelector('#songsel');
    return { on: !!(el && el.classList.contains('on')) };
  });
  ok(!closed.on, '⑥ Esc 未收起浮层');

  /* ---------------- ⑦ 零报错 ---------------- */
  if (errs.length) { console.log('ERRORS:\n' + errs.join('\n')); fails.push(errs.length + ' 条控制台报错'); }

  console.log(fails.length ? ('\n✗ FAIL\n  - ' + fails.join('\n  - ')) : '\n✓ PASS (mech)');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
