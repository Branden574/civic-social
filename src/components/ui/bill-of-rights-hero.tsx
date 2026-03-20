'use client';

import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import React, { Component, useRef, Suspense } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/utils';

/* ── Error Boundary for WebGL Canvas ── */
class CanvasErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('3D hero failed to render:', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

/* ── Types ── */
interface BillOfRightsHeroProps {
  rotationSpeed?: number;
  documentScale?: [number, number];
  textureSrc?: string;
  className?: string;
  children?: React.ReactNode;
}

/* ── 3D Rotating Document ── */
const RotatingDocument: React.FC<{
  rotationSpeed: number;
  scale: [number, number];
  textureSrc: string;
}> = ({ rotationSpeed, scale, textureSrc }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const texture = useLoader(THREE.TextureLoader, textureSrc);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += rotationSpeed;
      meshRef.current.rotation.x += rotationSpeed * 0.15;
      meshRef.current.rotation.z += rotationSpeed * 0.05;
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[scale[0], scale[1]]} />
      <meshStandardMaterial
        map={texture}
        transparent
        opacity={0.4}
        side={THREE.DoubleSide}
        roughness={0.85}
        metalness={0.0}
      />
    </mesh>
  );
};

/* ── Hero Section with 3D Background ── */
const BillOfRightsHero = React.forwardRef<HTMLDivElement, BillOfRightsHeroProps>(
  (
    {
      rotationSpeed = 0.003,
      documentScale = [4.5, 6],
      textureSrc = '/bill-of-rights.jpg',
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'relative w-full min-h-screen overflow-hidden',
          className
        )}
        {...props}
      >
        {/* Foreground content (above the 3D canvas) */}
        <div className="relative z-10 flex flex-col items-center justify-center">
          {children}
        </div>

        {/* 3D Canvas background — gracefully degrades if WebGL unavailable */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <CanvasErrorBoundary>
            <Suspense fallback={null}>
              <Canvas>
                <PerspectiveCamera makeDefault position={[0, 0, 5.5]} fov={75} />
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={0.6} />
                <directionalLight position={[-5, 5, 5]} intensity={0.3} />
                <RotatingDocument
                  rotationSpeed={rotationSpeed}
                  scale={documentScale}
                  textureSrc={textureSrc}
                />
              </Canvas>
            </Suspense>
          </CanvasErrorBoundary>
        </div>
      </div>
    );
  }
);

BillOfRightsHero.displayName = 'BillOfRightsHero';

export { BillOfRightsHero, type BillOfRightsHeroProps };
