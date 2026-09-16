"""Indian festival greeting generator for ISME's Festivities feature.

Two independent pieces:
- A short Claude-written WhatsApp greeting message (structured output, same
  pattern as newsletter_agents.py).
- A programmatic festive greeting card image, rendered locally with Pillow
  (no model call) - a gradient-mesh background, a festival-specific motif,
  a glass "sticker" card with the greeting, and the ISME logo composited
  into a branded corner badge. Deterministic and free to regenerate.
"""
import asyncio
import base64
import json
import logging
import math
import os
import random
import urllib.error
import urllib.request
from io import BytesIO
from typing import Optional

from PIL import Image, ImageDraw, ImageFont, ImageFilter

import newsletter_agents as agents

logger = logging.getLogger(__name__)

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(ROOT_DIR, "assets", "fonts")
LOGO_PATH = os.path.join(ROOT_DIR, "assets", "images", "isme-logo.png")
IMAGE_SIZE = 1080

# -----------------------------------------------------------------------
# AI-generated illustrated background (optional). If OPENAI_API_KEY is set,
# each greeting gets a real illustrated festive scene from OpenAI's GPT
# image models instead of the geometric gradient+motif fallback below. The
# greeting card and ISME logo pill are still composited locally on top
# either way, so branding and text stay crisp regardless of which
# background was used. Tries gpt-image-2 (current flagship - reasons about
# the prompt before generating, best text/detail accuracy) first, then
# falls back to gpt-image-1 if that model isn't available on the account.
# DALL-E 2/3 are not used: OpenAI shut them down on 2026-05-12. Fully
# optional and fails soft: any error (no key, quota, network, content
# policy, model unavailable) falls back to the deterministic Pillow
# background.
# -----------------------------------------------------------------------
_AI_MODELS_IN_PREFERENCE_ORDER = ["gpt-image-2", "gpt-image-1"]
_AI_PROMPT_BY_MOTIF = {
    "diya": "rows of glowing terracotta oil lamps (diyas) with warm golden flames, "
            "scattered marigold petals, soft bokeh light",
    "confetti": "a joyful burst of colourful confetti and paper streamers in the air",
    "crescent_star": "a glowing golden crescent moon and star in a deep teal night sky, "
                      "traditional geometric lantern patterns",
    "rangoli": "an elaborate, colourful rangoli flower pattern on the ground with "
               "marigolds and diyas",
    "tricolor": "the Indian tricolour (saffron, white, green) as flowing fabric or "
                "bunting, with the Ashoka Chakra motif, patriotic mood",
    "bloom": "lush blooming lotus and marigold flowers with soft golden light",
    "snow": "gentle falling snow, twinkling fairy lights and pine branches, a cosy "
            "winter evening mood",
}


def _ai_background_prompt(festival: dict) -> str:
    scene = _AI_PROMPT_BY_MOTIF.get(festival["motif"], _AI_PROMPT_BY_MOTIF["bloom"])
    return (
        f"A vibrant, modern flat-illustration greeting-card background celebrating "
        f"{festival['name']}, an Indian festival. Scene: {scene}. Warm, festive, "
        f"joyful colour palette. Clean flat-illustration / vector-art style, rich "
        f"colour gradients, no photorealism. Square composition, subject matter "
        f"concentrated in the upper two-thirds, keeping the lower third calmer and "
        f"less busy. Absolutely no text, no words, no letters, no logos, no "
        f"watermarks, no human faces in close-up."
    )


def _call_openai_image_api(prompt: str) -> Optional[bytes]:
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return None
    url = "https://api.openai.com/v1/images/generations"
    for model in _AI_MODELS_IN_PREFERENCE_ORDER:
        payload = json.dumps({
            "model": model,
            "prompt": prompt,
            "n": 1,
            "size": "1024x1024",
            "quality": "high",
        }).encode("utf-8")
        req = urllib.request.Request(
            url, data=payload, method="POST",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            return base64.b64decode(data["data"][0]["b64_json"])
        except urllib.error.HTTPError as e:
            logger.warning(f"[AI BACKGROUND] {model} HTTP error {e.code}: {e.read().decode('utf-8', 'ignore')}")
            continue
        except Exception as e:
            logger.warning(f"[AI BACKGROUND] {model} call failed: {e}")
            continue
    return None


async def generate_ai_background(festival: dict) -> Optional[Image.Image]:
    """Best-effort: returns a 1080x1080 RGBA illustration for this festival, or
    None if OPENAI_API_KEY isn't set or the call fails for any reason."""
    if not os.environ.get("OPENAI_API_KEY"):
        return None
    raw = await asyncio.to_thread(_call_openai_image_api, _ai_background_prompt(festival))
    if not raw:
        return None
    try:
        img = Image.open(BytesIO(raw)).convert("RGBA")
        return img.resize((IMAGE_SIZE, IMAGE_SIZE), Image.LANCZOS)
    except Exception as e:
        logger.warning(f"[AI BACKGROUND] decode failed: {e}")
        return None

# -----------------------------------------------------------------------
# Festival calendar (2026) - name, date, category, one-line blurb, and the
# visual treatment (palette + motif) used to render its greeting card.
# Dates researched against multiple 2026 Indian-calendar sources; lunar/
# moon-sighting-dependent festivals (Eid, Muharram) are best-estimate.
# -----------------------------------------------------------------------
FESTIVALS_2026 = [
    {"name": "New Year's Day", "date": "2026-01-01", "category": "national",
     "blurb": "The start of the calendar year.", "motif": "confetti",
     "palette": ["#1B1F3B", "#3A2E6E", "#8B5CF6", "#F2C14E"]},
    {"name": "Lohri", "date": "2026-01-13", "category": "hindu",
     "blurb": "North Indian bonfire harvest festival.", "motif": "rangoli",
     "palette": ["#7A2E0E", "#C4531D", "#E8901A", "#F2C14E"]},
    {"name": "Makar Sankranti / Pongal", "date": "2026-01-14", "category": "hindu",
     "blurb": "Harvest festival marking the sun's transit into Capricorn.", "motif": "rangoli",
     "palette": ["#8A4B0F", "#D97B1E", "#F2A93B", "#FFDA77"]},
    {"name": "Vasant Panchami", "date": "2026-01-23", "category": "hindu",
     "blurb": "Marks the onset of spring; dedicated to Goddess Saraswati.", "motif": "bloom",
     "palette": ["#5B4A00", "#A68B12", "#E2C34A", "#FFF1A6"]},
    {"name": "Republic Day", "date": "2026-01-26", "category": "national",
     "blurb": "India's Constitution came into effect on this day in 1950.", "motif": "tricolor",
     "palette": ["#1B4F9C", "#2E7BC4", "#F2F2F2", "#1B8A4A"]},
    {"name": "Maha Shivratri", "date": "2026-02-15", "category": "hindu",
     "blurb": "The 'Great Night of Shiva'.", "motif": "bloom",
     "palette": ["#0B1D4D", "#1E3A8A", "#5B7FDB", "#C7D2FE"]},
    {"name": "Holi", "date": "2026-03-04", "category": "hindu",
     "blurb": "The festival of colours.", "motif": "confetti",
     "palette": ["#3E1F6E", "#B4348C", "#F2545B", "#FFB93C"]},
    {"name": "Ram Navami", "date": "2026-03-26", "category": "hindu",
     "blurb": "Celebrates the birth of Lord Rama.", "motif": "bloom",
     "palette": ["#7A1E1E", "#C4451D", "#E8901A", "#FFDA77"]},
    {"name": "Eid al-Fitr", "date": "2026-03-30", "category": "muslim",
     "blurb": "Marks the end of Ramadan.", "motif": "crescent_star",
     "palette": ["#0B4A38", "#0E6B52", "#159873", "#2ABE93"]},
    {"name": "Mahavir Jayanti", "date": "2026-03-31", "category": "jain",
     "blurb": "Birth anniversary of Lord Mahavira, the 24th Tirthankara.", "motif": "bloom",
     "palette": ["#3A2E1A", "#7A6230", "#C9A94E", "#F4E7C1"]},
    {"name": "Good Friday", "date": "2026-04-03", "category": "christian",
     "blurb": "Commemorates the crucifixion of Jesus Christ.", "motif": "bloom",
     "palette": ["#1E1B3A", "#3B3170", "#6D5AA6", "#C4B8E0"]},
    {"name": "Easter Sunday", "date": "2026-04-05", "category": "christian",
     "blurb": "Celebrates the resurrection of Jesus Christ.", "motif": "bloom",
     "palette": ["#1E4D3A", "#3D8B6A", "#8FD4A8", "#FDF0C4"]},
    {"name": "Baisakhi", "date": "2026-04-14", "category": "sikh",
     "blurb": "Harvest festival and Sikh new year.", "motif": "rangoli",
     "palette": ["#7A4B00", "#D9821E", "#F2B33D", "#FFE58A"]},
    {"name": "Buddha Purnima", "date": "2026-05-01", "category": "buddhist",
     "blurb": "Marks the birth, enlightenment and death of Gautama Buddha.", "motif": "bloom",
     "palette": ["#6B3A00", "#B4791E", "#E8B93D", "#FFF1C9"]},
    {"name": "Eid al-Adha", "date": "2026-05-28", "category": "muslim",
     "blurb": "The 'Festival of Sacrifice'.", "motif": "crescent_star",
     "palette": ["#0B3D2E", "#0E5A45", "#137A5C", "#57C7A3"]},
    {"name": "Muharram", "date": "2026-06-26", "category": "muslim",
     "blurb": "The first month of the Islamic calendar; a day of remembrance.", "motif": "crescent_star",
     "palette": ["#111827", "#1F2937", "#374151", "#9CA3AF"]},
    {"name": "Rath Yatra", "date": "2026-07-16", "category": "hindu",
     "blurb": "The chariot procession of Lord Jagannath in Puri.", "motif": "bloom",
     "palette": ["#7A2E0E", "#C4531D", "#E8901A", "#FFDA77"]},
    {"name": "Guru Purnima", "date": "2026-07-29", "category": "hindu",
     "blurb": "A day to honour teachers and spiritual guides.", "motif": "bloom",
     "palette": ["#4A1E3A", "#8B3468", "#C45B94", "#F2B8D4"]},
    {"name": "Independence Day", "date": "2026-08-15", "category": "national",
     "blurb": "Marks India's independence from British rule in 1947.", "motif": "tricolor",
     "palette": ["#1B4F9C", "#2E7BC4", "#F2F2F2", "#1B8A4A"]},
    {"name": "Eid-e-Milad", "date": "2026-08-26", "category": "muslim",
     "blurb": "Commemorates the birth of Prophet Muhammad.", "motif": "crescent_star",
     "palette": ["#0B3D2E", "#0E5A45", "#137A5C", "#57C7A3"]},
    {"name": "Onam", "date": "2026-08-26", "category": "hindu",
     "blurb": "Kerala's harvest festival, famous for pookalam flower carpets.", "motif": "rangoli",
     "palette": ["#0F5C3A", "#1E8449", "#F4B400", "#E85D2C"]},
    {"name": "Raksha Bandhan", "date": "2026-08-28", "category": "hindu",
     "blurb": "Celebrates the bond between brothers and sisters.", "motif": "bloom",
     "palette": ["#7A1E2E", "#C4341D", "#E8901A", "#FFDA9C"]},
    {"name": "Janmashtami", "date": "2026-09-04", "category": "hindu",
     "blurb": "Celebrates the birth of Lord Krishna.", "motif": "bloom",
     "palette": ["#0B2E4A", "#1E4E8B", "#3E7FC7", "#F2C14E"]},
    {"name": "Teachers' Day", "date": "2026-09-05", "category": "national",
     "blurb": "Honours teachers, marked on Dr. Radhakrishnan's birthday.", "motif": "bloom",
     "palette": ["#0B3D5C", "#1E6B8B", "#3E9FBF", "#F2C14E"]},
    {"name": "Ganesh Chaturthi", "date": "2026-09-14", "category": "hindu",
     "blurb": "Celebrates the birth of Lord Ganesha.", "motif": "bloom",
     "palette": ["#7A1E1E", "#C4451D", "#E8901A", "#FFDA77"]},
    {"name": "Gandhi Jayanti", "date": "2026-10-02", "category": "national",
     "blurb": "Birth anniversary of Mahatma Gandhi.", "motif": "bloom",
     "palette": ["#3A3A3A", "#6B6B6B", "#E8901A", "#F5F0E1"]},
    {"name": "Sharad Navratri Begins", "date": "2026-10-11", "category": "hindu",
     "blurb": "Nine nights honouring the Goddess Durga.", "motif": "bloom",
     "palette": ["#4A0E3A", "#8B1E6B", "#C4459C", "#F2A9D4"]},
    {"name": "Dussehra", "date": "2026-10-20", "category": "hindu",
     "blurb": "Marks the triumph of good over evil; Vijayadashami.", "motif": "bloom",
     "palette": ["#7A1E1E", "#C4341D", "#E8901A", "#FFDA77"]},
    {"name": "Karva Chauth", "date": "2026-10-29", "category": "hindu",
     "blurb": "A fast observed until moonrise for a spouse's wellbeing.", "motif": "crescent_star",
     "palette": ["#3A0E1E", "#7A1E3A", "#B4345C", "#F2A93B"]},
    {"name": "Dhanteras", "date": "2026-11-06", "category": "hindu",
     "blurb": "Marks the start of the Diwali festivities.", "motif": "diya",
     "palette": ["#5A1424", "#B5342F", "#E07A2E", "#F2B33D"]},
    {"name": "Naraka Chaturdashi", "date": "2026-11-07", "category": "hindu",
     "blurb": "'Choti Diwali' - the eve of Diwali.", "motif": "diya",
     "palette": ["#5A1424", "#B5342F", "#E07A2E", "#F2B33D"]},
    {"name": "Diwali", "date": "2026-11-08", "category": "hindu",
     "blurb": "The festival of lights.", "motif": "diya",
     "palette": ["#5A1424", "#B5342F", "#E07A2E", "#F2B33D"]},
    {"name": "Govardhan Puja", "date": "2026-11-10", "category": "hindu",
     "blurb": "Celebrates Krishna lifting the Govardhan hill.", "motif": "diya",
     "palette": ["#0F5C3A", "#1E8449", "#E8901A", "#F2C14E"]},
    {"name": "Bhai Dooj", "date": "2026-11-11", "category": "hindu",
     "blurb": "Celebrates the bond between brothers and sisters.", "motif": "bloom",
     "palette": ["#7A1E2E", "#C4341D", "#E8901A", "#FFDA9C"]},
    {"name": "Children's Day", "date": "2026-11-14", "category": "national",
     "blurb": "Marked on Jawaharlal Nehru's birthday.", "motif": "confetti",
     "palette": ["#0B3D5C", "#1E8B8B", "#F2A93B", "#FF6B6B"]},
    {"name": "Chhath Puja", "date": "2026-11-15", "category": "hindu",
     "blurb": "A festival of gratitude to the Sun god.", "motif": "bloom",
     "palette": ["#7A2E0E", "#C4531D", "#E8901A", "#FFDA77"]},
    {"name": "Guru Nanak Jayanti", "date": "2026-11-24", "category": "sikh",
     "blurb": "Birth anniversary of Guru Nanak, founder of Sikhism.", "motif": "bloom",
     "palette": ["#0B2E5C", "#1E4E8B", "#E8901A", "#F2C14E"]},
    {"name": "Christmas", "date": "2026-12-25", "category": "christian",
     "blurb": "Celebrates the birth of Jesus Christ.", "motif": "snow",
     "palette": ["#0B2545", "#1B3B6F", "#8B1E3F", "#C0392B"]},
]


def _font(name: str, size: int):
    return ImageFont.truetype(os.path.join(FONT_DIR, f"{name}.ttf"), size)


def _hex2rgb(h: str):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _diagonal_gradient(size, colors):
    w, h = size
    rgbs = [_hex2rgb(c) for c in colors]
    n = len(rgbs) - 1
    base = Image.new("RGB", (w, h))
    px = base.load()
    diag = w + h
    for y in range(h):
        for x in range(0, w, 2):
            t = min(max((x + y) / diag, 0), 1)
            seg = min(int(t * n), n - 1)
            local_t = (t * n) - seg
            c0, c1 = rgbs[seg], rgbs[seg + 1]
            r = int(c0[0] + (c1[0] - c0[0]) * local_t)
            g = int(c0[1] + (c1[1] - c0[1]) * local_t)
            b = int(c0[2] + (c1[2] - c0[2]) * local_t)
            px[x, y] = (r, g, b)
            if x + 1 < w:
                px[x + 1, y] = (r, g, b)
    return base


def _blob_glow(size, center, radius, color, alpha=95, blur=None):
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = center
    d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=(*color, alpha))
    return layer.filter(ImageFilter.GaussianBlur(blur if blur else radius * 0.55))


def _rounded_card_with_shadow(size, radius, fill=(255, 255, 255, 240)):
    w, h = size
    pad = 44
    canvas = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle([pad, pad + 16, pad + w, pad + h + 16], radius=radius, fill=(0, 0, 0, 110))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(22)))
    card = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(card).rounded_rectangle([pad, pad, pad + w, pad + h], radius=radius, fill=fill)
    canvas.alpha_composite(card)
    return canvas, pad


def _flame(d, x, y, scale=1.0):
    top_r = 15 * scale
    d.ellipse([x - top_r, y - 38 * scale - top_r, x + top_r, y - 38 * scale + top_r], fill=(255, 200, 80, 255))
    d.polygon([(x - top_r * 0.95, y - 38 * scale), (x, y), (x + top_r * 0.95, y - 38 * scale)], fill=(255, 200, 80, 255))
    in_r = top_r * 0.5
    d.ellipse([x - in_r, y - 30 * scale - in_r, x + in_r, y - 30 * scale + in_r], fill=(255, 245, 210, 255))
    d.polygon([(x - in_r * 0.9, y - 30 * scale), (x, y - 6 * scale), (x + in_r * 0.9, y - 30 * scale)], fill=(255, 245, 210, 255))


def _star_points(cx, cy, sr, rot=0.0):
    pts = []
    for i in range(10):
        ang = rot + math.pi / 2 + i * math.pi / 5
        rad = sr if i % 2 == 0 else sr * 0.42
        pts.append((cx + rad * math.cos(ang), cy - rad * math.sin(ang)))
    return pts


def _motif_diya(layer, rng, accent):
    w, h = layer.size
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    d = ImageDraw.Draw(layer, "RGBA")
    for row_y, n, scale in [(h * 0.70, 7, 1.0), (68, 5, 0.7)]:
        for i in range(n):
            x = w * (0.10 + i * 0.80 / max(n - 1, 1)) + rng.uniform(-14, 14)
            y = row_y + rng.uniform(-14, 10)
            gd.ellipse([x - 38 * scale, y - 55 * scale, x + 38 * scale, y + 20 * scale], fill=(255, 180, 70, 150))
            d.ellipse([x - 27 * scale, y - 5 * scale, x + 27 * scale, y + 17 * scale], fill=(110, 55, 22, 255))
            d.ellipse([x - 22 * scale, y - 9 * scale, x + 22 * scale, y + 5 * scale], fill=(190, 100, 40, 255))
            _flame(d, x, y - 2 * scale, scale)
    layer.alpha_composite(glow.filter(ImageFilter.GaussianBlur(22)))
    return layer


def _motif_confetti(layer, rng, accent):
    w, h = layer.size
    colors = ["#FF3D7F", "#FFC93C", "#2FD4A5", "#54A6FF", "#C86BFA", "#FF8A3D"]
    d = ImageDraw.Draw(layer, "RGBA")
    for _ in range(160):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        r = rng.uniform(5, 26)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(*_hex2rgb(rng.choice(colors)), int(rng.uniform(90, 200))))
    for _ in range(40):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        r = rng.uniform(2, 5)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, int(rng.uniform(140, 220))))
    return layer


def _motif_crescent_star(layer, rng, accent):
    w, h = layer.size
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx, cy, r = w * 0.76, h * 0.24, 190
    gd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 224, 130, 170))
    layer.alpha_composite(glow.filter(ImageFilter.GaussianBlur(55)))

    moon_r = 130
    base = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(base).ellipse([cx - moon_r, cy - moon_r, cx + moon_r, cy + moon_r], fill=(255, 214, 110, 255))
    cut = moon_r * 0.60
    hole = Image.new("L", (w, h), 0)
    ImageDraw.Draw(hole).ellipse([cx - moon_r + cut, cy - moon_r - 14, cx + moon_r + cut, cy + moon_r - 14], fill=255)
    a = base.split()[3]
    base.putalpha(Image.composite(Image.new("L", (w, h), 0), a, hole))
    layer.alpha_composite(base)

    d = ImageDraw.Draw(layer, "RGBA")
    gold = (255, 214, 110, 255)
    d.polygon(_star_points(cx - 190, cy + 70, 30), fill=gold)
    d.polygon(_star_points(cx - 260, cy - 40, 16), fill=gold)
    d.polygon(_star_points(cx + 40, cy + 190, 14), fill=gold)
    n = 12
    for i in range(n):
        x = w * (i + 0.5) / n
        y = h * 0.72
        s = 16
        d.polygon([(x, y - s), (x + s, y), (x, y + s), (x - s, y)], fill=(*_hex2rgb(accent), 90))
    return layer


def _motif_rangoli(layer, rng, accent):
    w, h = layer.size
    d = ImageDraw.Draw(layer, "RGBA")
    palette = ["#FF6B6B", "#FFD93D", "#4ECDC4", "#FF922B", "#F783AC", "#63E6BE"]
    for (cx, cy, scale) in [(w * 0.5, h * 0.72, 0.75), (w * 0.14, h * 0.16, 0.5), (w * 0.88, h * 0.14, 0.45)]:
        for ring, radius in enumerate([260, 210, 160, 110, 60]):
            radius *= scale
            n = max(int((14 - ring * 2) * scale + 4), 6)
            col = _hex2rgb(palette[(ring + int(cx)) % len(palette)])
            for i in range(n):
                ang = 2 * math.pi * i / n
                x = cx + radius * math.cos(ang)
                y = cy + radius * 0.38 * math.sin(ang) - 30 * scale
                r = (9 - ring * 0.7) * scale
                if r > 1:
                    d.ellipse([x - r, y - r, x + r, y + r], fill=(*col, 220))
    return layer


def _motif_tricolor(layer, rng, accent):
    w, h = layer.size
    d = ImageDraw.Draw(layer, "RGBA")
    band_h = 34
    d.rectangle([0, 0, w, band_h], fill=(255, 153, 51, 255))
    d.rectangle([0, band_h, w, band_h * 2], fill=(255, 255, 255, 255))
    d.rectangle([0, band_h * 2, w, band_h * 3], fill=(19, 136, 8, 255))
    d.rectangle([0, h - band_h * 3, w, h - band_h * 2], fill=(19, 136, 8, 255))
    d.rectangle([0, h - band_h * 2, w, h - band_h], fill=(255, 255, 255, 255))
    d.rectangle([0, h - band_h, w, h], fill=(255, 153, 51, 255))
    cx, cy, r = w * 0.5, h * 0.685, 70
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(11, 39, 135, 255), width=6)
    d.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], fill=(11, 39, 135, 255))
    for i in range(24):
        ang = 2 * math.pi * i / 24
        x1, y1 = cx + 10 * math.cos(ang), cy + 10 * math.sin(ang)
        x2, y2 = cx + r * math.cos(ang), cy + r * math.sin(ang)
        d.line([x1, y1, x2, y2], fill=(11, 39, 135, 255), width=3)
    return layer


def _motif_bloom(layer, rng, accent):
    w, h = layer.size
    d = ImageDraw.Draw(layer, "RGBA")
    for (cx, cy, scale, op) in [(w * 0.88, h * 0.88, 1.0, 160), (w * 0.1, h * 0.1, 0.55, 120), (w * 0.85, h * 0.12, 0.4, 100)]:
        for i in range(8):
            ang = 2 * math.pi * i / 8
            px_, py_ = cx + 74 * scale * math.cos(ang), cy + 74 * scale * math.sin(ang)
            d.ellipse([px_ - 48 * scale, py_ - 32 * scale, px_ + 48 * scale, py_ + 32 * scale], fill=(255, 255, 255, op))
        d.ellipse([cx - 26 * scale, cy - 26 * scale, cx + 26 * scale, cy + 26 * scale], fill=(*_hex2rgb(accent), 230))
    return layer


def _motif_snow(layer, rng, accent):
    w, h = layer.size
    d = ImageDraw.Draw(layer, "RGBA")
    for _ in range(130):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        r = rng.uniform(2, 6)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, int(rng.uniform(140, 230))))
    for _ in range(16):
        x, y = rng.uniform(50, w - 50), rng.uniform(40, h - 40)
        sr = rng.uniform(10, 20)
        d.polygon(_star_points(x, y, sr), fill=(255, 255, 255, 215))
    return layer


_MOTIFS = {
    "diya": _motif_diya, "confetti": _motif_confetti, "crescent_star": _motif_crescent_star,
    "rangoli": _motif_rangoli, "tricolor": _motif_tricolor, "bloom": _motif_bloom, "snow": _motif_snow,
}


def _wrap_text(draw, text, fnt, max_width):
    words = text.split()
    lines, cur = [], ""
    for word in words:
        trial = (cur + " " + word).strip()
        if draw.textlength(trial, font=fnt) <= max_width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def _fit_headline(draw, text, max_width, start_size=92, min_size=54):
    size = start_size
    while size >= min_size:
        fnt = _font("Poppins-ExtraBold", size)
        lines = _wrap_text(draw, text, fnt, max_width)
        if len(lines) <= 2:
            return fnt, lines, size
        size -= 6
    fnt = _font("Poppins-ExtraBold", min_size)
    return fnt, _wrap_text(draw, text, fnt, max_width), min_size


def render_greeting_image(festival: dict, headline: str, subline: str = "From all of us at ISME Bangalore",
                           seed: Optional[int] = None, ai_background: Optional[Image.Image] = None) -> bytes:
    """Festive greeting card, 1080x1080 PNG. If ai_background (a 1080x1080 RGBA
    illustration from generate_ai_background) is supplied, it's used as the
    scene and the local gradient/motif generator is skipped; the glass card,
    headline text and ISME logo pill are always rendered locally either way."""
    rng = random.Random(seed if seed is not None else hash(festival["name"]) % 10_000)
    palette = festival["palette"]
    motif = festival["motif"]
    luma = sum(_hex2rgb(palette[-1]))
    accent = palette[-1] if luma < 600 else palette[0]

    if ai_background is not None:
        bg = ai_background.convert("RGBA")
        if bg.size != (IMAGE_SIZE, IMAGE_SIZE):
            bg = bg.resize((IMAGE_SIZE, IMAGE_SIZE), Image.LANCZOS)
        # Gentle bottom-up darkening so the white card/logo pill keep contrast
        # against whatever the illustration put behind them.
        shade = Image.new("L", (IMAGE_SIZE, IMAGE_SIZE), 0)
        sd = ImageDraw.Draw(shade)
        for y in range(IMAGE_SIZE):
            t = max(0.0, (y - IMAGE_SIZE * 0.42) / (IMAGE_SIZE * 0.58))
            sd.line([(0, y), (IMAGE_SIZE, y)], fill=int(60 * t))
        overlay = Image.new("RGBA", (IMAGE_SIZE, IMAGE_SIZE), (10, 8, 6, 0))
        overlay.putalpha(shade)
        bg.alpha_composite(overlay)
    else:
        bg = _diagonal_gradient((IMAGE_SIZE, IMAGE_SIZE), palette).convert("RGBA")
        bg.alpha_composite(_blob_glow((IMAGE_SIZE, IMAGE_SIZE), (IMAGE_SIZE * 0.08, IMAGE_SIZE * 0.06), 340, _hex2rgb(palette[-1])))
        bg.alpha_composite(_blob_glow((IMAGE_SIZE, IMAGE_SIZE), (IMAGE_SIZE * 0.95, IMAGE_SIZE * 0.98), 380, _hex2rgb(palette[0]), alpha=90))
        motif_layer = Image.new("RGBA", (IMAGE_SIZE, IMAGE_SIZE), (0, 0, 0, 0))
        motif_layer = _MOTIFS.get(motif, _motif_bloom)(motif_layer, rng, accent)
        bg.alpha_composite(motif_layer)

    tmp_draw = ImageDraw.Draw(bg)
    max_text_w = IMAGE_SIZE - 260
    hd_font, head_lines, hsize = _fit_headline(tmp_draw, headline, max_text_w)
    sub_font = _font("Poppins-Medium", 32)
    line_h = int(hsize * 1.12)
    card_h = len(head_lines) * line_h + 84
    card_w = IMAGE_SIZE - 180
    card, pad = _rounded_card_with_shadow((card_w, card_h), 40)
    cx = (IMAGE_SIZE - card.width) // 2
    cy = int(IMAGE_SIZE * 0.5) - card.height // 2
    bg.alpha_composite(card, (cx, cy))

    d = ImageDraw.Draw(bg)
    ty = cy + pad + 16
    for line in head_lines:
        tw = d.textlength(line, font=hd_font)
        d.text(((IMAGE_SIZE - tw) / 2, ty), line, font=hd_font, fill=(28, 22, 18, 255))
        ty += line_h
    tw = d.textlength(subline, font=sub_font)
    d.text(((IMAGE_SIZE - tw) / 2, ty + 6), subline, font=sub_font, fill=(*_hex2rgb(accent), 255))

    # Full ISME wordmark (globe + "ISME Bangalore" + "Celebrating 20 Years") in a
    # white pill, bottom-center - wide aspect ratio, so a circular badge doesn't fit.
    logo = Image.open(LOGO_PATH).convert("RGBA")
    logo_w = 460
    logo_h = int(logo_w / (logo.width / logo.height))
    logo_small = logo.resize((logo_w, logo_h), Image.LANCZOS)
    pill_pad_x, pill_pad_y = 36, 22
    pill_w, pill_h = logo_w + pill_pad_x * 2, logo_h + pill_pad_y * 2
    shadow_margin = 20
    badge = Image.new("RGBA", (pill_w + shadow_margin * 2, pill_h + shadow_margin * 2), (0, 0, 0, 0))
    bs = Image.new("RGBA", badge.size, (0, 0, 0, 0))
    ImageDraw.Draw(bs).rounded_rectangle(
        [shadow_margin, shadow_margin + 8, shadow_margin + pill_w, shadow_margin + pill_h + 8],
        radius=pill_h // 2, fill=(0, 0, 0, 90))
    badge.alpha_composite(bs.filter(ImageFilter.GaussianBlur(12)))
    ImageDraw.Draw(badge).rounded_rectangle(
        [shadow_margin, shadow_margin, shadow_margin + pill_w, shadow_margin + pill_h],
        radius=pill_h // 2, fill=(255, 255, 255, 255))
    badge.alpha_composite(logo_small, (shadow_margin + pill_pad_x, shadow_margin + pill_pad_y))
    bg.alpha_composite(badge, ((IMAGE_SIZE - badge.width) // 2, IMAGE_SIZE - badge.height - 40))

    out = BytesIO()
    bg.convert("RGB").save(out, format="PNG", optimize=True)
    return out.getvalue()


# -----------------------------------------------------------------------
# Claude agent - short WhatsApp greeting text
# -----------------------------------------------------------------------
GREETING_SYSTEM = """You are the greetings agent for ISME's WhatsApp broadcast list.
You write in ISME's voice: warm, direct, never generic corporate filler.

Input: a festival's name and a one-line description of what it marks.

Write ONE short WhatsApp broadcast message (2-4 sentences, under 300
characters) wishing the ISME Bangalore community well for the festival. It
should:
- Name the festival naturally (don't just repeat the input verbatim).
- Feel warm and specific to a management-school community, not a generic
  mass-market greeting - a brief, genuine touch is fine (e.g. tying it to
  togetherness, new beginnings, gratitude) but do not force a business/
  career angle onto every festival - a wish that just wishes well is fine.
- Use at most one emoji, only if it fits naturally.
- Not invent any claim, statistic, or event ISME is hosting.

Return: whatsapp_message (the text, ready to send as-is)."""

GREETING_SCHEMA = {
    "type": "object",
    "properties": {"whatsapp_message": {"type": "string"}},
    "required": ["whatsapp_message"],
    "additionalProperties": False,
}


async def run_greeting_text_agent(festival: dict) -> str:
    client = agents.get_client()
    user = f"Festival: {festival['name']}\nWhat it marks: {festival['blurb']}"
    response = await agents._create(
        client,
        system=GREETING_SYSTEM,
        user=user,
        schema=GREETING_SCHEMA,
        max_tokens=4000,
    )
    data = agents.extract_json_object(agents._first_text(response))
    return data["whatsapp_message"]
