#!/usr/bin/env python3
"""Build OING tile variants from the approved chroma-keyed master."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


PROJECT = Path(__file__).resolve().parents[1]
SOURCE = PROJECT / "assets/source/tile-master-v3-alpha.png"
MASTER = PROJECT / "assets/source/tile-master-v3.png"
PREVIEW = PROJECT / "assets/source/tiles-v3-preview.png"
BOARD_PREVIEW = PROJECT / "assets/source/board-v3-preview.png"
OUTPUT = PROJECT / "assets/ui/tiles-v3"

TILES = {
    "tile-butter": ("#D5AA58", "#FFF5D9", "#FFFFFA"),
    "tile-mint": ("#89B79A", "#EFF8EC", "#FCFFFC"),
    "tile-lilac": ("#A598C9", "#F3EFFA", "#FFFEFF"),
    "tile-blush": ("#D49AAC", "#FCEEF2", "#FFFEFF"),
    "tile-aqua": ("#82B3B7", "#EAF7F5", "#FBFFFF"),
    "tile-sky": ("#8FACC4", "#EDF6FC", "#FCFEFF"),
    "tile-selected": ("#D65375", "#FFDCE5", "#FFFAFC"),
    "tile-success": ("#4DAD94", "#DDF6EB", "#FAFFFC"),
    "tile-hint": ("#D49B31", "#FFF0B9", "#FFFFF8"),
}

NUMBER_COLORS = ["#E58A25", "#4E9A66", "#6F61B4", "#DF5E7D", "#2699A4", "#4B82B7"]
NUMBER_COLOR_BY_VALUE = {
    1: "#4E9A66",
    2: "#6F61B4",
    3: "#5C994F",
    4: "#DF5E7D",
    5: "#2699A4",
    6: "#4B82B7",
    7: "#7458AA",
    8: "#E58A25",
    9: "#6554A5",
}
TONE_INDEX_BY_VALUE = {1: 1, 2: 2, 3: 1, 4: 3, 5: 4, 6: 5, 7: 2, 8: 0, 9: 2}
PREVIEW_FONT = Path("/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf")


def normalized_master(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise RuntimeError("tile master has no visible pixels")

    cropped = image.crop(bbox)
    safe_padding = max(3, round(max(cropped.size) * 0.008))
    edge = max(cropped.size) + safe_padding * 2
    square = Image.new("RGBA", (edge, edge), (0, 0, 0, 0))
    square.alpha_composite(
        cropped,
        ((edge - cropped.width) // 2, (edge - cropped.height) // 2),
    )
    return square.resize((512, 512), Image.Resampling.LANCZOS)


def colorized_tile(master: Image.Image, colors: tuple[str, str, str]) -> Image.Image:
    shadow, face, highlight = colors
    gray = ImageOps.grayscale(master)
    colored = ImageOps.colorize(
        gray,
        black=shadow,
        mid=face,
        white=highlight,
        blackpoint=78,
        midpoint=242,
        whitepoint=255,
    ).convert("RGBA")
    colored.putalpha(master.getchannel("A"))

    glints = Image.new("RGBA", master.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glints)
    draw.ellipse((70, 67, 112, 88), fill=(255, 255, 255, 188))
    draw.ellipse((118, 63, 138, 77), fill=(255, 255, 255, 142))
    colored.alpha_composite(glints)
    return colored


def make_preview(tiles: list[Image.Image]) -> Image.Image:
    preview = Image.new("RGB", (1120, 760), "#F7F0E5")
    draw = ImageDraw.Draw(preview)
    draw.rounded_rectangle((28, 28, 1092, 732), radius=34, fill="#FFF9EF")

    large_size = 220
    large_font = ImageFont.truetype(str(PREVIEW_FONT), 104)
    for index, tile in enumerate(tiles[:6]):
        column = index % 3
        row = index // 3
        x = 76 + column * 338
        y = 62 + row * 254
        large = tile.resize((large_size, large_size), Image.Resampling.LANCZOS)
        preview.paste(large, (x, y), large)
        number = str(index + 1)
        box = draw.textbbox((0, 0), number, font=large_font)
        draw.text(
            (x + (large_size - (box[2] - box[0])) / 2, y + (large_size - (box[3] - box[1])) / 2 - 10),
            number,
            font=large_font,
            fill=NUMBER_COLORS[index],
        )

    small_size = 74
    small_font = ImageFont.truetype(str(PREVIEW_FONT), 35)
    for index, tile in enumerate(tiles[:6]):
        x = 192 + index * 122
        y = 640
        small = tile.resize((small_size, small_size), Image.Resampling.LANCZOS)
        preview.paste(small, (x, y), small)
        number = str(index + 1)
        box = draw.textbbox((0, 0), number, font=small_font)
        draw.text(
            (x + (small_size - (box[2] - box[0])) / 2, y + (small_size - (box[3] - box[1])) / 2 - 3),
            number,
            font=small_font,
            fill=NUMBER_COLORS[index],
        )
    return preview


def make_board_preview(tiles: list[Image.Image]) -> Image.Image:
    canvas = Image.new("RGB", (760, 760), "#DDF4FA")
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((16, 16, 744, 744), radius=30, fill="#FFF1D5", outline="#E2C289", width=3)

    values = [
        [2, 5, 3, 4],
        [8, 2, 0, 5],
        [7, 3, 1, 4],
        [6, 2, 8, 9],
    ]
    gap = 4
    cell = 174
    start = 26
    font = ImageFont.truetype(str(PREVIEW_FONT), 91)

    for row, row_values in enumerate(values):
        for column, value in enumerate(row_values):
            x = start + column * (cell + gap)
            y = start + row * (cell + gap)
            if value == 0:
                draw.rounded_rectangle(
                    (x + 2, y + 2, x + cell - 2, y + cell - 2),
                    radius=24,
                    fill="#FFFAED",
                    outline="#CFE8E6",
                    width=2,
                )
                for offset in range(12, cell, 16):
                    draw.line((x + offset, y + 8, x + offset, y + cell - 8), fill="#DCEFED", width=1)
                    draw.line((x + 8, y + offset, x + cell - 8, y + offset), fill="#DCEFED", width=1)
                continue

            tile = tiles[TONE_INDEX_BY_VALUE[value]].resize((cell, cell), Image.Resampling.LANCZOS)
            canvas.paste(tile, (x, y), tile)
            number = str(value)
            box = draw.textbbox((0, 0), number, font=font)
            draw.text(
                (x + (cell - (box[2] - box[0])) / 2, y + (cell - (box[3] - box[1])) / 2 - 8),
                number,
                font=font,
                fill=NUMBER_COLOR_BY_VALUE[value],
            )
    return canvas


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGBA")
    master = normalized_master(source)
    master.save(MASTER, optimize=True)

    rendered: list[Image.Image] = []
    distribution_tiles: list[Image.Image] = []
    for name, colors in TILES.items():
        tile = colorized_tile(master, colors)
        rendered.append(tile)
        distribution = tile.resize((256, 256), Image.Resampling.LANCZOS)
        distribution_tiles.append(distribution)
        tile.save(OUTPUT / f"{name}.png", optimize=True)
        distribution.save(OUTPUT / f"{name}.webp", format="WEBP", lossless=True, method=6)

    sprite = Image.new("RGBA", (768, 512), (0, 0, 0, 0))
    for index, tile in enumerate(distribution_tiles[:6]):
        sprite.alpha_composite(tile, ((index % 3) * 256, (index // 3) * 256))
    sprite.save(OUTPUT / "tile-colors-sprite.webp", format="WEBP", lossless=True, method=6)

    make_preview(rendered).save(PREVIEW, optimize=True)
    make_board_preview(distribution_tiles).save(BOARD_PREVIEW, optimize=True)

    alpha = master.getchannel("A")
    visible = sum(alpha.histogram()[1:])
    coverage = visible / (master.width * master.height)
    print(f"Generated {len(TILES)} PNG/WebP tile variants")
    print(f"Master: {master.size[0]}x{master.size[1]}, visible coverage: {coverage:.1%}")
    print(f"Preview: {PREVIEW}")
    print(f"Board preview: {BOARD_PREVIEW}")


if __name__ == "__main__":
    main()
