#!/usr/bin/env python3
"""오잉 카드 그림을 게임에 넣을 두 가지 크기로 굽는다.

카드는 게임을 느리게 만들면 안 된다. 그래서 한 장을 두 벌로 나눈다.

  썸네일  기록 창의 세 칸 격자에 깔린다. 아홉 장이 한꺼번에 뜨므로 가장 작아야
          한다. 화면에서 약 100dp 폭이라 3배 화면을 감안해 300px면 충분하다.
  원본    카드를 눌러 크게 볼 때만 받는다. 아홉 장 중 한 장씩만 필요하므로
          품질을 챙긴다. 챕터 그림과 같은 1086x1448.

둘 다 화면에 처음 들어오는 순간까지 요청되지 않는다. 기록 창은 첫 화면이
아니고, 원본은 카드를 눌러야 열린다. 시작 화면 속도에는 영향이 없다.

품질은 고정값이 아니라 목표 용량에 맞춰 내려가며 찾는다. 그림마다 복잡도가
달라서 같은 품질값이 같은 용량을 주지 않기 때문이다.

사용법:
    python3 tools/build-card-assets.py <원본폴더>

원본 파일 이름은 카드 key와 같아야 한다 (js/data.js의 OING_CARDS):
    first-run.png  ten-runs.png  cats-100.png ...  back.png
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT_FULL = ROOT / "assets/cards"
OUT_THUMB = ROOT / "assets/cards/thumbs"

FULL_SIZE = (1086, 1448)     # 챕터 그림과 같은 3:4
THUMB_SIZE = (300, 400)
FULL_BUDGET = 170 * 1024     # 챕터 그림이 148~188KB이므로 그 안쪽
THUMB_BUDGET = 13 * 1024     # 챕터 썸네일이 10~12KB


def encode_within(image, size, budget, path):
    """목표 용량 안에 들어올 때까지 품질을 낮춰가며 굽는다."""
    resized = image.convert("RGB").resize(size, Image.LANCZOS)
    for quality in (92, 88, 84, 80, 76, 72, 68, 64, 60):
        resized.save(path, "WEBP", quality=quality, method=6)
        if path.stat().st_size <= budget:
            return quality, path.stat().st_size
    return quality, path.stat().st_size


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    source_dir = Path(sys.argv[1])
    if not source_dir.is_dir():
        raise SystemExit(f"원본 폴더가 없다: {source_dir}")

    sources = sorted(
        path for path in source_dir.iterdir()
        if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}
    )
    if not sources:
        raise SystemExit(f"{source_dir} 안에 그림이 없다")

    OUT_FULL.mkdir(parents=True, exist_ok=True)
    OUT_THUMB.mkdir(parents=True, exist_ok=True)

    total_full = 0
    total_thumb = 0
    for source in sources:
        stem = source.stem
        name = stem if stem.startswith("card-") or stem == "back" else f"card-{stem}"
        image = Image.open(source)
        if image.width * 4 != image.height * 3:
            print(f"  주의: {source.name}은 3:4가 아니다 ({image.width}x{image.height}) - 늘려서 맞춘다")

        full_path = OUT_FULL / f"{name}.webp"
        thumb_path = OUT_THUMB / f"{name}.webp"
        full_quality, full_bytes = encode_within(image, FULL_SIZE, FULL_BUDGET, full_path)
        thumb_quality, thumb_bytes = encode_within(image, THUMB_SIZE, THUMB_BUDGET, thumb_path)
        total_full += full_bytes
        total_thumb += thumb_bytes

        flag = "" if full_bytes <= FULL_BUDGET and thumb_bytes <= THUMB_BUDGET else "  <- 예산 초과"
        print(
            f"{name:22} 원본 {full_bytes/1024:5.0f}KB(q{full_quality})"
            f"  썸네일 {thumb_bytes/1024:4.0f}KB(q{thumb_quality}){flag}"
        )

    print()
    print(f"썸네일 합계 {total_thumb/1024:.0f}KB  <- 기록 창을 열 때 한 번에 받는 양")
    print(f"원본 합계   {total_full/1024:.0f}KB  <- 카드를 눌러야 한 장씩 받는다")
    print()
    print("다음: js/data.js의 OING_CARDS에서 그림이 준비된 카드의 hasArt를 true로 바꾼다.")


if __name__ == "__main__":
    main()
