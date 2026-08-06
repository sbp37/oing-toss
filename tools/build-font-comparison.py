#!/usr/bin/env python3
"""Render a neutral black-on-white comparison of OFL Korean fonts."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/source/font-comparison-oing-game.png"
TEMP = Path("/tmp/oing-font-comparison")
SAMPLES = [
    ("01  Dongle Regular", TEMP / "Dongle-Regular.ttf"),
    ("02  Gowun Dodum Regular", TEMP / "GowunDodum-Regular.ttf"),
    ("03  Gaegu Regular", TEMP / "Gaegu-Regular.ttf"),
    ("04  Hi Melody Regular", TEMP / "HiMelody-Regular.ttf"),
    ("05  Sunflower Medium", TEMP / "Sunflower-Medium.ttf"),
    ("06  IBM Plex Sans KR Regular", TEMP / "IBMPlexSansKR-Regular.ttf"),
]


def system_font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype("/System/Library/Fonts/AppleSDGothicNeo.ttc", size=size, index=4)


def visual_size_font(path: Path, word: str, target_height: int) -> ImageFont.FreeTypeFont:
    probe = ImageFont.truetype(path, size=160)
    box = probe.getbbox(word)
    visible_height = max(1, box[3] - box[1])
    size = round(160 * target_height / visible_height)
    return ImageFont.truetype(path, size=size)


def main() -> None:
    width = 1200
    row_height = 220
    top = 28
    bottom = 76
    image = Image.new("RGB", (width, top + row_height * len(SAMPLES) + bottom), "white")
    draw = ImageDraw.Draw(image)
    word = "오잉게임"

    for index, (label, path) in enumerate(SAMPLES):
        y = top + index * row_height
        draw.text((52, y + 18), label, font=system_font(24), fill="#737373")

        sample_font = visual_size_font(path, word, target_height=104)
        box = draw.textbbox((0, 0), word, font=sample_font)
        text_x = width / 2 - (box[0] + box[2]) / 2
        text_y = y + 125 - (box[1] + box[3]) / 2
        draw.text((text_x, text_y), word, font=sample_font, fill="#000000")

        if index < len(SAMPLES) - 1:
            draw.line((52, y + row_height - 1, width - 52, y + row_height - 1), fill="#e7e7e7", width=2)

    draw.text(
        (52, image.height - 48),
        "All candidates: SIL Open Font License 1.1 · source: Google Fonts",
        font=system_font(20),
        fill="#8a8a8a",
    )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUT, optimize=True)


if __name__ == "__main__":
    main()
