#!/usr/bin/env python3
"""
Bring ChatGPT art made on a flat green (#00FF00) or magenta (#FF00FF) ground
into the game: key the ground out, keep see-through parts see-through, trim,
and size to 3x what the screen draws.

    python3 tools/import-art.py <src> <out> --max 168            longest side
    python3 tools/import-art.py <src> <out> --width 700
    python3 tools/import-art.py <src> <out> --width 1024 --jpg   (no keying)

Keying by colour difference, not distance: how much a pixel leans towards
the ground colour (green above red and blue, or red and blue above green)
says how much of it is ground. Fully ground -> transparent; partly -> the
ground's share is taken back out of its colour ("unmixing"), so a glass tube
over green comes out as clear glass, not green glass, and edges carry no
fringe. Art whose own colours lean the same way (a green banknote on a green
ground) stays solid because its lean is far weaker than the ground's.
"""
import argparse
import numpy as np
from PIL import Image


def ground(img):
    """The ground colour: the median of the image's border."""
    b = np.concatenate([img[:6].reshape(-1, 3), img[-6:].reshape(-1, 3), img[:, :6].reshape(-1, 3), img[:, -6:].reshape(-1, 3)])
    return np.median(b, axis=0)


def lean(img, bg):
    """How far each pixel leans towards the ground's hue (0 = none)."""
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    if bg[1] > max(bg[0], bg[2]):                      # green ground
        return g - np.maximum(r, b), bg[1] - max(bg[0], bg[2])
    return np.minimum(r, b) - g, min(bg[0], bg[2]) - bg[1]   # magenta ground


def key(img, solid=70, clear=None, despill_all=False):
    """alpha: 1 where the lean is under `solid`, 0 at the ground's own lean."""
    bg = ground(img)
    s, s_bg = lean(img, bg)
    clear = clear if clear is not None else s_bg * 0.92
    a = 1 - np.clip((s - solid) / max(1, clear - solid), 0, 1)
    # Unmix: P = a*C + (1-a)*bg  ->  C = (P - (1-a)*bg) / a
    safe = np.maximum(a, 0.05)[..., None]
    rgb = np.clip((img - (1 - a)[..., None] * bg) / safe, 0, 255)
    # Despill whatever ground tint is left at the edges.
    if bg[1] > max(bg[0], bg[2]):
        rgb[..., 1] = np.where(a < 1, np.minimum(rgb[..., 1], np.maximum(rgb[..., 0], rgb[..., 2]) + 12), rgb[..., 1])
    else:
        lim = rgb[..., 1] + 12
        rgb[..., 0] = np.where(a < 1, np.minimum(rgb[..., 0], np.maximum(lim, rgb[..., 2])), rgb[..., 0])
        rgb[..., 2] = np.where(a < 1, np.minimum(rgb[..., 2], np.maximum(lim, rgb[..., 0])), rgb[..., 2])
    if despill_all and bg[1] > max(bg[0], bg[2]):
        # Art with no green of its own (glass): no pixel may lean green at all.
        rgb[..., 1] = np.minimum(rgb[..., 1], np.maximum(rgb[..., 0], rgb[..., 2]) + 4)
    rgb[a <= 0.01] = 0
    return rgb, a


def to_image(rgb, a):
    return Image.fromarray(np.dstack([rgb, a * 255]).round().astype(np.uint8), 'RGBA')


def drop_specks(im, keep=0.02):
    """ChatGPT signs some images with a small sparkle in a corner. Clear any
    separate blob under `keep` of the largest one (whiskers and rays touch
    or sit near the body and are far bigger than the mark)."""
    from scipy import ndimage
    arr = np.asarray(im).copy()
    lab, n = ndimage.label(arr[..., 3] > 20)
    if n <= 1:
        return im
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    small = [i + 1 for i, sz in enumerate(sizes) if sz < sizes.max() * keep]
    arr[np.isin(lab, small), 3] = 0
    return Image.fromarray(arr, 'RGBA')


def trim(im, pad=0.02):
    """Crop to the art (ignoring faint specks), with a small even margin."""
    im = drop_specks(im)
    al = np.asarray(im)[..., 3]
    ys, xs = np.where(al > 40)
    box = [xs.min(), ys.min(), xs.max() + 1, ys.max() + 1]
    p = round(max(box[2] - box[0], box[3] - box[1]) * pad)
    im = im.crop((box[0], box[1], box[2], box[3]))
    out = Image.new('RGBA', (im.width + 2 * p, im.height + 2 * p), (0, 0, 0, 0))
    out.paste(im, (p, p))
    return out


def size(im, width=None, longest=None):
    if longest:
        k = longest / max(im.size)
    else:
        k = width / im.width
    k = min(k, 1.0) if k > 1 else k                     # never enlarge
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('out')
    ap.add_argument('--width', type=int); ap.add_argument('--max', type=int)
    ap.add_argument('--solid', type=float, default=70)
    ap.add_argument('--jpg', action='store_true')
    ap.add_argument('--pad', type=float, default=0.02)
    ap.add_argument('--despill-all', action='store_true', help='art with no ground colour of its own, e.g. glass')
    o = ap.parse_args()
    src = Image.open(o.src).convert('RGB')
    if o.jpg:
        im = size(src, width=o.width, longest=o.max)
        im.save(o.out, quality=86, optimize=True, progressive=True)
    else:
        rgb, a = key(np.asarray(src).astype(np.float64), solid=o.solid, despill_all=o.despill_all)
        im = size(trim(to_image(rgb, a), o.pad), width=o.width, longest=o.max)
        im.save(o.out, optimize=True)
    print(f'{o.out}: {im.size}')


if __name__ == '__main__':
    main()
