import Phaser from 'phaser';

export class PostProcessing {
  private scene: Phaser.Scene;
  private vignetteImage?: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Full-screen 640x360 Vignette Overlay
   * Darkens screen perimeters towards deep space indigo
   */
  createVignette(width: number = 640, height: number = 360, depth: number = 95): Phaser.GameObjects.Image | undefined {
    if (this.scene.textures.exists('vignette_overlay')) {
      this.vignetteImage = this.scene.add.image(width / 2, height / 2, 'vignette_overlay')
        .setScrollFactor(0)
        .setDepth(depth)
        .setAlpha(0.88);
      return this.vignetteImage;
    }
    return undefined;
  }
}

