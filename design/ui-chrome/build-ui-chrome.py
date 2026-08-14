#!/usr/bin/env python3
"""Build the fixed OING play chrome at the approved 780x1688 canvas.

The previous build resized three horizontal bands of the source with three
DIFFERENT vertical scales (HUD 100.3%, board 94.6%, dock/bubble 109.6% of the
uniform scale). The dock buttons are drawn square in the source but shipped
~10% taller than square, the board recess shipped flattened, and the whole
lower half read as vertically stretched — which is exactly what it was.

This build never scales any painted object anisotropically. The source is
scaled uniformly to the 780px canvas width (853x1844 -> 780x1686), then the
canvas height difference and the extra room the board needs are absorbed ONLY
by bands that contain no drawn objects:

  uniform y        new y            content                     operation
  ---------        ---------        -------------------------   -----------
     0..76    ->      0..67         sky above the HUD           compress
    76..400   ->     67..391        HUD panel (ribbon..shadow)  KEEP
   400..457   ->    391..415        flat sky gap                compress
   457..600   ->    415..558        recess frame + upper floor  KEEP
   600..1000  ->    558..997        flat recess floor           extend
  1000..1180  ->    997..1177       lower floor + frame         KEEP
  1180..1195  ->   1177..1197       flat sky gap                extend
  1195..1686  ->   1197..1688       dock + bubble + grass       KEEP

The recess grows from 723px to 762px (y 415..1177) so a 6x7 board of SQUARE
tiles fits inside it; everything painted keeps the proportions it was drawn
with.

The board recess is then ERASED. It was a painted cream tray with a golden
rim, and the live board sits on top of it — but the tray is drawn for one
fixed 4x4 grid, so on every other stage (and on any cleared cell) the parts of
it the tiles do not cover read as stray beige blocks pasted behind the
numbers. No CSS can hide it, because it is baked into this bitmap. So the
whole tray, rim and drop shadow (x 18..760, y 398..1220) is painted out with
the sky it interrupts: the strips beside it, x 1..10 and x 768..778, are clean
gradient sky at every one of those rows, so each row is refilled by
interpolating its own left and right sky across the gap. The tiles then float
on open sky and nothing but the numbers shows.

Erasing the tray also retires the old pencil-grid cleanup — the faint 4x4
grid printed on the tray floor went out with the floor itself.

Every CSS anchor in css/ui-chrome.css was re-derived through the same band
map; run this script with --anchors to print the mapping used there.
"""

import statistics
import sys
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source" / "ui-chrome-generated.png"
OUTPUT = ROOT / "ui-chrome.png"
CAT_SOURCE = ROOT.parent.parent / "assets" / "characters" / "cat-peek.webp"
CAT_OUTPUT = ROOT / "cat_idle.png"

CANVAS = (780, 1688)
UNIFORM = (780, 1686)  # 1844 * 780 / 853

# (uniform_y0, uniform_y1, new_height)
BANDS = [
    (0, 76, 67),
    (76, 400, 324),
    (400, 457, 24),
    (457, 600, 143),
    (600, 1000, 439),
    (1000, 1180, 180),
    (1180, 1195, 20),
    (1195, 1686, 491),
]

# The painted board tray, measured on the assembled canvas: rim and drop shadow
# together span x 18..760, y 398..1220. The erase box clears that with a margin
# on every side so the feathered edge falls on sky, never on the golden rim; the
# HUD shadow ends at y 390 and the dock panel starts at y 1236, so the box stays
# clear of both.
RECESS_ERASE = (12, 393, 767, 1230)
# Sky strips beside the tray. Sampled outside the erase box and clear of the
# tray's own shadow, which reaches x 15 on the left and x 764 on the right.
SKY_LEFT = (1, 11)
SKY_RIGHT = (768, 779)
SKY_SMOOTH = 5      # rows either side, to keep per-row medians from banding
ERASE_FEATHER = 1.5


def old_to_uniform(y: float) -> float:
    """Map a y measured on the OLD distorted chrome back to uniform space."""
    if y < 420:
        return y * 0.99713
    if y < 1180:
        return 418.8 + (y - 420) * 1.05758
    return 1222.55 + (y - 1180) * 0.91259


def uniform_to_new(y: float) -> float:
    out = 0.0
    for y0, y1, h in BANDS:
        if y < y1:
            return out + (y - y0) * h / (y1 - y0)
        out += h
    return out


def erase_recess(chrome: Image.Image) -> Image.Image:
    """Paint the board tray out of the assembled canvas, restoring open sky.

    Each erased row is refilled by interpolating between the sky still standing
    on its own left and right — so the fill inherits the vertical gradient and
    the slight left-to-right shift of the painted sky instead of inventing a
    flat colour, and the seam lands on sky that already matches.
    """
    x0, y0, x1, y1 = RECESS_ERASE
    px = chrome.load()

    def strip_median(y, span):
        cols = [px[x, y] for x in range(*span)]
        return tuple(statistics.median(c[i] for c in cols) for i in range(3))

    def smoothed(span):
        raw = [strip_median(y, span) for y in range(y0, y1)]
        out = []
        for i in range(len(raw)):
            lo = max(0, i - SKY_SMOOTH)
            hi = min(len(raw), i + SKY_SMOOTH + 1)
            window = raw[lo:hi]
            out.append(tuple(sum(c[j] for c in window) / len(window) for j in range(3)))
        return out

    lefts, rights = smoothed(SKY_LEFT), smoothed(SKY_RIGHT)

    fill = chrome.copy()
    fp = fill.load()
    span = x1 - x0 - 1
    for i, y in enumerate(range(y0, y1)):
        left, right = lefts[i], rights[i]
        for x in range(x0, x1):
            t = (x - x0) / span
            fp[x, y] = tuple(
                int(round(left[j] + (right[j] - left[j]) * t)) for j in range(3))

    mask = Image.new("L", chrome.size, 0)
    mask.paste(255, (x0, y0, x1, y1))
    mask = mask.filter(ImageFilter.GaussianBlur(ERASE_FEATHER))
    return Image.composite(fill, chrome, mask)


def build() -> None:
    source = Image.open(SOURCE).convert("RGB")
    if source.size != (853, 1844):
        raise ValueError(f"Unexpected chrome source size: {source.size}")

    u = source.resize(UNIFORM, Image.Resampling.LANCZOS)

    chrome = Image.new("RGB", CANVAS)
    cursor = 0
    for y0, y1, h in BANDS:
        band = u.crop((0, y0, 780, y1))
        if h != y1 - y0:
            band = band.resize((780, h), Image.Resampling.LANCZOS)
        chrome.paste(band, (0, cursor))
        cursor += h
    assert cursor == CANVAS[1], cursor

    chrome = erase_recess(chrome)
    chrome.save(OUTPUT, format="PNG", optimize=True)

    cat = Image.open(CAT_SOURCE).convert("RGBA")
    cat.save(CAT_OUTPUT, format="PNG", optimize=True)

    print(f"Wrote {OUTPUT} {chrome.size}")
    print(f"Wrote {CAT_OUTPUT} {cat.size}")


def anchors() -> None:
    named = {
        "hud panel": (82, 370),
        "pause/music cy": (154.5, 154.5),
        "stage ribbon": (78, 120),
        "stage dome": (124, 238),
        "time slot": (122, 201),
        "score/combo pills": (248, 286),
        "goal groove": (326, 352),
        "board recess (designed)": (None, None),
        "dock slots": (1230, 1396),
        "speech bubble": (1451, 1583),
    }
    print(f"{'anchor':26} {'old y':>14} {'new y':>14} {'new %':>18}")
    for name, (a, b) in named.items():
        if a is None:
            print(f"{'board recess (designed)':26} {'456..1140':>14} {'415..1177':>14} "
                  f"{'24.585% h45.142%':>18}")
            continue
        na = uniform_to_new(old_to_uniform(a))
        nb = uniform_to_new(old_to_uniform(b))
        print(f"{name:26} {f'{a}..{b}':>14} {f'{na:.1f}..{nb:.1f}':>14} "
              f"{f'{na/16.88:.3f}%..{nb/16.88:.3f}%':>18}")


if __name__ == "__main__":
    if "--anchors" in sys.argv:
        anchors()
    else:
        build()
