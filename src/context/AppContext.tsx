import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppUser, UserBalance, TelegramUser } from '@/types/telegram';
import { initUser, getUserBalance, getSettings } from '@/lib/api';

interface AppContextType {
  telegramUser: TelegramUser | null;
  user: AppUser | null;
  balance: UserBalance | null;
  settings: Record<string, string>;
  isLoading: boolean;
  isAdmin: boolean;
  refreshBalance: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AppContext = createContext<AppContextType>({
  telegramUser: null,
  user: null,
  balance: null,
  settings: {},
  isLoading: true,
  isAdmin: false,
  refreshBalance: async () => {},
  refreshUser: async () => {},
});

export const useApp = () => useContext(AppContext);

const ADMIN_ID = 2139807311;

// Mock user for development/web preview
const MOCK_TELEGRAM_USER: TelegramUser = {
  id: 2139807311, // admin for dev
  first_name: 'Admin',
  last_name: 'User',
  username: 'adminuser',
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [balance, setBalance] = useState<UserBalance | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = telegramUser?.id === ADMIN_ID;

  useEffect(() => {
    initApp();
  }, []);

  async function initApp() {
    setIsLoading(true);
    try {
      // Try Telegram WebApp
      let tgUser: TelegramUser | null = null;
      
      if (window.Telegram?.WebApp) {
        const twa = window.Telegram.WebApp;
        twa.ready();
        twa.expand();
        tgUser = twa.initDataUnsafe?.user || null;
      }

      // Fallback to mock user for development
      if (!tgUser) {
        tgUser = MOCK_TELEGRAM_USER;
      }

      setTelegramUser(tgUser);

      // Get referral code from URL params
      let referralCode: string | undefined;
      if (window.Telegram?.WebApp?.initDataUnsafe?.start_param) {
        referralCode = window.Telegram.WebApp.initDataUnsafe.start_param;
      }

      // Init or get user
      const appUser = await initUser(
        { id: tgUser.id, first_name: tgUser.first_name, last_name: tgUser.last_name, username: tgUser.username, photo_url: tgUser.photo_url },
        referralCode
      );
      
      setUser(appUser);

      if (appUser) {
        const bal = await getUserBalance(appUser.id);
        setBalance(bal);
      }

      // Load settings
      const s = await getSettings();
      setSettings(s);
    } catch (err) {
      console.error('App init error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshBalance() {
    if (user) {
      const bal = await getUserBalance(user.id);
      setBalance(bal);
    }
  }

  async function refreshUser() {
    await initApp();
  }

  return (
    <AppContext.Provider value={{ telegramUser, user, balance, settings, isLoading, isAdmin, refreshBalance, refreshUser }}>
      {children}
    </AppContext.Provider>
  );
}
