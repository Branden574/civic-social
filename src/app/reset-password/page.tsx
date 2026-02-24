'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Missing reset token. Please use the link from your email.');
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(59,130,246,.18) 0%, transparent 70%), #09090f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: 'rgba(255,255,255,.04)',
        border: '1px solid rgba(255,255,255,.08)',
        borderRadius: '16px',
        padding: '40px 36px',
        width: '100%',
        maxWidth: '420px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <span style={{ color: '#3b82f6', fontSize: '2rem' }}>◈</span>
          <h1 style={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.4rem', marginTop: '8px', marginBottom: '4px' }}>
            Set new password
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Choose a strong password for your account.
          </p>
        </div>

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              background: 'rgba(34,197,94,.12)',
              border: '1px solid rgba(34,197,94,.25)',
              borderRadius: '10px',
              padding: '16px',
              color: '#86efac',
              marginBottom: '24px',
              fontSize: '0.9rem',
            }}>
              Your password has been updated successfully.
            </div>
            <Link
              href="/login"
              style={{
                display: 'inline-block',
                background: '#3b82f6',
                color: '#fff',
                padding: '10px 28px',
                borderRadius: '10px',
                fontWeight: 600,
                textDecoration: 'none',
                fontSize: '0.9rem',
              }}
            >
              Sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
              <div style={{
                background: 'rgba(239,68,68,.12)',
                border: '1px solid rgba(239,68,68,.25)',
                borderRadius: '8px',
                padding: '12px',
                color: '#fca5a5',
                fontSize: '0.875rem',
              }}>
                {error}
              </div>
            )}

            <div>
              <label style={{ color: '#94a3b8', fontSize: '0.85rem', display: 'block', marginBottom: '6px' }}>
                New password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                disabled={!token || loading}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,.06)',
                  border: '1px solid rgba(255,255,255,.1)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  color: '#f8fafc',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ color: '#94a3b8', fontSize: '0.85rem', display: 'block', marginBottom: '6px' }}>
                Confirm new password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your new password"
                required
                disabled={!token || loading}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,.06)',
                  border: '1px solid rgba(255,255,255,.1)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  color: '#f8fafc',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={!token || loading}
              style={{
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '12px',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                marginTop: '4px',
              }}
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>

            <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
              <Link href="/login" style={{ color: '#60a5fa', textDecoration: 'none' }}>
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#09090f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#3b82f6', fontSize: '2rem' }}>◈</span>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
