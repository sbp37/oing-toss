#!/usr/bin/env python3
"""Build the v5 syrup tiles: one saturation, evenly spaced hues.

The v4 set graded the master toward six hand-picked colors at a fixed blend
strength. Because those colors did not share a saturation, the finished tiles
landed anywhere from 7.9% (aqua) to 82.3% (peach) — half the board read as
colour and half read as grime, which is what made the board look stained
rather than rainbow. Three of the six hues also sat within 33 degrees of each
other, so the set spent its variety in the orange wedge and had nothing left
for the cool end.

v5 fixes the palette by construction. Hues are spaced around the wheel, and the
blend strength for each tile is solved numerically so every finished tile
measures the same face saturation. Lightness is then normalised so the numerals
keep one contrast ratio everywhere on the board.

Colour carries no game meaning in v5 — js/ui.js assigns it from the cell's
position, never its value — so the palette only has to be calm and even.
"""

from __future__ import annotations

import colorsys
from pathlib import Path

from PIL import Image, ImageChops, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/source/tile-syrup-v4-alpha.png"
OUT = ROOT / "assets/ui/tiles-syrup-v5"

# The approved concept-board palette, carried over from
# tools/build-syrup-tile-assets.py. These are the colours the project already
# chose and liked; v4's failure was never the palette, it was that a fixed blend
# strength rendered them at 7.9%-82.3% saturation so half the board looked like
# grime. Keeping the hues and fixing only the rendering is the whole change.
#
# One correction. Measured on the wheel the original set is not a rainbow:
#
#   blush #FF7BA8  340°     peach #FFB766   32°
#   lemon #FFDFA6   38°  <- six degrees from peach, so it read as a second
#   mint  #7FD6C2  166°     orange and the set had no yellow at all
#   aqua  #8DB7FF  218°     lilac #C9B0FF  259°
#
# `lemon` moves to a true yellow and keeps its light, buttery character. The
# other five are untouched.
#
# Targets are aimed, not final: the master carries a warm cast of its own, so a
# target lands a few degrees below where it is aimed and yellows drift hardest.
# `lemon` is aimed at 63° to render at 55°, which is where it finally separates
# from peach. The build prints both numbers, so re-aim against that table rather
# than against the hex.
CONCEPT_PALETTE = {
    "blush": (255, 123, 168),
    "peach": (255, 183, 102),
    "lemon": (232, 238, 114),
    "mint": (127, 214, 194),
    "aqua": (141, 183, 255),
    "lilac": (201, 176, 255),
}

# Measured on the tile face (centre 40%), matching how the v4 set was audited.
#
# Saturation is capped by the numerals, not by taste. The ink is #425374, and
# the tile has to stay light enough underneath it to clear WCAG AA (4.5:1).
# Measured at hue 52° (yellow, the worst case of the six):
#
#   saturation 60% / lightness 86%   ->  5.07:1   ok
#   saturation 70% / lightness 82%   ->  4.36:1   fails AA
#   saturation 78% / lightness 78%   ->  3.74:1   fails AA
#
# So the board cannot get its contrast from deeper tiles. It gets it from
# css/ui-chrome.css instead, which pushes the painted chrome behind the board
# back so the tiles are the only saturated thing on screen.
TARGET_SATURATION = 0.60
TARGET_LIGHTNESS = 0.86


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
    """v4's grade, kept verbatim so v5 inherits the same syrup refraction."""
    rgb = master.convert("RGB")
    tint = Image.new("RGB", rgb.size, color)
    graded = Image.blend(rgb, tint, strength)

    luminance = ImageOps.grayscale(rgb)
    highlight_mask = luminance.point(lambda value: max(0, min(255, (value - 218) * 7)))
    highlight_mask = ImageChops.multiply(highlight_mask, master.getchannel("A"))
    graded = Image.composite(rgb, graded, highlight_mask)

    result = graded.convert("RGBA")
    result.putalpha(master.getchannel("A"))
    return result


def face_pixels(image: Image.Image) -> list[tuple[int, int, int, int]]:
    width, height = image.size
    face = image.crop((int(width * 0.3), int(height * 0.3), int(width * 0.7), int(height * 0.7)))
    return [pixel for pixel in face.getdata() if pixel[3] > 200]


def mean_rgb(image: Image.Image) -> tuple[float, float, float]:
    pixels = face_pixels(image)
    count = len(pixels)
    return (sum(p[0] for p in pixels) / count,
            sum(p[1] for p in pixels) / count,
            sum(p[2] for p in pixels) / count)


def measure(image: Image.Image) -> tuple[float, float]:
    red, green, blue = mean_rgb(image)
    _, lightness, saturation = colorsys.rgb_to_hls(red / 255, green / 255, blue / 255)
    return saturation, lightness


def normalize(image: Image.Image) -> Image.Image:
    """Scale saturation and shift lightness so the face lands on the targets.

    Blend strength alone cannot do this: the master already measures 65.8%
    saturation, so no amount of blending toward a warm hue brings blush, peach
    or lemon down to 45%. Saturation is scaled by one shared factor and
    lightness shifted by one shared offset, which moves the whole tile onto the
    target while leaving the master's own shading — and the multicoloured
    refraction inside the syrup — intact.
    """
    saturation, lightness = measure(image)
    factor = TARGET_SATURATION / saturation if saturation > 0 else 1.0
    delta = TARGET_LIGHTNESS - lightness

    out = []
    for red, green, blue, alpha in image.getdata():
        if alpha == 0:
            out.append((red, green, blue, alpha))
            continue
        hue, pixel_l, pixel_s = colorsys.rgb_to_hls(red / 255, green / 255, blue / 255)
        nr, ng, nb = colorsys.hls_to_rgb(
            hue,
            min(1.0, max(0.0, pixel_l + delta)),
            min(1.0, pixel_s * factor),
        )
        out.append((round(nr * 255), round(ng * 255), round(nb * 255), alpha))
    result = Image.new("RGBA", image.size)
    result.putdata(out)
    return result


# Strong enough that the target hue dominates the master's own warm cast, while
# the highlight mask still restores the glass speculars on top.
GRADE_STRENGTH = 0.85


def grade(master: Image.Image, target_rgb: tuple[int, int, int]) -> Image.Image:
    return normalize(tint_preserving_iridescence(master, target_rgb, GRADE_STRENGTH))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    master = normalized_master()

    print(f"{'tile':8} {'target':9} {'saturation':>11} {'lightness':>10} {'hue':>6}")
    print("-" * 50)
    for name, target in CONCEPT_PALETTE.items():
        compact = grade(master, target).resize((256, 256), Image.Resampling.LANCZOS)
        compact.save(OUT / f"tile-{name}.png", optimize=True)
        compact.save(OUT / f"tile-{name}.webp", format="WEBP", lossless=True, method=6)
        saturation, lightness = measure(compact)
        hue = colorsys.rgb_to_hls(*[c / 255 for c in mean_rgb(compact)])[0] * 360
        print(f"{name:8} #{target[0]:02X}{target[1]:02X}{target[2]:02X}  "
              f"{saturation * 100:10.1f}% {lightness * 100:9.1f}% {hue:5.0f}°")


if __name__ == "__main__":
    main()
