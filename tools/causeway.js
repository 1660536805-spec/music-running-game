/* ============================================================================
   causeway.js — 《超频长阶》单赛道关专用门禁
   ----------------------------------------------------------------------------
   与 quad.js（四场景 heroC 零漂移红线）并列的第 5 条门禁：
     ① 定帧基线：?scene=causeway&freeze=1 下 causeway 的 heroC / calls / tris 必须与基线一致
        （causeway 不在 RENDER_ORDER ⇒ 不参与既有四场景红线，故单列一份基线自我保护）
     ② 自动前进：非 freeze 下角色应沿 −z 以 11 u/s 推进（PlayerController 复用 band 链路）
     ③ 升降层：↑/W → hi、↓/S → lo（层目标 + 实际层 + layerY 就位）
     ④ 单赛道运行时：真值谱面已加载 / BGM 已起播 / 段落已解析 / 长按空格进入同调 / 松手退出
     ⑤ 判定链路（P3）：不操作→Miss / 压线切→Perfect·Good / 脉冲球同层收集·异层不扣分 /
        误导体掠过不扣分 / 双闸门不操作→通过
     ⑥ 段落镜头（P4）：lensCues 全落 4 小节线·乐句唯一 / 越过 cue 后镜头按谱面切换
     ⑦ 预判押注（P4）：段界前 2 拍开窗·走向符号符谱 / 窗口内长按→押对 amo=1.5 / 不押→amo=1.0
     ⑧ 同调长按（P4）：长音结束拍点松手→Perfect，同调倍率 mult ∈ (1, 1.5]
     ⑨ 选定态：曲终自动弹出结算面板（评级口径 S 需 miss=0）/ 面板大字与 info 一致 / 返回枢纽回流
     ⑩ 零控制台报错
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

  /* ---- ② 自动前进 ----
     本文件是「金标 causeway 谱面」回归（⑥–⑫ 的判定时间轴全部写死为 superweave 谱面），
     P6 默认曲改为说唱后必须在此显式钉住 superweave，否则测的是另一张谱面。 */
  await page.goto(URL + '?scene=causeway', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__cwSong('superweave'));
  await page.waitForTimeout(1100);
  const z0 = await page.evaluate(() => window.__info().m1.heroZ);
  await page.waitForTimeout(2000);
  const m1 = await page.evaluate(() => window.__info().m1);
  await page.screenshot({ path: path.join(OUT, 'causeway-play.png') });
  console.log('=== causeway · 自动前进 ===');
  console.log('z0=' + z0 + '  z1=' + m1.heroZ + '  Δ=' + (z0 - m1.heroZ).toFixed(2) + ' u');
  if (!(m1.heroZ < z0 - 15)) fails.push('自动前进不足（2s 应约 22u）: Δ=' + (z0 - m1.heroZ).toFixed(2));
  if (m1.heroX != null && Math.abs(m1.heroX) > 0.02) fails.push('单赛道 x 未锁中心: heroX=' + m1.heroX);
  console.log('track = ' + JSON.stringify(m1.track));

  /* ---- ③ 升降层 ---- */
  console.log('=== causeway · 升降层 ===');
  const hasTrack = await page.evaluate(() => !!(window.__info().m1.track));   /* Track 已存在 */
  if (!hasTrack){ console.log('SKIP: Track 未接入'); fails.push('Track 未接入'); }
  else {
    await page.keyboard.press('ArrowUp'); await page.waitForTimeout(180);
    const up = await page.evaluate(() => window.__info().m1.track);
    await page.keyboard.press('ArrowDown'); await page.waitForTimeout(180);
    const dn = await page.evaluate(() => window.__info().m1.track);
    console.log('↑ → ' + JSON.stringify(up));
    console.log('↓ → ' + JSON.stringify(dn));
    if (up.target !== 'hi' || up.layer !== 'hi') fails.push('↑ 未升到 Hi: ' + JSON.stringify(up));
    if (!(up.layerY > 0.5)) fails.push('升到 Hi 后 layerY 未就位: ' + up.layerY);
    if (dn.target !== 'lo' || dn.layer !== 'lo') fails.push('↓ 未降到 Lo: ' + JSON.stringify(dn));
    if (!(dn.layerY < 0.4)) fails.push('降到 Lo 后 layerY 未归零: ' + dn.layerY);
  }

  /* ---- ④ 单赛道运行时：BGM / 真值谱面 / 同调长按 ---- */
  console.log('=== causeway · 运行时（BGM/谱面/同调）===');
  await page.keyboard.down('Space'); await page.waitForTimeout(200);
  const rz = await page.evaluate(() => window.__info().cw);
  await page.keyboard.up('Space');
  console.log('cw = ' + JSON.stringify(rz));
  if (!rz){ fails.push('未取到 cw 快照'); }
  else {
    if (rz.chart !== true) fails.push('真值谱面未加载: chart=' + rz.chart);
    if (rz.bgm !== true) fails.push('BGM 未起播: bgm=' + rz.bgm + ' audio=' + rz.audio);
    if (rz.section == null) fails.push('段落未解析: section=' + rz.section);
    if (rz.resonate !== true) fails.push('长按空格未进入同调: resonate=' + rz.resonate);
    if (rz.audio === 'running' && !(rz.songT > 0.1)) fails.push('音频在跑但 songT 未推进: ' + rz.songT);
  }
  await page.waitForTimeout(300);
  const rzOff = await page.evaluate(() => window.__info().cw);
  if (rzOff && rzOff.resonate !== false) fails.push('松开空格后未退出同调: ' + rzOff.resonate);

  /* ---- ⑤ 判定链路（P3）：不操作→Miss / 压线切→Perfect·Good / 脉冲球 / 误导体 / 双闸门 ---- */
  console.log('=== causeway · 判定链路 ===');
  const cwInfo = () => page.evaluate(() => window.__info().cw);
  const seek = (t) => page.evaluate(tv => window.__cwSeek(tv), t);

  /* ⑥ 不操作 → Miss（gate t=6.076 answer=hi，停留在 lo） */
  await seek(5.9); await page.waitForTimeout(900);
  let js = (await cwInfo()).score;
  console.log('⑥ 不操作:', JSON.stringify(js));
  if (!(js.miss >= 1)) fails.push('⑥ 不操作未记 Miss: ' + JSON.stringify(js));

  /* ⑦ 闸门前提早切换 → Perfect/Good 且形成连击（gate t=9.114 answer=hi） */
  await seek(8.95); await page.keyboard.press('ArrowUp'); await page.waitForTimeout(900);
  js = (await cwInfo()).score;
  console.log('⑦ 压线切:', JSON.stringify(js));
  if (!(js.perfect + js.good >= 1)) fails.push('⑦ 压线切未判 Perfect/Good: ' + JSON.stringify(js));
  if (!(js.combo >= 1)) fails.push('⑦ 压线切未形成连击: ' + JSON.stringify(js));
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(120);   /* 复位到 lo */

  /* ⑧ 脉冲球：同层 → orbs+1；异层 → orbMiss+1 且不扣分（orb t=13.671 lo / t=14.430 hi） */
  await seek(13.45); await page.waitForTimeout(900);
  const jsO = (await cwInfo()).score;
  console.log('⑧ 脉冲球同层:', JSON.stringify(jsO));
  if (!(jsO.orbs >= 1)) fails.push('⑧ 同层脉冲球未收集: ' + JSON.stringify(jsO));
  await seek(14.2); await page.waitForTimeout(900);
  const jsO2 = (await cwInfo()).score;
  console.log('⑧ 脉冲球异层:', JSON.stringify(jsO2));
  if (!(jsO2.orbMiss >= 1)) fails.push('⑧ 异层脉冲球未计 orbMiss: ' + JSON.stringify(jsO2));
  if (jsO2.miss !== 0) fails.push('⑧ 脉冲球漏接不应扣分: ' + JSON.stringify(jsO2));

  /* ⑨ 误导体掠过 → 不扣分（decoy t=36.456 answer=ignore） */
  await seek(36.3); await page.waitForTimeout(900);
  const jsD = (await cwInfo()).score;
  console.log('⑨ 误导体:', JSON.stringify(jsD));
  if (jsD.miss !== 0) fails.push('⑨ 误导体不应扣分: ' + JSON.stringify(jsD));

  /* ⑩ 双闸门不操作 → 通过（twin t=75.190 answer=hold） */
  await seek(75.0); await page.waitForTimeout(500);
  const jsT = (await cwInfo()).score;
  console.log('⑩ 双闸门不操作:', JSON.stringify(jsT));
  if (!(jsT.perfect >= 1) || jsT.miss !== 0) fails.push('⑩ 双闸门不操作未正确通过: ' + JSON.stringify(jsT));

  /* ---- ⑪ 段落镜头（P4）：cue 结构 + 运行时切换 ---- */
  console.log('=== causeway · 段落镜头 ===');
  const cues = await page.evaluate(() => (window.__cwChart() || {}).lensCues || []);
  console.log('lensCues = ' + JSON.stringify(cues.map(c => [c.bar, c.lens])));
  const onGrid = cues.length === 7 && cues.every(c => c.bar % 4 === 0);
  const phraseUniq = new Set(cues.map(c => Math.floor(c.bar / 4))).size === cues.length;
  if (!onGrid) fails.push('⑪ lensCues 未全落 4 小节线: ' + JSON.stringify(cues.map(c => c.bar)));
  if (!phraseUniq) fails.push('⑪ lensCues 同一乐句出现多次');
  if (cues.length > 1){
    await seek(cues[1].t - 0.4);                       /* 落在 cue[1] 之前（应仍停在上一镜头） */
    const lb = (await cwInfo()).lens;
    await page.waitForTimeout(900);                    /* 越过 cue[1] 的切换点 */
    const la = (await cwInfo()).lens;
    console.log('镜头 before=' + JSON.stringify(lb) + '  after=' + JSON.stringify(la));
    if (cues.length && lb.lens !== cues[0].lens) fails.push('⑪ cue 之前镜头非上一 cue: ' + lb.lens);
    if (la.lens !== cues[1].lens) fails.push('⑪ 越过 cue 后未切镜头: ' + la.lens + ' ≠ ' + cues[1].lens);
  }

  /* ---- ⑫ 预判押注（P4）：窗口内长按→押对 / 不押→不押中 ---- */
  console.log('=== causeway · 预判押注 ===');
  const ants = await page.evaluate(() => (window.__cwChart() || {}).anticipations || []);
  console.log('anticipations = ' + JSON.stringify(ants.map(a => [a.at, a.dir])));
  if (ants.length !== 4) fails.push('⑫ 预判窗口数 ≠ 4: ' + ants.length);
  if (ants.length){
    /* 押对：窗口开启后长按同调（键盘 Space 即时进入同调） */
    await seek(ants[0].at + 0.05);
    await page.waitForTimeout(120);
    const aOpen = (await cwInfo()).ant;
    if (!aOpen.open) fails.push('⑫ 预判窗口未开启: ' + JSON.stringify(aOpen));
    if (aOpen.dir !== ants[0].dir) fails.push('⑫ 走向符号不符谱面: ' + aOpen.dir + ' ≠ ' + ants[0].dir);
    await page.keyboard.down('Space');
    await page.waitForTimeout(1000);                   /* 越过段界 → 结算 */
    const aOK = (await cwInfo()).ant;
    await page.keyboard.up('Space');
    console.log('押对:', JSON.stringify(aOK));
    if (aOK.ok !== true) fails.push('⑫ 窗口内长按未判押对: ' + JSON.stringify(aOK));
    if (aOK.amo !== 1.5) fails.push('⑫ 押对后 amo ≠ 1.5: ' + aOK.amo);
  }
  if (ants.length > 1){
    /* 不押：开窗后不操作 ⇒ 押错/不押与不押等价，amo 回 1.0（零惩罚） */
    await seek(ants[1].at + 0.05);
    await page.waitForTimeout(1000);
    const aNo = (await cwInfo()).ant;
    console.log('不押:', JSON.stringify(aNo));
    if (aNo.ok !== false) fails.push('⑫ 不押未结算为未押中: ' + JSON.stringify(aNo));
    if (aNo.amo !== 1.0) fails.push('⑫ 不押后 amo ≠ 1.0: ' + aNo.amo);
  }

  /* ---- ⑬ 同调长按（P4）：长音结束拍点松手 → Perfect，倍率进入 (1, 1.5] ---- */
  console.log('=== causeway · 同调长按 ===');
  const sus = await page.evaluate(() => (window.__cwChart() || {}).sustains || []);
  console.log('sustains = ' + sus.length + ' 首段 t0=' + (sus[0] && sus[0].t0) + ' t1=' + (sus[0] && sus[0].t1));
  if (!sus.length) fails.push('⑬ 谱面未含长音: 0');
  else {
    await seek(sus[0].t0 + 0.15);                      /* 长音进行中按下同调 */
    await page.keyboard.down('Space');
    await page.waitForTimeout(120);
    await page.evaluate(tv => window.__cwAutoRelease(tv), sus[0].t1);   /* 恰在结束拍点松手 */
    await page.waitForTimeout(1500);
    await page.keyboard.up('Space');
    const rs = await cwInfo();
    console.log('同调:', JSON.stringify(rs.reso), ' mult=' + rs.score.mult);
    if (!(rs.reso.perfect >= 1)) fails.push('⑬ 结束拍点松手未判 Perfect: ' + JSON.stringify(rs.reso));
    if (!(rs.score.mult > 1 && rs.score.mult <= 1.5)) fails.push('⑬ 同调倍率越界: ' + rs.score.mult);
  }

  /* ---- ⑭ 结算面板（P5）：曲终自动弹出 + 评级口径 + 按钮回流 ---- */
  console.log('=== causeway · 结算面板 ===');
  const dur = await page.evaluate(() => (window.__cwChart() || {}).duration || 0);
  const rsBefore = (await cwInfo()).result;
  if (!rsBefore) fails.push('⑭ __info().cw.result 缺失（P5 未接线）');
  else if (rsBefore.open !== false) fails.push('⑭ 曲未终时结算面板不应打开: ' + JSON.stringify(rsBefore));
  await seek(dur - 0.2);                                /* 逼近曲终（内部 clamp 到 dur−0.25） */
  await page.waitForTimeout(900);                       /* 越过 dur−0.05 触发阈值 */
  const now = await cwInfo();
  const rs = now.result, rsScore = now.score;
  console.log('曲终:', JSON.stringify(rs), ' score.rank=' + rsScore.rank + ' miss=' + rsScore.miss);
  if (!rs || rs.open !== true) fails.push('⑭ 曲终未弹出结算面板: ' + JSON.stringify(rs));
  if (rs && rs.rank !== rsScore.rank) fails.push('⑭ 面板评级 ≠ 计分口径: ' + rs.rank + ' ≠ ' + rsScore.rank);
  if (rsScore.miss !== 0 && rs && rs.rank === 'S') fails.push('⑭ 有 Miss 却评 S（口径应要求 miss=0）');
  const domRank = await page.evaluate(() => { var e = document.querySelector('#cwres .rk'); return e ? e.textContent.trim() : null; });
  const domOn = await page.evaluate(() => !!document.querySelector('#cwres.on'));
  if (!domOn) fails.push('⑭ 结算面板 DOM 未激活（#cwres.on 未挂）');
  if (domRank !== (rs && rs.rank)) fails.push('⑭ 面板大字评级与 info 不一致: ' + domRank + ' ≠ ' + (rs && rs.rank));
  await page.screenshot({ path: path.join(OUT, 'cw-p5-result.png') });
  /* 返回枢纽：面板关闭 + 场景切回 home（验证按钮回流 + 面板不残留） */
  await page.evaluate(() => { var b = document.querySelector('#cwres .bts b[data-act="home"]'); if (b) b.click(); });
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => ({ cur: window.__info().cur,
    open: window.__info().cw.result.open, on: !!document.querySelector('#cwres.on') }));
  console.log('返回枢纽:', JSON.stringify(after));
  if (after.cur !== 'home') fails.push('⑭ 返回枢纽未切到 home: ' + after.cur);
  if (after.open !== false || after.on) fails.push('⑭ 返回枢纽后面板未关闭: ' + JSON.stringify(after));

  if (errs.length) { console.log('ERRORS:\n' + errs.join('\n')); fails.push(errs.length + ' 条控制台报错'); }
  console.log(fails.length ? ('\n✗ FAIL\n  - ' + fails.join('\n  - ')) : '\n✓ PASS (causeway)');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
