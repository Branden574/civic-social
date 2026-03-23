'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'Trust', href: '/safety' },
  { label: 'Pricing', href: '#pricing' },
];

export function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 40);

      // Hide nav on scroll down, show on scroll up
      if (y > 100 && y > lastScrollY.current + 10) {
        setNavHidden(true);
      } else if (y < lastScrollY.current - 5) {
        setNavHidden(false);
      }
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[1000] flex justify-center pt-4 px-4 sm:px-8 nav-hide-on-scroll ${
        navHidden && !menuOpen ? 'nav-hidden' : ''
      }`}
    >
      <div
        className={`flex items-center w-full max-w-[1100px] h-14 px-6 rounded-full transition-all duration-300 border ${
          scrolled
            ? 'bg-white/[0.1] backdrop-blur-xl border-white/[0.12] shadow-[0_12px_32px_rgba(0,0,0,0.4)]'
            : 'bg-white/[0.06] backdrop-blur-xl border-white/[0.08] shadow-[0_12px_32px_rgba(0,0,0,0.3)]'
        }`}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <span className="landing-serif-title text-lg text-text-primary tracking-[0.05em] font-normal uppercase">
            Civic Social
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-6 ml-auto mr-6">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-xs text-text-secondary hover:text-text-primary transition-colors uppercase tracking-[0.15em] whitespace-nowrap"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Desktop auth */}
        <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
          <Link
            href="/login"
            className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors uppercase tracking-[0.15em] whitespace-nowrap"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-5 py-2 rounded-sm text-xs font-medium bg-text-primary text-bg hover:bg-text-primary/90 transition-colors uppercase tracking-[0.15em] whitespace-nowrap"
          >
            Create Account
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="lg:hidden ml-auto p-2 text-text-primary"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
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
        <div
          id="mobile-menu"
          role="menu"
          className="fixed top-20 left-4 right-4 landing-glass-card px-6 pt-4 pb-5 z-[999]"
        >
          {NAV_LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="block py-3 text-base font-medium text-text-primary border-b border-white/[0.08] hover:text-civic-light transition-colors"
            >
              {l.label}
            </Link>
          ))}
          <div className="flex flex-col gap-3 mt-4">
            <Link
              href="/register"
              role="menuitem"
              className="w-full text-center px-4 py-3 rounded-sm text-sm font-medium uppercase tracking-[0.1em] bg-text-primary text-bg hover:bg-text-primary/90 transition-colors"
            >
              Create Account
            </Link>
            <Link
              href="/login"
              role="menuitem"
              className="w-full text-center px-4 py-3 rounded-sm text-sm font-medium uppercase tracking-[0.1em] border border-white/[0.15] text-text-primary hover:bg-white/[0.05] transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
