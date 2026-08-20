#!/usr/bin/env python3
"""안드로이드 런처 아이콘을 앱 아이콘 마스터에서 만든다.

두 장의 마스터가 역할이 다르다.
  icon-master.png       - 사각형 그대로 쓰는 레거시 아이콘(API 25 이하)
  icon-mask-master.png  - 잘려나갈 것을 전제로 그린 그림. 적응형 아이콘용.

적응형 아이콘은 108dp 캔버스에서 가운데 72dp만 무조건 보이는 것이 보장된다.
마스크 마스터는 웹 maskable 규격(가운데 80%)에 맞춰 그려져 있어서 그대로 깔면
원형 마스크에서 고양이 귀가 잘린다. 그래서 전경은 90/108로 줄여서 안전 영역
안에 넣고, 배경에는 같은 그림을 흐리게 깐다 - 마스크가 어떤 모양이든 가장자리에
빈 색이나 이음새가 보이지 않는다.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "android/app/src/main/res"
SQUARE = ROOT / "assets/icons/app/icon-master.png"
MASK = ROOT / "assets/icons/app/icon-mask-master.png"

# 밀도별 배율. 레거시는 48dp, 적응형 레이어는 108dp가 기준이다.
DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
FOREGROUND_SCALE = 90 / 108  # 안전 영역(72dp) 안으로 내용을 밀어넣는 비율


def resized(image: Image.Image, size: int) -> Image.Image:
    return image.resize((size, size), Image.LANCZOS)


def circular(image: Image.Image, size: int) -> Image.Image:
    art = resized(image, size).convert("RGBA")
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    art.putalpha(mask.resize((size, size), Image.LANCZOS))
    return art


def main() -> None:
    square = Image.open(SQUARE).convert("RGB")
    mask_art = Image.open(MASK).convert("RGB")

    for density, factor in DENSITIES.items():
        out = RES / f"mipmap-{density}"
        out.mkdir(parents=True, exist_ok=True)
        legacy = round(48 * factor)
        adaptive = round(108 * factor)
        inner = round(adaptive * FOREGROUND_SCALE)
        offset = (adaptive - inner) // 2

        resized(square, legacy).save(out / "ic_launcher.png")
        circular(square, legacy).save(out / "ic_launcher_round.png")

        # 배경: 같은 그림을 꽉 채우고 흐리게. 마스크가 잘라내는 바깥쪽이라
        # 선명할 필요가 없고, 흐릴수록 전경과의 경계가 눈에 띄지 않는다.
        background = resized(mask_art, adaptive).filter(
            ImageFilter.GaussianBlur(radius=max(2, adaptive / 26))
        )
        background.save(out / "ic_launcher_background.png")

        foreground = Image.new("RGBA", (adaptive, adaptive), (0, 0, 0, 0))
        foreground.paste(resized(mask_art, inner).convert("RGBA"), (offset, offset))
        foreground.save(out / "ic_launcher_foreground.png")

        print(f"{density}: 레거시 {legacy}px, 적응형 {adaptive}px (전경 내용 {inner}px)")

    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        path = RES / "mipmap-anydpi-v26" / name
        path.write_text(
            '<?xml version="1.0" encoding="utf-8"?>\n'
            '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
            '    <background android:drawable="@mipmap/ic_launcher_background"/>\n'
            '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
            "</adaptive-icon>\n",
            encoding="utf-8",
        )
        print(f"갱신: {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
