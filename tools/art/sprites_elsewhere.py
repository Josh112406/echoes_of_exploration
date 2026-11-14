"""Echoes of Exploration - Elsewhere & deep-space hardware sprites (illustrations, simplified).

AI disclosure: generated with an SI/AI assistant (Orchestrator) for Member 5
(Visual Design); human review required. Code Apache-2.0, art CC0-1.0.
"""
from __future__ import annotations

import numpy as np

from core import Art, K
from sprites import OUT, dish, foil, quad, rrect, solar, strut


def near_shoemaker():
    """NEAR Shoemaker: octagonal bus with four cruciform solar wings and X-ray/gamma-ray instruments."""
    s = Art(74, 54)
    # Four solar panels in cruciform arrangement
    solar(s, 3, 18, 20, 12, cell=4)
    solar(s, 51, 18, 20, 12, cell=4)
    solar(s, 30, 3, 14, 13, cell=3)
    solar(s, 30, 38, 14, 13, cell=3)
    # Struts connecting panels to bus
    strut(s, 23, 24, 29, 24, "m3", 2)
    strut(s, 45, 24, 51, 24, "m3", 2)
    # Octagonal body wrapped in foil + grey plates
    s.poly([(30, 17), (44, 17), (48, 21), (48, 33), (44, 37), (30, 37), (26, 33), (26, 21)], "r3")
    foil(s, 26, 17, 23, 21, seed=11, mask=lambda i, j: s.get(26 + i, 17 + j) == K("r3"))
    # High-gain dish mounted on top face
    dish(s, 37, 26, 8, 6)
    # Magnetometer & laser rangefinder boom
    strut(s, 44, 18, 56, 8, "m3")
    s.rect(55, 6, 4, 3, "m4")
    s.px(56, 7, "c3")
    # XGRS / MSI sensor aperture at bottom
    s.rect(34, 35, 6, 3, "m2")
    s.px(36, 36, "c4")
    s.outline(OUT)
    return s


def voyager():
    """Voyager 1/2: large white high-gain dish, decagonal bus, RTG boom, magnetometer boom, plasma antennas."""
    s = Art(84, 54)
    # Long magnetometer boom (extending upper-left)
    strut(s, 36, 24, 6, 8, "m3")
    s.rect(4, 6, 4, 3, "m4")
    # Planetary radio astronomy / plasma wave whip antennas (lower-right)
    strut(s, 44, 30, 74, 46, "m2")
    strut(s, 42, 32, 68, 50, "m2")
    # RTG boom (left-downward)
    strut(s, 36, 29, 14, 44, "m2", 2)
    s.rect(10, 42, 7, 5, "m0")
    s.hline(11, 43, 5, "m2")
    # Scan platform boom (right)
    strut(s, 48, 25, 64, 21, "m3", 2)
    s.rect(62, 18, 7, 6, "m3")
    s.px(66, 20, "c3").px(67, 20, "c4")
    # Decagonal bus + Golden Record plaque
    s.rect(35, 22, 14, 12, "m2")
    s.bevel("cool", lo="m0", hi="m4")
    s.disc(42, 29, 3, "w2")  # Golden Record emblem
    s.px(41, 28, "w1")
    # High-gain dish on top
    dish(s, 42, 14, 15, 9, face="m5", rim="m5", shade="m3")
    # Feed tripod struts
    strut(s, 32, 13, 42, 4, "m3")
    strut(s, 52, 13, 42, 4, "m3")
    strut(s, 42, 17, 42, 4, "m2")
    s.rect(41, 3, 3, 2, "m4")
    s.outline(OUT)
    return s


def new_horizons():
    """New Horizons: gold-foil triangular bus, top-mounted white dish, RTG cylinder, LORRI telescope."""
    s = Art(68, 50)
    # RTG protruding lower-left
    strut(s, 24, 32, 10, 40, "m1", 3)
    s.rect(7, 38, 6, 5, "m0")
    s.hline(8, 39, 4, "m2")
    # Triangular main body wrapped in gold thermal foil
    s.poly([(22, 22), (48, 22), (54, 36), (18, 36)], "r3")
    foil(s, 18, 22, 37, 15, seed=19, mask=lambda i, j: s.get(18 + i, 22 + j) == K("r3"))
    # LORRI telescopic imager + Ralph/Alice apertures on right flank
    s.rect(48, 25, 8, 5, "m3")
    s.rect(55, 26, 2, 3, "c3")
    s.rect(24, 28, 5, 4, "m2")
    s.px(25, 29, "c4")
    # Top white high-gain dish
    dish(s, 35, 13, 14, 7, face="m5", rim="m5", shade="m3")
    strut(s, 27, 13, 35, 4, "m2")
    strut(s, 43, 13, 35, 4, "m2")
    s.px(35, 4, "m4")
    s.outline(OUT)
    return s


def pioneer():
    """Pioneer 10/11: large parabolic dish, magnetometer boom, dual RTG booms."""
    s = Art(74, 48)
    # Long magnetometer boom (right)
    strut(s, 42, 26, 70, 26, "m3")
    s.rect(68, 24, 3, 4, "m4")
    # Dual RTG booms (left/up & left/down)
    strut(s, 28, 22, 10, 12, "m2", 2)
    s.rect(7, 10, 5, 4, "m0")
    strut(s, 28, 30, 10, 40, "m2", 2)
    s.rect(7, 38, 5, 4, "m0")
    # Hexagonal equipment compartment
    s.rect(28, 20, 14, 12, "r3")
    foil(s, 28, 20, 14, 12, seed=23)
    # Dish facing left-upward
    dish(s, 35, 13, 13, 7, face="m5", rim="m5", shade="m3")
    strut(s, 28, 13, 35, 4, "m3")
    strut(s, 42, 13, 35, 4, "m3")
    s.outline(OUT)
    return s


def cassini():
    """Cassini-Huygens: tall gold-foil stack, white high-gain dish, attached ESA Huygens probe disc."""
    s = Art(72, 56)
    # Magnetometer boom (right)
    strut(s, 42, 26, 67, 18, "m3")
    s.px(67, 18, "m5")
    # Plasma/RPWS antennas (top)
    strut(s, 34, 14, 22, 3, "m2")
    strut(s, 38, 14, 50, 3, "m2")
    # RTG shades near base
    s.rect(27, 41, 18, 6, "m1")
    s.bevel("cool", lo="m0", hi="m3")
    # Main body stack in gold foil
    s.rect(28, 18, 16, 23, "r3")
    foil(s, 28, 18, 16, 23, seed=31)
    # ESA Huygens Titan Probe mounted on left side (warm bronze/gold aeroshell)
    s.ellipse(22, 30, 7, 10, "e3")
    s.ellipse(21, 30, 5, 8, "w2")
    s.ellipse(22, 30, 7, 10, "e1", ring=1.0)
    # High-gain dish on top
    dish(s, 36, 12, 12, 6, face="m5", rim="m5", shade="m3")
    strut(s, 29, 12, 36, 4, "m3")
    strut(s, 43, 12, 36, 4, "m3")
    s.outline(OUT)
    return s


def galileo():
    """Galileo: dual-spin orbiter with umbrella-like high-gain antenna, magnetometer boom, atmospheric probe."""
    s = Art(72, 52)
    # Long magnetometer boom (right)
    strut(s, 40, 28, 68, 22, "m3")
    s.rect(66, 20, 4, 4, "m4")
    # RTG booms (left)
    strut(s, 26, 25, 10, 17, "m2")
    s.rect(7, 15, 5, 4, "m0")
    strut(s, 26, 33, 10, 41, "m2")
    s.rect(7, 39, 5, 4, "m0")
    # Bus + spun section
    s.rect(26, 22, 16, 14, "r3")
    foil(s, 26, 22, 16, 14, seed=41)
    # Conical atmospheric entry probe attached beneath
    s.poly([(28, 36), (40, 36), (36, 45), (32, 45)], "e4")
    s.hline(29, 36, 10, "w2")
    # Umbrella HGA ribs at top
    for dx in (-11, -6, 0, 6, 11):
        strut(s, 34, 4, 34 + dx, 18, "e4")
    s.ellipse(34, 17, 12, 4, "m3")
    s.rect(33, 4, 3, 18, "m4")
    s.outline(OUT)
    return s


def dawn():
    """Dawn: spacecraft bus with wide cyan ion-propulsion solar wings and blue xenon thruster glow."""
    s = Art(86, 44)
    # Wide twin solar arrays
    solar(s, 2, 14, 30, 14, cell=4)
    solar(s, 54, 14, 30, 14, cell=4)
    strut(s, 32, 21, 36, 21, "m3", 2)
    strut(s, 50, 21, 54, 21, "m3", 2)
    # Central bus
    rrect(s, 36, 14, 14, 16, 2, "m2")
    s.bevel("cool", lo="m0", hi="m5")
    # Dish on top
    dish(s, 43, 9, 7, 4)
    # Ion thruster glow at bottom (signature cyan/laser core)
    s.rect(40, 30, 6, 3, "m1")
    s.rect(41, 33, 4, 4, "c3")
    s.px(42, 34, "c4").px(43, 34, "c4")
    s.px(42, 38, "c2").px(43, 37, "c2")
    s.outline(OUT)
    return s


def deep_impact():
    """Deep Impact / EPOXI: flyby craft with solar wing and detached copper impactor."""
    s = Art(74, 46)
    # Flyby spacecraft (left)
    solar(s, 4, 12, 14, 22, cell=4)
    s.rect(19, 15, 16, 16, "r3")
    foil(s, 19, 15, 16, 16, seed=55)
    dish(s, 27, 10, 7, 4)
    s.rect(35, 19, 5, 5, "m4")
    s.px(38, 21, "c3")
    # Copper impactor (right, detached targeter)
    s.poly([(52, 18), (64, 16), (68, 24), (64, 32), (52, 30)], "r4")
    s.rect(54, 20, 9, 8, "w1")
    s.px(65, 24, "c3").px(66, 24, "c4")
    s.outline(OUT)
    return s


def kepler():
    """Kepler Space Telescope: tilted cylindrical photometer barrel, sunshade baffle, rear solar array."""
    s = Art(68, 48)
    # Solar array wing beneath
    quad(s, (10, 34), (44, 38), (16, 26), lambda u, v: "c0" if int(u * 8) != int((u + 0.03) * 8) else "c1")
    # Telescope barrel (tilted octagon/cylinder)
    s.poly([(16, 16), (48, 8), (54, 22), (22, 30)], "m3")
    s.bevel("cool", lo="m0", hi="m5")
    # Angled aperture baffle + star-light opening
    s.ellipse(51, 15, 5, 8, "s2")
    s.ellipse(51, 15, 5, 8, "m5", ring=1.0)
    s.px(50, 14, "c4").px(52, 16, "c3")
    # Spacecraft bus base
    s.rect(14, 24, 12, 10, "r3")
    foil(s, 14, 24, 12, 10, seed=67)
    s.outline(OUT)
    return s


SPRITES_ELSEWHERE = {
    "near-shoemaker": near_shoemaker,
    "voyager": voyager,
    "new-horizons": new_horizons,
    "pioneer": pioneer,
    "cassini": cassini,
    "galileo": galileo,
    "dawn": dawn,
    "deep-impact": deep_impact,
    "kepler": kepler,
}
