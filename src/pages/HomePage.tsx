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
     🔥 GIGAPUB STATES
  =================================*/
  const [gigapubReady, setGigapubReady] = useState(false);
  const [gigapubLoading, setGigapubLoading] = useState(false);

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

      // Official Gigapub call
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
      {/* BALANCE */}
      <div className="rounded-3xl p-6 mb-6 text-center bg-gradient-to-br from-slate-900 to-slate-800 border border-yellow-400/20">
        {coinBurst && <div className="text-4xl animate-bounce">💰</div>}

        <div className="text-xs text-gray-400 mb-1">Total Balance</div>

        <div className="text-5xl font-black text-yellow-400">
          <AnimatedNumber value={balance?.points || 0} />
        </div>

        <div className="text-xs text-gray-500 mt-1">Available Points</div>
      </div>

      {/* WATCH AD (Adsgram / Monetag) */}
      <button
        onClick={async () => {
          if (!user) return;
          if (isAdRunning.current) return;

          if (Date.now() - lastAdTime < COOLDOWN) {
            alert("⏳ Wait a few seconds before next ad");
            return;
          }

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
            try {
              await showAdsgramAd();
            } catch {
              alert("Ad failed. Try again later.");
            }
          }

          setAdLoading(false);
          isAdRunning.current = false;
        }}
        disabled={adLoading}
        className="w-full rounded-3xl p-6 mb-6 font-bold text-lg bg-gradient-to-r from-yellow-400 to-orange-500 text-black shadow-lg active:scale-95"
      >
        {adLoading
          ? "Loading Ad..."
          : adNetwork === "adsgram"
          ? "🎬 Watch Adsgram Ad (+40)"
          : "💰 Watch Monetag Ad (+15)"}
      </button>

      {/* DAILY */}
      <div className="p-5 mb-6 flex justify-between bg-slate-800 rounded-2xl">
        <div>
          <div className="font-bold">🎁 Daily Reward</div>

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

      {/* TABS */}
      <div className="flex mb-4 bg-slate-900 rounded-xl p-1">
        <button
          onClick={() => setActiveTab("earn")}
          className={`flex-1 py-2 rounded-lg font-bold ${
            activeTab === "earn"
              ? "bg-yellow-400 text-black"
              : "text-gray-400"
          }`}
        >
          Earn
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-2 rounded-lg font-bold ${
            activeTab === "history"
              ? "bg-yellow-400 text-black"
              : "text-gray-400"
          }`}
        >
          History
        </button>
      </div>

      {/* EARN TAB - GIGAPUB AD PLACED EXACTLY IN RED BOX AREA */}
      {activeTab === "earn" && (
        <div className="space-y-4 mb-6">
          <AdsgramTask blockId="task-25198" />

          {/* 🔥 GIGAPUB AD (Red box area) */}
          <div className="mt-4 bg-slate-900 rounded-2xl p-5 border border-yellow-400/20">
            <div className="text-sm text-gray-400 mb-3 text-center">🎬 Extra Ad</div>
            
            <button
              onClick={handleGigapubAd}
              disabled={!gigapubReady || gigapubLoading}
              className="w-full py-4 rounded-2xl font-bold text-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white active:scale-95 disabled:opacity-70"
            >
              {gigapubLoading
                ? "Loading..."
                : gigapubReady
                ? "Watch Ad (+20)"
                : "Preparing..."}
            </button>
          </div>
        </div>
      )}

      {/* HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-3">
          {transactions.length === 0 && (
            <div className="text-gray-400 text-center">
              No transactions yet
            </div>
          )}

          {transactions.map((t) => (
            <div
              key={t.id}
              className="p-4 rounded-xl bg-slate-800 flex justify-between"
            >
              <div className="text-sm">{t.type}</div>

              <div className="text-yellow-400 font-bold">
                +{t.points}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}