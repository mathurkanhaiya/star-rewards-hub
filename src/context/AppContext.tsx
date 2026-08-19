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

  // Settings are public read-only and update live. Backend remains the source of truth.
  useEffect(()=>{
    const settingsChannel=supabase.channel('settings-changes').on('postgres_changes',{event:'*',schema:'public',table:'settings'},()=>{
      getSettings().then(setSettings).catch(()=>{});
    }).subscribe();
    return ()=>{ supabase.removeChannel(settingsChannel); };
  },[]);

  // Keep Home-page labels in sync with the same live settings that control backend payouts.
  // This compatibility layer removes stale hard-coded reward text while the legacy Home UI
  // is progressively migrated to read settings directly.
  useEffect(()=>{
    if (typeof document === 'undefined') return;

    const numberSetting=(key:string,fallback:number)=>{
      const n=Number(settings[key]);
      return Number.isFinite(n) ? n : fallback;
    };

    const apply=()=>{
      const adReward=numberSetting('ad_reward_points',50);
      const adLimit=numberSetting('max_daily_ads',20);
      const farmReward=numberSetting('farm_reward_points',100);
      const farmMinutes=Math.max(1,Math.round(numberSetting('farm_duration_minutes',15)));
      const dropBase=numberSetting('daily_drop_base',100);
      const dropInc=numberSetting('daily_drop_increment',10);
      const tapReward=numberSetting('tap_reward_points',1);
      const maxEnergy=numberSetting('tap_max_energy',500);

      const adBadge=document.querySelector('.hp-ad-badge');
      if(adBadge) adBadge.textContent=`+${adReward} PTS`;

      const adButton=document.querySelector('.hp-ad-btn');
      if(adButton && !adButton.hasAttribute('disabled')) adButton.textContent=`🎬  WATCH AD  +${adReward} PTS`;

      const adSub=document.querySelector('.hp-ad-sub');
      if(adSub){
        const current=adSub.textContent||'';
        const match=current.match(/(\d+)\s*\/\s*\d+\s*today/i);
        if(match) adSub.textContent=`${match[1]} / ${adLimit} today`;
      }

      const farmBadge=document.querySelector('.hp-farm-badge');
      if(farmBadge) farmBadge.textContent=`+${farmReward} PTS`;
      const farmSub=document.querySelector('.hp-farm-sub');
      if(farmSub && farmSub.textContent?.includes('Start Farming')) farmSub.textContent=`Start Farming → ${farmMinutes} min → +${farmReward} pts`;

      const tapSub=document.querySelector('.hp-tap-btn-sub');
      if(tapSub && !tapSub.textContent?.includes('2')) tapSub.textContent=`+${tapReward} PT${tapReward===1?'':'S'}`;
      const energyPill=document.querySelector('.hp-energy-pill');
      if(energyPill){
        const current=energyPill.textContent||'';
        const match=current.match(/(\d+)\s*\/\s*\d+/);
        if(match) energyPill.textContent=`⚡ ${match[1]}/${maxEnergy}`;
      }

      const dropPts=document.querySelectorAll('.hp-drop-pts');
      dropPts.forEach((el,i)=>{ el.textContent=String(dropBase+(i*dropInc)); });
      const dropButton=document.querySelector('.hp-drop-btn');
      if(dropButton && !dropButton.hasAttribute('disabled')){
        const streakEls=[...document.querySelectorAll('.hp-drop-day')];
        const currentIndex=Math.max(0,streakEls.findIndex(el=>!el.classList.contains('claimed')&&!el.classList.contains('locked')));
        const reward=dropBase+(currentIndex*dropInc);
        dropButton.textContent=`🎁  CLAIM +${reward} PTS`;
      }
    };

    apply();
    const observer=new MutationObserver(()=>apply());
    observer.observe(document.body,{childList:true,subtree:true});
    const timer=window.setInterval(apply,1000);
    return ()=>{ observer.disconnect(); window.clearInterval(timer); };
  },[settings]);

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

  // Live balance sync: refresh from the authenticated backend while the app is visible,
  // and immediately whenever Telegram/webview regains focus after an ad or admin change.
  useEffect(()=>{
    if(!user) return;
    let running=false;
    const sync=async()=>{
      if(running || document.visibilityState==='hidden') return;
      running=true;
      try { await refreshBalance(); } finally { running=false; }
    };
    sync();
    const timer=window.setInterval(sync,2500);
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
