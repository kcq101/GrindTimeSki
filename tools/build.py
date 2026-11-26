#!/usr/bin/env python3
"""Bundle the game into one self-contained page: dist/index.html.

src/index.html   page markup + CSS, with two markers:
                 <!--@ASSETS-->  replaced by the 3D models, base64 in <script type="text/plain"> tags
                 <!--@GAME-->    replaced by src/js/*.js, concatenated in filename order
src/js/*.js      the game, one closure split into ordered files (they share scope, so order matters)
assets/*.glb     skier and helmet models
assets/sfx/       sound effects (tools/sfx/build_sfx.py), inlined as one JSON tag
data/kdata.json  baked mountain data (terrain grid, trails, lifts), injected at /*@KDATA*/null

Usage: python3 tools/build.py [--out dist/index.html]
"""
import base64, glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = [('glbdata', 'assets/skier.glb'), ('helmdata', 'assets/helmet.glb')]


def build():
    page = open(os.path.join(ROOT, 'src/index.html'), encoding='utf-8').read()
    tags = []
    meta = json.load(open(os.path.join(ROOT, 'assets/sfx/sfx.json')))
    for k in meta:
        meta[k]['b64'] = base64.b64encode(open(os.path.join(ROOT, 'assets/sfx', k + '.mp3'), 'rb').read()).decode()
    tags.append(f'<script type="text/plain" id="sfxdata">{json.dumps(meta, separators=(",", ":"))}</script>')
    for tag_id, path in ASSETS:
        b64 = base64.b64encode(open(os.path.join(ROOT, path), 'rb').read()).decode()
        tags.append(f'<script type="text/plain" id="{tag_id}">{b64}</script>')
    js = ''.join(open(f, encoding='utf-8').read() for f in sorted(glob.glob(os.path.join(ROOT, 'src/js/*.js'))))
    kdata = open(os.path.join(ROOT, 'data/kdata.json'), encoding='utf-8').read().strip()
    json.loads(kdata)  # fail early on bad data
    assert js.count('/*@KDATA*/null') == 1, 'expected exactly one /*@KDATA*/null marker in src/js'
    js = js.replace('/*@KDATA*/null', kdata)
    faces = ''.join(f"@font-face{{font-family:'{fam}';src:url(data:font/woff2;base64,{base64.b64encode(open(os.path.join(ROOT, 'assets/fonts', fn), 'rb').read()).decode()}) format('woff2');font-weight:{w};font-display:swap}}"
                    for fam, fn, w in [('Barlow Condensed', 'barlow-condensed-latin-600-normal.woff2', 600), ('Barlow Condensed', 'barlow-condensed-latin-700-normal.woff2', 700),
                                       ('Barlow', 'barlow-latin-400-normal.woff2', 400), ('Barlow', 'barlow-latin-600-normal.woff2', 600)])
    assert page.count('<!--@FONTS-->') == 1, 'expected exactly one <!--@FONTS--> in src/index.html'
    page = page.replace('<!--@FONTS-->', f'<style>{faces}</style>')
    for marker in ('<!--@ASSETS-->', '<!--@GAME-->'):
        assert page.count(marker) == 1, f'expected exactly one {marker} in src/index.html'
    return page.replace('<!--@ASSETS-->', '\n'.join(tags)).replace('<!--@GAME-->\n', js).replace('<!--@GAME-->', js)


if __name__ == '__main__':
    out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else os.path.join(ROOT, 'dist/index.html')
    html = build()
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w', encoding='utf-8').write(html)
    print(f'wrote {out} ({len(html.encode()) / 1e6:.2f} MB)')
    # share image for link previews (og:image) and the claude.ai artifact thumbnail
    import shutil
    # og = link-preview card; thumb = app/artifact thumbnail (GrindTime Skiing badge); icons = tab + home-screen
    for f in ('og.jpg', 'thumb.jpg', 'icon-32.png', 'icon-192.png', 'apple-touch-icon.png'):
        shutil.copyfile(os.path.join(ROOT, 'assets', f), os.path.join(os.path.dirname(out), f))
