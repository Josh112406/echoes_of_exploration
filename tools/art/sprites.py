"""Echoes of Exploration - sprites: guide robot, mission hardware, props, FX.

Every sprite is original team art drawn for the hackathon (nothing is copied
from the practice build). Hardware is simplified for a 640x360 pixel grid and
must always be shown with the "illustration" label - never as mission evidence.

AI disclosure: generated with an SI/AI assistant (Claude, Anthropic) for Member 5
(Visual Design); human review required. Code Apache-2.0, art CC0-1.0.
"""
from __future__ import annotations

import numpy as np

from core import Art, K, T, bayer

OUT = "s1"


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def rrect(s: Art, x, y, w, h, r, key):
    """Rounded rectangle (corner radius r in px, chamfered pixel style)."""
    s.rect(x, y, w, h, key)
    for i in range(r):
        n = r - i
        for (cx, cy) in ((x, y + i), (x + w - n, y + i), (x, y + h - 1 - i), (x + w - n, y + h - 1 - i)):
            s.rect(cx, cy, n, 1, None)
    return s


def finish(s: Art, chains=("cool",), outline=OUT, lo=None, hi=None) -> Art:
    for c in chains:
        s.bevel(c, lo=(lo or {}).get(c), hi=(hi or {}).get(c))
    if outline:
        s.outline(outline)
    return s


def solar(s: Art, x, y, w, h, cell=4, base="c1", line="c0", hi="c2"):
    """Solar panel face: cyan cells with a lit top-left edge."""
    s.rect(x, y, w, h, base)
    for i in range(cell, w, cell):
        s.vline(x + i, y, h, line)
    for j in range(cell, h, cell):
        s.hline(x, y + j, w, line)
    s.hline(x, y, w, hi)
    s.vline(x, y, h, hi)
    s.px(x, y, "c3")
    return s


def dish(s: Art, cx, cy, rx, ry, face="m4", rim="m5", shade="m3", feed=True):
    """Parabolic dish seen at an angle: light face, darker lower-right, bright rim, small feed."""
    s.ellipse(cx, cy, rx, ry, face)
    # lower-right shade
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if d <= 1.0 and ((x - cx) / rx + (y - cy) / ry) > 0.55 and ((x + y) % 2 == 0 or d > 0.7):
                s.px(x, y, shade)
    s.ellipse(cx, cy, rx, ry, rim, ring=1.0)
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if 0.72 < d <= 1.0 and ((x - cx) / rx + (y - cy) / ry) > 0.3 and s.get(x, y) == K(rim):
                s.px(x, y, shade)
    if feed:
        s.px(cx, cy, "m1")
        s.px(cx - 1, cy - 1, "m2")
    return s


def wheel(s: Art, cx, cy, r, tire="m0", hub="m3", tread="m1"):
    s.disc(cx, cy, r, tire)
    s.disc(cx, cy, r, tread, ring=1.0)
    if r >= 4:
        s.disc(cx, cy, max(1, r - 3), hub)
        s.px(cx, cy, "m1")
    else:
        s.px(cx, cy, hub)
    # lit upper-left arc
    for a in np.linspace(np.pi * 0.95, np.pi * 1.55, 12):
        s.px(cx + np.cos(a) * r, cy + np.sin(a) * r, "m2")
    return s


def footpad(s: Art, x, y, w=6):
    """Landing footpad: a flat dish with a lit top."""
    s.rect(x + 1, y, w - 2, 1, "m4")
    s.rect(x, y + 1, w, 2, "m3")
    s.hline(x + 1, y + 3, w - 2, "m1")
    return s


def foil(s: Art, x, y, w, h, seed=1, mask=None):
    """Gold thermal foil: flat warm facets (brick pattern), lighter toward the upper left."""
    r = np.random.default_rng(seed)
    cw, ch = 3, 2
    gv = r.random((h // ch + 3, w // cw + 3))
    for j in range(h):
        for i in range(w):
            if mask is not None and not mask(i, j):
                continue
            ci = (i + (j // ch % 2) * 2) // cw
            v = gv[j // ch, ci]
            light = 1 - (i / max(w, 1) * 0.45 + j / max(h, 1) * 0.75)
            t = v * 0.5 + light * 0.62
            key = "w2" if t > 0.97 else "w1" if t > 0.56 else "r3" if t > 0.4 else "r2" if t > 0.22 else "w0"
            s.px(x + i, y + j, key)
    return s


def strut(s: Art, x0, y0, x1, y1, key="m3", thick=1):
    return s.line(x0, y0, x1, y1, key, thick)


# --------------------------------------------------------------------------
# Guide robot ("archive unit") - front view, 40x44, anchor bottom-centre
# --------------------------------------------------------------------------
def robot(pose="idle", beacon=False):
    s = Art(40, 44)
    hover = pose.startswith("hover")
    # antenna with flag (drawn first, the head overlaps its base)
    s.vline(28, 3, 6, "m3")
    s.vline(29, 5, 4, "m1")
    s.rect(28, 1, 4, 2, "w2")
    s.px(31, 2, "w1").px(31, 1, "w1")
    # beacon dome
    s.ellipse(19.5, 6.2, 4.4, 4.6, "r2")
    s.rect(15, 7, 10, 3, "r1")
    # body shell
    rrect(s, 4, 8, 32, 28, 3, "m2")
    # shoulder pods
    rrect(s, 1, 15, 4, 19, 1, "m1")
    rrect(s, 35, 15, 4, 19, 1, "m1")
    # treads (or tucked feet when hovering)
    if hover:
        rrect(s, 7, 36, 10, 5, 1, "m0")
        rrect(s, 23, 36, 10, 5, 1, "m0")
    else:
        rrect(s, 4, 36, 13, 8, 2, "m0")
        rrect(s, 23, 36, 13, 8, 2, "m0")
        s.rect(17, 36, 6, 4, "s2")
    s.bevel("cool", lo="m0", hi="m4")
    # top cap: bright lid
    s.hline(7, 8, 26, "m5")
    s.rect(5, 9, 30, 2, "m4")
    s.hline(5, 11, 30, "m3")
    # beacon shading / glow
    if beacon:
        s.ellipse(19.5, 5.6, 3.0, 3.2, "w1")
        s.px(18, 4, "w2").px(19, 4, "w2").px(18, 5, "w2")
    else:
        s.px(17, 4, "r3").px(18, 3, "r3").px(18, 4, "r4").px(19, 3, "r3")
        s.px(22, 6, "r1").px(23, 5, "r1").px(22, 7, "r1")
    # visor recess
    rrect(s, 8, 14, 24, 14, 2, "s1")
    s.hline(10, 14, 20, "m1")          # shadowed upper lip
    s.hline(10, 27, 20, "m4")          # lit lower lip
    s.vline(31, 16, 10, "m3")
    s.vline(8, 16, 10, "m1")
    # screen
    rrect(s, 10, 16, 20, 10, 1, "c2")
    s.rect(11, 17, 18, 4, "c3")
    s.hline(11, 25, 18, "c1")
    if pose == "blink":
        s.rect(11, 17, 18, 8, "c2")
        s.hline(13, 21, 5, "c4")
        s.hline(22, 21, 5, "c4")
    elif pose == "talk":
        s.rect(13, 18, 4, 3, "c4")
        s.rect(23, 18, 4, 3, "c4")
        s.rect(15, 23, 10, 1, "c4")
        s.rect(17, 22, 6, 1, "c3")
    elif pose == "happy":
        s.rect(13, 19, 4, 1, "c4").px(12, 20, "c4").px(17, 20, "c4")
        s.rect(23, 19, 4, 1, "c4").px(22, 20, "c4").px(27, 20, "c4")
    else:
        s.rect(13, 18, 4, 4, "c4")
        s.rect(23, 18, 4, 4, "c4")
        s.px(13, 18, "m5").px(23, 18, "m5")
        s.rect(19, 19, 2, 1, "c2")
    # chin: indicator + vents
    s.rect(9, 30, 3, 2, "c3")
    s.px(9, 30, "c4")
    for j in (30, 32):
        s.hline(16, j, 12, "m1")
        s.hline(16, j + 1, 12, "m3")
    s.rect(29, 30, 3, 3, "m1")
    s.px(30, 31, "m3")
    # lamps
    s.rect(2, 20, 2, 3, "w1")
    s.rect(2, 23, 2, 2, "w0")
    s.rect(36, 20, 2, 3, "w1")
    s.rect(36, 23, 2, 2, "w0")
    s.rect(5, 34, 3, 2, "w1")
    s.rect(32, 34, 3, 2, "w1")
    s.px(5, 34, "w2").px(32, 34, "w2")
    # tread detail
    if not hover:
        off = 1 if pose == "roll" else 0
        for x0 in (5, 24):
            for i in range(0, 11, 3):
                s.vline(x0 + (i + off) % 11, 39, 4, "s2")
            s.hline(x0, 37, 11, "m2")
        s.rect(18, 37, 4, 2, "m1")
    else:
        for x0 in (9, 25):
            s.rect(x0, 40, 6, 1, "m1")
    s.outline(OUT)
    return s


# --------------------------------------------------------------------------
# Moon hardware
# --------------------------------------------------------------------------
def surveyor(scoop=False, casing=False):
    """Surveyor lander: tripod, mast with solar panel and planar antenna, two thermal boxes."""
    s = Art(52, 50)
    # legs + struts (behind)
    strut(s, 21, 31, 8, 43, "m2", 2)
    strut(s, 31, 31, 44, 43, "m2", 2)
    strut(s, 14, 37, 22, 37, "m1")
    strut(s, 30, 37, 38, 37, "m1")
    strut(s, 25, 32, 25, 44, "m2", 2)
    strut(s, 10, 42, 24, 33, "m1")
    strut(s, 43, 42, 28, 33, "m1")
    # frame
    s.rect(17, 30, 18, 3, "m2")
    # mast
    s.rect(25, 4, 2, 27, "m3")
    # compartments
    s.rect(11, 21, 12, 10, "m4")
    s.rect(29, 22, 11, 9, "m4")
    # camera (canted cylinder) between the boxes
    s.rect(23, 24, 3, 6, "m1")
    # top: solar panel (left) and planar antenna (right)
    solar(s, 9, 3, 15, 8)
    s.rect(28, 4, 14, 7, "m4")
    # omni antenna booms
    strut(s, 34, 22, 46, 16, "m2")
    strut(s, 17, 21, 6, 17, "m2")
    # vernier engines
    s.rect(18, 33, 3, 3, "m1")
    s.rect(31, 33, 3, 3, "m1")
    if casing:  # main retro-rocket motor still attached under the frame
        s.ellipse(25.5, 38, 5.5, 5, "m3")
        s.rect(23, 42, 6, 3, "m1")
    s.bevel("cool", lo="m0", hi="m5")
    # details after bevel
    for i in range(3, 14, 3):
        s.vline(28 + i, 5, 5, "m3")
    s.hline(29, 7, 12, "m3")
    s.px(24, 25, "c3").px(24, 26, "c1")      # camera lens
    s.px(46, 16, "m5").px(6, 17, "m5")
    s.hline(12, 26, 10, "m3")
    s.hline(30, 26, 9, "m3")
    s.px(13, 23, "m2").px(31, 24, "m2")
    footpad(s, 4, 43)
    footpad(s, 42, 43)
    footpad(s, 22, 45)
    if scoop:  # Surveyor 3 surface sampler arm
        strut(s, 36, 31, 47, 37, "m3")
        strut(s, 47, 37, 49, 42, "m3")
        s.rect(48, 42, 3, 3, "m2")
    s.outline(OUT)
    return s


def retro_casing():
    """Spent main retro-rocket casing (separate sprite for the descent)."""
    s = Art(14, 14)
    s.ellipse(6.5, 6, 6, 5.5, "m3")
    s.rect(4, 10, 6, 3, "m1")
    s.bevel("cool", lo="m0", hi="m5")
    s.px(4, 3, "m5")
    s.outline(OUT)
    return s


def lm_descent():
    """Apollo lunar module descent stage: foil-wrapped octagon on four legs."""
    s = Art(60, 38)
    # legs
    for x0, x1 in ((16, 4), (43, 55)):
        strut(s, x0, 14, x1, 31, "m3", 2)
        strut(s, x0 + (2 if x0 < 30 else -2), 24, x1 + (3 if x0 < 30 else -3), 30, "m1")
    strut(s, 25, 24, 22, 33, "m2", 2)
    strut(s, 34, 24, 37, 33, "m2", 2)
    # engine bell
    s.poly([(26, 24), (34, 24), (36, 30), (24, 30)], "m0")
    # body
    s.poly([(15, 8), (45, 8), (49, 13), (49, 21), (45, 25), (15, 25), (11, 21), (11, 13)], "r3")
    foil(s, 11, 8, 39, 18, seed=7, mask=lambda i, j: s.get(11 + i, 8 + j) == K("r3"))
    # top deck
    s.rect(14, 5, 32, 3, "m1")
    s.rect(18, 3, 24, 2, "m0")
    s.bevel("cool", lo="m0", hi="m4")
    # panel seams + dark quad bays
    s.vline(22, 9, 16, "w0")
    s.vline(38, 9, 16, "w0")
    s.rect(27, 12, 6, 7, "w0")
    s.px(28, 13, "r2").px(31, 16, "r2")
    s.hline(26, 30, 9, "m1")
    footpad(s, 1, 31, 7)
    footpad(s, 52, 31, 7)
    footpad(s, 19, 33, 6)
    footpad(s, 35, 33, 6)
    # ladder on the front leg
    for j in range(15, 30, 3):
        s.hline(28, j + 11 if False else j, 0, "m3")
    s.outline(OUT)
    return s


def quad(s: Art, bl, br, tl, fn):
    """Fill a parallelogram (bl, br, tl corners) calling fn(u, v) -> key|None per pixel."""
    ax, ay = br[0] - bl[0], br[1] - bl[1]
    bx, by = tl[0] - bl[0], tl[1] - bl[1]
    det = ax * by - ay * bx
    xs = [bl[0], br[0], tl[0], br[0] + bx]
    ys = [bl[1], br[1], tl[1], br[1] + by]
    for y in range(int(min(ys)) - 1, int(max(ys)) + 2):
        for x in range(int(min(xs)) - 1, int(max(xs)) + 2):
            px, py = x + 0.5 - bl[0], y + 0.5 - bl[1]
            u = (px * by - py * bx) / det
            v = (ax * py - ay * px) / det
            if 0 <= u <= 1 and 0 <= v <= 1:
                k = fn(u, v)
                if k is not None:
                    s.px(x, y, k)
    return s


def lrrr():
    """Laser ranging retroreflector: a tilted array of corner cubes on a low pallet (passive, no power)."""
    s = Art(44, 32)
    # pallet and levelling feet
    s.poly([(4, 25), (34, 25), (38, 29), (1, 29)], "m2")
    s.rect(3, 29, 3, 2, "m1")
    s.rect(33, 29, 3, 2, "m1")
    # rear support + aiming handle
    strut(s, 33, 25, 36, 9, "m2")
    strut(s, 25, 25, 28, 12, "m1")
    s.bevel("cool", lo="m0", hi="m5")

    def face(u, v):
        if u < 0.07 or u > 0.93 or v < 0.08 or v > 0.92:
            return "m5" if (v > 0.92 or u < 0.07) else "m3"
        fu, fv = (u - 0.07) / 0.86 * 6, (v - 0.08) / 0.84 * 5
        iu, iv = fu % 1, fv % 1
        if iu < 0.2 or iv < 0.22:
            return "c0"
        if iu < 0.55 and iv > 0.6:
            return "c4" if (int(fu) + int(fv)) % 3 == 0 else "c3"
        return "c2"

    quad(s, (4, 22), (29, 25), (13, 4), face)
    strut(s, 38, 8, 42, 3, "m3")
    s.px(42, 2, "m5")
    s.outline(OUT)
    return s


def lrv():
    """Apollo Lunar Roving Vehicle, side view: mesh wheels, seats, umbrella dish, TV camera."""
    s = Art(66, 42)
    gy = 32  # axle height
    # chassis
    s.rect(8, 26, 50, 3, "m2")
    s.rect(15, 23, 32, 3, "m1")
    # seats
    for x0 in (22, 33):
        s.rect(x0, 15, 3, 9, "m4")
        s.rect(x0, 21, 9, 3, "m4")
    # console + hand controller
    s.rect(44, 16, 5, 7, "m1")
    s.rect(42, 14, 3, 2, "m3")
    # TV camera post, dish mast, rear pallet
    s.rect(55, 14, 2, 12, "m2")
    s.rect(52, 10, 8, 4, "m1")
    s.rect(49, 9, 1, 15, "m3")
    s.rect(8, 17, 7, 9, "m1")
    s.rect(9, 11, 1, 7, "m3")
    s.rect(12, 13, 1, 5, "m3")
    s.bevel("cool", lo="m0", hi="m5")
    # fenders (tan arcs over the wheels)
    for cx in (14, 52):
        for a in np.linspace(np.pi * 1.08, np.pi * 1.92, 40):
            for rr in (9.0, 10.0):
                s.px(cx + np.cos(a) * rr, gy + np.sin(a) * rr, "e4" if rr > 9.5 else "e3")
    # wheels: wire mesh
    for cx in (14, 52):
        s.disc(cx, gy, 7.4, "m1")
        s.disc(cx, gy, 5.2, "s2")
        for a in np.linspace(0, np.pi, 4, endpoint=False):
            s.line(cx - np.cos(a) * 5, gy - np.sin(a) * 5, cx + np.cos(a) * 5, gy + np.sin(a) * 5, "m0")
        s.disc(cx, gy, 1.6, "m3")
        for a in np.linspace(np.pi * 0.9, np.pi * 1.7, 14):
            s.px(cx + np.cos(a) * 7.2, gy + np.sin(a) * 7.2, "m3")
        for a in np.linspace(0, 2 * np.pi, 12, endpoint=False):
            s.px(cx + np.cos(a) * 6.2, gy + np.sin(a) * 6.2, "m2")
    # umbrella high-gain dish (gold mesh bowl opening upward)
    for i in range(-8, 9):
        yy = 7 - int(round(i * i / 64 * 5))
        s.px(49 + i, yy, "w2" if i <= 1 else "r4")
        s.px(49 + i, yy + 1, "e4" if i % 2 == 0 else "r3")
    for i in (-5, 0, 5):
        s.line(49, 9, 49 + i, 7 - int(round(i * i / 64 * 5)) + 2, "e3")
    s.px(49, 4, "m5")
    # camera lens, low-gain antenna
    s.px(60, 11, "c3").px(60, 12, "c1")
    strut(s, 40, 15, 40, 6, "m3")
    s.px(40, 5, "m5")
    s.outline(OUT)
    return s


SPRITES_MOON = {
    "surveyor": lambda: surveyor(),
    "surveyor-casing": lambda: surveyor(casing=True),
    "surveyor-scoop": lambda: surveyor(scoop=True),
    "retro-casing": retro_casing,
    "lm-descent": lm_descent,
    "lrrr": lrrr,
    "lrv": lrv,
}
