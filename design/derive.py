"""Derive every shipped image from the masters in this directory.

Run from the repository root with Pillow available:

    python3 design/derive.py

Outputs
  public/icon-512.png, public/icon-192.png, public/apple-touch-icon.png
      Full-bleed app icons; iOS and Android apply their own corner mask.
  public/icon-512-maskable.png
      The same art scaled so it fits the maskable safe zone (a circle of
      radius 40% of the canvas) and padded with the icon's own background.
  src/assets/empty-state-chest.png
      Transparent spot illustration for empty list states (480 px square).
  src/assets/hint-add-to-home-screen.png
      Transparent Share -> Add pictogram for the first-launch hint.
  design/social-banner.png
      1280x640 GitHub social preview: the icon's book composited onto a
      charcoal field with the wordmark and tagline set in a serif face.
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DESIGN = ROOT / "design"
PUBLIC = ROOT / "public"
ASSETS = ROOT / "src" / "assets"

CREAM = (246, 244, 239)
COPPER = (224, 138, 79)

SERIF_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"


def save_flat(im: Image.Image, path: Path) -> None:
    """Save flat three-colour art as a small palette PNG.

    The generated masters carry film-grain noise that survives downscaling and
    roughly doubles PNG size; a palette of 64 (opaque) or 128 (with alpha)
    colours is visually identical for this art and much smaller.
    """
    if im.mode == "RGBA":
        q = im.quantize(colors=128, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    else:
        q = im.convert("RGB").quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    q.save(path, optimize=True)


def denoised(im: Image.Image) -> Image.Image:
    """Median filter that removes the render grain without softening flat edges."""
    return im.filter(ImageFilter.MedianFilter(5))


def border_colour(im: Image.Image) -> tuple[int, int, int]:
    """Most common colour along the outer 2% of the image: the flat background."""
    rgb = im.convert("RGB")
    w, h = rgb.size
    m = max(2, int(min(w, h) * 0.02))
    px = rgb.load()
    samples = Counter(
        px[x, y]
        for x in range(w)
        for y in (*range(0, m), *range(h - m, h))
    )
    samples.update(px[x, y] for y in range(h) for x in (*range(0, m), *range(w - m, w)))
    return samples.most_common(1)[0][0]


def content_bbox(im: Image.Image, bg: tuple[int, int, int], tol: int = 14) -> tuple[int, int, int, int]:
    """Bounding box of pixels that differ from the flat background colour."""
    rgb = im.convert("RGB")
    diff = Image.eval(
        Image.merge("RGB", [Image.eval(ch, lambda v, b=b: abs(v - b)) for ch, b in zip(rgb.split(), bg)]),
        lambda v: 255 if v > tol else 0,
    ).convert("L")
    box = diff.getbbox()
    assert box is not None, "image is entirely background"
    return box


def icons() -> None:
    master = denoised(Image.open(DESIGN / "app-icon-master.png").convert("RGB"))
    bg = border_colour(master)

    for name, size in (("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180)):
        save_flat(master.resize((size, size), Image.LANCZOS), PUBLIC / name)

    # Maskable: the art must sit inside a circle of radius 0.4 * size. Scale the
    # whole master so its content bbox fits that circle, then pad with the
    # sampled background so the seam is invisible.
    size = 512
    left, top, right, bottom = content_bbox(master, bg)
    w, h = master.size
    half_w = max(w / 2 - left, right - w / 2) / w
    half_h = max(h / 2 - top, bottom - h / 2) / h
    radius = (half_w**2 + half_h**2) ** 0.5
    scale = min(1.0, 0.4 / radius) * 0.98  # small margin inside the safe zone
    inner = round(size * scale)
    canvas = Image.new("RGB", (size, size), bg)
    canvas.paste(master.resize((inner, inner), Image.LANCZOS), ((size - inner) // 2, (size - inner) // 2))
    save_flat(canvas, PUBLIC / "icon-512-maskable.png")


def transparent_crop(src: Path, dst: Path, *, size: tuple[int, int], pad: float) -> None:
    im = Image.open(src).convert("RGBA")
    box = im.getchannel("A").getbbox()
    assert box is not None
    left, top, right, bottom = box
    bw, bh = right - left, bottom - top
    # Pad proportionally, then letterbox into the target aspect ratio.
    px, py = int(bw * pad), int(bh * pad)
    crop = im.crop((left - px, top - py, right + px, bottom + py))
    target_ratio = size[0] / size[1]
    cw, ch = crop.size
    if cw / ch > target_ratio:
        canvas_size = (cw, round(cw / target_ratio))
    else:
        canvas_size = (round(ch * target_ratio), ch)
    canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    canvas.paste(crop, ((canvas_size[0] - cw) // 2, (canvas_size[1] - ch) // 2))
    save_flat(canvas.resize(size, Image.LANCZOS), dst)


def illustrations() -> None:
    ASSETS.mkdir(exist_ok=True)
    transparent_crop(
        DESIGN / "empty-state-chest-master.png",
        ASSETS / "empty-state-chest.png",
        size=(480, 480),
        pad=0.06,
    )
    transparent_crop(
        DESIGN / "hint-add-to-home-screen-master.png",
        ASSETS / "hint-add-to-home-screen.png",
        size=(720, 300),
        pad=0.05,
    )


def banner() -> None:
    W, H = 1280, 640
    master = denoised(Image.open(DESIGN / "app-icon-master.png").convert("RGB"))
    bg = border_colour(master)
    canvas = Image.new("RGB", (W, H), bg)

    # Book from the icon master, left third, ~66% of the banner height.
    book = master.crop(content_bbox(master, bg))
    book_h = round(H * 0.66)
    book_w = round(book.width * book_h / book.height)
    book = book.resize((book_w, book_h), Image.LANCZOS)
    book_x = round(W * (1 / 3) / 2 - book_w / 2) + 20
    canvas.paste(book, (book_x, (H - book_h) // 2))

    draw = ImageDraw.Draw(canvas)
    text_x = round(W / 3) + 40
    max_w = W - text_x - 48

    name = "Hordbook"
    tag1 = "A personal word hoard for learning English,"
    tag2 = "one collection at a time."

    def fit(path: str, start: int, texts: list[str]) -> ImageFont.FreeTypeFont:
        """Largest size at or below `start` where every line fits in max_w."""
        size = start
        while size > 8:
            font = ImageFont.truetype(path, size)
            if all(draw.textlength(t, font=font) <= max_w for t in texts):
                return font
            size -= 2
        return ImageFont.truetype(path, size)

    wordmark = fit(SERIF_BOLD, 132, [name])
    tagline = fit(SERIF, 36, [tag1, tag2])

    name_box = draw.textbbox((0, 0), name, font=wordmark)
    tag_box = draw.textbbox((0, 0), tag1, font=tagline)
    name_h = name_box[3] - name_box[1]
    tag_h = tag_box[3] - tag_box[1]
    gap, line_gap = 34, 14
    block_h = name_h + gap + tag_h + line_gap + tag_h
    y = (H - block_h) // 2 - name_box[1]

    draw.text((text_x, y), name, font=wordmark, fill=CREAM)
    y += name_h + gap + name_box[1] - tag_box[1]
    draw.text((text_x, y), tag1, font=tagline, fill=COPPER)
    y += tag_h + line_gap
    draw.text((text_x, y), tag2, font=tagline, fill=COPPER)

    save_flat(canvas, DESIGN / "social-banner.png")


if __name__ == "__main__":
    icons()
    illustrations()
    banner()
    for p in sorted([*PUBLIC.glob("*.png"), *ASSETS.glob("*.png"), DESIGN / "social-banner.png"]):
        with Image.open(p) as im:
            print(f"{p.relative_to(ROOT)}: {im.size[0]}x{im.size[1]} {im.mode}")
