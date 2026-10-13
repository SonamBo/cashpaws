#!/usr/bin/env python3
"""
Turns generated artwork (ChatGPT etc.) into a store's exact image sizes, and
checks the result.

    python3 tools/marketing/make-covers.py crazygames landscape.png portrait.png square.png
    python3 tools/marketing/make-covers.py play feature.png icon.png

Each image is centre-cropped to the right shape, then resized with
high-quality resampling, into marketing/<store>/covers/. It warns when an
image had to be enlarged (stores reject blurry art) or loses a lot to cropping.
"""
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]

# store: [(file name, width, height, what it is), ...] in the order given on the command line
PRESETS = {
    'crazygames': [
        ('cover-1920x1080.png', 1920, 1080, 'landscape cover (16:9)'),
        ('cover-800x1200.png', 800, 1200, 'portrait cover (2:3)'),
        ('cover-800x800.png', 800, 800, 'square cover (1:1)'),
    ],
    'play': [
        ('feature-1024x500.png', 1024, 500, 'feature graphic'),
        ('icon-512.png', 512, 512, 'app icon (no transparency)'),
    ],
}

if len(sys.argv) < 3 or sys.argv[1] not in PRESETS:
    sys.exit(__doc__ + '\nStores: ' + ', '.join(PRESETS))
store, sources = sys.argv[1], sys.argv[2:]
targets = PRESETS[store]
if len(sources) != len(targets):
    sys.exit(f'{store} needs {len(targets)} images, in this order: ' + ', '.join(t[3] for t in targets))

out = ROOT / 'marketing' / store / 'covers'
out.mkdir(parents=True, exist_ok=True)
for src, (name, w, h, what) in zip(sources, targets):
    im = Image.open(src).convert('RGB')
    sw, sh = im.size
    want = w / h
    if sw / sh > want:                                   # too wide: trim the sides
        nw = round(sh * want); x = (sw - nw) // 2
        im = im.crop((x, 0, x + nw, sh))
    else:                                                # too tall: trim top and bottom
        nh = round(sw / want); y = (sh - nh) // 2
        im = im.crop((0, y, sw, y + nh))
    lost = 1 - (im.width * im.height) / (sw * sh)
    scale = w / im.width
    im = im.resize((w, h), Image.LANCZOS)
    im.save(out / name, optimize=True)
    notes = []
    if scale > 1.05: notes.append(f'enlarged {scale:.2f}x: check it is still sharp')
    if lost > 0.15: notes.append(f'{lost:.0%} cropped away: check nothing important was cut')
    print(f'✓ marketing/{store}/covers/{name}  {w}x{h}  {what}' + (f'  ({"; ".join(notes)})' if notes else ''))
