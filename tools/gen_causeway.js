#!/usr/bin/env node
/* ============================================================================
   gen_causeway.js — 《超频长阶》内置曲合成器（Node 零依赖）
   ----------------------------------------------------------------------------
   在同一次采样循环里同时产出：
     · assets/causeway.wav          22050Hz / 单声道 / 16-bit / BPM158 / 64 小节 ≈97.2s
     · assets/causeway-chart.json   真值谱面（onsets / sections / obstacles /
                                     sustains / anticipations / melody / mood / phrase）
   真值谱面与音频同源 ⇒ onset 与采样逐一对齐，运行时无需 OfflineAudioContext 分析。

   用法： node tools/gen_causeway.js
   ============================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

/* ---------------------------------------------------------------- 常量 ----
   BPM 158 ⇒ 单拍 0.379747s，一拍 380ms，十六分 95ms（对齐设计 §3.3） */
const SR   = 22050;                 // 采样率（如需更高保真改此一行）
const BPM  = 158;
const SPB  = 60 / BPM;              // 单拍秒数 0.3797468
const BEAT = 4;                     // 4/4
const BAR  = BEAT * SPB;            // 小节秒数 1.5189873
const BARS = 64;                    // 总小节
const DUR  = BARS * BAR;            // ≈97.215s
const N    = Math.round(DUR * SR);  // 总样本数
const Z0   = 4.0;                   // 出生点 z（须与 LEVELS.causeway.spawn[1] 一致）
const TRACK = { width: 3.5, base: 11, sprint: 15, sprintAt: 0.85, layerHi: 0.9, switchMs: 90, z0: Z0 };

/* -------------------------------------------------------------- 工具函数 ---- */
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
/* 与页面 dseq 同族的 LCG：确定性、可复现 */
function lcg(seed){ let s = (seed >>> 0) || 1; return function(){ s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

const buf = new Float32Array(N);    // 累加缓冲（-1..1 附近）

/* 一阶低通（状态式，用于给噪声"去尖锐"或做音色整形） */
function makeLP(a){ let st = 0; return (x) => { st += a * (x - st); return st; }; }

/* ---------------------------------------------------------------- 乐器 ---- */
/* 底鼓：140→46Hz 指数滑落 + 指数包络（同页面 kick 的口径） */
function kick(t0, amp){
  amp = amp || 1;
  const i0 = Math.max(0, Math.round(t0 * SR));
  const len = Math.round(0.24 * SR);
  for (let i = 0; i < len && i0 + i < N; i++){
    const t = i / SR;
    const f = 46 + (140 - 46) * Math.exp(-t / 0.045);
    const env = Math.exp(-t / 0.075);
    buf[i0 + i] += Math.sin(2 * Math.PI * f * t) * env * 0.62 * amp;
  }
}
/* 军鼓：噪声爆发 + 200Hz 基音（2、4 拍） */
function snare(t0, amp){
  amp = amp || 1;
  const i0 = Math.max(0, Math.round(t0 * SR));
  const len = Math.round(0.16 * SR);
  const r = lcg((t0 * 100000) | 0);
  for (let i = 0; i < len && i0 + i < N; i++){
    const t = i / SR;
    const env = Math.exp(-t / 0.045);
    const n = (r() * 2 - 1) * env * 0.30 * amp;
    const body = Math.sin(2 * Math.PI * 200 * t) * env * 0.16 * amp;
    buf[i0 + i] += n + body;
  }
}
/* 踩镲：差分近似高通的白噪声，短包络 */
function hat(t0, amp){
  amp = amp || 1;
  const i0 = Math.max(0, Math.round(t0 * SR));
  const len = Math.round(0.045 * SR);
  const r = lcg((t0 * 100000 + 7) | 0);
  let prev = 0;
  for (let i = 0; i < len && i0 + i < N; i++){
    const t = i / SR;
    const x = (r() * 2 - 1);
    const hp = x - prev; prev = x;                 // 一阶差分 ⇒ 提升高频
    buf[i0 + i] += hp * Math.exp(-t / 0.012) * 0.085 * amp;
  }
}
/* 贝斯：基音 + 五度弱泛音（合成感 body），带软起音 */
function bass(t0, f, dur, amp){
  amp = amp || 1;
  const i0 = Math.max(0, Math.round(t0 * SR));
  const len = Math.round(dur * SR);
  for (let i = 0; i < len && i0 + i < N; i++){
    const t = i / SR;
    const atk = Math.min(1, t / 0.006);
    const env = atk * Math.exp(-t / (dur * 0.85));
    const s = Math.sin(2 * Math.PI * f * t) * 0.42 + Math.sin(2 * Math.PI * f * 2 * t) * 0.09;
    buf[i0 + i] += s * env * 0.30 * amp;
  }
}
/* 主旋律：三角波近似（奇次谐波 1/n²）+ 轻颤音 */
function lead(t0, f, dur, amp){
  amp = amp || 1;
  const i0 = Math.max(0, Math.round(t0 * SR));
  const len = Math.round(dur * SR);
  for (let i = 0; i < len && i0 + i < N; i++){
    const t = i / SR;
    const vib = 1 + 0.0035 * Math.sin(2 * Math.PI * 5.2 * t);
    const atk = Math.min(1, t / 0.012);
    const rel = Math.min(1, (dur - t) / 0.06);
    const env = atk * Math.max(0, rel) * (0.55 + 0.45 * Math.exp(-t / (dur * 1.6)));
    const w = f * vib;
    const s = Math.sin(2 * Math.PI * w * t)
            + Math.sin(2 * Math.PI * w * 3 * t) / 9
            + Math.sin(2 * Math.PI * w * 5 * t) / 25;
    buf[i0 + i] += s * env * 0.20 * amp;
  }
}
/* 铺底 Pad：三和弦正弦叠加，慢起慢落（贯穿小节） */
function pad(t0, freqList, dur, amp){
  amp = amp || 1;
  const i0 = Math.max(0, Math.round(t0 * SR));
  const len = Math.round(dur * SR);
  for (let i = 0; i < len && i0 + i < N; i++){
    const t = i / SR;
    const env = Math.min(1, t / 0.30) * Math.min(1, (dur - t) / 0.35);
    let s = 0;
    for (let k = 0; k < freqList.length; k++) s += Math.sin(2 * Math.PI * freqList[k] * t);
    buf[i0 + i] += (s / freqList.length) * Math.max(0, env) * 0.085 * amp;
  }
}

/* --------------------------------------------------------------- 段落 ---- */
/* 5 段（精简自设计 §7.2 的 7 段）：前奏 / 主歌 / 副歌 / 桥段 / 高潮 */
const SECTIONS = [
  { kind:'intro',  b0:0,  b1:8,  energy:0.30, density:0.20, camera:'chase',    special:'tutorial',
    label:'前奏 · 升降教学' },
  { kind:'verse',  b0:8,  b1:24, energy:0.55, density:0.50, camera:'overhead', special:'orb',
    label:'主歌 · 听见节奏' },
  { kind:'chorus', b0:24, b1:40, energy:1.00, density:0.90, camera:'onboard',  special:'decoy',
    label:'副歌 · 误导体登场' },
  { kind:'bridge', b0:40, b1:48, energy:0.40, density:0.35, camera:'lateral',  special:'resonate',
    label:'桥段 · 同调长按' },
  { kind:'climax', b0:48, b1:64, energy:1.00, density:1.00, camera:'onboard',  special:'twin',
    label:'高潮 · 双闸门夹击' }
];
SECTIONS.forEach((s, i) => { s.t0 = s.b0 * BAR; s.t1 = s.b1 * BAR; s.index = i; });
const speedOf = (s) => (s.energy >= TRACK.sprintAt ? TRACK.sprint : TRACK.base);
function sectionAt(t){
  for (let i = 0; i < SECTIONS.length; i++) if (t >= SECTIONS[i].t0 && t < SECTIONS[i].t1) return SECTIONS[i];
  return SECTIONS[SECTIONS.length - 1];
}
/* 已行进距离 D(t)：分段常量速度的闭式积分（页面 Track.zOf 必须镜像此式） */
function distAt(t){
  let d = 0;
  for (let i = 0; i < SECTIONS.length; i++){
    const s = SECTIONS[i];
    const a = Math.min(t, s.t1), b = s.t0;
    if (a > b) d += speedOf(s) * (a - b);
  }
  return d;
}
const zOf = (t) => Z0 - distAt(t);

/* --------------------------------------------------------------- 和声 ---- */
/* 4 小节循环：Am – F – C – G（i–VI–III–VII，A 小调），根音 + 三和弦 */
const CHORDS = [
  { root: /*A2*/45, tri: [57, 60, 64] },   // Am
  { root: /*F2*/41, tri: [53, 57, 60] },   // F
  { root: /*C3*/48, tri: [55, 60, 64] },   // C
  { root: /*G2*/43, tri: [55, 59, 62] }    // G
];

/* --------------------------------------------------- 旋律（按小节轮廓）---- */
/* 音阶：A 自然小调（MIDI） */
const SCALE = [57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79];
const NSTEPS = BARS * 8;                     // 八分音符网格
const melody = new Array(NSTEPS).fill(null); // {step, midi, durSteps}
(function buildMelody(){
  /* 每段的旋律性格：起始音、步进密度、轮廓方向 */
  const conf = {
    intro:  { start:1, dens:2, dir: 0.15 },   // 一拍一个音，低区
    verse:  { start:3, dens:1, dir: 0.35 },   // 八分，上行
    chorus: { start:6, dens:1, dir: 0.20 },   // 高区、局促
    bridge: { start:4, dens:4, dir:-0.30 },   // 长音（同调长按）
    climax: { start:8, dens:1, dir: 0.45 }    // 高区、快
  };
  SECTIONS.forEach((sec, si) => {
    const c = conf[sec.kind];
    const r = lcg(0x51 + si * 977);
    let idx = c.start;
    for (let b = sec.b0; b < sec.b1; b++){
      for (let st = 0; st < 8; st += c.dens){
        const step = b * 8 + st;
        if (step >= NSTEPS) break;
        idx = clamp(idx + Math.round((r() - 0.5) * 4 + c.dir * 3), 0, SCALE.length - 1);
        const dur = c.dens === 4 ? (r() < 0.5 ? 8 : 4) : (r() < 0.25 ? 2 : 1);
        melody[step] = { step, midi: SCALE[idx], durSteps: dur };
        if (dur > 1) for (let k = 1; k < dur; k++) if (melody[step + k] === undefined || melody[step+k]) melody[step + k] = null;
      }
    }
  });
})();

/* ------------------------------------------------- 网格：slope / energy ---- */
const GRID = 8;                              // 八分网格
const NGRID = Math.floor(DUR * SR / (SPB / 2)) ;  // 不用于采样，仅时间网格
const gridN = NSTEPS;
const melodyPitch = new Float32Array(gridN);     // 每个八分步的音高（半音）
const melodySlope = new Float32Array(gridN);     // 归一化斜率（-1..1 附近）
const moodEnergy  = new Float32Array(gridN);
let lastMidi = 69;
for (let i = 0; i < gridN; i++){
  if (melody[i]) lastMidi = melody[i].midi;
  melodyPitch[i] = lastMidi;
}
for (let i = 0; i < gridN; i++){
  const a = melodyPitch[Math.max(0, i - 1)], b = melodyPitch[i];
  melodySlope[i] = clamp((b - a) / 2.0, -1, 1);   // 2 半音/八分 ⇒ 满量程；±0.3 阈值可辨
}
for (let i = 0; i < gridN; i++){
  const t = (i / 8) * BAR;                        // i/8 小节
  const sec = sectionAt(t);
  const local = (i % 8) / 8;                      // 小节内位置，强拍更"重"
  moodEnergy[i] = clamp(sec.energy * (0.82 + 0.28 * Math.cos(2 * Math.PI * local)), 0, 1);
}

/* --------------------------------------------------------------- 渲染 ---- */
const onsets = [];        // 强 onset：kick / snare / 旋律起音
const sustains = [];      // 旋律长音（同调长按的触发点）

/* 记录 onset（同拍去重） */
const onsetSeen = {};
function addOnset(t, strength){
  const key = Math.round(t * 1000);
  if (onsetSeen[key]) return;
  onsetSeen[key] = 1;
  onsets.push({ t: +t.toFixed(4), strength: +strength.toFixed(2) });
}

for (let bar = 0; bar < BARS; bar++){
  const bt = bar * BAR;
  const sec = sectionAt(bt);
  const chord = CHORDS[bar % CHORDS.length];
  const heavy = sec.energy >= 0.85;

  /* --- 鼓组 --- */
  const kicks = heavy ? [0, 1, 2, 3] : [0, 2];
  kicks.forEach((b) => { const t = bt + b * SPB; kick(t, heavy ? 1.0 : 0.85); addOnset(t, 1.0); });
  const snares = heavy ? [1, 3] : [1, 3];
  snares.forEach((b) => { const t = bt + b * SPB; snare(t, heavy ? 0.9 : 0.7); addOnset(t, 0.8); });
  /* 踩镲：八分（高潮/副歌十六分） */
  const hatStep = heavy ? 0.5 : 1;
  for (let e = 0; e < 8; e += hatStep * 2){
    const t = bt + (e * SPB / 2);
    hat(t, heavy ? 0.75 : 0.5);
  }

  /* --- 贝斯：根音，八分（低能段四分） --- */
  const bassStep = sec.energy >= 0.5 ? 0.5 : 1;
  for (let e = 0; e < 4; e += bassStep){
    const t = bt + e * SPB;
    bass(t, midi(chord.root), SPB * bassStep * 0.92, heavy ? 1.0 : 0.8);
  }

  /* --- Pad：整小节和弦（低能段更明显） --- */
  const padAmp = sec.energy >= 0.85 ? 0.5 : 1.0;
  pad(bt, chord.tri.map(midi), BAR * 0.98, padAmp);

  /* --- 旋律 --- */
  for (let st = 0; st < 8; st++){
    const step = bar * 8 + st;
    const m = melody[step];
    if (!m) continue;
    const t = bt + st * (SPB / 2);
    const dur = m.durSteps * (SPB / 2) * 0.95;
    lead(t, midi(m.midi), dur, sec.kind === 'bridge' ? 1.15 : 1.0);
    addOnset(t, 0.7);
    if (m.durSteps >= 4) sustains.push({ t0: +t.toFixed(4), t1: +(t + dur).toFixed(4), midi: m.midi });
  }
}

/* ------------------------------------------------ 障碍（对齐 onset）----- */
const obstacles = [];
const ON = onsets.map(o => o.t);
function nearestOnset(t){
  let best = null, bd = 1e9;
  for (let i = 0; i < ON.length; i++){ const d = Math.abs(ON[i] - t); if (d < bd){ bd = d; best = ON[i]; } }
  return (bd <= SPB * 0.5) ? best : null;
}
let oid = 0;
function pushObstacle(t, type, layer){
  const ot = nearestOnset(t);
  if (ot == null) return;                    // 宁缺毋滥：偏离半拍以上不放
  const answer = (type === 'gate' || type === 'pillar') ? (layer === 'lo' ? 'hi' : 'lo')
               : (type === 'orb') ? layer
               : (type === 'twin') ? 'hold' : 'ignore';   // decoy
  obstacles.push({
    id: 'o' + (oid++),
    beat: +((ot / SPB)).toFixed(3),
    t: +ot.toFixed(4),
    z: +zOf(ot).toFixed(3),
    type: type,
    layer: type === 'twin' ? 'both' : layer,
    answer: answer
  });
}
SECTIONS.forEach((sec) => {
  const r = lcg(0xC0A5E7 ^ (sec.index * 2654435761 >>> 0));
  const interval = clamp(Math.round(1 / sec.density), 1, 8);   // 拍
  const t0 = (sec.index === 0) ? sec.t0 + 4 * BAR : sec.t0;    // 前奏留 4 小节铺垫
  for (let b = sec.b0; b < sec.b1; b++){
    for (let k = 0; k < 4; k += interval){
      const beatInSection = (b - sec.b0) * 4 + k;
      const t = t0 + beatInSection * SPB;
      if (t < sec.t0 || t >= sec.t1 - SPB * 0.5) continue;
      const roll = r();
      if (sec.kind === 'intro'){
        pushObstacle(t, 'gate', (b % 2 === 0) ? 'lo' : 'hi');   // 教学：低位/高位交替
      } else if (sec.kind === 'verse'){
        if (roll < 0.28) pushObstacle(t, 'orb', (r() < 0.5 ? 'lo' : 'hi'));
        else pushObstacle(t, (b >= sec.b1 - 4 && roll < 0.7) ? 'pillar' : 'gate', (r() < 0.5 ? 'lo' : 'hi'));
      } else if (sec.kind === 'chorus'){
        if (roll < 0.30) pushObstacle(t, 'decoy', (r() < 0.5 ? 'lo' : 'hi'));
        else if (roll < 0.45) pushObstacle(t, 'orb', (r() < 0.5 ? 'lo' : 'hi'));
        else pushObstacle(t, 'gate', (r() < 0.5 ? 'lo' : 'hi'));
      } else if (sec.kind === 'bridge'){
        if (roll < 0.62) pushObstacle(t, 'orb', (r() < 0.5 ? 'lo' : 'hi'));
        else pushObstacle(t, 'gate', (r() < 0.5 ? 'lo' : 'hi'));
      } else { /* climax */
        if (roll < 0.30) pushObstacle(t, 'twin', 'both');
        else if (roll < 0.45) pushObstacle(t, 'decoy', (r() < 0.5 ? 'lo' : 'hi'));
        else if (roll < 0.58) pushObstacle(t, 'orb', (r() < 0.5 ? 'lo' : 'hi'));
        else pushObstacle(t, 'gate', (r() < 0.5 ? 'lo' : 'hi'));
      }
    }
  }
});
/* 前奏教学：把前两个障碍排成一升一降，间隔 2 拍，保证必可读 */
obstacles.sort((a, b) => a.t - b.t);

/* --------------------------------------------------------------- 预判 ---- */
/* 段交界前 2 拍：HUD 显走向符号，窗口内长按"同调"= 押注（设计 §6.1） */
const ANTIC = [
  { bar: 8,  dir: 'up',   into: 'verse'  },
  { bar: 24, dir: 'hold', into: 'chorus' },
  { bar: 40, dir: 'down', into: 'bridge' },
  { bar: 48, dir: 'up',   into: 'climax' }
];
const anticipations = ANTIC.map(a => ({
  at: +(a.bar * BAR - 2 * SPB).toFixed(4),
  dir: a.dir,
  into: a.into,
  win: +(2 * SPB).toFixed(4)          // 窗口长度 = 2 拍
}));

/* --------------------------------------------------------------- 镜头 ---- */
/* 只在乐句边界（4 小节线）切换；覆盖全部 5 种镜头（设计 §5.1） */
const LENS_CUES = [
  { bar: 8,  lens: 'overhead', cue: 'melody' },
  { bar: 24, lens: 'onboard',  cue: 'mood'   },
  { bar: 40, lens: 'lateral',  cue: 'melody' },
  { bar: 44, lens: 'drift',    cue: 'form'   },
  { bar: 48, lens: 'onboard',  cue: 'mood'   },
  { bar: 56, lens: 'overhead', cue: 'melody' },
  { bar: 60, lens: 'chase',    cue: 'form'   }
];
const lensCues = LENS_CUES.map(c => ({ t: +(c.bar * BAR).toFixed(4), bar: c.bar, lens: c.lens, cue: c.cue }));

/* 乐句线（4 小节 = 1 乐句） */
const phraseBars = [];
for (let b = 0; b <= BARS; b += 4) phraseBars.push(+(b * BAR).toFixed(4));

/* --------------------------------------------------------------- 输出 ---- */
/* 峰值归一化到 -1.5 dBFS */
let peak = 0;
for (let i = 0; i < N; i++){ const a = Math.abs(buf[i]); if (a > peak) peak = a; }
const g = peak > 0 ? (0.84 / peak) : 1;
const pcm = Buffer.alloc(N * 2);
for (let i = 0; i < N; i++){
  let s = buf[i] * g;
  s = clamp(s, -1, 1);
  pcm.writeInt16LE(Math.round(s * 32767), i * 2);
}
function wavHeader(dataLen){
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + dataLen, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(dataLen, 40);
  return h;
}
const root = path.resolve(__dirname, '..');
const wavPath = path.join(root, 'assets', 'causeway.wav');
const jsonPath = path.join(root, 'assets', 'causeway-chart.json');
fs.mkdirSync(path.dirname(wavPath), { recursive: true });
fs.writeFileSync(wavPath, Buffer.concat([wavHeader(pcm.length), pcm]));

const chart = {
  schema: 1,
  song: 'superweave',
  title: '超频长阶 · Overdrive Causeway',
  bpm: BPM, spb: +SPB.toFixed(6), bar: +BAR.toFixed(6), beats: 4, bars: BARS,
  duration: +DUR.toFixed(3), sr: SR,
  track: TRACK,
  sections: SECTIONS.map(s => ({
    index: s.index, kind: s.kind, label: s.label, t0: +s.t0.toFixed(3), t1: +s.t1.toFixed(3),
    bars: s.b1 - s.b0, energy: s.energy, density: s.density, speed: speedOf(s),
    camera: s.camera, special: s.special
  })),
  onsets: onsets,
  obstacles: obstacles,
  sustains: sustains,
  anticipations: anticipations,
  lensCues: lensCues,
  phrase: { bars: phraseBars },
  melody: { step: +(SPB / 2).toFixed(6), slope: Array.from(melodySlope).map(v => +v.toFixed(3)) },
  mood:   { step: +(SPB / 2).toFixed(6), energy: Array.from(moodEnergy).map(v => +v.toFixed(3)) }
};
fs.writeFileSync(jsonPath, JSON.stringify(chart));

/* --------------------------------------------------------------- 自检 ---- */
const byType = {};
obstacles.forEach(o => byType[o.type] = (byType[o.type] || 0) + 1);
const mm = Math.floor(DUR / 60), ss = (DUR - mm * 60).toFixed(1);
console.log('[gen_causeway] 完成');
console.log('  时长      : ' + mm + ':' + String(ss).padStart(4, '0') + '  (' + DUR.toFixed(3) + 's, ' + N + ' samples)');
console.log('  BPM/小节  : ' + BPM + ' / ' + BARS + ' 小节 (' + BAR.toFixed(4) + 's/小节, ' + SPB.toFixed(4) + 's/拍)');
console.log('  段落      : ' + SECTIONS.map(s => s.kind).join(' → ') + '  (' + SECTIONS.length + ')');
console.log('  onsets    : ' + onsets.length + '  (首 ' + onsets[0].t + 's, 末 ' + onsets[onsets.length-1].t + 's)');
console.log('  障碍      : ' + obstacles.length + '  ' + JSON.stringify(byType));
console.log('  同调长音  : ' + sustains.length + '  预判窗口: ' + anticipations.length + '  镜头提示: ' + lensCues.length);
console.log('  末障碍 z  : ' + obstacles[obstacles.length-1].z + '  (赛道终点 z≈' + zOf(DUR).toFixed(1) + ')');
console.log('  WAV       : ' + wavPath + '  ' + (fs.statSync(wavPath).size / 1048576).toFixed(2) + ' MB');
console.log('  CHART     : ' + jsonPath + '  ' + (fs.statSync(jsonPath).size / 1024).toFixed(1) + ' KB');
