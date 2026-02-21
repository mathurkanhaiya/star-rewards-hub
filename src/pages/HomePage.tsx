import React, { useEffect, useState, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { claimDailyReward, getTransactions, logAdWatch, getDailyClaim } from '@/lib/api';
import { useRewardedAd } from '@/hooks/useAdsgram';

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
  const [transactions, setTransactions] = useState<Array<{ id: string; type: string; points: number; description: string; created_at: string }>>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [dailyCooldown, setDailyCooldown] = useState(0);

  const onAdReward = useCallback(async () => {
    if (!user) return;
    await logAdWatch(user.id, 'bonus_reward', 50);
    await refreshBalance();
    setDailyMessage('+50 pts bonus from ad! 🎬');
    setTimeout(() => setDailyMessage(''), 3000);
  }, [user, refreshBalance]);

  const { showAd } = useRewardedAd(onAdReward);

  useEffect(() => {
    if (user) {
      getTransactions(user.id).then(txns => setTransactions(txns as Array<{ id: string; type: string; points: number; description: string; created_at: string }>));
      checkDailyCooldown();
    }
  }, [user]);

  // Daily cooldown timer
  useEffect(() => {
    if (dailyCooldown <= 0) return;
    const interval = setInterval(() => {
      setDailyCooldown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
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

  async function handleDailyClaim() {
    if (!user || dailyCooldown > 0) return;
    setDailyClaiming(true);
    setDailyMessage('');
    const result = await claimDailyReward(user.id);
    if (result.success) {
      setDailyMessage(`+${result.points} pts! Day ${result.streak} streak 🔥`);
      setShowConfetti(true);
      setDailyCooldown(24 * 60 * 60); // 24h
      await refreshBalance();
      setTimeout(() => setShowConfetti(false), 2000);
    } else {
      setDailyMessage(result.message || 'Already claimed today!');
      await checkDailyCooldown();
    }
    setDailyClaiming(false);
    setTimeout(() => setDailyMessage(''), 3000);
  }

  const stats = [
    { label: 'Points', value: (balance?.points || 0).toLocaleString(), icon: '⚡', color: 'hsl(45 100% 55%)' },
    { label: 'Stars', value: Number(balance?.stars_balance || 0).toFixed(2), icon: '⭐', color: 'hsl(190 100% 55%)' },
    { label: 'USDT', value: '$' + Number(balance?.usdt_balance || 0).toFixed(2), icon: '💵', color: 'hsl(140 70% 50%)' },
    { label: 'TON', value: Number(balance?.ton_balance || 0).toFixed(3), icon: '💎', color: 'hsl(210 100% 60%)' },
  ];

  return (
    <div className="px-4 pb-28">
      {/* Confetti */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="star-particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 40}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                width: `${Math.random() * 6 + 2}px`,
                height: `${Math.random() * 6 + 2}px`,
                background: ['hsl(45 100% 55%)', 'hsl(265 80% 65%)', 'hsl(190 100% 55%)'][Math.floor(Math.random() * 3)],
              }}
            />
          ))}
        </div>
      )}

      {/* Hero Balance Card */}
      <div
        className="rounded-2xl p-5 mb-4 text-center relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, hsl(220 30% 10%), hsl(265 30% 12%))',
          border: '1px solid hsl(265 50% 25% / 0.6)',
          boxShadow: '0 0 40px hsl(265 80% 65% / 0.1)',
        }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{ background: 'radial-gradient(circle at 70% 50%, hsl(45 100% 55%) 0%, transparent 60%)' }}
        />
        <div className="relative z-10">
          <div className="text-xs text-muted-foreground mb-1 font-medium tracking-widest uppercase">Total Earned</div>
          <div className="text-4xl font-display font-black text-gold-gradient mb-1">
            {(balance?.total_earned || 0).toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">points earned all time</div>
          <div className="mt-3 flex justify-center gap-4 text-xs">
            <span className="text-muted-foreground">Level <span className="text-foreground font-bold">{user?.level || 1}</span></span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">Withdrawn <span className="text-foreground font-bold">{(balance?.total_withdrawn || 0).toLocaleString()}</span></span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {stats.map(stat => (
          <div key={stat.label} className="stat-card p-3 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{stat.icon}</span>
              <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
            </div>
            <div className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* WATCH & EARN - Big prominent button */}
      <button
        className="w-full rounded-2xl p-5 mb-4 flex flex-col items-center justify-center gap-2 font-bold transition-all active:scale-95 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, hsl(45 100% 50%), hsl(35 100% 45%), hsl(25 100% 50%))',
          color: 'hsl(220 30% 5%)',
          boxShadow: '0 0 30px hsl(45 100% 55% / 0.4), 0 4px 15px hsl(45 100% 55% / 0.3)',
          opacity: adLoading ? 0.7 : 1,
        }}
        onClick={async () => { setAdLoading(true); await showAd(); setAdLoading(false); }}
        disabled={adLoading}
      >
        <div className="text-3xl">🎬</div>
        <div className="text-lg font-black tracking-wide">
          {adLoading ? '⏳ Loading Ad...' : 'WATCH & EARN'}
        </div>
        <div className="text-xs font-semibold opacity-80">Tap to watch ad → Get +50 bonus points!</div>
      </button>

      {/* Daily Reward */}
      <div
        className="rounded-2xl p-4 mb-4 flex items-center justify-between"
        style={{
          background: 'linear-gradient(135deg, hsl(45 100% 55% / 0.1), hsl(35 100% 45% / 0.05))',
          border: '1px solid hsl(45 100% 55% / 0.25)',
        }}
      >
        <div>
          <div className="font-bold text-sm text-foreground">Daily Reward</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {dailyMessage || (dailyCooldown > 0 ? `⏳ Next in ${formatCountdown(dailyCooldown)}` : `+${settings.daily_bonus_base || 100} pts minimum`)}
          </div>
        </div>
        <button
          className="btn-gold px-4 py-2 rounded-xl text-sm font-bold"
          onClick={handleDailyClaim}
          disabled={dailyClaiming || dailyCooldown > 0}
          style={{ opacity: dailyClaiming || dailyCooldown > 0 ? 0.5 : 1 }}
        >
          {dailyClaiming ? '...' : dailyCooldown > 0 ? '⏳' : '🎁 Claim'}
        </button>
      </div>

      <div className="mb-4">
        <div className="text-xs font-semibold text-muted-foreground mb-3 tracking-wider uppercase">Quick Actions</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: '🎡', label: 'Spin', desc: 'Win prizes', color: 'hsl(265 80% 65%)' },
            { icon: '📋', label: 'Tasks', desc: 'Earn more', color: 'hsl(190 100% 55%)' },
            { icon: '👥', label: 'Invite', desc: '+500 pts', color: 'hsl(140 70% 50%)' },
          ].map(action => (
            <div
              key={action.label}
              className="rounded-xl p-3 text-center cursor-pointer transition-all duration-200 active:scale-95"
              style={{
                background: `${action.color}10`,
                border: `1px solid ${action.color}30`,
              }}
            >
              <div className="text-2xl mb-1">{action.icon}</div>
              <div className="text-xs font-bold text-foreground">{action.label}</div>
              <div className="text-xs text-muted-foreground">{action.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground mb-3 tracking-wider uppercase">Recent Activity</div>
        {transactions.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-6">No activity yet. Start earning! 🚀</div>
        ) : (
          <div className="space-y-2">
            {transactions.slice(0, 5).map(tx => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 rounded-xl"
                style={{
                  background: 'hsl(220 25% 8% / 0.6)',
                  border: '1px solid hsl(220 20% 15% / 0.5)',
                }}
              >
                <div>
                  <div className="text-sm font-medium text-foreground">{tx.description || tx.type}</div>
                  <div className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</div>
                </div>
                <div className="text-sm font-bold" style={{ color: tx.points >= 0 ? 'hsl(140 70% 50%)' : 'hsl(0 80% 55%)' }}>
                  {tx.points >= 0 ? '+' : ''}{tx.points.toLocaleString()} pts
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
