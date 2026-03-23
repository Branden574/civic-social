'use client';

import { useEffect, useRef, useCallback } from 'react';

const TOTAL_FRAMES = 320;
const LERP_SPEED = 0.15;
const FRAME_PHASE = 0.36;
const FADE_START = FRAME_PHASE + 0.012;
const FADE_END = FRAME_PHASE + 0.11;

function framePath(i: number) {
  return `/frames-webp/frame_${String(i + 1).padStart(6, '0')}.webp`;
}

interface FrameCanvasProps {
  onLoadProgress?: (pct: number) => void;
  onLoaded?: () => void;
}

export function FrameCanvas({ onLoadProgress, onLoaded }: FrameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgWrapRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameRef = useRef(0);
  const isReadyRef = useRef(false);
  const rafRef = useRef<number>(0);

  const drawFrame = useCallback((img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas || !img || !img.naturalWidth) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cw = canvas.width;
    const ch = canvas.height;
    if (cw < 10 || ch < 10) return;
    ctx.clearRect(0, 0, cw, ch);
    const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Resize canvas
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };
    resize();
    window.addEventListener('resize', resize);

    // Load frames
    let loaded = 0;
    const images: HTMLImageElement[] = new Array(TOTAL_FRAMES);
    imagesRef.current = images;

    const onFrameLoad = () => {
      loaded++;
      onLoadProgress?.(loaded / TOTAL_FRAMES);
      if (loaded >= TOTAL_FRAMES) {
        isReadyRef.current = true;
        onLoaded?.();
      }
    };

    for (let i = 0; i < TOTAL_FRAMES; i++) {
      images[i] = new Image();
      images[i].onload = onFrameLoad;
      images[i].onerror = onFrameLoad;
      images[i].src = framePath(i);
    }

    // Scroll calculations
    const pageScroll01 = () => {
      const maxScroll = Math.max(
        document.documentElement.scrollHeight - window.innerHeight,
        1
      );
      return Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
    };

    const getFrameScrubT = () => {
      const p = pageScroll01();
      return p <= FRAME_PHASE ? p / FRAME_PHASE : 1;
    };

    const getFrameToStaticMix = () => {
      const p = pageScroll01();
      if (p <= FADE_START) return 0;
      if (p >= FADE_END) return 1;
      return (p - FADE_START) / (FADE_END - FADE_START);
    };

    // Animation loop
    let targetFrame = 0;

    const animate = () => {
      if (isReadyRef.current) {
        targetFrame = getFrameScrubT() * (TOTAL_FRAMES - 1);
      }
      currentFrameRef.current +=
        (targetFrame - currentFrameRef.current) * LERP_SPEED;

      const idx = Math.round(currentFrameRef.current);
      if (idx >= 0 && idx < TOTAL_FRAMES && images[idx]) {
        drawFrame(images[idx]);
      }

      // Crossfade canvas → static backdrop
      const mix = getFrameToStaticMix();
      if (bgWrapRef.current) bgWrapRef.current.style.opacity = String(1 - mix);
      if (backdropRef.current) backdropRef.current.style.opacity = String(mix);

      rafRef.current = requestAnimationFrame(animate);
    };

    // Start animation once first frame is ready
    const startCheck = setInterval(() => {
      if (isReadyRef.current || loaded > 10) {
        clearInterval(startCheck);
        animate();
      }
    }, 100);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
      clearInterval(startCheck);
    };
  }, [drawFrame, onLoadProgress, onLoaded]);

  return (
    <>
      {/* Canvas for frame animation */}
      <div
        ref={bgWrapRef}
        className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block"
        />
      </div>

      {/* Static backdrop that fades in after frames complete */}
      <div
        ref={backdropRef}
        className="fixed inset-0 z-[1] pointer-events-none opacity-0"
        style={{
          background: `radial-gradient(circle at 50% 0%, #1a1714 0%, #0a0a09 70%),
                       repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 4px)`,
          backgroundColor: '#0a0a09',
        }}
      />
    </>
  );
}
