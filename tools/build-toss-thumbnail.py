# 앱인토스 썸네일(1932x828)을 원스토어에 올린 스크린샷들로만 짠다.
# 새로 지어낸 문구나 그림은 넣지 않는다. 배경도 게임 화면의 하늘을 늘려 쓴다.
from PIL import Image, ImageDraw, ImageFilter

W, H = 1932, 828
SRC = "store/screenshots/"
OUT = "store/toss/thumbnail-1932x828.png"

home = Image.open(SRC + "01-home.jpg").convert("RGB")
wow = Image.open(SRC + "03-wow.jpg").convert("RGB")
pic = Image.open(SRC + "04-picture.jpg").convert("RGB")

# 배경: 홈 화면 위쪽 하늘을 잘라 가로로 늘리고 흐리게. 게임 안에 있던 색 그대로.
sky = home.crop((0, 40, home.width, 620)).resize((W, H), Image.LANCZOS)
bg = sky.filter(ImageFilter.GaussianBlur(48))
# 스크린샷이 배경에서 뜨도록 살짝 밝게 눕힌다.
veil = Image.new("RGB", (W, H), (255, 255, 255))
bg = Image.blend(bg, veil, 0.28)

canvas = bg.copy()


def card(img, height, radius=34, tilt=0.0):
    """스크린샷을 자르지 않고 높이만 맞춘 뒤 둥근 모서리 + 그림자."""
    scale = height / img.height
    w = round(img.width * scale)
    shot = img.resize((w, height), Image.LANCZOS)

    mask = Image.new("L", (w, height), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, height - 1), radius, fill=255)

    pad = 46
    layer = Image.new("RGBA", (w + pad * 2, height + pad * 2), (0, 0, 0, 0))
    shadow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (pad, pad + 12, pad + w - 1, pad + height - 1 + 12), radius, fill=(70, 92, 140, 92)
    )
    layer = Image.alpha_composite(layer, shadow.filter(ImageFilter.GaussianBlur(20)))

    face = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    face.paste(shot, (pad, pad), mask)
    # 흰 테두리 한 겹
    ring = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    ImageDraw.Draw(ring).rounded_rectangle(
        (pad, pad, pad + w - 1, pad + height - 1), radius, outline=(255, 255, 255, 235), width=7
    )
    face = Image.alpha_composite(face, ring)
    layer = Image.alpha_composite(layer, face)

    if tilt:
        layer = layer.rotate(tilt, resample=Image.BICUBIC, expand=True)
    return layer


mid_h, side_h = 754, 664
c_home = card(home, mid_h)
c_wow = card(wow, side_h, tilt=3.2)
c_pic = card(pic, side_h, tilt=-3.2)

cx = W // 2
# 옆 두 장을 먼저 깔고 홈 화면을 가운데 위에 올린다.
canvas.paste(c_wow, (cx - c_home.width // 2 - c_wow.width + 118,
                     H // 2 - c_wow.height // 2), c_wow)
canvas.paste(c_pic, (cx + c_home.width // 2 - 118,
                     H // 2 - c_pic.height // 2), c_pic)
canvas.paste(c_home, (cx - c_home.width // 2, H // 2 - c_home.height // 2), c_home)

canvas.save(OUT, "PNG", optimize=True)
print(OUT, canvas.size)
