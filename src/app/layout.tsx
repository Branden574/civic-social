import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider, ThemeScript } from '@/lib/theme-context';
import { AuthProvider } from '@/lib/auth-context';
import { PostStoreProvider } from '@/lib/post-store';
import { NotificationProvider } from '@/lib/notification-context';
import { AppShell } from './app-shell';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Civic Social — The Civic Discourse Platform',
  description:
    'A next-generation platform for civil political discourse, evidence-based debate, and solution-driven civic engagement.',
  keywords: [
    'civic discourse',
    'political debate',
    'civil discussion',
    'policy',
    'democracy',
  ],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Civic Social',
  },
};

export const viewport: Viewport = {
  themeColor: '#0A0B0F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <link rel="dns-prefetch" href="https://api.congress.gov" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body
        className={`${inter.variable} font-sans antialiased bg-bg text-text-primary`}
      >
        <ThemeProvider>
          <AuthProvider>
            <NotificationProvider>
              <PostStoreProvider>
                <AppShell>{children}</AppShell>
              </PostStoreProvider>
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
