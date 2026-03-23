'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(email, password, rememberMe);

    if (result.success) {
      window.location.href = '/';
    } else {
      setError(result.error || 'Sign-in failed. Please try again.');
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5 sm:p-8 relative overflow-hidden" style={{ background: '#0a0a09' }}>
      {/* Warm fog background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-[600px] h-[500px] top-[10%] left-[10%] opacity-[0.04] blur-[100px]" style={{ background: 'radial-gradient(ellipse, rgba(194,168,120,0.4) 0%, transparent 70%)' }} />
        <div className="absolute w-[400px] h-[400px] bottom-[10%] right-[10%] opacity-[0.03] blur-[80px]" style={{ background: 'radial-gradient(ellipse, rgba(139,163,181,0.3) 0%, transparent 70%)' }} />
      </div>

      {/* Noise overlay */}
      <div className="fixed inset-0 z-[1] pointer-events-none opacity-[0.035]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />

      <div className="w-full max-w-[420px] animate-fade-in relative z-10">
        {/* ── Logo header ── */}
        <div className="flex flex-col items-center mb-10">
          <Link href="/" className="landing-serif-title text-lg uppercase tracking-[0.05em] mb-6" style={{ color: '#f4f0ea' }}>
            Civic Social
          </Link>
          <h1 className="landing-serif-title text-3xl tracking-tight" style={{ color: '#f4f0ea' }}>
            Welcome Back
          </h1>
          <p className="text-sm mt-2" style={{ color: 'rgba(244,240,234,0.65)' }}>
            Enter your credentials to continue
          </p>
        </div>

        {/* ── Card ── */}
        <div
          className="rounded-2xl p-7 sm:p-8 backdrop-blur-xl"
          style={{
            background: 'linear-gradient(145deg, rgba(20,18,16,0.6) 0%, rgba(10,10,9,0.4) 100%)',
            borderTop: '1px solid rgba(244,240,234,0.1)',
            borderLeft: '1px solid rgba(244,240,234,0.04)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
          }}
        >
          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-3 p-3.5 mb-6 bg-danger/10 rounded-xl animate-fade-in">
              <AlertCircle className="w-4.5 h-4.5 text-danger-light shrink-0" />
              <p className="text-sm text-danger-light">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(244,240,234,0.65)' }}>
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3.5 rounded-xl text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#c2a878]/40 focus:border-[#c2a878]/60"
                style={{
                  background: 'rgba(20,18,16,0.6)',
                  border: '1px solid rgba(244,240,234,0.08)',
                  color: '#f4f0ea',
                }}
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(244,240,234,0.65)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full px-4 py-3.5 rounded-xl text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#c2a878]/40 focus:border-[#c2a878]/60 pr-12"
                  style={{
                    background: 'rgba(20,18,16,0.6)',
                    border: '1px solid rgba(244,240,234,0.08)',
                    color: '#f4f0ea',
                  }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors hover:opacity-100"
                  style={{ color: '#f4f0ea', opacity: 0.7 }}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-[18px] h-[18px]" />
                  ) : (
                    <Eye className="w-[18px] h-[18px]" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember me + forgot password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#c2a878]"
                  style={{ borderColor: 'rgba(244,240,234,0.2)', background: 'rgba(20,18,16,0.6)' }}
                />
                <span className="text-sm" style={{ color: 'rgba(244,240,234,0.65)' }}>Remember me</span>
              </label>
              <Link
                href="/forgot-password"
                className="text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: '#c2a878' }}
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className={clsx(
                'w-full flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold rounded-xl transition-all mt-2 uppercase tracking-[0.1em]',
                isLoading
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:opacity-90 active:scale-[0.98]',
              )}
              style={{
                background: isLoading ? 'rgba(244,240,234,0.4)' : '#f4f0ea',
                color: '#0a0a09',
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* ── Divider ── */}
          <div className="flex items-center gap-3 my-7">
            <div className="flex-1 h-px" style={{ background: 'rgba(244,240,234,0.08)' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(244,240,234,0.4)' }}>
              or continue with
            </span>
            <div className="flex-1 h-px" style={{ background: 'rgba(244,240,234,0.08)' }} />
          </div>

          {/* ── OAuth buttons ── */}
          <div className="grid grid-cols-2 gap-3">
            <button
              disabled
              className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium cursor-not-allowed opacity-30 transition-colors"
              style={{
                background: 'rgba(20,18,16,0.6)',
                border: '1px solid rgba(244,240,234,0.06)',
                color: 'rgba(244,240,234,0.5)',
              }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google
            </button>

            <button
              disabled
              className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium cursor-not-allowed opacity-30 transition-colors"
              style={{
                background: 'rgba(20,18,16,0.6)',
                border: '1px solid rgba(244,240,234,0.06)',
                color: 'rgba(244,240,234,0.5)',
              }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              Apple
            </button>
          </div>
        </div>

        {/* ── Footer ── */}
        <p className="text-sm text-center mt-8" style={{ color: 'rgba(244,240,234,0.65)' }}>
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            className="font-semibold transition-colors hover:opacity-80"
            style={{ color: '#c2a878' }}
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
