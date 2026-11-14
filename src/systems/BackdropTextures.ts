import Phaser from 'phaser';
import { BackdropKind, getCinematicBackdrop } from './TitleArt.ts';

/** Registers the padded sky / ridge canvases for a backdrop once per game. */
export function ensureBackdropTextures(textures: Phaser.Textures.TextureManager, kind: BackdropKind): void {
  if (textures.exists(`cin_${kind}_sky`)) return;
  const b = getCinematicBackdrop(kind);
  textures.addCanvas(`cin_${kind}_sky`, b.sky);
  if (b.far) textures.addCanvas(`cin_${kind}_far`, b.far.canvas);
  if (b.mid) textures.addCanvas(`cin_${kind}_mid`, b.mid.canvas);
  if (b.near) textures.addCanvas(`cin_${kind}_near`, b.near.canvas);
}
