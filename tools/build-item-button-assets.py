#!/usr/bin/env python3
"""Normalize generated item-button shells and render an approval preview."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/ui/item-buttons-v1"
PREVIEW = ROOT / "assets/source/item-buttons-v3-rounded-font-preview.png"
DISPLAY_FONT = ROOT / "assets/fonts/candidates/BagelFatOne-Regular.ttf"
SOURCES = {
    "hint": ROOT / "assets/source/button-hint-syrup-v1-alpha.png",
    "shuffle": ROOT / "assets/source/button-shuffle-syrup-v1-alpha.png",
}
ICONS = {
    "hint": ROOT / "assets/icons/items/hint.webp",
    "shuffle": ROOT / "assets/icons/items/shuffle.webp",
}


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/AppleSDGothicNeo.ttc",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size=size, index=7 if bold else 4)
        except (OSError, ValueError):
            try:
                return ImageFont.truetype(candidate, size=size)
            except OSError:
                pass
    return ImageFont.load_default()


def display_font(size: int) -> ImageFont.FreeTypeFont:
    """Bagel Fat One is used only for the approval mockup until it is signed off."""
    return ImageFont.truetype(DISPLAY_FONT, size=size)


def contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    copy = image.copy()
    copy.thumbnail(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size)
    canvas.alpha_composite(copy, ((size[0] - copy.width) // 2, (size[1] - copy.height) // 2))
    return canvas


def normalize(source: Path) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise RuntimeError(f"no visible pixels: {source}")
    cropped = image.crop(bbox)
    canvas = Image.new("RGBA", (540, 180))
    cropped.thumbnail((526, 166), Image.Resampling.LANCZOS)
    canvas.alpha_composite(cropped, ((540 - cropped.width) // 2, (180 - cropped.height) // 2))
    return canvas


def save_assets() -> dict[str, Image.Image]:
    OUT.mkdir(parents=True, exist_ok=True)
    built = {}
    for name, source in SOURCES.items():
        image = normalize(source)
        built[name] = image
        image.save(OUT / f"button-{name}.png", optimize=True)
        image.save(OUT / f"button-{name}.webp", format="WEBP", lossless=True, method=6)
    return built


def shadowed_button(shell: Image.Image, size: tuple[int, int], pressed: bool = False, disabled: bool = False) -> Image.Image:
    button = contain(shell, size)
    if disabled:
        rgb = ImageOps.grayscale(button.convert("RGB")).convert("RGBA")
        rgb.putalpha(button.getchannel("A").point(lambda value: int(value * 0.58)))
        button = rgb
    if pressed:
        button = button.resize((size[0] - 6, size[1] - 8), Image.Resampling.LANCZOS)

    pad = 24
    canvas = Image.new("RGBA", (size[0] + pad * 2, size[1] + pad * 2))
    shadow = Image.new("RGBA", canvas.size)
    alpha = Image.new("L", canvas.size)
    x = (canvas.width - button.width) // 2
    y = (canvas.height - button.height) // 2 + (5 if pressed else 0)
    alpha.paste(button.getchannel("A"), (x, y + (5 if pressed else 8)))
    alpha = alpha.filter(ImageFilter.GaussianBlur(7)).point(lambda value: int(value * (0.13 if pressed else 0.2)))
    shadow.putalpha(alpha)
    warm = Image.new("RGBA", canvas.size, (131, 101, 73, 0))
    warm.putalpha(alpha)
    canvas.alpha_composite(warm)
    canvas.alpha_composite(button, (x, y))
    return canvas


def place_centered_text(draw: ImageDraw.ImageDraw, center_x: float, center_y: float, text: str, text_font: ImageFont.FreeTypeFont, color: str) -> None:
    box = draw.textbbox((0, 0), text, font=text_font)
    x = center_x - (box[0] + box[2]) / 2
    y = center_y - (box[1] + box[3]) / 2
    draw.text((x, y), text, font=text_font, fill=color)


def compose_game_button(shell: Image.Image, icon_path: Path, label: str, count: int, disabled: bool = False, pressed: bool = False) -> Image.Image:
    width, height = 350, 120
    canvas = shadowed_button(shell, (width, height), pressed=pressed, disabled=disabled)
    draw = ImageDraw.Draw(canvas)
    ox, oy = 24, 24 + (4 if pressed else 0)

    icon = contain(Image.open(icon_path).convert("RGBA"), (54, 54))
    if disabled:
        icon_alpha = icon.getchannel("A")
        icon = ImageOps.grayscale(icon.convert("RGB")).convert("RGBA")
        icon.putalpha(icon_alpha.point(lambda value: int(value * 0.55)))

    label_color = "#5e5148" if not disabled else "#9c948e"
    label_font = display_font(37)

    # Center the icon + label as a single visual group inside the shell.
    icon_size = 54
    gap = 12
    label_box = draw.textbbox((0, 0), label, font=label_font)
    label_width = label_box[2] - label_box[0]
    group_width = icon_size + gap + label_width
    group_left = ox + (width - group_width) / 2
    group_center_y = oy + height / 2 - 1
    canvas.alpha_composite(icon, (round(group_left), round(group_center_y - icon_size / 2)))
    label_center_x = group_left + icon_size + gap + label_width / 2
    place_centered_text(draw, label_center_x, group_center_y + 1, label, label_font, label_color)

    badge_box = (ox + width - 57, oy + 6, ox + width - 9, oy + 54)
    badge_fill = "#ff6f91" if not disabled else "#c9c1bd"
    draw.ellipse(badge_box, fill=badge_fill, outline="#fff8ee", width=4)
    place_centered_text(
        draw,
        (badge_box[0] + badge_box[2]) / 2,
        (badge_box[1] + badge_box[3]) / 2,
        str(count),
        display_font(25),
        "#ffffff",
    )
    return canvas


def make_preview(shells: dict[str, Image.Image]) -> None:
    canvas = Image.new("RGBA", (1000, 1480), "#fff8e9")
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((38, 36, 962, 1444), 44, fill="#fffdf7", outline="#ead8ba", width=3)
    draw.text((76, 68), "ITEM BUTTONS · FONT / CENTERING CHECK", font=font(34, bold=True), fill="#6b5650")
    draw.text((76, 118), "Bagel Fat One · rounded display font · optical centering", font=font(21), fill="#9a7f76")

    # Large material check without text or icons baked into the image.
    for index, name in enumerate(("hint", "shuffle")):
        y = 184 + index * 320
        draw.text((92, y), f"{name.upper()} · EMPTY SHELL", font=font(20, bold=True), fill="#8e746b")
        large = shadowed_button(shells[name], (720, 240))
        canvas.alpha_composite(large, (116, y + 26))

    draw.text((76, 842), "390px MOBILE SCALE · 2× RENDER", font=font(25, bold=True), fill="#6b5650")
    draw.rounded_rectangle((68, 892, 932, 1276), 38, fill="#fffaf0", outline="#ead9bc", width=3)

    hint = compose_game_button(shells["hint"], ICONS["hint"], "힌트", 3)
    shuffle = compose_game_button(shells["shuffle"], ICONS["shuffle"], "섞기", 2)
    canvas.alpha_composite(hint, (55, 910))
    canvas.alpha_composite(shuffle, (505, 910))

    pressed = compose_game_button(shells["hint"], ICONS["hint"], "힌트", 3, pressed=True)
    disabled = compose_game_button(shells["shuffle"], ICONS["shuffle"], "섞기", 0, disabled=True)
    canvas.alpha_composite(pressed, (55, 1052))
    canvas.alpha_composite(disabled, (505, 1052))
    draw.text((174, 1200), "PRESSED", font=font(18, bold=True), fill="#a08478")
    draw.text((631, 1200), "DISABLED", font=font(18, bold=True), fill="#a08478")
    draw.rounded_rectangle((76, 1280, 924, 1408), 28, fill="#fff8eb", outline="#ead9bc", width=2)
    place_centered_text(draw, 500, 1325, "힌트  ·  섞기  ·  시작하기", display_font(42), "#5e5148")
    place_centered_text(draw, 500, 1376, "딱 10이야!  오잉! 바로 찾았네!", display_font(28), "#a45662")
    canvas.save(PREVIEW, optimize=True)


def main() -> None:
    shells = save_assets()
    make_preview(shells)


if __name__ == "__main__":
    main()
