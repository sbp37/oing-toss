#!/usr/bin/env python3
"""Build a local Pretendard subset containing every glyph used by OING."""

from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path("/tmp/PretendardVariable.woff2")
OUTPUT = ROOT / "assets/fonts/Pretendard-OING.woff2"
SCAN_PATHS = [ROOT / "index.html", ROOT / "css", ROOT / "js"]


def source_files():
    for path in SCAN_PATHS:
        if path.is_file():
            yield path
        elif path.is_dir():
            yield from path.rglob("*.css")
            yield from path.rglob("*.js")


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Missing Pretendard source font: {SOURCE}")

    text = "".join(path.read_text(encoding="utf-8") for path in source_files())
    characters = sorted(set(text))
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6]
    options.name_languages = [0x409]
    font = TTFont(SOURCE)
    worker = subset.Subsetter(options=options)
    worker.populate(text="".join(characters))
    worker.subset(font)
    font.flavor = "woff2"
    font.save(OUTPUT)
    print(f"Built {OUTPUT.name}: {len(characters)} glyphs, {OUTPUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()
