'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Check, RotateCcw } from 'lucide-react';
import clsx from 'clsx';

interface ImageCropModalProps {
  /** The raw image file to crop */
  imageFile: File;
  /** Aspect ratio: 1 for square avatar, 3 for 3:1 banner */
  aspectRatio: number;
  /** Output dimensions */
  outputWidth: number;
  outputHeight: number;
  /** Quality for output (0-1) */
  quality?: number;
  /** Called with the cropped base64 data URL */
  onCrop: (croppedDataUrl: string) => void;
  /** Called when the modal is dismissed */
  onCancel: () => void;
  /** Label shown in the header */
  title?: string;
}

export function ImageCropModal({
  imageFile,
  aspectRatio,
  outputWidth,
  outputHeight,
  quality = 0.85,
  onCrop,
  onCancel,
  title = 'Crop Image',
}: ImageCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);

  // Pan & zoom state
  const [zoom, setZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(0.1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startOffX: 0, startOffY: 0 });

  // Load image from file
  useEffect(() => {
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
    };
    reader.readAsDataURL(imageFile);
  }, [imageFile]);

  // Create image element once loaded
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.onload = () => {
      setImageEl(img);
      // Fit image so it covers the crop area
      const container = containerRef.current;
      if (container) {
        const cropW = container.clientWidth;
        const cropH = cropW / aspectRatio;
        const scaleX = cropW / img.width;
        const scaleY = cropH / img.height;
        const fitZoom = Math.max(scaleX, scaleY);
        setMinZoom(fitZoom);
        setZoom(fitZoom);
        setOffset({ x: 0, y: 0 });
      }
    };
    img.src = imageSrc;
  }, [imageSrc, aspectRatio]);

  // Draw preview on canvas
  useEffect(() => {
    if (!imageEl || !canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const cropW = container.clientWidth;
    const cropH = cropW / aspectRatio;
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, cropW, cropH);

    const drawW = imageEl.width * zoom;
    const drawH = imageEl.height * zoom;
    const dx = (cropW - drawW) / 2 + offset.x;
    const dy = (cropH - drawH) / 2 + offset.y;

    ctx.drawImage(imageEl, dx, dy, drawW, drawH);
  }, [imageEl, zoom, offset, aspectRatio]);

  // Mouse/touch drag handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startOffX: offset.x,
      startOffY: offset.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [offset]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset({
      x: dragRef.current.startOffX + dx,
      y: dragRef.current.startOffY + dy,
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  // Zoom with scroll wheel
  const maxZoom = Math.max(minZoom * 5, 3);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => Math.max(minZoom, Math.min(maxZoom, prev - e.deltaY * 0.001)));
  }, [minZoom, maxZoom]);

  const handleReset = () => {
    setZoom(minZoom);
    setOffset({ x: 0, y: 0 });
  };

  // Produce cropped output
  const handleConfirm = useCallback(() => {
    if (!imageEl || !containerRef.current) return;
    const container = containerRef.current;
    const cropW = container.clientWidth;
    const cropH = cropW / aspectRatio;

    const drawW = imageEl.width * zoom;
    const drawH = imageEl.height * zoom;
    const dx = (cropW - drawW) / 2 + offset.x;
    const dy = (cropH - drawH) / 2 + offset.y;

    // Map crop area back to source image coordinates
    const srcX = -dx / zoom;
    const srcY = -dy / zoom;
    const srcW = cropW / zoom;
    const srcH = cropH / zoom;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = outputWidth;
    outCanvas.height = outputHeight;
    const ctx = outCanvas.getContext('2d')!;
    ctx.drawImage(imageEl, srcX, srcY, srcW, srcH, 0, 0, outputWidth, outputHeight);

    onCrop(outCanvas.toDataURL('image/webp', quality));
  }, [imageEl, zoom, offset, aspectRatio, outputWidth, outputHeight, quality, onCrop]);

  if (!imageSrc) return null;

  const isSquare = aspectRatio === 1;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md mx-4 bg-surface-elevated border border-border-subtle rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <h2 className="text-sm font-bold text-text-primary">{title}</h2>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Crop area */}
        <div
          ref={containerRef}
          className="relative mx-4 my-4 overflow-hidden bg-black/90 select-none"
          style={{
            borderRadius: isSquare ? '50%' : '12px',
            aspectRatio: `${aspectRatio}`,
          }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
          />
          {/* Overlay border to indicate crop boundary */}
          <div
            className="absolute inset-0 pointer-events-none border-2 border-white/30"
            style={{ borderRadius: isSquare ? '50%' : '12px' }}
          />
        </div>

        {/* Zoom slider */}
        <div className="flex items-center justify-center gap-3 px-4 pb-2">
          <span className="text-xs text-text-muted select-none">−</span>
          <input
            type="range"
            min={minZoom}
            max={maxZoom}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-40 h-1.5 accent-civic bg-surface-active rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-civic [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <span className="text-xs text-text-muted select-none">+</span>
          <button
            onClick={handleReset}
            className="p-2 rounded-lg bg-surface border border-border-subtle text-text-secondary hover:bg-surface-hover transition-colors"
            title="Reset"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border-subtle">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-text-secondary bg-surface border border-border-subtle rounded-lg hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-civic rounded-lg hover:bg-civic-dark transition-colors"
          >
            <Check className="w-4 h-4" />
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
