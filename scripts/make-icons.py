"""Gera os ícones do PWA (verde sobre grafite). Uso: python3 scripts/make-icons.py"""
from PIL import Image, ImageDraw, ImageFont
import glob

def font(size):
    for p in glob.glob('/usr/share/fonts/**/*Bold*.ttf', recursive=True) + glob.glob('/usr/share/fonts/**/*.ttf', recursive=True):
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    return ImageFont.load_default()

def icon(size, maskable=False):
    img = Image.new('RGB', (size, size), (8, 9, 10))
    d = ImageDraw.Draw(img)
    pad = int(size * (0.18 if maskable else 0.10))
    r = int(size * 0.22)
    # cartão grafite com borda verde suave
    d.rounded_rectangle([pad, pad, size - pad, size - pad], r, fill=(24, 28, 25), outline=(34, 197, 94), width=max(2, size // 64))
    f = font(int(size * 0.52))
    bbox = d.textbbox((0, 0), 'P', font=f)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((size - w) / 2 - bbox[0], (size - h) / 2 - bbox[1]), 'P', font=f, fill=(74, 222, 128))
    return img

icon(192).save('public/pwa-192.png')
icon(512, maskable=True).save('public/pwa-512.png')
icon(180, maskable=True).save('public/apple-touch-icon.png')
print('ícones gerados')
