'use client';

// ═══════════════════════════════════════════════════════════════
// Civic Social — Premium Splash Screen
// ═══════════════════════════════════════════════════════════════
//
// Shows during cold start while auth session loads and the first
// feed request is in flight. Crossfades smoothly into content.
// Dark/light mode aware. Reduced-motion safe.
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';

interface SplashScreenProps {
  /** Set to true once the app is ready (auth resolved, initial data loaded) */
  ready: boolean;
  children: React.ReactNode;
}

export function SplashScreen({ ready, children }: SplashScreenProps) {
  const [phase, setPhase] = useState<'splash' | 'fading' | 'done'>('splash');

  useEffect(() => {
    if (ready && phase === 'splash') {
      // Start crossfade
      setPhase('fading');
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
      {/* Content layer (behind splash, already rendering) */}
      <div
        className="transition-opacity duration-500 ease-out"
        style={{ opacity: phase === 'fading' ? 1 : 0 }}
        aria-hidden={phase === 'splash'}
      >
        {children}
      </div>

      {/* Splash overlay */}
      <div
        className={`fixed inset-0 z-[9998] flex items-center justify-center bg-bg transition-opacity duration-500 ease-out ${
          phase === 'fading' ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        role="status"
        aria-label="Loading Civic Social"
      >
        <div className="flex flex-col items-center gap-6">
          {/* Brand mark — animated */}
          <div className="splash-logo relative">
            <svg
              width="56"
              height="56"
              viewBox="0 0 56 56"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="splash-logo-svg"
            >
              {/* Shield shape */}
              <path
                d="M28 4L6 14v14c0 12.4 9.4 23.6 22 26 12.6-2.4 22-13.6 22-26V14L28 4z"
                className="fill-civic/20 stroke-civic"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Checkmark inside shield */}
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

            {/* Glow ring */}
            <div className="absolute inset-0 rounded-full splash-glow" />
          </div>

          {/* Brand text */}
          <div className="text-center splash-text">
            <h1 className="text-xl font-bold text-text-primary tracking-tight">
              Civic Social
            </h1>
            <p className="text-xs text-text-muted mt-1">
              Civil discourse, evidence-based debate
            </p>
          </div>

          {/* Loading shimmer bar */}
          <div className="w-32 h-1 rounded-full overflow-hidden bg-surface-elevated">
            <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-civic/0 via-civic to-civic/0 splash-shimmer" />
          </div>
        </div>
      </div>
    </>
  );
}
