#!/usr/bin/env python3
"""Build lightweight, individual syrup-tile assets and a board-scale preview."""

from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/source/tile-syrup-v4-alpha.png"
OUT = ROOT / "assets/ui/tiles-syrup-v4"
PREVIEW = ROOT / "assets/source/tile-syrup-v4-preview.png"

VARIANTS = {
    # Approved concept-board palette. The underlying master keeps the syrup
    # refraction; these grades make each tile read as a distinct palette color.
    "blush": ((255, 123, 168), 0.43),  # #FF7BA8
    "peach": ((255, 183, 102), 0.40),  # #FFB766
    "lemon": ((255, 223, 166), 0.42),  # #FFDFA6
    "mint": ((127, 214, 194), 0.42),   # #7FD6C2
    "aqua": ((141, 183, 255), 0.42),   # #8DB7FF
    "lilac": ((201, 176, 255), 0.42),  # #C9B0FF
}

NUMBER_COLORS = [
    "#e05275", "#31947f", "#6552aa", "#dc5374", "#318b9b",
    "#4f8c5e", "#df8422", "#4d8055", "#594aa0",
]


def font(size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/AppleSDGothicNeo.ttc",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size=size, index=7)
        except (OSError, ValueError):
            try:
                return ImageFont.truetype(candidate, size=size)
            except OSError:
                pass
    return ImageFont.load_default()


def normalized_master() -> Image.Image:
    source = Image.open(SOURCE).convert("RGBA")
    bbox = source.getchannel("A").getbbox()
    if not bbox:
        raise RuntimeError("source tile has no visible pixels")
    tile = source.crop(bbox)
    canvas = Image.new("RGBA", (512, 512))
    tile.thumbnail((484, 484), Image.Resampling.LANCZOS)
    canvas.alpha_composite(tile, ((512 - tile.width) // 2, (512 - tile.height) // 2))
    return canvas


def tint_preserving_iridescence(master: Image.Image, color: tuple[int, int, int], strength: float) -> Image.Image:
    rgb = master.convert("RGB")
    tint = Image.new("RGB", rgb.size, color)
    graded = Image.blend(rgb, tint, strength)

    # Restore the crisp glass highlights and dark rim detail after the syrup tint.
    luminance = ImageOps.grayscale(rgb)
    highlight_mask = luminance.point(lambda value: max(0, min(255, (value - 218) * 7)))
    highlight_mask = ImageChops.multiply(highlight_mask, master.getchannel("A"))
    graded = Image.composite(rgb, graded, highlight_mask)

    result = graded.convert("RGBA")
    result.putalpha(master.getchannel("A"))
    return result


def save_asset(name: str, image: Image.Image) -> None:
    compact = image.resize((256, 256), Image.Resampling.LANCZOS)
    compact.save(OUT / f"tile-{name}.png", optimize=True)
    compact.save(OUT / f"tile-{name}.webp", format="WEBP", lossless=True, method=6)


def tile_shadow(tile: Image.Image, size: int) -> Image.Image:
    resized = tile.resize((size, size), Image.Resampling.LANCZOS)
    shadow = Image.new("RGBA", (size + 18, size + 20))
    alpha = resized.getchannel("A")
    shadow_alpha = Image.new("L", shadow.size)
    shadow_alpha.paste(alpha, (8, 10))
    shadow_alpha = shadow_alpha.filter(ImageFilter.GaussianBlur(5)).point(lambda value: int(value * 0.22))
    shadow.putalpha(shadow_alpha)
    shadow_rgb = Image.new("RGBA", shadow.size, (154, 118, 92, 0))
    shadow_rgb.putalpha(shadow_alpha)
    shadow_rgb.alpha_composite(resized, (8, 4))
    return shadow_rgb


def make_preview(variants: dict[str, Image.Image]) -> None:
    canvas = Image.new("RGB", (1120, 1480), "#fffaf0")
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((42, 40, 1078, 1440), 48, fill="#fffdf7", outline="#ead9bd", width=3)
    draw.text((76, 70), "SYRUP NAIL TILE — ASSET FIRST", fill="#6a5350", font=font(38))
    draw.text((76, 125), "individual raster assets · 256 px · previewed at game size", fill="#a1847d", font=font(22))

    # Six actual-size candidates. Their reflections remain multicolored after grading.
    names = list(variants)
    x_positions = [105, 270, 435, 600, 765, 930]
    for index, (name, x) in enumerate(zip(names, x_positions), start=1):
        tile = tile_shadow(variants[name], 112)
        canvas.paste(tile, (x - 65, 212), tile)
        color = NUMBER_COLORS[index - 1]
        text = str(index)
        fnt = font(56)
        box = draw.textbbox((0, 0), text, font=fnt)
        draw.text((x - (box[2] - box[0]) / 2, 244), text, fill=color, font=fnt)
        label_box = draw.textbbox((0, 0), name, font=font(18))
        draw.text((x - (label_box[2] - label_box[0]) / 2, 342), name, fill="#8b706a", font=font(18))

    draw.text((76, 410), "BOARD-SCALE CHECK · the floor grid is exactly one tile per cell", fill="#6a5350", font=font(25))

    # The requested board floor: one large square slot per tile, never tiny graph paper.
    board_left, board_top = 146, 474
    cell, count = 204, 4
    board_right = board_left + cell * count
    board_bottom = board_top + cell * count
    draw.rounded_rectangle((board_left - 22, board_top - 22, board_right + 22, board_bottom + 22), 38,
                           fill="#fff5df", outline="#e6cda8", width=5)
    for row in range(count):
        for col in range(count):
            x0 = board_left + col * cell
            y0 = board_top + row * cell
            draw.rounded_rectangle((x0 + 5, y0 + 5, x0 + cell - 5, y0 + cell - 5), 24,
                                   fill="#fff9eb", outline="#e9d7b9", width=4)

    sequence = ["blush", "mint", "lilac", "peach", "aqua", "lemon"]
    number = 1
    for row in range(count):
        for col in range(count):
            # Leave two cells empty so the large cell-sized board grid is obvious.
            if (row, col) in {(1, 2), (3, 1)}:
                continue
            name = sequence[(row * count + col) % len(sequence)]
            tile = tile_shadow(variants[name], 194)
            x = board_left + col * cell - 3
            y = board_top + row * cell - 5
            canvas.paste(tile, (x, y), tile)
            value = (number * 2 + row) % 9 + 1
            number += 1
            text = str(value)
            fnt = font(82)
            box = draw.textbbox((0, 0), text, font=fnt)
            tx = board_left + col * cell + (cell - (box[2] - box[0])) / 2
            ty = board_top + row * cell + 48
            draw.text((tx, ty), text, fill=NUMBER_COLORS[value - 1], font=fnt)

    draw.rounded_rectangle((705, 800, 995, 868), 32, fill="#ff6f91", outline="#fff4ef", width=4)
    draw.text((760, 813), "SUM 10!", fill="white", font=font(31))
    draw.text((160, 1372), "Empty cells reveal ONE large tile-sized slot — no micro-grid.", fill="#8b706a", font=font(22))
    canvas.save(PREVIEW, optimize=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    master = normalized_master()
    master.save(ROOT / "assets/source/tile-syrup-v4.png", optimize=True)

    built = {}
    for name, (color, strength) in VARIANTS.items():
        variant = tint_preserving_iridescence(master, color, strength)
        built[name] = variant
        save_asset(name, variant)

    make_preview(built)


if __name__ == "__main__":
    main()
