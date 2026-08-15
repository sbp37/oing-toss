#!/usr/bin/env python3
"""Build independent play-layout chrome from approved project-owned artwork."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
HUD_SOURCE = ROOT / "assets/ui/play-hud-chrome-v2.png"
BUBBLE_SOURCE = ROOT / "assets/ui/speech-bubble-v2.png"
BACKGROUND_SOURCE = ROOT / "design/play-layout-v1/source/play-bg-clear-sky-v1.png"
UI_OUT = ROOT / "assets/ui"
BG_OUT = ROOT / "assets/backgrounds"


def alpha_crop(source: Image.Image, bounds: tuple[int, int, int, int], padding: int = 10) -> Image.Image:
    region = source.crop(bounds)
    alpha_bounds = region.getchannel("A").getbbox()
    if alpha_bounds is None:
        raise ValueError(f"No opaque pixels inside {bounds}")
    left, top, right, bottom = alpha_bounds
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(region.width, right + padding)
    bottom = min(region.height, bottom + padding)
    return region.crop((left, top, right, bottom))


def save_pair(image: Image.Image, stem: str) -> None:
    png_path = UI_OUT / f"{stem}.png"
    webp_path = UI_OUT / f"{stem}.webp"
    image.save(png_path, optimize=True)
    image.save(webp_path, format="WEBP", lossless=True, method=6)


def expand_vertical_nine_slice(
    source: Image.Image,
    target_height: int,
    top_cap: int,
    bottom_cap: int,
) -> Image.Image:
    """Increase panel breathing room without stretching its painted corners."""
    if target_height <= source.height:
        raise ValueError("target_height must be larger than source height")
    middle_source = source.crop((0, top_cap, source.width, source.height - bottom_cap))
    middle_height = target_height - top_cap - bottom_cap
    middle = middle_source.resize((source.width, middle_height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (source.width, target_height))
    canvas.alpha_composite(source.crop((0, 0, source.width, top_cap)), (0, 0))
    canvas.alpha_composite(middle, (0, top_cap))
    canvas.alpha_composite(
        source.crop((0, source.height - bottom_cap, source.width, source.height)),
        (0, target_height - bottom_cap),
    )
    return canvas


def build_hud_parts() -> None:
    source = Image.open(HUD_SOURCE).convert("RGBA")
    parts = {
        "play-control-pause-v3": (35, 70, 295, 365),
        "play-control-sound-v3": (295, 70, 550, 365),
        "play-stage-badge-v3": (575, 0, 1245, 445),
        "play-timer-pill-v3": (1240, 75, 1819, 370),
        "play-status-bar-v3": (0, 430, 1819, 706),
    }
    for name, bounds in parts.items():
        part = alpha_crop(source, bounds)
        if name == "play-stage-badge-v3":
            draw = ImageDraw.Draw(part)
            font = ImageFont.truetype("/System/Library/Fonts/AppleSDGothicNeo.ttc", 52, index=14)
            text = "STAGE"
            box = draw.textbbox((0, 0), text, font=font, stroke_width=1)
            x = (part.width - (box[2] - box[0])) / 2
            draw.text(
                (x, 77),
                text,
                font=font,
                fill=(255, 252, 245, 255),
                stroke_width=2,
                stroke_fill=(192, 76, 87, 190),
            )
        elif name == "play-status-bar-v3":
            # Keep the painted recessed track, but remove its sample fill so
            # the real progress remains an HTML/CSS state.
            draw = ImageDraw.Draw(part)
            draw.rounded_rectangle(
                (785, 94, 1240, 154),
                radius=26,
                fill=(245, 235, 216, 255),
                outline=(211, 186, 145, 180),
                width=3,
            )
        save_pair(part, name)
        if name == "play-status-bar-v3":
            save_pair(expand_vertical_nine_slice(part, 300, 92, 92), "play-status-bar-v4")


def build_wide_speech_bubble() -> None:
    source = Image.open(BUBBLE_SOURCE).convert("RGBA")
    bbox = source.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("Speech bubble source is empty")
    source = source.crop(bbox)
    target_height = 230
    scaled_width = round(source.width * target_height / source.height)
    scaled = source.resize((scaled_width, target_height), Image.Resampling.LANCZOS)

    target_width = 900
    left_cap = 150
    right_cap = 105
    middle_width = target_width - left_cap - right_cap
    source_middle = scaled.crop((left_cap, 0, scaled.width - right_cap, target_height))
    middle = source_middle.resize((middle_width, target_height), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (target_width, target_height))
    canvas.alpha_composite(scaled.crop((0, 0, left_cap, target_height)), (0, 0))
    canvas.alpha_composite(middle, (left_cap, 0))
    canvas.alpha_composite(
        scaled.crop((scaled.width - right_cap, 0, scaled.width, target_height)),
        (target_width - right_cap, 0),
    )
    save_pair(canvas, "speech-bubble-wide-v3")


def build_background() -> None:
    background = Image.open(BACKGROUND_SOURCE).convert("RGB")
    background.save(BG_OUT / "play-bg-clear-sky-v5.webp", format="WEBP", quality=94, method=6)


def main() -> None:
    UI_OUT.mkdir(parents=True, exist_ok=True)
    BG_OUT.mkdir(parents=True, exist_ok=True)
    build_hud_parts()
    build_wide_speech_bubble()
    build_background()


if __name__ == "__main__":
    main()
