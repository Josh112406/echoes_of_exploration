import { useEffect, useRef } from 'react';
import { getMissionSpriteCanvas } from '../systems/stillOutThereArt';

interface PixelSpriteThumbProps {
  missionId: string;
  alt: string;
  size?: number;
}

/** Renders a 32x32 procedural pixel-art spacecraft sprite onto a crisp pixel canvas. */
export function PixelSpriteThumb({ missionId, alt, size = 64 }: PixelSpriteThumbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const target = canvasRef.current;
    if (!target) return;
    const ctx = target.getContext('2d');
    if (!ctx) return;
    const sprite = getMissionSpriteCanvas(missionId);
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, 0, 0, target.width, target.height);
  }, [missionId]);

  return (
    <canvas
      ref={canvasRef}
      width={32}
      height={32}
      className="pixelated"
      role="img"
      aria-label={alt}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}
