import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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
const BALANCE_POLL_MS = 2500;

function withTimeout<T>(promise:Promise<T>, ms:number, fallback:T):Promise<T> {
  return Promise.race([promise,new Promise<T>((resolve)=>setTimeout(()=>resolve(fallback),ms))]);
}

function sameBalance(a:UserBalance|null,b:UserBalance|null) {
  if (!a || !b) return a === b;
  return Number(a.points) === Number(b.points)
    && Number((a as any).stars_balance || 0) === Number((b as any).stars_balance || 0)
    && Number((a as any).usdt_balance || 0) === Number((b as any).usdt_balance || 0)
    && Number((a as any).ton_balance || 0) === Number((b as any).ton_balance || 0)
    && Number((a as any).total_earned || 0) === Number((b as any).total_earned || 0)
    && Number((a as any).total_withdrawn || 0) === Number((b as any).total_withdrawn || 0);
}

export function AppProvider({ children }:{ children:React.ReactNode }) {
  const [telegramUser,setTelegramUser]=useState<TelegramUser|null>(null);
  const [user,setUser]=useState<AppUser|null>(null);
  const [balance,setBalance]=useState<UserBalance|null>(null);
  const [settings,setSettings]=useState<Record<string,string>>({});
  const [isLoading,setIsLoading]=useState(true);
  const [notifications,setNotifications]=useState<Notification[]>([]);
  const [unreadCount,setUnreadCount]=useState(0);
  const balanceRef=useRef<UserBalance|null>(null);
  const refreshingBalanceRef=useRef(false);
  const isAdmin = Boolean(telegramUser && telegramUser.id === ADMIN_ID && window.Telegram?.WebApp?.initData);

  useEffect(()=>{ balanceRef.current=balance; },[balance]);
  useEffect(()=>{ initApp(); },[]);

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
      if (bal) { setBalance(bal); balanceRef.current=bal; }
      setSettings(s); setNotifications(notifs as Notification[]); setUnreadCount(unread);
      showInterstitialAd().catch(()=>{});
    } catch(err) {
      console.error('App init error:',err);
      setUser(null); setBalance(null);
    } finally { setIsLoading(false); }
  }

  const refreshBalance=useCallback(async()=>{
    if (!user || refreshingBalanceRef.current) return;
    refreshingBalanceRef.current=true;
    try {
      const bal=await withTimeout(getUserBalance(user.id),5000,null);
      if (bal && !sameBalance(balanceRef.current,bal)) {
        balanceRef.current=bal;
        setBalance(bal);
      }
    } finally {
      refreshingBalanceRef.current=false;
    }
  },[user]);

  // Keep the balance live even when rewards/admin changes happen outside the current screen.
  // The secure backend remains the source of truth; we never trust browser-side balance writes.
  useEffect(()=>{
    if (!user) return;
    let stopped=false;
    const tick=()=>{ if(!stopped && document.visibilityState!=='hidden') refreshBalance().catch(()=>{}); };
    const timer=window.setInterval(tick,BALANCE_POLL_MS);
    const onFocus=()=>tick();
    const onVisible=()=>{ if(document.visibilityState==='visible') tick(); };
    const onExplicitRefresh=()=>tick();
    window.addEventListener('focus',onFocus);
    document.addEventListener('visibilitychange',onVisible);
    window.addEventListener('balance:refresh',onExplicitRefresh as EventListener);
    // Refresh immediately when the logged-in user becomes available.
    tick();
    return ()=>{
      stopped=true;
      window.clearInterval(timer);
      window.removeEventListener('focus',onFocus);
      document.removeEventListener('visibilitychange',onVisible);
      window.removeEventListener('balance:refresh',onExplicitRefresh as EventListener);
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
