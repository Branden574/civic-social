'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  Globe,
  Users as UsersIcon,
  Check,
  SkipForward,
  Loader2,
  Search,
  HelpCircle,
} from 'lucide-react';
import clsx from 'clsx';
import { countries, getPartiesForCountry, type Party } from '@/lib/data/countries';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

// ─── Topics for feed personalization ─────────────────────────

const TOPIC_OPTIONS = [
  { id: 'economy', label: 'Economy & Jobs', emoji: '💼' },
  { id: 'healthcare', label: 'Healthcare', emoji: '🏥' },
  { id: 'immigration', label: 'Immigration', emoji: '🌍' },
  { id: 'climate', label: 'Climate & Energy', emoji: '🌱' },
  { id: 'education', label: 'Education', emoji: '📚' },
  { id: 'criminal-justice', label: 'Criminal Justice', emoji: '⚖️' },
  { id: 'technology', label: 'Technology & AI', emoji: '🤖' },
  { id: 'defense', label: 'Defense & Security', emoji: '🛡️' },
  { id: 'infrastructure', label: 'Infrastructure', emoji: '🏗️' },
  { id: 'housing', label: 'Housing', emoji: '🏠' },
  { id: 'elections', label: 'Elections', emoji: '🗳️' },
  { id: 'foreign-policy', label: 'Foreign Policy', emoji: '🌐' },
  { id: 'civil-rights', label: 'Civil Rights', emoji: '✊' },
  { id: 'taxation', label: 'Taxation', emoji: '💰' },
  { id: 'social-policy', label: 'Social Policy', emoji: '🤝' },
  { id: 'media', label: 'Media & Misinformation', emoji: '📰' },
];

type Step = 'account' | 'personalize' | 'complete';

export default function RegisterPage() {
  // ─── Step 1: Account fields ────────────────────────────────
  const [step, setStep] = useState<Step>('account');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupError, setSignupError] = useState('');

  // ─── Step 2: Personalization fields ────────────────────────
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedParty, setSelectedParty] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [partySearch, setPartySearch] = useState('');

  const auth = useAuth();
  const router = useRouter();

  const steps: Step[] = ['account', 'personalize', 'complete'];
  const currentIdx = steps.indexOf(step);

  const countryParties: Party[] = useMemo(() => {
    if (!selectedCountry) return [];
    return getPartiesForCountry(selectedCountry);
  }, [selectedCountry]);

  const filteredParties: Party[] = useMemo(() => {
    if (!partySearch.trim()) return countryParties;
    const q = partySearch.trim().toLowerCase();
    return countryParties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.abbreviation.toLowerCase().includes(q) ||
        p.ideology.toLowerCase().includes(q),
    );
  }, [countryParties, partySearch]);

  // ─── Handlers ──────────────────────────────────────────────

  function handleCountrySelect(code: string) {
    setSelectedCountry(code);
    setSelectedParty('');
    setPartySearch('');
  }

  function toggleTopic(id: string) {
    setSelectedTopics((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  const handleCreateAccount = useCallback(async () => {
    setSignupError('');
    if (!email || !email.includes('@')) {
      setSignupError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 8) {
      setSignupError('Password must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const name = displayName.trim() || email.split('@')[0];
      const result = await auth.signup(email, password, name);
      if (!result.success) {
        setSignupError(result.error || 'Something went wrong.');
        return;
      }
      setStep('personalize');
    } catch {
      setSignupError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, displayName, auth]);

  const handleSavePersonalization = useCallback(async () => {
    auth.updateOnboarding({
      country: selectedCountry,
      affiliation: selectedParty,
      topics: selectedTopics.length > 0 ? selectedTopics : ['economy', 'healthcare', 'education'],
    });
    await auth.completeOnboarding();
    setStep('complete');
  }, [selectedCountry, selectedParty, selectedTopics, auth]);

  const handleSkipPersonalization = useCallback(async () => {
    auth.updateOnboarding({
      country: 'US',
      affiliation: '',
      topics: ['economy', 'healthcare', 'education', 'climate'],
    });
    await auth.completeOnboarding();
    setStep('complete');
  }, [auth]);

  // ─── Derived state ────────────────────────────────────────

  const canCreateAccount = email.includes('@') && password.length >= 8;
  const topicCount = selectedTopics.length;

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Left — branding panel (desktop) */}
      <div className="hidden lg:flex lg:w-[480px] bg-[#1a1a1a] p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-[400px] h-[400px] top-[20%] left-[-10%] opacity-[0.08] blur-[100px]" style={{ background: 'radial-gradient(ellipse, rgba(255,255,255,0.4) 0%, transparent 70%)' }} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-14">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="text-white">
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="currentColor" />
            </svg>
            <span className="text-xl font-bold text-white">Civic Social</span>
          </div>

          <h2 className="text-3xl font-bold text-white leading-tight mb-5">
            Where ideas compete,
            <br />
            not identities.
          </h2>
          <p className="text-white/70 text-base leading-relaxed">
            Join a platform built for civil discourse, evidence-based debate, and solution-driven
            civic engagement. No rage algorithms. No echo chambers. No ad tracking.
          </p>
        </div>

        <div className="space-y-5 text-white/60 text-sm">
          <div className="flex items-center gap-3">
            <Lock className="w-4 h-4" />
            <span>End-to-end encryption &middot; GDPR compliant</span>
          </div>
          <div className="flex items-center gap-3">
            <Globe className="w-4 h-4" />
            <span>Multi-country political systems supported</span>
          </div>
          <div className="flex items-center gap-3">
            <UsersIcon className="w-4 h-4" />
            <span>Transparency over tribalism</span>
          </div>
        </div>
      </div>

      {/* Right — registration form */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-[440px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="text-text-primary">
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="currentColor" />
            </svg>
            <span className="text-lg font-bold text-text-primary">Civic Social</span>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-10">
            <div className={clsx('h-1 flex-1 rounded-full transition-colors', currentIdx >= 0 ? 'bg-civic' : 'bg-surface-active')} />
            <div className={clsx('h-1 flex-1 rounded-full transition-colors', currentIdx >= 1 ? 'bg-civic' : 'bg-surface-active')} />
          </div>

          {/* ═══ STEP 1: Create Account ═══ */}
          {step === 'account' && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold text-text-primary mb-2">
                Create your Account
              </h2>
              <p className="text-sm text-text-muted mb-8">
                Fast signup — just email and password. Your data is encrypted and never sold.
              </p>

              <div className="space-y-5">
                {/* Display name */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Display Name <span className="text-text-muted">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name (or skip — we'll use your email)"
                    className="w-full px-4 py-3.5 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-civic/40 focus:border-civic transition-colors"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3.5 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-civic/40 focus:border-civic transition-colors"
                    autoFocus
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full px-4 py-3.5 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-civic/40 focus:border-civic transition-colors pr-12"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && canCreateAccount) handleCreateAccount();
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                    </button>
                  </div>
                </div>
              </div>

              {signupError && (
                <div className="flex items-center gap-3 p-3.5 mt-5 bg-danger/10 rounded-xl animate-fade-in">
                  <p className="text-sm text-danger-light">{signupError}</p>
                </div>
              )}

              <button
                onClick={handleCreateAccount}
                disabled={!canCreateAccount || isSubmitting}
                className={clsx(
                  'w-full mt-7 px-4 py-3.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors',
                  canCreateAccount && !isSubmitting
                    ? 'bg-civic text-white hover:bg-civic-dark'
                    : 'bg-surface-active text-text-muted cursor-not-allowed',
                )}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Sign up
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Privacy note */}
              <div className="mt-5 p-4 bg-surface-elevated rounded-xl">
                <div className="flex items-start gap-3">
                  <Lock className="w-4 h-4 text-positive mt-0.5 shrink-0" />
                  <p className="text-xs text-text-muted leading-relaxed">
                    Zero third-party data selling. End-to-end encryption. GDPR &amp; CCPA compliant. You can delete all data anytime.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ═══ STEP 2: Personalize Feed ═══ */}
          {step === 'personalize' && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold text-text-primary">
                  Personalize your feed
                </h2>
                <button
                  onClick={handleSkipPersonalization}
                  className="flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-civic-light transition-colors"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  Skip
                </button>
              </div>
              <p className="text-sm text-text-muted mb-7">
                Help us build your ideal feed. You can change these anytime.
              </p>

              {/* ── Country selection ── */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Country
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                  {countries.map((country) => (
                    <button
                      key={country.code}
                      onClick={() => handleCountrySelect(country.code)}
                      className={clsx(
                        'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm transition-colors',
                        selectedCountry === country.code
                          ? 'bg-civic-subtle border border-civic/30 text-text-primary font-medium'
                          : 'bg-surface border border-border hover:bg-surface-hover text-text-secondary',
                      )}
                    >
                      <span>{country.flag}</span>
                      <span className="truncate text-xs">{country.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Political Affiliation ── */}
              {selectedCountry && (
                <div className="mb-5 animate-fade-in">
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Political Affiliation{' '}
                    <span className="text-text-muted">(optional)</span>
                  </label>

                  {countryParties.length > 5 && (
                    <div className="relative mb-2.5">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                      <input
                        type="text"
                        value={partySearch}
                        onChange={(e) => setPartySearch(e.target.value)}
                        placeholder="Search parties..."
                        className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-civic/40 transition-colors"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                    {filteredParties.length === 0 && partySearch ? (
                      <p className="text-xs text-text-muted py-2 px-1">
                        No parties matching &quot;{partySearch}&quot;.
                        Try &quot;Independent&quot; or &quot;Undeclared&quot;.
                      </p>
                    ) : (
                      filteredParties.map((party) => (
                        <button
                          key={party.slug}
                          onClick={() =>
                            setSelectedParty(selectedParty === party.id ? '' : party.id)
                          }
                          className={clsx(
                            'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors',
                            selectedParty === party.id
                              ? 'bg-civic-subtle border border-civic/30 text-text-primary'
                              : 'bg-surface border border-border hover:bg-surface-hover text-text-secondary',
                            party.isSpecial && 'border-dashed',
                          )}
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: party.color }}
                          />
                          <span>{party.name}</span>
                          {party.abbreviation && (
                            <span className="text-xs text-text-muted">
                              ({party.abbreviation})
                            </span>
                          )}
                          {selectedParty === party.id && (
                            <Check className="w-3.5 h-3.5 ml-0.5 text-civic shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <HelpCircle className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <p className="text-xs text-text-muted">
                      You can hide this later in Settings. Not listed? Choose &quot;Independent&quot; or &quot;Undeclared&quot;.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Topic selection ── */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Topics of interest <span className="text-text-muted">(pick 3-10)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {TOPIC_OPTIONS.map((topic) => {
                    const isSelected = selectedTopics.includes(topic.id);
                    return (
                      <button
                        key={topic.id}
                        onClick={() => toggleTopic(topic.id)}
                        className={clsx(
                          'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-medium transition-colors',
                          isSelected
                            ? 'bg-civic-subtle border border-civic/30 text-civic-light'
                            : 'bg-surface border border-border hover:bg-surface-hover text-text-secondary',
                        )}
                      >
                        <span>{topic.emoji}</span>
                        <span className="truncate">{topic.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 ml-auto text-civic shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                {topicCount > 0 && (
                  <p className="text-xs text-text-muted mt-2">
                    {topicCount} topic{topicCount !== 1 ? 's' : ''} selected
                    {topicCount < 3
                      ? ' — pick at least 3 for a great feed'
                      : topicCount > 10
                        ? ' — consider narrowing down'
                        : ''}
                  </p>
                )}
              </div>

              {/* Continue button */}
              <button
                onClick={handleSavePersonalization}
                className="w-full px-4 py-3.5 bg-civic text-white text-sm font-semibold rounded-xl hover:bg-civic-dark transition-colors flex items-center justify-center gap-2"
              >
                {selectedCountry || topicCount >= 3 ? 'Start Exploring' : 'Continue with Defaults'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ═══ COMPLETE: Welcome screen ═══ */}
          {step === 'complete' && (
            <div className="animate-fade-in text-center py-10">
              <div className="w-[72px] h-[72px] rounded-2xl bg-positive/10 flex items-center justify-center mx-auto mb-5">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="text-positive">
                  <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="currentColor" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-text-primary mb-3">
                Welcome to Civic Social
              </h2>
              <p className="text-sm text-text-muted mb-8 max-w-sm mx-auto">
                Your personalized feed is ready. We have curated high-quality content based on your interests.
              </p>

              <div className="flex justify-center gap-8 mb-10">
                <div className="text-center">
                  <p className="text-xl font-bold text-civic-light">{selectedTopics.length || 4}</p>
                  <p className="text-xs text-text-muted mt-1">Topics</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-positive-light">100%</p>
                  <p className="text-xs text-text-muted mt-1">Diverse</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-warning-light">0</p>
                  <p className="text-xs text-text-muted mt-1">Ads</p>
                </div>
              </div>

              <button
                onClick={() => router.push('/')}
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-civic text-white text-sm font-semibold rounded-xl hover:bg-civic-dark transition-colors"
              >
                Enter the Platform
                <ChevronRight className="w-4 h-4" />
              </button>

              <p className="text-xs text-text-muted mt-5">
                You can update your preferences anytime in{' '}
                <Link href="/settings" className="text-civic-light hover:text-civic transition-colors">
                  Settings
                </Link>
              </p>
            </div>
          )}

          {/* Login link */}
          {step === 'account' && (
            <p className="text-sm text-text-muted text-center mt-8">
              Already have an account?{' '}
              <Link href="/login" className="text-civic-light font-semibold hover:text-civic transition-colors">
                Sign in
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
