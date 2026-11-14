/**
 * Still Out There — Unified 24-Colour Art Direction Palette (docs/ART.md)
 * 640x360 Integer Scaling & Moody Retro Pixel Art Specification
 */

export const PALETTE_24 = [
  // Deep space & cool shadows (never pure black)
  '#05070f', // 1. Space Black / Void
  '#0b0f1d', // 2. Deep Indigo (Shadows)
  '#131a2e', // 3. Shadow Navy
  '#1d263f', // 4. Atmospheric Dusk

  // Moon regolith & rocks (cool grey-purple gradient)
  '#27293d', // 5. Lunar Basalt Dark
  '#3b3e59', // 6. Lunar Regolith Deep
  '#595e7d', // 7. Lunar Regolith Mid
  '#8389a8', // 8. Lunar Dust Light
  '#b2b8d4', // 9. Lunar Crust Cream
  '#e2e6fa', // 10. Lunar Highlight / White Rim

  // Mars rust & ochre (warm layered gradient)
  '#2b140e', // 11. Mars Shadow Umber
  '#522116', // 12. Mars Deep Rust
  '#7d331c', // 13. Mars Ochre Core
  '#ab4f2c', // 14. Mars Terracotta
  '#cf724a', // 15. Mars Dust Tan
  '#e89e7d', // 16. Mars Haze Peach

  // Cyan / Robot / UI (telemetry & fiction)
  '#032630', // 17. Cyan Void / Backing
  '#064b5c', // 18. Cyan Shadow
  '#087d99', // 19. Cyan Deep
  '#0ec3dc', // 20. Cyan Glow (Primary UI Edge)
  '#7ef1ff', // 21. Cyan Laser / Visor Core

  // Warm orange accents (thrusters, lamps, beacon glows)
  '#4a1805', // 22. Ember Shadow
  '#e65100', // 23. Thruster Flame
  '#f59e0b', // 24. Beacon Gold / Solar Amber
] as const;

export type PaletteColor = typeof PALETTE_24[number];

export const PALETTE = {
  // 24 Master Palette Tokens
  spaceBlack: '#05070f',
  spaceBlackHex: 0x05070f,
  deepIndigo: '#0b0f1d',
  deepIndigoHex: 0x0b0f1d,
  shadowNavy: '#131a2e',
  shadowNavyHex: 0x131a2e,
  atmosphericDusk: '#1d263f',
  atmosphericDuskHex: 0x1d263f,

  lunarBasaltDark: '#27293d',
  lunarBasaltDarkHex: 0x27293d,
  lunarRegolithDeep: '#3b3e59',
  lunarRegolithDeepHex: 0x3b3e59,
  lunarRegolithMid: '#595e7d',
  lunarRegolithMidHex: 0x595e7d,
  lunarDustLight: '#8389a8',
  lunarDustLightHex: 0x8389a8,
  lunarCrustCream: '#b2b8d4',
  lunarCrustCreamHex: 0xb2b8d4,
  lunarHighlight: '#e2e6fa',
  lunarHighlightHex: 0xe2e6fa,

  marsShadowUmber: '#2b140e',
  marsShadowUmberHex: 0x2b140e,
  marsDeepRust: '#522116',
  marsDeepRustHex: 0x522116,
  marsOchreCore: '#7d331c',
  marsOchreCoreHex: 0x7d331c,
  marsTerracotta: '#ab4f2c',
  marsTerracottaHex: 0xab4f2c,
  marsDustTan: '#cf724a',
  marsDustTanHex: 0xcf724a,
  marsHazePeach: '#e89e7d',
  marsHazePeachHex: 0xe89e7d,

  cyanVoid: '#032630',
  cyanVoidHex: 0x032630,
  cyanShadow: '#064b5c',
  cyanShadowHex: 0x064b5c,
  cyanDeep: '#087d99',
  cyanDeepHex: 0x087d99,
  cyanGlow: '#0ec3dc',
  cyanGlowHex: 0x0ec3dc,
  cyanLaser: '#7ef1ff',
  cyanLaserHex: 0x7ef1ff,

  emberShadow: '#4a1805',
  emberShadowHex: 0x4a1805,
  thrusterOrange: '#e65100',
  thrusterOrangeHex: 0xe65100,
  beaconGold: '#f59e0b',
  beaconGoldHex: 0xf59e0b,

  // Compatibility Aliases for Existing Callers
  spaceInk: '#05070f',
  spaceInkHex: 0x05070f,
  moonDust: '#b2b8d4',
  moonDustHex: 0xb2b8d4,
  regolithDark: '#27293d',
  regolithDarkHex: 0x27293d,
  marsDust: '#cf724a',
  marsDustHex: 0xcf724a,
  marsDark: '#2b140e',
  marsDarkHex: 0x2b140e,
  amberVerified: '#f59e0b',
  amberVerifiedHex: 0xf59e0b,
  cyanRobot: '#0ec3dc',
  cyanRobotHex: 0x0ec3dc,
  titaniumWhite: '#e2e6fa',
  titaniumWhiteHex: 0xe2e6fa,
  slateMuted: '#8389a8',
  slateMutedHex: 0x8389a8,
  borderHairline: '#131a2e',
  borderHairlineHex: 0x131a2e,
  hullGreen: '#0ec3dc',
  hullGreenHex: 0x0ec3dc,
} as const;

export const PIXEL_FONT = {
  family: 'StillOutTherePixel',
  bitmapKey: 'pixel_font',
  cssUrl: '/assets/fonts/pixel.ttf',
  fallback: '"Courier New", Courier, monospace',
} as const;
