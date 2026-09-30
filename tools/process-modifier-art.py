#!/usr/bin/env python3
"""
Level modifier art: ChatGPT output in tools/art-src/ -> www/games/money-sort/img/.

  python3 tools/process-modifier-art.py

- Key out the #00FF00 background with a soft edge, and despill: nothing in
  these objects has green above both its red and blue, so any that does is
  background bleeding in, and is pulled back down.
- The ice body is made see-through, so the coin frozen under it shows. Its
  flat body colour gets 40% opacity; the rim, shine and cracks stay solid.
- Trim, and scale each to 3x its size on screen.
"""
import numpy as np
from PIL import Image

SRC, OUT = 'tools/art-src/', 'www/games/money-sort/img/'


def load(name):
    return np.asarray(Image.open(SRC + name).convert('RGB')).astype(np.float64)


def key(img, lo=70, hi=170):
    bg = np.median(img[10:80, 10:80].reshape(-1, 3), axis=0)
    d = np.sqrt(((img - bg) ** 2).sum(-1))
    alpha = np.clip((d - lo) / (hi - lo), 0, 1)
    rgb = img.copy()
    rgb[..., 1] = np.minimum(rgb[..., 1], np.maximum(rgb[..., 0], rgb[..., 2]))   # despill
    rgb[alpha == 0] = 0
    return rgb, alpha


def see_through(rgb, alpha, body_alpha=0.40):
    """The ice body is its most common solid colour; fade it, keep the rest."""
    solid = alpha > 0.99
    px = rgb[solid].round(-1)
    vals, counts = np.unique(px, axis=0, return_counts=True)
    body = vals[counts.argmax()]
    near = np.sqrt(((rgb - body) ** 2).sum(-1))
    fade = body_alpha + (1 - body_alpha) * np.clip((near - 18) / 40, 0, 1)
    return np.minimum(alpha, fade)


def save(rgb, alpha, name, width):
    im = Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), 'RGBA')
    im = im.crop(im.getbbox())
    im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(OUT + name, optimize=True)
    print(f'{name:18} {im.size}')


def main():
    rgb, a = key(load('padlock.png'));     save(rgb, a, 'padlock.png', 120)
    rgb, a = key(load('lucky-paw.png'));   save(rgb, a, 'chip-lucky.png', 160)
    for src, out in (('ice.png', 'ice.png'), ('ice-cracked.png', 'ice-cracked.png')):
        rgb, a = key(load(src))
        save(rgb, see_through(rgb, a), out, 170)


if __name__ == '__main__':
    main()
