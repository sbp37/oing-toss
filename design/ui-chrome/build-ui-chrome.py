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
with. The faint 4x4 pencil grid on the recess floor never matched the live
grid (the CSS board paints its own), so the floor is blurred clean before the
bands are cut — the stages whose boards do not fill the recess show painted
floor above and below the board, and that margin must not carry stale lines.

Every CSS anchor in css/ui-chrome.css was re-derived through the same band
map; run this script with --anchors to print the mapping used there.
"""

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

# The recess floor carries a faint painted pencil grid that never matched the
# live board, so it is erased region by region (uniform-space boxes). The open
# floor gets a synthetic smooth gradient (8x10 box-average of itself, so its
# vignette survives while anything line-sized vanishes). The frame lips and the
# side shadow bands each vary along one axis only, so a smear along that axis
# removes the grid ticks crossing them without softening the painted edges.
FLOOR_BOX = (96, 505, 684, 1140)
LIP_BOXES = [(90, 450, 690, 512), (90, 1132, 690, 1184)]      # horizontal smear
SIDE_BOXES = [(64, 505, 98, 1140), (682, 505, 716, 1140)]     # vertical smear


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


def build() -> None:
    source = Image.open(SOURCE).convert("RGB")
    if source.size != (853, 1844):
        raise ValueError(f"Unexpected chrome source size: {source.size}")

    u = source.resize(UNIFORM, Image.Resampling.LANCZOS)

    def patch(box, small_size, inset):
        region = u.crop(box)
        clean = region.resize(small_size, Image.Resampling.BOX).resize(
            region.size, Image.Resampling.BICUBIC)
        mask = Image.new("L", region.size, 0)
        mask.paste(255, (inset[0], inset[1],
                         region.size[0] - inset[0], region.size[1] - inset[1]))
        mask = mask.filter(ImageFilter.GaussianBlur(6))
        u.paste(Image.composite(clean, region, mask), box[:2])

    patch(FLOOR_BOX, (8, 10), (16, 16))
    for box in LIP_BOXES:
        patch(box, (24, box[3] - box[1]), (14, 0))
    for box in SIDE_BOXES:
        patch(box, (box[2] - box[0], 24), (0, 14))

    chrome = Image.new("RGB", CANVAS)
    cursor = 0
    for y0, y1, h in BANDS:
        band = u.crop((0, y0, 780, y1))
        if h != y1 - y0:
            band = band.resize((780, h), Image.Resampling.LANCZOS)
        chrome.paste(band, (0, cursor))
        cursor += h
    assert cursor == CANVAS[1], cursor
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
