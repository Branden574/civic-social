'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { FrameCanvas } from './frame-canvas';
import './landing-styles.css';

/* ─── 3D tilt handler for glass cards ─── */
function useCardTilt() {
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rx = ((y - cy) / cy) * -4;
    const ry = ((x - cx) / cx) * 4;
    el.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1.01, 1.01, 1.01)`;
  }, []);
  const onMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = 'perspective(1200px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
  }, []);
  return { onMouseMove, onMouseLeave };
}

/* ═══════════════════════════════════════════════════════════════
   CivicLanding — Full from-scratch landing page
   ═══════════════════════════════════════════════════════════════ */
export function CivicLanding() {
  const [loading, setLoading] = useState(true);
  const [loadPct, setLoadPct] = useState(0);
  const [isTouch, setIsTouch] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const lastScrollY = useRef(0);
  const tilt = useCardTilt();
  const tiltProps = isTouch ? {} : tilt;

  useEffect(() => {
    setIsTouch(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  /* ── Lock body scroll when mobile menu is open ── */
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  /* ── Hero parallax + nav hide on scroll ── */
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const vh = window.innerHeight;

      // Hero fade — hide overlay completely once fully faded
      if (heroRef.current) {
        const fade = Math.max(0, 1 - y / (vh * 0.6));
        heroRef.current.style.opacity = String(fade);
        heroRef.current.style.transform = `translateY(${-y * 0.15}px) scale(${1 - y * 0.0005})`;
        heroRef.current.style.pointerEvents = fade < 0.05 ? 'none' : 'auto';
      }
      if (overlayRef.current) {
        const fade = Math.max(0, 1 - y / (vh * 0.6));
        overlayRef.current.style.visibility = fade < 0.01 ? 'hidden' : 'visible';
      }

      // Nav hide/show
      if (navRef.current) {
        if (y > lastScrollY.current && y > 100) {
          navRef.current.classList.add('nav-hidden');
        } else {
          navRef.current.classList.remove('nav-hidden');
        }
      }
      lastScrollY.current = y;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── Intersection Observer for reveals ── */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    document.querySelectorAll('.civic-reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [loading]);

  return (
    <div className="civic-landing">
      {/* ── Loader ── */}
      {loading && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--ink)]">
          <div className="landing-serif-title text-xl uppercase tracking-[0.3em] text-[var(--cream)] mb-8">
            Civic Social
          </div>
          <div className="w-48 h-[2px] bg-[var(--ink-light)] rounded overflow-hidden">
            <div
              className="h-full bg-[var(--accent-gold)] transition-[width] duration-200"
              style={{ width: `${loadPct * 100}%` }}
            />
          </div>
          <div className="text-xs text-[var(--cream-dim)] mt-4 tracking-widest uppercase">
            Loading Platform...
          </div>
        </div>
      )}

      {/* ── Frame Canvas (z-0) ── */}
      <FrameCanvas
        onLoadProgress={setLoadPct}
        onLoaded={() => setLoading(false)}
      />

      {/* ── Noise Overlay (z-15) ── */}
      <div className="civic-noise" />

      {/* ── Hero Overlay (z-10, fixed — hidden via visibility when scrolled past) ── */}
      <div ref={overlayRef} className="civic-hero-overlay">
        <div ref={heroRef} className="civic-hero-content">
          <h1 className="civic-hero-h1">Smarter Civic Discourse</h1>
          <p className="civic-hero-lead">
            A dedicated platform for legislation awareness, structured civic
            discussion, and informed public engagement. Leave the noise behind.
          </p>
        </div>
      </div>

      {/* ── Navigation (z-100) ── */}
      <nav ref={navRef} className="civic-nav">
        <div className="civic-nav-inner">
          <Link href="/" className="civic-nav-logo">
            Civic Social
          </Link>
          <div className="civic-nav-links">
            <Link href="#features" className="civic-nav-link">Features</Link>
            <Link href="#how-it-works" className="civic-nav-link">Workflow</Link>
            <Link href="#trust" className="civic-nav-link">Trust</Link>
            <Link href="#pricing" className="civic-nav-link">Access</Link>
          </div>
          <div className="civic-nav-auth">
            <Link href="/login" className="civic-nav-link">Sign In</Link>
            <Link href="/register" className="civic-btn civic-btn-sm">
              Create Account
            </Link>
          </div>
          {/* Hamburger — visible only on mobile */}
          <button
            className={`civic-hamburger ${mobileMenuOpen ? 'is-open' : ''}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            <span className="civic-hamburger-line" />
            <span className="civic-hamburger-line" />
            <span className="civic-hamburger-line" />
          </button>
        </div>
      </nav>

      {/* ── Mobile Menu Overlay ── */}
      <div
        className={`civic-mobile-menu ${mobileMenuOpen ? 'is-open' : ''}`}
        onClick={(e) => { if (e.target === e.currentTarget) setMobileMenuOpen(false); }}
      >
        <div className="civic-mobile-menu-content">
          <div className="civic-mobile-menu-links">
            <Link href="#features" className="civic-mobile-link" onClick={() => setMobileMenuOpen(false)}>Features</Link>
            <Link href="#how-it-works" className="civic-mobile-link" onClick={() => setMobileMenuOpen(false)}>Workflow</Link>
            <Link href="#trust" className="civic-mobile-link" onClick={() => setMobileMenuOpen(false)}>Trust</Link>
            <Link href="#pricing" className="civic-mobile-link" onClick={() => setMobileMenuOpen(false)}>Access</Link>
          </div>
          <div className="civic-mobile-menu-auth">
            <Link href="/login" className="civic-btn civic-btn-outline w-full justify-center" onClick={() => setMobileMenuOpen(false)}>
              Sign In
            </Link>
            <Link href="/register" className="civic-btn w-full justify-center" onClick={() => setMobileMenuOpen(false)}>
              Create Account
            </Link>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          PAGE CONTENT — Scrolls over the hero
          ══════════════════════════════════════════════════════ */}
      <main className="civic-page-root">

        {/* ── FEATURES ── */}
        <section id="features" className="civic-section">
          <div className="civic-container">
            <div className="civic-editorial">
              {/* Left — Copy */}
              <div className="civic-reveal">
                <span className="civic-eyebrow">Core Features</span>
                <h2 className="civic-sec-title">Engineered for Clarity</h2>
                <p className="civic-sec-desc">
                  Every tool is purpose-built to surface signal, reduce noise,
                  and ground discourse in verifiable fact — not algorithmic
                  engagement.
                </p>
              </div>

              {/* Right — Cards */}
              <div className="flex flex-col gap-6">
                {[
                  ['Legislation Awareness', 'Track bills from introduction to vote with AI-powered plain-language summaries. Always know what\'s actually in the law.'],
                  ['Issue-Based Discovery', 'Follow policies, not personalities. Organize your feed around the issues that matter — healthcare, climate, housing, education.'],
                  ['Structured Discourse', 'Filtered debate with logical argument structures. Civility scoring and source requirements keep conversations productive.'],
                ].map(([title, desc], i) => (
                  <div
                    key={title}
                    className={`civic-glass-card civic-reveal civic-delay-${i + 1}`}
                    {...tiltProps}
                  >
                    <h3 className="civic-card-title">{title}</h3>
                    <p className="civic-card-text">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how-it-works" className="civic-section">
          <div className="civic-container">
            <div className="text-center mb-16 civic-reveal">
              <span className="civic-eyebrow">Workflow</span>
              <h2 className="civic-sec-title">From Observation to Action</h2>
            </div>
            <div className="civic-step-grid">
              {[
                ['01', 'Discover Issues', 'Browse verified news, legislation updates, and community discussions organized by policy area.'],
                ['02', 'Follow Legislation', 'Track bills from introduction through committee, floor vote, and enactment with real-time status updates.'],
                ['03', 'Join Discussion', 'Engage in structured discourse with civility scoring, source requirements, and cross-party dialogue.'],
                ['04', 'Stay Informed', 'Receive alerts on bills, community activity, and policy changes that affect the issues you follow.'],
              ].map(([num, title, desc], i) => (
                <div
                  key={num}
                  className={`civic-glass-card civic-reveal ${i > 0 ? `civic-delay-${i}` : ''}`}
                  style={{ padding: '2rem' }}
                >
                  <div className="civic-step-number">{num}</div>
                  <h3 className="civic-step-title">{title}</h3>
                  <p className="civic-step-desc">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TRUST ── */}
        <section id="trust" className="civic-section">
          <div className="civic-container">
            <div className="civic-editorial">
              {/* Left — Visual */}
              <div className="civic-reveal">
                <div className="civic-glass-card civic-trust-visual">
                  <div className="civic-trust-pulse" />
                  <div className="civic-trust-text">
                    SIGNAL<br />OVER<br />NOISE
                  </div>
                </div>
              </div>

              {/* Right — Copy */}
              <div className="civic-reveal civic-delay-1">
                <span className="civic-eyebrow">Trust &amp; Integrity</span>
                <h2 className="civic-sec-title">
                  A Better Standard for Engagement
                </h2>
                <ul className="space-y-4 mt-6">
                  {[
                    ['Verified Identity', 'Multi-tier verification tied to professional credentials, not just payment. Know who you\'re engaging with.'],
                    ['Contextual Transparency', 'Every ranking signal is published. See exactly why content appears in your feed — no black boxes.'],
                    ['Structural Civility', 'Proactive protections, not reactive bans. Conversation health monitoring with de-escalation built in.'],
                  ].map(([title, desc]) => (
                    <li key={title} className="pl-6 relative">
                      <span className="absolute left-0 top-[2px] text-[var(--accent-gold)]">&#9657;</span>
                      <strong className="text-[var(--cream)] font-medium">{title}</strong>
                      <p className="text-sm text-[var(--cream-dim)] mt-1 leading-relaxed">{desc}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section id="pricing" className="civic-section">
          <div className="civic-container">
            <div className="text-center mb-16 civic-reveal">
              <span className="civic-eyebrow">Access the Platform</span>
              <h2 className="civic-sec-title">Transparent Pricing</h2>
            </div>
            <div className="civic-pricing-grid">
              {/* Citizen — Free */}
              <div className="civic-pricing-card civic-reveal" {...tiltProps}>
                <p className="civic-pricing-tier">Citizen</p>
                <div className="civic-pricing-price">
                  $0<span>/mo</span>
                </div>
                <ul className="civic-pricing-features">
                  <li>Track local &amp; state bills</li>
                  <li>Read neutral AI summaries</li>
                  <li>View representative voting records</li>
                  <li>Read-only access to debates</li>
                </ul>
                <Link href="/register" className="civic-btn civic-btn-outline w-full justify-center">
                  Create Free Account
                </Link>
              </div>

              {/* Professional — $12/mo */}
              <div className="civic-pricing-card civic-reveal civic-delay-1" {...tiltProps}>
                <p className="civic-pricing-tier" style={{ color: 'var(--accent-gold)' }}>
                  Professional
                </p>
                <div className="civic-pricing-price">
                  $12<span>/mo</span>
                </div>
                <ul className="civic-pricing-features">
                  <li>Federal, State &amp; Local tracking</li>
                  <li>Participate in structured debate</li>
                  <li>Advanced AI legal parsing</li>
                  <li>Direct constituent routing</li>
                  <li>Verified identity badge</li>
                </ul>
                <Link href="/register" className="civic-btn w-full justify-center">
                  Start Professional Trial
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section id="access" className="civic-section civic-section-short">
          <div className="civic-container text-center civic-reveal">
            <h2 className="civic-sec-title">Join the Discussion</h2>
            <p className="civic-sec-desc mx-auto text-center">
              A civic platform that takes the public seriously. Real legislation,
              real discourse, real accountability.
            </p>
            <div className="civic-hero-actions mt-8">
              <Link href="/register" className="civic-btn">
                Create Account
              </Link>
              <Link href="/login" className="civic-btn civic-btn-outline">
                Sign In
              </Link>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="civic-footer">
          <div className="civic-footer-logo">Civic Social</div>
          <div className="civic-footer-links">
            <Link href="/safety">Terms of Service</Link>
            <Link href="/safety">Privacy Policy</Link>
            <Link href="/contact">Contact</Link>
          </div>
          <p className="civic-footer-copy">
            &copy; 2026 Civic Social Technologies. Smarter civic discourse.
          </p>
        </footer>
      </main>
    </div>
  );
}
