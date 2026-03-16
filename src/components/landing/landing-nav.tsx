'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'Trust', href: '/safety' },
  { label: 'Pricing', href: '#pricing' },
];

export function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-[1000] flex justify-center pt-4 px-4 sm:px-8">
      <div
        className={`flex items-center w-full max-w-[1120px] h-14 px-6 rounded-2xl transition-all duration-300 ${
          scrolled
            ? 'bg-[#f5f5f5]/95 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)]'
            : 'bg-[#f5f5f5] shadow-[0_4px_20px_rgba(0,0,0,0.1)]'
        }`}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#1a1a1a]">
            <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="currentColor" />
          </svg>
          <span className="font-bold text-xl text-[#1a1a1a]">Civic Social</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-8 ml-10">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-base text-[#1a1a1a] hover:text-[#1a1a1a]/70 transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Desktop auth */}
        <div className="hidden lg:flex items-center gap-3 ml-auto">
          <Link
            href="/login"
            className="px-6 py-2.5 rounded-lg text-base font-medium border border-[#d1d5db] text-[#1a1a1a] hover:bg-black/5 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-6 py-2.5 rounded-lg text-base font-medium bg-[#1a1a1a] text-white hover:bg-[#333] transition-colors"
          >
            Create Account
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="lg:hidden ml-auto p-2 text-[#1a1a1a]"
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
        <div className="fixed top-20 left-4 right-4 bg-[#f5f5f5] rounded-2xl shadow-lg px-6 pt-4 pb-5 z-[999]">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="block py-3 text-base font-medium text-[#1a1a1a] border-b border-[#e5e5e5] hover:text-[#1a1a1a]/70 transition-colors"
            >
              {l.label}
            </Link>
          ))}
          <div className="flex gap-3 mt-4">
            <Link
              href="/login"
              className="flex-1 text-center px-4 py-2.5 rounded-lg text-sm font-medium border border-[#d1d5db] text-[#1a1a1a] hover:bg-black/5 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="flex-1 text-center px-4 py-2.5 rounded-lg text-sm font-medium bg-[#1a1a1a] text-white hover:bg-[#333] transition-colors"
            >
              Create Account
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
