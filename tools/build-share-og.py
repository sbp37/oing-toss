#!/usr/bin/env python3
"""링크 미리보기용 1200x600 OG 그림을 카드마다 한 장씩 굽는다.

왜 따로 굽나. 카드 원본은 1086x1448 세로형 webp다. 토스 권장 OG 규격은
1200x600 가로형이고, 미리보기를 그리는 쪽(카톡 등)이 webp를 못 읽을 수도
있다. 그래서 한동안 어떤 카드를 공유하든 공통 배너 한 장만 나갔는데,
"오잉 카드 공유하기를 눌렀는데 카드가 안 간다"는 제보를 받았다. 맞는 말이다 -
카드를 자랑하려고 누른 버튼이니 카드가 보여야 한다.

구성: 주인공은 카드 한 장이다. 배경은 그 카드를 크게 흐린 것이라 카드마다
색이 저절로 달라진다. 가운데에 카드를 액자에 넣어 세우고, 왼쪽 아래에
로고를 작게 얹는다. 배너를 통째로 오려 붙이면 네모 두 개가 나란히 서서
'짜깁기'로 보이기 때문에 배경은 카드에서 뽑는다.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
CARDS = ROOT / "assets/cards"
OUT = ROOT / "assets/share/cards"
LOGO = ROOT / "assets/ui/logo-v2.webp"

W, H = 1200, 600
PAD = 46           # 위아래 여백
RADIUS = 26        # 액자 모서리
FRAME = 10         # 흰 테두리 두께
LOGO_W = 300


def rounded(im: Image.Image, radius: int) -> Image.Image:
    """모서리를 둥글린 RGBA를 돌려준다."""
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), radius, fill=255)
    out = im.convert("RGBA")
    out.putalpha(mask)
    return out


def build(card_path: Path, out_path: Path) -> None:
    card = Image.open(card_path).convert("RGB")

    # 배경: 같은 카드를 화면에 꽉 차게 키우고 흐린다. 카드마다 색이 달라진다.
    cover = max(W / card.width, H / card.height)
    bg = card.resize((round(card.width * cover), round(card.height * cover)), Image.LANCZOS)
    bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2,
                  (bg.width - W) // 2 + W, (bg.height - H) // 2 + H))
    bg = bg.filter(ImageFilter.GaussianBlur(34))
    # 그대로 두면 배경이 카드와 싸운다. 크림색을 섞어 한 톤 가라앉힌다.
    bg = Image.blend(bg, Image.new("RGB", (W, H), (255, 253, 246)), 0.42)

    # 카드: 높이에 맞춰 가운데 세운다. 세로 그림이 잘리지 않는다.
    target_h = H - PAD * 2
    scale = target_h / card.height
    card = card.resize((round(card.width * scale), target_h), Image.LANCZOS)
    x = (W - card.width) // 2
    y = PAD

    # 흰 액자와 그림자. 그림자를 먼저 깔아야 카드가 배경에서 떠 보인다.
    fw, fh = card.width + FRAME * 2, card.height + FRAME * 2
    shadow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(shadow).rounded_rectangle(
        (x - FRAME, y - FRAME + 10, x - FRAME + fw, y - FRAME + fh + 10), RADIUS, fill=110
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    bg = Image.composite(Image.new("RGB", (W, H), (120, 104, 92)), bg, shadow)

    frame = rounded(Image.new("RGB", (fw, fh), (255, 255, 255)), RADIUS)
    bg.paste(frame, (x - FRAME, y - FRAME), frame)
    inner = rounded(card, RADIUS - FRAME // 2)
    bg.paste(inner, (x, y), inner)

    # 로고는 투명 원본을 쓴다. 배너를 네모로 오려 붙이지 않는 이유다.
    logo = Image.open(LOGO).convert("RGBA")
    logo = logo.resize((LOGO_W, round(logo.height * LOGO_W / logo.width)), Image.LANCZOS)
    bg.paste(logo, (40, H - logo.height - 26), logo)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    bg.quantize(colors=200, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG).save(
        out_path, "PNG", optimize=True
    )


def main() -> None:
    made = 0
    for card in sorted(CARDS.glob("card-*.webp")):
        if card.stem.startswith("card-back"):
            continue
        out = OUT / f"{card.stem}-og.png"
        build(card, out)
        made += 1
        print(f"  {out.name}  {out.stat().st_size // 1024}KB")
    print(f"Built {made} share OG images in {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
