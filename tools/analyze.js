/* ============================================================================
   analyze.js — P5 运行时音频分析器门禁｜与 causeway.js / mech.js 并列的第 8 道门禁
   ----------------------------------------------------------------------------
   为什么单列：mech.js 断言的是「预烘焙谱面」那条链路（金标契约）。本脚本只做**增量**断言：
     ① 默认路径零漂移：不换歌时曲目 / 谱面 / BGM 路径必须是金标路径（先跑，防污染）。
     ② M7 自证回归：golden causeway 谱面 ChartGen 重建仍须 180/180（P5 未破坏词汇表契约）。
     ③ 确定性：__analyze('assets/song2.wav') 双次 ⇒ 谱面 JSON 逐字节一致（P5 的核心承诺）；
        且估出的 BPM 须落在真值 112 ± 8 内（证明 tempo 检测有效，而非恒定值）。
     ④ 上传链路：__useUser ⇒ 停留在 causeway、曲目上下文 = user、谱面重新就位（消费端零改动）。
     ⑤ 运行时谱面完整性：段落 ≥5 且含 preChorus / outro；障碍 >0；__cwGenCheck() 自洽；
        __info().cw 快照字段 sane（section 非空 / obs.total > 0 / duration > 0）。
     ⑥ M3 预副歌蓄能：运行时谱面里同调长按 ⇒ chargeV 上浮、chargeMult > 1（只奖励）。
     ⑦ M4 终结拍：运行时谱面 outro 内最长长音可定位（cadenceIdx ≥ 0）；同调长按至其结束松手 ⇒ 命中。
     ⑧ M5 旋律航线：航线带已挂载且段数 >0；扫描出 lane 且与航线同层 ⇒ harmMult = 1.25。
        声浪画廊（P8）：运行时谱面下画廊同样挂载、诗行行位 = 7。
     ⑨ M1 / M2 机制：运行时谱面进副歌 ⇒ over=1.5；进高潮 ⇒ drop=true（换歌即换关的机制层证据）。
     ⑩ 定帧只读：FREEZE 页面下航线带与声浪画廊均不挂载（护住 causeway 定帧基线）。
     ⑪ 零 console / pageerror。
   任一不满足 → process.exit(1)。
   用法: node tools/analyze.js
   ============================================================================ */
'use strict';
const { chromium } = require('playwright-core');

const URL = 'http://127.0.0.1:8777/%E5%A3%B0%E6%B5%AA%E6%98%9F%E7%90%83.html';
const GOLD = { track: 'rapGalactic', chart: 'assets/rap-galactic-chart.json', bgm: 'assets/rap-galactic.mp3' };
const SAMPLE = 'assets/song2.wav';       /* 本地样本；真实歌压力测试样本另行本地留档（gitignore） */
const SAMPLE_BPM = 112;

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

  await page.goto(URL + '?scene=causeway', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2600);

  /* ---------------- ① 默认路径零漂移（先跑，防后续污染判断） ---------------- */
  console.log('=== ① 默认路径零漂移（金标契约）===');
  const cw0 = await page.evaluate(() => window.__info().cw);
  console.log('default cw = ' + JSON.stringify({ track: cw0.track, chartPath: cw0.chartPath, bgmPath: cw0.bgmPath, chart: cw0.chart }));
  ok(cw0.track === GOLD.track, '① 默认曲目 ≠ ' + GOLD.track + ': ' + cw0.track);
  ok(cw0.chartPath === GOLD.chart, '① 默认谱面路径漂移: ' + cw0.chartPath);
  ok(cw0.bgmPath === GOLD.bgm, '① 默认 BGM 路径漂移: ' + cw0.bgmPath);
  ok(cw0.chart === true, '① 谱面未加载');
  /* 上传入口：浮层为惰性创建 ⇒ 先 open()（内部 render→ensure）再读 info，随后收起 */
  const ssinfo = await page.evaluate(() => {
    window.__SongSelect.open();
    const i = window.__SongSelect.info();
    window.__SongSelect.close();
    return i;
  });
  console.log('SongSelect.info = ' + JSON.stringify(ssinfo));
  ok(ssinfo && ssinfo.upload === true, '① SongSelect 上传入口未接线（隐藏 file input 缺失）');

  /* ---------------- ② M7 自证回归（默认谱面 = rapGalactic） ---------------- */
  console.log('=== ② M7 词汇表自证回归（默认谱面）===');
  const gen0 = await page.evaluate(() => window.__cwGenCheck());
  console.log('default genCheck = ' + JSON.stringify(gen0));
  ok(gen0 && gen0.ok === true && gen0.exp === 125, '② 默认谱面自证回归失败（rapGalactic 应为 125 障碍）: ' + JSON.stringify(gen0));

  /* ---------------- ③ 确定性：双次分析逐字节一致 ---------------- */
  console.log('=== ③ 确定性（双次分析逐字节一致）+ tempo 有效性 ===');
  const a1 = await page.evaluate(u => window.__analyze(u, 'song2'), SAMPLE);
  const a2 = await page.evaluate(u => window.__analyze(u, 'song2'), SAMPLE);
  ok(a1 && a1.chart, '③ __analyze 未返回谱面: ' + JSON.stringify(a1));
  ok(a2 && a2.chart, '③ __analyze 第二次未返回谱面');
  if (a1 && a1.chart && a2 && a2.chart) {
    const same = JSON.stringify(a1.chart) === JSON.stringify(a2.chart);
    console.log('analyze#1 = ' + JSON.stringify({ bpm: a1.bpm, bars: a1.bars, sections: a1.sections, kinds: a1.kinds, obstacles: a1.obstacles }));
    console.log('确定性命中: 双次 JSON 逐字节一致 = ' + same + '  (bytes=' + JSON.stringify(a1.chart).length + ')');
    ok(same, '③ 双次分析结果不一致（分析器不确定 ⇒ 门禁不可复现）');
    ok(Math.abs(a1.bpm - SAMPLE_BPM) <= 8, '③ 估出 BPM 偏离真值过大: ' + a1.bpm + '（真值 ' + SAMPLE_BPM + '）');
    ok(a1.bars > 0 && a1.obstacles > 0, '③ 谱面退化: bars=' + a1.bars + ' obstacles=' + a1.obstacles);
    ok(Array.isArray(a1.kinds) && a1.kinds.includes('preChorus') && a1.kinds.includes('outro'),
       '③ 运行时段落缺 preChorus / outro: ' + JSON.stringify(a1.kinds));
  }

  /* ---------------- ④ 上传链路（端到端） ---------------- */
  console.log('=== ④ 上传链路（__useUser → causeway 运行时谱面）===');
  const useRes = await page.evaluate(u => window.__useUser(u, 'song2.wav'), SAMPLE);
  await page.waitForTimeout(1200);
  console.log('__useUser = ' + JSON.stringify(useRes));
  ok(useRes && !useRes.error, '④ 上传分析失败: ' + JSON.stringify(useRes));
  const cw1 = await page.evaluate(() => window.__info());
  console.log('  → cur=' + cw1.cur + ' track=' + cw1.cw.track + ' chart=' + cw1.cw.chart + ' bgmPath=' + cw1.cw.bgmPath);
  ok(cw1.cur === 'causeway', '④ 上传后未停留在 causeway: ' + cw1.cur);
  ok(cw1.cw.track === 'user', '④ 曲目上下文未切到 user: ' + cw1.cw.track);
  ok(cw1.cw.chart === true, '④ 上传后谱面未就位');
  ok(cw1.cw.chartPath === GOLD.chart, '④ 运行时谱面不应改写 chartPath（应仍走 Chart.set 注入）: ' + cw1.cw.chartPath);

  /* ---------------- ⑤ 运行时谱面完整性 ---------------- */
  console.log('=== ⑤ 运行时谱面完整性（段构 / 自洽 / 快照）===');
  const chart = await page.evaluate(() => window.__cwChart());
  const kinds = (chart.sections || []).map(s => s.kind);
  console.log('sections = ' + JSON.stringify((chart.sections || []).map(s => s.kind + '@' + s.t0 + ' E' + s.energy + ' d' + s.density)));
  console.log('top-level keys = ' + JSON.stringify(Object.keys(chart)));
  ok((chart.sections || []).length >= 5, '⑤ 运行时段落数 <5: ' + kinds.length);
  ok(kinds.includes('preChorus') && kinds.includes('outro'), '⑤ 运行时段落缺 preChorus / outro: ' + JSON.stringify(kinds));
  ok((chart.obstacles || []).length > 0, '⑤ 运行时障碍为空');
  ok(chart.melody && chart.melody.slope && chart.melody.slope.length > 0, '⑤ 运行时谱面缺 melody.slope（M5 航线段）');
  ok(chart.sustains && chart.sustains.length > 0, '⑤ 运行时谱面缺 sustains（M4 长音）');
  ok(chart.lensCues && chart.lensCues.every(c => c.bar % 4 === 0), '⑤ lensCues 未落在 4 小节线');
  const genR = await page.evaluate(() => window.__cwGenCheck());
  console.log('runtime genCheck = ' + JSON.stringify(genR));
  ok(genR && genR.ok === true, '⑤ 运行时谱面 ChartGen 自证失败: ' + JSON.stringify(genR));
  const snap = await page.evaluate(() => window.__info().cw);
  console.log('cw snapshot = ' + JSON.stringify({ section: snap.section, songT: snap.songT, energy: snap.energy,
    obs: snap.obs, chart: snap.chart, audio: snap.audio }));
  ok(snap.section != null, '⑤ 运行时谱面未落在任何段落（section 为空）');
  ok(snap.obs && snap.obs.total > 0, '⑤ 障碍总数异常: ' + JSON.stringify(snap.obs));

  /* ---------------- ⑥ / ⑦ M3 蓄能 + M4 终结拍 ---------------- */
  const seek = t => page.evaluate(tv => window.__cwSeek(tv), t);
  const mech = () => page.evaluate(() => window.__info().cw.mech);
  const byKind = {}; (chart.sections || []).forEach(s => { if (!byKind[s.kind]) byKind[s.kind] = s; });

  console.log('=== ⑥ M3 预副歌蓄能（运行时谱面）===');
  const pre = byKind.preChorus;
  if (pre) {
    await seek(pre.t0 + 0.6); await page.waitForTimeout(340);
    const c0 = await mech();
    console.log('蓄能前 = ' + JSON.stringify({ charge: c0.charge, chargeV: c0.chargeV, chargeMult: c0.chargeMult }));
    ok(c0.charge === true, '⑥ M3 未进入预副歌蓄能窗口: charge=' + c0.charge);
    await page.keyboard.down('Space');
    await page.waitForTimeout(1500);
    const c1 = await mech();
    await page.keyboard.up('Space');
    console.log('蓄能后 = ' + JSON.stringify({ chargeV: c1.chargeV, chargeMult: c1.chargeMult }));
    ok(c1.chargeV > 0, '⑥ M3 同调长按未蓄能: chargeV=' + c1.chargeV);
    ok(c1.chargeMult > 1, '⑥ M3 蓄能未写入乘区: chargeMult=' + c1.chargeMult);
  } else fails.push('⑥ 运行时谱面无 preChorus 段');

  console.log('=== ⑦ M4 终曲终结拍（运行时谱面）===');
  const c0b = await mech();
  console.log('终结拍定位 = ' + JSON.stringify({ idx: c0b.cadenceIdx, t: c0b.cadenceT }));
  ok(c0b.cadenceIdx >= 0, '⑦ M4 未定位运行时终结拍: idx=' + c0b.cadenceIdx);
  if (c0b.cadenceIdx >= 0 && c0b.cadenceT != null) {
    await seek(Math.max(0, c0b.cadenceT - 1.2)); await page.waitForTimeout(320);
    await page.keyboard.down('Space');
    await page.evaluate(t => window.__cwAutoRelease(t), c0b.cadenceT);
    await page.waitForTimeout(2400);
    await page.keyboard.up('Space').catch(() => {});
    const c2 = await mech();
    console.log('终结拍命中 = ' + JSON.stringify({ hit: c2.cadenceHit, mult: c2.cadenceMult }));
    ok(c2.cadenceHit === true, '⑦ M4 终结拍未命中: ' + JSON.stringify(c2));
    ok(c2.cadenceMult > 1, '⑦ M4 终结拍未写入乘区: ' + c2.cadenceMult);
  }

  /* ---------------- ⑧ M5 旋律航线（运行时谱面） ---------------- */
  console.log('=== ⑧ M5 旋律航线（运行时谱面）===');
  const lane3d = await page.evaluate(() => window.__info().cw.lane3d);
  console.log('lane3d = ' + JSON.stringify(lane3d));
  ok(lane3d && lane3d.mounted === true, '⑧ M5 航线带未挂载（运行时谱面下应挂载）');
  ok(lane3d && lane3d.bars > 0, '⑧ M5 航线带段数异常: ' + (lane3d && lane3d.bars));
  /* ⑧ 声浪画廊（P8）：运行时谱面同样要挂载（上传任意歌 ⇒ 有声浪诗行，消费端零改动） */
  const galA = await page.evaluate(() => window.__info().cw.gallery);
  console.log('gallery = ' + JSON.stringify(galA));
  ok(galA && galA.mounted === true, '⑧ 声浪画廊未挂载（运行时谱面下应挂载）');
  ok(galA && galA.lyric && galA.lyric.slots === 7, '⑧ 声浪画廊诗行行位应恒为 7: '
     + (galA && galA.lyric && galA.lyric.slots));
  let sawLane = null, laneHit = 0;
  const dur = chart.duration || 0;
  for (let i = 1; i <= 16 && !laneHit; i++) {
    const t = 0.5 + (dur - 1) * (i / 17);
    await seek(t); await page.waitForTimeout(130);
    const m = await mech();
    if (!m.lane) continue;
    sawLane = m.lane;
    if (m.lane === 'hi') { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(130); }
    const m2 = await mech();
    if (m2.laneOn === true && m2.harmMult === 1.25) laneHit++;
  }
  console.log('M5 lane=' + JSON.stringify(sawLane) + '  同层 ×1.25 命中=' + laneHit);
  ok(sawLane != null, '⑧ M5 旋律航线从未产生（lane 恒 null）');
  ok(laneHit >= 1, '⑧ M5 与航线同层未给 ×1.25（laneOn / harmMult 未生效）');

  /* ---------------- ⑨ M1 / M2 机制（运行时谱面） ---------------- */
  console.log('=== ⑨ M1 副歌开闸 / M2 Drop（运行时谱面）===');
  if (byKind.chorus) {
    await seek(byKind.chorus.t0 + 0.3); await page.waitForTimeout(650);
    const a = await mech();
    console.log('M1 进副歌 = ' + JSON.stringify({ over: a.over, overMult: a.overMult }));
    ok(a.over === true && a.overMult === 1.5, '⑨ M1 运行时副歌未开闸: ' + JSON.stringify(a));
  } else fails.push('⑨ 运行时谱面无 chorus 段');
  if (byKind.climax) {
    await seek(byKind.climax.t0 + 0.3); await page.waitForTimeout(650);
    const d = await mech();
    console.log('M2 Drop = ' + JSON.stringify({ drop: d.drop, dropTwinT: d.dropTwinT }));
    ok(d.drop === true, '⑨ M2 运行时高潮未触发 Drop');
  } else console.log('   SKIP：本样本无 climax 段（不强制）');

  /* ---------------- ⑩ 定帧只读（FREEZE 不挂载航线带） ---------------- */
  console.log('=== ⑩ 定帧只读（FREEZE 航线带不挂载）===');
  const fp = await browser.newPage({ viewport: { width: 836, height: 470 }, deviceScaleFactor: 1 });
  await fp.goto(URL + '?scene=causeway&freeze=1', { waitUntil: 'load', timeout: 60000 });
  await fp.waitForTimeout(2600);
  const fl3d = await fp.evaluate(() => (window.__info ? window.__info().cw.lane3d : null));
  const fgalA = await fp.evaluate(() => (window.__info ? window.__info().cw.gallery : null));
  const fchildren = await fp.evaluate(() => window.__SCN.causeway.scene.children.length);
  const fanchor = await fp.evaluate(() => {
    const c = window.__info().causeway;
    return !!(c && c.heroC && c.heroC.length === 2);
  });
  await fp.close();
  console.log('FREEZE lane3d = ' + JSON.stringify(fl3d) + '  gallery = ' + JSON.stringify(fgalA)
              + '  causeway children=' + fchildren);
  ok(fl3d && fl3d.mounted === false, '⑩ FREEZE 下航线带仍被挂载（定帧 children 会漂移）');
  ok(fgalA && fgalA.mounted === false, '⑩ FREEZE 下声浪画廊仍被挂载（定帧 children 会漂移）');
  ok(fchildren > 0 && fanchor, '⑩ FREEZE 页面 causeway 结构异常');

  /* ---------------- ⑪ 零报错 ---------------- */
  if (errs.length) { console.log('ERRORS:\n' + errs.join('\n')); fails.push(errs.length + ' 条控制台报错'); }

  console.log(fails.length ? ('\n✗ FAIL\n  - ' + fails.join('\n  - ')) : '\n✓ PASS (analyze)');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
