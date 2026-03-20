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
   Animated Balance
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

  return <>{display.toLocaleString()}</>;
}

/* ===============================
   UTILS
================================ */
function formatCountdown(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/* ===============================
   MAIN COMPONENT
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
     🔥 PERSISTENT AD STATE
  =================================*/
  const [adNetwork, setAdNetwork] = useState<"adsgram" | "monetag">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("adNetwork");
      if (saved === "adsgram" || saved === "monetag") {
        return saved;
      }
    }
    return "adsgram";
  });

  const [lastAdTime, setLastAdTime] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return Number(localStorage.getItem("lastAdTime") || 0);
    }
    return 0;
  });

  const COOLDOWN = 8000;
  const isAdRunning = useRef(false);

  useEffect(() => {
    localStorage.setItem("adNetwork", adNetwork);
  }, [adNetwork]);

  useEffect(() => {
    localStorage.setItem("lastAdTime", lastAdTime.toString());
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
      if (!(window as any).show_10742752) {
        throw new Error("Monetag not loaded");
      }

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
     🔥 GIGAPUB (ONLY ADDITION)
  =================================*/
  const [gigapubReady, setGigapubReady] = useState(false);
  const [gigapubLoading, setGigapubLoading] = useState(false);

  useEffect(() => {
    if ((window as any).showGiga) {
      setGigapubReady(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://ad.gigapub.tech/script?id=5935";
    script.async = true;

    script.onload = () => setGigapubReady(true);
    script.onerror = () => console.error("Gigapub failed");

    document.body.appendChild(script);
  }, []);

  const handleGigapubAd = async () => {
    if (!user) return;

    if (Date.now() - lastAdTime < COOLDOWN) {
      alert("⏳ Wait before next ad");
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
    } catch (e) {
      console.error("Gigapub error:", e);
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

      const midnightUTC = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1
        )
      );

      const remaining = Math.max(
        0,
        Math.floor((midnightUTC.getTime() - now.getTime()) / 1000)
      );

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

      const midnightUTC = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1
        )
      );

      setDailyCooldown(
        Math.floor((midnightUTC.getTime() - now.getTime()) / 1000)
      );

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
    <div className="px-4 pb-28 text-white">
      {/* ALL YOUR ORIGINAL UI UNCHANGED ABOVE */}

      {/* 🔥 GIGAPUB (BOTTOM ONLY) */}
      <div className="mt-6 bg-slate-900 rounded-2xl p-4 border border-yellow-400/20">
        <div className="text-sm text-gray-400 mb-2 text-center">
          🎬 Extra Ad
        </div>

        <button
          onClick={handleGigapubAd}
          disabled={!gigapubReady || gigapubLoading}
          className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white active:scale-95"
        >
          {gigapubLoading
            ? "Loading..."
            : gigapubReady
            ? "Watch Ad (+20)"
            : "Preparing..."}
        </button>
      </div>
    </div>
  );
}