'use client';

import { useState, useCallback } from 'react';
import {
  Shield,
  MessageSquare,
  BookOpen,
  BarChart3,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Onboarding slides ───────────────────────────────────────

const ONBOARDING_SLIDES = [
  {
    id: 'welcome',
    icon: Sparkles,
    iconColor: 'text-civic-light',
    iconBg: 'bg-civic-muted',
    title: 'Welcome to Civic Social',
    description:
      'Your feed is powered by an algorithm that rewards civility, evidence, and diverse perspectives — not outrage.',
    details: [
      'Posts ranked by quality, not rage',
      'Diverse viewpoints from day one',
      'No ads, no data selling, ever',
    ],
  },
  {
    id: 'credibility',
    icon: Shield,
    iconColor: 'text-positive-light',
    iconBg: 'bg-positive/15',
    title: 'How Credibility Works',
    description:
      'Every user has a credibility score. It goes up when you cite sources, engage civilly, and debate constructively.',
    details: [
      'Cite credible sources → score rises',
      'Civil engagement → score rises',
      'Rage-bait or insults → score drops',
      'Visible on your profile to everyone',
    ],
  },
  {
    id: 'debates',
    icon: MessageSquare,
    iconColor: 'text-info-light',
    iconBg: 'bg-info/15',
    title: 'Structured Debates',
    description:
      'Debate rooms let you engage in structured discussions: claim → evidence → reasoning. With a "steelman" feature to strengthen opposing arguments.',
    details: [
      'Make claims backed by evidence',
      'Time-delayed posting for thoughtfulness',
      'Steelman opposing views for credibility',
      'Civility score visible in real-time',
    ],
  },
  {
    id: 'sources',
    icon: BookOpen,
    iconColor: 'text-warning-light',
    iconBg: 'bg-warning/15',
    title: 'Verifying Sources',
    description:
      'Every article and post is scored for credibility. Look for trust badges and fact-check indicators on posts.',
    details: [
      'Source badges show trust level',
      'AI-generated neutral summaries',
      'Multiple-perspectives panel on hot topics',
      'Publisher whitelist for news articles',
    ],
  },
  {
    id: 'algorithm',
    icon: BarChart3,
    iconColor: 'text-civic-light',
    iconBg: 'bg-civic-muted',
    title: 'How the Algorithm Ranks',
    description:
      'Your For You feed uses 6 signals. Civility is the highest-weighted — constructive posts always beat rage-bait.',
    details: [
      'Civility score (25%) — highest weight',
      'Engagement quality (20%) — read time, thoughtful replies',
      'Viewpoint diversity (15%) — cross-party boost',
      'Source credibility (15%) — cited sources win',
      'Topic relevance (15%) — your interests',
      'Author reputation (10%) — track record',
    ],
  },
  {
    id: 'safety',
    icon: AlertTriangle,
    iconColor: 'text-danger-light',
    iconBg: 'bg-danger/15',
    title: 'Report Threats & Harassment',
    description:
      'If you see threats, harassment, or misinformation, report it. Our moderation pipeline acts fast: AI → automated → human review.',
    details: [
      'Tap the flag icon on any post to report',
      'Choose a category (threats, harassment, misinformation)',
      'Reports are reviewed within hours',
      'Appeals system for transparency',
    ],
  },
];

// ─── Component ───────────────────────────────────────────────

interface OnboardingCarouselProps {
  onComplete?: () => void;
}

export function OnboardingCarousel({ onComplete }: OnboardingCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const slide = ONBOARDING_SLIDES[currentSlide];
  const isLast = currentSlide === ONBOARDING_SLIDES.length - 1;

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    onComplete?.();
  }, [onComplete]);

  const handleNext = useCallback(() => {
    if (isLast) {
      handleDismiss();
    } else {
      setCurrentSlide((prev) => prev + 1);
    }
  }, [isLast, handleDismiss]);

  const handlePrev = useCallback(() => {
    setCurrentSlide((prev) => Math.max(0, prev - 1));
  }, []);

  if (dismissed) return null;

  return (
    <div className="mx-4 sm:mx-6 mt-4 mb-2">
      <div className="bg-surface-elevated rounded-xl border border-border-subtle overflow-hidden animate-slide-up">
        {/* Header with dismiss */}
        <div className="flex items-center justify-between px-4 pt-3 pb-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-civic-light" />
            <span className="text-xs font-semibold text-text-muted">
              Getting Started — {currentSlide + 1}/{ONBOARDING_SLIDES.length}
            </span>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded text-text-muted hover:text-text-secondary transition-colors"
            title="Dismiss onboarding"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1 px-4 pt-2 pb-0">
          {ONBOARDING_SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={clsx(
                'h-1 flex-1 rounded-full transition-colors cursor-pointer',
                i <= currentSlide ? 'bg-civic' : 'bg-surface-active',
              )}
            />
          ))}
        </div>

        {/* Slide content */}
        <div className="p-4 animate-fade-in" key={slide.id}>
          <div className="flex items-start gap-3 mb-3">
            <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', slide.iconBg)}>
              <slide.icon className={clsx('w-5 h-5', slide.iconColor)} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary">{slide.title}</h3>
              <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{slide.description}</p>
            </div>
          </div>

          <div className="space-y-1.5 ml-[52px]">
            {slide.details.map((detail, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-positive shrink-0 mt-0.5" />
                <span className="text-xs text-text-secondary">{detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-4 pb-3 pt-0">
          <button
            onClick={handlePrev}
            disabled={currentSlide === 0}
            className={clsx(
              'flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-xl transition-colors',
              currentSlide > 0
                ? 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                : 'text-text-muted/30 cursor-not-allowed',
            )}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </button>

          <button
            onClick={handleNext}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-civic text-white rounded-xl hover:bg-civic-dark transition-colors"
          >
            {isLast ? 'Got it!' : 'Next'}
            {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
