#!/usr/bin/env python3
"""앱인토스 목록 썸네일(1932×828)을 원스토어 그래픽 이미지에서 만든다.

원본(1916×821)이 이미 2.334:1이라 목표 2.333:1과 사실상 같다. 자르거나
덧대지 않고 크기만 키운다. 혹시 다른 비율의 원본으로 바뀌면, 그림을 자르는
대신 높이만 맞추고 좌우 남는 자리를 같은 그림을 흐린 것으로 채운다.
"""
from PIL import Image, ImageDraw, ImageFilter

SRC = "store/toss/source/graphic-source.webp"
OUT = "store/toss/thumbnail-1932x828.png"
W, H = 1932, 828
FEATHER = 70

src = Image.open(SRC).convert("RGB")
ratio = src.width / src.height
target = W / H

if abs(ratio - target) / target < 0.01:
    # 비율이 같다 - 그냥 늘린다.
    out = src.resize((W, H), Image.LANCZOS)
else:
    scale = max(W / src.width, H / src.height)
    cover = src.resize((round(src.width * scale), round(src.height * scale)), Image.LANCZOS)
    x = (cover.width - W) // 2
    y = (cover.height - H) // 2
    out = cover.crop((x, y, x + W, y + H)).filter(ImageFilter.GaussianBlur(30))

    fw = round(src.width * H / src.height)
    fg = src.resize((fw, H), Image.LANCZOS)
    mask = Image.new("L", (fw, H), 255)
    draw = ImageDraw.Draw(mask)
    for i in range(FEATHER):
        a = round(255 * i / FEATHER)
        draw.line([(i, 0), (i, H)], fill=a)
        draw.line([(fw - 1 - i, 0), (fw - 1 - i, H)], fill=a)
    out.paste(fg, ((W - fw) // 2, 0), mask)

out.save(OUT, "PNG", optimize=True)
print(OUT, out.size)
