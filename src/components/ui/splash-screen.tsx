'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════
   App Shell Splash Screen (wrapper-style)
   Used by AppShell to show loading state during cold start.
   ═══════════════════════════════════════════════════════════════ */

interface SplashScreenProps {
  /** Set to true once the app is ready (auth resolved, initial data loaded) */
  ready: boolean;
  children: React.ReactNode;
}

export function SplashScreen({ ready, children }: SplashScreenProps) {
  const [phase, setPhase] = useState<'splash' | 'fading' | 'done'>('splash');

  useEffect(() => {
    if (phase === 'splash' && ready) {
      setPhase('fading');
    }
    if (phase === 'fading') {
      const timer = setTimeout(() => setPhase('done'), 500);
      return () => clearTimeout(timer);
    }
  }, [ready, phase]);

  // Safety: auto-dismiss splash after 4s even if ready never fires
  useEffect(() => {
    const safety = setTimeout(() => {
      if (phase === 'splash') setPhase('fading');
    }, 4000);
    return () => clearTimeout(safety);
  }, [phase]);

  if (phase === 'done') return <>{children}</>;

  return (
    <>
      <div
        className="transition-opacity duration-500 ease-out"
        style={{ opacity: phase === 'fading' ? 1 : 0 }}
        aria-hidden
      >
        {children}
      </div>

      <div
        className={`fixed inset-0 z-[9998] flex items-center justify-center bg-bg transition-opacity duration-500 ease-out ${
          phase === 'fading' ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        role="status"
        aria-label="Loading Civic Social"
      >
        <div className="flex flex-col items-center gap-6">
          <div className="splash-logo relative">
            <svg
              width="56"
              height="56"
              viewBox="0 0 56 56"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="splash-logo-svg"
            >
              <path
                d="M28 4L6 14v14c0 12.4 9.4 23.6 22 26 12.6-2.4 22-13.6 22-26V14L28 4z"
                className="fill-civic/20 stroke-civic"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M18 28l7 7 13-13"
                className="stroke-civic-light"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 40,
                  strokeDashoffset: 40,
                  animation: 'splash-check 0.6s 0.3s ease-out forwards',
                }}
              />
            </svg>
            <div className="absolute inset-0 rounded-full splash-glow" />
          </div>

          <div className="text-center splash-text">
            <h1 className="text-xl font-bold text-text-primary tracking-tight">
              Civic Social
            </h1>
            <p className="text-xs text-text-muted mt-1">
              Civil discourse, evidence-based debate
            </p>
          </div>

          <div className="w-32 h-1 rounded-full overflow-hidden bg-surface-elevated">
            <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-civic/0 via-civic to-civic/0 splash-shimmer" />
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Video Splash Screen (standalone)
   Used on the landing page for a cinematic intro.
   ═══════════════════════════════════════════════════════════════ */

interface VideoSplashProps {
  videoSrc?: string;
  minDisplayTime?: number;
  onComplete: () => void;
  className?: string;
}

export function VideoSplash({
  videoSrc = '/video/hero.mp4',
  minDisplayTime = 2500,
  onComplete,
  className,
}: VideoSplashProps) {
  const [isFading, setIsFading] = useState(false);
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);

  const startFadeOut = useCallback(() => {
    if (isFading) return;
    setIsFading(true);
    setTimeout(onComplete, 800);
  }, [isFading, onComplete]);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimePassed(true), minDisplayTime);
    return () => clearTimeout(timer);
  }, [minDisplayTime]);

  useEffect(() => {
    if (minTimePassed && videoEnded) startFadeOut();
  }, [minTimePassed, videoEnded, startFadeOut]);

  // Safety: auto-dismiss after 6s
  useEffect(() => {
    const safety = setTimeout(startFadeOut, 6000);
    return () => clearTimeout(safety);
  }, [startFadeOut]);

  return (
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex items-center justify-center bg-bg transition-opacity duration-700',
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100',
        className
      )}
      role="status"
      aria-label="Loading Civic Social"
    >
      <video
        src={videoSrc}
        autoPlay
        muted
        playsInline
        onEnded={() => setVideoEnded(true)}
        onError={() => setVideoEnded(true)}
        className="w-full h-full object-cover"
      />

    </div>
  );
}
