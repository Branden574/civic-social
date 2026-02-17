'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Theme = 'dark' | 'light';
type ThemePreference = 'dark' | 'light' | 'system';

interface ThemeContextValue {
  theme: Theme;                 // The resolved theme (always 'dark' or 'light')
  preference: ThemePreference;  // What the user chose ('dark', 'light', or 'system')
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  preference: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
  setPreference: () => {},
});

// ─── Resolve system theme ────────────────────────────────────

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function resolveTheme(pref: ThemePreference): Theme {
  if (pref === 'system') return getSystemTheme();
  return pref;
}

// ─── Provider ────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('dark');
  const [theme, setThemeState] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  // Apply theme classes to <html>
  const applyTheme = useCallback((t: Theme) => {
    const root = document.documentElement;
    if (t === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
    // Update meta theme-color for mobile browsers
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', t === 'dark' ? '#0A0B0F' : '#F8F9FC');
    }
  }, []);

  // On mount, read stored preference
  useEffect(() => {
    const stored = localStorage.getItem('civic-theme') as ThemePreference | null;
    const pref: ThemePreference = (stored === 'light' || stored === 'dark' || stored === 'system') ? stored : 'dark';
    const resolved = resolveTheme(pref);
    setPreferenceState(pref);
    setThemeState(resolved);
    applyTheme(resolved);
    setMounted(true);
  }, [applyTheme]);

  // Listen for system theme changes (only matters when preference is 'system')
  useEffect(() => {
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => {
      const resolved = resolveTheme('system');
      setThemeState(resolved);
      applyTheme(resolved);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [preference, applyTheme]);

  // Set a specific theme preference (dark / light / system)
  const setPreference = useCallback(
    (p: ThemePreference) => {
      const resolved = resolveTheme(p);
      setPreferenceState(p);
      setThemeState(resolved);
      localStorage.setItem('civic-theme', p);
      applyTheme(resolved);
    },
    [applyTheme],
  );

  // Direct set (legacy compat — treats as explicit preference)
  const setTheme = useCallback(
    (t: Theme) => {
      setPreference(t);
    },
    [setPreference],
  );

  // Toggle between dark and light (skips system)
  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  // Render children immediately (ThemeScript prevents flash),
  // but only provide context values after mount
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, preference, toggleTheme, setTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Inline script to set theme class BEFORE React hydrates.
 * Prevents flash of wrong theme.
 * Place this in the <head> of layout.tsx.
 */
export function ThemeScript() {
  const script = `
    (function() {
      try {
        var p = localStorage.getItem('civic-theme');
        var root = document.documentElement;
        var theme = p;
        if (p === 'system' || !p) {
          theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        }
        if (theme === 'light') {
          root.classList.remove('dark');
          root.classList.add('light');
        } else {
          root.classList.remove('light');
          root.classList.add('dark');
        }
      } catch(e) {}
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

export function useTheme() {
  return useContext(ThemeContext);
}
