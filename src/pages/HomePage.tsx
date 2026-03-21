import React, { useEffect, useState, useCallback, useRef } from "react";
import { useApp } from "@/context/AppContext";
import {
  claimDailyReward,
  getTransactions,
  logAdWatch,
  getDailyClaim
} from "@/lib/api";
import { useRewardedAd } from "@/hooks/useAdsgram";
import AdsgramTask from "@/components/AdsgramTask";

/* ===============================
   TYPES
================================ */
type HapticType = "impact" | "success" | "error";

interface Transaction {
  id: string;
  type: string;
  points: number;
}

/* ===============================
   TELEGRAM HAPTIC
================================ */
function triggerHaptic(type: HapticType) {
  if (typeof window !== "undefined" && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;

    if (tg?.HapticFeedback) {
      if (type === "impact") tg.HapticFeedback.impactOccurred("medium");
      if (type === "success") tg.HapticFeedback.notificationOccurred("success");
      if (type === "error") tg.HapticFeedback.notificationOccurred("error");
    }
  }
}

/* ===============================
   Animated Balance (Premium Glow)
================================ */
function AnimatedNumber({ value = 0 }: { value: number }) {
  const [display, setDisplay] = useState<number>(value);
  const prev = useRef<number>(value);

  useEffect(() => {
    let start = prev.current;
    const diff = value - start;
    const steps = 30;
    const inc = diff / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      start += inc;
      if (step >= steps) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(start));
      }
    }, 20);

    prev.current = value;
    return () => clearInterval(timer);
  }, [value]);

  return (
    <span className="drop-shadow-[0_0_40px_#facc15]">{display.toLocaleString()}</span>
  );
}

/* ===============================
   UTILS
================================ */
function formatCountdown(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/* ===============================
   MAIN PREMIUM COMPONENT
================================ */
export default function HomePage() {
  const { user, balance, settings, refreshBalance } = useApp();

  const [dailyClaiming, setDailyClaiming] = useState(false);
  const [dailyMessage, setDailyMessage] = useState("");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [adLoading, setAdLoading] = useState(false);

  const [dailyCooldown, setDailyCooldown] = useState(0);
  const [coinBurst, setCoinBurst] = useState(false);

  const [activeTab, setActiveTab] = useState<"earn" | "history">("earn");

  /* ===============================
     🔥 GIGAPUB STATES
  =================================*/
  const [gigapubReady, setGigapubReady] = useState(false);
  const [gigapubLoading, setGigapubLoading] = useState(false);

  /* ===============================
     🔥 NEW: AD COOLDOWN COUNTDOWN
  =================================*/
  const [adCooldownRemaining, setAdCooldownRemaining] = useState(0);

  /* ===============================
     🔥 PERSISTENT AD STATE
  =================================*/
  const [adNetwork, setAdNetwork] = useState<"adsgram" | "monetag">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("adNetwork");
      if (saved === "adsgram" || saved === "monetag") return saved;
    }
    return "adsgram";
  });

  const [lastAdTime, setLastAdTime] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return Number(localStorage.getItem("lastAdTime") || 0);
    }
    return 0;
  });

  const COOLDOWN = 45000; // 45 seconds – premium anti-spam
  const isAdRunning = useRef(false);

  useEffect(() => {
    localStorage.setItem("adNetwork", adNetwork);
  }, [adNetwork]);

  useEffect(() => {
    localStorage.setItem("lastAdTime", lastAdTime.toString());
  }, [lastAdTime]);

  /* ===============================
     NEW: LIVE AD COUNTDOWN EFFECT
  =================================*/
  useEffect(() => {
    if (lastAdTime === 0) {
      setAdCooldownRemaining(0);
      return;
    }
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((lastAdTime + COOLDOWN - Date.now()) / 1000));
      setAdCooldownRemaining(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [lastAdTime]);

  /* ===============================
     ADSGRAM REWARD
  =================================*/
  const onAdsgramReward = useCallback(async () => {
    if (!user) return;
    triggerHaptic("success");
    await logAdWatch(user.id, "adsgram_reward", 40);
    await refreshBalance();
    setLastAdTime(Date.now());
    setCoinBurst(true);
    setDailyMessage("+40 pts 🎬 (Adsgram)");
    setTimeout(() => setCoinBurst(false), 1200);
    setTimeout(() => setDailyMessage(""), 3000);
    setAdNetwork("monetag");
  }, [user, refreshBalance]);

  const { showAd: showAdsgramAd } = useRewardedAd(onAdsgramReward);

  /* ===============================
     MONETAG
  =================================*/
  const showMonetagAd = async (): Promise<boolean> => {
    if (!user) return false;
    try {
      if (!(window as any).show_10742752) throw new Error("Monetag not loaded");
      await (window as any).show_10742752();
      triggerHaptic("success");
      await logAdWatch(user.id, "monetag_reward", 15);
      await refreshBalance();
      setLastAdTime(Date.now());
      setCoinBurst(true);
      setDailyMessage("+15 pts 💰 (Monetag)");
      setTimeout(() => setCoinBurst(false), 1200);
      setTimeout(() => setDailyMessage(""), 3000);
      setAdNetwork("adsgram");
      return true;
    } catch (err) {
      console.error("❌ Monetag failed", err);
      return false;
    }
  };

  /* ===============================
     🔥 GIGAPUB LOADER + HANDLER
  =================================*/
  useEffect(() => {
    if ((window as any).showGiga) {
      setGigapubReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://ad.gigapub.tech/script?id=5935";
    script.async = true;
    script.onload = () => setGigapubReady(true);
    script.onerror = () => console.error("❌ Gigapub failed to load");
    document.head.appendChild(script);
  }, []);

  const handleGigapubAd = async () => {
    if (!user) return;
    if (Date.now() - lastAdTime < COOLDOWN) {
      alert("⏳ Wait a few seconds before next ad");
      return;
    }
    if (!gigapubReady) {
      alert("Ad network still preparing...");
      return;
    }
    try {
      setGigapubLoading(true);
      await (window as any).showGiga();
      triggerHaptic("success");
      await logAdWatch(user.id, "gigapub_reward", 20);
      await refreshBalance();
      setLastAdTime(Date.now());
      setCoinBurst(true);
      setDailyMessage("+20 pts 🎬 (Gigapub)");
      setTimeout(() => setCoinBurst(false), 1200);
      setTimeout(() => setDailyMessage(""), 3000);
    } catch (error) {
      console.error("Gigapub error:", error);
      setDailyMessage("❌ No ad available right now");
      triggerHaptic("error");
      setTimeout(() => setDailyMessage(""), 3000);
    } finally {
      setGigapubLoading(false);
    }
  };

  /* ===============================
     LOAD DATA
  =================================*/
  useEffect(() => {
    if (!user) return;
    getTransactions(user.id).then(setTransactions);
    checkDailyCooldown();
  }, [user]);

  /* ===============================
     COUNTDOWN FIX
  =================================*/
  useEffect(() => {
    if (dailyCooldown <= 0) return;
    const interval = setInterval(() => {
      setDailyCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [dailyCooldown]);

  async function checkDailyCooldown() {
    if (!user) return;
    const claim = await getDailyClaim(user.id);
    if (claim) {
      const now = new Date();
      const midnightUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const remaining = Math.max(0, Math.floor((midnightUTC.getTime() - now.getTime()) / 1000));
      setDailyCooldown(remaining);
    }
  }

  async function handleDailyClaim() {
    if (!user || dailyCooldown > 0) return;
    triggerHaptic("impact");
    setDailyClaiming(true);
    const result = await claimDailyReward(user.id);
    if (result.success) {
      triggerHaptic("success");
      setDailyMessage(`+${result.points} pts 🔥`);
      setCoinBurst(true);
      const now = new Date();
      const midnightUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      setDailyCooldown(Math.floor((midnightUTC.getTime() - now.getTime()) / 1000));
      await refreshBalance();
      setTimeout(() => setCoinBurst(false), 1200);
    } else {
      triggerHaptic("error");
      setDailyMessage(result.message || "Already claimed!");
      await checkDailyCooldown();
    }
    setDailyClaiming(false);
    setTimeout(() => setDailyMessage(""), 3000);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-black to-zinc-950 text-white pb-28 px-4 font-sans">
      {/* PREMIUM BALANCE HERO */}
      <div className="relative mt-6 mb-8 rounded-3xl p-8 text-center bg-gradient-to-br from-zinc-900 via-slate-900 to-black border border-yellow-400/30 shadow-[0_0_60px_-10px] shadow-yellow-400/40 ring-1 ring-inset ring-yellow-400/20 overflow-hidden">
        {/* Subtle shine overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 animate-[shine_4s_infinite] pointer-events-none" />
        
        {coinBurst && <div className="absolute -top-6 text-7xl animate-bounce">💎</div>}

        <div className="text-xs tracking-[2px] uppercase text-yellow-400/70 mb-2 font-medium">YOUR EMPIRE</div>
        
        <div className="text-7xl font-black text-yellow-400 tracking-tighter drop-shadow-[0_0_40px_#facc15]">
          <AnimatedNumber value={balance?.points || 0} />
        </div>

        <div className="text-xs text-yellow-400/50 mt-2 flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          AVAILABLE POINTS
        </div>
      </div>

      {/* PREMIUM WATCH AD BUTTON (Shine + Glow) */}
      <button
        onClick={async () => {
          if (!user || isAdRunning.current || adCooldownRemaining > 0) return;
          isAdRunning.current = true;
          triggerHaptic("impact");
          setAdLoading(true);
          try {
            if (adNetwork === "adsgram") {
              await showAdsgramAd();
            } else {
              const success = await showMonetagAd();
              if (!success) await showAdsgramAd();
            }
          } catch {
            try { await showAdsgramAd(); } catch { alert("Ad failed. Try again later."); }
          }
          setAdLoading(false);
          isAdRunning.current = false;
        }}
        disabled={adLoading || adCooldownRemaining > 0}
        className="group relative w-full overflow-hidden rounded-3xl p-8 mb-8 font-black text-2xl shadow-2xl shadow-yellow-500/30 active:scale-95 transition-all duration-300 bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 text-black disabled:opacity-70"
      >
        {/* Shine effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12 group-active:animate-[shine_0.8s] pointer-events-none" />
        
        {adLoading ? (
          "LOADING LUXURY AD..."
        ) : adCooldownRemaining > 0 ? (
          `⏳ WAIT ${adCooldownRemaining}s`
        ) : adNetwork === "adsgram" ? (
          "🎬 WATCH ADSGRAM (+40)"
        ) : (
          "💎 WATCH MONETAG (+15)"
        )}
      </button>

      {/* PREMIUM DAILY REWARD (Glassmorphism) */}
      <div className="mb-8 rounded-3xl bg-white/5 backdrop-blur-3xl border border-white/10 p-6 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center text-4xl shadow-inner">🎁</div>
          <div>
            <div className="font-black text-2xl tracking-tight">DAILY REWARD</div>
            <div className="text-sm text-white/60">
              {dailyMessage ||
                (dailyCooldown > 0
                  ? `⏳ ${formatCountdown(dailyCooldown)}`
                  : `+${settings?.daily_bonus_base || 100} PTS`)}
            </div>
          </div>
        </div>

        <button
          onClick={handleDailyClaim}
          disabled={dailyClaiming || dailyCooldown > 0}
          className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl font-black text-lg active:scale-95 transition-all disabled:opacity-60 shadow-lg"
        >
          {dailyCooldown > 0 ? "LOCKED" : "CLAIM NOW"}
        </button>
      </div>

      {/* PREMIUM TABS (Glowing) */}
      <div className="flex mb-6 bg-white/5 backdrop-blur-xl rounded-3xl p-1 border border-white/10">
        <button
          onClick={() => setActiveTab("earn")}
          className={`flex-1 py-4 rounded-2xl font-black text-lg transition-all ${activeTab === "earn" ? "bg-yellow-400 text-black shadow-xl" : "text-white/60"}`}
        >
          EARN
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-4 rounded-2xl font-black text-lg transition-all ${activeTab === "history" ? "bg-yellow-400 text-black shadow-xl" : "text-white/60"}`}
        >
          HISTORY
        </button>
      </div>

      {/* EARN TAB – LUXURY LAYOUT */}
      {activeTab === "earn" && (
        <div className="space-y-6">
          <AdsgramTask blockId="task-25198" />

          {/* 🔥 PREMIUM GIGAPUB VIP CARD */}
          <div className="rounded-3xl bg-gradient-to-br from-purple-950/80 via-black to-fuchsia-950/60 border border-purple-400/40 p-7 shadow-2xl relative overflow-hidden">
            <div className="absolute top-4 right-4 px-4 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-black tracking-widest text-purple-300">VIP +20 PTS</div>
            
            <div className="text-center mb-5">
              <div className="text-4xl mb-2">🔥</div>
              <div className="font-black text-3xl">EXTRA PREMIUM AD</div>
              <div className="text-purple-300 text-sm">Gigapub • Limited Reward</div>
            </div>

            <button
              onClick={handleGigapubAd}
              disabled={!gigapubReady || gigapubLoading || adCooldownRemaining > 0}
              className="w-full py-6 rounded-3xl font-black text-xl bg-gradient-to-r from-purple-500 via-pink-500 to-violet-500 active:scale-95 transition-all disabled:opacity-70 shadow-xl"
            >
              {adCooldownRemaining > 0
                ? `⏳ WAIT ${adCooldownRemaining}s`
                : gigapubLoading
                ? "LOADING VIP AD..."
                : gigapubReady
                ? "WATCH GIGAPUB AD (+20)"
                : "PREPARING..."}
            </button>
          </div>
        </div>
      )}

      {/* HISTORY TAB – LUXURY LIST */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {transactions.length === 0 && (
            <div className="text-center py-16 text-white/40 text-lg">No transactions yet. Start earning!</div>
          )}

          {transactions.map((t) => (
            <div
              key={t.id}
              className="group bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex justify-between items-center hover:border-yellow-400/30 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-yellow-400/10 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  {t.type.includes("Ad") ? "🎬" : t.type.includes("Daily") ? "🔥" : "💰"}
                </div>
                <div>
                  <div className="font-semibold">{t.type}</div>
                  <div className="text-xs text-white/50">Just now</div>
                </div>
              </div>
              <div className="text-3xl font-black text-yellow-400">+{t.points}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}