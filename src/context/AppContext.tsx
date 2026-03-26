import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppUser, UserBalance, TelegramUser, Notification } from '@/types/telegram';
import { initUser, getUserBalance, getSettings, getUnreadNotifCount, getNotifications, markNotificationRead } from '@/lib/api';
import { showInterstitialAd } from '@/hooks/useAdsgram';
import { supabase } from '@/integrations/supabase/client';

interface AppContextType {
  telegramUser: TelegramUser | null;
  user: AppUser | null;
  balance: UserBalance | null;
  settings: Record<string, string>;
  isLoading: boolean;
  isAdmin: boolean;
  notifications: Notification[];
  unreadCount: number;
  refreshBalance: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType>({
  telegramUser: null,
  user: null,
  balance: null,
  settings: {},
  isLoading: true,
  isAdmin: false,
  notifications: [],
  unreadCount: 0,
  refreshBalance: async () => {},
  refreshUser: async () => {},
  refreshNotifications: async () => {},
  markRead: async () => {},
});

export const useApp = () => useContext(AppContext);

const ADMIN_ID = 2139807311;

const MOCK_TELEGRAM_USER: TelegramUser = {
  id: 2139807311,
  first_name: 'Admin',
  last_name: 'User',
  username: 'adminuser',
};

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [balance, setBalance] = useState<UserBalance | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const isAdmin = telegramUser?.id === ADMIN_ID;

  useEffect(() => {
    initApp();
  }, []);

  // Realtime subscriptions
  useEffect(() => {
    if (!user) return;

    const balanceChannel = supabase
      .channel('balance-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'balances', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setBalance(payload.new as UserBalance);
        })
      .subscribe();

    const notifChannel = supabase
      .channel('notification-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications(prev => [newNotif, ...prev]);
          setUnreadCount(prev => prev + 1);
        })
      .subscribe();

    const settingsChannel = supabase
      .channel('settings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' },
        () => {
          getSettings().then(s => setSettings(s)).catch(() => {});
        })
      .subscribe();

    return () => {
      supabase.removeChannel(balanceChannel);
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(settingsChannel);
    };
  }, [user?.id]);

  async function initApp() {
    setIsLoading(true);
    try {
      let tgUser: TelegramUser | null = null;

      if (window.Telegram?.WebApp) {
        const twa = window.Telegram.WebApp;
        try { twa.ready(); } catch (_) {}
        try { twa.expand(); } catch (_) {}
        tgUser = twa.initDataUnsafe?.user || null;
      }

      if (!tgUser) {
        tgUser = MOCK_TELEGRAM_USER;
      }

      setTelegramUser(tgUser);

      let referralCode: string | undefined;
      if (window.Telegram?.WebApp?.initDataUnsafe?.start_param) {
        referralCode = window.Telegram.WebApp.initDataUnsafe.start_param;
      }

      const appUser = await withTimeout(
        initUser({ id: tgUser.id, first_name: tgUser.first_name, last_name: tgUser.last_name, username: tgUser.username, photo_url: tgUser.photo_url }, referralCode),
        8000,
        null
      );

      const resolvedUser = appUser ?? {
        id: `local-${tgUser.id}`,
        telegram_id: tgUser.id,
        first_name: tgUser.first_name,
        last_name: tgUser.last_name ?? null,
        username: tgUser.username ?? null,
        photo_url: tgUser.photo_url ?? null,
        level: 1,
        total_points: 0,
        referral_code: String(tgUser.id),
        referred_by: null,
        is_banned: false,
        last_active_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      } as AppUser;

      setUser(resolvedUser);

      const [bal, s, notifs, unread] = await Promise.all([
        withTimeout(getUserBalance(resolvedUser.id), 5000, null),
        withTimeout(getSettings(), 5000, {}),
        withTimeout(getNotifications(resolvedUser.id), 5000, []),
        withTimeout(getUnreadNotifCount(resolvedUser.id), 5000, 0),
      ]);
      setBalance(bal);
      setSettings(s as Record<string, string>);
      setNotifications(notifs as Notification[]);
      setUnreadCount(unread as number);

      showInterstitialAd().catch(() => {});
    } catch (err) {
      console.error('App init error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const refreshBalance = useCallback(async () => {
    if (user) {
      const bal = await withTimeout(getUserBalance(user.id), 5000, null);
      if (bal) setBalance(bal);
    }
  }, [user]);

  const refreshUser = useCallback(async () => {
    await initApp();
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (user) {
      const [notifs, unread] = await Promise.all([
        withTimeout(getNotifications(user.id), 5000, []),
        withTimeout(getUnreadNotifCount(user.id), 5000, 0),
      ]);
      setNotifications(notifs as Notification[]);
      setUnreadCount(unread as number);
    }
  }, [user]);

  const markRead = useCallback(async (id: string) => {
    await markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  return (
    <AppContext.Provider value={{
      telegramUser, user, balance, settings, isLoading, isAdmin,
      notifications, unreadCount, refreshBalance, refreshUser, refreshNotifications, markRead,
    }}>
      {children}
    </AppContext.Provider>
  );
}
