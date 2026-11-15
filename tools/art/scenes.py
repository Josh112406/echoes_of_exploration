"""Echoes of Exploration - scene engine: skies, bodies, ridges, ground, side scenes.

AI disclosure: generated with an SI/AI assistant (Claude, Anthropic) for Member 5
(Visual Design); human review required. Code Apache-2.0, art CC0-1.0.
"""
from __future__ import annotations

import numpy as np

from core import Art, IDX, K, T, bayer, fbm, quant

W, H = 640, 360


def grid(w=W, h=H):
    yy, xx = np.mgrid[0:h, 0:w]
    return xx, yy


def tones(keys):
    return np.array([IDX[k] for k in keys], dtype=np.uint8)


def rng(seed):
    return np.random.default_rng(seed)


# --------------------------------------------------------------------------
# Sky
# --------------------------------------------------------------------------
def sky(seed=1, w=W, h=H, horizon=236, haze=None, star_density=1.0, nebula=True, milky=False):
    """Opaque sky layer: void -> indigo -> navy with dithered, cloudy boundaries."""
    xx, yy = grid(w, h)
    B = bayer(w, h)
    n1 = fbm(xx, yy, seed, 4, 150, period_px=w)
    n2 = fbm(xx, yy, seed + 31, 3, 90, period_px=w)
    yb1 = horizon * 0.44 + (n1 - 0.5) * 120          # void -> indigo
    yb2 = horizon - 4 + (n2 - 0.5) * 10              # indigo -> navy (thin glow at the horizon)
    a = Art(w, h, "s0")
    t1 = np.clip((yy - (yb1 - 18)) / 36.0, 0, 1)
    a.a[t1 > B] = K("s1")
    t2 = np.clip((yy - (yb2 - 16)) / 30.0, 0, 1) * 0.55
    a.a[t2 > B] = K("s2")
    if nebula:
        n3 = fbm(xx, yy, seed + 77, 4, 110, period_px=w)
        t3 = np.clip((n3 - 0.56) * 7, 0, 0.75) * np.clip(1 - yy / (horizon * 0.9), 0, 1)
        m = (t3 > B) & (a.a == K("s0"))
        a.a[m] = K("s1")
    if milky:
        # soft diagonal band of slightly lighter sky
        d = (yy - (h * 0.15 + xx * 0.42)) / 46.0
        n4 = fbm(xx, yy, seed + 99, 4, 60)
        t4 = np.clip(1 - np.abs(d), 0, 1) * (0.35 + n4 * 0.9) - 0.25
        m = (t4 > B)
        a.a[m & (a.a == K("s0"))] = K("s1")
        a.a[(t4 - 0.42 > B) & (a.a == K("s1"))] = K("s2")
    if haze:
        # dusty band above the horizon (Mars): indigo -> umber
        th = np.clip((yy - (horizon - 92)) / 70.0, 0, 1) ** 1.2
        a.a[(th > B) & (yy < horizon + 40)] = K(haze[0])
        if len(haze) > 1:
            th2 = np.clip((yy - (horizon - 16)) / 18.0, 0, 1)
            a.a[(th2 * 0.7 > B) & (yy < horizon + 40)] = K(haze[1])
    # stars
    r = rng(seed * 7 + 3)
    n_st = int(w * h / 190 * star_density)
    xs = r.integers(0, w, n_st)
    ys = r.integers(0, h, n_st)
    lv = r.random(n_st)
    for x, y, l in zip(xs, ys, lv):
        fade = (y - horizon * 0.55) / (horizon * 0.45) if y > horizon * 0.55 else 0.0
        if haze and r.random() < fade * 1.4:
            continue
        if not haze and y > horizon - 6:
            continue
        key = "m0" if l < 0.45 else "m1" if l < 0.78 else "m2" if l < 0.93 else "m3" if l < 0.985 else "m5"
        if milky:
            d = abs((y - (h * 0.15 + x * 0.42)) / 46.0)
            if d < 1 and r.random() < 0.5:
                key = "m2" if l < 0.6 else "m3" if l < 0.9 else "m4"
        a.px(x, y, key)
    # a few bright stars with a soft cross
    for _ in range(int(9 * star_density)):
        x, y = int(r.integers(8, w - 8)), int(r.integers(6, max(8, int(horizon * 0.7))))
        a.px(x, y, "m5")
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            a.px(x + dx, y + dy, "m1")
    for _ in range(int(3 * star_density)):
        x, y = int(r.integers(8, w - 8)), int(r.integers(6, max(8, int(horizon * 0.6))))
        a.px(x, y, "c4")
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            a.px(x + dx, y + dy, "c1")
    return a


# --------------------------------------------------------------------------
# Bodies
# --------------------------------------------------------------------------
def _sphere(r, pad):
    n = 2 * r + 1 + 2 * pad
    yy, xx = np.mgrid[0:n, 0:n]
    u = (xx - (r + pad)) / r
    v = (yy - (r + pad)) / r
    d2 = u * u + v * v
    z = np.sqrt(np.clip(1 - d2, 0, 1))
    return n, xx, yy, u, v, d2, z


def earth(r=32, seed=5, light=(0.62, -0.52, 0.58), glow=True, rot=0.0):
    """Earth: oceans, land, cloud bands, terminator, cyan atmosphere rim, soft dithered glow."""
    pad = 9 if glow else 2
    n, xx, yy, u, v, d2, z = _sphere(r, pad)
    B = bayer(n, n)
    L = np.array(light, dtype=float)
    L /= np.linalg.norm(L)
    lam = u * L[0] + v * L[1] + z * L[2]
    inside = d2 <= 1.0
    lon = np.arctan2(u, z + 1e-6) + rot
    lat = np.arcsin(np.clip(v, -1, 1))
    land_n = fbm(lon * 60 + 400, lat * 60 + 200, seed, 4, 42)
    land = land_n > 0.535
    cloud_n = fbm(lon * 60 + 90, lat * 150, seed + 9, 4, 40)
    cloud = cloud_n > 0.6
    a = Art(n, n)
    # ocean
    ot = np.clip((lam - 0.05) / 0.95, 0, 1)
    lev = quant(ot * 0.9 + 0.08, 3, B, 0.55)
    oc = tones(["o0", "o1", "o2"])[lev]
    # land
    lt = np.clip((lam - 0.1) / 0.6, 0, 1)
    lv = quant(lt, 2, B, 0.6)
    ld = tones(["g0", "g1"])[lv]
    col = np.where(land, ld, oc)
    # clouds
    ct = np.clip((lam - 0.12) / 0.5, 0, 1)
    cv = quant(ct, 3, B, 0.5)
    cl = tones(["m2", "m4", "m5"])[cv]
    col = np.where(cloud, cl, col)
    # night side: dither into navy / indigo
    night = np.clip((0.2 - lam) / 0.26, 0, 1)
    col = np.where(night > B, K("s2"), col)
    col = np.where(np.clip((0.02 - lam) / 0.3, 0, 1) > B, K("s1"), col)
    a.a[inside] = col[inside].astype(np.uint8)
    # atmosphere rim on the lit limb
    dist = np.sqrt(d2) * r
    limb_lit = u * L[0] + v * L[1]
    rim = inside & (dist > r - 2.2) & (limb_lit > 0.12)
    a.a[rim] = K("c3")
    rim2 = inside & (dist > r - 1.2) & (limb_lit > 0.5)
    a.a[rim2] = K("c4")
    rim3 = inside & (dist > r - 2.2) & (limb_lit > -0.1) & (limb_lit <= 0.12) & (B < 0.5)
    a.a[rim3] = K("c2")
    if glow:
        out = ~inside
        g1 = out & (dist < r + 2.4) & (limb_lit > -0.05)
        a.a[g1 & (B < 0.62)] = K("c1")
        fall = np.clip(1 - (dist - r - 1.5) / 7.5, 0, 1) * np.clip(limb_lit * 1.4 + 0.45, 0, 1)
        g2 = out & (dist >= r + 2.4) & (fall * 0.6 > B)
        a.a[g2] = K("c0")
    return a


def moon_disc(r=30, seed=3, phase=1.0, glow=True, sites=False):
    """The near side of the Moon as seen from Earth (title, aim board, maps)."""
    pad = 7 if glow else 2
    n, xx, yy, u, v, d2, z = _sphere(r, pad)
    v = -v  # north up
    B = bayer(n, n)
    inside = d2 <= 1.0
    maria = [  # cx, cy, rx, ry (unit disc, north up)
        (-0.25, 0.52, 0.30, 0.27), (0.28, 0.45, 0.18, 0.17), (0.46, 0.13, 0.22, 0.17), (0.80, 0.30, 0.09, 0.12),
        (0.72, -0.08, 0.14, 0.15), (0.52, -0.27, 0.09, 0.09), (-0.66, 0.22, 0.24, 0.42), (-0.58, -0.40, 0.10, 0.10),
        (-0.22, -0.35, 0.19, 0.15), (0.06, 0.20, 0.09, 0.07), (0.0, 0.84, 0.45, 0.05), (-0.42, -0.08, 0.2, 0.16),
    ]
    wu = u + (fbm(u * 100 + 50, v * 100 + 50, seed + 21, 3, 34) - 0.5) * 0.22
    wv = v + (fbm(u * 100 + 150, v * 100 + 90, seed + 22, 3, 34) - 0.5) * 0.22
    mv = np.zeros_like(u)
    for cx, cy, rx, ry in maria:
        d = ((wu - cx) / rx) ** 2 + ((wv - cy) / ry) ** 2
        mv = np.maximum(mv, np.clip(1.35 - d, 0, 1))
    mv = np.clip(mv * 1.6, 0, 1)
    nz = fbm(xx, yy, seed, 4, max(6.0, r * 0.45))
    nz2 = fbm(xx, yy, seed + 5, 3, max(3.0, r * 0.14))
    t = 0.78 - mv * 0.5 + (nz - 0.5) * 0.3 + (nz2 - 0.5) * 0.16
    # bright ray craters
    for cx, cy, rr, amt in ((-0.12, -0.68, 0.10, 0.45), (-0.33, 0.17, 0.07, 0.35), (-0.6, 0.14, 0.04, 0.3),
                            (-0.68, 0.40, 0.035, 0.4)):
        d = np.sqrt((u - cx) ** 2 + (v - cy) ** 2)
        t = t + np.clip(1 - d / rr, 0, 1) * amt
    t = t * (0.72 + 0.28 * z)  # limb darkening
    if phase < 1.0:
        term = u * -1.0  # shadow from the left
        t = np.where(term > (phase * 2 - 1), t * 0.0 - 1, t)
    lev = quant(np.clip(t, 0, 1), 5, B, 0.45)
    col = tones(["m1", "m2", "m3", "m4", "m5"])[lev]
    a = Art(n, n)
    a.a[inside] = col[inside]
    if phase < 1.0:
        a.a[inside & (t < 0)] = K("s2")
    dist = np.sqrt(d2) * r
    if glow:
        out = ~inside
        a.a[out & (dist < r + 2.0) & (B < 0.55)] = K("m1")
        fall = np.clip(1 - (dist - r - 1.5) / 6.0, 0, 1)
        a.a[out & (dist >= r + 2.0) & (fall * 0.5 > B)] = K("s3")
    return a


MOON_SITES = {  # selenographic lon, lat (deg) -> approximate, verify before captioning
    "surveyor-1": (-43.34, -2.47), "apollo-11-surface": (23.47, 0.67), "apollo-17-surface": (30.77, 20.19),
}


def moon_site_xy(lon, lat, cx, cy, r):
    lo, la = np.radians(lon), np.radians(lat)
    return cx + r * np.cos(la) * np.sin(lo), cy - r * np.sin(la)


def planet(r, kind="mars", seed=11, light=(0.55, -0.45, 0.7), glow=False):
    """Generic shaded globe for maps and skies: mars, pluto, charon, jupiter, saturn, eros-ish rock."""
    pad = 5 if glow else 2
    n, xx, yy, u, v, d2, z = _sphere(r, pad)
    B = bayer(n, n)
    L = np.array(light, dtype=float)
    L /= np.linalg.norm(L)
    lam = np.clip(u * L[0] + v * L[1] + z * L[2], 0, 1)
    inside = d2 <= 1.0
    lon = np.arctan2(u, z + 1e-6)
    lat = np.arcsin(np.clip(v, -1, 1))
    nz = fbm(lon * 50 + 300, lat * 50, seed, 4, 30)
    a = Art(n, n)
    if kind == "mars":
        t = lam * 0.85 + (nz - 0.5) * 0.45
        dark = fbm(lon * 50 + 60, lat * 80, seed + 3, 3, 36) > 0.58
        t = np.where(dark, t - 0.22, t)
        lev = quant(np.clip(t, 0, 1), 5, B, 0.5)
        col = tones(["r0", "r1", "r2", "r3", "r4"])[lev]
        cap = (v < -0.86 + (nz - 0.5) * 0.12) & (lam > 0.15)
        col = np.where(cap, K("m5"), col)
    elif kind == "pluto":
        t = lam * 0.9 + (nz - 0.5) * 0.3
        lev = quant(np.clip(t, 0, 1), 5, B, 0.5)
        col = tones(["e0", "e1", "e2", "e3", "e4"])[lev]
        # dark equatorial band (lower-left) and the pale heart-shaped plain
        band = (np.abs(v - 0.42 - u * 0.2) < 0.2 + (nz - 0.5) * 0.2) & (u < 0.25)
        col = np.where(band & (lam > 0.12), tones(["e0", "r0", "r1", "r1", "r2"])[lev], col)
        hx, hy = (u - 0.2) / 0.36, -(v - 0.1) / 0.36
        heart = (hx * hx + hy * hy - 0.5) ** 3 - hx * hx * hy ** 3 * 1.2 < 0
        col = np.where(heart & (lam > 0.1), np.where((lam > 0.5) | (hx < 0), K("e5"), K("e4")), col)
        cap = (v < -0.8) & (lam > 0.2)
        col = np.where(cap, K("e1") if False else tones(["e1", "e1", "e2", "e2", "e3"])[lev], col)
    elif kind == "charon":
        t = lam * 0.8 + (nz - 0.5) * 0.3
        lev = quant(np.clip(t, 0, 1), 4, B, 0.5)
        col = tones(["m0", "m1", "m2", "m3"])[lev]
        cap = (v < -0.55 + (nz - 0.5) * 0.3) & (lam > 0.15)
        col = np.where(cap, tones(["r0", "r1", "r1", "r2"])[lev], col)
    elif kind == "jupiter":
        bands = np.sin(lat * 9 + (nz - 0.5) * 1.2)
        t = lam * 0.75 + bands * 0.14 + 0.1
        lev = quant(np.clip(t, 0, 1), 5, B, 0.5)
        col = tones(["e0", "e2", "e3", "e4", "e5"])[lev]
        col = np.where((bands < -0.45) & (lam > 0.1), tones(["r0", "r1", "r2", "r3", "r3"])[lev], col)
        spot = ((u - 0.25) / 0.2) ** 2 + ((v - 0.3) / 0.1) ** 2 < 1
        col = np.where(spot & (lam > 0.1), K("r3"), col)
    elif kind == "saturn":
        bands = np.sin(lat * 7)
        t = lam * 0.8 + bands * 0.08 + 0.08
        lev = quant(np.clip(t, 0, 1), 4, B, 0.5)
        col = tones(["e1", "e3", "e4", "e5"])[lev]
    else:  # rock
        t = lam * 0.9 + (nz - 0.5) * 0.5
        lev = quant(np.clip(t, 0, 1), 5, B, 0.5)
        col = tones(["e0", "e1", "e2", "e3", "e4"])[lev]
    night = np.clip((0.1 - (u * L[0] + v * L[1] + z * L[2])) / 0.2, 0, 1)
    col = np.where(night > B, K("s1"), col)
    a.a[inside] = col[inside].astype(np.uint8)
    return a


def saturn(r=14, seed=4):
    """Saturn with a tilted ring (ring drawn behind and in front of the globe)."""
    g = planet(r, "saturn", seed)
    n = g.w
    pad = int(r * 1.5)
    a = Art(n + 2 * pad, n)
    cx, cy = a.w / 2 - 0.5, n / 2 - 0.5
    for layer in ("back", "front"):
        for y in range(a.h):
            for x in range(a.w):
                dx, dy = (x - cx) / (r * 2.25), (y - cy) / (r * 0.62)
                d = dx * dx + dy * dy
                if 0.42 < d <= 1.0 and not (0.68 < d < 0.74):
                    behind = dy < 0
                    if (layer == "back") == behind:
                        a.px(x, y, "e4" if d < 0.68 else "e3")
        if layer == "back":
            a.blit(g, pad, 0)
    return a


def eros(w=120, h=62, seed=8, light=(-0.55, -0.6, 0.58)):
    """433 Eros: an elongated, saddle-waisted asteroid with craters. Illustration only."""
    a = Art(w, h)
    yy, xx = np.mgrid[0:h, 0:w]
    B = bayer(w, h)
    u = (xx - w / 2) / (w / 2)
    v = (yy - h / 2) / (h / 2)
    # peanut outline: radius varies with angle + a waist notch on the top edge
    ang = np.arctan2(v, u)
    nz = fbm(xx, yy, seed, 4, 26)
    rad = 0.86 + 0.07 * np.cos(2 * ang + 0.5) + 0.05 * np.sin(5 * ang) + (nz - 0.5) * 0.14
    waist = np.exp(-((u + 0.05) / 0.2) ** 2) * 0.3 * (v < 0)
    bulge = np.exp(-((u - 0.1) / 0.3) ** 2) * 0.12 * (v > 0)
    d = np.sqrt(u * u + (v / (1 - waist + bulge)) ** 2)
    inside = d < rad
    z = np.sqrt(np.clip(1 - (d / rad) ** 2, 0, 1))
    L = np.array(light, dtype=float)
    L /= np.linalg.norm(L)
    nx, ny = u / np.maximum(rad, 0.1), v / np.maximum(rad, 0.1)
    lam = nx * L[0] + ny * L[1] + z * L[2]
    t = np.clip(lam, 0, 1) * 0.85 + (nz - 0.5) * 0.4 + 0.08
    # craters
    r = rng(seed)
    for _ in range(11):
        cx, cy = r.uniform(-0.75, 0.75), r.uniform(-0.55, 0.55)
        cr = r.uniform(0.05, 0.16)
        dd = np.sqrt((u - cx) ** 2 + ((v - cy) * 1.4) ** 2) / cr
        bowl = np.clip(1 - dd, 0, 1)
        side = ((u - cx) * L[0] + (v - cy) * L[1]) / cr
        t = t - bowl * 0.28 * np.clip(0.4 + side, 0, 1.2) + np.clip(1 - np.abs(dd - 1.0) * 5, 0, 1) * 0.12 * np.clip(-side, 0, 1)
    lev = quant(np.clip(t, 0, 1), 6, B, 0.45)
    col = tones(["e0", "e1", "e2", "e3", "e4", "e5"])[lev]
    night = np.clip((0.03 - lam) / 0.22, 0, 1)
    col = np.where(night > B, K("s1"), col)
    a.a[inside] = col[inside].astype(np.uint8)
    return a


def sun_star(a: Art, x, y, size=2):
    """Distant Sun: a bright point with a short cross and soft dithered halo."""
    for rr, key, dens in ((size + 7, "s3", 0.35), (size + 4, "m0", 0.5), (size + 2, "m2", 0.7)):
        for yy in range(-rr, rr + 1):
            for xx in range(-rr, rr + 1):
                if xx * xx + yy * yy <= rr * rr and ((xx + yy) % 2 == 0 or dens > 0.6) and (dens > 0.45 or (xx % 2 == 0)):
                    a.px(x + xx, y + yy, key)
    a.disc(x, y, size, "m5")
    for k in range(1, size + 6):
        key = "m5" if k < size + 2 else "m3"
        a.px(x + k, y, key).px(x - k, y, key).px(x, y + k, key).px(x, y - k, key)
    a.px(x, y, "m5")


# --------------------------------------------------------------------------
# Terrain (side view)
# --------------------------------------------------------------------------
RAMPS = {
    "moon": dict(far=["s2", "s3"], far_lit=0.3, mid=["s3", "m0", "m1"], ground=["m0", "m1", "m2", "m3"], rim="m4",
                 rock=("m4", "m2", "m0"), shadow="s2", haze=None),
    "mars": dict(far=["r0", "r1"], far_lit=0.86, mid=["r1", "r2"], ground=["r1", "r2", "r3", "r4"], rim="r5",
                 rock=("r5", "r3", "r1"), shadow="r0", haze=["r0"]),
    "else": dict(far=["s2", "e0"], far_lit=0.86, mid=["e0", "e1"], ground=["e1", "e2", "e3", "e4"], rim="e5",
                 rock=("e5", "e3", "e1"), shadow="e0", haze=None),
}


def profile(seed, base, amp, scale, octaves=4, w=W, period=W):
    x = np.arange(w)
    n = fbm(x, np.full(w, seed * 3.7), seed, octaves, scale, period_px=period)
    return base - (n - 0.5) * 3.2 * amp


def _smooth(y, k=9):
    ker = np.ones(k) / k
    return np.convolve(np.pad(y, k, mode="wrap"), ker, mode="same")[k:-k]


def terrain(ytop, keys, seed, w=W, h=H, lit=0.62, fall=70.0, slope_k=0.55, noise=0.3, band=0.28, rim=None,
            rim_slope=0.35, grain=46.0, slope_reach=26.0, patch=0.0):
    """One terrain layer: dithered shading by depth, slope (lit from the upper left) and grain."""
    xx, yy = grid(w, h)
    B = bayer(w, h)
    Y = np.ceil(ytop)[None, :]
    depth = yy - Y
    inside = depth >= 0
    sl = np.gradient(_smooth(ytop, 13))
    n = fbm(xx, yy * 1.8, seed + 5, 3, grain, period_px=w)
    t = lit - (depth / fall) * 0.5 - sl[None, :] * slope_k * np.exp(-np.clip(depth, 0, None) / slope_reach) + (n - 0.5) * noise
    if patch:
        n2 = fbm(xx, yy * 2.4, seed + 15, 2, 120.0, period_px=w)
        t = t + (n2 - 0.5) * patch
    tn = tones(keys)
    lev = quant(np.clip(t, 0, 1), len(keys), B, band)
    a = Art(w, h)
    a.a[inside] = tn[lev][inside]
    if rim:
        crest = inside & (depth < 1) & (sl[None, :] < rim_slope)
        a.a[crest] = K(rim)
    return a


def add_craters(a: Art, ytop, ramp, seed, count=10, w=W, ymin=6, ymax=56, big=1.0):
    """Side-view craters: squashed ellipses with a dark bowl and a lit near rim."""
    r = rng(seed)
    g = ramp["ground"]
    for _ in range(count):
        x = int(r.integers(0, w))
        dy = int(r.integers(ymin, ymax))
        y = int(np.ceil(ytop[x % w])) + dy
        rx = int((3 + r.integers(0, 5) + dy * 0.14) * big)
        ry = max(1, int(round(rx * 0.24)))
        for j in range(-ry, ry + 1):
            for i in range(-rx, rx + 1):
                d = (i / rx) ** 2 + (j / max(ry, 0.6)) ** 2
                if d <= 1.0:
                    key = ramp["shadow"] if (j < 0 or (j == 0 and ry == 1 and i < 0)) else g[0]
                    a.px((x + i) % w, y + j, key)
        for i in range(-rx + 1, rx):
            a.px((x + i) % w, y + ry + 1, g[min(3, len(g) - 1)])
        a.px((x - rx - 1) % w, y, g[min(2, len(g) - 1)])
        a.px((x + rx + 1) % w, y, g[min(3, len(g) - 1)])


def add_rocks(a: Art, ytop, ramp, seed, count=40, w=W, ymin=2, ymax=60, big=1.0):
    """Small stones: lit top-left, body, shadow to the lower right."""
    r = rng(seed)
    hi, mid, lo = ramp["rock"]
    for _ in range(count):
        x = int(r.integers(0, w))
        dy = int(r.integers(ymin, ymax))
        y = int(np.ceil(ytop[x % w])) + dy
        s = 1 + int(r.integers(0, 3) * big + dy / 40)
        if s <= 1:
            a.px(x % w, y, hi if r.random() < 0.5 else mid)
            a.px((x + 1) % w, y, lo)
            continue
        for j in range(s):
            for i in range(s + 1):
                if (i == 0 and j == 0) or (i == s and j == 0 and s > 2):
                    continue
                key = hi if (j == 0 or i == 0) and i < s else lo if (j == s - 1 or i == s) else mid
                a.px((x + i) % w, y + j - s + 1, key)
        for i in range(s + 2):
            a.px((x + 1 + i) % w, y + 1, ramp["shadow"])


def add_speckle(a: Art, ytop, keys, seed, density=0.004, w=W, h=H):
    """Sparse single-pixel grain inside a terrain layer."""
    r = rng(seed)
    n = int(w * h * density)
    xs, ys = r.integers(0, w, n), r.integers(0, h, n)
    for x, y in zip(xs, ys):
        if y > ytop[x] + 2 and a.get(x, y) != T:
            a.px(x, y, keys[int(r.integers(0, len(keys)))])


def vignette(a: Art, strength=1.0):
    """Darken the frame edges by dithered one-step shifts (keeps the palette pure)."""
    xx, yy = grid(a.w, a.h)
    dx = np.abs(xx - a.w / 2) / (a.w / 2)
    dy = np.abs(yy - a.h / 2) / (a.h / 2)
    v = np.clip((np.maximum(dx ** 3.2, dy ** 3.6) - 0.34) / 0.66, 0, 1) * strength
    a.darken(v * 0.95)
    a.darken(np.clip(v - 0.55, 0, 1) * 1.6, bayer(a.w, a.h, 8, 3, 5))
    return a


def side_scene(cfg: dict) -> dict:
    """Build a layered side-view scene. Returns {'sky','far','mid','ground','flat'} Art objects."""
    ramp = RAMPS[cfg.get("ramp", "moon")]
    seed = cfg.get("seed", 1)
    hz = cfg.get("far_base", 232)
    s = sky(seed, horizon=hz, haze=ramp["haze"] if cfg.get("haze", True) else None,
            star_density=cfg.get("stars", 1.0), milky=cfg.get("milky", False))
    body = cfg.get("body")
    if body:
        kind = body.get("kind", "earth")
        if kind == "earth":
            e = earth(body.get("r", 30), body.get("seed", 5))
            s.blit(e, body["x"] - e.w // 2, body["y"] - e.h // 2)
        elif kind == "dot":
            x, y = body["x"], body["y"]
            s.px(x, y, "c4")
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                s.px(x + dx, y + dy, "c2")
        elif kind == "sun":
            sun_star(s, body["x"], body["y"], body.get("r", 1))
    layers = {"sky": s}
    yf = profile(seed + 11, hz, cfg.get("far_amp", 16), cfg.get("far_scale", 130), 3)
    if cfg.get("far_fn"):
        yf = cfg["far_fn"](yf)
    far = terrain(yf, ramp["far"], seed + 1, lit=ramp["far_lit"], fall=60, slope_k=1.2, noise=0.2, band=0.6, grain=40,
                  slope_reach=10)
    layers["far"] = far
    ym = profile(seed + 23, cfg.get("mid_base", 258), cfg.get("mid_amp", 15), cfg.get("mid_scale", 100), 4)
    if cfg.get("mid_fn"):
        ym = cfg["mid_fn"](ym)
    mid = terrain(ym, ramp["mid"], seed + 2, lit=cfg.get("mid_lit", 0.6), fall=40, slope_k=1.3, noise=0.22, band=0.4,
                  rim=ramp["mid"][-1], rim_slope=0.1, slope_reach=18)
    layers["mid"] = mid
    gb = cfg.get("ground_base", 290)
    yg = profile(seed + 37, gb, cfg.get("ground_amp", 9), cfg.get("ground_scale", 190), 3)
    flat = cfg.get("flat")
    if flat:
        x0, x1, yflat = flat
        x = np.arange(W)
        wgt = np.clip(np.minimum(x - x0, x1 - x) / 90.0 + 1, 0, 1)
        wgt = wgt * wgt * (3 - 2 * wgt)
        yg = _smooth(yg * (1 - wgt) + yflat * wgt, 15)
    if cfg.get("ground_fn"):
        yg = cfg["ground_fn"](yg)
    g = terrain(yg, ramp["ground"], seed + 3, lit=cfg.get("ground_lit", 0.62), fall=cfg.get("ground_fall", 90),
                slope_k=1.6, noise=0.2, band=0.3, rim=ramp["ground"][-1], rim_slope=0.12, grain=50, patch=0.22)
    # nearer ledge: a second, lighter band in the foreground
    if cfg.get("ledge", True):
        yl = profile(seed + 53, gb + cfg.get("ledge_dy", 44), cfg.get("ledge_amp", 6), 150, 3)
        fg = terrain(yl, ramp["ground"], seed + 4, lit=cfg.get("ledge_lit", 0.84), fall=110, slope_k=1.4, noise=0.2,
                     band=0.3, rim=ramp["rim"], rim_slope=0.1, grain=56, patch=0.2)
        g.blit(fg, 0, 0)
    add_craters(g, yg, ramp, seed + 61, cfg.get("craters", 9))
    add_rocks(g, yg, ramp, seed + 67, cfg.get("rocks", 34), big=cfg.get("rock_size", 1.0))
    add_speckle(g, yg, ramp["ground"][1:], seed + 71, cfg.get("speckle", 0.0035))
    layers["ground"] = g
    layers["ground_y"] = yg
    flat_img = s.copy()
    flat_img.blit(far, 0, 0).blit(mid, 0, 0).blit(g, 0, 0)
    layers["clean"] = flat_img.copy()
    vignette(flat_img, cfg.get("vignette", 1.0))
    layers["flat"] = flat_img
    return layers
