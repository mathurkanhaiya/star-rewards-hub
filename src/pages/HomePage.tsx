import React, { useEffect, useState, useCallback, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { claimDailyReward, getTransactions, logAdWatch, getDailyClaim } from "@/lib/api";
import { useRewardedAd } from "@/hooks/useAdsgram";

/* ===============================
   TELEGRAM HAPTIC
================================ */
function triggerHaptic(type) {
  if (typeof window !== "undefined" && window.Telegram) {
    const tg = window.Telegram.WebApp;
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
function AnimatedNumber({ value }) {
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

function formatCountdown(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function HomePage() {
  const { user, balance, settings, refreshBalance } = useApp();

  const [dailyClaiming, setDailyClaiming] = useState(false);
  const [dailyMessage, setDailyMessage] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [adLoading, setAdLoading] = useState(false);
  const [dailyCooldown, setDailyCooldown] = useState(0);
  const [coinBurst, setCoinBurst] = useState(false);

  /* ===============================
     ADSGRAM REWARDED AD
  =================================*/
  const onAdReward = useCallback(async () => {
    if (!user) return;

    triggerHaptic("success");

    await logAdWatch(user.id, "adsgram_reward", 50);
    await refreshBalance();

    setCoinBurst(true);
    setDailyMessage("+50 pts 🎬");

    setTimeout(() => setCoinBurst(false), 1200);
    setTimeout(() => setDailyMessage(""), 3000);
  }, [user, refreshBalance]);

  const { showAd } = useRewardedAd(onAdReward);

  /* ===============================
     ADSTERRA POPUNDER
  =================================*/
  function showAdsterraPopunder() {
    const script = document.createElement("script");

    script.src =
      "https://pl28904336.effectivegatecpm.com/43/dc/6e/43dc6e7f42cb75b97aff13c278339d34.js";

    script.async = true;

    document.body.appendChild(script);
  }

  async function handlePopunderReward() {
    if (!user) return;

    triggerHaptic("impact");

    showAdsterraPopunder();

    setTimeout(async () => {
      await logAdWatch(user.id, "adsterra_popunder", 30);
      await refreshBalance();

      setCoinBurst(true);
      setDailyMessage("+30 pts 📺");

      setTimeout(() => setCoinBurst(false), 1200);
      setTimeout(() => setDailyMessage(""), 3000);
    }, 4000);
  }

  /* ===============================
     ADSTERRA NATIVE BANNER
  =================================*/
  useEffect(() => {
    const script = document.createElement("script");

    script.src =
      "https://pl28904350.effectivegatecpm.com/1b89685908e0ae9bf3327082f3d0a363/invoke.js";

    script.async = true;
    script.setAttribute("data-cfasync", "false");

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

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
      setDailyCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [dailyCooldown]);

  async function checkDailyCooldown() {
    if (!user) return;

    const claim = await getDailyClaim(user.id);

    if (claim) {
      const now = new Date();
      const midnightUTC = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
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
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
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

      {/* BALANCE CARD */}
      <div className="rounded-3xl p-6 mb-6 text-center bg-slate-800">

        {coinBurst && (
          <div className="text-4xl animate-bounce">💰</div>
        )}

        <div className="text-xs text-gray-400 mb-2">
          Total Balance
        </div>

        <div className="text-5xl font-black text-yellow-400">
          <AnimatedNumber value={balance?.points || 0} />
        </div>

        <div className="text-sm text-gray-400 mt-2">
          Available Points
        </div>

      </div>

      {/* WATCH ADSGRAM */}
      <button
        onClick={async () => {
          triggerHaptic("impact");

          setAdLoading(true);

          await showAd();

          setAdLoading(false);
        }}
        disabled={adLoading}
        className="w-full rounded-3xl p-6 mb-6 font-bold text-lg bg-yellow-400 text-black"
      >
        🎬 WATCH & EARN +50
      </button>

      {/* WATCH ADSTERRA */}
      <button
        onClick={handlePopunderReward}
        className="w-full rounded-3xl p-6 mb-6 font-bold text-lg bg-blue-500"
      >
        📺 WATCH AD +30
      </button>

      {/* NATIVE BANNER */}
      <div className="my-6">
        <div id="container-1b89685908e0ae9bf3327082f3d0a363"></div>
      </div>

      {/* DAILY REWARD */}
      <div className="p-5 mb-6 flex justify-between bg-slate-800 rounded-2xl">

        <div>
          <div className="font-bold">
            Daily Reward
          </div>

          <div className="text-xs text-gray-400">

            {dailyMessage ||
              (dailyCooldown > 0
                ? `⏳ ${formatCountdown(dailyCooldown)}`
                : `+${settings?.daily_bonus_base || 100} pts`)}

          </div>
        </div>

        <button
          onClick={handleDailyClaim}
          disabled={dailyClaiming || dailyCooldown > 0}
          className="px-5 py-2 bg-green-500 rounded-xl font-bold"
        >
          {dailyCooldown > 0 ? "Locked" : "Claim"}
        </button>

      </div>

      {/* TRANSACTIONS */}
      <div>

        <div className="text-xs text-gray-400 mb-3">
          Recent Activity
        </div>

        {transactions.slice(0, 5).map((tx) => (

          <div
            key={tx.id}
            className="p-4 mb-3 rounded-xl bg-slate-800 flex justify-between"
          >

            <div>

              <div>
                {tx.description || tx.type}
              </div>

              <div className="text-xs text-gray-400">
                {new Date(tx.created_at).toLocaleDateString()}
              </div>

            </div>

            <div
              className="font-bold"
              style={{
                color: tx.points >= 0 ? "#22c55e" : "#ef4444"
              }}
            >
              {tx.points >= 0 ? "+" : ""}
              {tx.points} pts
            </div>

          </div>

        ))}

      </div>

    </div>
  );
}