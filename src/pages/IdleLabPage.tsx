import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useRewardedAd } from '@/hooks/useAdsgram';
import { supabase } from '@/integrations/supabase/client';
import { logAdWatch } from '@/lib/api';

function triggerHaptic(type: 'success' | 'error' | 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.HapticFeedback) {
    const hf = (window as any).Telegram.WebApp.HapticFeedback;
    if (type === 'impact') hf.impactOccurred('medium');
    else hf.notificationOccurred(type);
  }
}

interface Machine {
  key: string;
  name: string;
  icon: string;
  baseCps: number;
  costMultiplier: number;
  unlockLevel: number;
  color: string;
}

const MACHINES: Machine[] = [
  { key: 'generator', name: 'Generator', icon: '⚡', baseCps: 0.001, costMultiplier: 1, unlockLevel: 1, color: 'var(--gold)' },
  { key: 'booster', name: 'Booster', icon: '🔋', baseCps: 0.005, costMultiplier: 3, unlockLevel: 3, color: 'var(--cyan)' },
  { key: 'accelerator', name: 'Accelerator', icon: '🧪', baseCps: 0.025, costMultiplier: 8, unlockLevel: 5, color: 'var(--purple)' },
  { key: 'quantum', name: 'Quantum Lab', icon: '🔬', baseCps: 0.1, costMultiplier: 20, unlockLevel: 8, color: 'var(--green-reward)' },
];

function getUpgradeCost(machine: Machine, level: number): number {
  return Math.floor(50 * machine.costMultiplier * Math.pow(1.4, level));
}

function getCps(machines: Record<string, number>): number {
  return MACHINES.reduce((sum, m) => {
    const lvl = machines[m.key] || 0;
    return sum + m.baseCps * lvl;
  }, 0);
}

function getOverallLevel(machines: Record<string, number>): number {
  return Object.values(machines).reduce((s, v) => s + v, 0);
}

export default function IdleLabPage() {
  const { user, refreshBalance } = useApp();
  const [coins, setCoins] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [machines, setMachines] = useState<Record<string, number>>({ generator: 1, booster: 0, accelerator: 0, quantum: 0 });
  const [loaded, setLoaded] = useState(false);
  const [boostEnd, setBoostEnd] = useState(0);
  const [boostMultiplier, setBoostMultiplier] = useState(1);
  const [showParticles, setShowParticles] = useState(false);

  const tickRef = useRef<ReturnType<typeof setInterval>>();
  const coinsRef = useRef(0);
  const totalRef = useRef(0);

  // Ad hooks
  const on5xReward = useCallback(() => {
    triggerHaptic('success');
    setBoostEnd(Date.now() + 180000); // 3 min
    setBoostMultiplier(5);
    if (user) logAdWatch(user.id, 'lab_5x', 0);
  }, [user]);

  const on1hReward = useCallback(() => {
    triggerHaptic('success');
    const cps = getCps(machines);
    const earned = cps * 3600;
    coinsRef.current += earned;
    totalRef.current += earned;
    setCoins(coinsRef.current);
    setTotalEarned(totalRef.current);
    setShowParticles(true);
    setTimeout(() => setShowParticles(false), 1500);
    if (user) logAdWatch(user.id, 'lab_1h', 0);
  }, [user, machines]);

  const onDiscountReward = useCallback(() => {
    triggerHaptic('success');
    // 20% discount handled via state flag
    setDiscountActive(true);
    setTimeout(() => setDiscountActive(false), 60000);
    if (user) logAdWatch(user.id, 'lab_discount', 0);
  }, [user]);

  const [discountActive, setDiscountActive] = useState(false);

  const { showAd: show5xAd } = useRewardedAd(on5xReward);
  const { showAd: show1hAd } = useRewardedAd(on1hReward);
  const { showAd: showDiscountAd } = useRewardedAd(onDiscountReward);

  // Load progress
  useEffect(() => {
    if (!user) return;
    loadProgress();
  }, [user]);

  async function loadProgress() {
    if (!user) return;
    const { data } = await supabase
      .from('lab_progress')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      const now = Date.now();
      const lastCollected = new Date(data.last_collected_at).getTime();
      const elapsed = Math.min((now - lastCollected) / 1000, 7200); // 2h cap
      const cps = Number(data.coins_per_second);
      const idleEarned = Math.floor(elapsed * cps);

      const newCoins = Number(data.coins) + idleEarned;
      const newTotal = Number(data.total_coins_earned) + idleEarned;

      setCoins(newCoins);
      setTotalEarned(newTotal);
      coinsRef.current = newCoins;
      totalRef.current = newTotal;
      setMachines({
        generator: data.generator_level,
        booster: data.booster_level,
        accelerator: data.accelerator_level,
        quantum: data.quantum_level,
      });

      if (idleEarned > 0) {
        setShowParticles(true);
        setTimeout(() => setShowParticles(false), 2000);
      }
    }
    setLoaded(true);
  }

  // Tick loop
  useEffect(() => {
    if (!loaded) return;
    const cps = getCps(machines);

    tickRef.current = setInterval(() => {
      const mult = boostEnd > Date.now() ? boostMultiplier : 1;
      const earned = (cps * mult) / 10;
      coinsRef.current += earned;
      totalRef.current += earned;
      setCoins(coinsRef.current);
      setTotalEarned(totalRef.current);
    }, 100);

    return () => clearInterval(tickRef.current);
  }, [loaded, machines, boostEnd, boostMultiplier]);

  // Auto-save every 10s
  useEffect(() => {
    if (!loaded || !user) return;
    const interval = setInterval(() => saveProgress(), 10000);
    return () => clearInterval(interval);
  }, [loaded, user, machines]);

  async function saveProgress() {
    if (!user) return;
    const cps = getCps(machines);
    const { data: existing } = await supabase.from('lab_progress').select('id').eq('user_id', user.id).maybeSingle();

    const payload = {
      coins: Math.floor(coinsRef.current),
      coins_per_second: cps,
      generator_level: machines.generator,
      booster_level: machines.booster,
      accelerator_level: machines.accelerator,
      quantum_level: machines.quantum,
      total_coins_earned: Math.floor(totalRef.current),
      last_collected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase.from('lab_progress').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('lab_progress').insert({ user_id: user.id, ...payload });
    }

    // Update lab leaderboard
    const highestMachine = machines.quantum > 0 ? 'Quantum Lab' : machines.accelerator > 0 ? 'Accelerator' : machines.booster > 0 ? 'Booster' : 'Generator';
    const { data: lb } = await supabase.from('lab_leaderboard').select('id').eq('user_id', user.id).maybeSingle();
    if (lb) {
      await supabase.from('lab_leaderboard').update({ total_coins_earned: Math.floor(totalRef.current), highest_machine: highestMachine, updated_at: new Date().toISOString() }).eq('id', lb.id);
    } else {
      await supabase.from('lab_leaderboard').insert({ user_id: user.id, total_coins_earned: Math.floor(totalRef.current), highest_machine: highestMachine });
    }
  }

  function upgrade(machineKey: string) {
    const machine = MACHINES.find(m => m.key === machineKey)!;
    const level = machines[machineKey] || 0;
    let cost = getUpgradeCost(machine, level);
    if (discountActive) cost = Math.floor(cost * 0.8);

    if (coinsRef.current < cost) return;
    triggerHaptic('success');

    coinsRef.current -= cost;
    setCoins(coinsRef.current);
    setMachines(prev => ({ ...prev, [machineKey]: (prev[machineKey] || 0) + 1 }));
  }

  async function collectToBalance() {
    if (!user || coins < 1) return;
    const pointsToAdd = Math.floor(coins); // 1 lab coin = 1 point
    triggerHaptic('success');

    const { data: bal } = await supabase.from('balances').select('points, total_earned').eq('user_id', user.id).single();
    if (bal) {
      await supabase.from('balances').update({
        points: bal.points + pointsToAdd,
        total_earned: bal.total_earned + pointsToAdd,
      }).eq('user_id', user.id);
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'lab_collect',
        points: pointsToAdd,
        description: `🔬 Lab: Collected ${Math.floor(coins)} coins → ${pointsToAdd} pts`,
      });
    }

    coinsRef.current = 0;
    setCoins(0);
    await saveProgress();
    await refreshBalance();
  }

  const cps = getCps(machines);
  const overallLevel = getOverallLevel(machines);
  const isBoosted = boostEnd > Date.now();

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-2xl animate-pulse">🔬</div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-28">
      {/* Header */}
      <div className="text-center mb-4">
        <div className="text-5xl mb-2 animate-float">🔬</div>
        <h2 className="text-2xl font-bold shimmer-text">Upgrade Lab</h2>
        <p className="text-xs mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>Build machines, earn passive income</p>
      </div>

      {/* Coins display */}
      <div className="glass-card rounded-2xl p-5 mb-4 relative overflow-hidden">
        {showParticles && (
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="star-particle" style={{ left: `${10 + Math.random() * 80}%`, top: `${Math.random() * 30}%`, animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
        )}
        <div className="text-center">
          <div className="text-4xl font-black mb-1" style={{ color: 'hsl(var(--gold))' }}>{coins.toFixed(3)}</div>
          <div className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Lab Coins</div>
          <div className="text-sm font-semibold mt-1" style={{ color: isBoosted ? 'hsl(var(--purple))' : 'hsl(var(--green-reward))' }}>
            ⚡ {(cps * (isBoosted ? boostMultiplier : 1)).toFixed(3)}/sec {isBoosted && `(${boostMultiplier}x boost!)`}
          </div>
        </div>

        {/* CPS bar animation */}
        <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(var(--muted))' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, (cps / 2) * 100)}%`,
              background: 'linear-gradient(90deg, hsl(var(--gold)), hsl(var(--green-reward)))',
              animation: 'pulse-gold 2s ease-in-out infinite',
            }}
          />
        </div>
      </div>

      {/* Collect button */}
      <button
        onClick={collectToBalance}
        disabled={coins < 1}
        className="w-full btn-gold rounded-2xl py-3 text-sm font-bold mb-4 disabled:opacity-40"
      >
        💰 Collect → {Math.floor(coins).toLocaleString()} Points
      </button>

      {/* Machines */}
      <div className="space-y-3 mb-4">
        {MACHINES.map(machine => {
          const level = machines[machine.key] || 0;
          const unlocked = overallLevel >= machine.unlockLevel || level > 0;
          let cost = getUpgradeCost(machine, level);
          if (discountActive) cost = Math.floor(cost * 0.8);
          const canAfford = coins >= cost;
          const contribution = machine.baseCps * level;

          if (!unlocked) {
            return (
              <div key={machine.key} className="glass-card rounded-2xl p-4 opacity-40">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">🔒</div>
                  <div className="flex-1">
                    <div className="font-bold text-sm">{machine.name}</div>
                    <div className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      Unlock at total level {machine.unlockLevel}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={machine.key} className="glass-card rounded-2xl p-4" style={{ border: `1px solid hsl(${machine.color} / 0.3)` }}>
              <div className="flex items-center gap-3">
                <div className="text-3xl">{machine.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{machine.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `hsl(${machine.color} / 0.2)`, color: `hsl(${machine.color})` }}>
                      Lv.{level}
                    </span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    +{contribution.toFixed(3)}/sec • Next: +{machine.baseCps}/sec
                  </div>
                  {/* Mini progress bar */}
                  <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: 'hsl(var(--muted))' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (coins / cost) * 100)}%`, background: `hsl(${machine.color})` }} />
                  </div>
                </div>
                <button
                  onClick={() => upgrade(machine.key)}
                  disabled={!canAfford}
                  className="px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40"
                  style={{
                    background: canAfford ? `linear-gradient(135deg, hsl(${machine.color}), hsl(${machine.color} / 0.7))` : 'hsl(var(--muted))',
                    color: canAfford ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                  }}
                >
                  {discountActive && <span className="text-[9px]">-20% </span>}
                  {cost.toLocaleString()}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ad Boosts */}
      <h3 className="text-sm font-bold mb-2" style={{ color: 'hsl(var(--gold))' }}>⚡ Power Boosts</h3>
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => show5xAd()} className="glass-card rounded-xl p-3 text-center neon-border-purple">
          <div className="text-xl mb-1">🚀</div>
          <div className="text-[10px] font-bold">5x Income</div>
          <div className="text-[9px]" style={{ color: 'hsl(var(--muted-foreground))' }}>3 min</div>
        </button>
        <button onClick={() => show1hAd()} className="glass-card rounded-xl p-3 text-center neon-border-gold">
          <div className="text-xl mb-1">💎</div>
          <div className="text-[10px] font-bold">1h Income</div>
          <div className="text-[9px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Instant</div>
        </button>
        <button onClick={() => showDiscountAd()} className="glass-card rounded-xl p-3 text-center neon-border-gold">
          <div className="text-xl mb-1">🏷️</div>
          <div className="text-[10px] font-bold">-20% Cost</div>
          <div className="text-[9px]" style={{ color: 'hsl(var(--muted-foreground))' }}>1 min</div>
        </button>
      </div>
    </div>
  );
}
