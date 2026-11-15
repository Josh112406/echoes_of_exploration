"""Echoes of Exploration - Mars hardware sprites (illustrations, simplified).

AI disclosure: generated with an SI/AI assistant (Claude, Anthropic) for Member 5
(Visual Design); human review required. Code Apache-2.0, art CC0-1.0.
"""
from __future__ import annotations

import numpy as np

from core import Art, K
from sprites import OUT, dish, foil, footpad, quad, rrect, solar, strut, wheel


def viking(arm=True):
    """Viking lander: low hexagonal body, three legs, S-band dish, cameras, sampler arm."""
    s = Art(70, 46)
    # legs
    strut(s, 18, 28, 6, 38, "m2", 2)
    strut(s, 52, 28, 64, 38, "m2", 2)
    strut(s, 34, 30, 34, 40, "m2", 2)
    strut(s, 8, 37, 22, 30, "m1")
    strut(s, 62, 37, 48, 30, "m1")
    # propellant tanks
    s.disc(15, 26, 4.2, "m3")
    s.disc(55, 26, 4.2, "m3")
    # body
    s.poly([(16, 21), (54, 21), (58, 25), (54, 31), (16, 31), (12, 25)], "m4")
    # RTG wind covers
    s.poly([(18, 21), (20, 15), (28, 15), (30, 21)], "m3")
    s.poly([(42, 21), (44, 15), (52, 15), (54, 21)], "m3")
    # camera cylinders
    s.rect(31, 13, 3, 8, "m3")
    s.rect(37, 13, 3, 8, "m3")
    # dish mast + UHF antenna
    s.rect(35, 6, 1, 15, "m2")
    s.rect(24, 10, 1, 5, "m2")
    # meteorology boom
    strut(s, 56, 23, 66, 13, "m2")
    s.rect(65, 11, 3, 3, "m3")
    s.bevel("cool", lo="m0", hi="m5")
    # body seams and terminal engine
    s.hline(17, 26, 37, "m3")
    for x in (26, 35, 44):
        s.vline(x, 22, 9, "m3")
    s.rect(31, 31, 8, 2, "m1")
    # camera slits
    s.vline(32, 15, 4, "s2")
    s.vline(38, 15, 4, "s2")
    s.px(32, 15, "c3").px(38, 15, "c3")
    # S-band dish, tilted
    dish(s, 37, 6, 9, 5)
    s.px(22, 9, "m5").px(23, 9, "m4").px(25, 9, "m4").px(26, 9, "m5")
    footpad(s, 2, 38, 7)
    footpad(s, 61, 38, 7)
    footpad(s, 31, 40, 7)
    if arm:  # surface sampler boom reaching the soil
        strut(s, 20, 27, 8, 31, "m3")
        strut(s, 8, 31, 3, 36, "m3")
        s.rect(1, 35, 4, 3, "m2")
        s.px(1, 35, "m4")
    s.outline(OUT)
    return s


def mer(drag=False):
    """Mars Exploration Rover (Spirit / Opportunity): six wheels, solar deck, camera mast, arm."""
    s = Art(66, 46)
    gy = 38
    # rocker-bogie
    strut(s, 30, 28, 12, gy - 2, "m2", 2)
    strut(s, 30, 28, 40, 33, "m2", 2)
    strut(s, 40, 33, 31, gy - 1, "m2")
    strut(s, 40, 33, 50, gy - 2, "m2", 2)
    # warm electronics box
    s.rect(19, 22, 26, 8, "e4")
    # mast, antennas
    s.rect(40, 3, 2, 14, "m3")
    s.rect(36, 1, 10, 3, "m3")
    s.rect(24, 8, 1, 9, "m2")
    s.rect(15, 11, 1, 6, "m2")
    # instrument arm
    strut(s, 45, 27, 55, 29, "m3")
    strut(s, 55, 29, 58, 34, "m3")
    s.rect(56, 34, 4, 3, "m2")
    s.bevel("cool", lo="m0", hi="m5")
    s.bevel("tan", lo="e2", hi="e5")

    # solar deck: a wide wing seen from slightly above
    def cells(u, v):
        if u < 0.03 or u > 0.97 or v > 0.86:
            return "c3" if v > 0.86 else "c2"
        return "c0" if (int(u * 11) != int((u + 0.02) * 11) or int(v * 2.2) != int((v + 0.1) * 2.2)) else "c1"

    quad(s, (5, 21), (56, 21), (11, 16), cells)
    s.hline(5, 22, 52, "m1")
    # high-gain disc, camera eyes
    s.disc(15, 9, 3.2, "m4")
    s.px(14, 8, "m5").px(16, 10, "m3")
    s.px(24, 7, "m5")
    s.px(38, 2, "c3").px(43, 2, "c3").px(37, 2, "c1").px(44, 2, "c1")
    s.hline(36, 1, 10, "m5")
    # wheels
    for i, cx in enumerate((12, 31, 50)):
        wheel(s, cx, gy, 5, tire="m0", hub="m2", tread="m1")
    if drag:  # the stuck right-front wheel digs a furrow
        s.px(50, gy, "w0")
    s.outline(OUT)
    return s


def msl():
    """Curiosity / Perseverance class rover: big wheels, mast head, nuclear power unit, arm."""
    s = Art(70, 48)
    gy = 39
    strut(s, 34, 30, 13, gy - 3, "m2", 2)
    strut(s, 34, 30, 44, 35, "m2", 2)
    strut(s, 44, 35, 34, gy - 2, "m2")
    strut(s, 44, 35, 55, gy - 3, "m2", 2)
    # body
    s.rect(18, 20, 32, 11, "m4")
    # power unit at the rear, tilted up
    s.poly([(18, 22), (8, 12), (12, 9), (22, 19)], "m1")
    # mast + head
    s.rect(46, 7, 2, 14, "m3")
    s.rect(42, 2, 11, 6, "m4")
    # deck antenna + small hex dish
    s.rect(27, 12, 2, 8, "m2")
    s.rect(34, 16, 6, 4, "m2")
    # arm
    strut(s, 50, 27, 60, 24, "m3", 2)
    strut(s, 60, 24, 63, 32, "m3", 2)
    s.rect(60, 32, 6, 5, "m2")
    s.bevel("cool", lo="m0", hi="m5")
    # details
    s.hline(19, 25, 30, "m3")
    for x in (26, 34, 42):
        s.vline(x, 21, 9, "m3")
    for k in range(4):
        s.line(10 + k * 3, 13 + k * 3 - 2, 12 + k * 3, 11 + k * 3 - 2, "m3")
    s.rect(44, 4, 3, 3, "s2")
    s.px(45, 5, "c3").px(49, 5, "c2").px(51, 5, "c2")
    s.px(27, 11, "m5").px(28, 11, "m5")
    for cx in (13, 34, 55):
        wheel(s, cx, gy, 6, tire="m0", hub="m2", tread="m1")
        for a in np.linspace(0, 2 * np.pi, 8, endpoint=False):
            s.px(cx + np.cos(a) * 4, gy + np.sin(a) * 4, "m1")
    s.outline(OUT)
    return s


def ingenuity(spin=0):
    """Ingenuity helicopter. spin=0 blades at rest; 1/2 = two motion-blur frames."""
    s = Art(44, 34)
    # legs
    for x0, x1 in ((19, 5), (20, 13), (23, 30), (24, 38)):
        strut(s, x0, 15, x1, 31, "m2")
    for x in (4, 12, 29, 37):
        s.rect(x, 31, 3, 1, "m3")
    # mast
    s.rect(21, 2, 2, 12, "m2")
    # fuselage (foil box)
    s.rect(17, 14, 10, 9, "r3")
    foil(s, 17, 14, 10, 9, seed=3)
    s.rect(18, 23, 8, 1, "m1")
    s.px(21, 24, "c3").px(22, 24, "c1")
    # solar panel + antenna on top
    solar(s, 17, 0, 10, 2, cell=3)
    s.px(22, 0, "m5")
    if spin == 0:
        strut(s, 2, 5, 41, 4, "m4")
        strut(s, 2, 6, 20, 5, "m2")
        strut(s, 5, 10, 38, 9, "m4")
        strut(s, 23, 10, 38, 10, "m2")
        s.rect(20, 4, 4, 2, "m1")
        s.rect(20, 9, 4, 2, "m1")
    else:
        B = bayer(44, 34, 4, spin, spin)
        for cy, rx in ((5, 20), (10, 17)):
            for y in range(cy - 1, cy + 2):
                for x in range(22 - rx, 22 + rx):
                    d = abs(x - 22) / rx
                    if (y == cy and B[y, x] < 0.75 - d * 0.3) or (y != cy and B[y, x] < 0.32 - d * 0.2):
                        s.px(x, y, "m3" if (x + spin) % 3 else "m4")
        s.rect(20, 4, 4, 2, "m1")
        s.rect(20, 9, 4, 2, "m1")
    s.outline(OUT)
    return s


def bayer(w, h, n, ox, oy):  # local import shim keeps this module standalone
    from core import bayer as _b
    return _b(w, h, n, ox, oy)


def pathfinder():
    """Mars Pathfinder lander with open petals, deflated airbags and the Sojourner rover."""
    s = Art(76, 40)
    # airbags (deflated, cream) under the petals
    for cx, cy, rx, ry in ((10, 33, 9, 4), (26, 35, 9, 3.5), (44, 35, 9, 3.5), (58, 33, 8, 4)):
        s.ellipse(cx, cy, rx, ry, "e4")
    s.bevel("tan", lo="e2", hi="e5")
    # petals (solar panels lying open)
    quad(s, (4, 30), (24, 30), (10, 25), lambda u, v: "c0" if int(u * 6) != int((u + 0.03) * 6) else "c1")
    quad(s, (42, 30), (62, 30), (40, 25), lambda u, v: "c0" if int(u * 6) != int((u + 0.03) * 6) else "c1")
    s.hline(4, 31, 21, "m2")
    s.hline(42, 31, 21, "m2")
    # centre base + electronics box
    tmp = Art(76, 40)
    tmp.poly([(22, 31), (44, 31), (40, 22), (26, 22)], "m4")
    tmp.rect(28, 17, 10, 5, "m3")
    tmp.rect(34, 4, 1, 14, "m2")   # camera mast
    tmp.rect(32, 2, 5, 3, "m3")
    tmp.rect(27, 10, 1, 8, "m2")   # low-gain antenna
    tmp.bevel("cool", lo="m0", hi="m5")
    s.blit(tmp, 0, 0)
    s.px(33, 3, "c3").px(35, 3, "c3")
    s.px(27, 9, "m5")
    s.disc(41, 15, 3, "m4")
    s.px(40, 14, "m5")
    # Sojourner
    r = Art(16, 11)
    r.rect(2, 3, 12, 3, "m3")
    r.bevel("cool", lo="m0", hi="m5")
    solar(r, 1, 1, 14, 2, cell=3)
    for cx in (3, 8, 13):
        r.disc(cx, 8, 2, "m0")
        r.px(cx, 8, "m2")
    r.rect(13, 0, 1, 2, "m3")
    r.outline(OUT)
    s.outline(OUT)
    s.blit(r, 60, 29)
    return s


def polar_lander(seis=False, met=True):
    """Phoenix / InSight class lander: deck, two round solar arrays, three legs, robotic arm."""
    s = Art(76, 42)
    # legs
    strut(s, 30, 24, 22, 37, "m2", 2)
    strut(s, 46, 24, 54, 37, "m2", 2)
    strut(s, 38, 25, 38, 38, "m2", 2)
    # deck
    s.rect(26, 18, 24, 7, "m4")
    s.rect(30, 14, 7, 4, "m3")
    s.rect(40, 15, 5, 3, "m2")
    if met:
        s.rect(47, 2, 1, 16, "m2")
        s.rect(45, 5, 5, 1, "m3")
    s.rect(33, 6, 1, 8, "m2")
    s.rect(31, 4, 5, 3, "m3")
    # arm
    strut(s, 49, 21, 60, 16, "m3")
    strut(s, 60, 16, 66, 30, "m3")
    s.rect(64, 30, 4, 4, "m2")
    s.bevel("cool", lo="m0", hi="m5")
    s.hline(27, 21, 22, "m3")
    s.px(32, 5, "c3").px(34, 5, "c3")
    if met:
        s.px(47, 1, "m5").px(49, 4, "w1")
    # round solar arrays (seen at a low angle)
    for cx in (12, 64 if False else 13):
        pass
    for cx, flip in ((13, 1), (63, -1)):
        s.ellipse(cx, 19, 12, 4.5, "c1")
        for a in np.linspace(0, np.pi, 6, endpoint=False):
            s.line(cx - np.cos(a) * 12, 19 - np.sin(a) * 4.5, cx + np.cos(a) * 12, 19 + np.sin(a) * 4.5, "c0")
        s.ellipse(cx, 19, 12, 4.5, "c2", ring=1.0)
        for a in np.linspace(np.pi, np.pi * 1.6, 16):
            s.px(cx + np.cos(a) * 12, 19 + np.sin(a) * 4.5, "c3")
        s.px(cx, 19, "m3")
    footpad(s, 19, 37, 6)
    footpad(s, 51, 37, 6)
    footpad(s, 35, 38, 6)
    s.outline(OUT)
    if seis:  # seismometer under its wind-and-thermal shield, set on the ground by the arm
        d = Art(14, 10)
        d.ellipse(6.5, 6, 6, 5, "m4")
        d.rect(0, 7, 14, 3, "m3")
        d.bevel("cool", lo="m0", hi="m5")
        d.hline(1, 9, 12, "m1")
        d.outline(OUT)
        out = Art(84, 42)
        out.blit(s, 8, 0)
        out.blit(d, 0, 31)
        out.line(13, 34, 30, 30, "m1")
        return out
    return s


SPRITES_MARS = {
    "viking": lambda: viking(),
    "mer": lambda: mer(),
    "msl": msl,
    "ingenuity": lambda: ingenuity(0),
    "ingenuity-spin-0": lambda: ingenuity(1),
    "ingenuity-spin-1": lambda: ingenuity(2),
    "pathfinder": pathfinder,
    "phoenix": lambda: polar_lander(False, True),
    "insight": lambda: polar_lander(True, False),
}
