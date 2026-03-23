import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useRewardedAd } from '@/hooks/useAdsgram';
import { logAdWatch } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';

function triggerHaptic(type: 'success' | 'error' | 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.HapticFeedback) {
    const hf = (window as any).Telegram.WebApp.HapticFeedback;
    if (type === 'impact') hf.impactOccurred('medium');
    else hf.notificationOccurred(type);
  }
}

interface BoxReward {
  points: number;
  label: string;
  emoji: string;
  tier: 'empty' | 'small' | 'medium' | 'big' | 'jackpot';
}

function generateReward(): BoxReward {
  const r = Math.random();
  if (r < 0.30) return { points: 0,   label: 'Empty',        emoji: '💨', tier: 'empty'   };
  if (r < 0.55) return { points: 10,  label: '+10 Points',   emoji: '🪙', tier: 'small'   };
  if (r < 0.75) return { points: 25,  label: '+25 Points',   emoji: '✨', tier: 'small'   };
  if (r < 0.89) return { points: 50,  label: '+50 Points',   emoji: '🔥', tier: 'medium'  };
  if (r < 0.94) return { points: 100, label: '+100 Points',  emoji: '💰', tier: 'big'     };
  if (r < 0.97) return { points: 200, label: '+200 Points',  emoji: '💎', tier: 'big'     };
  if (r < 0.99) return { points: 300, label: '+300 Points',  emoji: '👑', tier: 'big'     };
  return           { points: 500, label: '+500 Points!', emoji: '🏆', tier: 'jackpot' };
}

type GameState = 'idle' | 'watching' | 'picking' | 'revealing' | 'result';

const TIER = {
  jackpot: { color: '#fbbf24', glow: 'rgba(251,191,36,0.6)', bg: 'rgba(251,191,36,0.12)', label: 'JACKPOT' },
  big:     { color: '#4ade80', glow: 'rgba(74,222,128,0.5)', bg: 'rgba(74,222,128,0.1)',  label: 'BIG WIN' },
  medium:  { color: '#22d3ee', glow: 'rgba(34,211,238,0.5)', bg: 'rgba(34,211,238,0.1)', label: 'NICE'    },
  small:   { color: '#a78bfa', glow: 'rgba(167,139,250,0.4)', bg: 'rgba(167,139,250,0.08)', label: 'WIN'  },
  empty:   { color: '#6b7280', glow: 'rgba(107,114,128,0.3)', bg: 'rgba(107,114,128,0.06)', label: 'MISS' },
};

const MAX_DAILY_GAMES = 5;

interface Particle { id: number; x: number; y: number; vx: number; vy: number; color: string; size: number; life: number; }

function ParticleBurst({ active, color }: { active: boolean; color: string }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    if (!active) return;
    const burst: Particle[] = Array.from({ length: 24 }, (_, i) => ({
      id: i, x: 50, y: 50,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      color, size: 3 + Math.random() * 5, life: 1,
    }));
    setParticles(burst);
    let frame = 0;
    function tick() {
      frame++;
      setParticles(prev => prev
        .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.18, life: p.life - 0.025 }))
        .filter(p => p.life > 0)
      );
      if (frame < 60) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, color]);
  if (!particles.length) return null;
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden', borderRadius:'20px' }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position:'absolute', left:`${p.x}%`, top:`${p.y}%`,
          width:p.size, height:p.size, borderRadius:'50%',
          background:p.color, opacity:p.life,
          transform:'translate(-50%,-50%)',
          boxShadow:`0 0 ${p.size*2}px ${p.color}`,
        }}/>
      ))}
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Outfit:wght@400;500;600;700&display=swap');

@keyframes lbFloat1    { 0%,100%{transform:translate(0,0)} 50%{transform:translate(20px,30px)} }
@keyframes lbFloat2    { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-20px,-20px)} }
@keyframes lbSpark     { 0%,100%{opacity:0;transform:scale(0)} 50%{opacity:1;transform:scale(1)} }
@keyframes lbBob       { 0%,100%{transform:translateY(0) rotate(-3deg)} 50%{transform:translateY(-8px) rotate(3deg)} }
@keyframes lbShine     { 0%{left:-100%} 40%,100%{left:150%} }
@keyframes lbBoxIdle   { 0%,100%{transform:translateY(0);box-shadow:0 4px 12px rgba(0,0,0,0.3)} 50%{transform:translateY(-3px);box-shadow:0 8px 20px rgba(251,191,36,0.15)} }
@keyframes lbDot       { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }
@keyframes lbPulseText { 0%,100%{opacity:0.8} 50%{opacity:1} }
@keyframes lbResultPop { from{transform:scale(0) rotate(-20deg);opacity:0} to{transform:scale(1) rotate(0deg);opacity:1} }
@keyframes lbLimitPulse{ 0%,100%{opacity:0.5} 50%{opacity:1} }
@keyframes lbPipPop    { from{transform:scale(0.5);opacity:0} to{transform:scale(1);opacity:1} }

.lb-root {
  font-family:'Outfit',sans-serif; background:#070510; min-height:100vh;
  padding:20px 16px 112px; position:relative; overflow:hidden; color:#fff;
}
.lb-orb { position:fixed; border-radius:50%; pointer-events:none; filter:blur(60px); z-index:0; }
.lb-orb-1 { width:300px;height:300px; background:radial-gradient(circle,rgba(251,191,36,0.08) 0%,transparent 70%); top:-80px;left:-60px; animation:lbFloat1 8s ease-in-out infinite; }
.lb-orb-2 { width:250px;height:250px; background:radial-gradient(circle,rgba(167,139,250,0.07) 0%,transparent 70%); bottom:100px;right:-60px; animation:lbFloat2 10s ease-in-out infinite; }
.lb-sparkles { position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden; }
.lb-spark    { position:absolute;width:2px;height:2px;border-radius:50%;background:rgba(251,191,36,0.6); animation:lbSpark var(--dur) ease-in-out infinite var(--delay); }
.lb-content  { position:relative;z-index:1; }

.lb-title    { font-family:'Cinzel Decorative',serif; font-size:24px; font-weight:900; text-align:center; background:linear-gradient(135deg,#fbbf24 0%,#f59e0b 40%,#fde68a 70%,#fbbf24 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; filter:drop-shadow(0 0 20px rgba(251,191,36,0.4)); margin-bottom:4px; letter-spacing:1px; }
.lb-subtitle { text-align:center; font-size:11px; letter-spacing:3px; color:rgba(255,255,255,0.25); text-transform:uppercase; margin-bottom:20px; }

.lb-limit-wrap  { display:flex; flex-direction:column; align-items:center; gap:8px; margin-bottom:18px; }
.lb-limit-label { font-family:'Outfit',sans-serif; font-size:11px; letter-spacing:2px; color:rgba(255,255,255,0.25); text-transform:uppercase; display:flex; align-items:center; gap:6px; }
.lb-limit-label span { color:#fbbf24; font-weight:700; }
.lb-pips { display:flex; gap:7px; }
.lb-pip  { width:28px; height:8px; border-radius:4px; transition:background 0.3s,box-shadow 0.3s; animation:lbPipPop 0.3s ease both; }
.lb-pip.used  { background:#fbbf24; box-shadow:0 0 8px rgba(251,191,36,0.5); }
.lb-pip.avail { background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); }

.lb-maxed { background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.2); border-radius:16px; padding:16px; text-align:center; margin-bottom:16px; position:relative; overflow:hidden; }
.lb-maxed::before { content:''; position:absolute; top:0; left:10%; right:10%; height:1px; background:linear-gradient(90deg,transparent,rgba(239,68,68,0.35),transparent); }
.lb-maxed-icon  { font-size:36px; margin-bottom:8px; animation:lbLimitPulse 2s ease-in-out infinite; }
.lb-maxed-title { font-family:'Cinzel Decorative',serif; font-size:14px; color:#ef4444; margin-bottom:4px; }
.lb-maxed-sub   { font-size:12px; color:rgba(255,255,255,0.3); letter-spacing:1px; }

.lb-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:18px; }
.lb-stat  { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:12px 8px; text-align:center; }
.lb-stat-val { font-size:18px; font-weight:700; line-height:1; margin-bottom:3px; }
.lb-stat-lbl { font-size:9px; letter-spacing:2px; color:rgba(255,255,255,0.25); text-transform:uppercase; }

.lb-card { background:rgba(255,255,255,0.02); border:1px solid rgba(251,191,36,0.15); border-radius:24px; padding:24px 20px; margin-bottom:16px; position:relative; overflow:hidden; }
.lb-card::before { content:''; position:absolute; top:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,rgba(251,191,36,0.4),transparent); }

.lb-idle-icon { font-size:64px; text-align:center; margin-bottom:12px; filter:drop-shadow(0 0 20px rgba(251,191,36,0.3)); animation:lbBob 3s ease-in-out infinite; }
.lb-idle-text { text-align:center; font-size:13px; color:rgba(255,255,255,0.4); margin-bottom:20px; letter-spacing:0.5px; line-height:1.5; }

.lb-btn-watch {
  width:100%; padding:18px; border-radius:16px; border:none;
  background:linear-gradient(135deg,#fbbf24 0%,#f59e0b 50%,#d97706 100%);
  color:#1a0e00; font-family:'Outfit',sans-serif; font-size:16px; font-weight:700;
  letter-spacing:1px; cursor:pointer; transition:transform 0.15s,box-shadow 0.2s;
  box-shadow:0 6px 32px rgba(251,191,36,0.35),0 2px 8px rgba(0,0,0,0.4);
  position:relative; overflow:hidden;
}
.lb-btn-watch::after { content:''; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent); animation:lbShine 3s ease-in-out infinite; }
.lb-btn-watch:active   { transform:scale(0.97); box-shadow:0 2px 12px rgba(251,191,36,0.2); }
.lb-btn-watch:disabled { opacity:0.4; cursor:not-allowed; }
.lb-btn-watch:disabled::after { display:none; }

.lb-pick-label { text-align:center; font-size:12px; letter-spacing:3px; color:rgba(255,255,255,0.3); text-transform:uppercase; margin-bottom:16px; }
.lb-pick-label.active { color:#fbbf24; animation:lbPulseText 1.5s ease-in-out infinite; }

.lb-boxes { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin-bottom:16px; }
.lb-box { aspect-ratio:1; border-radius:16px; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; border:1px solid rgba(255,255,255,0.08); transition:transform 0.15s,box-shadow 0.2s; position:relative; overflow:hidden; background:rgba(255,255,255,0.04); }
.lb-box.pickable { animation:lbBoxIdle 2s ease-in-out infinite; }
.lb-box.pickable:nth-child(2){animation-delay:0.2s}
.lb-box.pickable:nth-child(3){animation-delay:0.4s}
.lb-box.pickable:nth-child(4){animation-delay:0.6s}
.lb-box.pickable:nth-child(5){animation-delay:0.8s}
.lb-box.pickable:active { transform:scale(0.92); }
.lb-box-emoji { font-size:26px; line-height:1; }
.lb-box-pts   { font-size:9px; font-weight:700; letter-spacing:1px; margin-top:3px; }
.lb-check     { position:absolute; top:4px; right:4px; width:14px; height:14px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:8px; font-weight:700; }

.lb-result     { text-align:center; padding:8px 0 4px; }
.lb-result-tier{ font-size:10px; letter-spacing:4px; font-weight:700; text-transform:uppercase; margin-bottom:6px; }
.lb-result-pts { font-family:'Cinzel Decorative',serif; font-size:28px; font-weight:700; margin-bottom:4px; }
.lb-result-msg { font-size:12px; color:rgba(255,255,255,0.3); letter-spacing:1px; margin-bottom:20px; }
.lb-btn-again  { width:100%; padding:16px; border-radius:14px; border:none; background:linear-gradient(135deg,#fbbf24,#f59e0b); color:#1a0e00; font-family:'Outfit',sans-serif; font-size:15px; font-weight:700; letter-spacing:1px; cursor:pointer; transition:transform 0.1s; box-shadow:0 4px 20px rgba(251,191,36,0.3); }
.lb-btn-again:active { transform:scale(0.97); }

.lb-watching { text-align:center; padding:24px 0; }
.lb-watching-icon { font-size:40px; margin-bottom:10px; display:block; }
.lb-watching-dots span { display:inline-block; width:6px; height:6px; border-radius:50%; background:#fbbf24; margin:0 3px; animation:lbDot 1.2s ease-in-out infinite; }
.lb-watching-dots span:nth-child(2){animation-delay:0.2s}
.lb-watching-dots span:nth-child(3){animation-delay:0.4s}

.lb-table       { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:18px; padding:16px; overflow:hidden; }
.lb-table-title { font-size:9px; letter-spacing:3px; color:rgba(255,255,255,0.2); text-transform:uppercase; margin-bottom:12px; }
.lb-table-row   { display:flex; align-items:center; gap:10px; padding:7px 0; border-bottom:1px solid rgba(255,255,255,0.04); }
.lb-table-row:last-child { border-bottom:none; }
.lb-table-emoji { font-size:16px; width:24px; text-align:center; }
.lb-table-label { flex:1; font-size:13px; font-weight:500; }
.lb-table-prob  { font-size:10px; letter-spacing:1px; color:rgba(255,255,255,0.25); background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:20px; }
`;

const SPARKS = Array.from({ length: 12 }, () => ({
  left:  `${Math.random() * 100}%`,
  top:   `${Math.random() * 100}%`,
  dur:   `${2 + Math.random() * 4}s`,
  delay: `${Math.random() * 4}s`,
}));

export default function LuckyBoxPage() {
  const { user, balance, refreshBalance } = useApp();
  const [gameState, setGameState]         = useState<GameState>('idle');
  const [selectedBox, setSelectedBox]     = useState<number | null>(null);
  const [reward, setReward]               = useState<BoxReward | null>(null);
  const [revealedBoxes, setRevealedBoxes] = useState<(BoxReward | null)[]>([null,null,null,null,null]);
  const [totalPlayed, setTotalPlayed]     = useState(0);
  const [totalWon, setTotalWon]           = useState(0);
  const [burstActive, setBurstActive]     = useState(false);

  const [gamesPlayedToday, setGamesPlayedToday] = useState(0);
  const [limitLoading, setLimitLoading]         = useState(true);
  const isMaxed   = gamesPlayedToday >= MAX_DAILY_GAMES;
  const remaining = MAX_DAILY_GAMES - gamesPlayedToday;

  useEffect(() => {
    if (!user) return;
    loadTodayCount();
  }, [user]);

  async function loadTodayCount() {
    setLimitLoading(true);
    const start = new Date(); start.setUTCHours(0,0,0,0);
    const { count } = await supabase
      .from('transactions')
      .select('id', { count:'exact', head:true })
      .eq('user_id', user!.id)
      .eq('type', 'lucky_box')
      .gte('created_at', start.toISOString());
    setGamesPlayedToday(count || 0);
    setLimitLoading(false);
  }

  const onAdReward = useCallback(() => { setGameState('picking'); }, []);
  const { showAd } = useRewardedAd(onAdReward);

  const handleWatchAd = async () => {
    if (isMaxed) return;
    setGameState('watching');
    const ok = await showAd();
    if (!ok) setGameState('idle');
    if (user) logAdWatch(user.id, 'lucky_box', 0);
  };

  const handlePickBox = async (index: number) => {
    if (gameState !== 'picking' || selectedBox !== null) return;
    triggerHaptic('impact');
    setSelectedBox(index);
    setGameState('revealing');

    const allRewards   = Array.from({ length: 5 }, () => generateReward());
    const pickedReward = allRewards[index];

    await new Promise(r => setTimeout(r, 600));
    setRevealedBoxes(allRewards);
    setReward(pickedReward);
    setTotalPlayed(p => p + 1);
    setGamesPlayedToday(p => p + 1);

    if (pickedReward.points > 0) {
      triggerHaptic('success');
      setBurstActive(true);
      setTimeout(() => setBurstActive(false), 100);
      setTotalWon(w => w + pickedReward.points);
    } else {
      triggerHaptic('error');
    }

    if (user) {
      const { data: bal } = await supabase
        .from('balances').select('points,total_earned').eq('user_id', user.id).single();
      if (bal) {
        await supabase.from('transactions').insert({
          user_id: user.id, type: 'lucky_box',
          points: pickedReward.points,
          description: `🎁 Lucky Box: ${pickedReward.label}`,
        });
        if (pickedReward.points > 0) {
          await supabase.from('balances').update({
            points: bal.points + pickedReward.points,
            total_earned: bal.total_earned + pickedReward.points,
          }).eq('user_id', user.id);
        }
      }
      refreshBalance();
    }

    setGameState('result');
  };

  const resetGame = () => {
    setGameState('idle');
    setSelectedBox(null);
    setReward(null);
    setRevealedBoxes([null,null,null,null,null]);
    setBurstActive(false);
  };

  const BOX_ICONS = ['🎁','📦','🎀','💎','🏆'];

  return (
    <>
      <style>{CSS}</style>
      <div className="lb-root">
        <div className="lb-orb lb-orb-1"/>
        <div className="lb-orb lb-orb-2"/>
        <div className="lb-sparkles">
          {SPARKS.map((s,i) => (
            <div key={i} className="lb-spark" style={{
              left:s.left, top:s.top,
              '--dur':s.dur, '--delay':s.delay,
            } as React.CSSProperties}/>
          ))}
        </div>

        <div className="lb-content">
          <div className="lb-title">Lucky Box</div>
          <div className="lb-subtitle">Pick your treasure · Win big</div>

          {/* Daily limit pips */}
          <div className="lb-limit-wrap">
            <div className="lb-limit-label">
              Daily Plays &nbsp;
              <span>{limitLoading ? '...' : `${remaining} left`}</span>
            </div>
            <div className="lb-pips">
              {Array.from({ length: MAX_DAILY_GAMES }, (_, i) => (
                <div key={i}
                  className={`lb-pip ${i < gamesPlayedToday ? 'used' : 'avail'}`}
                  style={{ animationDelay:`${i * 0.06}s` }}
                />
              ))}
            </div>
          </div>

          {/* Maxed banner */}
          {isMaxed && (
            <div className="lb-maxed">
              <div className="lb-maxed-icon">🔒</div>
              <div className="lb-maxed-title">Daily Limit Reached</div>
              <div className="lb-maxed-sub">Come back tomorrow for 5 more plays</div>
            </div>
          )}

          {/* Stats */}
          <div className="lb-stats">
            <div className="lb-stat">
              <div className="lb-stat-val" style={{ color:'#fbbf24' }}>
                {(balance?.points ?? 0).toLocaleString()}
              </div>
              <div className="lb-stat-lbl">Balance</div>
            </div>
            <div className="lb-stat">
              <div className="lb-stat-val">{totalPlayed}</div>
              <div className="lb-stat-lbl">Played</div>
            </div>
            <div className="lb-stat">
              <div className="lb-stat-val" style={{ color:'#4ade80' }}>
                {totalWon.toLocaleString()}
              </div>
              <div className="lb-stat-lbl">Won</div>
            </div>
          </div>

          {/* Main card */}
          <div className="lb-card">
            <ParticleBurst
              active={burstActive}
              color={reward ? TIER[reward.tier].color : '#fbbf24'}
            />

            {/* IDLE */}
            {gameState === 'idle' && (
              <>
                <div className="lb-idle-icon">🎁</div>
                <div className="lb-idle-text">
                  {isMaxed
                    ? "You've used all 5 plays today.\nReset at midnight UTC."
                    : `Watch a short ad to unlock\n5 mystery boxes · ${remaining} play${remaining !== 1 ? 's' : ''} remaining`}
                </div>
                <button
                  className="lb-btn-watch"
                  onClick={handleWatchAd}
                  disabled={isMaxed || limitLoading}
                >
                  {isMaxed ? '🔒  DAILY LIMIT REACHED' : '📺  WATCH AD & PLAY'}
                </button>
              </>
            )}

            {/* WATCHING */}
            {gameState === 'watching' && (
              <div className="lb-watching">
                <span className="lb-watching-icon">📺</span>
                <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.3)', letterSpacing:'2px', marginBottom:'12px' }}>
                  LOADING AD
                </div>
                <div className="lb-watching-dots"><span/><span/><span/></div>
              </div>
            )}

            {/* PICKING / REVEALING / RESULT */}
            {(gameState === 'picking' || gameState === 'revealing' || gameState === 'result') && (
              <>
                <div className={`lb-pick-label ${gameState === 'picking' ? 'active' : ''}`}>
                  {gameState === 'picking' ? '✦ Choose your box ✦'
                   : gameState === 'revealing' ? '✨ Revealing...' : ''}
                </div>

                <div className="lb-boxes">
                  {BOX_ICONS.map((icon, i) => {
                    const isRevealed = revealedBoxes[i] !== null;
                    const isPicked   = selectedBox === i;
                    const br = revealedBoxes[i];
                    const tc = br ? TIER[br.tier] : null;
                    return (
                      <button key={i}
                        className={`lb-box ${gameState === 'picking' ? 'pickable' : ''}`}
                        onClick={() => handlePickBox(i)}
                        disabled={gameState !== 'picking'}
                        style={isRevealed && tc ? {
                          background: tc.bg,
                          borderColor: isPicked ? tc.color : 'rgba(255,255,255,0.1)',
                          boxShadow: isPicked ? `0 0 20px ${tc.glow}` : 'none',
                          animationName: 'none',
                        } : {}}
                      >
                        {isRevealed && br ? (
                          <>
                            <span className="lb-box-emoji">{br.emoji}</span>
                            <span className="lb-box-pts" style={{ color:tc?.color }}>
                              {br.points > 0 ? `+${br.points}` : '—'}
                            </span>
                            {isPicked && (
                              <div className="lb-check" style={{ background:tc?.color, color:'#000' }}>✓</div>
                            )}
                          </>
                        ) : (
                          <span className="lb-box-emoji">{icon}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Result panel */}
                {gameState === 'result' && reward && (() => {
                  const tc = TIER[reward.tier];
                  const nextRemaining = MAX_DAILY_GAMES - gamesPlayedToday;
                  return (
                    <div className="lb-result">
                      <div style={{
                        width:'80px', height:'80px', borderRadius:'50%',
                        background:tc.bg, border:`2px solid ${tc.color}`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        margin:'0 auto 12px', boxShadow:`0 0 30px ${tc.glow}`,
                      }}>
                        <span style={{ fontSize:'36px' }}>{reward.emoji}</span>
                      </div>
                      <div className="lb-result-tier" style={{ color:tc.color }}>{tc.label}</div>
                      <div className="lb-result-pts" style={{
                        background:`linear-gradient(135deg,${tc.color},#fff)`,
                        WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
                      }}>
                        {reward.points > 0 ? `+${reward.points} pts` : 'Empty Box'}
                      </div>
                      <div className="lb-result-msg">
                        {reward.points > 0 ? 'Points added to your balance!' : 'Better luck next time'}
                      </div>

                      <div style={{
                        margin:'0 0 14px', padding:'8px 14px', borderRadius:'12px',
                        background: nextRemaining <= 0 ? 'rgba(239,68,68,0.08)' : 'rgba(251,191,36,0.06)',
                        border:`1px solid ${nextRemaining <= 0 ? 'rgba(239,68,68,0.2)' : 'rgba(251,191,36,0.15)'}`,
                        fontFamily:"'Outfit',sans-serif", fontSize:12,
                        color: nextRemaining <= 0 ? '#ef4444' : 'rgba(255,255,255,0.4)',
                        letterSpacing:'0.5px',
                      }}>
                        {nextRemaining <= 0
                          ? '🔒 No plays remaining today'
                          : `${nextRemaining} play${nextRemaining !== 1 ? 's' : ''} remaining today`}
                      </div>

                      <button
                        className="lb-btn-again"
                        onClick={resetGame}
                        disabled={nextRemaining <= 0}
                        style={nextRemaining <= 0 ? {
                          background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.3)',
                          boxShadow:'none', cursor:'not-allowed',
                        } : {}}
                      >
                        {nextRemaining <= 0 ? '🔒  Come Back Tomorrow' : '📺  Watch Ad & Play Again'}
                      </button>
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          {/* Reward table */}
          <div className="lb-table">
            <div className="lb-table-title">Possible Rewards</div>
            {[
              { emoji:'🏆', label:'500 Points', tier:'jackpot' as const, prob:'1%'  },
              { emoji:'👑', label:'300 Points', tier:'big'     as const, prob:'2%'  },
              { emoji:'💎', label:'200 Points', tier:'big'     as const, prob:'3%'  },
              { emoji:'💰', label:'100 Points', tier:'big'     as const, prob:'5%'  },
              { emoji:'🔥', label:'50 Points',  tier:'medium'  as const, prob:'14%' },
              { emoji:'✨', label:'25 Points',  tier:'small'   as const, prob:'20%' },
              { emoji:'🪙', label:'10 Points',  tier:'small'   as const, prob:'25%' },
              { emoji:'💨', label:'Empty',      tier:'empty'   as const, prob:'30%' },
            ].map((row, i) => (
              <div key={i} className="lb-table-row">
                <span className="lb-table-emoji">{row.emoji}</span>
                <span className="lb-table-label" style={{ color:TIER[row.tier].color }}>{row.label}</span>
                <span className="lb-table-prob">{row.prob}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
