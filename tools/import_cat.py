#!/usr/bin/env python3
"""
Turn a green-screen cat collage into the four assets the game wants.

    python3 tools/import_cat.py mittens /path/to/collage.png
    python3 tools/import_cat.py pepper sheet.png --trim cheer=0.14

`--trim pose=fraction` shaves that fraction off the bottom of a pose before
cropping. Use it when a sheet prints the caption inside the panel and the text
touches the cat, so it cannot be filtered out as a separate mark. The cheer
pose's lower edge sits behind the level-up card, so trimming it costs nothing.

Expects a 2x2 sheet: face, peek on the top row; cheer, slump on the bottom.
Writes www/img/cat-{id}-{pose}.png.

Chroma keying here removes every green pixel, not just the ones a flood fill can
reach from the edge — green gets trapped in enclosed gaps, like between a tail
and a body, and a border flood leaves those as bright slivers. It then despills
the fringe, where anti-aliasing has mixed green into the outline.
"""

import sys
from collections import deque
from PIL import Image, ImageFilter

POSES = ['face', 'peek', 'cheer', 'slump']
# Width each pose is finally written at, 3x its largest on-screen size.
TARGET = {'face': 360, 'peek': 450, 'cheer': 600, 'slump': 630}


def is_green(c):
    r, g, b = c[:3]
    return g > 110 and g - max(r, b) > 45


def chroma_key(img):
    """Every green pixel goes, wherever it is. Then pull the spill out of the edge."""
    img = img.convert('RGBA')
    w, h = img.size
    px = img.load()
    out = Image.new('RGBA', (w, h))
    op = out.load()

    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            if is_green((r, g, b)):
                op[x, y] = (0, 0, 0, 0)
                continue
            # Despill: anti-aliased pixels carry green that would read as a
            # lime halo against the game's cream background.
            if g > (r + b) / 2 + 12:
                g = int((r + b) / 2 + 12)
            op[x, y] = (r, g, b, 255)
    return out


def largest_blob(img, keep=0.08):
    """
    Drop stray marks: keying crumbs, panel edges, and captions.

    Some sheets print the pose name inside the green panel rather than in the
    gutter, and a word like CHEER survives the size filter. A caption gives
    itself away by sitting low in the frame and being far wider than it is
    tall, which no part of a cat is.
    """
    w, h = img.size
    a = img.split()[-1].load()
    comp = [[0] * w for _ in range(h)]
    sizes = {}
    cid = 0
    for y in range(h):
        for x in range(w):
            if a[x, y] > 8 and not comp[y][x]:
                cid += 1
                n = 0
                dq = deque([(x, y)])
                comp[y][x] = cid
                while dq:
                    cx, cy = dq.popleft()
                    n += 1
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and a[nx, ny] > 8 and not comp[ny][nx]:
                            comp[ny][nx] = cid
                            dq.append((nx, ny))
                sizes[cid] = n
    if not sizes:
        return img
    big = max(sizes.values())
    drop = {c for c, n in sizes.items() if n < big * keep}

    # bounding box per component, to spot captions
    box = {}
    for y in range(h):
        for x in range(w):
            c = comp[y][x]
            if not c:
                continue
            if c not in box:
                box[c] = [x, y, x, y]
            else:
                bx = box[c]
                bx[0] = min(bx[0], x); bx[1] = min(bx[1], y)
                bx[2] = max(bx[2], x); bx[3] = max(bx[3], y)
    for c, (x0, y0, x1, y1) in box.items():
        bw, bh = x1 - x0 + 1, y1 - y0 + 1
        low = y0 > h * 0.72
        wide = bw > bh * 2.2
        if low and wide and sizes[c] < big * 0.25:
            drop.add(c)
    px = img.load()
    for y in range(h):
        for x in range(w):
            if comp[y][x] in drop:
                px[x, y] = (0, 0, 0, 0)
    return img


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    cat_id, path = sys.argv[1], sys.argv[2]
    trim = {}
    for arg in sys.argv[3:]:
        if arg.startswith('--trim'):
            continue
        if '=' in arg:
            pose, frac = arg.split('=')
            trim[pose] = float(frac)
    sheet = Image.open(path).convert('RGBA')
    W, H = sheet.size

    # Locate the panels by projection, not by connected regions. A cat that
    # touches the top and bottom of its panel splits that panel's green into
    # several pieces, so blob detection picks the wrong four.
    rgb = sheet.convert('RGB')
    px = rgb.load()

    def runs(hits, min_len):
        out, start = [], None
        for i, hit in enumerate(hits):
            if hit and start is None:
                start = i
            elif not hit and start is not None:
                if i - start >= min_len:
                    out.append((start, i - 1))
                start = None
        if start is not None and len(hits) - start >= min_len:
            out.append((start, len(hits) - 1))
        return out

    col_hits = [sum(1 for y in range(0, H, 6) if is_green(px[x, y])) > 6 for x in range(W)]
    row_hits = [sum(1 for x in range(0, W, 6) if is_green(px[x, y])) > 6 for y in range(H)]
    col_runs = runs(col_hits, W // 8)
    row_runs = runs(row_hits, H // 8)

    if len(col_runs) != 2 or len(row_runs) != 2:
        print(f'  expected a 2x2 sheet, found {len(col_runs)} columns and '
              f'{len(row_runs)} rows of green panels')
        sys.exit(1)

    pad = 4
    order = [(cx0 + pad, ry0 + pad, cx1 - pad, ry1 - pad)
             for (ry0, ry1) in row_runs for (cx0, cx1) in col_runs]
    boxes = dict(zip(POSES, order))

    for pose in POSES:
        if pose not in boxes:
            continue
        cell = sheet.crop(boxes[pose])
        if trim.get(pose):
            cw, ch = cell.size
            cell = cell.crop((0, 0, cw, round(ch * (1 - trim[pose]))))
        keyed = largest_blob(chroma_key(cell))
        bb = keyed.getbbox()
        if not bb:
            print(f'  {pose}: nothing found, check the panel layout')
            continue
        cat = keyed.crop(bb)

        r, g, b, al = cat.split()
        al = al.filter(ImageFilter.MedianFilter(3)).filter(ImageFilter.GaussianBlur(0.5))
        cat = Image.merge('RGBA', (r, g, b, al))

        want = TARGET[pose]
        scale = want / cat.width
        cat = cat.resize((want, max(1, round(cat.height * scale))), Image.LANCZOS)

        dest = f'www/img/cat-{cat_id}-{pose}.png'
        cat.save(dest, optimize=True)
        note = 'upscaled' if scale > 1.02 else 'downscaled' if scale < 0.98 else 'native'
        print(f'  {pose:6} -> {dest}  {cat.width}x{cat.height}  ({note} {scale:.2f}x)')

    print(f'\nNow set hasArt: true for "{cat_id}" in www/js/cats.js, then run '
          f'node test/preflight.js')


if __name__ == '__main__':
    main()
