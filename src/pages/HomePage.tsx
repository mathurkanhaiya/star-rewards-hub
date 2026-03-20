import React, { useEffect, useState, useCallback, useRef } from "react";
import { useApp } from "@/context/AppContext";
import {
  claimDailyReward,
  getTransactions,
  logAdWatch,
  getDailyClaim
} from "@/lib/api";
import { useRewardedAd } from "@/hooks/useAdsgram";

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
   HAPTIC
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
   MAIN COMPONENT
================================ */
export default function HomePage() {
  const { user, balance, settings, refreshBalance } = useApp();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [adLoading, setAdLoading] = useState(false);

  const [autoAdsEnabled, setAutoAdsEnabled] = useState(() => {
    return localStorage.getItem("autoAds") === "true";
  });

  const [autoAdCount, setAutoAdCount] = useState(() => {
    return Number(localStorage.getItem("autoAdCount") || 0);
  });

  const [autoAdLimit, setAutoAdLimit] = useState(() => {
    const saved = localStorage.getItem("autoAdLimit");
    if (saved) return Number(saved);

    const randomLimit = 10 + Math.floor(Math.random() * 6);
    localStorage.setItem("autoAdLimit", String(randomLimit));
    return randomLimit;
  });

  const [adNetwork, setAdNetwork] = useState<"adsgram" | "monetag">("adsgram");
  const [lastAdTime, setLastAdTime] = useState(0);

  const isAdRunning = useRef(false);

  const COOLDOWN = 8000;

  useEffect(() => {
    localStorage.setItem("autoAds", String(autoAdsEnabled));
    localStorage.setItem("autoAdCount", String(autoAdCount));
    localStorage.setItem("autoAdLimit", String(autoAdLimit));
  }, [autoAdsEnabled, autoAdCount, autoAdLimit]);

  /* ===============================
     ADSGRAM
  =================================*/
  const onAdsgramReward = useCallback(async () => {
    if (!user) return;

    await logAdWatch(user.id, "adsgram_reward", 40);
    await refreshBalance();

    setLastAdTime(Date.now());
    setAdNetwork("monetag");
  }, [user]);

  const { showAd: showAdsgramAd } = useRewardedAd(onAdsgramReward);

  /* ===============================
     MONETAG
  =================================*/
  const showMonetagAd = async () => {
    if (!(window as any).show_10742752) return false;

    await (window as any).show_10742752();

    await logAdWatch(user!.id, "monetag_reward", 15);
    await refreshBalance();

    setLastAdTime(Date.now());
    setAdNetwork("adsgram");

    return true;
  };

  /* ===============================
     RUN AD (UNCHANGED CORE LOGIC)
  =================================*/
  const runAd = async () => {
    if (!user) return;
    if (isAdRunning.current) return;

    if (Date.now() - lastAdTime < COOLDOWN) return;

    isAdRunning.current = true;
    setAdLoading(true);

    try {
      if (adNetwork === "adsgram") {
        await showAdsgramAd();
      } else {
        const ok = await showMonetagAd();
        if (!ok) await showAdsgramAd();
      }
    } catch {
      await showAdsgramAd();
    }

    setAdLoading(false);
    isAdRunning.current = false;
  };

  /* ===============================
     🔥 AUTO ADS (AFTER AD FINISH)
  =================================*/
  useEffect(() => {
    if (!autoAdsEnabled || !user) return;

    let stopped = false;

    const loop = async () => {
      if (autoAdCount >= autoAdLimit) return;

      await runAd();

      if (stopped) return;

      setAutoAdCount((prev) => prev + 1);

      const delay = 3000 + Math.random() * 2000;

      setTimeout(() => {
        if (!stopped) loop();
      }, delay);
    };

    loop();

    return () => {
      stopped = true;
    };
  }, [autoAdsEnabled, user, autoAdCount, autoAdLimit]);

  /* ===============================
     LOAD
  =================================*/
  useEffect(() => {
    if (!user) return;
    getTransactions(user.id).then(setTransactions);
  }, [user]);

  return (
    <div className="px-4 pb-28 text-white">

      {/* 🎮 TAGLINE */}
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold text-yellow-400">
          🚀 Earn Coins. Watch Ads. Level Up!
        </h1>
        <p className="text-xs text-gray-400">
          Play more. Earn more. Win big.
        </p>
      </div>

      {/* BALANCE */}
      <div className="rounded-3xl p-6 mb-6 text-center bg-slate-900">
        <div className="text-4xl font-black text-yellow-400">
          {balance?.points || 0}
        </div>
      </div>

      {/* AUTO ADS TOGGLE */}
      <div className="flex justify-between items-center mb-4 bg-slate-800 p-4 rounded-xl">
        <span>🤖 Auto Ads</span>
        <button
          onClick={() => setAutoAdsEnabled(!autoAdsEnabled)}
          className={`px-4 py-1 rounded-lg font-bold ${
            autoAdsEnabled ? "bg-green-500" : "bg-red-500"
          }`}
        >
          {autoAdsEnabled ? "ON" : "OFF"}
        </button>
      </div>

      {/* PROGRESS */}
      <div className="text-center text-sm text-gray-400 mb-3">
        {autoAdCount}/{autoAdLimit} Auto Ads
      </div>

      {/* MANUAL AD BUTTON (UNCHANGED) */}
      <button
        onClick={runAd}
        disabled={adLoading}
        className="w-full p-5 mb-6 bg-yellow-400 text-black rounded-2xl font-bold"
      >
        {adLoading ? "Loading..." : "🎬 Watch Ad"}
      </button>

      {/* HISTORY */}
      <div className="space-y-3">
        {transactions.map((t) => (
          <div
            key={t.id}
            className="p-3 bg-slate-800 rounded-xl flex justify-between"
          >
            <span>{t.type}</span>
            <span className="text-yellow-400">+{t.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}