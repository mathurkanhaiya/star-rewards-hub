import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useRewardedAd } from '@/hooks/useAdsgram';
import { supabase } from '@/integrations/supabase/client';
import { logAdWatch } from '@/lib/api';
import { Progress } from '@/components/ui/progress';
import { showInterstitialAd } from '@/hooks/Adsgram';

function triggerHaptic(type: 'success' | 'error' | 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.HapticFeedback) {
    const hf = (window as any).Telegram.WebApp.HapticFeedback;
    if (type === 'impact') hf.impactOccurred('medium');
    else hf.notificationOccurred(type);
  }
}

interface LeaderEntry {
  user_id: string;
  best_floor: number;
  total_runs: number;
  username?: string;
  first_name?: string;
  photo_url?: string | null;
}

type GameState = 'menu' | 'playing' | 'gameover';

export default function TowerClimbPage() {
  const { user, balance, refreshBalance } = useApp();
  const [gameState, setGameState] = useState<GameState>('menu');
  const [floor, setFloor] = useState(0);
  const [score, setScore] = useState(0);
  const [bestFloor, setBestFloor] = useState(0);
  const [totalRuns, setTotalRuns] = useState(0);

  // Reaction game state
  const [targetZone, setTargetZone] = useState(50);
  const [cursorPos, setCursorPos] = useState(0);
  const [speed, setSpeed] = useState(2);
  const [direction, setDirection] = useState(1);
  const [hasShield, setHasShield] = useState(false);
  const [revivesUsed, setRevivesUsed] = useState(0);
  const [shieldsUsed, setShieldsUsed] = useState(0);
  const [showResult, setShowResult] = useState<'success' | 'fail' | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [multiplierFloors, setMultiplierFloors] = useState(0);

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const animRef = useRef<number>(0);
  const cursorRef = useRef(0);
  const dirRef = useRef(1);
  const speedRef = useRef(2);

  // Ad hooks
  const onReviveReward = useCallback(() => {
    triggerHaptic('success');
    setRevivesUsed(r => r + 1);
    setGameState('playing');
    setShowResult(null);
    if (user) logAdWatch(user.id, 'tower_revive', 0);
  }, [user]);

  const onShieldReward = useCallback(() => {
    triggerHaptic('success');
    setHasShield(true);
    setShieldsUsed(s => s + 1);
    if (user) logAdWatch(user.id, 'tower_shield', 0);
  }, [user]);
  
  const onStartReward = useCallback(() => {
  startGame(); // start only AFTER ad finishes
  if (user) logAdWatch(user.id, 'tower_start', 0);
}, [user, startGame]);

  const onMultiplierReward = useCallback(() => {
    triggerHaptic('success');
    setMultiplier(2);
    setMultiplierFloors(3);
    if (user) logAdWatch(user.id, 'tower_2x', 0);
  }, [user]);

  

  // Load best score
  useEffect(() => {
    if (!user) return;
    loadStats();
    loadLeaderboard();
  }, [user]);

  async function loadStats() {
    if (!user) return;
    const { data } = await supabase
      .from('tower_leaderboard')
      .select('best_floor, total_runs')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setBestFloor(data.best_floor);
      setTotalRuns(data.total_runs);
    }
  }

  async function loadLeaderboard() {
    const { data } = await supabase
      .from('tower_leaderboard')
      .select('user_id, best_floor, total_runs')
      .order('best_floor', { ascending: false })
      .limit(20);
    if (!data || data.length === 0) { setLeaderboard([]); return; }

    const userIds = data.map(d => d.user_id);
    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, username, photo_url')
      .in('id', userIds);

    const userMap: Record<string, any> = {};
    (users || []).forEach(u => { userMap[u.id] = u; });

    setLeaderboard(data.map(d => ({
      ...d,
      first_name: userMap[d.user_id]?.first_name || 'Unknown',
      username: userMap[d.user_id]?.username || '',
      photo_url: userMap[d.user_id]?.photo_url,
    })));
  }

  // Animation loop
  useEffect(() => {
    if (gameState !== 'playing') {
      cancelAnimationFrame(animRef.current);
      return;
    }

    function animate() {
      cursorRef.current += dirRef.current * speedRef.current;
      if (cursorRef.current >= 100) { cursorRef.current = 100; dirRef.current = -1; }
      if (cursorRef.current <= 0) { cursorRef.current = 0; dirRef.current = 1; }
      setCursorPos(cursorRef.current);
      animRef.current = requestAnimationFrame(animate);
    }
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState]);

  function startGame() {
    setFloor(0);
    setScore(0);
    setHasShield(false);
    setRevivesUsed(0);
    setShieldsUsed(0);
    setMultiplier(1);
    setMultiplierFloors(0);
    cursorRef.current = 0;
    dirRef.current = 1;
    speedRef.current = 2;
    setSpeed(2);
    setDirection(1);
    setCursorPos(0);
    setTargetZone(30 + Math.random() * 40);
    setGameState('playing');
    setShowResult(null);
    triggerHaptic('impact');
  }

  function handleTap() {
    if (gameState !== 'playing') return;
    triggerHaptic('impact');

    const zoneSize = Math.max(8, 25 - floor * 0.5);
    const zoneStart = targetZone - zoneSize / 2;
    const zoneEnd = targetZone + zoneSize / 2;

    if (cursorRef.current >= zoneStart && cursorRef.current <= zoneEnd) {
      // Success
      const pts = (10 + floor * 2) * multiplier;
      setScore(s => s + pts);
      setFloor(f => f + 1);
      setShowResult('success');
      setTimeout(() => setShowResult(null), 300);

      if (multiplierFloors > 0) {
        setMultiplierFloors(f => f - 1);
        if (multiplierFloors <= 1) setMultiplier(1);
      }

      // Increase difficulty
      const newSpeed = Math.min(6, 2 + (floor + 1) * 0.15);
      speedRef.current = newSpeed;
      setSpeed(newSpeed);
      setTargetZone(10 + Math.random() * 80);
      cursorRef.current = Math.random() * 100;
      triggerHaptic('success');
    } else {
      // Fail
      if (hasShield) {
        setHasShield(false);
        setShowResult('success');
        setTimeout(() => setShowResult(null), 300);
        setTargetZone(10 + Math.random() * 80);
        triggerHaptic('impact');
        return;
      }
      setShowResult('fail');
      triggerHaptic('error');
      endGame();
    }
  }

  async function endGame() {
    setGameState('gameover');
    cancelAnimationFrame(animRef.current);
    if (!user) return;

    // Save run
    await supabase.from('tower_runs').insert({
      user_id: user.id,
      floors_reached: floor,
      points_earned: score,
      revives_used: revivesUsed,
      shields_used: shieldsUsed,
    });

    // Update leaderboard
    const { data: existing } = await supabase
      .from('tower_leaderboard')
      .select('id, best_floor, total_runs, total_floors')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase.from('tower_leaderboard').update({
        best_floor: Math.max(existing.best_floor, floor),
        total_floors: existing.total_floors + floor,
        total_runs: existing.total_runs + 1,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      await supabase.from('tower_leaderboard').insert({
        user_id: user.id,
        best_floor: floor,
        total_floors: floor,
        total_runs: 1,
      });
    }

    // Award points to balance
    if (score > 0) {
      const { data: bal } = await supabase.from('balances').select('points, total_earned').eq('user_id', user.id).single();
      if (bal) {
        await supabase.from('balances').update({
          points: bal.points + score,
          total_earned: bal.total_earned + score,
        }).eq('user_id', user.id);
        await supabase.from('transactions').insert({
          user_id: user.id,
          type: 'tower_climb',
          points: score,
          description: `🏗️ Tower Climb: Floor ${floor}`,
        });
      }
      await refreshBalance();
    }

    setBestFloor(prev => Math.max(prev, floor));
    setTotalRuns(prev => prev + 1);
    loadLeaderboard();
  }

  const zoneSize = Math.max(8, 25 - floor * 0.5);

  // ---- MENU ----
  if (showLeaderboard) {
    return (
      <div className="px-4 pb-28">
        <button onClick={() => setShowLeaderboard(false)} className="mb-4 text-sm" style={{ color: 'hsl(var(--gold))' }}>
          ← Back
        </button>
        <h2 className="text-xl font-bold mb-4 shimmer-text">🏗️ Tower Leaderboard</h2>
        <div className="space-y-2">
          {leaderboard.map((entry, i) => (
            <div key={entry.user_id} className="glass-card rounded-xl p-3 flex items-center gap-3">
              <div className="text-lg font-bold w-8 text-center" style={{ color: i < 3 ? 'hsl(var(--gold))' : 'hsl(var(--muted-foreground))' }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{entry.first_name}</div>
                <div className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {entry.total_runs} runs
                </div>
              </div>
              <div className="font-bold" style={{ color: 'hsl(var(--gold))' }}>
                Floor {entry.best_floor}
              </div>
            </div>
          ))}
          {leaderboard.length === 0 && (
            <div className="text-center py-8" style={{ color: 'hsl(var(--muted-foreground))' }}>No players yet</div>
          )}
        </div>
      </div>
    );
  }

  if (gameState === 'menu') {
    return (
      <div className="px-4 pb-28">
        <div className="text-center mb-6">
          <div className="text-6xl mb-3 animate-float">🏗️</div>
          <h2 className="text-2xl font-bold shimmer-text mb-1">Tower Climb</h2>
          <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Tap at the right time to climb higher!
          </p>
        </div>

        <div className="glass-card rounded-2xl p-4 mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>Best Floor</span>
            <span className="font-bold" style={{ color: 'hsl(var(--gold))' }}>{bestFloor}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>Total Runs</span>
            <span className="font-bold">{totalRuns}</span>
          </div>
        </div>

       <button
  onClick={async () => {
    await showInterstitialAd(); // 👈 Interstitial
    startGame();                // 👈 Then start game
  }}
  className="w-full btn-gold rounded-2xl py-4 text-lg font-bold mb-3"
>
  🚀 Start Climbing
</button>

        <button onClick={() => setShowLeaderboard(true)} className="w-full glass-card rounded-2xl py-3 text-sm font-semibold neon-border-gold">
          🏆 Leaderboard
        </button>
      </div>
    );
  }

  // ---- GAME OVER ----
  if (gameState === 'gameover') {
    return (
      <div className="px-4 pb-28">
        <div className="text-center mb-6">
          <div className="text-6xl mb-3">💥</div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'hsl(var(--destructive))' }}>Game Over!</h2>
          <div className="text-4xl font-black mb-1" style={{ color: 'hsl(var(--gold))' }}>Floor {floor}</div>
          <div className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>+{score} points earned</div>
          {floor > bestFloor - 1 && floor > 0 && (
            <div className="text-sm font-bold mt-1" style={{ color: 'hsl(var(--green-reward))' }}>🎉 New Record!</div>
          )}
        </div>

        {/* Revive */}
        <button
  onClick={async () => {
    // 1️⃣ Show interstitial first
    await showInterstitialAd();

    // 2️⃣ Then show rewarded revive ad
    await showReviveAd();
  }}
  className="w-full btn-purple rounded-2xl py-4 text-lg font-bold mb-3"
>
  🎬 Watch Ad to Revive
</button>

        <button
  onClick={async () => {
    await showInterstitialAd();
    startGame();
  }}
>
  🔄 Play Again
</button>

        <button onClick={() => { setGameState('menu'); loadStats(); }} className="w-full glass-card rounded-2xl py-3 text-sm font-semibold neon-border-gold">
          ← Back to Menu
        </button>
      </div>
    );
  }

  // ---- PLAYING ----
  return (
    <div className="px-4 pb-28" onClick={handleTap}>
      {/* HUD */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Floor</div>
          <div className="text-3xl font-black" style={{ color: 'hsl(var(--gold))' }}>{floor}</div>
        </div>
        <div className="text-right">
          <div className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Score</div>
          <div className="text-xl font-bold">{score}</div>
        </div>
      </div>

      {/* Powerups */}
      <div className="flex gap-2 mb-4">
        {hasShield && (
          <div className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: 'hsl(var(--cyan) / 0.2)', color: 'hsl(var(--cyan))', border: '1px solid hsl(var(--cyan) / 0.4)' }}>
            🛡️ Shield Active
          </div>
        )}
        {multiplier > 1 && (
          <div className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: 'hsl(var(--gold) / 0.2)', color: 'hsl(var(--gold))', border: '1px solid hsl(var(--gold) / 0.4)' }}>
            ⚡ 2x ({multiplierFloors} floors)
          </div>
        )}
      </div>

      {/* Reaction Bar */}
      <div className="glass-card rounded-2xl p-6 mb-6 relative">
        <div className="text-center text-sm mb-4 font-semibold" style={{ color: 'hsl(var(--muted-foreground))' }}>
          TAP when the cursor is in the green zone!
        </div>

        <div className="relative h-12 rounded-full overflow-hidden mb-4" style={{ background: 'hsl(var(--muted))' }}>
          {/* Target zone */}
          <div
            className="absolute top-0 h-full rounded-full"
            style={{
              left: `${targetZone - zoneSize / 2}%`,
              width: `${zoneSize}%`,
              background: 'linear-gradient(135deg, hsl(var(--green-reward) / 0.6), hsl(var(--green-reward) / 0.3))',
              border: '2px solid hsl(var(--green-reward))',
            }}
          />

          {/* Cursor */}
          <div
            className="absolute top-0 h-full w-1 transition-none"
            style={{
              left: `${cursorPos}%`,
              background: showResult === 'success' ? 'hsl(var(--green-reward))' : showResult === 'fail' ? 'hsl(var(--destructive))' : 'hsl(var(--gold))',
              boxShadow: `0 0 10px ${showResult === 'fail' ? 'hsl(var(--destructive))' : 'hsl(var(--gold))'}`,
            }}
          />
        </div>

        {/* Difficulty */}
        <div className="flex justify-between text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
          <span>Speed: {speed.toFixed(1)}x</span>
          <span>Zone: {zoneSize.toFixed(0)}%</span>
        </div>
      </div>

      {/* Ad buttons */}
      <div className="grid grid-cols-2 gap-3">
        {!hasShield && (
          <button
            onClick={async (e) => { e.stopPropagation(); await showShieldAd(); }}
            className="glass-card rounded-xl p-3 text-center neon-border-purple"
          >
            <div className="text-2xl mb-1">🛡️</div>
            <div className="text-xs font-bold">Shield</div>
            <div className="text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Watch Ad</div>
          </button>
        )}
        {multiplier === 1 && (
          <button
            onClick={async (e) => { e.stopPropagation(); await showMultiplierAd(); }}
            className="glass-card rounded-xl p-3 text-center neon-border-gold"
          >
            <div className="text-2xl mb-1">⚡</div>
            <div className="text-xs font-bold">2x Points</div>
            <div className="text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>3 Floors</div>
          </button>
        )}
      </div>
    </div>
  );
}
