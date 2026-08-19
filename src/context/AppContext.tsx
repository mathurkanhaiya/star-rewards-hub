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
  telegramUser:null,user:null,balance:null,settings:{},isLoading:true,isAdmin:false,notifications:[],unreadCount:0,
  refreshBalance:async()=>{},refreshUser:async()=>{},refreshNotifications:async()=>{},markRead:async()=>{},
});

export const useApp = () => useContext(AppContext);
const ADMIN_ID = 2139807311;

function withTimeout<T>(promise:Promise<T>, ms:number, fallback:T):Promise<T> {
  return Promise.race([promise,new Promise<T>((resolve)=>setTimeout(()=>resolve(fallback),ms))]);
}

export function AppProvider({ children }:{ children:React.ReactNode }) {
  const [telegramUser,setTelegramUser]=useState<TelegramUser|null>(null);
  const [user,setUser]=useState<AppUser|null>(null);
  const [balance,setBalance]=useState<UserBalance|null>(null);
  const [settings,setSettings]=useState<Record<string,string>>({});
  const [isLoading,setIsLoading]=useState(true);
  const [notifications,setNotifications]=useState<Notification[]>([]);
  const [unreadCount,setUnreadCount]=useState(0);
  const isAdmin = Boolean(telegramUser && telegramUser.id === ADMIN_ID && window.Telegram?.WebApp?.initData);

  useEffect(()=>{ initApp(); },[]);

  // Settings stay synchronized without mutating rendered DOM. Components consume settings
  // directly through useApp(), avoiding MutationObserver feedback loops in Telegram WebView.
  useEffect(()=>{
    const settingsChannel=supabase.channel('settings-changes').on('postgres_changes',{event:'*',schema:'public',table:'settings'},()=>{
      getSettings().then(setSettings).catch(()=>{});
    }).subscribe();
    return ()=>{ supabase.removeChannel(settingsChannel); };
  },[]);

  async function initApp() {
    setIsLoading(true);
    try {
      const twa=window.Telegram?.WebApp;
      if (!twa?.initData) {
        setTelegramUser(null); setUser(null); setBalance(null); setNotifications([]); setUnreadCount(0);
        return;
      }
      try { twa.ready(); } catch {}
      try { twa.expand(); } catch {}
      const tgUser=twa.initDataUnsafe?.user || null;
      if (!tgUser) throw new Error('Telegram user unavailable');
      setTelegramUser(tgUser);

      const referralCode=twa.initDataUnsafe?.start_param || undefined;
      const appUser=await withTimeout(initUser({id:tgUser.id,first_name:tgUser.first_name,last_name:tgUser.last_name,username:tgUser.username,photo_url:tgUser.photo_url},referralCode),8000,null);
      if (!appUser) throw new Error('Secure Telegram authentication failed');
      setUser(appUser);

      const [bal,s,notifs,unread]=await Promise.all([
        withTimeout(getUserBalance(appUser.id),5000,null),
        withTimeout(getSettings(),5000,{}),
        withTimeout(getNotifications(appUser.id),5000,[]),
        withTimeout(getUnreadNotifCount(appUser.id),5000,0),
      ]);
      setBalance(bal); setSettings(s); setNotifications(notifs as Notification[]); setUnreadCount(unread);
      showInterstitialAd().catch(()=>{});
    } catch(err) {
      console.error('App init error:',err);
      setUser(null); setBalance(null);
    } finally { setIsLoading(false); }
  }

  const refreshBalance=useCallback(async()=>{
    if (user) { const bal=await withTimeout(getUserBalance(user.id),5000,null); if (bal) setBalance(bal); }
  },[user]);

  // Keep balance fresh without forcing a Mini App restart. Polling is intentionally modest
  // and pauses while the WebView is hidden.
  useEffect(()=>{
    if(!user) return;
    let running=false;
    const sync=async()=>{
      if(running || document.visibilityState==='hidden') return;
      running=true;
      try { await refreshBalance(); } finally { running=false; }
    };
    sync();
    const timer=window.setInterval(sync,5000);
    const onVisible=()=>{ if(document.visibilityState==='visible') sync(); };
    const onFocus=()=>{ sync(); };
    const onReward=()=>{ sync(); };
    document.addEventListener('visibilitychange',onVisible);
    window.addEventListener('focus',onFocus);
    window.addEventListener('balance-refresh',onReward as EventListener);
    return ()=>{
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange',onVisible);
      window.removeEventListener('focus',onFocus);
      window.removeEventListener('balance-refresh',onReward as EventListener);
    };
  },[user,refreshBalance]);

  const refreshUser=useCallback(async()=>{ await initApp(); },[]);

  const refreshNotifications=useCallback(async()=>{
    if (user) {
      const [notifs,unread]=await Promise.all([
        withTimeout(getNotifications(user.id),5000,[]),
        withTimeout(getUnreadNotifCount(user.id),5000,0),
      ]);
      setNotifications(notifs as Notification[]); setUnreadCount(unread);
    }
  },[user]);

  const markRead=useCallback(async(id:string)=>{
    await markNotificationRead(id);
    setNotifications(prev=>prev.map(n=>n.id===id?{...n,is_read:true}:n));
    setUnreadCount(prev=>Math.max(0,prev-1));
  },[]);

  return <AppContext.Provider value={{telegramUser,user,balance,settings,isLoading,isAdmin,notifications,unreadCount,refreshBalance,refreshUser,refreshNotifications,markRead}}>{children}</AppContext.Provider>;
}
