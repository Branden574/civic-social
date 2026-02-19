'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, Shield, Scale, Newspaper, Lock } from 'lucide-react';

// ─── Landing Navbar ──────────────────────────────────────────

function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="relative z-10 w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-[120px] py-4 h-auto lg:h-[102px] flex items-center justify-between">
      {/* Logo */}
      <div className="flex items-center gap-10 lg:gap-20">
        <Link href="/" className="flex items-center gap-2">
          <Shield className="w-7 h-7 text-white" />
          <span className="text-white font-bold text-lg tracking-tight">
            Civic Social
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden lg:flex items-center gap-8">
          {[
            { label: 'Home', href: '#' },
            { label: 'How it Works', href: '#how-it-works', hasDropdown: true },
            { label: 'Credibility', href: '#credibility' },
            { label: 'Safety', href: '#safety' },
            { label: 'Contact', href: '#contact' },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="flex items-center gap-[3px] text-sm font-medium text-white/90 hover:text-white transition-colors py-1 px-2.5"
              style={{ fontFamily: 'Manrope, Inter, sans-serif' }}
            >
              {link.label}
              {link.hasDropdown && <ChevronDown className="w-4 h-4" />}
            </a>
          ))}
        </div>
      </div>

      {/* Desktop buttons */}
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
            {['Home', 'How it Works', 'Credibility', 'Safety', 'Contact'].map((label) => (
              <a
                key={label}
                href="#"
                className="block text-sm font-medium text-white/80 hover:text-white py-2"
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </a>
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

// ─── Feature Cards ───────────────────────────────────────────

const FEATURES = [
  {
    icon: Shield,
    title: 'Credibility Scoring',
    desc: 'Every user earns a credibility score based on sourced, civil engagement — not likes or virality.',
  },
  {
    icon: Scale,
    title: 'Live Legislation Tracker',
    desc: 'Follow real bills in Congress from introduction to vote, with plain-language summaries and community analysis.',
  },
  {
    icon: Newspaper,
    title: 'Trusted News Threads',
    desc: 'Discuss breaking news with source-quality scoring and fact-check overlays — no clickbait amplification.',
  },
  {
    icon: Lock,
    title: 'Safety & Privacy First',
    desc: 'No ad tracking, no rage algorithms, no data sales. Moderated for civility with transparent rules.',
  },
];

// ─── Landing Page ────────────────────────────────────────────

export function LandingPage() {
  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      {/* Landing-specific fonts */}
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@1&family=Manrope:wght@400;500;600;700&display=swap');` }} />
      {/* ── Background video ── */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        poster="/landing-poster.jpg"
        className="absolute inset-0 w-[120%] h-[120%] object-cover object-bottom -translate-x-[8.3%] z-0 opacity-40"
      >
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260215_121759_424f8e9c-d8bd-4974-9567-52709dfb6842.mp4"
          type="video/mp4"
        />
      </video>

      {/* ── Blurred background pill ── */}
      <div
        className="absolute top-[215px] left-1/2 -translate-x-1/2 w-[801px] h-[384px] rounded-full bg-black z-[1]"
        style={{ filter: 'blur(77.5px)' }}
      />

      {/* ── Content (above video + blur) ── */}
      <div className="relative z-[2]">
        <LandingNav />

        {/* ── Hero section ── */}
        <section className="flex flex-col items-center text-center px-6 mt-16 sm:mt-24 lg:mt-[162px]">
          <div className="max-w-[871px] flex flex-col gap-6">
            {/* Heading block */}
            <div className="flex flex-col gap-2.5">
              <h1 className="text-4xl sm:text-5xl lg:text-[76px] font-medium leading-[1.05] text-white tracking-tight">
                Debate with clarity.
              </h1>
              <h2
                className="text-4xl sm:text-5xl lg:text-[76px] leading-[1.05] text-white tracking-tight"
                style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: 'italic' }}
              >
                Build common ground.
              </h2>
            </div>

            {/* Subtitle */}
            <p
              className="text-base sm:text-lg leading-relaxed text-[#f6f7f9]/90 max-w-[613px] mx-auto"
              style={{ fontFamily: 'Manrope, Inter, sans-serif' }}
            >
              The platform where civil political discussions meet credibility scoring,
              live legislation tracking, trusted news threads, and privacy-first protections.
              No rage algorithms. No echo chambers. Just real civic discourse.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-[22px] mt-2">
              <Link
                href="/register"
                className="w-full sm:w-auto text-base font-semibold text-white bg-[#7b39fc] px-8 py-3.5 rounded-xl hover:bg-[#6a2de0] transition-all shadow-xl shadow-[#7b39fc]/30 min-h-[48px] flex items-center justify-center"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </section>

        {/* ── Dashboard preview ── */}
        <section className="flex justify-center px-6 mt-16 sm:mt-20 lg:mt-20 pb-10">
          <div
            className="w-full max-w-[1163px] rounded-3xl p-[22.5px]"
            style={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1.5px solid rgba(255,255,255,0.1)',
            }}
          >
            <div className="w-full rounded-lg bg-gradient-to-br from-[#1a1a2e] to-[#16213e] overflow-hidden">
              <div className="p-6 sm:p-10 space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-400/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
                  <div className="w-3 h-3 rounded-full bg-green-400/80" />
                  <span className="text-xs text-white/30 ml-4 font-mono">civicsocial.com</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="text-[10px] font-semibold text-[#7b39fc] uppercase tracking-wider mb-2">Credibility Score</div>
                    <div className="text-2xl font-bold text-white">89</div>
                    <div className="text-xs text-white/50 mt-1">Top 12% of users</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-2">Live Bills</div>
                    <div className="text-2xl font-bold text-white">47</div>
                    <div className="text-xs text-white/50 mt-1">Bills you&apos;re tracking</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-2">Civility Rating</div>
                    <div className="text-2xl font-bold text-white">94%</div>
                    <div className="text-xs text-white/50 mt-1">Based on 156 discussions</div>
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-[#7b39fc]/30 flex items-center justify-center text-xs font-bold text-white">SC</div>
                    <div>
                      <div className="text-sm font-semibold text-white">Sarah Chen</div>
                      <div className="text-[10px] text-white/40">Expert Verified · Credibility 92</div>
                    </div>
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed">
                    New analysis: How the proposed healthcare bill compares to existing single-payer systems worldwide. Data from 12 OECD countries included.
                  </p>
                  <div className="flex gap-4 mt-3">
                    <span className="text-xs text-white/30">42 agrees</span>
                    <span className="text-xs text-white/30">18 replies</span>
                    <span className="text-xs text-white/30">5 sources cited</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Feature cards ── */}
        <section className="max-w-[1163px] mx-auto px-6 pb-20 sm:pb-28">
          <h3 className="text-center text-2xl sm:text-3xl font-bold text-white mb-12">
            Why Civic Social?
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl p-6 border border-white/10"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                <f.icon className="w-8 h-8 text-[#7b39fc] mb-4" />
                <h4 className="text-base font-semibold text-white mb-2">{f.title}</h4>
                <p className="text-sm text-white/60 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-white/10 py-8 px-6">
          <div className="max-w-[1163px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Civic Social v0.2.0</span>
            </div>
            <p>No rage amplification · No echo chambers · No ad tracking</p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-white/60">Privacy</a>
              <a href="#" className="hover:text-white/60">Terms</a>
              <a href="#" className="hover:text-white/60">Contact</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
