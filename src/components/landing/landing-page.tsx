'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { LandingNav } from '@/components/landing/landing-nav';
import { ScrollRevealObserver } from '@/components/landing/scroll-reveal';

import { VideoSplash } from '@/components/ui/splash-screen';
import { BillOfRightsHero } from '@/components/ui/bill-of-rights-hero';

/* ─── 3D tilt handler for pricing cards ─── */
function useTilt() {
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 6;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -6;
    el.style.transform = `perspective(800px) rotateX(${y}deg) rotateY(${x}deg) scale(1.02)`;
  }, []);
  const onMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = '';
  }, []);
  return { onMouseMove, onMouseLeave };
}

/* ─── Landing Page ────────────────────────────────────── */
export function LandingPage() {
  const [showSplash, setShowSplash] = useState(true);
  const tilt = useTilt();

  if (showSplash) {
    return (
      <VideoSplash
        videoSrc="/video/hero.mp4"
        minDisplayTime={2500}
        onComplete={() => setShowSplash(false)}
      />
    );
  }

  return (
    <div className="landing-gradient-shift relative min-h-screen overflow-x-hidden bg-bg-alt text-text-primary font-sans">
      {/* Scroll-linked ambient glow */}
      <div className="landing-ambient-glow" />

      {/* NAV */}
      <LandingNav />
      <ScrollRevealObserver />

      {/* ══════════════════════════════════════════════════════
          HERO — Sticky, fades as content scrolls over it
          ══════════════════════════════════════════════════════ */}
      <section className="hero-parallax-fade sticky top-0 z-0">
        <BillOfRightsHero
          rotationSpeed={0.003}
          textureSrc="/bill-of-rights.jpg"
          className="bg-bg-alt"
        >
          <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
            {/* Early Access Badge */}
            <div className="hero-reveal inline-flex items-center px-5 py-2 rounded-full mb-10 bg-white/[0.08] border border-white/[0.12] backdrop-blur-lg">
              <span className="text-xs uppercase tracking-[0.3em] text-text-secondary font-medium">
                Civic Social Platform
              </span>
            </div>

            {/* Title — Editorial serif */}
            <h1 className="hero-reveal hero-reveal-delay-1 mb-6">
              <span className="block text-[clamp(40px,8vw,80px)] landing-serif-title tracking-[-1px] leading-[1.05] text-text-primary drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
                Smarter Civic
                <br />
                Discourse
              </span>
            </h1>

            {/* Subtitle */}
            <p className="hero-reveal hero-reveal-delay-2 text-[clamp(14px,1.5vw,18px)] text-text-secondary max-w-lg mb-12 leading-relaxed drop-shadow-[0_1px_8px_rgba(0,0,0,0.6)]">
              A dedicated platform for legislation awareness, structured civic discussion, and fact-grounded public discourse. Leave the noise behind.
            </p>

            {/* CTA Buttons */}
            <div className="hero-reveal hero-reveal-delay-3 flex flex-col sm:flex-row gap-4">
              <Link
                href="/register"
                className="px-10 py-3.5 rounded-sm text-sm font-medium uppercase tracking-[0.2em] bg-text-primary text-bg hover:bg-text-primary/90 transition-colors text-center"
              >
                Create Account
              </Link>
              <Link
                href="/login"
                className="px-10 py-3.5 rounded-sm text-sm font-medium uppercase tracking-[0.2em] bg-transparent border border-white/25 text-text-primary hover:bg-white/[0.08] transition-colors text-center"
              >
                Sign In
              </Link>
            </div>
          </div>
        </BillOfRightsHero>
      </section>

      {/* ══════════════════════════════════════════════════════
          CONTENT — Scrolls OVER the pinned hero
          ══════════════════════════════════════════════════════ */}
      <div className="relative z-10 bg-bg-alt">

        {/* ── PROOF STRIP ─────────────────────────────────────── */}
        <div className="scroll-reveal flex justify-center px-4 sm:px-8 py-12">
          <div className="flex flex-wrap justify-center gap-0 max-w-[800px] w-full landing-glass-card !py-5 !px-6">
            {[
              'Built for civil discourse',
              'Context-first design',
              'Real-time policy tracking',
              'Community moderation tools',
            ].map((txt, i, arr) => (
              <div key={txt} className="flex items-center">
                <div className="flex items-center gap-2 px-4 sm:px-6 py-1 text-sm text-text-primary whitespace-nowrap">
                  <span className="text-text-secondary">·</span>
                  {txt}
                </div>
                {i < arr.length - 1 && (
                  <div className="w-px h-4 bg-white/10 hidden sm:block" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── FEATURES ────────────────────────────────────────── */}
        <section className="landing-section" id="features">
          <div className="max-w-5xl mx-auto w-full">
            <div className="scroll-reveal mb-12">
              <p className="landing-section-label">Core Features</p>
              <h2 className="landing-serif-title text-[clamp(32px,5vw,56px)] text-text-primary mb-4">
                Engineered for Clarity
              </h2>
              <p className="text-text-secondary max-w-xl text-base leading-relaxed">
                Every feature is designed to surface signal, reduce noise, and keep discourse grounded in fact.
              </p>
            </div>
            <div className="landing-editorial-grid">
              {[
                ['Context Panels', 'Context that follows the conversation. Every post can surface sources, summaries, and linked legislation automatically.'],
                ['Live Legislation Tracker', 'Legislation updates, not headlines. Track bill status, amendments, votes, and committee actions in real time.'],
                ['Transparent Feeds', 'Feeds you can understand. Choose chronological or ranked and see exactly why a post appears in your feed.'],
                ['Civility Controls', 'Tools that keep discourse human. Conversation health scores, auto de-escalation nudges, and cooling-off features.'],
                ['Verified Profiles', 'A trust layer that means something. Human verification tied to professional credentials, not just payment.'],
                ['Community Notes', 'Citation-based, community-driven corrections. Neutral, source-first, and visible to all — not buried.'],
              ].map(([title, desc]) => (
                <div
                  key={title}
                  className="feature-card glow-card landing-glass-card hover:bg-white/[0.06] transition-colors duration-200"
                >
                  <h3 className="text-lg font-semibold mb-2 tracking-tight text-text-primary">
                    {title}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ────────────────────────────────────── */}
        <section className="landing-section" id="how-it-works">
          <div className="max-w-5xl mx-auto w-full">
            <div className="scroll-reveal mb-12">
              <p className="landing-section-label">Workflow</p>
              <h2 className="landing-serif-title text-[clamp(32px,5vw,56px)] text-text-primary">
                From Observation to Action
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-10">
              {[
                [1, 'Discover Issues', 'Select policy areas, committees, and communities. Your feed builds itself around what matters to you — not what drives engagement.'],
                [2, 'Follow Legislation', 'Follow verified experts, journalists, legislators, and citizens. Track bills from introduction through final vote.'],
                [3, 'Join Discussion', 'One feed. Posts, bill alerts, context panels, and community notes — unified and chronologically honest.'],
              ].map(([num, title, desc]) => (
                <div key={num} className={`scroll-reveal scroll-reveal-delay-${num}`}>
                  <div className="landing-glass-card">
                    <div
                      className={`counter-num counter-num-${num} text-4xl landing-serif-title font-light text-civic-light/30 mb-4`}
                      aria-label={`Step ${num}`}
                    />
                    <h3 className="text-lg font-semibold mb-2 tracking-tight text-text-primary">
                      {title as string}
                    </h3>
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {desc as string}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TRUST ───────────────────────────────────────────── */}
        <section className="landing-section">
          <div className="max-w-5xl mx-auto w-full">
            <div className="scroll-reveal mb-12">
              <p className="landing-section-label">Trust &amp; Integrity</p>
              <h2 className="landing-serif-title text-[clamp(32px,5vw,56px)] text-text-primary mb-4">
                A Better Standard
                <br />
                for Engagement
              </h2>
              <p className="text-text-secondary max-w-xl text-base leading-relaxed">
                We built the principles before we built the product. That&apos;s not a tagline — it&apos;s the architecture.
              </p>
            </div>
            <div className="landing-editorial-grid">
              {[
                ['Neutral by Design', 'No algorithmic amplification of outrage. No partisan weighting. Feed ranking is documented and auditable.'],
                ['Transparent Ranking', 'Every ranking signal is published. You choose what drives your feed — not a black box.'],
                ['Anti-Harassment', 'Proactive protections, not reactive bans. Conversation health monitoring and tiered reporting tools.'],
                ['Source-First Info', 'Primary sources surface before opinions. Context panels link to the original document, not a summary of a summary.'],
              ].map(([title, desc]) => (
                <div
                  key={title}
                  className="feature-card glow-card landing-glass-card hover:bg-white/[0.06] transition-colors duration-200"
                >
                  <h3 className="text-base font-semibold mb-2 tracking-tight text-text-primary">
                    {title}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {desc}
                  </p>
                </div>
              ))}
            </div>
            <div className="scroll-reveal text-center mt-10">
              <Link
                href="/safety"
                className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors uppercase tracking-widest"
              >
                Read our Principles →
              </Link>
            </div>
          </div>
        </section>

        {/* ── PRICING ─────────────────────────────────────────── */}
        <section className="landing-section" id="pricing">
          <div className="max-w-5xl mx-auto w-full">
            <div className="scroll-reveal mb-12 text-center">
              <p className="landing-section-label">Access the Platform</p>
              <h2 className="landing-serif-title text-[clamp(32px,5vw,56px)] text-text-primary">
                Transparent Pricing
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {/* Free */}
              <div
                className="pricing-card glow-card landing-glass-card landing-tilt-card hover:bg-white/[0.06] transition-colors duration-200"
                {...tilt}
              >
                <div className="inline-block px-3 py-1 rounded-full mb-5 bg-white/10 text-text-secondary text-xs font-semibold uppercase tracking-widest">
                  Citizen
                </div>
                <div className="text-3xl landing-serif-title font-light tracking-tight mb-1 text-text-primary">
                  $0<span className="text-lg text-text-secondary">/mo</span>
                </div>
                <div className="text-sm text-text-secondary mb-6">Always free</div>
                <ul className="space-y-3 mb-8">
                  {[
                    'Full posting & reading',
                    'Context panels',
                    'Follow people & communities',
                    'Live feed & trending',
                  ].map((f) => (
                    <li key={f} className="text-sm text-text-secondary flex items-center gap-2.5">
                      <span className="text-civic-light text-xs">▹</span> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="block text-center py-3 rounded-sm font-medium text-sm uppercase tracking-[0.12em] border border-white/15 text-text-primary hover:bg-white/[0.06] transition-colors"
                >
                  Create Free Account
                </Link>
              </div>

              {/* Pro */}
              <div
                className="pricing-card glow-card landing-glass-card landing-tilt-card hover:bg-white/[0.06] transition-colors duration-200 border-civic/30"
                {...tilt}
              >
                <div className="inline-block px-3 py-1 rounded-full mb-5 bg-civic/15 text-civic-light text-xs font-semibold uppercase tracking-widest">
                  Professional
                </div>
                <div className="text-3xl landing-serif-title font-light tracking-tight mb-1 text-text-primary">
                  $12<span className="text-lg text-text-secondary">/mo</span>
                </div>
                <div className="text-sm text-text-secondary mb-6">Coming soon</div>
                <ul className="space-y-3 mb-8">
                  {[
                    'Everything in Citizen',
                    'Bill alerts & push notifications',
                    'AI-powered summaries',
                    'Advanced feed filters',
                    'Verified profile badge',
                  ].map((f) => (
                    <li key={f} className="text-sm text-text-secondary flex items-center gap-2.5">
                      <span className="text-civic-light text-xs">▹</span> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="block text-center py-3 rounded-sm font-medium text-sm uppercase tracking-[0.12em] bg-text-primary text-bg hover:bg-text-primary/90 transition-colors"
                >
                  Start Professional Trial
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ─────────────────────────────────────── */}
        <section className="landing-section">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="scroll-reveal landing-serif-title text-[clamp(36px,6vw,64px)] text-text-primary mb-6">
              Join the Discussion
            </h2>
            <p className="scroll-reveal scroll-reveal-delay-1 text-base text-text-secondary mb-10 leading-relaxed">
              A civic platform that takes the public seriously. Real legislation, real discourse, real accountability.
            </p>
            <div className="scroll-reveal scroll-reveal-delay-2 flex gap-4 justify-center flex-wrap">
              <Link
                href="/register"
                className="px-10 py-3.5 text-sm font-medium uppercase tracking-[0.15em] bg-text-primary text-bg rounded-sm hover:bg-text-primary/90 transition-colors"
              >
                Create Account
              </Link>
              <Link
                href="/login"
                className="px-10 py-3.5 text-sm font-medium uppercase tracking-[0.15em] rounded-sm border border-white/25 text-text-primary hover:bg-white/[0.08] transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </section>

        {/* ── FOOTER ─────────────────────────────────────────── */}
        <footer className="scroll-reveal border-t border-white/[0.08] py-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-8 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 mr-auto landing-serif-title font-light text-lg tracking-tight text-text-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="currentColor" />
              </svg>
              Civic Social
            </div>
            <nav className="flex gap-7 flex-wrap">
              {[
                ['Privacy', '/safety'],
                ['Terms', '/safety'],
                ['Principles', '/how-it-works'],
                ['Contact', '/contact'],
              ].map(([label, href]) => (
                <Link
                  key={label}
                  href={href}
                  className="text-xs text-text-secondary hover:text-text-primary transition-colors uppercase tracking-widest"
                >
                  {label}
                </Link>
              ))}
            </nav>
            <p className="w-full text-right text-xs text-text-muted">
              &copy; 2026 Civic Social Technologies
            </p>
          </div>
        </footer>

      </div>{/* end content wrapper */}
    </div>
  );
}
