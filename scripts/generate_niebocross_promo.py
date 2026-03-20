#!/usr/bin/env python3
"""
Generate a promo image with NieboCross brand colors.
Same layout as the OTOZ Animals fundraiser image.
Colors extracted from niebocross_logo.svg.
"""

from PIL import Image, ImageDraw, ImageFont
import math
import os

# ── NieboCross brand colors (from SVG) ──────────────────────────────────────
NC_TEAL        = (24, 178, 178)   # #18B2B2 – primary teal
NC_BLUE        = (32, 153, 179)   # #2099B3 – mid blue
NC_DARK_BLUE   = (68, 107, 172)   # #446BAC – deep blue
NC_GREEN       = (99, 191, 125)   # #63BF7D – fresh green
NC_LIGHT_GREEN = (140, 199, 85)   # #8AC754 – lime green
NC_PINK        = (219, 38, 122)   # #DB267A – accent magenta
NC_ORANGE      = (234, 155, 112)  # #EA9B70 – warm orange
NC_YELLOW      = (245, 221, 88)   # #F5DD58 – yellow
NC_NAVY        = (50, 66, 96)     # #324260 – dark navy
NC_WHITE       = (255, 255, 255)

# ── Canvas ───────────────────────────────────────────────────────────────────
W, H = 940, 788
img  = Image.new("RGB", (W, H), NC_WHITE)
draw = ImageDraw.Draw(img)

# ── Fonts ────────────────────────────────────────────────────────────────────
FONT_BOLD   = "/System/Library/Fonts/Supplemental/Verdana Bold.ttf"
FONT_NORMAL = "/System/Library/Fonts/HelveticaNeue.ttc"

def font(size, bold=True):
    path = FONT_BOLD if bold else FONT_NORMAL
    return ImageFont.truetype(path, size)

def wrap_text(text, fnt, max_width, draw):
    words = text.split()
    lines, line = [], ""
    for word in words:
        test = (line + " " + word).strip()
        bbox = draw.textbbox((0, 0), test, font=fnt)
        if bbox[2] <= max_width:
            line = test
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines

def draw_rounded_rect(draw, xy, radius, fill, outline=None, outline_width=0):
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle([x1, y1, x2, y2], radius=radius, fill=fill,
                            outline=outline, width=outline_width)

def draw_text_block(draw, lines, fnt, color, box_x1, box_y1, box_x2, box_y2,
                    line_spacing=10):
    """Centre a list of text lines vertically+horizontally inside a box."""
    heights = [draw.textbbox((0, 0), l, font=fnt)[3] for l in lines]
    total_h = sum(heights) + line_spacing * (len(lines) - 1)
    cy = box_y1 + (box_y2 - box_y1 - total_h) / 2
    for i, line in enumerate(lines):
        bbox = draw.textbbox((0, 0), line, font=fnt)
        lw = bbox[2] - bbox[0]
        cx = box_x1 + (box_x2 - box_x1 - lw) / 2
        draw.text((cx, cy), line, font=fnt, fill=color)
        cy += heights[i] + line_spacing

# ── Layout constants ──────────────────────────────────────────────────────────
PAD       = 24        # outer padding
BOX_TOP   = 30
BOX_BOT   = 370
BTN_TOP   = 400
BTN_BOT   = 490
LOGO_TOP  = 530
MID       = W // 2

# ── LEFT box (teal – replaces original salmon/pink) ──────────────────────────
LB = (PAD, BOX_TOP, MID - PAD // 2, BOX_BOT)
draw_rounded_rect(draw, LB, radius=28, fill=NC_TEAL)

fnt_big   = font(42)
fnt_med   = font(34)
fnt_small = font(28)

def draw_left_box(draw, box, fnt_title, fnt_sub, color):
    """Draw the two-section left box content manually."""
    x1, y1, x2, y2 = box
    w = x2 - x1 - 80

    fnt_amount = font(64)   # big standout number

    top_lines    = wrap_text("ZEBRALIŚMY JUŻ PONAD", fnt_title, w, draw)
    amount_lines = ["9500zł !!!"]
    sub_lines    = (wrap_text("NA POMOC", fnt_sub, w, draw) +
                    wrap_text("PODOPIECZNYM", fnt_sub, w, draw) +
                    wrap_text("OTOZ ANIMALS", fnt_sub, w, draw))

    def block_h(lines, fnt, sp=6):
        return sum(draw.textbbox((0,0), l, font=fnt)[3] for l in lines) + sp * (len(lines)-1)

    gap = 10
    sp  = 6
    total_h = (block_h(top_lines, fnt_title, sp) + gap +
               block_h(amount_lines, fnt_amount, sp) + gap +
               block_h(sub_lines, fnt_sub, sp))
    cy = y1 + (y2 - y1 - total_h) / 2

    for l in top_lines:
        bbox = draw.textbbox((0,0), l, font=fnt_title)
        lw = bbox[2] - bbox[0]
        draw.text((x1 + (x2-x1-lw)//2, cy), l, font=fnt_title, fill=color)
        cy += bbox[3] + sp

    cy += gap - sp
    for l in amount_lines:
        bbox = draw.textbbox((0,0), l, font=fnt_amount)
        lw = bbox[2] - bbox[0]
        draw.text((x1 + (x2-x1-lw)//2, cy), l, font=fnt_amount, fill=NC_YELLOW)
        cy += bbox[3] + sp

    cy += gap - sp
    for l in sub_lines:
        bbox = draw.textbbox((0,0), l, font=fnt_sub)
        lw = bbox[2] - bbox[0]
        draw.text((x1 + (x2-x1-lw)//2, cy), l, font=fnt_sub, fill=color)
        cy += bbox[3] + sp

draw_left_box(draw, LB, fnt_big, fnt_med, NC_WHITE)

# ── RIGHT box (white with dark-navy outline) ──────────────────────────────────
RB = (MID + PAD // 2, BOX_TOP, W - PAD, BOX_BOT)
draw_rounded_rect(draw, RB, radius=28, fill=NC_WHITE, outline=NC_TEAL, outline_width=4)

right_lines = wrap_text(
    "POMÓŻ NAM ZNALEŹĆ FIRMY KTÓRE POMOGĄ POKRYĆ KOSZTY ORGANIZACJI. KAŻDA KWOTA SIĘ LICZY.",
    fnt_med, RB[2]-RB[0]-90, draw)
draw_text_block(draw, right_lines, fnt_med, NC_NAVY,
                RB[0]+45, RB[1], RB[2]-45, RB[3], line_spacing=10)

# ── LEFT button (green) ───────────────────────────────────────────────────────
BTN_MID = H * 0  # unused – just for ref
LBtn = (PAD, BTN_TOP, MID - PAD // 2, BTN_BOT)
draw_rounded_rect(draw, LBtn, radius=36, fill=NC_GREEN)
btn_lines_l = ["ZADZWOŃ", "784 640 977"]
draw_text_block(draw, btn_lines_l, fnt_med, NC_NAVY, *LBtn, line_spacing=6)

# ── RIGHT button (green) ──────────────────────────────────────────────────────
RBtn = (MID + PAD // 2, BTN_TOP, W - PAD, BTN_BOT)
draw_rounded_rect(draw, RBtn, radius=36, fill=NC_GREEN)
btn_lines_r = ["NAPISZ", "biuro@zatyrani.pl"]
draw_text_block(draw, btn_lines_r, fnt_med, NC_NAVY, *RBtn, line_spacing=6)

# ── Bottom logo strip ─────────────────────────────────────────────────────────
WEBP_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "../public/niebocross_logo.webp"))
LOGO_H = 210
LOGO_Y = LOGO_TOP

def paste_logo(target_img, logo_path, logo_h, cx, cy_top):
    """Resize logo to logo_h height and paste centred at cx."""
    limg = Image.open(logo_path).convert("RGBA")
    ratio = logo_h / limg.height
    lw = int(limg.width * ratio)
    limg = limg.resize((lw, logo_h), Image.LANCZOS)
    x = cx - lw // 2
    # Need an RGB background patch (no alpha on main img)
    bg = Image.new("RGBA", target_img.size)
    bg.paste(target_img.convert("RGBA"))
    bg.paste(limg, (x, cy_top), limg)
    return bg.convert("RGB")

ZATYRANI_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "../public/zatyrani_logo.webp"))

# NieboCross logo left, ZATYRANI logo right
NC_LOGO_H  = 190
ZAT_LOGO_H = 130   # zatyrani logo is wide/short – keep it proportional

if os.path.exists(WEBP_PATH):
    img = paste_logo(img, WEBP_PATH, NC_LOGO_H, W // 4, LOGO_Y + (NC_LOGO_H - NC_LOGO_H)//2)
    draw = ImageDraw.Draw(img)

if os.path.exists(ZATYRANI_PATH):
    # Centre the zatyrani logo vertically relative to the niebocross logo
    zy = LOGO_Y + (NC_LOGO_H - ZAT_LOGO_H) // 2
    img = paste_logo(img, ZATYRANI_PATH, ZAT_LOGO_H, W * 3 // 4, zy)
    draw = ImageDraw.Draw(img)

# ── Bottom URL ───────────────────────────────────────────────────────────────
fnt_url = font(28)
url_txt = "zatyrani.pl/niebocross"
bbox = draw.textbbox((0, 0), url_txt, font=fnt_url)
uw = bbox[2] - bbox[0]
uh = bbox[3] - bbox[1]
draw.text((W // 2 - uw // 2, H - uh - 18), url_txt, font=fnt_url, fill=NC_TEAL)

# ── Save ─────────────────────────────────────────────────────────────────────
out_dir  = os.path.join(os.path.dirname(__file__), "../dist/facebook")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "niebocross_promo.png")
img.save(out_path, "PNG")
print(f"Saved → {os.path.abspath(out_path)}")
