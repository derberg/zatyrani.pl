#!/usr/bin/env python3
"""
Race bib generator – NieboCross style.
Inter fonts, rainbow colours from the logo heart, text always fits.

Usage:
  python3 generate_bibs.py \
    --event "NieboCross - Pamięci Marka Nowakowskiego dla OTOZ Animals" \
    --date "12 kwietnia 2026" \
    --bieg9km 100 --bieg3km 50 --nw3km 35 --nw9km 35 --dzieci 30
"""

import argparse, io, os, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.utils import ImageReader

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
FONTS        = os.path.join(ROOT, "fonts")
LOGO_NC      = os.path.join(ROOT, "public", "niebocross_logo.webp")
LOGO_ZAT     = os.path.join(ROOT, "public", "zatyrani_logo.webp")
LOGO_OTOZ_SVG= os.path.join(ROOT, "public", "niebocross", "otoz.png")
LOGO_OTOZ_PNG= "/tmp/otoz_bib.png"
BG_COLORS    = os.path.join(ROOT, "public", "niebocross", "colors.png")
PARTNER_LOGOS = [
    os.path.join(ROOT, "public", "niebocross", "klinika.webp"),
    os.path.join(ROOT, "public", "gratisownia.png"),
    os.path.join(ROOT, "public", "niebocross", "dom100eu.png"),
    os.path.join(ROOT, "public", "niebocross", "nieborowice.webp"),
    os.path.join(ROOT, "public", "niebocross", "kgigw.jpg"),
    os.path.join(ROOT, "public", "niebocross", "gok.png"),
    os.path.join(ROOT, "public", "niebocross", "autocentrum.jpg"),
    os.path.join(ROOT, "public", "niebocross", "ppk.jpg"),
    os.path.join(ROOT, "public", "niebocross", "gobe.webp"),
    os.path.join(ROOT, "public", "niebocross", "dobrenasiona.webp"),
    os.path.join(ROOT, "public", "niebocross", "bemar.png"),
    os.path.join(ROOT, "public", "niebocross", "ergocomplex.jpeg"),
    os.path.join(ROOT, "public", "niebocross", "przedszkole.png"),
]

# Per-logo height scale overrides (default 1.0)
PARTNER_SCALE = {
    "dom100eu.png": 0.5,
}

# Partners without logos – rendered as text PNGs
PARTNER_TEXT = [
    'Sklep Zoologiczno-\nWędkarski "Karaś"\nz Olkusza',
]

F_BLACK   = os.path.join(FONTS, "Inter-Black.ttf")
F_BOLD    = os.path.join(FONTS, "Inter-Bold.ttf")
F_SEMI    = os.path.join(FONTS, "Inter-SemiBold.ttf")
F_REG     = os.path.join(FONTS, "Inter-Regular.ttf")

# ── Colours from the NieboCross logo heart (left → right rainbow) ─────────────
RAINBOW = [
    (63,  159, 216),   # blue      #3F9FD8
    (24,  178, 178),   # teal      #18B2B2
    (99,  191, 125),   # green     #63BF7D
    (140, 199,  85),   # lime      #8AC754
    (245, 221,  88),   # yellow    #F5DD58
    (234, 155, 112),   # orange    #EA9B70
    (219,  38, 122),   # magenta   #DB267A
    (125,  92, 155),   # purple    #7D5C9B
]

# Per-category accent colour (pill + border)
CATEGORY_ACCENT = {
    "Bieg 9km":    (219,  38, 122),   # pink
    "Bieg 3km":    (63,  159, 216),   # blue
    "NW 3km":      (218, 180,  30),   # darker yellow
    "NW 9km":      (0,  100,   0),   # dark green
    "Dzieci 100m": (255, 120,  30),   # orange
    "Dzieci 200m": (99,  191, 125),   # green
    "Dzieci 400m": (0,   206, 209),   # turquoise
    "Dzieci 800m": (125,  92, 155),   # purple
    "Brak":         (180, 180, 180),   # grey
    "Bieg Testowy": (138,   3,   3),  # blood red
}

NC_NAVY  = (50,  66,  96)
NC_WHITE = (255, 255, 255)
NC_YELLOW= (245, 221,  88)

# ── Canvas  22 cm × 15 cm @ 300 DPI ──────────────────────────────────────────
DPI = 300
W   = round(22 * DPI / 2.54)   # 2598
H   = round(15.5 * DPI / 2.54)  # 1831

# ── Font helpers ──────────────────────────────────────────────────────────────
def fnt(path, size): return ImageFont.truetype(path, size)

def fit_font(draw, text, path, max_w, max_h, start=300):
    """Return the largest font (starting from start) that fits in max_w × max_h."""
    size = start
    while size > 10:
        f = fnt(path, size)
        bb = draw.textbbox((0, 0), text, font=f)
        if (bb[2] - bb[0]) <= max_w and (bb[3] - bb[1]) <= max_h:
            return f, size
        size -= 4
    return fnt(path, 10), 10

def draw_centred(draw, text, f, color, x1, y1, x2, y2):
    """Pixel-accurate centering using the full bbox origin, not just width."""
    bb = draw.textbbox((0, 0), text, font=f)
    # bb[0]/bb[1] may be non-zero (left/top bearing), account for them
    cx = (x1 + x2) // 2 - (bb[0] + bb[2]) // 2
    cy = (y1 + y2) // 2 - (bb[1] + bb[3]) // 2
    draw.text((cx, cy), text, font=f, fill=color)

def draw_rounded_rect(draw, xy, r, fill, outline=None, width=0):
    draw.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=width)

# ── Category circle badge ─────────────────────────────────────────────────────
_badge_cache = {}
def make_category_badge(category, size=300):
    """Generate a circle badge PNG for the category, cached."""
    if category in _badge_cache:
        return _badge_cache[category]
    accent = CATEGORY_ACCENT.get(category, RAINBOW[0])
    badge = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(badge)
    # Empty grey circle for "Brak" category
    if category == "Brak":
        d.ellipse([4, 4, size - 5, size - 5], fill=None, outline=(180, 180, 180, 255), width=6)
        _badge_cache[category] = badge
        return badge
    # filled circle
    d.ellipse([4, 4, size - 5, size - 5], fill=accent, outline=(255,255,255,255), width=6)
    # text
    cat_upper = category.upper()
    # Split into two lines if space exists
    words = cat_upper.split()
    if len(words) == 2:
        line1, line2 = words
    else:
        line1, line2 = cat_upper, ""
    max_tw = int(size * 0.65)
    f1, _ = fit_font(d, line1, F_BLACK, max_tw, size // 3, start=90)
    if line2:
        f2, _ = fit_font(d, line2, F_BLACK, max_tw, size // 3, start=90)
        # Use smaller of the two
        sz = min(_, fit_font(d, line1, F_BLACK, max_tw, size // 3, start=90)[1])
        f1 = fnt(F_BLACK, sz)
        f2 = fnt(F_BLACK, sz)
        gap = 8
        bb1 = d.textbbox((0,0), line1, font=f1)
        bb2 = d.textbbox((0,0), line2, font=f2)
        h1 = bb1[3] - bb1[1]
        h2 = bb2[3] - bb2[1]
        total = h1 + gap + h2
        cy = size // 2 - total // 2
        draw_centred(d, line1, f1, (255,255,255), 0, cy, size, cy + h1)
        draw_centred(d, line2, f2, (255,255,255), 0, cy + h1 + gap, size, cy + h1 + gap + h2)
    else:
        draw_centred(d, line1, f1, (255,255,255), 0, 0, size, size)
    _badge_cache[category] = badge
    return badge

_sos_badge = None
def make_sos_badge(w=500, h=300):
    """Generate an oval SOS badge with contacts on separate lines."""
    global _sos_badge
    if _sos_badge is not None:
        return _sos_badge
    badge = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(badge)
    # red oval
    d.rounded_rectangle([4, 4, w - 5, h - 5], radius=h // 2,
                        fill=(220, 30, 30), outline=(255, 255, 255, 255), width=6)
    # SOS title
    title_fnt, _ = fit_font(d, "SOS", F_BLACK, int(w * 0.5), h // 4, start=72)
    lines = [
        "Łukasz 784 640 977",
        "Arek 513 592 253",
    ]
    line_fnt, _ = fit_font(d, lines[0], F_BOLD, int(w * 0.75), h // 5, start=40)
    # measure
    title_bb = d.textbbox((0, 0), "SOS", font=title_fnt)
    title_h = title_bb[3] - title_bb[1]
    line_bb = d.textbbox((0, 0), lines[0], font=line_fnt)
    line_h = line_bb[3] - line_bb[1]
    gap = 12
    total = title_h + gap + line_h * 2 + gap
    cy = h // 2 - total // 2
    draw_centred(d, "SOS", title_fnt, (255, 255, 255), 0, cy, w, cy + title_h)
    cy += title_h + gap
    for line in lines:
        draw_centred(d, line, line_fnt, (255, 255, 255), 0, cy, w, cy + line_h)
        cy += line_h + gap
    _sos_badge = badge
    return badge

# ── Logo paste ────────────────────────────────────────────────────────────────
def strip_white_bg(img_rgba, threshold=240):
    import numpy as np
    arr = np.array(img_rgba, dtype=np.uint16)
    r, g, b = arr[...,0], arr[...,1], arr[...,2]
    near_white = (r >= threshold) & (g >= threshold) & (b >= threshold)
    arr[near_white, 3] = 0
    return Image.fromarray(arr.astype(np.uint8), "RGBA")

def paste_logo(img, path, target_h, x_anchor, cy_top, align="center"):
    """
    align='center' → x_anchor is the horizontal centre of the logo
    align='left'   → x_anchor is the left edge
    align='right'  → x_anchor is the right edge
    """
    limg  = Image.open(path).convert("RGBA")
    limg  = strip_white_bg(limg)
    ratio = target_h / limg.height
    lw    = int(limg.width * ratio)
    limg  = limg.resize((lw, target_h), Image.LANCZOS)
    if align == "left":
        x = x_anchor
    elif align == "right":
        x = x_anchor - lw
    else:
        x = x_anchor - lw // 2
    base = img.convert("RGBA")
    base.paste(limg, (x, cy_top), limg)
    return base.convert("RGB")

def ensure_otoz():
    if os.path.exists(LOGO_OTOZ_PNG):
        return True
    if os.path.exists(LOGO_OTOZ_SVG):
        # If source is already a raster image (png/jpg), just copy it
        if LOGO_OTOZ_SVG.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
            Image.open(LOGO_OTOZ_SVG).save(LOGO_OTOZ_PNG)
            return True
        # Otherwise rasterize SVG with qlmanage
        try:
            with tempfile.TemporaryDirectory() as tmp:
                r = subprocess.run(["qlmanage", "-t", "-s", "3000", "-o", tmp, LOGO_OTOZ_SVG],
                                   capture_output=True)
                base = os.path.basename(LOGO_OTOZ_SVG) + ".png"
                src = os.path.join(tmp, base)
                if r.returncode == 0 and os.path.exists(src):
                    Image.open(src).save(LOGO_OTOZ_PNG)
                    return True
        except Exception:
            pass
    return False

def make_text_logo(text, target_h=200):
    """Generate a PNG image with the partner name rendered as text.
    The image is padded vertically so that when scaled to target_h the text
    appears at roughly half the row height."""
    tmp = Image.new("RGBA", (1, 1))
    d = ImageDraw.Draw(tmp)
    f = fnt(F_BOLD, 40)
    bb = d.multiline_textbbox((0, 0), text, font=f, align="center")
    text_w, text_h = int(bb[2] - bb[0]), int(bb[3] - bb[1])
    # Add vertical padding so text occupies ~half the height
    pad = 20
    canvas_h = text_h * 2 + pad
    canvas_w = text_w + pad * 2
    img = Image.new("RGBA", (canvas_w, canvas_h), (255, 255, 255, 0))
    d = ImageDraw.Draw(img)
    tx = (canvas_w - text_w) // 2 - bb[0]
    ty = (canvas_h - text_h) // 2 - bb[1]
    d.multiline_text((tx, ty), text, font=f, fill=NC_NAVY, align="center")
    return img

# ── BIB ───────────────────────────────────────────────────────────────────────
def make_bib(number, category, event_name, event_date):
    accent = CATEGORY_ACCENT.get(category, RAINBOW[0])
    PAD    = 55     # inner horizontal padding

    img  = Image.new("RGB", (W, H), NC_WHITE)
    draw = ImageDraw.Draw(img)

    # ── 1. Header: logos + category badge + SOS badge ─────────────────────
    LOGO_ROW_TOP = 0
    LOGO_ROW_H   = 280
    LOGO_ROW_BOT = LOGO_ROW_TOP + LOGO_ROW_H
    draw.rectangle([0, LOGO_ROW_TOP, W, LOGO_ROW_BOT], fill=NC_WHITE)

    LOGO_H     = 200
    LOGO_ZAT_H = 130

    # 5 items: NC logo, ZAT logo, OTOZ logo, category badge, SOS badge
    # Logos in left 3/5, badges in right 2/5
    logo_pos = [W // 6, W * 2 // 6, W * 3 // 6]
    CY_MAIN = LOGO_ROW_TOP + (LOGO_ROW_H - LOGO_H) // 2
    CY_ZAT  = LOGO_ROW_TOP + (LOGO_ROW_H - LOGO_ZAT_H) // 2

    if os.path.exists(LOGO_NC):
        img  = paste_logo(img, LOGO_NC,  LOGO_H,  logo_pos[0], CY_MAIN, align="center")
        draw = ImageDraw.Draw(img)
    if os.path.exists(LOGO_ZAT):
        img  = paste_logo(img, LOGO_ZAT, LOGO_ZAT_H, logo_pos[1], CY_ZAT, align="center")
        draw = ImageDraw.Draw(img)
    if ensure_otoz() and os.path.exists(LOGO_OTOZ_PNG):
        img  = paste_logo(img, LOGO_OTOZ_PNG, LOGO_H, logo_pos[2], CY_MAIN, align="center")
        draw = ImageDraw.Draw(img)

    # Category circle badge
    BADGE_SZ = 220
    badge = make_category_badge(category, size=BADGE_SZ)
    badge_cx = W * 4 // 6
    badge_y = LOGO_ROW_TOP + (LOGO_ROW_H - BADGE_SZ) // 2
    badge_x = badge_cx - BADGE_SZ // 2
    base = img.convert("RGBA")
    base.paste(badge, (badge_x, badge_y), badge)
    img = base.convert("RGB")
    draw = ImageDraw.Draw(img)

    # Vertical separator between logos and badges
    SEP_X = W * 3 // 6 + (W // 6) // 2
    draw.line([(SEP_X, LOGO_ROW_TOP + 30), (SEP_X, LOGO_ROW_BOT - 30)],
              fill=(*NC_NAVY, 80), width=4)

    # SOS oval badge
    SOS_W, SOS_H_BADGE = 320, 170
    sos_badge = make_sos_badge(SOS_W, SOS_H_BADGE)
    sos_cx = W * 5 // 6
    sos_y = LOGO_ROW_TOP + (LOGO_ROW_H - SOS_H_BADGE) // 2
    sos_x = sos_cx - SOS_W // 2
    base = img.convert("RGBA")
    base.paste(sos_badge, (sos_x, sos_y), sos_badge)
    img = base.convert("RGB")
    draw = ImageDraw.Draw(img)

    # Event name + charity + date rows below logos
    TEXT_W  = W - PAD * 4
    event_upper = event_name.upper()
    event_date  = event_date.upper()
    LINE_GAP = 10
    all_lines = [event_upper, event_date]
    min_size = 120
    for line in all_lines:
        _, sz = fit_font(draw, line, F_BOLD, TEXT_W, 110, start=120)
        min_size = min(min_size, sz)
    hdr_fnt = fnt(F_BOLD, min_size)

    line_heights = [draw.textbbox((0,0), l, font=hdr_fnt)[3] - draw.textbbox((0,0), l, font=hdr_fnt)[1] for l in all_lines]
    LINE_H = max(line_heights)

    # Separator line between logo row and event name
    draw.rectangle([0, LOGO_ROW_BOT, W, LOGO_ROW_BOT + 4], fill=accent)

    EV_ROW_TOP = LOGO_ROW_BOT + 4
    total_h = LINE_H * len(all_lines) + LINE_GAP * (len(all_lines) - 1)
    EV_ROW_BOT = EV_ROW_TOP + total_h + 50
    draw.rectangle([0, EV_ROW_TOP, W, EV_ROW_BOT], fill=accent)

    cy = EV_ROW_TOP + (EV_ROW_BOT - EV_ROW_TOP - total_h) // 2
    for line in all_lines:
        draw_centred(draw, line, hdr_fnt, NC_WHITE, 0, cy, W, cy + LINE_H)
        cy += LINE_H + LINE_GAP
    # White separator between title/date and number area
    SEP_H = 6
    draw.rectangle([0, EV_ROW_BOT, W, EV_ROW_BOT + SEP_H], fill=NC_WHITE)
    HEADER_BOT = EV_ROW_BOT + SEP_H

    # ── 3. Footer: partner logos (2 rows) ────────────────────────────────
    FOOTER_H    = int(LOGO_ROW_H * 1.4)  # ~40% taller than original single row
    FOOTER_TOP  = H - FOOTER_H
    ROW_GAP     = 4
    ROW_H       = (FOOTER_H - ROW_GAP) // 2  # 194px each
    PARTNER_H   = ROW_H - 30
    draw.rectangle([0, FOOTER_TOP, W, H], fill=NC_WHITE)
    # Accent separator line above footer
    draw.rectangle([0, FOOTER_TOP, W, FOOTER_TOP + 4], fill=accent)

    # Build list of partner images (from logo files and text)
    # Each entry is (image, height_scale)
    partner_imgs = []
    for p in PARTNER_LOGOS:
        if os.path.exists(p):
            scale = PARTNER_SCALE.get(os.path.basename(p), 1.0)
            partner_imgs.append((Image.open(p).convert("RGBA"), scale))
    for txt in PARTNER_TEXT:
        partner_imgs.append((make_text_logo(txt, target_h=PARTNER_H), 1.0))

    if partner_imgs:
        # Split into 2 rows
        mid = (len(partner_imgs) + 1) // 2
        rows = [partner_imgs[:mid], partner_imgs[mid:]]
        margin = PAD

        for row_idx, row_imgs in enumerate(rows):
            if not row_imgs:
                continue
            row_top = FOOTER_TOP + 4 + row_idx * (ROW_H + ROW_GAP)
            row_h = PARTNER_H
            # Pre-calculate scaled widths, applying per-logo height scale
            logo_widths = []
            logo_heights = []
            for pimg, h_scale in row_imgs:
                h = int(row_h * h_scale)
                ratio = h / pimg.height
                logo_widths.append(int(pimg.width * ratio))
                logo_heights.append(h)
            total_logos_w = sum(logo_widths)
            avail = W - 2 * margin
            # Scale down if too wide
            if total_logos_w > avail:
                shrink = avail / total_logos_w
                logo_widths = [int(lw * shrink) for lw in logo_widths]
                logo_heights = [int(lh * shrink) for lh in logo_heights]
                total_logos_w = sum(logo_widths)
            gap = (avail - total_logos_w) // max(len(row_imgs) - 1, 1)
            x = margin
            for i, (pimg, _) in enumerate(row_imgs):
                pimg = strip_white_bg(pimg)
                lw, lh = logo_widths[i], logo_heights[i]
                scaled = pimg.resize((lw, lh), Image.LANCZOS)
                # Vertically centre each logo in the row
                py = row_top + (ROW_H - lh) // 2
                base = img.convert("RGBA")
                base.paste(scaled, (x, py), scaled)
                img = base.convert("RGB")
                draw = ImageDraw.Draw(img)
                x += lw + gap

    # ── 5. Number (fills remaining space) ────────────────────────────────────
    NUM_TOP    = HEADER_BOT
    NUM_BOTTOM = FOOTER_TOP
    NUM_W      = W
    NUM_H      = NUM_BOTTOM - NUM_TOP

    # Paste colorful background behind the number area (80% opacity)
    if os.path.exists(BG_COLORS):
        bg = Image.open(BG_COLORS).convert("RGBA")
        bg = bg.resize((W, NUM_H), Image.LANCZOS)
        bg.putalpha(255)
        base = img.convert("RGBA")
        base.paste(bg, (0, NUM_TOP), bg)
        img = base.convert("RGB")
        draw = ImageDraw.Draw(img)

    num_str = f"{number:03d}"
    num_fnt, _ = fit_font(draw, num_str, F_BLACK, NUM_W, NUM_H, start=1000)

    # pixel-accurate centre — no shadow offset so number is visually centred
    bb = draw.textbbox((0, 0), num_str, font=num_fnt)
    nx = W // 2                  - (bb[0] + bb[2]) // 2
    ny = (NUM_TOP + NUM_BOTTOM) // 2 - (bb[1] + bb[3]) // 2
    # Black outline then white fill
    for ox, oy in [(-6,0),(6,0),(0,-6),(0,6),(-4,-4),(-4,4),(4,-4),(4,4)]:
        draw.text((nx+ox, ny+oy), num_str, font=num_fnt, fill=(0, 0, 0))
    draw.text((nx, ny), num_str, font=num_fnt, fill=NC_WHITE)

    # ── 6. Thin accent border ─────────────────────────────────────────────────
    draw.rectangle([0, 0, W - 1, H - 1], outline=accent, width=16)

    return img

# ── PDF ───────────────────────────────────────────────────────────────────────
def pil_to_reader(pil_img):
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    buf.seek(0)
    return ImageReader(buf)

def build_pdf(jobs, event_name, event_date, out_path):
    PW, PH  = A4                          # 595 × 842 pt  (portrait)
    MARGIN  = 8
    GAP     = 8
    BIB_W   = PW - 2 * MARGIN
    BIB_H   = BIB_W * (H / W)
    TOP_Y   = PH - MARGIN - BIB_H
    BOT_Y   = MARGIN

    c     = rl_canvas.Canvas(out_path, pagesize=A4)
    total  = sum(n for _, n in jobs)
    done   = 0
    slot   = 0
    global_num = 1   # continuous across all categories

    for category, count in jobs:
        if count == 0:
            continue
        for i in range(count):
            num = global_num
            bib = make_bib(num, category, event_name, event_date)
            ir  = pil_to_reader(bib)
            y   = TOP_Y if slot == 0 else BOT_Y
            c.drawImage(ir, MARGIN, y, width=BIB_W, height=BIB_H)
            slot += 1
            if slot == 2:
                c.showPage()
                slot = 0
            global_num += 1
            done += 1
            print(f"\r  {done}/{total}  {category} #{num:03d}   ", end="", flush=True)
        print(f"\n✓  {count}× {category}")

    if slot == 1:
        c.showPage()
    c.save()
    pages = (done + 1) // 2
    print(f"\nPDF → {out_path}  ({pages} pages)")

# ── CLI ───────────────────────────────────────────────────────────────────────
def main():
    p = argparse.ArgumentParser()
    p.add_argument("--event",   default="NieboCross - Pamięci Marka Nowakowskiego")
    p.add_argument("--date",    default="12 kwietnia 2026")
    p.add_argument("--bieg9km", type=int, default=0)
    p.add_argument("--bieg3km", type=int, default=0)
    p.add_argument("--nw3km",   type=int, default=0)
    p.add_argument("--nw9km",   type=int, default=0)
    p.add_argument("--dzieci100", type=int, default=0)
    p.add_argument("--dzieci200", type=int, default=0)
    p.add_argument("--dzieci400", type=int, default=0)
    p.add_argument("--dzieci800", type=int, default=0)
    p.add_argument("--brak",      type=int, default=0)
    p.add_argument("--testowy", type=int, default=0)
    p.add_argument("--out",     default=None)
    a = p.parse_args()

    jobs = [
        ("Bieg 9km",    a.bieg9km),
        ("Bieg 3km",    a.bieg3km),
        ("NW 9km",      a.nw9km),
        ("NW 3km",      a.nw3km),
        ("Dzieci 100m", a.dzieci100),
        ("Dzieci 200m", a.dzieci200),
        ("Dzieci 400m", a.dzieci400),
        ("Dzieci 800m", a.dzieci800),
        ("Brak",        a.brak),
        ("Bieg Testowy", a.testowy),
    ]
    if sum(n for _, n in jobs) == 0:
        print("Pass at least one count (--bieg9km etc.)"); return

    out_dir = a.out or os.path.join(ROOT, "dist", "bibs")
    os.makedirs(out_dir, exist_ok=True)
    build_pdf(jobs, a.event, a.date, os.path.join(out_dir, "bibs.pdf"))

if __name__ == "__main__":
    main()
