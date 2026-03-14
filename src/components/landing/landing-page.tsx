'use client';

import Link from 'next/link';
import { LandingNav } from '@/components/landing/landing-nav';

/* ─── Landing Page ────────────────────────────────────── */
export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-bg text-text-primary font-sans">
      {/* NAV */}
      <LandingNav />

      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden pt-20 sm:pt-24">
        {/* Subtle static gradient — no animation */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 30% 40%, rgba(99,102,241,.08) 0%, transparent 60%), radial-gradient(ellipse 50% 60% at 75% 30%, rgba(99,102,241,.05) 0%, transparent 50%)',
          }}
        />

        <div className="relative w-full max-w-6xl mx-auto px-4 sm:px-8 py-12 sm:py-20 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center z-10">
          {/* Copy */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-xs font-bold tracking-widest uppercase bg-civic-subtle border border-civic/20 text-civic-light">
              <span className="w-1.5 h-1.5 rounded-full bg-positive inline-block" />
              Now in early access
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] mb-6 text-text-primary">
              Civic Social — Where Conversations Meet{' '}
              <span className="text-civic-light">Context.</span>
            </h1>

            <p className="max-w-[480px] text-base sm:text-lg text-text-secondary mb-8 leading-relaxed">
              Post freely. Stay informed. Track real legislation in real time — without the noise.
            </p>

            <div className="flex gap-4 flex-wrap mb-4">
              <Link
                href="/register"
                className="inline-flex items-center px-8 py-3.5 font-semibold text-white bg-civic rounded-xl hover:bg-civic-dark transition-colors text-base"
              >
                Create Account
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center px-8 py-3.5 font-semibold rounded-xl border border-border-strong text-text-primary hover:bg-surface-hover transition-colors text-base"
              >
                Sign In
              </Link>
            </div>

            <p className="text-xs text-text-muted">
              Free to join &bull; No credit card required
            </p>
          </div>

          {/* Static product preview cards (no float animation) */}
          <div className="relative hidden lg:block" style={{ height: 520 }}>
            {/* Feed card */}
            <div className="absolute bg-surface-elevated rounded-2xl p-5 border border-border-subtle" style={{ width: 280, top: 20, left: 0 }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-civic-muted shrink-0" />
                <div>
                  <div className="font-semibold text-sm">Sarah Chen <span className="text-civic-light text-xs ml-1">Expert</span></div>
                  <div className="text-xs text-text-muted">Policy Analyst · 2m ago</div>
                </div>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed mb-3">
                The infrastructure bill just passed committee — here&apos;s what it actually means for broadband access in rural counties...
              </p>
              <div className="flex gap-4 text-xs text-text-muted">
                <span>214 agree</span>
                <span>88 replies</span>
                <span>1.2k insightful</span>
              </div>
            </div>

            {/* Context card */}
            <div className="absolute bg-surface-elevated rounded-2xl p-5 border border-border-subtle" style={{ width: 240, top: 80, right: 0 }}>
              <div className="flex items-center gap-2 mb-3 text-xs font-semibold tracking-wider uppercase text-text-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-positive inline-block" />
                Context Panel
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <div className="font-semibold">S.1234 Infrastructure Act</div>
                  <div className="text-xs text-text-muted">Passed Senate 67–32 · Nov 2025</div>
                </div>
                <div>
                  <div className="font-semibold">3 Primary Sources</div>
                  <div className="text-xs text-text-muted">CBO · Congress.gov · Reuters</div>
                </div>
              </div>
            </div>

            {/* Bill tracker card */}
            <div className="absolute bg-surface-elevated rounded-2xl p-5 border border-border-subtle" style={{ width: 260, bottom: 80, left: 30 }}>
              <div className="flex items-center gap-2 mb-3 text-xs font-semibold tracking-wider uppercase text-text-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-warning inline-block" />
                Live Bill Update
              </div>
              <div className="font-semibold text-sm mb-3 leading-snug">
                H.R. 5892 — Clean Energy Transition
              </div>
              <div className="flex gap-1 mb-3">
                {['Introduced', 'Committee', 'Floor Vote', 'Enacted'].map((s, i) => (
                  <div
                    key={s}
                    className={`flex-1 text-center py-1 rounded-md text-xs font-medium ${
                      i < 2
                        ? 'bg-positive/10 text-positive-light'
                        : i === 2
                          ? 'bg-warning/10 text-warning-light'
                          : 'bg-surface-active text-text-muted'
                    }`}
                  >
                    {s}
                  </div>
                ))}
              </div>
              <div className="text-xs text-warning-light">Vote expected this week</div>
            </div>

            {/* Trending card */}
            <div className="absolute bg-surface-elevated rounded-2xl p-5 border border-border-subtle" style={{ width: 200, bottom: 60, right: 20 }}>
              <div className="flex items-center gap-2 mb-3 text-xs font-semibold tracking-wider uppercase text-text-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-civic inline-block" />
                Trending
              </div>
              {[
                ['#ClimatePolicy', '42.1k'],
                ['#HealthcareReform', '31.8k'],
                ['#HousingAct', '19.4k'],
              ].map(([tag, cnt]) => (
                <div key={tag} className="flex justify-between mb-1 text-sm">
                  <span className="text-civic-light font-medium">{tag}</span>
                  <span className="text-text-muted">{cnt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PROOF STRIP ─────────────────────────────────────── */}
      <div className="border-t border-b border-border-subtle bg-surface/30 py-5">
        <div className="flex flex-wrap justify-center items-center gap-0 max-w-6xl mx-auto px-4 sm:px-8">
          {[
            'Built for civil discourse',
            'Context-first design',
            'Real-time policy tracking',
            'Community moderation tools',
          ].map((txt, i, arr) => (
            <div key={txt} className="flex items-center">
              <div className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-text-secondary whitespace-nowrap">
                <span className="text-civic-light">·</span>
                {txt}
              </div>
              {i < arr.length - 1 && (
                <div className="w-px h-5 bg-border-subtle hidden sm:block" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 px-4 sm:px-8 max-w-6xl mx-auto" id="features">
        <p className="text-civic-light text-xs font-bold tracking-widest uppercase mb-4">
          Core Features
        </p>
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-4">
          Built different.
          <br />
          Because the stakes are different.
        </h2>
        <p className="text-text-secondary max-w-xl text-base leading-relaxed mb-10">
          Every feature is designed to surface signal, reduce noise, and keep discourse grounded in fact.
        </p>
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
              className="bg-surface-elevated rounded-2xl p-6 hover:bg-surface-hover transition-colors duration-200"
            >
              <h3 className="text-base font-semibold mb-2 tracking-tight">
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
      <section className="py-16 sm:py-24 px-4 sm:px-8 max-w-6xl mx-auto" id="how-it-works">
        <p className="text-civic-light text-xs font-bold tracking-widest uppercase mb-4">
          How It Works
        </p>
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-10">
          Three steps.
          <br />
          Infinite clarity.
        </h2>
        <div className="grid md:grid-cols-3 gap-10">
          {[
            ['01', 'Pick topics you care about', 'Select policy areas, committees, and communities. Your feed builds itself around what matters to you — not what drives engagement.'],
            ['02', 'Follow people & communities', 'Follow verified experts, journalists, legislators, and citizens. Community circles let you filter signal from noise.'],
            ['03', 'Track posts & policy updates', 'One feed. Posts, bill alerts, context panels, and community notes — unified and chronologically honest.'],
          ].map(([num, title, desc]) => (
            <div key={num}>
              <div className="text-5xl font-black tracking-tighter text-civic-subtle mb-3">
                {num}
              </div>
              <h3 className="text-lg font-semibold mb-2 tracking-tight">
                {title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TRUST ───────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 px-4 sm:px-8 max-w-6xl mx-auto">
        <p className="text-civic-light text-xs font-bold tracking-widest uppercase mb-4">
          Trust &amp; Safety
        </p>
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-4">
          Neutral by design.
          <br />
          Safe by default.
        </h2>
        <p className="text-text-secondary max-w-xl text-base leading-relaxed mb-10">
          We built the principles before we built the product. That&apos;s not a tagline — it&apos;s the architecture.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            ['Neutral by Design', 'No algorithmic amplification of outrage. No partisan weighting. Feed ranking is documented and auditable.'],
            ['Transparent Ranking', 'Every ranking signal is published. You choose what drives your feed — not a black box.'],
            ['Anti-Harassment', 'Proactive protections, not reactive bans. Conversation health monitoring and tiered reporting tools.'],
            ['Source-First Info', 'Primary sources surface before opinions. Context panels link to the original document, not a summary of a summary.'],
          ].map(([title, desc]) => (
            <div
              key={title}
              className="bg-surface-elevated rounded-2xl p-6 hover:bg-surface-hover transition-colors duration-200"
            >
              <h3 className="text-sm font-semibold mb-2 tracking-tight">
                {title}
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                {desc}
              </p>
            </div>
          ))}
        </div>
        <div className="text-center">
          <Link
            href="/safety"
            className="text-sm font-medium text-text-muted hover:text-civic-light transition-colors"
          >
            Read our Principles →
          </Link>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 px-4 sm:px-8" id="pricing">
        <div className="max-w-6xl mx-auto">
          <p className="text-civic-light text-xs font-bold tracking-widest uppercase mb-4">
            Plans
          </p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-10">
            Start free.
            <br />
            Go deeper with Pro.
          </h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Free */}
            <div className="bg-surface-elevated rounded-2xl p-8 border border-border-subtle">
              <div className="inline-block px-3 py-1 rounded-full mb-5 bg-civic-subtle text-civic-light text-xs font-bold tracking-wide uppercase">
                Free
              </div>
              <div className="text-2xl font-black tracking-tight mb-1">
                Civic
              </div>
              <div className="text-sm text-text-muted mb-6">Always free</div>
              <ul className="space-y-2 mb-8">
                {[
                  'Full posting & reading',
                  'Context panels (basic)',
                  'Follow people & communities',
                  'Live feed & trending',
                  'Community notes',
                ].map((f) => (
                  <li key={f} className="text-sm text-text-secondary flex items-center gap-2">
                    <span className="text-positive-light">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="block text-center py-3 rounded-xl font-semibold border border-border-strong text-text-primary hover:bg-surface-hover transition-colors"
              >
                Join Free
              </Link>
            </div>

            {/* Pro */}
            <div className="bg-surface-elevated rounded-2xl p-8 border border-civic/20">
              <div className="inline-block px-3 py-1 rounded-full mb-5 bg-civic-muted text-civic-light text-xs font-bold tracking-wide uppercase">
                Pro
              </div>
              <div className="text-2xl font-black tracking-tight mb-1">
                Civic Pro
              </div>
              <div className="text-sm text-text-muted mb-6">Coming soon</div>
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
                    <span className="text-civic-light">✦</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="block text-center py-3 rounded-xl font-bold bg-civic text-white hover:bg-civic-dark transition-colors"
              >
                Get Early Pro Access
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────── */}
      <section className="py-20 sm:py-28 px-4 sm:px-8 text-center">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(99,102,241,.06) 0%, transparent 60%)',
          }}
        />
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05] mb-5 text-text-primary relative z-10">
          Build better conversations.
        </h2>
        <p className="text-base text-text-secondary mb-8 relative z-10">
          Join thousands waiting for a civic platform that takes the public seriously.
        </p>
        <div className="flex gap-4 justify-center flex-wrap relative z-10">
          <Link
            href="/register"
            className="inline-flex items-center px-10 py-4 font-semibold text-white bg-civic rounded-xl hover:bg-civic-dark transition-colors text-base"
          >
            Create Account
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center px-10 py-4 font-semibold rounded-xl border border-border-strong text-text-primary hover:bg-surface-hover transition-colors text-base"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer className="border-t border-border-subtle py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 mr-auto font-bold text-base tracking-tight">
            <span className="text-civic-light text-lg">◈</span> Civic Social
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
                className="text-sm text-text-muted hover:text-text-secondary transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
          <p className="w-full text-right text-xs text-text-muted/60">
            &copy; 2026 Civic Social. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
