/* ============================================================================
   mech.js — 运行时机制门禁（M1–M7）｜与 causeway.js / quadcheck.js 并列的第 7 道门禁
   ----------------------------------------------------------------------------
   为什么单列：causeway.js 断言的是「P2–P5 那条单赛道链路」（定帧 / 前进 / 判定 / 镜头 /
   结算），它的 14 个断言块是**金标契约**，机制迭代不应改写它。本脚本只做**增量**断言：
     ① M7 · ChartGen 自证：运行时「机制词汇表」重建默认谱面障碍必须与谱面内嵌
        obstacles 逐字段一致（rapGalactic 125/125）。这是"同一套词汇表驱动预烘焙与运行时两条谱面
        来源"的实现层证据 —— 换一首歌，换的不是曲包，是机制组合。
     ② 曲库注册表：≥2 首、段落数不同 ⇒ "换歌即换关"有可选性。
     ③ 默认路径零漂移：不换歌时曲目上下文 / BGM / 谱面路径必须是金标路径。
     ④ 换歌链路：__cwSong 切到已就绪曲目后，场景仍在 causeway 且谱面重新就位。
     ⑤ 未就绪守门：切到资产生成中的曲目必须被拒绝，且上下文不被污染（未知曲目同样被拒）。
     ⑤a 第二首歌 song2（P3）：7 段结构就绪 + M7 自证（song2 障碍逐字段重建）+ M3 预副歌蓄能
        （同调长按 ⇒ chargeV 上浮、mCharge > 1）+ M4 终曲终结拍（定位 outro 最长长音，
        经 __cwAutoRelease 走真人松手通道命中 ⇒ cadenceHit）。
     ⑤b 运行时机制（P2）：M1 副歌开闸（进副歌 over=1.5 / 出副歌回落）／M2 Drop 俯冲（进 climax
        触发 + 标记段内首个双闸门）／M5 旋律航线（lane 非空 + 同航线 ×1.25）／M6 用跑道弹琴
        （各段音区不同且落在 [−5,7]）。
     ⑤c M5 旋律航线带（P4）：causeway 非定帧下航线带已挂载且段数 = 小节数。
     ⑥ SongSelect 浮层：可由枢纽「选择歌曲」打开、Esc 收起，且不产生 three 对象。
     ⑥b 定帧保护：FREEZE 下航线带不挂载（children 不增，护住 causeway 定帧基线）。
     ⑥c 图鉴 / 设置浮层（P7）：两个枢纽按钮开合正常、图鉴 4 曲 × 7 机制内容完整、
        设置默认值逐位等于现状、开/关浮层前后 draw calls 不变（纯 DOM 硬证据）。
     ⑦ 零 console / pageerror。
   任一不满足 → process.exit(1)。
   用法: node tools/mech.js
   ============================================================================ */
'use strict';
const { chromium } = require('playwright-core');

const URL = 'http://127.0.0.1:8777/%E5%A3%B0%E6%B5%AA%E6%98%9F%E7%90%83.html';
const GOLD = { track: 'rapGalactic', chart: 'assets/rap-galactic-chart.json', bgm: 'assets/rap-galactic.mp3' };

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

  /* ②b 里程归一防复发（P6）：默认曲全曲自然里程必须 ≤ 赛道容量（CW.Z_START − CW.Z_END = 1264m）。
     赛道物理长度是常量；长曲必须靠「按谱面归一速度」压进容量，否则人会停在路尽头、后段障碍悬空。 */
  const CAP = 1264;
  const nat = await page.evaluate(() => {
    const c = window.__cwChart(); if (!c || !c.sections) return null;
    let d = 0;
    for (let i = 0; i < c.sections.length; i++){ const s = c.sections[i]; d += (s.speed || 0) * ((s.t1 || 0) - (s.t0 || 0)); }
    return { dist: d, base: (c.track && c.track.base) || null, dur: c.duration };
  });
  console.log('②b 默认曲里程 = ' + JSON.stringify(nat) + ' / 赛道容量 ' + CAP + 'm');
  ok(nat && nat.dist > 0 && nat.dist <= CAP + 0.01, '②b 默认曲自然里程溢出赛道容量（会停在路尽头）: ' + JSON.stringify(nat));

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
  const sw = await page.evaluate(id => window.__cwSong(id), GOLD.track);
  await page.waitForTimeout(1200);
  const afterSw = await page.evaluate(() => ({ cw: window.__info().cw, cur: window.__info().cur }));
  console.log('__cwSong(' + GOLD.track + ') = ' + JSON.stringify(sw));
  console.log('  → cur=' + afterSw.cur + ' track=' + afterSw.cw.track + ' chart=' + afterSw.cw.chart);
  ok(sw && !sw.error, '④ 切到已就绪曲目被拒: ' + JSON.stringify(sw));
  ok(afterSw.cur === 'causeway', '④ 换歌后未停留在 causeway: ' + afterSw.cur);
  ok(afterSw.cw.track === GOLD.track, '④ 换歌后曲目上下文未更新: ' + afterSw.cw.track);
  ok(afterSw.cw.chart === true, '④ 换歌后谱面未重新就位');

  /* ---------------- ⑤ 未就绪守门 ---------------- */
  console.log('=== ⑤ 未就绪曲目 / 未知曲目守门 ===');
  const notReady = (tracks || []).find(t => !t.ready);
  if (!notReady) {
    console.log('   SKIP 未就绪分支：当前所有曲目均已就绪（P3 起 song2 就绪后本项自动失效）');
  } else {
    const r = await page.evaluate(id => window.__cwSong(id), notReady.id);
    const cwNow = await page.evaluate(() => window.__info().cw);
    console.log('__cwSong(' + notReady.id + ') = ' + JSON.stringify(r) + '  → track=' + cwNow.track);
    ok(r && r.error === 'not-ready', '⑤ 未就绪曲目未被拒绝: ' + JSON.stringify(r));
    ok(cwNow.track === GOLD.track, '⑤ 未就绪守门失败：上下文被污染为 ' + cwNow.track);
    ok(cwNow.chart === true, '⑤ 未就绪守门失败：谱面被清空');
  }
  /* 未知曲目：任何情况下都必须被拒且不污染上下文 */
  const unknown = await page.evaluate(() => window.__cwSong('__nope__'));
  const cwU = await page.evaluate(() => window.__info().cw);
  console.log('__cwSong(__nope__) = ' + JSON.stringify(unknown) + '  → track=' + cwU.track);
  ok(unknown && unknown.error === 'unknown-track', '⑤ 未知曲目未被拒绝: ' + JSON.stringify(unknown));
  ok(cwU.track === GOLD.track, '⑤ 未知曲目守门失败：上下文被污染为 ' + cwU.track);

  /* ---------------- ⑤a 第二首歌 song2：M7 自证 + M3 蓄能 + M4 终结拍 ---------------- */
  console.log('=== ⑤a song2（7 段）· M7 自证 + M3 预副歌蓄能 + M4 终曲终结拍 ===');
  const seek2 = t => page.evaluate(tv => window.__cwSeek(tv), t);
  const mech2 = () => page.evaluate(() => window.__info().cw.mech);
  const sw2 = await page.evaluate(() => window.__cwSong('song2'));
  await page.waitForTimeout(1400);
  const cw2 = await page.evaluate(() => window.__info().cw);
  console.log('__cwSong(song2) = ' + JSON.stringify(sw2) + '  → track=' + cw2.track + ' chart=' + cw2.chart);
  ok(sw2 && !sw2.error, '⑤a 切到 song2 被拒: ' + JSON.stringify(sw2));
  ok(cw2.track === 'song2', '⑤a song2 上下文未生效: ' + cw2.track);
  ok(cw2.chart === true, '⑤a song2 谱面未加载');

  /* M7 自证（song2）：运行时词汇表重建 song2 障碍必须与谱面内嵌 obstacles 逐字段一致 */
  const gen2s = await page.evaluate(() => window.__cwGenCheck());
  console.log('song2 genCheck = ' + JSON.stringify(gen2s));
  ok(gen2s && gen2s.ok === true, '⑤a song2 ChartGen 自证失败: ' +
    (gen2s ? ('got=' + gen2s.got + ' exp=' + gen2s.exp + ' bad=' + JSON.stringify(gen2s.bad)) : 'null'));

  /* 7 段结构 + 「换歌即换关」：song2 的段落种类集合含 causeway 没有的 preChorus / outro */
  const secs2 = await page.evaluate(() => (window.__cwChart() || {}).sections || []);
  const kinds2 = secs2.map(s => s.kind);
  console.log('song2 sections = ' + JSON.stringify(kinds2));
  ok(kinds2.length === 7, '⑤a song2 段落数 ≠ 7: ' + kinds2.length);
  ok(kinds2.includes('preChorus') && kinds2.includes('outro'),
     '⑤a song2 缺 preChorus / outro（7 段结构未落地）: ' + JSON.stringify(kinds2));
  const byKind2 = {}; secs2.forEach(s => { if (!byKind2[s.kind]) byKind2[s.kind] = s; });

  /* M3 预副歌蓄能：进 preChorus + 同调长按 ⇒ chargeV 上浮、mCharge 离开 1（只奖励） */
  const pre2 = byKind2.preChorus;
  if (pre2) {
    await seek2(pre2.t0 + 0.6); await page.waitForTimeout(340);
    const c0 = await mech2();
    console.log('M3 蓄能前 = ' + JSON.stringify({ charge: c0.charge, chargeV: c0.chargeV, chargeMult: c0.chargeMult }));
    ok(c0.charge === true, '⑤a M3 未进入预副歌蓄能窗口: charge=' + c0.charge);
    await page.keyboard.down('Space');
    await page.waitForTimeout(1500);
    const c1 = await mech2();
    await page.keyboard.up('Space');
    console.log('M3 蓄能后 = ' + JSON.stringify({ chargeV: c1.chargeV, chargeMult: c1.chargeMult }));
    ok(c1.chargeV > 0, '⑤a M3 同调长按未蓄能: chargeV=' + c1.chargeV);
    ok(c1.chargeMult > 1, '⑤a M3 蓄能未写入乘区: chargeMult=' + c1.chargeMult);
  } else fails.push('⑤a song2 谱面无 preChorus 段');

  /* M4 终曲终结拍：定位 outro 内最长长音（cadenceIdx ≥ 0）；同调长按至其结束松手 ⇒ 命中 */
  const c0b = await mech2();
  console.log('M4 终结拍定位 = ' + JSON.stringify({ idx: c0b.cadenceIdx, t: c0b.cadenceT }));
  ok(c0b.cadenceIdx >= 0, '⑤a M4 未定位 song2 终结拍: idx=' + c0b.cadenceIdx);
  if (c0b.cadenceIdx >= 0 && c0b.cadenceT != null) {
    await seek2(Math.max(0, c0b.cadenceT - 1.2)); await page.waitForTimeout(320);
    await page.keyboard.down('Space');
    await page.evaluate(t => window.__cwAutoRelease(t), c0b.cadenceT);   /* 到点自动松手（走真人 CWInput.end 通道） */
    await page.waitForTimeout(2400);
    await page.keyboard.up('Space').catch(() => {});
    const c2 = await mech2();
    console.log('M4 终结拍命中 = ' + JSON.stringify({ hit: c2.cadenceHit, mult: c2.cadenceMult }));
    ok(c2.cadenceHit === true, '⑤a M4 终结拍未命中: ' + JSON.stringify(c2));
    ok(c2.cadenceMult > 1, '⑤a M4 终结拍未写入乘区: ' + c2.cadenceMult);
  }

  /* ---------------- ⑤b 运行时机制 M1 / M2 / M5 / M6（P2） ---------------- */
  console.log('=== ⑤b 运行时机制（M1 副歌开闸 / M2 Drop / M5 航线 / M6 弹琴）===');
  await page.evaluate(() => window.__cwSong('superweave'));   /* 确保 causeway 上下文（⑤ / ⑤a 可能切过歌） */
  await page.waitForTimeout(900);
  /* causeway M7 自证：默认曲换说唱后，原 ① 的 180/180 契约改在此处（显式 superweave 上下文）断言 */
  const genCw = await page.evaluate(() => window.__cwGenCheck());
  console.log('causeway genCheck = ' + JSON.stringify(genCw));
  ok(genCw && genCw.ok === true && genCw.exp === 180, '⑤b causeway ChartGen 自证失败: ' + JSON.stringify(genCw));
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

  /* ---------------- ⑤c M5 旋律航线带几何（P4） ---------------- */
  console.log('=== ⑤c M5 旋律航线带（可视化）===');
  const lane3d = await page.evaluate(() => window.__info().cw.lane3d);
  console.log('lane3d = ' + JSON.stringify(lane3d));
  ok(lane3d && lane3d.mounted === true, '⑤c M5 航线带未挂载（causeway 非定帧下应挂载）');
  ok(lane3d && lane3d.bars >= 60, '⑤c M5 航线带段数异常（应为 小节数）: ' + (lane3d && lane3d.bars));

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

  /* ---------------- ⑥b 航线带定帧保护（FREEZE 下不挂载） ---------------- */
  console.log('=== ⑥b M5 航线带 · 定帧保护 ===');
  const fp = await browser.newPage({ viewport: { width: 836, height: 470 }, deviceScaleFactor: 1 });
  await fp.goto(URL + '?scene=causeway&freeze=1', { waitUntil: 'load', timeout: 60000 });
  await fp.waitForTimeout(2600);
  const fl3d = await fp.evaluate(() => (window.__info ? window.__info().cw.lane3d : null));
  const fchildren = await fp.evaluate(() => window.__SCN.causeway.scene.children.length);
  await fp.close();
  console.log('FREEZE lane3d = ' + JSON.stringify(fl3d) + '  causeway children=' + fchildren);
  ok(fl3d && fl3d.mounted === false, '⑥b FREEZE 下航线带仍被挂载（定帧 children 会漂移）');

  /* ---------------- ⑥c 图鉴 / 设置浮层契约（P7 · 纯 DOM · 零 draw call） ----------------
     为什么把断言写在这里：本脚本已是「浮层契约」的既有归属（见 ⑥ SongSelect）。⑥c 只做增量断言：
       · 两个枢纽按钮（▣ 星球图鉴 / ⚙ 设置）确实打开各自浮层，且 Esc 可收；
       · 图鉴内容完整（4 首内置曲 × 7 张机制卡）—— 内容缺失会让"图鉴"退化成空壳；
       · **设置默认值必须逐位等于现状**（sfx 0.5 / bgm 0.60 / 画质 high / 大字关 / 动效开）——
         默认值一旦漂移，"默认设置"本身就等于改门禁基线；
       · **开/关浮层前后 draw calls 不变** —— 这是"纯 DOM、零 three 对象"的硬证据。 */
  console.log('=== ⑥c 图鉴 / 设置浮层 ===');
  const callsBefore = await page.evaluate(() => window.__info().calls);
  const cx = await page.evaluate(() => {
    const b = document.querySelector('.menu button[data-codex]');
    if (!b) return { found: false };
    b.click();
    const el = document.querySelector('#codex');
    const on = !!(el && el.classList.contains('on'));
    const info = (window.__Codex && window.__Codex.info) ? window.__Codex.info() : {};
    return { found: true, on: on, tracks: info.tracks, mechs: info.mechs,
             rowEls: el ? el.querySelectorAll('#codex .tk').length : 0,
             mchEls: el ? el.querySelectorAll('#codex .mch').length : 0 };
  });
  console.log('Codex = ' + JSON.stringify(cx));
  ok(cx.found, '⑥c 枢纽未找到「星球图鉴」按钮');
  ok(cx.on, '⑥c 点击后图鉴浮层未打开');
  ok(cx.tracks === 4, '⑥c 图鉴内置曲目数应为 4: ' + cx.tracks);
  ok(cx.mechs === 7, '⑥c 图鉴机制卡应为 7（M1–M7）: ' + cx.mechs);
  ok(cx.rowEls === 4 && cx.mchEls === 7,
     '⑥c 图鉴 DOM 行数与数据不符（曲目 ' + cx.rowEls + ' / 机制 ' + cx.mchEls + '）');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const cxClosed = await page.evaluate(() => window.__Codex.isOpen());
  ok(!cxClosed, '⑥c Esc 未收起图鉴');

  const st = await page.evaluate(() => {
    const b = document.querySelector('.menu button[data-settings]');
    if (!b) return { found: false };
    b.click();
    const el = document.querySelector('#settings');
    const info = (window.__Settings && window.__Settings.info) ? window.__Settings.info() : {};
    return Object.assign({ found: true, on: !!(el && el.classList.contains('on')),
                           sliders: el ? el.querySelectorAll('#settings input[type=range]').length : 0,
                           sws: el ? el.querySelectorAll('#settings .sw').length : 0 }, info);
  });
  console.log('Settings = ' + JSON.stringify(st));
  ok(st.found && st.on, '⑥c 点击后设置浮层未打开');
  ok(st.sliders === 2, '⑥c 设置应有 2 条音量滑杆: ' + st.sliders);
  ok(st.sws === 3, '⑥c 设置应有 3 个开关（静音 / 大字 / 减弱动效）: ' + st.sws);
  ok(st.bgm === 0.60 && st.sfx === 0.50 && st.quality === 'high'
     && st.big === false && st.motion === true,
     '⑥c 设置默认值必须逐位等于现状（否则等于改门禁基线）: ' + JSON.stringify(st));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const stClosed = await page.evaluate(() => window.__Settings.isOpen());
  ok(!stClosed, '⑥c Esc 未收起设置');

  const callsAfter = await page.evaluate(() => window.__info().calls);
  console.log('draw calls: ' + callsBefore + ' → ' + callsAfter);
  ok(callsAfter === callsBefore,
     '⑥c 开/关浮层改变了 draw calls（应为纯 DOM / 零 three 对象）: ' + callsBefore + ' → ' + callsAfter);
  const ovl = await page.evaluate(() => window.__info().overlays);
  ok(ovl && ovl.codex === false && ovl.settings === false && ovl.songsel === false,
     '⑥c 浮层全部已关，状态应为 false: ' + JSON.stringify(ovl));

  /* ---------------- ⑦ 零报错 ---------------- */
  if (errs.length) { console.log('ERRORS:\n' + errs.join('\n')); fails.push(errs.length + ' 条控制台报错'); }

  console.log(fails.length ? ('\n✗ FAIL\n  - ' + fails.join('\n  - ')) : '\n✓ PASS (mech)');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
