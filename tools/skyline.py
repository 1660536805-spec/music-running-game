#!/usr/bin/env python3
"""天际线（天空占比）逐行剖面工具 —— 数据驱动校正机位俯仰 / 构图。

背景：`y_horizon = 0.5 + pitch/vFOV` 只在「地面无限延伸」的场景（如 desert）成立；
HOME 有镜面湖 + 近景浮岛、BASE 有前中后三层巨岩，天际线被地物切割，无法用公式反推。
本工具用「自顶向下区域生长」提取天空 mask，输出：
  - 整体天空占比 sky%（ref vs cur，及 Δ）
  - 地平线行 horizon y%（自顶向下第一个 天空占比<50% 的行）
  - 每 5% 高度的逐行天空占比表
据此可以把机位 pitch 往 Δ 方向推，直到 cur 的剖面贴合 ref。

用法:
  python3 tools/skyline.py            # 四个场景全跑
  python3 tools/skyline.py base       # 只跑 base
"""
import sys
from collections import deque

import numpy as np
from PIL import Image

ROOT = "/Users/leo/WorkBuddy/腾讯黑客松"
SCENES = {"home": "TL", "desert": "TR", "cave": "BL", "base": "BR"}

W = 240          # 归一到统一宽度，既去噪又保证跨图可比（ref/cur 同宽同高）


def load(tag_or_scene, is_ref):
    path = f"{ROOT}/ref_crop/{tag_or_scene}.png" if is_ref else f"{ROOT}/out/{tag_or_scene}.png"
    img = Image.open(path).convert("RGB")
    h = max(1, round(W * img.size[1] / img.size[0]))
    return np.asarray(img.resize((W, h), Image.BOX), dtype=np.float64) / 255.0


def sky_like(a):
    """逐像素「天空候选」判定：蓝青色系 或 高亮低饱和的雾/云。

    纯区域生长会在手绘柔边地平线处「漏」进浅绿地/暖色地——本函数先用色相与亮度
    把绿(≈100°)、橙红(≈20°)地物排除，只保留蓝青(175–278°)与近白雾，再自顶向下连通。
    """
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(axis=2), a.min(axis=2)
    val = mx
    sat = np.where(mx > 1e-6, (mx - mn) / np.maximum(mx, 1e-6), 0.0)
    # 色相（0..360）
    d = np.maximum(mx - mn, 1e-6)
    hue = np.zeros_like(mx)
    isr, isg, isb = (mx == r), (mx == g), (mx == b)
    hue[isr] = ((g - b)[isr] / d[isr]) % 6
    hue[isg] = ((b - r)[isg] / d[isg]) + 2
    hue[isb] = ((r - g)[isb] / d[isb]) + 4
    hue *= 60
    is_blue = (hue >= 176) & (hue <= 278) & (sat >= 0.10) & (val >= 0.42)
    is_haze = (val >= 0.74) & (sat <= 0.24)
    is_pale = (val >= 0.82) & (sat <= 0.34)   # 暖色地平线雾（沙漠那层淡粉/奶油色天空）
    is_green = (hue >= 78) & (hue <= 165) & (sat > 0.16)   # 草地/植被：即便很亮也不算天空
    return (is_blue | is_haze | is_pale) & ~is_green


def sky_mask(a):
    """自顶向下连通：在 sky_like 候选集内，取与图像顶部连通的区域作为天空。"""
    h, w, _ = a.shape
    cand = sky_like(a)
    sky = np.zeros((h, w), dtype=bool)
    dq = deque()
    for y in range(min(3, h)):
        for x in range(w):
            if cand[y, x] and not sky[y, x]:
                sky[y, x] = True
                dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not sky[ny, nx]:
                sky[ny, nx] = True
                dq.append((ny, nx))
    return sky


def horizon_row(rows):
    """自顶向下第一个 天空占比<50% 的行（归一化 0..1）；全天空则为 1.0。"""
    for i, r in enumerate(rows):
        if r < 0.5:
            return i / (len(rows) - 1)
    return 1.0


def profile(scene, tag):
    ref, cur = load(tag, True), load(scene, False)
    r_ref, r_cur = sky_mask(ref), sky_mask(cur)
    rows_ref = r_ref.mean(axis=1)
    rows_cur = r_cur.mean(axis=1)

    print(f"\n===== {scene} =====  ref_crop/{tag}.png  vs  out/{scene}.png   ({W}x{ref.shape[0]})")
    sref, scur = r_ref.mean() * 100, r_cur.mean() * 100
    print(f"  整体天空占比 sky%   ref {sref:5.1f}   cur {scur:5.1f}   Δ {scur - sref:+.1f}")
    href, hcur = horizon_row(rows_ref), horizon_row(rows_cur)
    print(f"  地平线行 horizon y%  ref {href * 100:5.1f}   cur {hcur * 100:5.1f}   Δ {(hcur - href) * 100:+.1f}")
    print("    y%    ref%    cur%     Δ")
    for pct in range(0, 100, 5):
        y = min(ref.shape[0] - 1, round(pct / 100 * ref.shape[0]))
        a, b = rows_ref[y] * 100, rows_cur[y] * 100
        bar = "#" * int(round(abs(b - a) / 4))
        print(f"   {pct:3d}   {a:5.1f}   {b:5.1f}   {b - a:+5.1f}  {bar}")


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for scene, tag in SCENES.items():
        if only and scene != only:
            continue
        try:
            profile(scene, tag)
        except FileNotFoundError as e:
            print(f"\n===== {scene} =====  跳过（缺图 {e.filename}）")


if __name__ == "__main__":
    main()
