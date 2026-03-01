import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useRewardedAd } from '@/hooks/useAdsgram';
import { supabase } from '@/integrations/supabase/client';
import { logAdWatch } from '@/lib/api';
import { Progress } from '@/components/ui/progress';

function triggerHaptic(type: 'success' | 'error' | 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.HapticFeedback) {
    const hf = (window as any).Telegram.WebApp.HapticFeedback;
    if (type === 'impact') hf.impactOccurred('medium');
    else hf.notificationOccurred(type);
  }
}

interface MinerState {
  coins: number;
  coins_per_second: number;
  mine_level: number;
  pickaxe_level: number;
  worker_count: number;
  total_coins_earned: number;
  last_collected_at: string;
}

interface LeaderEntry {
  user_id: string;
  total_coins_earned: number;
  mine_level: number;
  first_name?: string;
  username?: string;
}

const UPGRADES = {
  pickaxe: { baseCost: 50, costMultiplier: 1.8, cpsBonus: 0.5, icon: '⛏️', name: 'Pickaxe' },
  worker: { baseCost: 200, costMultiplier: 2.0, cpsBonus: 2, icon: '👷', name: 'Worker' },
  mine: { baseCost: 1000, costMultiplier: 2.5, cpsBonus: 5, icon: '⛰️', name: 'Mine Level' },
};

function getUpgradeCost(type: keyof typeof UPGRADES, level: number) {
  const u = UPGRADES[type];
  return Math.floor(u.baseCost * Math.pow(u.costMultiplier, level));
}

function formatNum(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.floor(n).toLocaleString();
}

export default function IdleMinerPage() {
  const { user, refreshBalance } = useApp();
  const [miner, setMiner] = useState<MinerState | null>(null);
  const [displayCoins, setDisplayCoins] = useState(0);
  const [showBoost, setShowBoost] = useState('');
  const [boostMultiplier, setBoostMultiplier] = useState(1);
  const [boostEnd, setBoostEnd] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [showLB, setShowLB] = useState(false);
  const [tapParticles, setTapParticles] = useState<{ id: number; x: number; y: number }[]>([]);
  const particleId = useRef(0);

  // Idle accumulation
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  // Ad hooks
  const on2xReward = useCallback(() => {
    triggerHaptic('success');
    setBoostMultiplier(2);
    setBoostEnd(Date.now() + 5 * 60 * 1000);
    setShowBoost('2x income for 5 minutes!');
    setTimeout(() => setShowBoost(''), 3000);
    if (user) logAdWatch(user.id, 'miner_2x', 0);
  }, [user]);

  const onInstantReward = useCallback(() => {
    if (!miner) return;
    triggerHaptic('success');
    const instant = miner.coins_per_second * 3600;
    setMiner(prev => prev ? { ...prev, coins: prev.coins + instant, total_coins_earned: prev.total_coins_earned + instant } : prev);
    setShowBoost(`+${formatNum(instant)} instant coins!`);
    setTimeout(() => setShowBoost(''), 3000);
    if (user) logAdWatch(user.id, 'miner_instant', 0);
  }, [miner, user]);

  const onSpeedReward = useCallback(() => {
    triggerHaptic('success');
    setBoostMultiplier(prev => prev * 3);
    setBoostEnd(Date.now() + 2 * 60 * 1000);
    setShowBoost('3x speed boost!');
    setTimeout(() => setShowBoost(''), 3000);
    if (user) logAdWatch(user.id, 'miner_speed', 0);
  }, [user]);

  const { showAd: show2xAd } = useRewardedAd(on2xReward);
  const { showAd: showInstantAd } = useRewardedAd(onInstantReward);
  const { showAd: showSpeedAd } = useRewardedAd(onSpeedReward);

  // Load miner state
  useEffect(() => {
    if (!user) return;
    loadMiner();
    loadLeaderboard();
  }, [user]);

  async function loadMiner() {
    if (!user) return;
    const { data } = await supabase
      .from('miner_progress')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      // Calculate idle earnings
      const lastCollected = new Date(data.last_collected_at).getTime();
      const elapsed = Math.min((Date.now() - lastCollected) / 1000, 7200); // max 2hr idle
      const idleEarnings = data.coins_per_second * elapsed;
      const updated = {
        ...data,
        coins: data.coins + idleEarnings,
        total_coins_earned: data.total_coins_earned + idleEarnings,
      };
      setMiner(updated as MinerState);
      setDisplayCoins(updated.coins);

      if (idleEarnings > 10) {
        setShowBoost(`+${formatNum(idleEarnings)} idle coins collected!`);
        setTimeout(() => setShowBoost(''), 4000);
      }
    } else {
      // Create initial miner
      const initial: MinerState = {
        coins: 0,
        coins_per_second: 1,
        mine_level: 1,
        pickaxe_level: 1,
        worker_count: 0,
        total_coins_earned: 0,
        last_collected_at: new Date().toISOString(),
      };
      await supabase.from('miner_progress').insert({ user_id: user.id });
      setMiner(initial);
      setDisplayCoins(0);
    }
  }

  async function loadLeaderboard() {
    const { data } = await supabase
      .from('miner_leaderboard')
      .select('user_id, total_coins_earned, mine_level')
      .order('total_coins_earned', { ascending: false })
      .limit(20);
    if (!data) return;

    const userIds = data.map(d => d.user_id);
    const { data: users } = await supabase.from('users').select('id, first_name, username').in('id', userIds);
    const uMap: Record<string, any> = {};
    (users || []).forEach(u => { uMap[u.id] = u; });

    setLeaderboard(data.map(d => ({
      ...d,
      first_name: uMap[d.user_id]?.first_name || 'Miner',
      username: uMap[d.user_id]?.username || '',
    })));
  }

  // Tick: add coins per second
  useEffect(() => {
    if (!miner) return;
    tickRef.current = setInterval(() => {
      const mult = boostEnd > Date.now() ? boostMultiplier : 1;
      const earned = miner.coins_per_second * mult / 10; // tick 10x/sec
      setMiner(prev => prev ? {
        ...prev,
        coins: prev.coins + earned,
        total_coins_earned: prev.total_coins_earned + earned,
      } : prev);
      setDisplayCoins(prev => prev + earned);
    }, 100);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [miner?.coins_per_second, boostMultiplier, boostEnd]);

  // Auto-save every 30s
  useEffect(() => {
    if (!user || !miner) return;
    const saveInterval = setInterval(() => saveMiner(), 30000);
    return () => clearInterval(saveInterval);
  }, [user, miner]);

  // Save on unmount
  useEffect(() => {
    return () => { saveMiner(); };
  }, []);

  async function saveMiner() {
    if (!user || !miner) return;
    await supabase.from('miner_progress').update({
      coins: miner.coins,
      coins_per_second: miner.coins_per_second,
      mine_level: miner.mine_level,
      pickaxe_level: miner.pickaxe_level,
      worker_count: miner.worker_count,
      total_coins_earned: miner.total_coins_earned,
      last_collected_at: new Date().toISOString(),
    }).eq('user_id', user.id);

    // Update leaderboard
    const { data: existing } = await supabase
      .from('miner_leaderboard')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase.from('miner_leaderboard').update({
        total_coins_earned: miner.total_coins_earned,
        mine_level: miner.mine_level,
      }).eq('id', existing.id);
    } else {
      await supabase.from('miner_leaderboard').insert({
        user_id: user.id,
        total_coins_earned: miner.total_coins_earned,
        mine_level: miner.mine_level,
      });
    }
  }

  function handleTap(e: React.MouseEvent | React.TouchEvent) {
    if (!miner) return;
    triggerHaptic('impact');

    const tapBonus = miner.coins_per_second * 0.5;
    setMiner(prev => prev ? {
      ...prev,
      coins: prev.coins + tapBonus,
      total_coins_earned: prev.total_coins_earned + tapBonus,
    } : prev);

    // Particle effect
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const id = particleId.current++;
    setTapParticles(prev => [...prev.slice(-5), { id, x, y }]);
    setTimeout(() => setTapParticles(prev => prev.filter(p => p.id !== id)), 800);
  }

  function upgrade(type: 'pickaxe' | 'worker' | 'mine') {
    if (!miner) return;
    const level = type === 'pickaxe' ? miner.pickaxe_level : type === 'worker' ? miner.worker_count : miner.mine_level;
    const cost = getUpgradeCost(type, level);
    if (miner.coins < cost) return;

    triggerHaptic('success');
    const bonus = UPGRADES[type].cpsBonus;

    setMiner(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        coins: prev.coins - cost,
        coins_per_second: prev.coins_per_second + bonus,
      };
      if (type === 'pickaxe') updated.pickaxe_level = prev.pickaxe_level + 1;
      if (type === 'worker') updated.worker_count = prev.worker_count + 1;
      if (type === 'mine') updated.mine_level = prev.mine_level + 1;
      return updated;
    });
  }

  async function collectToBalance() {
    if (!user || !miner || miner.coins < 100) return;
    triggerHaptic('success');
    const pts = Math.floor(miner.coins / 10); // 10 coins = 1 point
    setMiner(prev => prev ? { ...prev, coins: 0 } : prev);
    setDisplayCoins(0);

    const { data: bal } = await supabase.from('balances').select('points, total_earned').eq('user_id', user.id).single();
    if (bal) {
      await supabase.from('balances').update({
        points: bal.points + pts,
        total_earned: bal.total_earned + pts,
      }).eq('user_id', user.id);
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'miner_collect',
        points: pts,
        description: `⛏️ Miner: Collected ${pts} pts`,
      });
    }
    await refreshBalance();
    await saveMiner();
    setShowBoost(`+${pts} points collected!`);
    setTimeout(() => setShowBoost(''), 3000);
  }

  if (!miner) {
    return (
      <div className="px-4 pb-28 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3 animate-float">⛏️</div>
          <div style={{ color: 'hsl(var(--muted-foreground))' }}>Loading mine...</div>
        </div>
      </div>
    );
  }

  if (showLB) {
    return (
      <div className="px-4 pb-28">
        <button onClick={() => setShowLB(false)} className="mb-4 text-sm" style={{ color: 'hsl(var(--gold))' }}>
          ← Back
        </button>
        <h2 className="text-xl font-bold mb-4 shimmer-text">⛏️ Miner Leaderboard</h2>
        <div className="space-y-2">
          {leaderboard.map((entry, i) => (
            <div key={entry.user_id} className="glass-card rounded-xl p-3 flex items-center gap-3">
              <div className="text-lg font-bold w-8 text-center" style={{ color: i < 3 ? 'hsl(var(--gold))' : 'hsl(var(--muted-foreground))' }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{entry.first_name}</div>
                <div className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Mine Lvl {entry.mine_level}</div>
              </div>
              <div className="font-bold text-sm" style={{ color: 'hsl(var(--gold))' }}>
                {formatNum(entry.total_coins_earned)}
              </div>
            </div>
          ))}
          {leaderboard.length === 0 && (
            <div className="text-center py-8" style={{ color: 'hsl(var(--muted-foreground))' }}>No miners yet</div>
          )}
        </div>
      </div>
    );
  }

  const boostActive = boostEnd > Date.now();
  const currentCPS = miner.coins_per_second * (boostActive ? boostMultiplier : 1);

  return (
    <div className="px-4 pb-28">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Mine Level</div>
          <div className="text-xl font-bold" style={{ color: 'hsl(var(--gold))' }}>{miner.mine_level}</div>
        </div>
        <div className="text-center">
          <div className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Coins/sec</div>
          <div className="text-lg font-bold" style={{ color: boostActive ? 'hsl(var(--cyan))' : 'hsl(var(--foreground))' }}>
            {formatNum(currentCPS)}/s
          </div>
        </div>
        <button onClick={() => setShowLB(true)} className="text-2xl">🏆</button>
      </div>

      {/* Boost message */}
      {showBoost && (
        <div className="glass-card rounded-xl p-3 mb-4 text-center text-sm font-bold animate-pulse" style={{ color: 'hsl(var(--gold))', border: '1px solid hsl(var(--gold) / 0.4)' }}>
          {showBoost}
        </div>
      )}

      {/* Coin display + Tap area */}
      <div
        className="glass-card rounded-3xl p-8 mb-4 text-center relative overflow-hidden cursor-pointer select-none active:scale-95 transition-transform"
        onClick={handleTap}
        style={{ border: '1px solid hsl(var(--gold) / 0.3)' }}
      >
        {tapParticles.map(p => (
          <div
            key={p.id}
            className="absolute text-sm font-bold pointer-events-none"
            style={{
              left: p.x,
              top: p.y,
              color: 'hsl(var(--gold))',
              animation: 'float 0.8s ease-out forwards',
              opacity: 0.8,
            }}
          >
            +{formatNum(miner.coins_per_second * 0.5)}
          </div>
        ))}
        <div className="text-6xl mb-3">⛏️</div>
        <div className="text-4xl font-black" style={{ color: 'hsl(var(--gold))' }}>
          {formatNum(miner.coins)}
        </div>
        <div className="text-xs mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Tap to mine • Auto-earning {formatNum(currentCPS)}/s
        </div>
      </div>

      {/* Collect button */}
      {miner.coins >= 100 && (
        <button onClick={collectToBalance} className="w-full btn-gold rounded-2xl py-3 text-sm font-bold mb-4">
          💰 Collect {Math.floor(miner.coins / 10)} Points
        </button>
      )}

      {/* Upgrades */}
      <h3 className="text-sm font-bold mb-3 uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>
        Upgrades
      </h3>
      <div className="space-y-3 mb-6">
        {(['pickaxe', 'worker', 'mine'] as const).map(type => {
          const level = type === 'pickaxe' ? miner.pickaxe_level : type === 'worker' ? miner.worker_count : miner.mine_level;
          const cost = getUpgradeCost(type, level);
          const canAfford = miner.coins >= cost;
          const u = UPGRADES[type];
          return (
            <button
              key={type}
              onClick={() => upgrade(type)}
              disabled={!canAfford}
              className="w-full glass-card rounded-xl p-4 flex items-center gap-3 transition-all active:scale-[0.97]"
              style={{
                opacity: canAfford ? 1 : 0.5,
                border: canAfford ? '1px solid hsl(var(--gold) / 0.3)' : '1px solid hsl(var(--glass-border) / 0.3)',
              }}
            >
              <div className="text-3xl">{u.icon}</div>
              <div className="flex-1 text-left">
                <div className="font-bold text-sm">{u.name} (Lvl {level})</div>
                <div className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  +{u.cpsBonus} coins/sec
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-sm" style={{ color: canAfford ? 'hsl(var(--gold))' : 'hsl(var(--muted-foreground))' }}>
                  {formatNum(cost)}
                </div>
                <div className="text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>coins</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Ad Boosts */}
      <h3 className="text-sm font-bold mb-3 uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>
        Boosts
      </h3>
      <div className="grid grid-cols-3 gap-3">
        <button onClick={() => show2xAd()} className="glass-card rounded-xl p-3 text-center neon-border-gold">
          <div className="text-2xl mb-1">⚡</div>
          <div className="text-[10px] font-bold">2x Income</div>
          <div className="text-[9px]" style={{ color: 'hsl(var(--muted-foreground))' }}>5 min</div>
        </button>
        <button onClick={() => showInstantAd()} className="glass-card rounded-xl p-3 text-center neon-border-purple">
          <div className="text-2xl mb-1">💎</div>
          <div className="text-[10px] font-bold">1hr Income</div>
          <div className="text-[9px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Instant</div>
        </button>
        <button onClick={() => showSpeedAd()} className="glass-card rounded-xl p-3 text-center" style={{ border: '1px solid hsl(var(--cyan) / 0.5)' }}>
          <div className="text-2xl mb-1">🚀</div>
          <div className="text-[10px] font-bold">3x Speed</div>
          <div className="text-[9px]" style={{ color: 'hsl(var(--muted-foreground))' }}>2 min</div>
        </button>
      </div>
    </div>
  );
}
