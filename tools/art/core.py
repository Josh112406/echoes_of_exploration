"""Echoes of Exploration - pixel-art toolkit (core).

Indexed-colour canvas, master palette, ordered dithering, value noise, a tiny
bitmap font, atlas packing and PNG export with provenance metadata.

AI disclosure: this file and every image it produces were generated with an
SI/AI assistant (Claude, Anthropic) acting for Member 5 (Visual Design) and
must be reviewed by a human team member. Licence: code Apache-2.0, art CC0-1.0.
"""
from __future__ import annotations

import json
import os
from typing import Iterable, Sequence

import numpy as np
from PIL import Image, PngImagePlugin

# --------------------------------------------------------------------------
# Master palette. 24 colours from docs/ART_STYLE_GUIDE.md plus two documented
# extension ramps (Elsewhere, Earth) and one semantic UI green.
# --------------------------------------------------------------------------
PALETTE: list[tuple[str, str, str, str]] = [
    # key, hex, name, ramp
    ("s0", "#05070f", "Void", "space"),
    ("s1", "#0b0f1d", "Deep Indigo", "space"),
    ("s2", "#131a2e", "Shadow Navy", "space"),
    ("s3", "#1d263f", "Dusk", "space"),
    ("m0", "#27293d", "Basalt Dark", "moon"),
    ("m1", "#3b3e59", "Regolith Deep", "moon"),
    ("m2", "#595e7d", "Regolith Mid", "moon"),
    ("m3", "#8389a8", "Dust Light", "moon"),
    ("m4", "#b2b8d4", "Crust Cream", "moon"),
    ("m5", "#e2e6fa", "Highlight Rim", "moon"),
    ("r0", "#2b140e", "Shadow Umber", "mars"),
    ("r1", "#522116", "Deep Rust", "mars"),
    ("r2", "#7d331c", "Ochre Core", "mars"),
    ("r3", "#ab4f2c", "Terracotta", "mars"),
    ("r4", "#cf724a", "Dust Tan", "mars"),
    ("r5", "#e89e7d", "Haze Peach", "mars"),
    ("c0", "#032630", "Cyan Void", "cyan"),
    ("c1", "#064b5c", "Cyan Shadow", "cyan"),
    ("c2", "#087d99", "Cyan Deep", "cyan"),
    ("c3", "#0ec3dc", "Cyan Glow", "cyan"),
    ("c4", "#7ef1ff", "Laser Core", "cyan"),
    ("w0", "#4a1805", "Ember Shadow", "warm"),
    ("w1", "#e65100", "Thruster Orange", "warm"),
    ("w2", "#f59e0b", "Beacon Gold", "warm"),
    # --- extension: Elsewhere (asteroid rubble -> Pluto tan) ---
    ("e0", "#221d1f", "Rubble Dark", "elsewhere"),
    ("e1", "#3d3532", "Rubble Deep", "elsewhere"),
    ("e2", "#5e534c", "Eros Brown", "elsewhere"),
    ("e3", "#857669", "Taupe", "elsewhere"),
    ("e4", "#b09d88", "Regolith Tan", "elsewhere"),
    ("e5", "#ddc8a8", "Pluto Tan", "elsewhere"),
    # --- extension: Earth (sampled from the practice-build Earth) ---
    ("o0", "#081f3e", "Ocean Night", "earth"),
    ("o1", "#07457f", "Ocean", "earth"),
    ("o2", "#165e98", "Ocean Light", "earth"),
    ("g0", "#113b29", "Land Deep", "earth"),
    ("g1", "#1c734a", "Land", "earth"),
    ("g2", "#4cc38a", "Signal Green", "earth"),
]

KEYS = [p[0] for p in PALETTE]
IDX = {k: i for i, k in enumerate(KEYS)}
HEX = {p[0]: p[1] for p in PALETTE}
T = 255  # transparent index


def _rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


RGB = np.zeros((256, 4), dtype=np.uint8)
for _i, _p in enumerate(PALETTE):
    RGB[_i, :3] = _rgb(_p[1])
    RGB[_i, 3] = 255

# Shading chains, dark -> light. Used by bevel() and darken().
CHAINS: dict[str, list[str]] = {
    "cool": ["s0", "s1", "s2", "s3", "m0", "m1", "m2", "m3", "m4", "m5"],
    "mars": ["r0", "r1", "r2", "r3", "r4", "r5"],
    "cyan": ["c0", "c1", "c2", "c3", "c4"],
    "foil": ["w0", "r2", "r3", "w1", "w2"],
    "tan": ["e0", "e1", "e2", "e3", "e4", "e5"],
    "ocean": ["o0", "o1", "o2"],
    "land": ["g0", "g1", "g2"],
}
# One step darker for every colour (used by vignette / shadow passes).
DARKER: dict[str, str] = {}
for _name in ("cool", "mars", "cyan", "tan", "ocean", "land"):
    _c = CHAINS[_name]
    for _a, _b in zip(_c[1:], _c[:-1]):
        DARKER.setdefault(_a, _b)
DARKER.update({"s0": "s0", "r0": "s1", "c0": "s1", "e0": "s1", "o0": "s1", "g0": "s1",
               "w0": "s1", "w1": "w0", "w2": "w1"})
DARK_LUT = np.arange(256, dtype=np.uint8)
for _k, _v in DARKER.items():
    DARK_LUT[IDX[_k]] = IDX[_v]


def K(key) -> int:
    """Palette key ('m3') or index -> index."""
    if key is None:
        return T
    if isinstance(key, (int, np.integer)):
        return int(key)
    return IDX[key]


# --------------------------------------------------------------------------
# Ordered dither + value noise
# --------------------------------------------------------------------------
_B2 = np.array([[0, 2], [3, 1]])


def _bayer(n: int) -> np.ndarray:
    m = _B2
    while m.shape[0] < n:
        m = np.block([[4 * m, 4 * m + 2], [4 * m + 3, 4 * m + 1]])
    return (m + 0.5) / (m.size)


BAYER8 = _bayer(8)
BAYER4 = _bayer(4)


def bayer(w: int, h: int, n: int = 8, ox: int = 0, oy: int = 0) -> np.ndarray:
    m = BAYER8 if n == 8 else BAYER4
    yy, xx = np.mgrid[0:h, 0:w]
    return m[(yy + oy) % n, (xx + ox) % n]


def _hash(ix, iy, seed):
    ix = np.asarray(ix, dtype=np.int64)
    iy = np.asarray(iy, dtype=np.int64)
    n = (ix * 374761393 + iy * 668265263 + int(seed) * 362437) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    n = n ^ (n >> 16)
    return (n & 0xFFFFFF) / float(0x1000000)


def vnoise(x, y, seed=0, period=None):
    """Smooth value noise in [0,1]. `period` (cells) makes it wrap along x."""
    x = np.asarray(x, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    x0 = np.floor(x)
    y0 = np.floor(y)
    fx = x - x0
    fy = y - y0
    fx = fx * fx * (3 - 2 * fx)
    fy = fy * fy * (3 - 2 * fy)
    x0 = x0.astype(np.int64)
    y0 = y0.astype(np.int64)
    x1 = x0 + 1
    if period:
        x0 = x0 % period
        x1 = x1 % period
    a = _hash(x0, y0, seed)
    b = _hash(x1, y0, seed)
    c = _hash(x0, y0 + 1, seed)
    d = _hash(x1, y0 + 1, seed)
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy


def fbm(x, y, seed=0, octaves=4, scale=64.0, gain=0.5, period_px=None):
    """Fractal value noise in [0,1]; tileable in x when period_px is given."""
    x = np.asarray(x, dtype=np.float64) / scale
    y = np.asarray(y, dtype=np.float64) / scale
    per = None if not period_px else max(1, int(round(period_px / scale)))
    if per:
        x = x * (per / (period_px / scale))  # snap so the period is an integer cell count
    amp, tot, out = 1.0, 0.0, 0.0
    for o in range(octaves):
        out = out + amp * vnoise(x * (2 ** o), y * (2 ** o), seed + o * 17, None if not per else per * (2 ** o))
        tot += amp
        amp *= gain
    return out / tot


def quant(t, n: int, B, band: float = 0.4):
    """Quantise t in [0,1] to n levels, dithering only inside a band at each step."""
    v = np.clip(t, 0, 0.99999) * (n - 1)
    base = np.floor(v)
    frac = v - base
    lo = (1 - band) / 2
    up = np.where(frac <= lo, 0, np.where(frac >= 1 - lo, 1, ((frac - lo) / max(band, 1e-6)) > B))
    return np.clip(base + up, 0, n - 1).astype(np.int64)


# --------------------------------------------------------------------------
# Bitmap fonts (team-made, CC0). 3x5 micro font for marks and tiny labels.
# --------------------------------------------------------------------------
_F35 = {
    "A": "010101111101101", "B": "110101110101110", "C": "011100100100011", "D": "110101101101110",
    "E": "111100110100111", "F": "111100110100100", "G": "011100101101011", "H": "101101111101101",
    "I": "111010010010111", "J": "001001001101010", "K": "101101110101101", "L": "100100100100111",
    "M": "101111111101101", "N": "110101101101101", "O": "111101101101111", "P": "110101110100100",
    "Q": "010101101111011", "R": "110101110101101", "S": "011100010001110", "T": "111010010010010",
    "U": "101101101101111", "V": "101101101101010", "W": "101101111111101", "X": "101101010101101",
    "Y": "101101010010010", "Z": "111001010100111",
    "0": "111101101101111", "1": "010110010010111", "2": "110001010100111", "3": "110001010001110",
    "4": "101101111001001", "5": "111100110001110", "6": "011100110101010", "7": "111001010010010",
    "8": "010101010101010", "9": "010101011001110",
    "-": "000000111000000", ".": "000000000000010", "/": "001001010100100", ":": "000010000010000",
    " ": "000000000000000", "+": "000010111010000", "%": "101001010100101", "'": "010010000000000",
}

WATERMARK = "SI-GENERATED ILLUSTRATION"


def text_width(s: str) -> int:
    return len(s) * 4 - 1


# --------------------------------------------------------------------------
# Indexed canvas
# --------------------------------------------------------------------------
class Art:
    """Indexed pixel canvas. `a` holds palette indices, 255 = transparent."""

    def __init__(self, w: int, h: int, fill=None):
        self.w, self.h = int(w), int(h)
        self.a = np.full((self.h, self.w), K(fill), dtype=np.uint8)

    # -- basics -----------------------------------------------------------
    @classmethod
    def of(cls, arr) -> "Art":
        o = cls(arr.shape[1], arr.shape[0])
        o.a = np.asarray(arr, dtype=np.uint8).copy()
        return o

    def copy(self) -> "Art":
        return Art.of(self.a)

    def px(self, x, y, key):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.w and 0 <= y < self.h:
            self.a[y, x] = K(key)
        return self

    def get(self, x, y) -> int:
        if 0 <= x < self.w and 0 <= y < self.h:
            return int(self.a[y, x])
        return T

    def rect(self, x, y, w, h, key):
        x, y, w, h = int(round(x)), int(round(y)), int(round(w)), int(round(h))
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(self.w, x + w), min(self.h, y + h)
        if x1 > x0 and y1 > y0:
            self.a[y0:y1, x0:x1] = K(key)
        return self

    def frame(self, x, y, w, h, key):
        self.rect(x, y, w, 1, key).rect(x, y + h - 1, w, 1, key)
        self.rect(x, y, 1, h, key).rect(x + w - 1, y, 1, h, key)
        return self

    def hline(self, x, y, n, key):
        return self.rect(x, y, n, 1, key)

    def vline(self, x, y, n, key):
        return self.rect(x, y, 1, n, key)

    def line(self, x0, y0, x1, y1, key, thick: int = 1):
        x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx + dy
        while True:
            if thick == 1:
                self.px(x0, y0, key)
            else:
                self.rect(x0, y0, thick, thick, key)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy
        return self

    def poly(self, pts: Sequence[tuple[float, float]], key):
        """Scanline polygon fill (pixel centres)."""
        k = K(key)
        ys = [p[1] for p in pts]
        y0, y1 = int(np.floor(min(ys))), int(np.ceil(max(ys)))
        n = len(pts)
        for y in range(max(0, y0), min(self.h, y1 + 1)):
            yc = y + 0.5
            xs = []
            for i in range(n):
                (xa, ya), (xb, yb) = pts[i], pts[(i + 1) % n]
                if (ya <= yc < yb) or (yb <= yc < ya):
                    xs.append(xa + (yc - ya) * (xb - xa) / (yb - ya))
            xs.sort()
            for i in range(0, len(xs) - 1, 2):
                xa, xb = int(np.ceil(xs[i] - 0.5)), int(np.floor(xs[i + 1] - 0.5))
                if xb >= xa:
                    self.rect(xa, y, xb - xa + 1, 1, k)
        return self

    def ellipse(self, cx, cy, rx, ry, key, ring: float = 0.0):
        """Filled ellipse (or ring of given thickness in px) centred on (cx, cy)."""
        k = K(key)
        y0, y1 = int(np.floor(cy - ry)), int(np.ceil(cy + ry))
        x0, x1 = int(np.floor(cx - rx)), int(np.ceil(cx + rx))
        for y in range(max(0, y0), min(self.h, y1 + 1)):
            for x in range(max(0, x0), min(self.w, x1 + 1)):
                d = ((x - cx) / max(rx, 0.01)) ** 2 + ((y - cy) / max(ry, 0.01)) ** 2
                if d <= 1.0:
                    if ring:
                        di = ((x - cx) / max(rx - ring, 0.01)) ** 2 + ((y - cy) / max(ry - ring, 0.01)) ** 2
                        if di <= 1.0:
                            continue
                    self.a[y, x] = k
        return self

    def disc(self, cx, cy, r, key, ring: float = 0.0):
        return self.ellipse(cx, cy, r, r, key, ring)

    def rows(self, x, y, rows: Iterable[str], legend: dict[str, str | None]):
        """Stamp ASCII art. '.' and ' ' are transparent/skip."""
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch in ". ":
                    continue
                self.px(x + i, y + j, legend[ch])
        return self

    def blit(self, src: "Art", x: int, y: int, mask_only: bool = True):
        x, y = int(round(x)), int(round(y))
        sx0, sy0 = max(0, -x), max(0, -y)
        dx0, dy0 = max(0, x), max(0, y)
        w = min(src.w - sx0, self.w - dx0)
        h = min(src.h - sy0, self.h - dy0)
        if w <= 0 or h <= 0:
            return self
        s = src.a[sy0:sy0 + h, sx0:sx0 + w]
        d = self.a[dy0:dy0 + h, dx0:dx0 + w]
        if mask_only:
            m = s != T
            d[m] = s[m]
        else:
            d[:] = s
        return self

    def text(self, x, y, s: str, key, shadow=None):
        k = K(key)
        cx = int(x)
        for ch in s.upper():
            g = _F35.get(ch, _F35[" "])
            for i, bit in enumerate(g):
                if bit == "1":
                    if shadow is not None:
                        self.px(cx + i % 3 + 1, y + i // 3 + 1, shadow)
                    self.px(cx + i % 3, y + i // 3, k)
            cx += 4
        return self

    # -- pixel-art passes ---------------------------------------------------
    def mask(self) -> np.ndarray:
        return self.a != T

    def _nb(self, m: np.ndarray):
        up = np.zeros_like(m)
        dn = np.zeros_like(m)
        lf = np.zeros_like(m)
        rt = np.zeros_like(m)
        up[1:, :] = m[:-1, :]
        dn[:-1, :] = m[1:, :]
        lf[:, 1:] = m[:, :-1]
        rt[:, :-1] = m[:, 1:]
        return up, dn, lf, rt

    def bevel(self, chain: str = "cool", lo: str | None = None, hi: str | None = None, region=None,
              light: bool = True, dark: bool = True):
        """Lit top/left edge, shaded bottom/right edge for every pixel in `chain`.

        Pixels are only moved between `lo` and `hi` (inclusive) of the chain.
        1-px-thick strokes are left alone so thin struts keep their tone.
        """
        ch = [IDX[k] for k in CHAINS[chain]]
        lo_i = ch.index(IDX[lo]) if lo else 0
        hi_i = ch.index(IDX[hi]) if hi else len(ch) - 1
        m = self.mask()
        up, dn, lf, rt = self._nb(m)
        lit = (~up | ~lf)
        shd = (~dn | ~rt)
        out = self.a.copy()
        sel = np.zeros_like(m)
        if region is not None:
            x, y, w, h = region
            sel[y:y + h, x:x + w] = True
        else:
            sel[:] = True
        for i, c in enumerate(ch):
            if i < lo_i or i > hi_i:
                continue
            here = (self.a == c) & sel
            if light and i < hi_i:
                out[here & lit & ~shd] = ch[i + 1]
            if dark and i > lo_i:
                out[here & shd & ~lit] = ch[i - 1]
        self.a = out
        return self

    def outline(self, key="s1", corners: bool = False):
        """1-px outline on transparent pixels touching the sprite."""
        m = self.mask()
        up, dn, lf, rt = self._nb(m)
        edge = ~m & (up | dn | lf | rt)
        if corners:
            d = np.zeros_like(m)
            d[1:, 1:] |= m[:-1, :-1]
            d[1:, :-1] |= m[:-1, 1:]
            d[:-1, 1:] |= m[1:, :-1]
            d[:-1, :-1] |= m[1:, 1:]
            edge |= ~m & d
        self.a[edge] = K(key)
        return self

    def darken(self, strength, B=None):
        """Shift colours one step darker where strength > dither threshold."""
        if B is None:
            B = bayer(self.w, self.h)
        m = (np.asarray(strength) > B) & self.mask()
        self.a[m] = DARK_LUT[self.a[m]]
        return self

    def replace(self, a, b):
        self.a[self.a == K(a)] = K(b)
        return self

    def flip_h(self) -> "Art":
        return Art.of(self.a[:, ::-1])

    def flip_v(self) -> "Art":
        return Art.of(self.a[::-1, :])

    def crop(self, x, y, w, h) -> "Art":
        return Art.of(self.a[y:y + h, x:x + w])

    def trimmed(self, pad: int = 0) -> "Art":
        m = self.mask()
        if not m.any():
            return self.copy()
        ys, xs = np.where(m)
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        o = Art(x1 - x0 + 1 + 2 * pad, y1 - y0 + 1 + 2 * pad)
        o.a[pad:pad + y1 - y0 + 1, pad:pad + x1 - x0 + 1] = self.a[y0:y1 + 1, x0:x1 + 1]
        return o

    def padded(self, l=0, t=0, r=0, b=0) -> "Art":
        o = Art(self.w + l + r, self.h + t + b)
        o.a[t:t + self.h, l:l + self.w] = self.a
        return o

    def scaled(self, n: int) -> "Art":
        return Art.of(np.repeat(np.repeat(self.a, n, axis=0), n, axis=1))

    # -- export -------------------------------------------------------------
    def rgba(self) -> np.ndarray:
        return RGB[self.a]

    def image(self) -> Image.Image:
        return Image.fromarray(self.rgba(), "RGBA")

    def watermark(self, corner: str = "br", key="m3", box="s1", margin: int = 3):
        """Bake the visible SI mark into a full-frame image."""
        tw = text_width(WATERMARK)
        bw, bh = tw + 4, 9
        x = self.w - bw - margin if "r" in corner else margin
        y = self.h - bh - margin if "b" in corner else margin
        self.rect(x, y, bw, bh, box)
        self.text(x + 2, y + 2, WATERMARK, key)
        return self

    def save(self, path: str, title: str = "", note: str = ""):
        save_png(self, path, title, note)
        return self


DISCLOSURE = ("SI-generated illustration. Drawn by code written with an AI assistant (Claude, Anthropic) "
              "for Member 5 (Visual Design), Echoes of Exploration, NASA Space Apps 2026. "
              "Team art, not a mission photograph. No NASA insignia. Licence: CC0-1.0.")


def save_png(art: Art, path: str, title: str = "", note: str = ""):
    """Write an indexed PNG (palette + 1-bit transparency) with provenance text chunks."""
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    used = np.unique(art.a)
    has_t = bool((used == T).any())
    pal = []
    for i in range(len(PALETTE)):
        pal += list(RGB[i, :3])
    n = len(PALETTE)
    data = art.a.copy()
    if has_t:
        data[data == T] = n
        pal += [0, 0, 0]
    im = Image.fromarray(data, "P")
    im.putpalette(pal)
    meta = PngImagePlugin.PngInfo()
    meta.add_text("Title", title or os.path.basename(path))
    meta.add_text("Description", DISCLOSURE + (" " + note if note else ""))
    meta.add_text("Source", "tools/art (procedural pixel art); SI-generated")
    meta.add_text("Copyright", "CC0-1.0, Echoes of Exploration team")
    meta.add_text("Software", "tools/art/build.py")
    kw = dict(pnginfo=meta, optimize=True)
    if has_t:
        kw["transparency"] = n
    im.save(path, **kw)


# --------------------------------------------------------------------------
# Atlas packing (shelf packer) -> PNG + Phaser/TexturePacker JSON hash
# --------------------------------------------------------------------------
def pack_atlas(frames: dict[str, Art], path_png: str, title: str, pad: int = 2, max_w: int = 512,
               anchors: dict[str, tuple[float, float]] | None = None, meta_extra: dict | None = None) -> dict:
    """Pack frames into one sheet with a visible watermark strip. Returns the JSON dict."""
    names = sorted(frames, key=lambda k: (-frames[k].h, k))
    x = y = pad
    shelf = 0
    pos = {}
    width = 0
    for nme in names:
        f = frames[nme]
        if x + f.w + pad > max_w and x > pad:
            x = pad
            y += shelf + pad
            shelf = 0
        pos[nme] = (x, y)
        x += f.w + pad
        shelf = max(shelf, f.h)
        width = max(width, x)
    height = y + shelf + pad
    strip = 11
    W = max(width, text_width(WATERMARK) + 8)
    sheet = Art(W, height + strip)
    for nme in names:
        sheet.blit(frames[nme], *pos[nme])
    sheet.rect(0, height, W, strip, "s1")
    sheet.text(4, height + 3, WATERMARK, "m3")
    save_png(sheet, path_png, title, "Sprite sheet; frames are cut from the clean area above the mark strip.")
    out = {"frames": {}, "meta": {
        "app": "tools/art/build.py", "image": os.path.basename(path_png), "format": "RGBA8888",
        "size": {"w": sheet.w, "h": sheet.h}, "scale": "1",
        "disclosure": DISCLOSURE, "license": "CC0-1.0",
    }}
    if meta_extra:
        out["meta"].update(meta_extra)
    for nme in sorted(frames):
        f = frames[nme]
        px, py = pos[nme]
        ax, ay = (anchors or {}).get(nme, (0.5, 1.0))
        out["frames"][nme] = {
            "frame": {"x": px, "y": py, "w": f.w, "h": f.h}, "rotated": False, "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": f.w, "h": f.h},
            "sourceSize": {"w": f.w, "h": f.h}, "pivot": {"x": ax, "y": ay},
        }
    with open(os.path.splitext(path_png)[0] + ".json", "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1)
    return out


def atlas_css(atlas: dict, url: str, prefix: str) -> str:
    """CSS sprite classes: <i class="spr {prefix}-{frame}" style="--s:3"></i>."""
    W, H = atlas["meta"]["size"]["w"], atlas["meta"]["size"]["h"]
    out = [f".{prefix}{{background-image:url('{url}');background-size:calc({W}px*var(--s,1)) calc({H}px*var(--s,1))}}"]
    for nme, f in atlas["frames"].items():
        r = f["frame"]
        cls = nme.replace("/", "-").replace(".", "-")
        out.append(f".{prefix}-{cls}{{width:calc({r['w']}px*var(--s,1));height:calc({r['h']}px*var(--s,1));"
                   f"background-position:calc(-{r['x']}px*var(--s,1)) calc(-{r['y']}px*var(--s,1))}}")
    return "\n".join(out) + "\n"


# --------------------------------------------------------------------------
# Review helpers
# --------------------------------------------------------------------------
def contact_sheet(frames: dict[str, Art], path: str, scale: int = 4, cols: int = 6, bg="s2", cell=None, label=True):
    """Nearest-neighbour preview sheet on a dark checker, with names."""
    names = list(frames)
    cw = cell or max(f.w for f in frames.values())
    chh = cell or max(f.h for f in frames.values())
    lab = 8 if label else 0
    cols = min(cols, len(names))
    rows = (len(names) + cols - 1) // cols
    sheet = Art(cols * (cw + 4) + 4, rows * (chh + 4 + lab) + 4, bg)
    yy, xx = np.mgrid[0:sheet.h, 0:sheet.w]
    chk = ((xx // 4 + yy // 4) % 2 == 0)
    sheet.a[chk] = K("s1")
    for i, nme in enumerate(names):
        f = frames[nme]
        cx = 4 + (i % cols) * (cw + 4)
        cy = 4 + (i // cols) * (chh + 4 + lab)
        sheet.blit(f, cx + (cw - f.w) // 2, cy + (chh - f.h))
        if label:
            sheet.text(cx, cy + chh + 2, nme[: (cw + 3) // 4], "m3")
    big = sheet.scaled(scale)
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    big.image().save(path)
    return path
