'use client';

import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import { Settings, Shield, Bell, Eye, Palette, Globe, Trash2, Download, Sun, Moon, Monitor, VolumeX, X, Plus, Check, Camera, Loader2, ImageIcon } from 'lucide-react';
import clsx from 'clsx';
import { useState, useRef, useCallback } from 'react';
import { useTheme } from '@/lib/theme-context';
import { useAuth } from '@/lib/auth-context';
import { AuthGate } from '@/components/auth/auth-gate';

export default function SettingsPage() {
  return (
    <AuthGate>
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-2xl mx-auto">
          <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl border-b border-border-subtle px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-civic-light" />
              <h1 className="text-lg font-bold text-text-primary">Settings</h1>
            </div>
          </header>

          <div className="px-4 sm:px-6 py-6 space-y-6">
            {/* Profile Photo & Banner */}
            <ProfileMediaSection />

            {/* Privacy & Security */}
            <SettingsSection icon={Shield} title="Privacy & Security">
              <ToggleSetting
                label="End-to-end encrypted DMs"
                description="All direct messages are encrypted by default"
                enabled={true}
                locked
              />
              <ToggleSetting
                label="Anonymous browsing mode"
                description="Browse without recording engagement data"
                enabled={false}
              />
              <ToggleSetting
                label="Two-factor authentication"
                description="Add an extra layer of security"
                enabled={true}
              />
              <ToggleSetting
                label="Show political affiliation"
                description="Display your affiliation on your profile"
                enabled={true}
              />
            </SettingsSection>

            {/* Notifications */}
            <SettingsSection icon={Bell} title="Notifications">
              <ToggleSetting
                label="Cross-party replies"
                description="When someone from a different perspective replies to you"
                enabled={true}
              />
              <ToggleSetting
                label="Thread civility alerts"
                description="When a thread you're in drops in civility"
                enabled={true}
              />
              <ToggleSetting
                label="Policy lab updates"
                description="When proposals you follow are refined"
                enabled={true}
              />
              <ToggleSetting
                label="Live event reminders"
                description="Before civic events you've shown interest in"
                enabled={false}
              />
            </SettingsSection>

            {/* Feed */}
            <SettingsSection icon={Eye} title="Feed Preferences">
              <ToggleSetting
                label="Show algorithm explanation"
                description="Display 'Why am I seeing this?' on every post"
                enabled={true}
              />
              <ToggleSetting
                label="Viewpoint diversity boost"
                description="Actively surface perspectives different from yours"
                enabled={true}
              />
              <ToggleSetting
                label="Show quality scores"
                description="Display the algorithm's quality score on posts"
                enabled={true}
              />
            </SettingsSection>

            {/* Appearance */}
            <SettingsSection icon={Palette} title="Appearance">
              <ThemeToggleSetting />
            </SettingsSection>

            {/* Mute Filters */}
            <MuteFiltersSection />

            {/* Language */}
            <SettingsSection icon={Globe} title="Language & Region">
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-text-primary font-medium">Language</p>
                  <p className="text-xs text-text-muted">Interface language</p>
                </div>
                <select className="bg-surface-elevated border border-border text-text-primary text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-civic/50">
                  <option>English (US)</option>
                  <option>English (UK)</option>
                  <option>Español</option>
                  <option>Français</option>
                  <option>Deutsch</option>
                </select>
              </div>
            </SettingsSection>

            {/* Data */}
            <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">
                Your Data
              </h3>
              <div className="space-y-3">
                <button className="flex items-center gap-2 text-sm text-info-light hover:underline">
                  <Download className="w-4 h-4" />
                  Export all your data (GDPR)
                </button>
                <button className="flex items-center gap-2 text-sm text-danger-light hover:underline">
                  <Trash2 className="w-4 h-4" />
                  Delete all data and close account
                </button>
              </div>
              <p className="text-xs text-text-muted mt-3">
                Data deletion is permanent and irrecoverable. All your posts will be anonymized.
              </p>
            </div>
          </div>

          <div className="h-20 lg:h-8" />
        </div>
      </main>
      <MobileNav />
    </div>
    </AuthGate>
  );
}

function SettingsSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Shield;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-civic-light" />
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
          {title}
        </h3>
      </div>
      <div className="divide-y divide-border-subtle">{children}</div>
    </div>
  );
}

function ToggleSetting({
  label,
  description,
  enabled: initialEnabled,
  locked,
}: {
  label: string;
  description: string;
  enabled: boolean;
  locked?: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);

  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm text-text-primary font-medium">{label}</p>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
      <button
        onClick={() => !locked && setEnabled(!enabled)}
        className={clsx(
          'w-10 h-5 rounded-full transition-colors relative shrink-0',
          enabled ? 'bg-civic' : 'bg-surface-active',
          locked && 'opacity-60 cursor-not-allowed',
        )}
      >
        <div
          className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all"
          style={{ left: enabled ? '22px' : '2px' }}
        />
      </button>
    </div>
  );
}

function resizeImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality = 0.85,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;

        // For avatars (square), crop to center square first
        if (maxWidth === maxHeight) {
          const size = Math.min(w, h);
          const sx = (w - size) / 2;
          const sy = (h - size) / 2;
          canvas.width = maxWidth;
          canvas.height = maxHeight;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, sx, sy, size, size, 0, 0, maxWidth, maxHeight);
        } else {
          // For banners, scale to fit
          if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth; }
          if (h > maxHeight) { w = (w * maxHeight) / h; h = maxHeight; }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, w, h);
        }

        resolve(canvas.toDataURL('image/webp', quality));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ProfileMediaSection() {
  const { user, refreshMe } = useAuth();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Get existing avatar/banner from user data
  const existingAvatar = user?.avatar ?? null;
  const existingBanner = user?.bannerUrl ?? null;
  const displayAvatar = avatarPreview || existingAvatar;
  const displayBanner = bannerPreview || existingBanner;

  const initials = (user?.displayName || 'U')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleAvatarChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    try {
      const resized = await resizeImage(file, 256, 256);
      setAvatarPreview(resized);
      setAvatarUploading(true);

      const res = await fetch('/api/me/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: resized }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to upload avatar.');
        setAvatarPreview(null);
      } else {
        refreshMe();
      }
    } catch {
      setError('Failed to process image.');
      setAvatarPreview(null);
    } finally {
      setAvatarUploading(false);
    }
  }, [refreshMe]);

  const handleBannerChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    try {
      const resized = await resizeImage(file, 1200, 400, 0.8);
      setBannerPreview(resized);
      setBannerUploading(true);

      const res = await fetch('/api/me/banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banner: resized }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to upload banner.');
        setBannerPreview(null);
      } else {
        refreshMe();
      }
    } catch {
      setError('Failed to process image.');
      setBannerPreview(null);
    } finally {
      setBannerUploading(false);
    }
  }, [refreshMe]);

  return (
    <div className="bg-surface-elevated rounded-xl border border-border-subtle overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-5 mb-4">
        <Camera className="w-4 h-4 text-civic-light" />
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
          Profile Photo & Banner
        </h3>
      </div>

      {/* Banner */}
      <div className="relative mx-5 mb-4">
        <div
          className="h-32 rounded-xl bg-gradient-to-r from-civic-dark via-civic to-civic-light relative overflow-hidden cursor-pointer group"
          onClick={() => bannerInputRef.current?.click()}
        >
          {displayBanner && (
            <img src={displayBanner} alt="Banner" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-white text-sm font-medium">
              {bannerUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ImageIcon className="w-5 h-5" />
                  Change Banner
                </>
              )}
            </div>
          </div>
        </div>
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleBannerChange}
        />
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4 px-5 pb-5">
        <div
          className="relative w-20 h-20 rounded-full shrink-0 cursor-pointer group"
          onClick={() => avatarInputRef.current?.click()}
        >
          {displayAvatar ? (
            <img src={displayAvatar} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-border-subtle" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-surface border-2 border-border-subtle flex items-center justify-center text-xl font-bold text-civic-light">
              {initials}
            </div>
          )}
          <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              {avatarUploading ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-white" />
              )}
            </div>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">Profile Photo</p>
          <p className="text-xs text-text-muted">Click the photo or banner to change. PNG, JPG, or WebP.</p>
        </div>
      </div>

      {error && (
        <div className="mx-5 mb-5 p-3 bg-danger/5 border border-danger/20 rounded-lg text-xs text-danger-light">
          {error}
        </div>
      )}
    </div>
  );
}

function MuteFiltersSection() {
  const [mutedTopics, setMutedTopics] = useState<string[]>(['gun-control', 'abortion']);
  const [mutedKeywords, setMutedKeywords] = useState<string[]>(['rage-bait', 'fake news']);
  const [mutedAccounts, setMutedAccounts] = useState<string[]>(['@trollbot123']);
  const [newTopic, setNewTopic] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [newAccount, setNewAccount] = useState('');

  const addItem = (list: string[], setter: (v: string[]) => void, value: string, valueSetter: (v: string) => void) => {
    if (value.trim() && !list.includes(value.trim())) {
      setter([...list, value.trim()]);
      valueSetter('');
    }
  };

  const removeItem = (list: string[], setter: (v: string[]) => void, index: number) => {
    setter(list.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-surface-elevated rounded-xl border border-border-subtle p-5">
      <div className="flex items-center gap-2 mb-4">
        <VolumeX className="w-4 h-4 text-civic-light" />
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
          Mute Filters
        </h3>
      </div>
      <p className="text-xs text-text-muted mb-4">
        Muted topics, keywords, and accounts won&apos;t appear in your feed.
      </p>
      <div className="space-y-4">
        {/* Muted Topics */}
        <div>
          <p className="text-xs font-medium text-text-secondary mb-2">Muted Topics</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {mutedTopics.map((topic, i) => (
              <span key={topic} className="flex items-center gap-1 text-xs bg-surface px-2 py-1 rounded-full border border-border-subtle text-text-secondary">
                #{topic}
                <button onClick={() => removeItem(mutedTopics, setMutedTopics, i)} className="hover:text-danger-light">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem(mutedTopics, setMutedTopics, newTopic, setNewTopic)}
              placeholder="Add topic to mute..."
              className="flex-1 bg-surface border border-border text-text-primary text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-civic/50 placeholder:text-text-muted"
            />
            <button
              onClick={() => addItem(mutedTopics, setMutedTopics, newTopic, setNewTopic)}
              className="p-1.5 bg-surface border border-border-subtle rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-primary"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Muted Keywords */}
        <div>
          <p className="text-xs font-medium text-text-secondary mb-2">Muted Keywords</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {mutedKeywords.map((kw, i) => (
              <span key={kw} className="flex items-center gap-1 text-xs bg-surface px-2 py-1 rounded-full border border-border-subtle text-text-secondary">
                {kw}
                <button onClick={() => removeItem(mutedKeywords, setMutedKeywords, i)} className="hover:text-danger-light">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem(mutedKeywords, setMutedKeywords, newKeyword, setNewKeyword)}
              placeholder="Add keyword to mute..."
              className="flex-1 bg-surface border border-border text-text-primary text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-civic/50 placeholder:text-text-muted"
            />
            <button
              onClick={() => addItem(mutedKeywords, setMutedKeywords, newKeyword, setNewKeyword)}
              className="p-1.5 bg-surface border border-border-subtle rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-primary"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Muted Accounts */}
        <div>
          <p className="text-xs font-medium text-text-secondary mb-2">Muted Accounts</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {mutedAccounts.map((acc, i) => (
              <span key={acc} className="flex items-center gap-1 text-xs bg-surface px-2 py-1 rounded-full border border-border-subtle text-text-secondary">
                {acc}
                <button onClick={() => removeItem(mutedAccounts, setMutedAccounts, i)} className="hover:text-danger-light">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newAccount}
              onChange={(e) => setNewAccount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem(mutedAccounts, setMutedAccounts, newAccount, setNewAccount)}
              placeholder="@username to mute..."
              className="flex-1 bg-surface border border-border text-text-primary text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-civic/50 placeholder:text-text-muted"
            />
            <button
              onClick={() => addItem(mutedAccounts, setMutedAccounts, newAccount, setNewAccount)}
              className="p-1.5 bg-surface border border-border-subtle rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-primary"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThemeToggleSetting() {
  const { theme, preference, setPreference } = useTheme();

  const options: {
    value: 'light' | 'dark' | 'system';
    label: string;
    description: string;
    icon: typeof Sun;
    preview: { bg: string; surface: string; text: string; border: string };
  }[] = [
    {
      value: 'light',
      label: 'Light',
      description: 'Bright backgrounds, dark text',
      icon: Sun,
      preview: { bg: '#F8F9FC', surface: '#FFFFFF', text: '#111318', border: '#E2E4EC' },
    },
    {
      value: 'dark',
      label: 'Dark',
      description: 'Dark backgrounds, light text',
      icon: Moon,
      preview: { bg: '#0A0B0F', surface: '#141520', text: '#F0F1F8', border: '#262840' },
    },
    {
      value: 'system',
      label: 'System',
      description: 'Matches your device settings',
      icon: Monitor,
      preview: { bg: 'linear-gradient(135deg, #0A0B0F 50%, #F8F9FC 50%)', surface: '', text: '', border: '' },
    },
  ];

  return (
    <div className="py-3 space-y-3">
      <div>
        <p className="text-sm text-text-primary font-medium">Theme</p>
        <p className="text-xs text-text-muted">Choose how Civic Social looks to you</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {options.map((opt) => {
          const isSelected = preference === opt.value;
          const OptIcon = opt.icon;

          return (
            <button
              key={opt.value}
              onClick={() => setPreference(opt.value)}
              className={clsx(
                'relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200',
                isSelected
                  ? 'border-civic bg-civic/5 shadow-[0_0_0_1px_var(--color-civic)]'
                  : 'border-border-subtle hover:border-border hover:bg-surface-hover',
              )}
            >
              {/* Selection check */}
              {isSelected && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-civic flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}

              {/* Mini preview card */}
              <div
                className="w-full aspect-[4/3] rounded-lg border overflow-hidden flex flex-col"
                style={{
                  background: opt.value === 'system' ? opt.preview.bg : opt.preview.bg,
                  borderColor: opt.value === 'system' ? '#555' : opt.preview.border,
                }}
              >
                {opt.value !== 'system' ? (
                  <div className="flex-1 p-1.5 flex flex-col gap-1">
                    {/* Mini mockup: header bar */}
                    <div
                      className="h-1.5 w-3/4 rounded-full"
                      style={{ backgroundColor: opt.preview.text, opacity: 0.7 }}
                    />
                    {/* Mini mockup: content lines */}
                    <div
                      className="h-1 w-full rounded-full"
                      style={{ backgroundColor: opt.preview.text, opacity: 0.2 }}
                    />
                    <div
                      className="h-1 w-2/3 rounded-full"
                      style={{ backgroundColor: opt.preview.text, opacity: 0.15 }}
                    />
                    {/* Mini mockup: card */}
                    <div
                      className="mt-auto rounded-sm p-0.5"
                      style={{ backgroundColor: opt.preview.surface, border: `1px solid ${opt.preview.border}` }}
                    >
                      <div
                        className="h-1 w-2/3 rounded-full"
                        style={{ backgroundColor: opt.preview.text, opacity: 0.25 }}
                      />
                    </div>
                  </div>
                ) : (
                  /* System: half-and-half preview */
                  <div className="flex-1 flex">
                    <div className="w-1/2 bg-[#0A0B0F] p-1 flex flex-col gap-0.5">
                      <div className="h-1 w-3/4 rounded-full bg-white/60" />
                      <div className="h-0.5 w-full rounded-full bg-white/15" />
                    </div>
                    <div className="w-1/2 bg-[#F8F9FC] p-1 flex flex-col gap-0.5">
                      <div className="h-1 w-3/4 rounded-full bg-black/60" />
                      <div className="h-0.5 w-full rounded-full bg-black/15" />
                    </div>
                  </div>
                )}
              </div>

              {/* Label */}
              <div className="flex items-center gap-1.5">
                <OptIcon className={clsx('w-3.5 h-3.5', isSelected ? 'text-civic-light' : 'text-text-muted')} />
                <span className={clsx('text-xs font-semibold', isSelected ? 'text-civic-light' : 'text-text-primary')}>
                  {opt.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Current status */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface rounded-lg border border-border-subtle">
        <div className={clsx(
          'w-2 h-2 rounded-full',
          theme === 'dark' ? 'bg-civic-light' : 'bg-warning',
        )} />
        <p className="text-xs text-text-muted">
          Currently using <span className="font-semibold text-text-secondary">{theme === 'dark' ? 'dark' : 'light'} mode</span>
          {preference === 'system' && ' (from system preference)'}
        </p>
      </div>
    </div>
  );
}
