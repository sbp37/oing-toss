#!/usr/bin/env python3
"""Build the fixed OING play chrome at the approved 2x mobile canvas."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source" / "ui-chrome-generated.png"
OUTPUT = ROOT / "ui-chrome.png"
CAT_SOURCE = ROOT.parent.parent / "assets" / "characters" / "cat-peek.webp"
CAT_OUTPUT = ROOT / "cat_idle.png"


def resize_region(image: Image.Image, box: tuple[int, int, int, int], size: tuple[int, int]) -> Image.Image:
    return image.crop(box).resize(size, Image.Resampling.LANCZOS)


def main() -> None:
    source = Image.open(SOURCE).convert("RGB")
    if source.size != (853, 1844):
        raise ValueError(f"Unexpected chrome source size: {source.size}")

    # Region-wise normalization prevents the generated board shell from becoming
    # vertically stretched while preserving the tall stage arch and thick dock.
    chrome = Image.new("RGB", (780, 1688))
    chrome.paste(resize_region(source, (0, 0, 853, 458), (780, 420)), (0, 0))
    chrome.paste(resize_region(source, (0, 458, 853, 1337), (780, 760)), (0, 420))
    chrome.paste(resize_region(source, (0, 1337, 853, 1844), (780, 508)), (0, 1180))
    chrome.save(OUTPUT, format="PNG", optimize=True)

    cat = Image.open(CAT_SOURCE).convert("RGBA")
    cat.save(CAT_OUTPUT, format="PNG", optimize=True)

    print(f"Wrote {OUTPUT} {chrome.size}")
    print(f"Wrote {CAT_OUTPUT} {cat.size}")


if __name__ == "__main__":
    main()
