"""Echoes of Exploration - procedural 16-bit pixel-art asset builder.

Generates sprites, celestial bodies, 640x360 scenes, and mission patches into
public/assets/generated/ using the master 24-color palette + extensions.

AI disclosure: generated with an SI/AI assistant for Member 5 (Visual Design);
human review required. Code Apache-2.0, art CC0-1.0.
"""
from __future__ import annotations

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import numpy as np
from core import Art, K
from scenes import earth, eros, moon_disc, planet, saturn, side_scene, sky, sun_star
from sprites import SPRITES_MOON, robot, rrect, strut
from sprites_mars import SPRITES_MARS
from sprites_elsewhere import SPRITES_ELSEWHERE

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT_BASE = os.path.join(ROOT, "public", "assets", "generated")


def make_patch(icon_fn, border_key="w2", bg_key="s1", accent_key="c3") -> Art:
    """Create a 48x48 hexagonal/shield pixel mission patch with miniature emblem."""
    p = Art(48, 48)
    # Outer diamond/hexagonal patch silhouette
    pts = [(12, 2), (35, 2), (45, 12), (45, 35), (35, 45), (12, 45), (2, 35), (2, 12)]
    p.poly(pts, bg_key)
    # Subtle star specks inside patch
    for sx, sy, sk in ((10, 10, "m2"), (36, 12, "m3"), (14, 34, "m1"), (34, 36, "c2"), (24, 9, "m4")):
        p.px(sx, sy, sk)
    # Draw miniature emblem in center
    icon_fn(p)
    # Crisp 2px double border (outer shadow, inner gold/cyan rim)
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        p.line(a[0], a[1], b[0], b[1], border_key)
    inner = [(13, 4), (34, 4), (43, 13), (43, 34), (34, 43), (13, 43), (4, 34), (4, 13)]
    for i in range(len(inner)):
        a, b = inner[i], inner[(i + 1) % len(inner)]
        p.line(a[0], a[1], b[0], b[1], accent_key)
    p.outline("s0")
    return p


def build_patches():
    out_dir = os.path.join(OUT_BASE, "patches")

    def icon_gentle(p: Art):
        p.rect(8, 33, 32, 4, "m2")
        p.hline(8, 33, 32, "m4")
        # Surveyor silhouette
        strut(p, 20, 24, 13, 33, "m3")
        strut(p, 28, 24, 35, 33, "m3")
        p.rect(20, 18, 8, 6, "m4")
        p.rect(23, 10, 2, 8, "m3")
        p.rect(18, 10, 6, 3, "c3")
        p.rect(25, 10, 6, 3, "m5")
        p.rect(11, 32, 4, 2, "w2")
        p.rect(33, 32, 4, 2, "w2")

    def icon_echo(p: Art):
        # Lunar retroreflector + laser beam bouncing
        p.rect(14, 30, 20, 5, "m2")
        p.rect(17, 25, 14, 5, "c2")
        for x in range(19, 30, 3):
            p.px(x, 27, "c4")
        p.line(8, 8, 24, 25, "c4")
        p.line(24, 25, 40, 8, "c3")
        p.disc(24, 25, 2, "c4")

    def icon_lrv(p: Art):
        # Rover + Taurus-Littrow curve
        p.rect(8, 33, 32, 3, "m1")
        p.rect(14, 23, 18, 3, "m4")
        p.rect(26, 15, 2, 8, "m3")
        p.ellipse(27, 14, 4, 2, "w2")
        p.disc(16, 29, 4, "m3")
        p.disc(16, 29, 2, "s2")
        p.disc(31, 29, 4, "m3")
        p.disc(31, 29, 2, "s2")

    def icon_viking(p: Art):
        # Soil scoop + dish + ambiguous double question curve
        p.rect(8, 33, 32, 4, "r2")
        p.rect(16, 22, 16, 6, "m4")
        strut(p, 18, 28, 13, 34, "m3")
        strut(p, 30, 28, 35, 34, "m3")
        p.ellipse(24, 14, 6, 3, "m5")
        p.rect(23, 17, 2, 5, "m3")
        p.disc(12, 29, 2, "w2")

    def icon_spirit(p: Art):
        # Exposed white silica streak under rover wheel
        p.rect(8, 32, 32, 5, "r2")
        p.rect(10, 32, 18, 2, "m5")  # bright silica trench
        p.rect(16, 20, 14, 5, "c2")
        p.disc(18, 29, 3, "m3")
        p.disc(28, 29, 3, "w1")  # dragged right-front wheel
        p.rect(26, 13, 2, 7, "m4")
        p.rect(24, 11, 6, 3, "m5")

    def icon_ingenuity(p: Art):
        # Rotor helicopter hovering above Mars
        p.rect(8, 34, 32, 3, "r2")
        p.hline(11, 16, 26, "c4")
        p.hline(13, 19, 22, "c3")
        p.rect(23, 14, 2, 8, "m3")
        p.rect(20, 21, 8, 5, "w2")
        strut(p, 21, 26, 17, 31, "m3")
        strut(p, 27, 26, 31, 31, "m3")

    def icon_near(p: Art):
        # Asteroid 433 Eros with cruciform lander
        p.ellipse(24, 31, 14, 6, "e2")
        p.ellipse(22, 29, 10, 4, "e3")
        p.rect(18, 17, 12, 4, "c2")
        p.rect(22, 12, 4, 13, "c2")
        p.rect(21, 16, 6, 6, "w2")

    def icon_voyager(p: Art):
        # Dish + interstellar wave + Golden Record
        p.ellipse(22, 18, 10, 6, "m5")
        p.rect(20, 24, 6, 6, "m3")
        p.disc(23, 27, 2, "w2")
        strut(p, 26, 26, 38, 16, "c3")
        strut(p, 18, 26, 10, 36, "m2")
        for r in (4, 7, 10):
            p.px(36 + r // 2, 14 - r // 3, "c4")

    def icon_newhorizons(p: Art):
        # Pluto heart globe + flyby trajectory
        p.disc(26, 26, 10, "e3")
        p.disc(27, 27, 4, "e5")
        p.line(8, 34, 38, 12, "c4")
        p.rect(14, 20, 6, 4, "w2")

    def icon_archivist(p: Art):
        # Master patch: Earth + Moon + Mars + Star compass
        p.disc(24, 24, 12, "o1")
        p.disc(22, 22, 6, "g1")
        p.disc(24, 24, 12, "c4", ring=1.0)
        p.disc(12, 13, 3, "m4")
        p.disc(36, 13, 3, "r4")
        p.disc(36, 35, 2, "e5")
        p.line(24, 7, 24, 41, "w2")
        p.line(7, 24, 41, 24, "w2")

    specs = {
        "patch-gentle-touch": (icon_gentle, "w2", "s1", "c3"),
        "patch-echo-never-sleeps": (icon_echo, "w2", "s1", "c4"),
        "patch-farther-than-footsteps": (icon_lrv, "w2", "s1", "c3"),
        "patch-question-in-the-soil": (icon_viking, "w2", "s1", "r4"),
        "patch-clues-beneath-the-wheel": (icon_spirit, "w2", "s1", "r5"),
        "patch-air-thin-as-a-whisper": (icon_ingenuity, "w2", "s1", "r4"),
        "patch-landing-not-planned": (icon_near, "w2", "s1", "e4"),
        "patch-power-for-the-unknown": (icon_voyager, "w2", "s1", "c4"),
        "patch-one-chance-at-pluto": (icon_newhorizons, "w2", "s1", "e5"),
        "patch-signal-archivist": (icon_archivist, "c4", "s1", "w2"),
    }

    for name, (fn, b, bg, acc) in specs.items():
        art = make_patch(fn, b, bg, acc)
        art.save(os.path.join(out_dir, f"{name}.png"), title=name, note="Mission patch illustration")


def build_sprites():
    out_dir = os.path.join(OUT_BASE, "sprites")
    # Guide robot poses
    for pose in ("idle", "talk", "happy", "hover"):
        robot(pose=pose, beacon=(pose == "talk")).save(
            os.path.join(out_dir, f"robot-{pose}.png"), title=f"robot-{pose}"
        )
    # Moon sprites
    for name, fn in SPRITES_MOON.items():
        fn().save(os.path.join(out_dir, f"{name}.png"), title=name)
    # Mars sprites
    for name, fn in SPRITES_MARS.items():
        fn().save(os.path.join(out_dir, f"{name}.png"), title=name)
    # Elsewhere sprites
    for name, fn in SPRITES_ELSEWHERE.items():
        fn().save(os.path.join(out_dir, f"{name}.png"), title=name)


def build_bodies():
    out_dir = os.path.join(OUT_BASE, "bodies")
    earth(r=32, seed=5).save(os.path.join(out_dir, "earth.png"), title="Earth globe")
    moon_disc(r=30, seed=3).save(os.path.join(out_dir, "moon.png"), title="Moon disc")
    planet(28, "mars", seed=11, glow=False).save(os.path.join(out_dir, "mars.png"), title="Mars globe")
    eros(w=104, h=54, seed=8).save(os.path.join(out_dir, "eros.png"), title="433 Eros illustration")
    planet(28, "jupiter", seed=17).save(os.path.join(out_dir, "jupiter.png"), title="Jupiter globe")
    saturn(r=16, seed=4).save(os.path.join(out_dir, "saturn.png"), title="Saturn globe")
    planet(28, "pluto", seed=19).save(os.path.join(out_dir, "pluto.png"), title="Pluto globe")


def build_scenes():
    out_dir = os.path.join(OUT_BASE, "scenes")

    # 1. Moon scene (Earth in upper right, cool grey regolith)
    moon_res = side_scene({
        "ramp": "moon",
        "seed": 14,
        "body": {"kind": "earth", "x": 520, "y": 82, "r": 34, "seed": 5},
        "stars": 1.1,
        "craters": 10,
        "rocks": 38,
    })
    moon_res["flat"].copy().watermark().save(os.path.join(out_dir, "scene-moon.png"), title="Moon Observatory Scene")

    # 2. Mars scene (pale cyan Earth dot, dusty horizon haze, rust ridges)
    mars_res = side_scene({
        "ramp": "mars",
        "seed": 28,
        "body": {"kind": "dot", "x": 510, "y": 78},
        "stars": 0.75,
        "craters": 7,
        "rocks": 42,
    })
    mars_res["flat"].copy().watermark().save(os.path.join(out_dir, "scene-mars.png"), title="Mars Surface Scene")

    # 3. Elsewhere - Eros asteroid scene
    eros_res = side_scene({
        "ramp": "else",
        "seed": 42,
        "body": {"kind": "sun", "x": 520, "y": 74, "r": 2},
        "stars": 1.3,
        "milky": True,
        "craters": 12,
        "rocks": 48,
    })
    eros_res["flat"].copy().watermark().save(os.path.join(out_dir, "scene-elsewhere-eros.png"), title="433 Eros Scene")

    # 4. Elsewhere - Interstellar Deep Space sky
    deep = sky(seed=77, horizon=350, star_density=1.4, nebula=True, milky=True)
    sat = saturn(r=16, seed=4)
    deep.blit(sat, 470, 56)
    sun_star(deep, 130, 88, size=1)
    deep.watermark().save(os.path.join(out_dir, "scene-elsewhere-deep.png"), title="Interstellar Deep Space Scene")

    # 5. Elsewhere - Pluto & Charon scene
    pluto_scene = sky(seed=91, horizon=260, star_density=1.2, nebula=False, milky=True)
    pl = planet(42, "pluto", seed=19)
    ch = planet(16, "charon", seed=21)
    pluto_scene.blit(pl, 430, 58)
    pluto_scene.blit(ch, 340, 44)
    sun_star(pluto_scene, 110, 72, size=1)
    pluto_scene.watermark().save(os.path.join(out_dir, "scene-elsewhere-pluto.png"), title="Pluto System Scene")


def main():
    print("Building 16-bit procedural pixel-art assets...")
    build_sprites()
    build_bodies()
    build_scenes()
    build_patches()
    print(f"Done. Assets written to {OUT_BASE}")


if __name__ == "__main__":
    main()
