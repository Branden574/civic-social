'use client';

import Link from 'next/link';
import { useState } from 'react';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it Works', href: '/how-it-works' },
  { label: 'Trust', href: '/safety' },
  { label: 'Pricing', href: '#pricing' },
];

export function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        .cs-nav { position:fixed; top:0; left:0; right:0; z-index:1000; transition:background .3s,backdrop-filter .3s,box-shadow .3s; padding:1.25rem 0; }
        .cs-nav.cs-scrolled { background:rgba(9,9,15,.88); backdrop-filter:blur(20px); box-shadow:0 1px 0 rgba(255,255,255,.07); }
        .cs-nav-link { font-size:.9rem; font-weight:500; color:#64748b; transition:color .2s; padding:.25rem 0; }
        .cs-nav-link:hover { color:#f8fafc; }
        .cs-btn-outline { padding:.6rem 1.25rem; border-radius:10px; font-size:.88rem; font-weight:600; border:1.5px solid rgba(255,255,255,.12); color:#f8fafc; background:transparent; transition:all .25s; }
        .cs-btn-outline:hover { border-color:#3b82f6; color:#60a5fa; background:rgba(59,130,246,.08); }
        .cs-btn-primary { padding:.6rem 1.25rem; border-radius:10px; font-size:.88rem; font-weight:600; background:#3b82f6; color:#fff; border:none; transition:all .25s; box-shadow:0 0 18px rgba(59,130,246,.3); }
        .cs-btn-primary:hover { background:#60a5fa; box-shadow:0 0 28px rgba(96,165,250,.45); }
      ` }} />

      <nav
        className="cs-nav"
        ref={(el) => {
          if (!el) return;
          const onScroll = () => el.classList.toggle('cs-scrolled', window.scrollY > 40);
          window.addEventListener('scroll', onScroll, { passive: true });
        }}
      >
        <div className="flex items-center max-w-6xl mx-auto px-8 gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0" style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-.02em', color: '#f8fafc' }}>
            <span style={{ color: '#3b82f6', fontSize: '1.3rem' }}>◈</span>
            Civic Social
          </Link>

          {/* Desktop links */}
          <div className="hidden lg:flex items-center gap-8 ml-4">
            {NAV_LINKS.map(l => (
              <Link key={l.label} href={l.href} className="cs-nav-link">{l.label}</Link>
            ))}
          </div>

          {/* Desktop auth */}
          <div className="hidden lg:flex items-center gap-3 ml-auto">
            <Link href="/login" className="cs-btn-outline">Sign In</Link>
            <Link href="/register" className="cs-btn-primary">Create Account</Link>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden ml-auto p-2 text-white"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div style={{ background: 'rgba(9,9,15,.97)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,.07)', padding: '1rem 2rem 1.5rem' }}>
            {NAV_LINKS.map(l => (
              <Link key={l.label} href={l.href} onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '.75rem 0', fontSize: '1rem', fontWeight: 500, color: '#64748b', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                {l.label}
              </Link>
            ))}
            <div className="flex gap-3 mt-4">
              <Link href="/login" className="cs-btn-outline flex-1 text-center">Sign In</Link>
              <Link href="/register" className="cs-btn-primary flex-1 text-center">Create Account</Link>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
