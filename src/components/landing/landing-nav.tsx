'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Shield } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'How it Works', href: '/how-it-works' },
  { label: 'Credibility', href: '/credibility' },
  { label: 'Safety', href: '/safety' },
  { label: 'Contact', href: '/contact' },
];

export function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="relative z-10 w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-[120px] py-4 h-auto lg:h-[102px] flex items-center justify-between">
      {/* Logo */}
      <div className="flex items-center gap-10 lg:gap-20">
        <Link href="/" className="flex items-center gap-2">
          <Shield className="w-7 h-7 text-white" />
          <span className="text-white font-bold text-lg tracking-tight">Civic Social</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden lg:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-white/90 hover:text-white transition-colors py-1 px-2.5"
              style={{ fontFamily: 'Manrope, Inter, sans-serif' }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Desktop auth buttons */}
      <div className="hidden lg:flex items-center gap-3">
        <Link
          href="/login"
          className="text-sm font-semibold text-white bg-white/10 border border-white/20 px-5 py-2.5 rounded-lg hover:bg-white/20 transition-all"
        >
          Sign In
        </Link>
        <Link
          href="/register"
          className="text-sm font-semibold text-white bg-[#7b39fc] px-5 py-2.5 rounded-lg hover:bg-[#6a2de0] transition-all shadow-lg shadow-[#7b39fc]/25"
        >
          Get Started
        </Link>
      </div>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="lg:hidden p-2 text-white"
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

      {/* Mobile menu */}
      {menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/10 lg:hidden z-50">
          <div className="px-6 py-4 space-y-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="block text-sm font-medium text-white/80 hover:text-white py-2"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex gap-3 pt-3 border-t border-white/10">
              <Link href="/login" className="flex-1 text-center text-sm font-semibold text-white bg-white/10 border border-white/20 py-2.5 rounded-lg">
                Sign In
              </Link>
              <Link href="/register" className="flex-1 text-center text-sm font-semibold text-white bg-[#7b39fc] py-2.5 rounded-lg">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
