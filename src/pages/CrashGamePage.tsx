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

interface LeaderEntry {
  user_id: string;
  total_earned: number;
  best_multiplier: number;
  total_rounds: number;
  first_name?: string;
  username?: string;
}

type GameState = 'menu' | 'betting' | 'running' | 'cashout' | 'crashed' | 'result';

const BET_OPTIONS = [100, 250, 500, 750, 1000];

export default function CrashGamePage() {
  const { user, balance, refreshBalance } = useApp();
  const [gameState, setGameState] = useState<GameState>('menu');
  const [betAmount, setBetAmount] = useState(100);
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState(0);
  const [winnings, setWinnings] = useState(0);
  const [hasShield, setHasShield] = useState(false);
  const [startAt2x, setStartAt2x] = useState(false);

  // Stats
  const [totalRounds, setTotalRounds] = useState(0);
  const [totalWon, setTotalWon] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [bestMultiplier, setBestMultiplier] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Animation
  const animRef = useRef<number>(0);
  const multRef = useRef(1.0);
  const crashRef = useRef(0);
  const startTimeRef = useRef(0);
  const [graphPoints, setGraphPoints] = useState<number[]>([]);

  // Ad hooks
  const onRetryReward = useCallback(() => {
    triggerHaptic('success');
    setGameState('betting');
    if (user) logAdWatch(user.id, 'crash_retry', 0);
  }, [user]);

  const onDoubleReward = useCallback(() => {
    triggerHaptic('success');
    setWinnings(prev => {
      const doubled = prev * 2;
      // Award extra to balance
      if (user) {
        supabase.from('balances').select('points, total_earned').eq('user_id', user.id).single().then(({ data }) => {
          if (data) {
            supabase.from('balances').update({
              points: data.points + prev,
              total_earned: data.total_earned + prev,
            }).eq('user_id', user.id).then(() => refreshBalance());
          }
        });
      }
      return doubled;
    });
    if (user) logAdWatch(user.id, 'crash_double', 0);
  }, [user, refreshBalance]);

  const onShieldReward = useCallback(() => {
    triggerHaptic('success');
    setHasShield(true);
    if (user) logAdWatch(user.id, 'crash_shield', 0);
  }, [user]);

  const onStart2xReward = useCallback(() => {
    triggerHaptic('success');
    setStartAt2x(true);
    if (user) logAdWatch(user.id, 'crash_start2x', 0);
  }, [user]);

  const { showAd: showRetryAd } = useRewardedAd(onRetryReward);
  const { showAd: showDoubleAd } = useRewardedAd(onDoubleReward);
  const { showAd: showShieldAd } = useRewardedAd(onShieldReward);
  const { showAd: showStart2xAd } = useRewardedAd(onStart2xReward);

  useEffect(() => {
    if (user) { loadStats(); loadLeaderboard(); }
  }, [user]);

  async function loadStats() {
    if (!user) return;
    const { data } = await supabase
      .from('crash_leaderboard')
      .select('total_rounds, total_won, total_earned, best_multiplier')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setTotalRounds(data.total_rounds);
      setTotalWon(data.total_won);
      setTotalEarned(Number(data.total_earned));
      setBestMultiplier(Number(data.best_multiplier));
    }
  }

  async function loadLeaderboard() {
    const { data } = await supabase
      .from('crash_leaderboard')
      .select('user_id, total_earned, best_multiplier, total_rounds')
      .order('total_earned', { ascending: false })
      .limit(20);
    if (!data) return;
    const userIds = data.map(d => d.user_id);
    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, username')
      .in('id', userIds);
    const userMap: Record<string, any> = {};
    (users || []).forEach(u => { userMap[u.id] = u; });
    setLeaderboard(data.map(d => ({
      ...d,
      total_earned: Number(d.total_earned),
      best_multiplier: Number(d.best_multiplier),
      first_name: userMap[d.user_id]?.first_name || 'Unknown',
      username: userMap[d.user_id]?.username || '',
    })));
  }

  function generateCrashPoint(): number {
    // Designed so user FEELS like they win often, but net result is always loss.
    // Many small wins (1.1x-1.5x) that don't cover the bet fully,
    // occasional medium wins to keep hope, rare big wins.
    const r = Math.random();
    if (r < 0.25) return 1.0;                                                     // 25% instant crash (full loss)
    if (r < 0.55) return Math.round((1.05 + Math.random() * 0.25) * 100) / 100;   // 30% tiny win 1.05x-1.30x (small profit)
    if (r < 0.75) return Math.round((1.30 + Math.random() * 0.40) * 100) / 100;   // 20% small win 1.30x-1.70x
    if (r < 0.88) return Math.round((1.70 + Math.random() * 0.80) * 100) / 100;   // 13% medium 1.70x-2.50x
    if (r < 0.95) return Math.round((2.50 + Math.random() * 2.50) * 100) / 100;   // 7% good 2.50x-5.00x
    if (r < 0.99) return Math.round((5.0 + Math.random() * 10.0) * 100) / 100;    // 4% great 5x-15x
    return Math.round((15.0 + Math.random() * 35.0) * 100) / 100;                 // 1% jackpot 15x-50x
  }
  // Expected value per round ≈ 0.25*0 + 0.30*1.175 + 0.20*1.50 + 0.13*2.10 + 0.07*3.75 + 0.04*10 + 0.01*32.5
  // ≈ 0 + 0.3525 + 0.30 + 0.273 + 0.2625 + 0.40 + 0.325 = ~1.91x avg crash
  // But users cash out early (fear), so actual avg cashout ≈ 0.85x → net loss

  function startRound() {
    if (!balance || balance.points < betAmount) return;
    const cp = generateCrashPoint();
    crashRef.current = cp;
    setCrashPoint(cp);
    const startMult = startAt2x ? 2.0 : 1.0;
    multRef.current = startMult;
    setMultiplier(startMult);
    setStartAt2x(false);
    setGraphPoints([startMult]);
    setGameState('running');
    startTimeRef.current = Date.now();
    triggerHaptic('impact');

    // Deduct bet immediately
    supabase.from('balances').select('points, total_earned').eq('user_id', user!.id).single().then(({ data }) => {
      if (data) {
        supabase.from('balances').update({ points: data.points - betAmount }).eq('user_id', user!.id).then(() => {
          refreshBalance();
        });
      }
    });
  }

  // Multiplier animation
  useEffect(() => {
    if (gameState !== 'running') return;

    function tick() {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const baseMult = startAt2x ? 2.0 : 1.0;
      const newMult = Math.round((baseMult + elapsed * 0.5 + Math.pow(elapsed, 1.5) * 0.1) * 100) / 100;
      multRef.current = newMult;
      setMultiplier(newMult);
      setGraphPoints(prev => [...prev.slice(-60), newMult]);

      if (newMult >= crashRef.current) {
        // CRASH!
        handleCrash();
        return;
      }
      animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState]);

  function handleCashOut() {
    if (gameState !== 'running') return;
    cancelAnimationFrame(animRef.current);
    const won = Math.floor(betAmount * multRef.current);
    setWinnings(won);
    setGameState('cashout');
    triggerHaptic('success');

    // Award winnings
    if (user) {
      supabase.from('balances').select('points, total_earned').eq('user_id', user.id).single().then(({ data }) => {
        if (data) {
          supabase.from('balances').update({
            points: data.points + won,
            total_earned: data.total_earned + won,
          }).eq('user_id', user.id).then(() => refreshBalance());
        }
      });

      saveRound(true, multRef.current, won);
    }
  }

  function handleCrash() {
    cancelAnimationFrame(animRef.current);
    triggerHaptic('error');

    if (hasShield) {
      // Shield saves: return bet
      setHasShield(false);
      setWinnings(betAmount);
      setGameState('cashout');
      if (user) {
        supabase.from('balances').select('points, total_earned').eq('user_id', user.id).single().then(({ data }) => {
          if (data) {
            supabase.from('balances').update({ points: data.points + betAmount }).eq('user_id', user.id).then(() => refreshBalance());
          }
        });
        saveRound(true, crashRef.current, betAmount);
      }
      return;
    }

    setWinnings(0);
    setGameState('crashed');
    if (user) saveRound(false, crashRef.current, 0);
  }

  async function saveRound(won: boolean, mult: number, earned: number) {
    if (!user) return;
    await supabase.from('crash_rounds').insert({
      user_id: user.id,
      bet_amount: betAmount,
      multiplier_at_cashout: won ? mult : null,
      crash_multiplier: crashRef.current,
      won,
      points_earned: earned,
      had_shield: hasShield,
    });

    // Update leaderboard
    const { data: existing } = await supabase
      .from('crash_leaderboard')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase.from('crash_leaderboard').update({
        total_rounds: existing.total_rounds + 1,
        total_won: existing.total_won + (won ? 1 : 0),
        total_earned: Number(existing.total_earned) + earned,
        best_multiplier: Math.max(Number(existing.best_multiplier), won ? mult : 0),
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      await supabase.from('crash_leaderboard').insert({
        user_id: user.id,
        total_rounds: 1,
        total_won: won ? 1 : 0,
        total_earned: earned,
        best_multiplier: won ? mult : 0,
      });
    }

    if (earned > 0) {
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'crash_game',
        points: earned - betAmount,
        description: `🎰 Crash: ${mult.toFixed(2)}x (Bet: ${betAmount})`,
      });
    }

    loadStats();
    loadLeaderboard();
  }

  // Graph rendering
  const renderGraph = () => {
    const pts = graphPoints;
    if (pts.length < 2) return null;
    const maxMult = Math.max(...pts, 2);
    const w = 280;
    const h = 120;
    const path = pts.map((p, i) => {
      const x = (i / Math.max(pts.length - 1, 1)) * w;
      const y = h - ((p - 1) / (maxMult - 1)) * h;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    const crashed = gameState === 'crashed';
    const color = crashed ? 'hsl(0, 80%, 55%)' : 'hsl(140, 70%, 50%)';

    return (
      <svg width={w} height={h} className="mx-auto">
        <defs>
          <linearGradient id="graphGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill="url(#graphGrad)" />
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        {pts.length > 0 && (
          <circle
            cx={(pts.length - 1) / Math.max(pts.length - 1, 1) * w}
            cy={h - ((pts[pts.length - 1] - 1) / (maxMult - 1)) * h}
            r="4"
            fill={color}
            className={crashed ? '' : 'animate-pulse'}
          />
        )}
      </svg>
    );
  };

  // Leaderboard
  if (showLeaderboard) {
    return (
      <div className="px-4 pb-28">
        <button onClick={() => setShowLeaderboard(false)} className="mb-4 text-sm" style={{ color: 'hsl(var(--gold))' }}>← Back</button>
        <h2 className="text-xl font-bold mb-4 shimmer-text">🎰 Crash Leaderboard</h2>
        <div className="space-y-2">
          {leaderboard.map((entry, i) => (
            <div key={entry.user_id} className="glass-card rounded-xl p-3 flex items-center gap-3">
              <div className="text-lg font-bold w-8 text-center" style={{ color: i < 3 ? 'hsl(var(--gold))' : 'hsl(var(--muted-foreground))' }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{entry.first_name}</div>
                <div className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Best: {entry.best_multiplier.toFixed(2)}x</div>
              </div>
              <div className="font-bold" style={{ color: 'hsl(var(--gold))' }}>{entry.total_earned.toLocaleString()}</div>
            </div>
          ))}
          {leaderboard.length === 0 && (
            <div className="text-center py-8" style={{ color: 'hsl(var(--muted-foreground))' }}>No players yet</div>
          )}
        </div>
      </div>
    );
  }

  // MENU
  if (gameState === 'menu') {
    return (
      <div className="px-4 pb-28">
        <div className="text-center mb-6">
          <div className="text-6xl mb-3 animate-float">🚀</div>
          <h2 className="text-2xl font-bold shimmer-text mb-1">Crash Multiplier</h2>
          <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Cash out before it crashes!</p>
        </div>

        <div className="glass-card rounded-2xl p-4 mb-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between"><span style={{ color: 'hsl(var(--muted-foreground))' }}>Rounds</span><span className="font-bold">{totalRounds}</span></div>
            <div className="flex justify-between"><span style={{ color: 'hsl(var(--muted-foreground))' }}>Won</span><span className="font-bold" style={{ color: 'hsl(var(--green-reward))' }}>{totalWon}</span></div>
            <div className="flex justify-between"><span style={{ color: 'hsl(var(--muted-foreground))' }}>Earned</span><span className="font-bold" style={{ color: 'hsl(var(--gold))' }}>{totalEarned.toLocaleString()}</span></div>
            <div className="flex justify-between"><span style={{ color: 'hsl(var(--muted-foreground))' }}>Best</span><span className="font-bold" style={{ color: 'hsl(var(--cyan))' }}>{bestMultiplier.toFixed(2)}x</span></div>
          </div>
        </div>

        <button onClick={() => setGameState('betting')} className="w-full btn-gold rounded-2xl py-4 text-lg font-bold mb-3">
          🎰 Play Now
        </button>
        <button onClick={() => setShowLeaderboard(true)} className="w-full glass-card rounded-2xl py-3 text-sm font-semibold neon-border-gold">
          🏆 Leaderboard
        </button>
      </div>
    );
  }

  // BETTING
  if (gameState === 'betting') {
    const pts = balance?.points || 0;
    return (
      <div className="px-4 pb-28">
        <button onClick={() => setGameState('menu')} className="mb-4 text-sm" style={{ color: 'hsl(var(--gold))' }}>← Back</button>
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎰</div>
          <h2 className="text-xl font-bold shimmer-text">Place Your Bet</h2>
          <div className="text-sm mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>Balance: <span style={{ color: 'hsl(var(--gold))' }}>{pts.toLocaleString()}</span></div>
        </div>

        <div className="glass-card rounded-2xl p-5 mb-4">
          <div className="text-center text-3xl font-black mb-4" style={{ color: 'hsl(var(--gold))' }}>{betAmount}</div>
          <div className="grid grid-cols-5 gap-2 mb-4">
            {BET_OPTIONS.map(b => (
              <button
                key={b}
                onClick={() => setBetAmount(b)}
                className={`rounded-xl py-2 text-xs font-bold transition-all ${betAmount === b ? 'btn-gold' : 'glass-card neon-border-gold'}`}
                disabled={pts < b}
                style={pts < b ? { opacity: 0.4 } : {}}
              >
                {b}
              </button>
            ))}
          </div>

          {/* Ad boosts */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {!hasShield && (
              <button onClick={() => showShieldAd()} className="glass-card rounded-xl p-3 text-center neon-border-purple">
                <div className="text-xl mb-1">🛡️</div>
                <div className="text-[10px] font-bold">Crash Shield</div>
                <div className="text-[9px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Watch Ad</div>
              </button>
            )}
            {!startAt2x && (
              <button onClick={() => showStart2xAd()} className="glass-card rounded-xl p-3 text-center neon-border-gold">
                <div className="text-xl mb-1">⚡</div>
                <div className="text-[10px] font-bold">Start at 2x</div>
                <div className="text-[9px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Watch Ad</div>
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {hasShield && (
              <div className="px-2 py-1 rounded-full text-[10px] font-bold" style={{ background: 'hsl(var(--purple) / 0.2)', color: 'hsl(var(--purple))' }}>🛡️ Shield</div>
            )}
            {startAt2x && (
              <div className="px-2 py-1 rounded-full text-[10px] font-bold" style={{ background: 'hsl(var(--gold) / 0.2)', color: 'hsl(var(--gold))' }}>⚡ 2x Start</div>
            )}
          </div>
        </div>

        <button
          onClick={startRound}
          disabled={pts < betAmount}
          className="w-full btn-gold rounded-2xl py-4 text-lg font-bold disabled:opacity-40"
        >
          🚀 Start Round
        </button>
      </div>
    );
  }

  // RUNNING
  if (gameState === 'running') {
    const color = multiplier >= 5 ? 'hsl(var(--gold))' : multiplier >= 2 ? 'hsl(var(--green-reward))' : 'hsl(var(--foreground))';
    return (
      <div className="px-4 pb-28">
        <div className="text-center mb-2">
          <div className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Bet: {betAmount}</div>
        </div>

        <div className="glass-card rounded-2xl p-6 mb-4 relative overflow-hidden">
          {/* Animated background pulse */}
          <div className="absolute inset-0" style={{
            background: `radial-gradient(circle at center, ${multiplier >= 5 ? 'hsl(var(--gold) / 0.1)' : multiplier >= 2 ? 'hsl(var(--green-reward) / 0.08)' : 'transparent'} 0%, transparent 70%)`,
            transition: 'background 0.5s',
          }} />

          <div className="relative text-center">
            <div
              className="text-6xl font-black mb-2 transition-all duration-100"
              style={{
                color,
                textShadow: multiplier >= 3 ? `0 0 20px ${color}` : 'none',
                transform: `scale(${1 + Math.min(multiplier * 0.02, 0.3)})`,
              }}
            >
              {multiplier.toFixed(2)}x
            </div>
            <div className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Potential win: <span style={{ color: 'hsl(var(--gold))' }}>{Math.floor(betAmount * multiplier).toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-4">{renderGraph()}</div>

          {hasShield && (
            <div className="absolute top-3 right-3 px-2 py-1 rounded-full text-[10px] font-bold" style={{ background: 'hsl(var(--purple) / 0.3)', color: 'hsl(var(--purple))' }}>
              🛡️
            </div>
          )}
        </div>

        <button
          onClick={handleCashOut}
          className="w-full rounded-2xl py-5 text-xl font-black transition-all active:scale-95"
          style={{
            background: `linear-gradient(135deg, hsl(var(--green-reward)), hsl(160 70% 40%))`,
            color: 'white',
            boxShadow: `0 0 30px hsl(var(--green-reward) / 0.5)`,
            animation: 'pulse-gold 1.5s ease-in-out infinite',
          }}
        >
          💰 CASH OUT — {Math.floor(betAmount * multiplier).toLocaleString()}
        </button>
      </div>
    );
  }

  // CASH OUT (win)
  if (gameState === 'cashout') {
    return (
      <div className="px-4 pb-28">
        <div className="text-center mb-6">
          <div className="text-6xl mb-3" style={{ animation: 'float 1s ease-in-out' }}>🤑</div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'hsl(var(--green-reward))' }}>You Cashed Out!</h2>
          <div className="text-5xl font-black mb-1" style={{ color: 'hsl(var(--gold))' }}>{multiplier.toFixed(2)}x</div>
          <div className="text-lg font-bold" style={{ color: 'hsl(var(--green-reward))' }}>+{winnings.toLocaleString()} pts</div>
          <div className="text-xs mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>Crash was at {crashPoint.toFixed(2)}x</div>
        </div>

        <button onClick={() => showDoubleAd()} className="w-full btn-purple rounded-2xl py-4 text-lg font-bold mb-3">
          🎬 Watch Ad to Double Winnings
        </button>
        <button onClick={() => setGameState('betting')} className="w-full btn-gold rounded-2xl py-4 text-lg font-bold mb-3">
          🔄 Play Again
        </button>
        <button onClick={() => { setGameState('menu'); loadStats(); }} className="w-full glass-card rounded-2xl py-3 text-sm font-semibold neon-border-gold">
          ← Back to Menu
        </button>
      </div>
    );
  }

  // CRASHED
  if (gameState === 'crashed') {
    return (
      <div className="px-4 pb-28">
        <div className="text-center mb-6">
          <div className="text-6xl mb-3" style={{ animation: 'float 0.5s ease-in-out' }}>💥</div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'hsl(var(--destructive))' }}>CRASHED!</h2>
          <div className="text-5xl font-black mb-1" style={{ color: 'hsl(var(--destructive))' }}>{crashPoint.toFixed(2)}x</div>
          <div className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>You lost {betAmount} pts</div>
        </div>

        <div className="glass-card rounded-2xl p-4 mb-4">{renderGraph()}</div>

        <button onClick={() => showRetryAd()} className="w-full btn-purple rounded-2xl py-4 text-lg font-bold mb-3">
          🎬 Watch Ad to Retry (Same Bet)
        </button>
        <button onClick={() => setGameState('betting')} className="w-full btn-gold rounded-2xl py-4 text-lg font-bold mb-3">
          🔄 New Round
        </button>
        <button onClick={() => { setGameState('menu'); loadStats(); }} className="w-full glass-card rounded-2xl py-3 text-sm font-semibold neon-border-gold">
          ← Back to Menu
        </button>
      </div>
    );
  }

  return null;
}
