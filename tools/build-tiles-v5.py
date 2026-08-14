#!/usr/bin/env python3
"""Build the v5 syrup tiles: one pastel family, measured in CIELAB.

The v4 set graded the master toward six hand-picked colours at a fixed blend
strength. Because those colours did not share a saturation, the finished tiles
landed anywhere from 7.9% to 82.3% — half the board read as colour and half
read as grime, which is what made the board look stained rather than pretty.

v5 grades the same master and then normalises what the tile actually measures,
so the set is even by construction rather than by luck. It also drops to five
hues: yellow cannot survive the lightness the rest of the palette needs, and a
muddy sixth colour costs more than the gap it fills.

The ruler is L*C*h, not HLS. Normalising on HLS saturation produced a set that
measured uniform and looked fluorescent: at identical HLS numbers, yellow and
green land far lighter and far more chromatic than blue or pink. See the notes
on PALETTE and TARGET_LIGHTNESS_LAB for the numbers.

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

# Five hues, spread as far apart as the tint can actually reach.
#
# There is no yellow, and that is structural rather than a matter of taste.
#
# A yellow only looks like lemon near L* 90; drop it to the lightness the rest
# of the set needs and it is mustard, because dark yellow is what mustard is.
# The rest of the set needs L* 82, since sRGB simply has no room above it:
#
#   maximum C* in gamut      L* 89    L* 86    L* 82
#     blush  h 6              16.6     21.3     27.9
#     aqua   h 222            17.3     21.9     28.1
#
# Pink and blue cap at C* 16-17 at L* 89 — that is a hard ceiling, not a
# conservative choice, and it is why the earlier pastel set looked washed out.
# Holding every tile at one lightness is what makes the set read as a family,
# so lightness is the shared constraint and yellow is what does not fit inside
# it. Five well-separated hues beat six with a muddy one.
#
# Hues are picked from what the tint can actually reach. Grading through the
# master compresses the wheel unevenly and 260-308 is not reachable at all, so
# these targets are chosen off the build's own printed table, not off theory.
# Rendered: 6, 45, 162, 222, 308 — closest pair 40 degrees apart, where the
# previous six-colour set had a 32-degree pinch between peach and lemon.
PALETTE = {
    "blush": (255, 122, 173),
    "peach": (255, 134, 104),
    "mint": (0, 195, 132),
    "aqua": (0, 191, 255),
    "lilac": (172, 157, 255),
}

# One chroma for all five. The earlier set varied it per hue to keep yellow and
# orange from going beige; without a yellow in the set that correction is no
# longer needed, and every hue here reaches 26 inside the gamut.
TARGET_CHROMA = 26.0

# Measured on the tile face (centre 40%) in CIELAB, not HLS.
#
# HLS was the wrong ruler. Holding every tile at 60% HLS saturation produced a
# set whose perceived chroma ranged 13.9 to 24.5 and whose perceived lightness
# ranged L* 83.5 to 93.2. At identical HLS numbers yellow and green land far
# lighter and far more chromatic than blue or pink, so those two read as
# fluorescent while the rest read as muted — a set that measured uniform and
# looked nothing of the sort. L*C*h is perceptually even, so equal numbers here
# mean equal to the eye.
#
# L* 82 is the floor, and the numerals set it. Chroma barely moves WCAG
# contrast — relative luminance follows L* alone — so this is the only dial that
# trades legibility for colour:
#
#   L* 89  ->  5.82:1      L* 82  ->  4.80:1
#   L* 86  ->  5.36:1      L* 78  ->  4.28:1   fails AA
#
# Sitting at 82 buys roughly double the chroma of 89 while still clearing AA
# against the #425374 ink.
TARGET_LIGHTNESS_LAB = 82.0


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


def normalize(image: Image.Image, target_chroma: float = TARGET_CHROMA) -> Image.Image:
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
          chroma: float = TARGET_CHROMA) -> Image.Image:
    return normalize(tint_preserving_iridescence(master, target_rgb, GRADE_STRENGTH), chroma)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    master = normalized_master()

    print(f"{'tile':8} {'target':9} {'L*':>7} {'C*':>7} {'h':>7}")
    print("-" * 42)
    for name, target in PALETTE.items():
        compact = grade(master, target).resize((256, 256), Image.Resampling.LANCZOS)
        compact.save(OUT / f"tile-{name}.png", optimize=True)
        compact.save(OUT / f"tile-{name}.webp", format="WEBP", lossless=True, method=6)
        lightness, chroma, hue = measure(compact)
        print(f"{name:8} #{target[0]:02X}{target[1]:02X}{target[2]:02X}  "
              f"{lightness:7.1f} {chroma:7.1f} {hue:6.0f}°")


if __name__ == "__main__":
    main()
