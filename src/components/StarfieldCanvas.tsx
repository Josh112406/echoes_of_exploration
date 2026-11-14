import { useEffect, useRef } from 'react';
import type { QualityOption } from '../persistence/saveManager';

interface Star {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  phase: number;
  speed: number;
  color: string;
}

const STAR_COLORS = ['#eef2ff', '#9aa6c9', '#0ec3dc', '#f59e0b'];

interface StarfieldCanvasProps {
  reducedMotion?: boolean;
  quality?: QualityOption;
}

export function StarfieldCanvas({
  reducedMotion = false,
  quality = 'high',
}: StarfieldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let stars: Star[] = [];

    const starCountForQuality = () => {
      if (quality === 'reduced') return 55;
      if (quality === 'balanced') return 95;
      return 145;
    };

    const init = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;

      const count = starCountForQuality();
      stars = Array.from({ length: count }, (_, idx) => ({
        x: Math.floor(Math.random() * width),
        y: Math.floor(Math.random() * height),
        size: idx % 11 === 0 ? 2 : 1,
        baseAlpha: 0.28 + Math.random() * 0.52,
        phase: Math.random() * Math.PI * 2,
        speed: 0.006 + Math.random() * 0.012,
        color: STAR_COLORS[idx % STAR_COLORS.length],
      }));
    };

    const drawStaticOrAnimated = (time: number, animate: boolean) => {
      ctx.clearRect(0, 0, width, height);
      for (const star of stars) {
        const twinkle = animate
          ? Math.sin(time * 0.0014 + star.phase) * 0.25
          : 0;
        const alpha = Math.max(0.12, Math.min(0.95, star.baseAlpha + twinkle));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = star.color;
        if (animate && !reducedMotion) {
          star.x -= star.speed * 18;
          if (star.x < 0) {
            star.x = width;
            star.y = Math.floor(Math.random() * height);
          }
        }
        ctx.fillRect(Math.floor(star.x), Math.floor(star.y), star.size, star.size);
      }
      ctx.globalAlpha = 1;
    };

    init();
    drawStaticOrAnimated(0, false);

    if (!reducedMotion) {
      const render = (time: number) => {
        drawStaticOrAnimated(time, true);
        animId = window.requestAnimationFrame(render);
      };
      animId = window.requestAnimationFrame(render);
    }

    const handleResize = () => {
      init();
      drawStaticOrAnimated(0, false);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      if (animId) window.cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [reducedMotion, quality]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
