'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

interface TmaContextType {
  user: TelegramUser | null;
  initDataRaw: string;
  isTelegram: boolean;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  hapticImpact: (style: 'light' | 'medium' | 'heavy') => void;
  hapticNotification: (type: 'success' | 'warning' | 'error') => void;
  hapticSelectionChange: () => void;
  closeApp: () => void;
}

const TmaContext = createContext<TmaContextType>({
  user: null,
  initDataRaw: '',
  isTelegram: false,
  theme: 'dark',
  setTheme: () => {},
  hapticImpact: () => {},
  hapticNotification: () => {},
  hapticSelectionChange: () => {},
  closeApp: () => {},
});

export const useTma = () => useContext(TmaContext);

export function TmaProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [initDataRaw, setInitDataRaw] = useState<string>('');
  const [isTelegram, setIsTelegram] = useState(false);
  const [theme, setThemeState] = useState<'light' | 'dark'>('dark');

  // Load theme from localStorage or system setting
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cached = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (cached) {
      setTheme(cached);
    } else {
      setTheme('dark');
    }
  }, []);

  const setTheme = (t: 'light' | 'dark') => {
    if (typeof window === 'undefined') return;
    
    setThemeState(t);
    localStorage.setItem('theme', t);

    // Apply class to html
    const html = document.documentElement;
    if (t === 'light') {
      html.classList.add('light');
      html.classList.remove('dark');
    } else {
      html.classList.add('dark');
      html.classList.remove('light');
    }

    // Sync statusbar / headers if running in Telegram
    const webapp = (window as any).Telegram?.WebApp;
    if (webapp) {
      const color = t === 'light' ? '#FFFFFF' : '#000000';
      try {
        webapp.setHeaderColor(color);
        webapp.setBackgroundColor(color);
      } catch (e) {
        console.error('Failed to sync Telegram theme colors', e);
      }
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const webapp = (window as any).Telegram?.WebApp;

    if (webapp) {
      setIsTelegram(true);
      webapp.ready();
      webapp.expand();
      
      // Platform restrictions
      if ('isVerticalSwipesEnabled' in webapp) {
        webapp.isVerticalSwipesEnabled = false;
      }
      
      // Match current theme state
      const color = theme === 'light' ? '#FFFFFF' : '#000000';
      webapp.setHeaderColor(color);
      webapp.setBackgroundColor(color);

      // Extract initData
      if (webapp.initData) {
        setInitDataRaw(webapp.initData);
        if (webapp.initDataUnsafe?.user) {
          setUser(webapp.initDataUnsafe.user);
        }
      } else {
        const mockInitData = generateDevInitData();
        setInitDataRaw(mockInitData.raw);
        setUser(mockInitData.user);
      }
    } else {
      const mockInitData = generateDevInitData();
      setInitDataRaw(mockInitData.raw);
      setUser(mockInitData.user);
    }
  }, [theme]);

  const generateDevInitData = () => {
    const devUser = {
      id: 99999999,
      first_name: 'Иван',
      last_name: 'Тестов',
      username: 'dev_nutrition_user',
      language_code: 'ru'
    };
    
    const userJson = JSON.stringify(devUser);
    const params = new URLSearchParams();
    params.append('user', userJson);
    params.append('auth_date', Math.floor(Date.now() / 1000).toString());
    params.append('hash', 'mock_dev_hash');
    
    return {
      raw: params.toString(),
      user: devUser
    };
  };

  const hapticImpact = (style: 'light' | 'medium' | 'heavy') => {
    const webapp = (window as any).Telegram?.WebApp;
    if (webapp?.HapticFeedback) {
      webapp.HapticFeedback.impactOccurred(style);
    } else {
      console.log(`📳 [Haptic Mock] Impact: ${style}`);
    }
  };

  const hapticNotification = (type: 'success' | 'warning' | 'error') => {
    const webapp = (window as any).Telegram?.WebApp;
    if (webapp?.HapticFeedback) {
      webapp.HapticFeedback.notificationOccurred(type);
    } else {
      console.log(`📳 [Haptic Mock] Notification: ${type}`);
    }
  };

  const hapticSelectionChange = () => {
    const webapp = (window as any).Telegram?.WebApp;
    if (webapp?.HapticFeedback) {
      webapp.HapticFeedback.selectionChanged();
    } else {
      console.log('📳 [Haptic Mock] Selection Changed');
    }
  };

  const closeApp = () => {
    const webapp = (window as any).Telegram?.WebApp;
    if (webapp) {
      webapp.close();
    } else {
      console.log('[TMA-SDK] Close App Triggered');
    }
  };

  return (
    <TmaContext.Provider
      value={{
        user,
        initDataRaw,
        isTelegram,
        theme,
        setTheme,
        hapticImpact,
        hapticNotification,
        hapticSelectionChange,
        closeApp,
      }}
    >
      {children}
    </TmaContext.Provider>
  );
}
