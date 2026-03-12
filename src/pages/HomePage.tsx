import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { claimDailyReward, getTransactions, logAdWatch, getDailyClaim } from '@/lib/api';
import { useRewardedAd } from '@/hooks/useAdsgram';

/* ===============================
   HAPTIC
================================ */
function triggerHaptic(type) {
  if (typeof window !== 'undefined' && window.Telegram) {
    const tg = window.Telegram.WebApp;
    if (tg?.HapticFeedback) {
      if (type === 'impact') tg.HapticFeedback.impactOccurred('medium');
      if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
      if (type === 'error') tg.HapticFeedback.notificationOccurred('error');
    }
  }
}

/* ===============================
   Animated Counter
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

  return `${h.toString().padStart(2,'0')}:${m
    .toString()
    .padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

export default function HomePage() {
  const { user, balance, settings, refreshBalance } = useApp();

  const [dailyClaiming, setDailyClaiming] = useState(false);
  const [dailyMessage, setDailyMessage] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [adLoading, setAdLoading] = useState(false);
  const [dailyCooldown, setDailyCooldown] = useState(0);
  const [coinBurst, setCoinBurst] = useState(false);

  /* ===============================
     ADSGRAM REWARD
  =================================*/
  const onAdReward = useCallback(async () => {
    if (!user) return;

    triggerHaptic('success');

    await logAdWatch(user.id, 'bonus_reward', 50);
    await refreshBalance();

    setCoinBurst(true);
    setDailyMessage('+50 pts bonus 🎬');

    setTimeout(() => setCoinBurst(false), 1200);
    setTimeout(() => setDailyMessage(''), 3000);
  }, [user, refreshBalance]);

  const { showAd } = useRewardedAd(onAdReward);

  /* ===============================
     EFFECTIVEGATE POPUP AD
  =================================*/
  function loadGateAdScript() {
    const old = document.getElementById('gate-ad-script');

    if (old) {
      old.remove();
    }

    const script = document.createElement('script');
    script.src =
      'https://pl28904336.effectivegatecpm.com/43/dc/6e/43dc6e7f42cb75b97aff13c278339d34.js';
    script.async = true;
    script.id = 'gate-ad-script';

    document.body.appendChild(script);
  }

  async function handlePopupAd() {
    if (!user) return;

    triggerHaptic('impact');

    loadGateAdScript();

    setTimeout(async () => {
      await logAdWatch(user.id, 'popup_ad', 30);
      await refreshBalance();

      setCoinBurst(true);
      setDailyMessage('+30 pts popup bonus 📺');

      setTimeout(() => setCoinBurst(false), 1200);
      setTimeout(() => setDailyMessage(''), 3000);
    }, 4000);
  }

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
      setDailyCooldown(prev => (prev <= 1 ? 0 : prev - 1));
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

    triggerHaptic('impact');
    setDailyClaiming(true);

    const result = await claimDailyReward(user.id);

    if (result.success) {
      triggerHaptic('success');

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
      triggerHaptic('error');

      setDailyMessage(result.message || 'Already claimed!');
      await checkDailyCooldown();
    }

    setDailyClaiming(false);
    setTimeout(() => setDailyMessage(''), 3000);
  }

  return (
    <div className="px-4 pb-28 text-white relative overflow-hidden">

      {/* BALANCE */}
      <div
        className="rounded-3xl p-6 mb-6 text-center relative"
        style={{
          background: 'linear-gradient(145deg,#0f172a,#1e293b)',
          border: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        {coinBurst && (
          <div className="absolute inset-0 flex items-center justify-center text-4xl animate-bounce">
            💰
          </div>
        )}

        <div className="text-xs text-gray-400 mb-2">Total Balance</div>

        <div className="text-5xl font-black text-yellow-400">
          <AnimatedNumber value={balance?.points || 0} />
        </div>

        <div className="text-sm text-gray-400 mt-2">
          Available Points
        </div>
      </div>

      {/* ADSGRAM AD */}
      <button
        onClick={async () => {
          triggerHaptic('impact');
          setAdLoading(true);
          await showAd();
          setAdLoading(false);
        }}
        disabled={adLoading}
        className="w-full rounded-3xl p-6 mb-6 font-bold text-lg"
        style={{
          background: 'linear-gradient(135deg,#facc15,#f97316)',
          color: '#111'
        }}
      >
        🎬 WATCH & EARN +50
      </button>

      {/* POPUP AD */}
      <button
        onClick={handlePopupAd}
        className="w-full rounded-3xl p-6 mb-6 font-bold text-lg"
        style={{
          background: 'linear-gradient(135deg,#38bdf8,#6366f1)',
          color: '#fff'
        }}
      >
        📺 WATCH POPUP AD +30
      </button>

      {/* DAILY REWARD */}
      <div
        className="rounded-2xl p-5 mb-6 flex items-center justify-between"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <div>
          <div className="font-bold">Daily Reward</div>
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
          className="px-5 py-2 rounded-xl font-bold"
          style={{
            background:
              dailyCooldown > 0
                ? '#374151'
                : 'linear-gradient(135deg,#22c55e,#16a34a)',
            color: 'white'
          }}
        >
          {dailyCooldown > 0 ? 'Locked' : 'Claim'}
        </button>
      </div>

      {/* TRANSACTIONS */}
      <div>
        <div className="text-xs text-gray-400 mb-3">
          Recent Activity
        </div>

        {transactions.length === 0 ? (
          <div className="text-center text-gray-500 py-6">
            No activity yet 🚀
          </div>
        ) : (
          <div className="space-y-4">
            {transactions.slice(0, 5).map(tx => (
              <div
                key={tx.id}
                className="p-4 rounded-2xl"
                style={{
                  background: 'linear-gradient(145deg,#0f172a,#1e293b)',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <div className="flex justify-between">
                  <div>
                    <div className="font-semibold">
                      {tx.description || tx.type}
                    </div>

                    <div className="text-xs text-gray-400">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div
                    className="font-bold"
                    style={{
                      color: tx.points >= 0 ? '#22c55e' : '#ef4444'
                    }}
                  >
                    {tx.points >= 0 ? '+' : ''}
                    {tx.points.toLocaleString()} pts
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}