# 声浪星球 · 流行音乐 × 跑酷

> **一句话**：把"这首歌的结构"变成"这一关的玩法"——段落是地形，节拍是障碍，旋律是航线。
> **可交付形态**：**单文件、零构建、直接可玩**的 3D 跑酷音游（`声浪星球.html`），另附运行时音频分析器：**任意一首歌，现场生成一张可玩谱面**。

---

## 快速开始

本作是纯静态单文件游戏，但需要经由 **HTTP 服务**访问（会 fetch 谱面 JSON / `.glb` 模型，`file://` 直开会被浏览器拦截）。

```bash
# 1) 在仓库根目录起一个静态服务
python3 -m http.server 8777 --bind 127.0.0.1

# 2) 浏览器打开
open "http://127.0.0.1:8777/声浪星球.html"
```

- 首次进入是**枢纽大厅**：点「**超频长阶**」（或按 `5`）进入音游关卡；点「**选择歌曲**」打开曲目浮层（含"上传你的歌"）。
- 快捷键：`1` 枢纽 · `2` 沙漠 · `3` 洞穴 · `4` 基地 · `5` 超频长阶。
- 首次点击画面后音频才会解锁（浏览器手势策略，属预期行为）。
- 无构建、无打包、无依赖安装：`three.min.js` 与 `assets/*.glb` 均为本地资源。

---

## 操作（两种状态 + 一种姿态）

| 操作 | 按键 | 含义 |
|---|---|---|
| **升 Lift** | `↑` 或 `W` | 抬升到高轨道 |
| **降 Dive** | `↓` 或 `S` | 下压到低轨道 |
| **同调 Resonate** | **长按** `Space` | 跟随旋律「共鸣」——蓄能 / 接长音 / 命中终结拍 |

> **关键设计**：**「不操作」也是一种有效输入**。双闸门（Twin Gate）的正解是"保持当前层、什么都不做"，而不是手忙脚乱去按键。**时间，是唯一的决策维度**——你只需要在"对的那一拍"做"对的那件事"。

---

## 七大机制（音乐结构 → 玩法）

| 机制 | 把音乐的什么，变成了玩法 |
|---|---|
| **M1 ★ 副歌开闸** Chorus Gate | 进入副歌的那一拍，跑道"开闸"：镜头贴身、速度拉满、误导体成批登场 |
| **M2 ★ Drop 俯冲** Drop Slam | 高潮 Drop 的第一拍，强制一次大动作（同调长按 / 双闸门穿缝），做对给全段最高单次分 |
| **M3 ★ 预副歌蓄能** Build Charge | 预副歌持续按住"同调"蓄能，能量条随旋律爬升，蓄满则在副歌开闸时获得额外加成 |
| **M4 ★ 终曲终结拍** Final Cadence | 尾段渐慢收束，**最后一个音**要求一次决定性长按，直接决定结算评级上限 |
| **M5 ◆ 旋律航线** Melody Lane | 赛道上空悬浮一条随旋律走向起伏的航线；层位与航线趋势一致 ⇒ 和声加成 |
| **M6 ▲ 用跑道弹琴** Play the Track | 每次升 / 降 / 命中都发出一个乐音、音高对齐当前和声——跑完一段＝弹了一遍 |
| **M7 ★ 结构轮转表** Structure Rotation | 元机制：段落类型绑定机制词汇表，**换歌 = 换关** |

> 标记含义：★ = 把流行乐特有结构变成玩法；◆ = 用旋律/情绪数据驱动；▲ = 操作反解为音乐。

---

## 换歌即换关：运行时音频分析器

内置 `SongSelect` 曲目浮层提供三首曲目，另有 **"上传你的歌"** 入口：

- 选择本地 `MP3 / WAV / M4A` → **本地实时分析**（自实现 FFT + 重采样，不依赖 `AnalyserNode` / `OfflineAudioContext`，结果可复现）→ 现场生成段落 / 障碍 / 预判 / 航线 / 情绪 → **直接开跑**。
- **不上传服务器、不入库、不打包**（版权红线 R6：受版权曲目仅本地分析）。

| 谱面来源 | 段数 | 说明 |
|---|---|---|
| 《超频长阶》causeway（预烘焙关卡） | 5 段 | intro → verse → chorus → bridge → climax |
| song2（预烘焙曲目） | 7 段 | 含 preChorus / outro，答辩"换歌即换关"对照 |
| **运行时分析器（任意歌）** | 4–7 段 | 段落模板由能量分析决定，K≥4 时强制保证 preChorus + outro |

> 全链路消费端（判定 / 计分 / 镜头 / 结算）**零改动**——它们只读同一份 `Chart.data` schema。

---

## 门禁（验收基线，每次提交必跑）

**7 道断言门禁**，下表按**推荐执行顺序**排列（"官方序号"沿用历史编号）。任一道非绿，即视为不可交付。

| 官方序号 | 门禁 | 脚本 | 判定 |
|---|---|---|---|
| 1′ | 零漂移（断言） | `tools/quadcheck.js` | 四场景 `heroC` 与基线**容差 0 逐位一致** + calls 红线 |
| 3 | 性能预算 | `tools/budget.js` | calls `home<700 / desert<700 / cave<1900 / base<1000` |
| 2 | 零报错 | `tools/playtest.js` | 跳跃 `lifted=true`、场景切换 OK、**零控制台报错** |
| 4 | 视觉回归·展示 | `tools/showcase.js` | 四宫格展示模式无回归 |
| 5 | causeway 关 | `tools/causeway.js` | **14 组断言**全 PASS（定帧基线 + 判定 + 段落镜头 + 预判 + 同调 + 结算） |
| 7 | 运行时机制 | `tools/mech.js` | M1–M7 机制断言 + `genCheck` 契约（causeway 180/180 · song2 116/116） |
| 8 | 音频分析器 | `tools/analyze.js` | 默认路径零漂移 · 分析**逐字节确定** · 上传链路 · 运行时谱面完整性 · 机制联动 |

**运行前置**（macOS / 本项目脚本约定）：

```bash
# 本地服务（已在跑则跳过）
python3 -m http.server 8777 --bind 127.0.0.1

export NODE=/Users/leo/.workbuddy/binaries/node/versions/22.22.2-6/bin/node
export NODE_PATH=/Users/leo/.workbuddy/binaries/node/workspace/node_modules
export PW_CHROME="$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-mac-arm64/chrome-headless-shell"

$NODE tools/quadcheck.js && \
$NODE tools/budget.js    && \
$NODE tools/playtest.js  && \
$NODE tools/showcase.js  && \
$NODE tools/causeway.js  && \
$NODE tools/mech.js      && \
$NODE tools/analyze.js
```

> **`causeway.js` 的定帧基线（`heroC` / calls / tris）逐位锁定，不得"顺手重新基线"**。任何改动若使其漂移，视为破坏红线 R1，必须先证明无副作用再谈。

---

## 目录结构

```
腾讯黑客松/
├── 声浪星球.html              # ★ 主交付物：单文件游戏（含运行时音频分析器）
├── three.min.js               # Three.js r128（本地，无 CDN 依赖）
├── index.html                 # 项目入口页
├── assets/                    # 谱面 JSON + 音频 + .glb 模型
│   ├── causeway-chart.json    #   《超频长阶》金标谱面（5 段）
│   ├── causeway.wav           #   同源真值音频
│   ├── song2-chart.json       #   song2 金标谱面（7 段）
│   ├── song2.wav
│   └── *.glb                  #   低多边形场景模型
├── tools/                     # 生成器 + 门禁（Node + Playwright）
│   ├── gen_causeway.js        #   谱面/音频生成器（预烘焙真值）
│   ├── quadcheck.js / budget.js / playtest.js / showcase.js
│   ├── causeway.js / mech.js / analyze.js     # 门禁
│   └── ...
├── docs/                      # 设计与开发文档
│   ├── 声浪星球-流行音乐×跑酷-产品设计文档.md   # ★ 产品主张 / 机制 / 映射总表
│   ├── 声浪星球-跑酷音游-开发文档.md            # ★ 工程 / 门禁 / 验收用例
│   └── ...
└── .workbuddy/                # 本地工作记忆（不入公开仓库）
```

---

## 红线（不可触碰）

- **R1 四场景零漂移**：`heroC` 逐位一致，视觉/几何改动必须走确定性随机流（`dseq` / `lcg`）。
- **R2 随机流可复现**：分析器全程**零写入**，不干扰游戏随机序列。
- **R3 操作零写入**：玩家输入不写入任何持久状态。
- **R4 单文件无构建**：交付物是可直接运行的 HTML，无打包步骤。
- **R5 音频需手势解锁**：遵循浏览器自动播放策略。
- **R6 免费不侵犯版权**：真实歌**仅本地分析**，不上传、不入库、不部署、不打包。

---

*《声浪星球》——听见结构，跑出玩法。*
