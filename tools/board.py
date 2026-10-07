#!/usr/bin/env python3
"""生成「参考图 vs 渲染」对比长图 out/compare_board.png（1300 宽）。
用法: python3 tools/board.py
"""
from PIL import Image, ImageDraw, ImageFont

ROOT = "/Users/leo/WorkBuddy/腾讯黑客松"
REF = f"{ROOT}/15645d0f-8490-47a7-a594-49aa84b6c123.png"
CUR = f"{ROOT}/out/showcase.png"
OUT = f"{ROOT}/out/compare_board.png"

W = 1300
PAD = 18
GAP = 14
BAR = 42
BG = (24, 26, 32)
FG = (238, 240, 245)
ACC = (120, 200, 255)


def font(sz):
    for p in ("/System/Library/Fonts/PingFang.ttc",
              "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
              "/System/Library/Fonts/Helvetica.ttc"):
        try:
            return ImageFont.truetype(p, sz)
        except Exception:
            continue
    return ImageFont.load_default()


def fit(img):
    w, h = img.size
    nw = W - PAD * 2
    nh = int(h * nw / w)
    return img.resize((nw, nh), Image.LANCZOS)


ref = fit(Image.open(REF).convert("RGB"))
cur = fit(Image.open(CUR).convert("RGB"))
ih = ref.size[1]
H = PAD + BAR + ih + GAP + BAR + ih + PAD

board = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(board)
fb = font(22)

y = PAD
d.text((PAD, y + 8), "◀ 参考图  Reference (2×2 视觉板)", font=fb, fill=FG)
y += BAR
board.paste(ref, (PAD, y))
d.rectangle([PAD, y, PAD + ref.size[0] - 1, y + ih - 1], outline=(60, 64, 74))
y += ih + GAP

d.text((PAD, y + 8), "▶ 渲染  Render  (HOME / DESERT / CAVE / BASE)", font=fb, fill=ACC)
y += BAR
board.paste(cur, (PAD, y))
d.rectangle([PAD, y, PAD + cur.size[0] - 1, y + ih - 1], outline=(60, 64, 74))

board.save(OUT)
print("saved", OUT, board.size)
