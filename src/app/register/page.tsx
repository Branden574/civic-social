'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Shield,
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

  // ─── Party list: computed from country, never appended ─────
  // getPartiesForCountry already returns a deduplicated, sorted list.
  // We compute it fresh on every country change — no concat/append.

  const countryParties: Party[] = useMemo(() => {
    if (!selectedCountry) return [];
    return getPartiesForCountry(selectedCountry);
  }, [selectedCountry]);

  // ─── Filtered by search ────────────────────────────────────
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
    setSelectedParty('');   // Reset party on country change
    setPartySearch('');     // Reset search on country change
  }

  function toggleTopic(id: string) {
    setSelectedTopics((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  // Step 1 → create account immediately, then show personalization
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

  // Step 2 → save onboarding preferences
  const handleSavePersonalization = useCallback(async () => {
    auth.updateOnboarding({
      country: selectedCountry,
      affiliation: selectedParty,
      topics: selectedTopics.length > 0 ? selectedTopics : ['economy', 'healthcare', 'education'],
    });
    await auth.completeOnboarding();
    setStep('complete');
  }, [selectedCountry, selectedParty, selectedTopics, auth]);

  // Skip personalization with defaults
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
      <div className="hidden lg:flex lg:w-[480px] bg-gradient-to-br from-civic-dark via-civic to-civic-light p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Civic Social</span>
          </div>

          <h2 className="text-3xl font-bold text-white leading-tight mb-4">
            Where ideas compete,
            <br />
            not identities.
          </h2>
          <p className="text-white/70 text-base leading-relaxed">
            Join a platform built for civil discourse, evidence-based debate, and solution-driven
            civic engagement. No rage algorithms. No echo chambers. No ad tracking.
          </p>
        </div>

        <div className="space-y-4 text-white/60 text-sm">
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
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-lg bg-civic flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-text-primary">Civic Social</span>
          </div>

          {/* Progress bar — 2 steps */}
          <div className="flex items-center gap-2 mb-8">
            <div className={clsx('h-1 flex-1 rounded-full transition-colors', currentIdx >= 0 ? 'bg-civic' : 'bg-surface-active')} />
            <div className={clsx('h-1 flex-1 rounded-full transition-colors', currentIdx >= 1 ? 'bg-civic' : 'bg-surface-active')} />
          </div>

          {/* ═══════════════════════════════════════════════════════ */}
          {/* STEP 1: Create Account (< 30 seconds)                 */}
          {/* ═══════════════════════════════════════════════════════ */}
          {step === 'account' && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold text-text-primary mb-1">
                Create your account
              </h2>
              <p className="text-sm text-text-muted mb-6">
                Fast signup — just email and password. Your data is encrypted and never sold.
              </p>

              <div className="space-y-4">
                {/* Display name (optional) */}
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                    Display Name <span className="text-text-muted font-normal normal-case">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name (or skip — we'll use your email)"
                    className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-civic/50 focus:border-civic transition-all"
                  />
                </div>

                {/* Email (required) */}
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-civic/50 focus:border-civic transition-all"
                    autoFocus
                  />
                </div>

                {/* Password (required) */}
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-civic/50 focus:border-civic transition-all pr-10"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && canCreateAccount) handleCreateAccount();
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {signupError && (
                <p className="text-xs text-danger-light mt-3 text-center">
                  {signupError}
                </p>
              )}

              <button
                onClick={handleCreateAccount}
                disabled={!canCreateAccount || isSubmitting}
                className={clsx(
                  'w-full mt-6 px-4 py-2.5 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all',
                  canCreateAccount && !isSubmitting
                    ? 'bg-civic text-white hover:bg-civic-dark'
                    : 'bg-surface-active text-text-muted cursor-not-allowed',
                )}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Create Account
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Privacy note */}
              <div className="mt-4 p-3 bg-surface-elevated rounded-lg border border-border-subtle">
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-positive mt-0.5 shrink-0" />
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    Zero third-party data selling. End-to-end encryption. GDPR &amp; CCPA compliant. You can delete all data anytime.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════ */}
          {/* STEP 2: Personalize Feed (< 30 seconds, skippable)    */}
          {/* ═══════════════════════════════════════════════════════ */}
          {step === 'personalize' && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-2xl font-bold text-text-primary">
                  Personalize your feed
                </h2>
                <button
                  onClick={handleSkipPersonalization}
                  className="flex items-center gap-1 text-xs font-medium text-text-muted hover:text-civic-light transition-colors"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  Skip
                </button>
              </div>
              <p className="text-sm text-text-muted mb-5">
                Help us build your ideal feed. You can change these anytime.
              </p>

              {/* ── Country selection ── */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                  Country
                </label>
                <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
                  {countries.map((country) => (
                    <button
                      key={country.code}
                      onClick={() => handleCountrySelect(country.code)}
                      className={clsx(
                        'flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-all',
                        selectedCountry === country.code
                          ? 'bg-civic/10 border border-civic/30 text-text-primary font-medium'
                          : 'bg-surface-elevated border border-border-subtle hover:bg-surface-hover text-text-secondary',
                      )}
                    >
                      <span>{country.flag}</span>
                      <span className="truncate text-xs">{country.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Political Affiliation (optional, deduplicated) ── */}
              {selectedCountry && (
                <div className="mb-4 animate-fade-in">
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                    Political Affiliation{' '}
                    <span className="text-text-muted font-normal normal-case">(optional)</span>
                  </label>

                  {/* Search bar */}
                  {countryParties.length > 5 && (
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                      <input
                        type="text"
                        value={partySearch}
                        onChange={(e) => setPartySearch(e.target.value)}
                        placeholder="Search parties..."
                        className="w-full pl-8 pr-3 py-1.5 bg-surface-elevated border border-border-subtle rounded-lg text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-civic/40 transition-all"
                      />
                    </div>
                  )}

                  {/* Party list */}
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
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
                            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                            selectedParty === party.id
                              ? 'bg-civic/10 border border-civic/30 text-text-primary ring-1 ring-civic/20'
                              : 'bg-surface-elevated border border-border-subtle hover:bg-surface-hover text-text-secondary',
                            party.isSpecial && 'border-dashed',
                          )}
                        >
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: party.color }}
                          />
                          <span>{party.name}</span>
                          {party.abbreviation && (
                            <span className="text-[10px] text-text-muted">
                              ({party.abbreviation})
                            </span>
                          )}
                          {selectedParty === party.id && (
                            <Check className="w-3 h-3 ml-0.5 text-civic shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  {/* Helper text */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <HelpCircle className="w-3 h-3 text-text-muted shrink-0" />
                    <p className="text-[10px] text-text-muted">
                      You can hide this later in Settings. Not listed? Choose &quot;Independent&quot; or &quot;Undeclared&quot;.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Topic selection ── */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                  Topics of interest <span className="text-text-muted font-normal normal-case">(pick 3-10)</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {TOPIC_OPTIONS.map((topic) => {
                    const isSelected = selectedTopics.includes(topic.id);
                    return (
                      <button
                        key={topic.id}
                        onClick={() => toggleTopic(topic.id)}
                        className={clsx(
                          'flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs font-medium transition-all',
                          isSelected
                            ? 'bg-civic/10 border border-civic/30 text-civic-light'
                            : 'bg-surface-elevated border border-border-subtle hover:bg-surface-hover text-text-secondary',
                        )}
                      >
                        <span>{topic.emoji}</span>
                        <span className="truncate">{topic.label}</span>
                        {isSelected && <Check className="w-3 h-3 ml-auto text-civic shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                {topicCount > 0 && (
                  <p className="text-[11px] text-text-muted mt-1.5">
                    {topicCount} topic{topicCount !== 1 ? 's' : ''} selected
                    {topicCount < 3
                      ? ' — pick at least 3 for a great feed'
                      : topicCount > 10
                        ? ' — consider narrowing down'
                        : ' ✓'}
                  </p>
                )}
              </div>

              {/* Continue button */}
              <button
                onClick={handleSavePersonalization}
                className="w-full px-4 py-2.5 bg-civic text-white text-sm font-semibold rounded-lg hover:bg-civic-dark transition-colors flex items-center justify-center gap-2"
              >
                {selectedCountry || topicCount >= 3 ? 'Start Exploring' : 'Continue with Defaults'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════ */}
          {/* COMPLETE: Welcome screen                               */}
          {/* ═══════════════════════════════════════════════════════ */}
          {step === 'complete' && (
            <div className="animate-fade-in text-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-positive/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-positive" />
              </div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">
                Welcome to Civic Social
              </h2>
              <p className="text-sm text-text-muted mb-6 max-w-sm mx-auto">
                Your personalized feed is ready. We have curated high-quality content based on your interests.
              </p>

              <div className="flex justify-center gap-6 mb-8">
                <div className="text-center">
                  <p className="text-lg font-bold text-civic-light">{selectedTopics.length || 4}</p>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider">Topics</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-positive-light">100%</p>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider">Diverse</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-warning-light">0</p>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider">Ads</p>
                </div>
              </div>

              <button
                onClick={() => router.push('/')}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-civic text-white text-sm font-semibold rounded-lg hover:bg-civic-dark transition-colors"
              >
                Enter the Platform
                <ChevronRight className="w-4 h-4" />
              </button>

              <p className="text-[11px] text-text-muted mt-4">
                You can update your preferences anytime in{' '}
                <Link href="/settings" className="text-civic-light hover:underline">
                  Settings
                </Link>
              </p>
            </div>
          )}

          {/* Login link */}
          {step === 'account' && (
            <p className="text-xs text-text-muted text-center mt-6">
              Already have an account?{' '}
              <Link href="/login" className="text-civic-light font-medium hover:underline">
                Sign in
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
