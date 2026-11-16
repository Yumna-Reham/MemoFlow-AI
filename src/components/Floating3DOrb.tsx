'use client';

import React, { useEffect, useRef } from 'react';

interface Floating3DOrbProps {
  interactive?: boolean;
  size?: number;
  showBadges?: boolean;
}

export default function Floating3DOrb({
  interactive = true,
  size = 300,
  showBadges = false,
}: Floating3DOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  const aiNodeBadges = [
    { label: 'PDF OCR', pos: 'top-0 left-2', glow: 'text-cyan-300 bg-cyan-500/20 border-cyan-500/40 shadow-cyan-500/20' },
    { label: 'Neural Vectors', pos: 'top-6 right-0', glow: 'text-violet-300 bg-violet-500/20 border-violet-500/40 shadow-violet-500/20' },
    { label: 'Semantic Search', pos: 'bottom-8 left-0', glow: 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40 shadow-emerald-500/20' },
    { label: 'Voice Audio', pos: 'bottom-0 right-4', glow: 'text-rose-300 bg-rose-500/20 border-rose-500/40 shadow-rose-500/20' },
    { label: 'AI Memory Graph', pos: '-top-4 left-1/3', glow: 'text-fuchsia-300 bg-fuchsia-500/20 border-fuchsia-500/40 shadow-fuchsia-500/20' },
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const canvasSize = Math.round(size * 1.4);
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    // Particle class for galaxy starfield sparks
    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      color: string;
      alpha: number;
      pulseSpeed: number;
      angle: number;

      constructor() {
        this.x = Math.random() * canvasSize;
        this.y = Math.random() * canvasSize;
        this.size = Math.random() * 2 + 1;
        this.speedX = (Math.random() - 0.5) * 0.4;
        this.speedY = (Math.random() - 0.5) * 0.4;
        this.color = Math.random() > 0.5 ? '#38BDF8' : '#A855F7';
        this.alpha = Math.random() * 0.6 + 0.2;
        this.pulseSpeed = Math.random() * 0.03 + 0.01;
        this.angle = Math.random() * Math.PI * 2;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.angle += this.pulseSpeed;
        this.alpha = 0.3 + Math.sin(this.angle) * 0.3;

        if (this.x < 0) this.x = canvasSize;
        if (this.x > canvasSize) this.x = 0;
        if (this.y < 0) this.y = canvasSize;
        if (this.y > canvasSize) this.y = 0;
      }

      draw(c: CanvasRenderingContext2D) {
        c.save();
        c.globalAlpha = Math.max(0, Math.min(1, this.alpha));
        c.fillStyle = this.color;
        c.beginPath();
        c.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
    }

    const particles: Particle[] = Array.from({ length: 40 }, () => new Particle());

    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const clientX = e.clientX - rect.left - rect.width / 2;
      const clientY = e.clientY - rect.top - rect.height / 2;
      
      mouseRef.current.targetX = clientX / (rect.width / 2);
      mouseRef.current.targetY = clientY / (rect.height / 2);
    };

    if (interactive) {
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
    }

    let time = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvasSize, canvasSize);

      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.06;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.06;

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      time += 0.018;

      // Draw particle starfield
      particles.forEach((p) => {
        p.update();
        p.draw(ctx);
      });

      const centerX = canvasSize / 2 + mx * 14;
      const centerY = canvasSize / 2 + my * 14;
      const safeSize = Math.max(size, 10);
      const rInner = safeSize * 0.05;
      const rOuter = safeSize * 0.52;

      if (Number.isFinite(centerX) && Number.isFinite(centerY)) {
        const glowGrad = ctx.createRadialGradient(
          centerX, centerY, rInner,
          centerX, centerY, rOuter
        );
        glowGrad.addColorStop(0, 'rgba(124, 58, 237, 0.45)');
        glowGrad.addColorStop(0.35, 'rgba(37, 99, 235, 0.25)');
        glowGrad.addColorStop(0.7, 'rgba(56, 189, 248, 0.08)');
        glowGrad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, rOuter, 0, Math.PI * 2);
        ctx.fill();
      }

      // Concentric 3D Orbital Galaxy Rings
      const ringRadius = safeSize * 0.44;
      const numRings = 4;

      for (let i = 0; i < numRings; i++) {
        const angleOffset = (time * (i % 2 === 0 ? 1 : -1)) + (i * Math.PI / numRings);
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(angleOffset);

        ctx.beginPath();
        ctx.ellipse(0, 0, ringRadius, ringRadius * 0.35, i * (Math.PI / 4), 0, Math.PI * 2);
        
        ctx.strokeStyle = i % 2 === 0 
          ? `rgba(56, 189, 248, ${0.4 + Math.sin(time + i) * 0.2})`
          : `rgba(168, 85, 247, ${0.4 + Math.cos(time + i) * 0.2})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.restore();
      }

      // Central Glass Core Sphere
      const sphereRadius = safeSize * 0.25;
      const gx1 = centerX - sphereRadius;
      const gy1 = centerY - sphereRadius;
      const gx2 = centerX + sphereRadius;
      const gy2 = centerY + sphereRadius;

      if (Number.isFinite(gx1) && Number.isFinite(gy1) && Number.isFinite(gx2) && Number.isFinite(gy2)) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, sphereRadius, 0, Math.PI * 2);
        const glassGrad = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
        glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
        glassGrad.addColorStop(0.3, 'rgba(168, 85, 247, 0.2)');
        glassGrad.addColorStop(0.7, 'rgba(37, 99, 235, 0.3)');
        glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
        ctx.fillStyle = glassGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (interactive) {
        window.removeEventListener('mousemove', handleMouseMove);
      }
    };
  }, [interactive, size]);

  return (
    <div className="relative flex items-center justify-center pointer-events-none select-none">
      <canvas
        ref={canvasRef}
        className="block max-w-full z-0 drop-shadow-[0_25px_60px_rgba(124,58,237,0.35)]"
      />

      {/* Floating Interactive Node Badges (Optional) */}
      {showBadges && aiNodeBadges.map((kw, i) => (
        <div
          key={i}
          className={`absolute ${kw.pos} z-10 px-3 py-1 rounded-full text-[11px] font-extrabold border backdrop-blur-md shadow-xl animate-pulse pointer-events-none ${kw.glow}`}
        >
          {kw.label}
        </div>
      ))}
    </div>
  );
}
