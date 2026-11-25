#!/usr/bin/env python3
"""Build the game's sound effects from the CC0 recordings in assets/sfx/src (credits: assets/sfx/SOURCES.md).

Loops (skis on snow, edge, wind) are textures rebuilt from the recordings: short overlapping grains with power-complementary
windows, each brought to the same loudness, taken from random places in the recording. That keeps the recording's real tone
and crackle but evens out the slow swells, so nothing recognisable comes round when it repeats, and the grains wrap round the
loop's end so it repeats without a seam. The game changes pitch, filter and level of these live.

One-shots (snow crunches, wood chop, metal clank) are trimmed, faded, high-passed and normalised.

Everything is written as mono MP3 to assets/sfx/*.mp3 plus assets/sfx/sfx.json (true sample counts, so the game can set
exact loop points whether or not the browser strips the MP3 encoder delay). tools/build.py inlines them.

Usage: python3 tools/sfx/build_sfx.py      (numpy + ffmpeg)
"""
import json, os, subprocess
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'assets/sfx/src')
OUT = os.path.join(ROOT, 'assets/sfx')
RATE = 32000
LOOP = 6.0
GRAIN = 0.125
LOOPS = {
    # skis on groomed snow (Nox_Sound, snowboard slide 02)
    'glide': {'src': '612664.mp3', 'span': (0.0, 10.0), 'seed': 1, 'kbps': 56},
    # a second take, kept separate so the edge layer isn't the glide layer pitched up (Nox_Sound, snowboard slide 01)
    'edge': {'src': '612665.mp3', 'span': (0.5, 11.5), 'seed': 2, 'kbps': 56},
    # air at speed: above 500 Hz of a car-window wind recording (FunWithSound)
    'wind': {'src': '439242_10-40s.mp3', 'span': (0.0, 30.0), 'seed': 3, 'kbps': 40, 'filter': 'highpass=f=500,highpass=f=500', 'grain': 0.25},
}
SHOTS = {
    'crunch1': 'ryding_snow_1.ogg', 'crunch2': 'ryding_snow_2.ogg', 'crunch3': 'ryding_snow_3.ogg', 'crunch4': 'ryding_snow_4.ogg', 'crunch5': 'ryding_snow_5.ogg',
    'chop1': 'sheyvan_chop_1.ogg', 'chop2': 'sheyvan_chop_2.ogg',
    'clank1': 'ogrebane_metal_1.ogg', 'clank2': 'ogrebane_metal_2.ogg',
}


def decode(path, flt=None, span=None):
    af = 'highpass=f=60' + (',' + flt if flt else '')
    cmd = ['ffmpeg', '-v', 'error']
    if span: cmd += ['-ss', str(span[0]), '-t', str(span[1] - span[0])]
    cmd += ['-i', path, '-af', af, '-ac', '1', '-ar', str(RATE), '-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, dtype=np.float32).astype(np.float64)


def encode(x, name, kbps):
    path = os.path.join(OUT, name + '.mp3')
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(RATE), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', path], input=pcm, check=True)
    return path


def rms(x): return float(np.sqrt(np.mean(x * x)) + 1e-12)


def texture(x, seed, grain):
    g = int(grain * RATE); h = g // 2; n = int(LOOP * RATE) // h * h
    win = np.sin(np.linspace(0, np.pi, g, endpoint=False))   # sin windows at 50 % overlap sum to constant power
    rng = np.random.default_rng(seed); out = np.zeros(n); ref = rms(x)
    for k in range(n // h):
        for _ in range(40):
            s = rng.integers(0, len(x) - g); seg = x[s:s + g]; r = rms(seg)
            if r > 0.3 * ref and np.max(np.abs(seg)) < 5.5 * r: break   # skip near-silence and clicks
        seg = seg / r * win; p = k * h
        idx = (np.arange(g) + p) % n; out[idx] += seg
    out /= rms(out); out *= 10 ** (-16 / 20)
    pk = np.max(np.abs(out)); out = np.tanh(out / 0.9) * 0.9 if pk > 0.9 else out
    return out


def shot(x):
    a = np.abs(x); thr = 0.02 * a.max(); idx = np.where(a > thr)[0]
    x = x[max(0, idx[0] - int(0.004 * RATE)): idx[-1] + int(0.02 * RATE)]
    f = int(0.01 * RATE); x[-f:] *= np.linspace(1, 0, f)
    return x / np.max(np.abs(x)) * 0.89


def main():
    meta = {}
    for name, L in LOOPS.items():
        x = decode(os.path.join(SRC, L['src']), L.get('filter'), L['span'])
        y = texture(x, L['seed'], L.get('grain', GRAIN)); encode(y, name, L['kbps'])
        meta[name] = {'n': len(y), 'rate': RATE, 'loop': True}
    for name, f in SHOTS.items():
        y = shot(decode(os.path.join(SRC, f))); encode(y, name, 64)
        meta[name] = {'n': len(y), 'rate': RATE, 'loop': False}
    json.dump(meta, open(os.path.join(OUT, 'sfx.json'), 'w'), indent=1)
    tot = sum(os.path.getsize(os.path.join(OUT, k + '.mp3')) for k in meta)
    print(f'{len(meta)} sounds, {tot / 1024:.0f} KB')


if __name__ == '__main__':
    main()
