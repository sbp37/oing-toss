#!/usr/bin/env python3
"""앱인토스 목록 썸네일(1932×828)을 원스토어 그래픽 이미지에서 만든다.

원본은 16:9(1669×942)이고 목표는 2.33:1이다. 폭에 맞춰 늘리면 위아래가
잘려 로고 위 하늘과 아래 배지들이 날아간다. 그래서 그림은 하나도 자르지
않고 높이만 맞춘 뒤, 좌우 남는 자리를 같은 그림을 크게 흐린 것으로 채운다.
하늘과 풀밭이 그대로 이어져서 덧댄 티가 거의 나지 않는다.
"""
from PIL import Image, ImageDraw, ImageFilter

SRC = "store/toss/source/graphic-source.webp"
OUT = "store/toss/thumbnail-1932x828.png"
W, H = 1932, 828
FEATHER = 70  # 이어붙인 자리를 부드럽게 넘기는 폭

src = Image.open(SRC).convert("RGB")

# 배경: 같은 그림을 1932×828을 덮도록 키워 가운데를 쓰고 흐린다.
scale = max(W / src.width, H / src.height)
cover = src.resize((round(src.width * scale), round(src.height * scale)), Image.LANCZOS)
left = (cover.width - W) // 2
top = (cover.height - H) // 2
bg = cover.crop((left, top, left + W, top + H)).filter(ImageFilter.GaussianBlur(30))

# 앞면: 자르지 않고 높이만 맞춘 원본.
fw = round(src.width * H / src.height)
fg = src.resize((fw, H), Image.LANCZOS)

# 좌우 끝을 서서히 흐린 배경으로 넘긴다.
mask = Image.new("L", (fw, H), 255)
draw = ImageDraw.Draw(mask)
for i in range(FEATHER):
    a = round(255 * i / FEATHER)
    draw.line([(i, 0), (i, H)], fill=a)
    draw.line([(fw - 1 - i, 0), (fw - 1 - i, H)], fill=a)

out = bg.copy()
out.paste(fg, ((W - fw) // 2, 0), mask)
out.save(OUT, "PNG", optimize=True)
print(OUT, out.size)
