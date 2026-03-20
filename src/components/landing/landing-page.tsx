'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LandingNav } from '@/components/landing/landing-nav';
import { ScrollRevealObserver } from '@/components/landing/scroll-reveal';

import { VideoSplash } from '@/components/ui/splash-screen';
import { BillOfRightsHero } from '@/components/ui/bill-of-rights-hero';
import { ContainerScroll } from '@/components/ui/container-scroll-animation';

/* ─── Landing Page ────────────────────────────────────── */
export function LandingPage() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      {/* Phase 1: Video splash screen */}
      {showSplash && (
        <VideoSplash
          videoSrc="/video/hero.mp4"
          minDisplayTime={2500}
          onComplete={() => setShowSplash(false)}
        />
      )}

      {/* Phase 2: Landing page (renders behind splash, revealed on complete) */}
      <div className="landing-gradient-shift relative min-h-screen overflow-x-hidden bg-bg-alt text-white font-sans scroll-snap-landing">
        {/* Scroll-linked ambient glow */}
        <div className="landing-ambient-glow" />

        {/* NAV */}
        <LandingNav />
        <ScrollRevealObserver />

        {/* ── HERO — 3D Scroll Animation + Bill of Rights ── */}
        <BillOfRightsHero
          rotationSpeed={0.003}
          textureSrc="/bill-of-rights.jpg"
          className="bg-bg-alt !min-h-0"
        >
          <ContainerScroll
            titleComponent={
              <div className="flex flex-col items-center pt-8">
                {/* Early Access Badge */}
                <div className="hero-reveal inline-flex items-center px-6 py-3 rounded-full mb-8 bg-white/[0.12] border border-white/[0.18] backdrop-blur-lg">
                  <span className="text-base text-white/90">Now in Early Access</span>
                </div>

                {/* Title */}
                <h1 className="hero-reveal hero-reveal-delay-1 text-center mb-2">
                  <span className="block text-[clamp(40px,8vw,80px)] font-light tracking-[-2px] leading-[1.1] text-white">
                    Civic Social
                  </span>
                </h1>

                {/* Subtitle */}
                <p className="hero-reveal hero-reveal-delay-2 text-center text-[clamp(32px,7vw,72px)] font-light tracking-[-1.5px] leading-[1.1] text-white mb-10">
                  Conversations meet context.
                </p>

                {/* CTA Buttons */}
                <div className="hero-reveal hero-reveal-delay-3 flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/register"
                    className="px-8 py-4 rounded-lg text-base font-medium bg-white text-text-inverse hover:bg-white/90 transition-colors text-center"
                  >
                    Create Account
                  </Link>
                  <Link
                    href="/login"
                    className="px-8 py-4 rounded-lg text-base font-medium bg-white/10 border border-white/30 text-white backdrop-blur-sm hover:bg-white/[0.15] transition-colors text-center"
                  >
                    Sign In
                  </Link>
                </div>
              </div>
            }
          >
            {/* App preview inside the 3D tilting card */}
            <div className="flex flex-col md:flex-row gap-4 h-full w-full items-center justify-center p-4 md:p-8">
              {/* Card 1 - User Post */}
              <div className="w-full md:w-[260px] bg-surface-elevated/90 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-civic-dark shrink-0" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-white">Sarah Chen</span>
                      <span className="px-1.5 py-0.5 bg-warning-light rounded text-[10px] font-medium text-text-inverse">Expert</span>
                    </div>
                    <div className="text-xs text-text-secondary">Policy Analyst · 2m ago</div>
                  </div>
                </div>
                <p className="text-[13px] leading-[18px] text-white mb-3">
                  The infrastructure bill just passed committee — here&apos;s what it actually means for broadband access in rural counties...
                </p>
                <div className="flex gap-4 text-xs text-text-secondary">
                  <span>214 agree</span>
                  <span>88 replies</span>
                  <span>1.2k insight</span>
                </div>
              </div>

              {/* Card 2 - Bill Update */}
              <div className="w-full md:w-[260px] bg-surface-elevated/90 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="w-2 h-2 rounded-full bg-positive" />
                  <span className="text-[11px] font-semibold text-text-secondary tracking-wider uppercase">Live Bill Update</span>
                </div>
                <h3 className="text-[15px] font-semibold text-white mb-4 leading-snug">
                  H.R. 5892 — Clean Energy Transition
                </h3>
                <div className="flex gap-1.5 flex-wrap mb-3">
                  <span className="px-2 py-1 bg-positive rounded text-[10px] font-medium text-white">Introduced</span>
                  <span className="px-2 py-1 bg-positive rounded text-[10px] font-medium text-white">Committee</span>
                  <span className="px-2 py-1 bg-info rounded text-[10px] font-medium text-white">Floor Vote</span>
                  <span className="px-2 py-1 bg-text-muted rounded text-[10px] font-medium text-white">Enacted</span>
                </div>
                <p className="text-xs text-warning">Vote expected this week</p>
              </div>

              {/* Card 3 - Trending */}
              <div className="w-full md:w-[220px] bg-surface-elevated/90 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-4">
                  <span className="w-2 h-2 rounded-full bg-warning-light" />
                  <span className="text-[11px] font-semibold text-text-secondary tracking-wider uppercase">Trending</span>
                </div>
                <div className="space-y-3">
                  {[
                    ['#ClimatePolicy', '42.1k'],
                    ['#HealthcareReform', '31.8k'],
                    ['#HousingAct', '19.4k'],
                  ].map(([tag, cnt]) => (
                    <div key={tag} className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-warning">{tag}</span>
                      <span className="text-[13px] text-text-secondary">{cnt}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ContainerScroll>
        </BillOfRightsHero>

        {/* ── PROOF STRIP ─────────────────────────────────────── */}
        <div className="scroll-reveal relative z-10 flex justify-center px-4 sm:px-8 -mt-4 mb-0 bg-bg-alt pb-8">
          <div className="flex flex-wrap justify-center gap-0 max-w-[800px] w-full bg-surface-elevated/80 border border-white/10 rounded-xl backdrop-blur-xl py-4 px-6">
            {[
              'Built for civil discourse',
              'Context-first design',
              'Real-time policy tracking',
              'Community moderation tools',
            ].map((txt, i, arr) => (
              <div key={txt} className="flex items-center">
                <div className="flex items-center gap-2 px-4 sm:px-6 py-1 text-sm text-white whitespace-nowrap">
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
        <section className="relative z-10 py-16 sm:py-24 px-4 sm:px-8 max-w-6xl mx-auto bg-bg-alt" id="features">
          <div className="scroll-reveal">
            <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-4">
              Core Features
            </p>
            <h2 className="text-3xl sm:text-4xl font-light tracking-tight leading-tight mb-4 text-white">
              Built different.
              <br />
              Because the stakes are different.
            </h2>
            <p className="text-text-secondary max-w-xl text-base leading-relaxed mb-10">
              Every feature is designed to surface signal, reduce noise, and keep discourse grounded in fact.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                className="feature-card glow-card bg-surface-elevated/60 border border-white/10 rounded-xl p-6 hover:bg-surface-active/80 transition-colors duration-200 backdrop-blur-sm"
              >
                <h3 className="text-base font-semibold mb-2 tracking-tight text-white">
                  {title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS ────────────────────────────────────── */}
        <section className="relative z-10 py-16 sm:py-24 px-4 sm:px-8 max-w-6xl mx-auto bg-bg-alt" id="how-it-works">
          <div className="scroll-reveal">
            <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-4">
              How It Works
            </p>
            <h2 className="text-3xl sm:text-4xl font-light tracking-tight leading-tight mb-10 text-white">
              Three steps.
              <br />
              Infinite clarity.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              [1, 'Pick topics you care about', 'Select policy areas, committees, and communities. Your feed builds itself around what matters to you — not what drives engagement.'],
              [2, 'Follow people & communities', 'Follow verified experts, journalists, legislators, and citizens. Community circles let you filter signal from noise.'],
              [3, 'Track posts & policy updates', 'One feed. Posts, bill alerts, context panels, and community notes — unified and chronologically honest.'],
            ].map(([num, title, desc]) => (
              <div key={num} className={`scroll-reveal scroll-reveal-delay-${num}`}>
                <div
                  className={`counter-num counter-num-${num} text-5xl font-light tracking-tighter text-white/10 mb-3`}
                  aria-label={`Step ${num}`}
                />
                <h3 className="text-lg font-semibold mb-2 tracking-tight text-white">
                  {title as string}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {desc as string}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── TRUST ───────────────────────────────────────────── */}
        <section className="relative z-10 py-16 sm:py-24 px-4 sm:px-8 max-w-6xl mx-auto bg-bg-alt">
          <div className="scroll-reveal">
            <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-4">
              Trust &amp; Safety
            </p>
            <h2 className="text-3xl sm:text-4xl font-light tracking-tight leading-tight mb-4 text-white">
              Neutral by design.
              <br />
              Safe by default.
            </h2>
            <p className="text-text-secondary max-w-xl text-base leading-relaxed mb-10">
              We built the principles before we built the product. That&apos;s not a tagline — it&apos;s the architecture.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              ['Neutral by Design', 'No algorithmic amplification of outrage. No partisan weighting. Feed ranking is documented and auditable.'],
              ['Transparent Ranking', 'Every ranking signal is published. You choose what drives your feed — not a black box.'],
              ['Anti-Harassment', 'Proactive protections, not reactive bans. Conversation health monitoring and tiered reporting tools.'],
              ['Source-First Info', 'Primary sources surface before opinions. Context panels link to the original document, not a summary of a summary.'],
            ].map(([title, desc]) => (
              <div
                key={title}
                className="feature-card glow-card bg-surface-elevated/60 border border-white/10 rounded-xl p-6 hover:bg-surface-active/80 transition-colors duration-200 backdrop-blur-sm"
              >
                <h3 className="text-sm font-semibold mb-2 tracking-tight text-white">
                  {title}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {desc}
                </p>
              </div>
            ))}
          </div>
          <div className="scroll-reveal text-center">
            <Link
              href="/safety"
              className="text-sm font-medium text-text-secondary hover:text-white transition-colors"
            >
              Read our Principles →
            </Link>
          </div>
        </section>

        {/* ── PRICING ─────────────────────────────────────────── */}
        <section className="relative z-10 py-16 sm:py-24 px-4 sm:px-8 bg-bg-alt" id="pricing">
          <div className="max-w-6xl mx-auto">
            <div className="scroll-reveal">
              <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-4">
                Plans
              </p>
              <h2 className="text-3xl sm:text-4xl font-light tracking-tight leading-tight mb-10 text-white">
                Start free.
                <br />
                Go deeper with Pro.
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {/* Free */}
              <div className="pricing-card glow-card bg-surface-elevated/60 border border-white/10 rounded-xl p-8 backdrop-blur-sm hover:bg-surface-active/80 transition-colors duration-200">
                <div className="inline-block px-3 py-1 rounded-full mb-5 bg-white/10 text-white/80 text-xs font-semibold uppercase">
                  Free
                </div>
                <div className="text-2xl font-light tracking-tight mb-1 text-white">
                  Civic
                </div>
                <div className="text-sm text-text-secondary mb-6">Always free</div>
                <ul className="space-y-2 mb-8">
                  {[
                    'Full posting & reading',
                    'Context panels (basic)',
                    'Follow people & communities',
                    'Live feed & trending',
                    'Community notes',
                  ].map((f) => (
                    <li key={f} className="text-sm text-text-secondary flex items-center gap-2">
                      <span className="text-positive">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="block text-center py-3 rounded-lg font-medium border border-white/20 text-white hover:bg-white/10 transition-colors"
                >
                  Join Free
                </Link>
              </div>

              {/* Pro */}
              <div className="pricing-card glow-card bg-surface-elevated/60 border border-white/20 rounded-xl p-8 backdrop-blur-sm hover:bg-surface-active/80 transition-colors duration-200">
                <div className="inline-block px-3 py-1 rounded-full mb-5 bg-white/15 text-white text-xs font-semibold uppercase">
                  Pro
                </div>
                <div className="text-2xl font-light tracking-tight mb-1 text-white">
                  Civic Pro
                </div>
                <div className="text-sm text-text-secondary mb-6">Coming soon</div>
                <ul className="space-y-2 mb-8">
                  {[
                    'Everything in Free',
                    'Bill alerts & push notifications',
                    'Deeper AI-powered summaries',
                    'Advanced feed filters',
                    'Creator & analyst tools',
                    'Verified profile badge',
                  ].map((f) => (
                    <li key={f} className="text-sm text-text-secondary flex items-center gap-2">
                      <span className="text-white">✦</span> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="block text-center py-3 rounded-lg font-medium bg-white text-text-inverse hover:bg-white/90 transition-colors"
                >
                  Get Early Pro Access
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ─────────────────────────────────────── */}
        <section className="relative z-10 py-20 sm:py-28 px-4 sm:px-8 text-center bg-bg-alt">
          <h2 className="scroll-reveal text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05] mb-5 text-white">
            Build better conversations.
          </h2>
          <p className="scroll-reveal scroll-reveal-delay-1 text-base text-text-secondary mb-8">
            Join thousands waiting for a civic platform that takes the public seriously.
          </p>
          <div className="scroll-reveal scroll-reveal-delay-2 flex gap-4 justify-center flex-wrap">
            <Link
              href="/register"
              className="inline-flex items-center px-10 py-4 font-medium text-text-inverse bg-white rounded-lg hover:bg-white/90 transition-colors text-base"
            >
              Create Account
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center px-10 py-4 font-medium rounded-lg border border-white/30 text-white hover:bg-white/10 transition-colors text-base"
            >
              Sign In
            </Link>
          </div>
        </section>

        {/* ── FOOTER ─────────────────────────────────────────── */}
        <footer className="scroll-reveal relative z-10 border-t border-white/10 py-8 bg-bg-alt">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 mr-auto font-semibold text-base tracking-tight text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
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
                  className="text-sm text-text-secondary hover:text-white transition-colors"
                >
                  {label}
                </Link>
              ))}
            </nav>
            <p className="w-full text-right text-xs text-text-secondary/60">
              &copy; 2026 Civic Social. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
