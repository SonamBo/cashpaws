#!/usr/bin/env python3
"""
Bell Quest art: Gemini output in tools/art-src/ -> game-ready files in www/img/.

  python3 tools/process-quest-art.py

1. Remove Gemini's sparkle watermark. It is a white overlay at the same 48x48
   spot in every 1024 image. Its opacity is read off the icon, where it sits on
   pure magenta, and the blend is reversed, so a coin under it comes back intact.
2. Key out the #FF00FF background with a soft edge, and pull the magenta
   fringe out of the anti-aliased outline.
3. Trim, split the stones into three, and scale each to 3x its largest size
   in the game.
"""
import numpy as np
from PIL import Image

SRC, OUT = 'tools/art-src/', 'www/img/'
WM = (slice(880, 928), slice(880, 928))          # rows, cols of the sparkle
OUTLINE = np.array([63, 58, 55], dtype=np.float64)   # #3f3a37


def load(name):
    return np.asarray(Image.open(SRC + name).convert('RGB')).astype(np.float64)


def watermark_alpha():
    icon = load('bell-icon.png')
    base = np.median(icon[20:120, 20:120, 1])
    return np.clip((icon[WM][..., 1] - base) / (255 - base), 0, 0.95)


def unwatermark(img, alpha):
    a = alpha[..., None]
    patch = img[WM]
    img[WM] = np.clip((patch - 255 * a) / (1 - a), 0, 255)
    return img


def key(img, lo=60, hi=150):
    """Alpha from distance to magenta; de-spill the partly transparent edge."""
    bg = np.median(img[10:100, 10:100].reshape(-1, 3), axis=0)
    d = np.sqrt(((img - bg) ** 2).sum(-1))
    alpha = np.clip((d - lo) / (hi - lo), 0, 1)
    a = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.clip((img - (1 - a) * bg) / a, 0, 255)
    rgb[alpha == 0] = 0
    # Every object ends in its dark outline, so a soft edge pixel is outline
    # blending into the background: give it the outline's colour, not a
    # magenta-tinted guess.
    edge = (alpha > 0) & (alpha < 0.98)
    # A purple pixel along the outline is far enough from magenta to key as
    # solid. Nothing in this art has red and blue both well above green, so
    # that tint measures how much magenta is mixed in.
    tint = np.minimum(img[..., 0], img[..., 2]) - img[..., 1]
    mixed = np.clip((tint - 15) / 215, 0, 1)
    alpha = np.minimum(alpha, 1 - mixed)
    edge |= (mixed > 0) & (alpha > 0)
    rgb[edge] = OUTLINE
    return np.dstack([rgb, alpha * 255]).astype(np.uint8)


def save(rgba, name, width):
    im = Image.fromarray(rgba, 'RGBA')
    im = im.crop(im.getbbox())
    h = round(im.height * width / im.width)
    im = im.resize((width, h), Image.LANCZOS)
    # 256 colours is plenty for flat art, and a third of the size.
    im.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(OUT + name, optimize=True)
    return im.size


def components_x(alpha):
    """Split a row of separate objects at the empty columns between them."""
    cols = alpha.max(0) > 0
    runs, start = [], None
    for x, on in enumerate(cols):
        if on and start is None:
            start = x
        if not on and start is not None:
            runs.append((start, x)); start = None
    if start is not None:
        runs.append((start, len(cols)))
    return [r for r in runs if r[1] - r[0] > 40]


def main():
    wm = watermark_alpha()
    print('bell    ', save(key(unwatermark(load('bell-icon.png'), wm)), 'quest-bell.png', 180))
    print('prize   ', save(key(unwatermark(load('bell-prize.png'), wm)), 'quest-prize.png', 480))

    stones = key(unwatermark(load('bell-stones.png'), wm))
    runs = components_x(stones[..., 3])
    assert len(runs) == 3, runs
    for (x0, x1), name in zip(runs, ['ahead', 'done', 'here']):
        print('stone', name, save(stones[:, x0:x1].copy(), f'quest-stone-{name}.png', 240))

    bg = unwatermark(load('bell-path-bg.png'), wm)
    im = Image.fromarray(bg.astype(np.uint8), 'RGB').resize((600, 600), Image.LANCZOS)
    im.save(OUT + 'quest-path.jpg', quality=84, optimize=True, progressive=True)
    print('path     (600, 600)')


if __name__ == '__main__':
    main()
