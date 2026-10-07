#!/usr/bin/env python3
"""逐格采样参考图 vs 渲染图的主色，输出 5x5 网格色差，用于数据驱动调色。
用法: python3 tools/palette.py [scene]
"""
import sys, colorsys
from PIL import Image

ROOT = "/Users/leo/WorkBuddy/腾讯黑客松"
SCENES = {"home": "TL", "desert": "TR", "cave": "BL", "base": "BR"}


def avg(img, x0, y0, x1, y1):
    crop = img.crop((x0, y0, x1, y1)).resize((1, 1), Image.BOX)
    return crop.getpixel((0, 0))[:3]


def hsv(rgb):
    r, g, b = [v / 255 for v in rgb]
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    return int(h * 360), int(s * 100), int(v * 100)


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    N = 5
    for scene, tag in SCENES.items():
        if only and scene != only:
            continue
        ref = Image.open(f"{ROOT}/ref_crop/{tag}.png").convert("RGB")
        cur = Image.open(f"{ROOT}/out/{scene}.png").convert("RGB")
        print(f"\n===== {scene}  ref {ref.size}  cur {cur.size} =====")
        for gy in range(N):
            row = []
            for gx in range(N):
                def cell(img):
                    w, h = img.size
                    x0, x1 = int(w * gx / N), int(w * (gx + 1) / N)
                    y0, y1 = int(h * gy / N), int(h * (gy + 1) / N)
                    c = avg(img, x0, y0, x1, y1)
                    return c, hsv(c)
                (rc, rh), (cc, ch) = cell(ref), cell(cur)
                dh = abs(rh[0] - ch[0]); dh = min(dh, 360 - dh)
                d = dh / 180 * 0.5 + abs(rh[1] - ch[1]) / 100 * 0.3 + abs(rh[2] - ch[2]) / 100 * 0.2
                row.append(f"r{rh[0]:3d},{rh[1]:2d},{rh[2]:2d} c{ch[0]:3d},{ch[1]:2d},{ch[2]:2d} d{d:.2f}")
            print(f" y{gy} | " + " | ".join(row))


if __name__ == "__main__":
    main()
