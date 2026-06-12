import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Cormorant_Garamond } from 'next/font/google';
import './globals.css';
import { ThemeProvider, ThemeScript } from '@/lib/theme-context';
import { AuthProvider } from '@/lib/auth-context';
import { PostStoreProvider } from '@/lib/post-store';
import { NotificationProvider } from '@/lib/notification-context';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { AppShell } from './app-shell';

const inter = Inter({
  subsets: ['latin'],
  weight: 'variable', // variable font covers 400-800
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  variable: '--font-serif',
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
  openGraph: {
    type: 'website',
    title: 'Civic Social — The Civic Discourse Platform',
    description: 'Post freely. Stay informed. Track real legislation in real time — without the noise.',
    siteName: 'Civic Social',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Civic Social — The Civic Discourse Platform',
    description: 'Post freely. Stay informed. Track real legislation in real time — without the noise.',
  },
  robots: {
    index: true,
    follow: true,
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
        className={`${inter.variable} ${jetbrainsMono.variable} ${cormorant.variable} font-sans antialiased bg-bg text-text-primary`}
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
        >
          Skip to main content
        </a>
        <ThemeProvider>
          <AuthProvider>
            <NotificationProvider>
              <PostStoreProvider>
                <AppShell>{children}</AppShell>
                <SpeedInsights />
              </PostStoreProvider>
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
