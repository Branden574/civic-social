import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ─── Server-only env vars ────────────────────────────────────
  // These are NEVER exposed to the client bundle.
  // Only NEXT_PUBLIC_* vars are client-accessible (we use NONE).
  serverExternalPackages: [],

  // ─── Security headers (belt+suspenders with middleware) ──────
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-DNS-Prefetch-Control', value: 'off' },
      ],
    },
    {
      // Cache-Control for API routes: no caching of authenticated responses
      source: '/api/(.*)',
      headers: [
        { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
        { key: 'Pragma', value: 'no-cache' },
        { key: 'Expires', value: '0' },
      ],
    },
    {
      // Static assets: aggressive caching
      source: '/_next/static/(.*)',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      ],
    },
  ],

  // ─── Powered-by header removal ───────────────────────────────
  poweredByHeader: false,

  // ─── Strict mode for React ───────────────────────────────────
  reactStrictMode: true,

  // ─── Image security ──────────────────────────────────────────
  images: {
    // Only allow images from trusted domains
    remotePatterns: [
      { protocol: 'https', hostname: '*.civicsocial.com' },
    ],
    // Disable dangerous SVG rendering
    dangerouslyAllowSVG: false,
  },

  // ─── Logging: reduce info leakage ────────────────────────────
  logging: {
    fetches: {
      fullUrl: false,
    },
  },

  // ─── Experimental security features ──────────────────────────
  experimental: {
    // Server actions: restricted to same-origin
    serverActions: {
      allowedOrigins: ['civicsocial.com', 'www.civicsocial.com'],
    },
  },
};

export default nextConfig;
