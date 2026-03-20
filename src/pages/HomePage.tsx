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
type Transaction = {
  id: string;
  type: string;
  points: number;
};

/* ===============================
   MAIN
================================ */
export default function HomePage() {
  const { user, balance, settings, refreshBalance } = useApp();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [adLoading, setAdLoading] = useState(false);

  const [dailyCooldown, setDailyCooldown] = useState(0);
  const [dailyMessage, setDailyMessage] = useState("");

  /* ===============================
     AD STATE
  =================================*/
  const [adNetwork, setAdNetwork] = useState<"adsgram" | "monetag">("adsgram");
  const [lastAdTime, setLastAdTime] = useState(0);
  const isAdRunning = useRef(false);
  const COOLDOWN = 8000;

  /* ===============================
     AUTO ADS (INTERSTITIAL)
  =================================*/
  const [autoAdsEnabled, setAutoAdsEnabled] = useState(
    localStorage.getItem("autoAds") === "true"
  );

  const [autoAdCount, setAutoAdCount] = useState(
    Number(localStorage.getItem("autoAdCount") || 0)
  );

  const [autoAdLimit, setAutoAdLimit] = useState(() => {
    const saved = localStorage.getItem("autoAdLimit");
    if (saved) return Number(saved);
    const limit = 10 + Math.floor(Math.random() * 6);
    localStorage.setItem("autoAdLimit", String(limit));
    return limit;
  });

  useEffect(() => {
    localStorage.setItem("autoAds", String(autoAdsEnabled));
    localStorage.setItem("autoAdCount", String(autoAdCount));
  }, [autoAdsEnabled, autoAdCount]);

  /* ===============================
     ADSGRAM (REWARDED)
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
     MONETAG (REWARDED)
  =================================*/
  const showMonetagRewardAd = async () => {
    if (!(window as any).show_10742752) return false;

    await (window as any).show_10742752();

    await logAdWatch(user!.id, "monetag_reward", 15);
    await refreshBalance();

    setLastAdTime(Date.now());
    setAdNetwork("adsgram");

    return true;
  };

  /* ===============================
     INTERSTITIAL (AUTO ADS)
  =================================*/
  const showInterstitialAd = async () => {
    try {
      if (!(window as any).show_10742752) return;
      await (window as any).show_10742752(); // same monetag interstitial
    } catch (e) {
      console.log("Interstitial failed");
    }
  };

  /* ===============================
     MANUAL AD (UNCHANGED)
  =================================*/
  const runAd = async () => {
    if (!user) return;
    if (isAdRunning.current) return;

    if (Date.now() - lastAdTime < COOLDOWN) {
      alert("⏳ Wait before next ad");
      return;
    }

    isAdRunning.current = true;
    setAdLoading(true);

    try {
      if (adNetwork === "adsgram") {
        await showAdsgramAd();
      } else {
        const ok = await showMonetagRewardAd();
        if (!ok) await showAdsgramAd();
      }
    } catch {
      await showAdsgramAd();
    }

    setAdLoading(false);
    isAdRunning.current = false;
  };

  /* ===============================
     AUTO ADS LOOP (INTERSTITIAL)
  =================================*/
  useEffect(() => {
    if (!autoAdsEnabled || !user) return;

    let stopped = false;

    const loop = async () => {
      if (autoAdCount >= autoAdLimit) return;

      await showInterstitialAd(); // ❗ INTERSTITIAL ONLY

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
  }, [autoAdsEnabled, user, autoAdCount]);

  /* ===============================
     DAILY CLAIM
  =================================*/
  const handleDailyClaim = async () => {
    if (!user || dailyCooldown > 0) return;

    const res = await claimDailyReward(user.id);

    if (res.success) {
      setDailyMessage(`+${res.points} pts`);
      await refreshBalance();
    } else {
      setDailyMessage(res.message);
    }

    setTimeout(() => setDailyMessage(""), 3000);
  };

  /* ===============================
     LOAD
  =================================*/
  useEffect(() => {
    if (!user) return;
    getTransactions(user.id).then(setTransactions);
  }, [user]);

  const [activeTab, setActiveTab] = useState<"earn" | "history">("earn");

  return (
    <div className="px-4 pb-28 text-white">

      {/* BALANCE */}
      <div className="text-center mb-6">
        <div className="text-4xl font-black text-yellow-400">
          {balance?.points || 0}
        </div>
        <div className="text-xs text-gray-400">Total Balance</div>
      </div>

      {/* MAIN AD BUTTON */}
      <button
        onClick={runAd}
        disabled={adLoading}
        className="w-full rounded-3xl p-6 mb-6 font-bold text-lg bg-gradient-to-r from-yellow-400 to-orange-500 text-black"
      >
        {adLoading
          ? "Loading Ad..."
          : adNetwork === "adsgram"
          ? "🎬 Watch Adsgram (+40)"
          : "💰 Watch Monetag (+15)"}
      </button>

      {/* DAILY CLAIM */}
      <div className="p-4 bg-slate-800 rounded-xl mb-6 flex justify-between">
        <div>
          <div className="font-bold">🎁 Daily Reward</div>
          <div className="text-xs text-gray-400">{dailyMessage}</div>
        </div>
        <button
          onClick={handleDailyClaim}
          className="bg-green-500 px-4 py-1 rounded-lg"
        >
          Claim
        </button>
      </div>

      {/* AUTO ADS */}
      <div className="flex justify-between mb-4 bg-slate-800 p-3 rounded-xl">
        <span>🤖 Auto Ads</span>
        <button
          onClick={() => setAutoAdsEnabled(!autoAdsEnabled)}
          className={`px-3 py-1 rounded ${
            autoAdsEnabled ? "bg-green-500" : "bg-red-500"
          }`}
        >
          {autoAdsEnabled ? "ON" : "OFF"}
        </button>
      </div>

      {/* TABS */}
      <div className="flex mb-4 bg-slate-900 rounded-xl p-1">
        <button
          onClick={() => setActiveTab("earn")}
          className={`flex-1 py-2 ${
            activeTab === "earn" ? "bg-yellow-400 text-black" : ""
          }`}
        >
          Earn
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-2 ${
            activeTab === "history" ? "bg-yellow-400 text-black" : ""
          }`}
        >
          History
        </button>
      </div>

      {/* CONTENT */}
      {activeTab === "earn" ? (
        <div className="text-center text-gray-400">
          No extra tasks
        </div>
      ) : (
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
      )}
    </div>
  );
}