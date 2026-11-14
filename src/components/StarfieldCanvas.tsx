import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  color: string;
  twinkleSpeed: number;
  opacity: number;
}

export function StarfieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Generate 100 stars with 24-palette colors (Highlight rim, Dust light, Cyan glow)
    const starColors = ['#e2e6fa', '#b2b8d4', '#8389a8', '#0ec3dc', '#7ef1ff'];
    const stars: Star[] = Array.from({ length: 90 }, () => ({
      x: Math.floor(Math.random() * width),
      y: Math.floor(Math.random() * height),
      size: Math.random() > 0.85 ? 2 : 1,
      color: starColors[Math.floor(Math.random() * starColors.length)],
      twinkleSpeed: 0.01 + Math.random() * 0.02,
      opacity: 0.2 + Math.random() * 0.8,
    }));

    let frame = 0;
    const render = () => {
      frame++;
      ctx.clearRect(0, 0, width, height);

      for (const star of stars) {
        const flicker = Math.sin(frame * star.twinkleSpeed) * 0.35 + 0.65;
        ctx.globalAlpha = star.opacity * flicker;
        ctx.fillStyle = star.color;
        // Integer coordinate pixel drawing
        ctx.fillRect(Math.floor(star.x), Math.floor(star.y), star.size, star.size);
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.8,
      }}
    />
  );
}
