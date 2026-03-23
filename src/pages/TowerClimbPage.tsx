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
  best_floor: number;
  total_runs: number;
  username?: string;
  first_name?: string;
  photo_url?: string | null;
}

type GameState = 'menu' | 'playing' | 'gameover';

const MAX_DAILY_GAMES    = 5;
const MAX_SCORE_PER_GAME = 150;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@400;500;600;700&display=swap');

@keyframes tcBeam       { 0%,100%{opacity:0.3;transform:scaleY(0.8)} 50%{opacity:1;transform:scaleY(1)} }
@keyframes tcPulseBlock { 0%,100%{border-color:rgba(255,190,0,0.2)} 50%{border-color:rgba(255,190,0,0.6);box-shadow:0 0 8px rgba(255,190,0,0.2)} }
@keyframes tcPipPop     { from{transform:scale(0.5);opacity:0} to{transform:scale(1);opacity:1} }
@keyframes tcLimitPulse { 0%,100%{opacity:0.5} 50%{opacity:1} }

.tc-root { font-family:'Rajdhani',sans-serif; background:#06080f; min-height:100vh; padding:20px 16px 112px; position:relative; overflow:hidden; color:#fff; user-select:none; -webkit-user-select:none; }
.tc-bg { position:fixed; inset:0; pointer-events:none; z-index:0; overflow:hidden; }
.tc-beam { position:absolute; width:1px; background:linear-gradient(to bottom,transparent,rgba(255,190,0,0.15),transparent); animation:tcBeam 4s ease-in-out infinite; }
.tc-beam:nth-child(1){left:15%;height:60%;top:10%;animation-delay:0s}
.tc-beam:nth-child(2){left:40%;height:40%;top:30%;animation-delay:1.2s}
.tc-beam:nth-child(3){left:65%;height:70%;top:5%;animation-delay:0.6s}
.tc-beam:nth-child(4){left:85%;height:45%;top:20%;animation-delay:2s}
.tc-scanline { position:fixed; inset:0; background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.08) 3px,rgba(0,0,0,0.08) 4px); pointer-events:none; z-index:0; }
.tc-content  { position:relative; z-index:1; }

.tc-limit-wrap  { display:flex; flex-direction:column; align-items:center; gap:8px; margin-bottom:18px; }
.tc-limit-label { font-family:'Rajdhani',sans-serif; font-size:11px; letter-spacing:2px; color:rgba(255,255,255,0.25); text-transform:uppercase; display:flex; align-items:center; gap:6px; }
.tc-limit-label span { color:#ffbe00; font-weight:700; }
.tc-pips { display:flex; gap:7px; }
.tc-pip  { width:28px; height:8px; border-radius:4px; transition:background 0.3s,box-shadow 0.3s; animation:tcPipPop 0.3s ease both; }
.tc-pip.used  { background:#ffbe00; box-shadow:0 0 8px rgba(255,190,0,0.5); }
.tc-pip.avail { background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); }

.tc-maxed { background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.2); border-radius:16px; padding:16px; text-align:center; margin-bottom:16px; position:relative; overflow:hidden; }
.tc-maxed::before { content:''; position:absolute; top:0; left:10%; right:10%; height:1px; background:linear-gradient(90deg,transparent,rgba(239,68,68,0.35),transparent); }
.tc-maxed-icon  { font-size:36px; margin-bottom:8px; animation:tcLimitPulse 2s ease-in-out infinite; }
.tc-maxed-title { font-family:'Bebas Neue',sans-serif; font-size:22px; letter-spacing:2px; color:#ef4444; margin-bottom:4px; }
.tc-maxed-sub   { font-size:12px; color:rgba(255,255,255,0.3); letter-spacing:1px; }

.tc-tower-visual { display:flex; flex-direction:column; align-items:center; gap:3px; margin-bottom:20px; }
.tc-floor-block  { border-radius:4px; border:1px solid rgba(255,190,0,0.3); background:rgba(255,190,0,0.08); animation:tcPulseBlock 2s ease-in-out infinite; }
.tc-game-title   { font-family:'Bebas Neue',sans-serif; font-size:52px; letter-spacing:4px; line-height:1; color:#ffbe00; text-shadow:0 0 30px rgba(255,190,0,0.5),0 0 60px rgba(255,190,0,0.2); text-align:center; margin-bottom:4px; }
.tc-game-sub     { font-size:12px; letter-spacing:5px; color:rgba(255,255,255,0.3); text-transform:uppercase; text-align:center; margin-bottom:28px; }

.tc-stat-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:24px; }
.tc-stat     { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:14px; text-align:center; }
.tc-stat-val { font-family:'Bebas Neue',sans-serif; font-size:32px; color:#ffbe00; letter-spacing:1px; line-height:1; }
.tc-stat-label { font-size:10px; letter-spacing:2px; color:rgba(255,255,255,0.3); text-transform:uppercase; margin-top:2px; }

.tc-cap-banner { display:flex; align-items:center; justify-content:space-between; background:rgba(255,190,0,0.05); border:1px solid rgba(255,190,0,0.12); border-radius:12px; padding:8px 14px; margin-bottom:14px; }
.tc-cap-label  { font-family:'Rajdhani',sans-serif; font-size:11px; letter-spacing:1px; color:rgba(255,255,255,0.25); text-transform:uppercase; }
.tc-cap-val    { font-family:'Bebas Neue',sans-serif; font-size:16px; color:#ffbe00; letter-spacing:1px; }

.tc-btn-primary   { width:100%; padding:18px; border-radius:14px; border:none; background:linear-gradient(135deg,#ffbe00,#ff8c00); color:#000; font-family:'Bebas Neue',sans-serif; font-size:22px; letter-spacing:3px; cursor:pointer; transition:transform 0.1s,box-shadow 0.2s; box-shadow:0 4px 24px rgba(255,190,0,0.3); margin-bottom:10px; display:block; }
.tc-btn-primary:active   { transform:scale(0.97); }
.tc-btn-primary:disabled { opacity:0.4; cursor:not-allowed; }
.tc-btn-secondary { width:100%; padding:14px; border-radius:14px; border:1px solid rgba(255,190,0,0.3); background:rgba(255,190,0,0.06); color:#ffbe00; font-family:'Bebas Neue',sans-serif; font-size:18px; letter-spacing:2px; cursor:pointer; transition:transform 0.1s,background 0.2s; margin-bottom:10px; display:block; }
.tc-btn-secondary:active { transform:scale(0.97); }

.tc-remaining { display:inline-flex; align-items:center; gap:5px; padding:6px 14px; border-radius:20px; margin-bottom:12px; font-size:12px; letter-spacing:0.5px; }

.tc-hud       { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; }
.tc-hud-floor { font-family:'Bebas Neue',sans-serif; font-size:64px; color:#ffbe00; line-height:1; text-shadow:0 0 20px rgba(255,190,0,0.4); }
.tc-hud-label { font-size:10px; letter-spacing:3px; color:rgba(255,255,255,0.25); text-transform:uppercase; margin-bottom:2px; }
.tc-hud-score { font-family:'Bebas Neue',sans-serif; font-size:28px; color:#fff; text-align:right; }
.tc-hud-cap   { font-family:'Bebas Neue',sans-serif; font-size:12px; letter-spacing:1px; color:#ef4444; text-align:right; margin-top:2px; }

.tc-speed-bar-wrap { margin-bottom:16px; }
.tc-speed-track { height:3px; background:rgba(255,255,255,0.07); border-radius:99px; overflow:hidden; }
.tc-speed-fill  { height:100%; border-radius:99px; background:linear-gradient(90deg,#22d3ee,#ffbe00,#ef4444); transition:width 0.5s ease; }

.tc-reaction-wrap { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:20px; padding:24px 20px; margin-bottom:16px; position:relative; cursor:pointer; }
.tc-tap-hint { text-align:center; font-size:11px; letter-spacing:3px; color:rgba(255,255,255,0.25); text-transform:uppercase; margin-bottom:20px; }
.tc-bar-track { position:relative; height:44px; border-radius:10px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); overflow:hidden; margin-bottom:12px; }
.tc-zone   { position:absolute; top:0; height:100%; border-radius:8px; transition:left 0.15s ease; }
.tc-cursor { position:absolute; top:0; width:4px; height:100%; border-radius:2px; transform:translateX(-50%); }
.tc-bar-meta { display:flex; justify-content:space-between; font-size:11px; letter-spacing:2px; color:rgba(255,255,255,0.2); text-transform:uppercase; }

.tc-powerups { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; min-height:28px; }
.tc-badge    { display:flex; align-items:center; gap:5px; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700; letter-spacing:1px; }

.tc-multiplier-btn { width:100%; background:rgba(255,190,0,0.06); border:1px solid rgba(255,190,0,0.3); border-radius:14px; padding:12px; text-align:center; cursor:pointer; color:#fff; transition:transform 0.1s,background 0.15s; }
.tc-multiplier-btn:active { transform:scale(0.95); }
.tc-powerup-icon { font-size:22px; margin-bottom:4px; }
.tc-powerup-name { font-family:'Bebas Neue',sans-serif; font-size:15px; letter-spacing:1px; }
.tc-powerup-hint { font-size:10px; letter-spacing:1px; color:rgba(255,255,255,0.3); margin-top:1px; }

.tc-result-ring  { width:120px; height:120px; border-radius:50%; border:3px solid rgba(255,190,0,0.3); display:flex; align-items:center; justify-content:center; margin:0 auto 20px; box-shadow:0 0 40px rgba(255,190,0,0.15),inset 0 0 40px rgba(255,190,0,0.05); }
.tc-result-floor { font-family:'Bebas Neue',sans-serif; font-size:52px; color:#ffbe00; line-height:1; }
.tc-result-label { font-size:10px; letter-spacing:3px; color:rgba(255,255,255,0.3); text-align:center; text-transform:uppercase; margin-bottom:4px; }
.tc-result-pts   { font-family:'Bebas Neue',sans-serif; font-size:22px; color:#4ade80; text-align:center; margin-bottom:6px; letter-spacing:2px; }
.tc-result-record{ text-align:center; font-size:12px; letter-spacing:3px; color:#4ade80; margin-bottom:24px; text-transform:uppercase; }
.tc-divider      { height:1px; background:rgba(255,255,255,0.06); margin:16px 0; }

.tc-lb-header { display:flex; align-items:center; gap:12px; margin-bottom:20px; }
.tc-lb-back   { background:none; border:none; color:#ffbe00; font-family:'Bebas Neue',sans-serif; font-size:18px; letter-spacing:2px; cursor:pointer; padding:0; }
.tc-lb-title  { font-family:'Bebas Neue',sans-serif; font-size:28px; letter-spacing:3px; color:#fff; }
.tc-lb-row    { display:flex; align-items:center; gap:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:12px 14px; margin-bottom:8px; }
.tc-lb-rank   { font-family:'Bebas Neue',sans-serif; font-size:20px; width:32px; text-align:center; flex-shrink:0; }
.tc-lb-name   { flex:1; font-size:15px; font-weight:600; }
.tc-lb-sub    { font-size:11px; color:rgba(255,255,255,0.3); letter-spacing:1px; }
.tc-lb-floor  { font-family:'Bebas Neue',sans-serif; font-size:20px; color:#ffbe00; letter-spacing:1px; }

.tc-flash { position:fixed; inset:0; pointer-events:none; z-index:99; opacity:0; transition:opacity 0.05s; }
.tc-flash.success { background:rgba(74,222,128,0.12); }
.tc-flash.fail    { background:rgba(239,68,68,0.15); }
.tc-flash.show    { opacity:1; }
`;

export default function TowerClimbPage() {
  const { user, refreshBalance } = useApp();
  const [gameState, setGameState]       = useState<GameState>('menu');
  const [floor, setFloor]               = useState(0);
  const [score, setScore]               = useState(0);
  const [bestFloor, setBestFloor]       = useState(0);
  const [totalRuns, setTotalRuns]       = useState(0);
  const [targetZone, setTargetZone]     = useState(50);
  const [cursorPos, setCursorPos]       = useState(0);
  const [speed, setSpeed]               = useState(2.5);
  const [showResult, setShowResult]     = useState<'success'|'fail'|null>(null);
  const [multiplier, setMultiplier]     = useState(1);
  const [multiplierFloors, setMultiplierFloors] = useState(0);
  const [leaderboard, setLeaderboard]   = useState<LeaderEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const [gamesPlayedToday, setGamesPlayedToday] = useState(0);
  const [limitLoading, setLimitLoading]         = useState(true);
  const isMaxed   = gamesPlayedToday >= MAX_DAILY_GAMES;
  const remaining = MAX_DAILY_GAMES - gamesPlayedToday;

  const animRef             = useRef<number>(0);
  const cursorRef           = useRef(0);
  const dirRef              = useRef(1);
  const speedRef            = useRef(2.5);
  const floorRef            = useRef(0);
  const scoreRef            = useRef(0);
  const multiplierRef       = useRef(1);
  const multiplierFloorsRef = useRef(0);

  useEffect(() => {
    if (!user) return;
    loadStats();
    loadLeaderboard();
    loadTodayCount();
  }, [user]);

  async function loadTodayCount() {
    setLimitLoading(true);
    const start = new Date(); start.setUTCHours(0,0,0,0);
    const { count } = await supabase
      .from('tower_runs')
      .select('id', { count:'exact', head:true })
      .eq('user_id', user!.id)
      .gte('created_at', start.toISOString());
    setGamesPlayedToday(count || 0);
    setLimitLoading(false);
  }

  async function loadStats() {
    if (!user) return;
    const { data } = await supabase
      .from('tower_leaderboard')
      .select('best_floor,total_runs')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) { setBestFloor(data.best_floor); setTotalRuns(data.total_runs); }
  }

  async function loadLeaderboard() {
    const { data } = await supabase
      .from('tower_leaderboard')
      .select('user_id,best_floor,total_runs')
      .order('best_floor', { ascending:false })
      .limit(20);
    if (!data || data.length === 0) { setLeaderboard([]); return; }
    const userIds = data.map(d => d.user_id);
    const { data: users } = await supabase
      .from('users').select('id,first_name,username,photo_url').in('id', userIds);
    const userMap: Record<string, any> = {};
    (users || []).forEach(u => { userMap[u.id] = u; });
    setLeaderboard(data.map(d => ({
      ...d,
      first_name: userMap[d.user_id]?.first_name || 'Unknown',
      username:   userMap[d.user_id]?.username   || '',
      photo_url:  userMap[d.user_id]?.photo_url,
    })));
  }

  const onMultiplierReward = useCallback(() => {
    triggerHaptic('success');
    multiplierRef.current = 2;
    multiplierFloorsRef.current = 3;
    setMultiplier(2);
    setMultiplierFloors(3);
    if (user) logAdWatch(user.id, 'tower_2x', 0);
  }, [user]);

  const startGame = useCallback(() => {
    floorRef.current = 0; scoreRef.current = 0;
    multiplierRef.current = 1; multiplierFloorsRef.current = 0;
    setFloor(0); setScore(0);
    setMultiplier(1); setMultiplierFloors(0);
    cursorRef.current = 0; dirRef.current = 1;
    speedRef.current = 2.5;
    setSpeed(2.5); setCursorPos(0);
    setTargetZone(30 + Math.random() * 40);
    setGameState('playing');
    setShowResult(null);
    setGamesPlayedToday(p => p + 1);
    triggerHaptic('impact');
    if (user) logAdWatch(user.id, 'tower_start', 0);
  }, [user]);

  const onStartReward = useCallback(() => { startGame(); }, [startGame]);

  const { showAd: showStartAd }      = useRewardedAd(onStartReward);
  const { showAd: showMultiplierAd } = useRewardedAd(onMultiplierReward);

  useEffect(() => {
    if (gameState !== 'playing') { cancelAnimationFrame(animRef.current); return; }
    function animate() {
      cursorRef.current += dirRef.current * speedRef.current * 0.5;
      if (cursorRef.current >= 100) { cursorRef.current = 100; dirRef.current = -1; }
      if (cursorRef.current <= 0)   { cursorRef.current = 0;   dirRef.current = 1;  }
      setCursorPos(cursorRef.current);
      animRef.current = requestAnimationFrame(animate);
    }
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState]);

  function handleTap() {
    if (gameState !== 'playing') return;
    triggerHaptic('impact');
    const currentFloor = floorRef.current;
    const zoneSize  = Math.max(6, 22 - currentFloor * 0.7);
    const zoneStart = targetZone - zoneSize / 2;
    const zoneEnd   = targetZone + zoneSize / 2;

    if (cursorRef.current >= zoneStart && cursorRef.current <= zoneEnd) {
      const rawPts = Math.max(1, Math.floor(currentFloor * 0.25)) * multiplierRef.current;
      const pts    = Math.min(rawPts, MAX_SCORE_PER_GAME - scoreRef.current);
      if (pts > 0) scoreRef.current += pts;
      floorRef.current += 1;
      setScore(scoreRef.current);
      setFloor(floorRef.current);
      setShowResult('success');
      setTimeout(() => setShowResult(null), 250);

      if (multiplierFloorsRef.current > 0) {
        multiplierFloorsRef.current -= 1;
        setMultiplierFloors(multiplierFloorsRef.current);
        if (multiplierFloorsRef.current <= 0) { multiplierRef.current = 1; setMultiplier(1); }
      }

      const newSpeed = Math.min(9, 2.5 + floorRef.current * 0.22);
      speedRef.current = newSpeed;
      setSpeed(newSpeed);
      setTargetZone(10 + Math.random() * 80);
      cursorRef.current = Math.random() * 100;
      triggerHaptic('success');
    } else {
      setShowResult('fail');
      triggerHaptic('error');
      endGame();
    }
  }

  async function endGame() {
    const finalFloor = floorRef.current;
    const finalScore = Math.min(scoreRef.current, MAX_SCORE_PER_GAME);
    setGameState('gameover');
    cancelAnimationFrame(animRef.current);
    if (!user) return;

    await supabase.from('tower_runs').insert({
      user_id: user.id,
      floors_reached: finalFloor,
      points_earned: finalScore,
    });

    const { data: existing } = await supabase.from('tower_leaderboard')
      .select('id,best_floor,total_runs,total_floors').eq('user_id', user.id).maybeSingle();
    if (existing) {
      await supabase.from('tower_leaderboard').update({
        best_floor:   Math.max(existing.best_floor, finalFloor),
        total_floors: existing.total_floors + finalFloor,
        total_runs:   existing.total_runs + 1,
        updated_at:   new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      await supabase.from('tower_leaderboard').insert({
        user_id: user.id, best_floor: finalFloor, total_floors: finalFloor, total_runs: 1,
      });
    }

    if (finalScore > 0) {
      const { data: bal } = await supabase
        .from('balances').select('points,total_earned').eq('user_id', user.id).single();
      if (bal) {
        await supabase.from('balances').update({
          points: bal.points + finalScore,
          total_earned: bal.total_earned + finalScore,
        }).eq('user_id', user.id);
        await supabase.from('transactions').insert({
          user_id: user.id, type: 'tower_climb', points: finalScore,
          description: `🏗️ Tower Climb: Floor ${finalFloor} (+${finalScore} pts)`,
        });
      }
      await refreshBalance();
    }

    setBestFloor(prev => Math.max(prev, finalFloor));
    setTotalRuns(prev => prev + 1);
    loadLeaderboard();
  }

  const zoneSize      = Math.max(6, 22 - floor * 0.7);
  const speedPct      = Math.min(100, ((speed - 2.5) / 6.5) * 100);
  const nextRemaining = MAX_DAILY_GAMES - gamesPlayedToday;
  const scoreCapped   = score >= MAX_SCORE_PER_GAME;

  /* ── LEADERBOARD ── */
  if (showLeaderboard) return (
    <>
      <style>{CSS}</style>
      <div className="tc-root">
        <div className="tc-bg">{[1,2,3,4].map(i=><div key={i} className="tc-beam"/>)}</div>
        <div className="tc-scanline"/>
        <div className="tc-content">
          <div className="tc-lb-header">
            <button className="tc-lb-back" onClick={() => setShowLeaderboard(false)}>← BACK</button>
            <div className="tc-lb-title">LEADERBOARD</div>
          </div>
          {leaderboard.length === 0 && (
            <div style={{ textAlign:'center', color:'rgba(255,255,255,0.3)', padding:'40px 0', letterSpacing:'2px', fontSize:'12px' }}>
              NO PLAYERS YET
            </div>
          )}
          {leaderboard.map((entry, i) => (
            <div key={entry.user_id} className="tc-lb-row"
              style={i < 3 ? { borderColor:`rgba(255,190,0,${0.3 - i * 0.08})` } : {}}>
              <div className="tc-lb-rank" style={{ color: i===0?'#ffbe00':i===1?'#a0a0b0':i===2?'#cd7f32':'rgba(255,255,255,0.3)' }}>
                {i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}
              </div>
              <div style={{ flex:1 }}>
                <div className="tc-lb-name">{entry.first_name}</div>
                <div className="tc-lb-sub">{entry.total_runs} RUNS</div>
              </div>
              <div className="tc-lb-floor">FL {entry.best_floor}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  /* ── MENU ── */
  if (gameState === 'menu') return (
    <>
      <style>{CSS}</style>
      <div className="tc-root">
        <div className="tc-bg">{[1,2,3,4].map(i=><div key={i} className="tc-beam"/>)}</div>
        <div className="tc-scanline"/>
        <div className="tc-content">
          <div className="tc-tower-visual">
            {[...Array(6)].map((_,i) => (
              <div key={i} className="tc-floor-block" style={{
                width:`${70+i*8}px`, height:'12px',
                animationDelay:`${i*0.2}s`, opacity:0.4+i*0.1,
              }}/>
            ))}
          </div>

          <div className="tc-game-title">TOWER<br/>CLIMB</div>
          <div className="tc-game-sub">TAP · RISE · SURVIVE</div>

          <div className="tc-limit-wrap">
            <div className="tc-limit-label">
              Daily Runs &nbsp;
              <span>{limitLoading ? '...' : `${remaining} left`}</span>
            </div>
            <div className="tc-pips">
              {Array.from({ length: MAX_DAILY_GAMES }, (_, i) => (
                <div key={i}
                  className={`tc-pip ${i < gamesPlayedToday ? 'used' : 'avail'}`}
                  style={{ animationDelay:`${i * 0.06}s` }}
                />
              ))}
            </div>
          </div>

          <div className="tc-cap-banner">
            <div className="tc-cap-label">Max per run</div>
            <div className="tc-cap-val">{MAX_SCORE_PER_GAME} PTS</div>
          </div>

          {isMaxed && (
            <div className="tc-maxed">
              <div className="tc-maxed-icon">🔒</div>
              <div className="tc-maxed-title">DAILY LIMIT REACHED</div>
              <div className="tc-maxed-sub">Come back tomorrow for 5 more runs</div>
            </div>
          )}

          <div className="tc-stat-row">
            <div className="tc-stat">
              <div className="tc-stat-val">{bestFloor}</div>
              <div className="tc-stat-label">Best Floor</div>
            </div>
            <div className="tc-stat">
              <div className="tc-stat-val">{totalRuns}</div>
              <div className="tc-stat-label">Total Runs</div>
            </div>
          </div>

          <button className="tc-btn-primary" onClick={() => showStartAd()}
            disabled={isMaxed || limitLoading}>
            {isMaxed ? '🔒  DAILY LIMIT REACHED' : '🚀  START CLIMBING'}
          </button>
          <button className="tc-btn-secondary" onClick={() => setShowLeaderboard(true)}>
            🏆 LEADERBOARD
          </button>
        </div>
      </div>
    </>
  );

  /* ── GAME OVER ── */
  if (gameState === 'gameover') return (
    <>
      <style>{CSS}</style>
      <div className="tc-root">
        <div className="tc-bg">{[1,2,3,4].map(i=><div key={i} className="tc-beam"/>)}</div>
        <div className="tc-scanline"/>
        <div className="tc-content">
          <div style={{ textAlign:'center', marginBottom:'8px', fontFamily:"'Bebas Neue',sans-serif", fontSize:'13px', letterSpacing:'5px', color:'rgba(255,255,255,0.3)' }}>
            GAME OVER
          </div>

          <div className="tc-result-ring">
            <div>
              <div className="tc-result-floor">{floor}</div>
              <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:'10px', letterSpacing:'2px', color:'rgba(255,255,255,0.3)', textAlign:'center' }}>FLOOR</div>
            </div>
          </div>

          <div className="tc-result-label">POINTS EARNED</div>
          <div className="tc-result-pts">
            +{Math.min(score, MAX_SCORE_PER_GAME)} PTS
            {score >= MAX_SCORE_PER_GAME && (
              <span style={{ fontSize:11, color:'#ffbe00', marginLeft:8, letterSpacing:1 }}>MAX</span>
            )}
          </div>
          {floor >= bestFloor && floor > 0 && (
            <div className="tc-result-record">🎉 NEW RECORD!</div>
          )}

          <div style={{ textAlign:'center', marginBottom:'12px' }}>
            <div className="tc-remaining" style={{
              background: nextRemaining <= 0 ? 'rgba(239,68,68,0.08)' : 'rgba(255,190,0,0.06)',
              border:`1px solid ${nextRemaining <= 0 ? 'rgba(239,68,68,0.2)' : 'rgba(255,190,0,0.15)'}`,
              color: nextRemaining <= 0 ? '#ef4444' : 'rgba(255,255,255,0.4)',
            }}>
              {nextRemaining <= 0
                ? '🔒 No runs remaining today'
                : `${nextRemaining} run${nextRemaining !== 1 ? 's' : ''} remaining today`}
            </div>
          </div>

          <div className="tc-divider"/>

          <button className="tc-btn-primary" onClick={() => showStartAd()}
            disabled={nextRemaining <= 0}
            style={nextRemaining <= 0 ? { background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.3)', boxShadow:'none', cursor:'not-allowed' } : {}}>
            {nextRemaining <= 0 ? '🔒  COME BACK TOMORROW' : '🎬  PLAY AGAIN'}
          </button>
          <button className="tc-btn-secondary" onClick={() => { setGameState('menu'); loadStats(); }}>
            ← BACK TO MENU
          </button>
        </div>
      </div>
    </>
  );

  /* ── PLAYING ── */
  return (
    <>
      <style>{CSS}</style>
      <div className="tc-root" onClick={handleTap}>
        <div className="tc-bg">{[1,2,3,4].map(i=><div key={i} className="tc-beam"/>)}</div>
        <div className="tc-scanline"/>
        <div className={`tc-flash ${showResult||''} ${showResult?'show':''}`}/>

        <div className="tc-content">
          <div className="tc-hud">
            <div>
              <div className="tc-hud-label">FLOOR</div>
              <div className="tc-hud-floor">{floor}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div className="tc-hud-label">SCORE</div>
              <div className="tc-hud-score">{score}</div>
              {scoreCapped
                ? <div className="tc-hud-cap">🔒 MAX REACHED</div>
                : <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.2)', letterSpacing:'2px', marginTop:'4px' }}>
                    CAP {MAX_SCORE_PER_GAME}
                  </div>
              }
            </div>
          </div>

          <div className="tc-speed-bar-wrap">
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', letterSpacing:'2px', color:'rgba(255,255,255,0.2)', marginBottom:'5px' }}>
              <span>SPEED</span><span>{speed.toFixed(1)}x</span>
            </div>
            <div className="tc-speed-track">
              <div className="tc-speed-fill" style={{ width:`${speedPct}%` }}/>
            </div>
          </div>

          {/* 2x badge when active */}
          {multiplier > 1 && (
            <div className="tc-powerups">
              <div className="tc-badge" style={{ background:'rgba(255,190,0,0.12)', border:'1px solid rgba(255,190,0,0.3)', color:'#ffbe00' }}>
                ⚡ 2X · {multiplierFloors} LEFT
              </div>
            </div>
          )}

          <div className="tc-reaction-wrap">
            <div className="tc-tap-hint">TAP WHEN CURSOR HITS THE ZONE</div>
            <div className="tc-bar-track">
              <div className="tc-zone" style={{
                left:`${targetZone - zoneSize/2}%`, width:`${zoneSize}%`,
                background: showResult==='fail' ? 'rgba(239,68,68,0.3)' : 'rgba(74,222,128,0.2)',
                border:`1px solid ${showResult==='fail' ? '#ef4444' : '#4ade80'}`,
                boxShadow: showResult==='success' ? '0 0 12px rgba(74,222,128,0.5)' : showResult==='fail' ? '0 0 12px rgba(239,68,68,0.5)' : 'none',
              }}/>
              <div className="tc-cursor" style={{
                left:`${cursorPos}%`,
                background: showResult==='fail' ? '#ef4444' : '#ffbe00',
                boxShadow:`0 0 12px ${showResult==='fail' ? 'rgba(239,68,68,0.8)' : 'rgba(255,190,0,0.8)'}`,
              }}/>
            </div>
            <div className="tc-bar-meta">
              <span>ZONE {zoneSize.toFixed(0)}%</span>
              <span>TAP ANYWHERE</span>
            </div>
          </div>

          {/* 2x multiplier button — only shown when not active */}
          {multiplier === 1 && (
            <button className="tc-multiplier-btn"
              onClick={e => { e.stopPropagation(); showMultiplierAd(); }}>
              <div className="tc-powerup-icon">⚡</div>
              <div className="tc-powerup-name" style={{ color:'#ffbe00' }}>2X POINTS</div>
              <div className="tc-powerup-hint">WATCH AD · 3 FLOORS</div>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
