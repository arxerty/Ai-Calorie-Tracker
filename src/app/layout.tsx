import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'App Ai — Умный ИИ-счетчик калорий',
  description: 'AI Calorie Tracker optimized for Telegram Mini Apps. Scan, Log, and Track your diet with premium minimalism.',
  keywords: ['App Ai', 'AI Calorie Tracker', 'Calorie Counter', 'Telegram Mini App', 'TMA', 'Диетолог', 'Калории'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Prevents zoom-on-focus on mobile browsers for a native app feel
  viewportFit: 'cover', // lets the layout use env(safe-area-inset-*) on notched iPhones
};

// Applies the saved/system theme before first paint to avoid a light→dark flash
const themeBootScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.classList.toggle('dark',t==='dark')}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {/* Load Telegram WebApp Script */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://telegram.org/js/telegram-web-app.js" />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
