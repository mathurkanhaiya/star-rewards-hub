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
   TYPES & HAPTIC
================================ */
type HapticType = "impact" | "success" | "error";

interface Transaction {
  id: string;
  type: string;
  points: number;
}

function triggerHaptic(type: HapticType) {
  if (typeof window !== "undefined" && (window as any).Telegram?.WebApp?.HapticFeedback) {
    const tg = (window as any).Telegram.WebApp;
    if (type === "impact") tg.HapticFeedback.impactOccurred("medium");
    if (type === "success") tg.HapticFeedback.notificationOccurred("success");
    if (type === "error") tg.HapticFeedback.notificationOccurred("error");
  }
}

/* ===============================
   ANIMATED BALANCE (Ultra Glow)
================================ */
function AnimatedNumber({ value = 0 }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    let start = prev.current;
    const diff = value - start;
    const steps = 30;
    const inc = diff / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      start += inc;
      setDisplay(step >= steps ? value : Math.floor(start));
      if (step >= steps) clearInterval(timer);
    }, 20);

    prev.current = value;
    return () => clearInterval(timer);
  }, [value]);

  return <span className="drop-shadow-[0_0_80px_#facc15]">{display.toLocaleString()}</span>;
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
   MAIN ULTRA PREMIUM V2 (Compact Tabs)
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

  const [gigapubReady, setGigapubReady] = useState(false);
  const [gigapubLoading, setGigapubLoading] = useState(false);
  const [adCooldownRemaining, setAdCooldownRemaining] = useState(0);

  const [adNetwork, setAdNetwork] = useState<"adsgram" | "monetag">(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("adNetwork") : null;
    return (saved === "adsgram" || saved === "monetag") ? saved : "adsgram";
  });

  const [lastAdTime, setLastAdTime] = useState<number>(() => {
    return typeof window !== "undefined" ? Number(localStorage.getItem("lastAdTime") || 0) : 0;
  });

  const COOLDOWN = 45000;
  const isAdRunning = useRef(false);

  useEffect(() => { localStorage.setItem("adNetwork", adNetwork); }, [adNetwork]);
  useEffect(() => { localStorage.setItem("lastAdTime", lastAdTime.toString()); }, [lastAdTime]);

  // Live Ad Countdown
  useEffect(() => {
    if (lastAdTime === 0) return setAdCooldownRemaining(0);
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((lastAdTime + COOLDOWN - Date.now()) / 1000));
      setAdCooldownRemaining(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [lastAdTime]);

  // Adsgram + Monetag + Gigapub (same as before)
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
      setDailyMessage("+15 pts 💎 (Monetag)");
      setTimeout(() => setCoinBurst(false), 1200);
      setTimeout(() => setDailyMessage(""), 3000);
      setAdNetwork("adsgram");
      return true;
    } catch (err) {
      console.error("❌ Monetag failed", err);
      return false;
    }
  };

  useEffect(() => {
    if ((window as any).showGiga) return setGigapubReady(true);
    const script = document.createElement("script");
    script.src = "https://ad.gigapub.tech/script?id=5935";
    script.async = true;
    script.onload = () => setGigapubReady(true);
    script.onerror = () => console.error("❌ Gigapub failed");
    document.head.appendChild(script);
  }, []);

  const handleGigapubAd = async () => {
    if (!user || Date.now() - lastAdTime < COOLDOWN || !gigapubReady) return;
    try {
      setGigapubLoading(true);
      await (window as any).showGiga();
      triggerHaptic("success");
      await logAdWatch(user.id, "gigapub_reward", 20);
      await refreshBalance();
      setLastAdTime(Date.now());
      setCoinBurst(true);
      setDailyMessage("+20 pts 🔥 (Gigapub)");
      setTimeout(() => setCoinBurst(false), 1200);
      setTimeout(() => setDailyMessage(""), 3000);
    } catch (error) {
      console.error(error);
      setDailyMessage("❌ No ad available");
      triggerHaptic("error");
      setTimeout(() => setDailyMessage(""), 3000);
    } finally {
      setGigapubLoading(false);
    }
  };

  // Load Data + Daily Cooldown (full logic)
  useEffect(() => {
    if (!user) return;
    getTransactions(user.id).then(setTransactions);
    checkDailyCooldown();
  }, [user]);

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
    <div className="min-h-screen bg-[radial-gradient(at_top,#1a1a1a_0%,#000000_80%)] text-white pb-28 px-4 overflow-hidden relative">
      {/* ... BALANCE HERO + AD BUTTON + DAILY CARD same as before ... */}

      {/* COMPACT PREMIUM TABS (now perfectly sized for all phones) */}
      <div className="flex mb-6 bg-white/5 backdrop-blur-3xl rounded-3xl p-1 border border-white/10">
        {["earn", "history"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as "earn" | "history")}
            className={`flex-1 py-3.5 rounded-3xl font-black text-lg transition-all min-h-[52px] ${
              activeTab === tab
                ? "bg-gradient-to-r from-yellow-400 to-amber-400 text-black shadow-2xl"
                : "text-white/60"
            }`}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* EARN & HISTORY TABS (same luxury look) */}
      {activeTab === "earn" && (
        <div className="space-y-8">
          <AdsgramTask blockId="task-25198" />
          {/* Gigapub VIP card same as before */}
          <div className="relative rounded-3xl bg-gradient-to-br from-purple-900/90 to-black border-2 border-purple-400/60 p-8 shadow-[0_0_90px_#a855f7]">
            {/* ... same Gigapub content ... */}
          </div>
        </div>
      )}

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
                  {t.type.includes("Ad") ? "🎬" : "💰"}
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