'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'Trust', href: '/safety' },
  { label: 'Pricing', href: '#pricing' },
];

export function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      ref={navRef}
      className={`fixed top-0 left-0 right-0 z-[1000] py-4 transition-all duration-200 ${
        scrolled ? 'bg-bg/90 backdrop-blur-xl border-b border-border-subtle' : ''
      }`}
    >
      <div className="flex items-center max-w-6xl mx-auto px-8 gap-8">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 flex-shrink-0 font-extrabold text-lg tracking-tight text-text-primary"
        >
          <span className="text-civic-light text-xl">◈</span>
          Civic Social
        </Link>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-8 ml-4">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-sm font-medium text-text-muted hover:text-text-primary transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Desktop auth */}
        <div className="hidden lg:flex items-center gap-3 ml-auto">
          <Link
            href="/login"
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-border-strong text-text-primary hover:bg-surface-hover transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-civic text-white hover:bg-civic-dark transition-colors"
          >
            Create Account
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="lg:hidden ml-auto p-2 text-text-primary"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="bg-bg/97 backdrop-blur-xl border-b border-border-subtle px-8 pt-4 pb-5">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="block py-3 text-base font-medium text-text-muted border-b border-border-subtle hover:text-text-primary transition-colors"
            >
              {l.label}
            </Link>
          ))}
          <div className="flex gap-3 mt-4">
            <Link
              href="/login"
              className="flex-1 text-center px-4 py-2.5 rounded-xl text-sm font-semibold border border-border-strong text-text-primary hover:bg-surface-hover transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="flex-1 text-center px-4 py-2.5 rounded-xl text-sm font-semibold bg-civic text-white hover:bg-civic-dark transition-colors"
            >
              Create Account
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
