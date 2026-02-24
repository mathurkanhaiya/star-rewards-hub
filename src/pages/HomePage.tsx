import React, { useEffect, useState, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { claimDailyReward, getTransactions, logAdWatch, getDailyClaim } from '@/lib/api';
import { useRewardedAd } from '@/hooks/useAdsgram';

/* ===============================
   TELEGRAM HAPTIC
================================ */
function triggerHaptic(type: 'success' | 'error' | 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;
    if (tg?.HapticFeedback) {
      if (type === 'impact') tg.HapticFeedback.impactOccurred('medium');
      if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
      if (type === 'error') tg.HapticFeedback.notificationOccurred('error');
    }
  }
}

function formatCountdown(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function HomePage() {
  const { user, balance, settings, refreshBalance } = useApp();

  const [dailyClaiming, setDailyClaiming] = useState(false);
  const [dailyMessage, setDailyMessage] = useState('');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [dailyCooldown, setDailyCooldown] = useState(0);

  /* ===============================
     AD REWARD
  =================================*/
  const onAdReward = useCallback(async () => {
    if (!user) return;

    triggerHaptic('success');
    await logAdWatch(user.id, 'bonus_reward', 50);
    await refreshBalance();

    setDailyMessage('+50 pts bonus from ad! 🎬');
    setTimeout(() => setDailyMessage(''), 3000);
  }, [user, refreshBalance]);

  const { showAd } = useRewardedAd(onAdReward);

  /* ===============================
     LOAD DATA
  =================================*/
  useEffect(() => {
    if (!user) return;

    getTransactions(user.id).then(setTransactions);
    checkDailyCooldown();
  }, [user]);

  /* ===============================
     DAILY COOLDOWN TIMER
  =================================*/
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
      const claimedAt = new Date(claim.claimed_at).getTime();
      const nextAvailable = claimedAt + 24 * 60 * 60 * 1000;
      const remaining = Math.max(0, Math.floor((nextAvailable - Date.now()) / 1000));
      setDailyCooldown(remaining);
    }
  }

  /* ===============================
     DAILY CLAIM
  =================================*/
  async function handleDailyClaim() {
    if (!user || dailyCooldown > 0) return;

    triggerHaptic('impact');
    setDailyClaiming(true);
    setDailyMessage('');

    const result = await claimDailyReward(user.id);

    if (result.success) {
      triggerHaptic('success');
      setDailyMessage(`+${result.points} pts! Day ${result.streak} 🔥`);
      setShowConfetti(true);
      setDailyCooldown(24 * 60 * 60);
      await refreshBalance();
      setTimeout(() => setShowConfetti(false), 2000);
    } else {
      triggerHaptic('error');
      setDailyMessage(result.message || 'Already claimed!');
      await checkDailyCooldown();
    }

    setDailyClaiming(false);
    setTimeout(() => setDailyMessage(''), 3000);
  }

  /* ===============================
     UI
  =================================*/
  return (
    <div className="px-4 pb-28 text-white">

      {/* HERO BALANCE */}
      <div
        className="rounded-3xl p-6 mb-5 text-center relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg,#0f172a,#1e293b)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
        }}
      >
        <div className="text-xs uppercase tracking-widest text-gray-400 mb-1">
          Total Earned
        </div>
        <div className="text-4xl font-black text-yellow-400">
          {(balance?.points || 0).toLocaleString()}
        </div>
        <div className="text-sm text-gray-400 mt-1">
          Available Points 
        </div>
      </div>

      {/* WATCH & EARN */}
      <button
        onClick={async () => {
          triggerHaptic('impact');
          setAdLoading(true);
          await showAd();
          setAdLoading(false);
        }}
        disabled={adLoading}
        className="w-full rounded-3xl p-6 mb-5 font-bold text-lg relative overflow-hidden transition active:scale-95"
        style={{
          background: 'linear-gradient(135deg,#facc15,#f97316)',
          color: '#111',
          boxShadow: '0 10px 30px rgba(250,204,21,0.4)',
          opacity: adLoading ? 0.7 : 1
        }}
      >
        <div className="text-3xl mb-2">🎬</div>
        {adLoading ? 'Loading Ad...' : 'WATCH & EARN +50'}
      </button>

      {/* DAILY REWARD */}
      <div
        className="rounded-2xl p-4 mb-5 flex items-center justify-between"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(10px)'
        }}
      >
        <div>
          <div className="font-bold">Daily Reward</div>
          <div className="text-xs text-gray-400 mt-1">
            {dailyMessage ||
              (dailyCooldown > 0
                ? `⏳ ${formatCountdown(dailyCooldown)}`
                : `+${settings.daily_bonus_base || 100} pts`)}
          </div>
        </div>

        <button
          onClick={handleDailyClaim}
          disabled={dailyClaiming || dailyCooldown > 0}
          className="px-4 py-2 rounded-xl font-bold transition active:scale-95"
          style={{
            background:
              dailyCooldown > 0
                ? '#374151'
                : 'linear-gradient(135deg,#22c55e,#16a34a)',
            color: 'white',
            opacity: dailyClaiming ? 0.6 : 1
          }}
        >
          {dailyCooldown > 0 ? 'Locked' : 'Claim'}
        </button>
      </div>

      {/* RECENT TRANSACTIONS */}
      <div>
        <div className="text-xs uppercase tracking-wider text-gray-400 mb-3">
          Recent Activity
        </div>

        {transactions.length === 0 ? (
          <div className="text-center text-gray-500 py-6">
            No activity yet 🚀
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.slice(0, 5).map(tx => (
              <div
                key={tx.id}
                className="flex justify-between items-center p-4 rounded-xl transition active:scale-[0.98]"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
                onClick={() => triggerHaptic('impact')}
              >
                <div>
                  <div className="font-medium">{tx.description || tx.type}</div>
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
            ))}
          </div>
        )}
      </div>

    </div>
  );
}