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
import { validateDisplayName } from '@/lib/display-name-validator';

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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [displayNameError, setDisplayNameError] = useState('');

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

    // Validate display name (required + profanity check)
    const nameCheck = validateDisplayName(displayName);
    if (!nameCheck.valid) {
      setSignupError(nameCheck.error || 'Please enter a valid display name.');
      return;
    }
    if (!email || !email.includes('@')) {
      setSignupError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 8) {
      setSignupError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setSignupError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const name = displayName.trim();
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

  const canCreateAccount = displayName.trim().length >= 2 && !displayNameError && email.includes('@') && password.length >= 8 && password === confirmPassword;
  const topicCount = selectedTopics.length;

  return (
    <div className="min-h-screen flex" style={{ background: '#0a0a09' }}>
      {/* Noise overlay */}
      <div className="fixed inset-0 z-[1] pointer-events-none opacity-[0.035]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />

      {/* Left — branding panel (desktop) */}
      <div className="hidden lg:flex lg:w-[480px] p-12 flex-col justify-between relative overflow-hidden" style={{ background: '#0d0c0a' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-[400px] h-[400px] top-[20%] left-[-10%] opacity-[0.04] blur-[100px]" style={{ background: 'radial-gradient(ellipse, rgba(194,168,120,0.4) 0%, transparent 70%)' }} />
        </div>
        <div className="relative z-10">
          <Link href="/" className="landing-serif-title text-lg uppercase tracking-[0.05em] mb-14 block" style={{ color: '#f4f0ea' }}>
            Civic Social
          </Link>

          <h2 className="landing-serif-title text-4xl leading-tight mb-5" style={{ color: '#f4f0ea' }}>
            Where ideas compete,
            <br />
            not identities.
          </h2>
          <p className="text-base leading-relaxed" style={{ color: 'rgba(244,240,234,0.65)' }}>
            Join a platform built for civil discourse, evidence-based debate, and solution-driven
            civic engagement. No rage algorithms. No echo chambers. No ad tracking.
          </p>
        </div>

        <div className="space-y-5 text-sm" style={{ color: 'rgba(244,240,234,0.5)' }}>
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
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8 relative z-10">
        <div className="w-full max-w-[440px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <Link href="/" className="landing-serif-title text-lg uppercase tracking-[0.05em]" style={{ color: '#f4f0ea' }}>
              Civic Social
            </Link>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-10">
            <div className={clsx('h-1 flex-1 rounded-full transition-colors', currentIdx >= 0 ? 'bg-[#c2a878]' : 'bg-[rgba(244,240,234,0.08)]')} />
            <div className={clsx('h-1 flex-1 rounded-full transition-colors', currentIdx >= 1 ? 'bg-[#c2a878]' : 'bg-[rgba(244,240,234,0.08)]')} />
          </div>

          {/* ═══ STEP 1: Create Account ═══ */}
          {step === 'account' && (
            <div className="animate-fade-in">
              <h2 className="landing-serif-title text-3xl mb-2" style={{ color: '#f4f0ea' }}>
                Create your Account
              </h2>
              <p className="text-sm mb-8" style={{ color: 'rgba(244,240,234,0.65)' }}>
                Choose a display name, email, and password. Your data is encrypted and never sold.
              </p>

              <div className="space-y-5">
                {/* Display name */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      // Real-time validation as user types
                      if (e.target.value.trim().length > 0) {
                        const check = validateDisplayName(e.target.value);
                        setDisplayNameError(check.valid ? '' : (check.error || ''));
                      } else {
                        setDisplayNameError('');
                      }
                    }}
                    placeholder="Your display name"
                    className={clsx(
                      'w-full px-4 py-3.5 bg-surface border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 transition-colors',
                      displayNameError
                        ? 'border-danger focus:ring-danger/40 focus:border-danger'
                        : 'border-border focus:ring-civic/40 focus:border-civic',
                    )}
                  />
                  {displayNameError && (
                    <p className="text-xs text-danger-light mt-1.5 animate-fade-in">{displayNameError}</p>
                  )}
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
                      autoComplete="new-password"
                      className="w-full px-4 py-3.5 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-civic/40 focus:border-civic transition-colors pr-12"
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

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      autoComplete="new-password"
                      className={`w-full px-4 py-3.5 bg-surface border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-civic/40 focus:border-civic transition-colors pr-12 ${
                        confirmPassword && confirmPassword !== password
                          ? 'border-danger/50'
                          : 'border-border'
                      }`}
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
                  {confirmPassword && confirmPassword !== password && (
                    <p className="text-xs text-danger-light mt-1.5">Passwords do not match</p>
                  )}
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
            <p className="text-sm text-center mt-8" style={{ color: 'rgba(244,240,234,0.65)' }}>
              Already have an account?{' '}
              <Link href="/login" className="font-semibold transition-colors hover:opacity-80" style={{ color: '#c2a878' }}>
                Sign in
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
