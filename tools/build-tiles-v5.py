#!/usr/bin/env python3
"""Build the v5 syrup tiles: one pastel family, measured in CIELAB.

The v4 set graded the master toward six hand-picked colours at a fixed blend
strength. Because those colours did not share a saturation, the finished tiles
landed anywhere from 7.9% to 82.3% — half the board read as colour and half
read as grime, which is what made the board look stained rather than pretty.

v5 grades the same master toward the same approved palette and then normalises
what the tile actually measures, so the set is even by construction rather than
by luck. Two corrections sit on top of that: the warm pair moves apart, because
peach and lemon were eight degrees from each other, and chroma varies slightly
per hue, because equal chroma does not look equal.

The ruler is L*C*h, not HLS. Normalising on HLS saturation produced a set that
measured uniform and looked fluorescent: at identical HLS numbers, yellow and
green land far lighter and far more chromatic than blue or pink. See the notes
on CONCEPT_PALETTE and TARGET_LIGHTNESS_LAB for the numbers.

Colour carries no game meaning — js/ui.js assigns it from the cell's position,
never its value — so the palette only has to be calm and even.
"""

from __future__ import annotations

import math
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
# Measured in CIELAB the two warm tiles really were on top of each other, so
# both move; the cool four are untouched. Rendered hues, h*:
#
#   peach #FFB766 -> 74    lemon #FFDFA6 -> 82    eight degrees apart
#   peach #FFA678 -> 59    lemon #FFE178 -> 91    thirty-two, and both clean
#
# An earlier pass aimed lemon at #E8EE72, which does separate (h* 104) but lands
# in yellow-green: at pastel chroma that reads as khaki, not as lemon. Yellow
# has very little room between "olive" and "acid", and h* 91 is inside it.
#
# The second number is each tile's chroma, and it is deliberately not constant.
# Equal C* across the wheel does not look equal: yellow and orange go beige and
# dirty at the chroma that keeps blue and violet from turning garish. The warm
# tiles carry a few points more so the whole set reads as one pastel family.
#
# Targets are aimed, not final — the master has a warm cast, so a tile renders a
# little below where it is aimed. The build prints both, so re-aim against that
# table rather than against the hex.
CONCEPT_PALETTE = {
    "blush": ((255, 123, 168), 15.0),
    "peach": ((255, 166, 120), 19.0),
    "lemon": ((255, 225, 120), 19.0),
    "mint": ((127, 214, 194), 16.0),
    "aqua": ((141, 183, 255), 15.0),
    "lilac": ((201, 176, 255), 15.0),
}

# Measured on the tile face (centre 40%) in CIELAB, not HLS.
#
# HLS was the wrong ruler. Holding all six at 60% HLS saturation produced a set
# whose perceived chroma ranged 13.9 (peach) to 24.5 (lilac) and whose perceived
# lightness ranged L* 83.5 to 93.2. Yellow and green land far lighter and far
# more chromatic than blue or pink at identical HLS numbers, so lemon and mint
# read as fluorescent while the rest read as muted — a set that measured uniform
# and looked nothing of the sort.
#
# L*C*h is perceptually even, so equal numbers here mean equal to the eye.
#
# Chroma is set per tile in CONCEPT_PALETTE above; BASE_CHROMA is the floor the
# cool hues sit on. L* is shared by all six and is bounded below by the
# numerals — the ink is #425374 and the tile has to stay light enough beneath it
# to clear WCAG AA (4.5:1):
#
#   L* 90  ->  5.79:1      L* 86  ->  5.24:1
#   L* 89  ->  5.66:1      L* 80  ->  4.48:1   fails AA
#
# So the board cannot get contrast from deeper tiles. It would have to come
# from pushing the painted chrome behind the board back instead.
BASE_CHROMA = 15.0
TARGET_LIGHTNESS_LAB = 89.0


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


_WHITE = (0.95047, 1.0, 1.08883)


def _to_linear(channel: float) -> float:
    v = channel / 255
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def _from_linear(value: float) -> float:
    v = value if value > 0 else 0.0
    v = 12.92 * v if v <= 0.0031308 else 1.055 * (v ** (1 / 2.4)) - 0.055
    return min(255.0, max(0.0, v * 255))


def rgb_to_lab(red: float, green: float, blue: float) -> tuple[float, float, float]:
    r, g, b = _to_linear(red), _to_linear(green), _to_linear(blue)
    x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / _WHITE[0]
    y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) / _WHITE[1]
    z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / _WHITE[2]

    def f(t: float) -> float:
        return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116

    fx, fy, fz = f(x), f(y), f(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def lab_to_rgb(lightness: float, a: float, b: float) -> tuple[float, float, float]:
    fy = (lightness + 16) / 116
    fx, fz = fy + a / 500, fy - b / 200

    def g(t: float) -> float:
        return t ** 3 if t ** 3 > 0.008856 else (t - 16 / 116) / 7.787

    x, y, z = g(fx) * _WHITE[0], g(fy) * _WHITE[1], g(fz) * _WHITE[2]
    r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314
    gg = x * -0.9692660 + y * 1.8760108 + z * 0.0415560
    bb = x * 0.0556434 + y * -0.2040259 + z * 1.0572252
    return _from_linear(r), _from_linear(gg), _from_linear(bb)


def mean_rgb(image: Image.Image) -> tuple[float, float, float]:
    pixels = face_pixels(image)
    count = len(pixels)
    return (sum(p[0] for p in pixels) / count,
            sum(p[1] for p in pixels) / count,
            sum(p[2] for p in pixels) / count)


def measure(image: Image.Image) -> tuple[float, float, float]:
    """Mean lightness, chroma and hue of the tile face, in L*C*h."""
    lightness, a, b = rgb_to_lab(*mean_rgb(image))
    return lightness, math.hypot(a, b), math.degrees(math.atan2(b, a)) % 360


def normalize(image: Image.Image, target_chroma: float = BASE_CHROMA) -> Image.Image:
    """Scale saturation and shift lightness so the face lands on the targets.

    Blend strength alone cannot do this: the master carries chroma of its own,
    so no amount of blending toward a pale hue lands every tile in the same
    place. Chroma is scaled by one shared factor and lightness shifted by one
    shared offset, which moves the whole tile onto the target while leaving the
    master's own shading — and the iridescent refraction inside the syrup —
    intact, since both operations preserve relative variation.
    """
    lightness, chroma, _ = measure(image)
    factor = target_chroma / chroma if chroma > 0 else 1.0
    delta = TARGET_LIGHTNESS_LAB - lightness

    cache: dict[tuple[int, int, int], tuple[int, int, int]] = {}
    out = []
    for red, green, blue, alpha in image.getdata():
        if alpha == 0:
            out.append((red, green, blue, alpha))
            continue
        key = (red, green, blue)
        moved = cache.get(key)
        if moved is None:
            pixel_l, a, b = rgb_to_lab(red, green, blue)
            nr, ng, nb = lab_to_rgb(min(100.0, max(0.0, pixel_l + delta)), a * factor, b * factor)
            moved = (round(nr), round(ng), round(nb))
            cache[key] = moved
        out.append((*moved, alpha))
    result = Image.new("RGBA", image.size)
    result.putdata(out)
    return result


# Strong enough that the target hue dominates the master's own warm cast, while
# the highlight mask still restores the glass speculars on top.
GRADE_STRENGTH = 0.85


def grade(master: Image.Image, target_rgb: tuple[int, int, int],
          chroma: float = BASE_CHROMA) -> Image.Image:
    return normalize(tint_preserving_iridescence(master, target_rgb, GRADE_STRENGTH), chroma)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    master = normalized_master()

    print(f"{'tile':8} {'target':9} {'L*':>7} {'C*':>7} {'h':>7}")
    print("-" * 42)
    for name, (target, chroma) in CONCEPT_PALETTE.items():
        compact = grade(master, target, chroma).resize((256, 256), Image.Resampling.LANCZOS)
        compact.save(OUT / f"tile-{name}.png", optimize=True)
        compact.save(OUT / f"tile-{name}.webp", format="WEBP", lossless=True, method=6)
        lightness, chroma, hue = measure(compact)
        print(f"{name:8} #{target[0]:02X}{target[1]:02X}{target[2]:02X}  "
              f"{lightness:7.1f} {chroma:7.1f} {hue:6.0f}°")


if __name__ == "__main__":
    main()
