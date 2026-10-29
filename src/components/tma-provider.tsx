'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

type Theme = 'light' | 'dark';

interface TmaContextType {
  user: TelegramUser | null;
  initDataRaw: string;
  isTelegram: boolean;
  theme: Theme;
  setTheme: (t: Theme) => void;
  hapticImpact: (style: 'light' | 'medium' | 'heavy') => void;
  hapticNotification: (type: 'success' | 'warning' | 'error') => void;
  hapticSelectionChange: () => void;
  closeApp: () => void;
}

const TmaContext = createContext<TmaContextType>({
  user: null,
  initDataRaw: '',
  isTelegram: false,
  theme: 'light',
  setTheme: () => {},
  hapticImpact: () => {},
  hapticNotification: () => {},
  hapticSelectionChange: () => {},
  closeApp: () => {},
});

export const useTma = () => useContext(TmaContext);

// Matches --background in globals.css so the Telegram header blends with the app
const BG_COLOR: Record<Theme, string> = { light: '#f2f2f7', dark: '#000000' };

const getWebApp = () => (typeof window === 'undefined' ? undefined : (window as any).Telegram?.WebApp);

function generateDevInitData() {
  const devUser = {
    id: 99999999,
    first_name: 'Иван',
    last_name: 'Тестов',
    username: 'dev_nutrition_user',
    language_code: 'ru',
  };

  const params = new URLSearchParams();
  params.append('user', JSON.stringify(devUser));
  params.append('auth_date', Math.floor(Date.now() / 1000).toString());
  params.append('hash', 'mock_dev_hash');

  return { raw: params.toString(), user: devUser };
}

export function TmaProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [initDataRaw, setInitDataRaw] = useState<string>('');
  const [isTelegram, setIsTelegram] = useState(false);
  const [theme, setThemeState] = useState<Theme>('light');

  const applyTheme = useCallback((t: Theme) => {
    document.documentElement.classList.toggle('dark', t === 'dark');
    const webapp = getWebApp();
    if (webapp) {
      try {
        webapp.setHeaderColor(BG_COLOR[t]);
        webapp.setBackgroundColor(BG_COLOR[t]);
        webapp.setBottomBarColor?.(BG_COLOR[t]);
      } catch (e) {
        console.error('Failed to sync Telegram theme colors', e);
      }
    }
  }, []);

  const setTheme = useCallback(
    (t: Theme) => {
      setThemeState(t);
      applyTheme(t);
      try {
        localStorage.setItem('theme', t);
      } catch {
        // storage can be unavailable in some webviews: the theme just won't persist
      }
    },
    [applyTheme]
  );

  // Initial theme: saved choice → Telegram → system preference
  useEffect(() => {
    let initial: Theme | null = null;
    try {
      const cached = localStorage.getItem('theme');
      if (cached === 'light' || cached === 'dark') initial = cached;
    } catch {
      // ignore
    }
    if (!initial) {
      const tgScheme = getWebApp()?.colorScheme;
      if (tgScheme === 'light' || tgScheme === 'dark') initial = tgScheme;
    }
    if (!initial) {
      initial = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    setThemeState(initial);
    applyTheme(initial);
  }, [applyTheme]);

  // Telegram / dev session: runs once
  useEffect(() => {
    const webapp = getWebApp();

    if (webapp) {
      setIsTelegram(true);
      webapp.ready();
      webapp.expand();

      if ('isVerticalSwipesEnabled' in webapp) {
        webapp.isVerticalSwipesEnabled = false;
      }

      if (webapp.initData) {
        setInitDataRaw(webapp.initData);
        if (webapp.initDataUnsafe?.user) setUser(webapp.initDataUnsafe.user);
        return;
      }
    }

    const mock = generateDevInitData();
    setInitDataRaw(mock.raw);
    setUser(mock.user);
  }, []);

  const hapticImpact = useCallback((style: 'light' | 'medium' | 'heavy') => {
    getWebApp()?.HapticFeedback?.impactOccurred(style);
  }, []);

  const hapticNotification = useCallback((type: 'success' | 'warning' | 'error') => {
    getWebApp()?.HapticFeedback?.notificationOccurred(type);
  }, []);

  const hapticSelectionChange = useCallback(() => {
    getWebApp()?.HapticFeedback?.selectionChanged();
  }, []);

  const closeApp = useCallback(() => {
    getWebApp()?.close();
  }, []);

  const value = useMemo(
    () => ({
      user,
      initDataRaw,
      isTelegram,
      theme,
      setTheme,
      hapticImpact,
      hapticNotification,
      hapticSelectionChange,
      closeApp,
    }),
    [user, initDataRaw, isTelegram, theme, setTheme, hapticImpact, hapticNotification, hapticSelectionChange, closeApp]
  );

  return <TmaContext.Provider value={value}>{children}</TmaContext.Provider>;
}
