import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useRewardedAd } from '@/hooks/useAdsgram';
import { supabase } from '@/integrations/supabase/client';

function triggerHaptic(type: 'success' | 'error' | 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.HapticFeedback) {
    const hf = (window as any).Telegram.WebApp.HapticFeedback;
    if (type === 'impact') hf.impactOccurred('medium');
    else hf.notificationOccurred(type);
  }
}

const TIERS = [
  { diff: 0, pts: 100, label: 'PERFECT!',  sublabel: 'Exact match',  color: '#fbbf24', glow: 'rgba(251,191,36,0.7)'  },
  { diff: 1, pts: 60,  label: 'SO CLOSE',  sublabel: 'Off by 1',     color: '#4ade80', glow: 'rgba(74,222,128,0.6)'  },
  { diff: 2, pts: 35,  label: 'VERY NEAR', sublabel: 'Off by 2',     color: '#22d3ee', glow: 'rgba(34,211,238,0.5)'  },
  { diff: 4, pts: 20,  label: 'CLOSE',     sublabel: 'Off by 3–4',   color: '#a78bfa', glow: 'rgba(167,139,250,0.5)' },
  { diff: 9, pts: 10,  label: 'FAR OFF',   sublabel: 'Off by 5+',    color: '#6b7280', glow: 'rgba(107,114,128,0.4)' },
];

function getTier(diff: number) {
  return TIERS.find(t => diff <= t.diff) || TIERS[TIERS.length - 1];
}

function heatColor(n: number, target: number, guessed: boolean) {
  if (!guessed) return { bg:'rgba(34,211,238,0.06)', border:'rgba(34,211,238,0.2)', color:'rgba(255,255,255,0.7)', shadow:'none' };
  const diff = Math.abs(n - target);
  if (diff === 0) return { bg:'rgba(251,191,36,0.2)',   border:'#fbbf24',               color:'#fbbf24', shadow:'0 0 16px rgba(251,191,36,0.6)' };
  if (diff === 1) return { bg:'rgba(74,222,128,0.12)',  border:'rgba(74,222,128,0.5)',   color:'#4ade80', shadow:'0 0 8px rgba(74,222,128,0.3)' };
  if (diff === 2) return { bg:'rgba(34,211,238,0.1)',   border:'rgba(34,211,238,0.4)',   color:'#22d3ee', shadow:'none' };
  if (diff <= 4)  return { bg:'rgba(167,139,250,0.08)', border:'rgba(167,139,250,0.3)',  color:'#a78bfa', shadow:'none' };
  return              { bg:'rgba(107,114,128,0.05)',  border:'rgba(107,114,128,0.15)', color:'rgba(255,255,255,0.3)', shadow:'none' };
}

const MAX_DAILY_GAMES = 5;

function SonarRing({ active, color }: { active: boolean; color: string }) {
  return (
    <div style={{ position:'relative', width:'140px', height:'140px', margin:'0 auto 20px' }}>
      {[1,2,3].map(i => (
        <div key={i} style={{
          position:'absolute', inset:`${i*16}px`, borderRadius:'50%',
          border:`1px solid ${color}${active ? '30' : '18'}`, transition:'border-color 0.5s',
        }}/>
      ))}
      {active && [0,1,2].map(i => (
        <div key={i} style={{
          position:'absolute', inset:0, borderRadius:'50%',
          border:`2px solid ${color}`,
          animation:`ngSonar 2s ease-out infinite`,
          animationDelay:`${i*0.65}s`, opacity:0,
        }}/>
      ))}
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{
          width:'64px', height:'64px', borderRadius:'50%',
          background:`radial-gradient(circle,${color}25,${color}08)`,
          border:`2px solid ${color}50`,
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow: active ? `0 0 24px ${color}40` : 'none',
          transition:'all 0.4s',
        }}>
          <span style={{
            fontFamily:"'Black Ops One',sans-serif",
            fontSize: active ? '28px' : '22px',
            color: active ? color : 'rgba(255,255,255,0.2)',
            transition:'all 0.4s', lineHeight:1,
          }}>?</span>
        </div>
      </div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Black+Ops+One&family=Exo+2:wght@400;500;600;700&display=swap');

@keyframes ngSonar   { 0%{transform:scale(0.3);opacity:0.8} 100%{transform:scale(1.4);opacity:0} }
@keyframes ngReveal  { 0%{transform:scale(0) rotate(-20deg);opacity:0} 60%{transform:scale(1.15) rotate(5deg);opacity:1} 100%{transform:scale(1) rotate(0deg);opacity:1} }
@keyframes ngPtsPop  { 0%{transform:translateY(12px) scale(0.6);opacity:0} 100%{transform:translateY(0) scale(1);opacity:1} }
@keyframes ngShine   { 0%{left:-100%} 40%,100%{left:150%} }
@keyframes ngFloat   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
@keyframes ngPulse   { 0%,100%{opacity:0.5} 50%{opacity:1} }
@keyframes ngDot     { 0%,80%,100%{transform:scale(0.5);opacity:0.3} 40%{transform:scale(1);opacity:1} }
@keyframes ngPipPop  { from{transform:scale(0.5);opacity:0} to{transform:scale(1);opacity:1} }
@keyframes ngLimitPulse { 0%,100%{opacity:0.5} 50%{opacity:1} }

.ng-root { font-family:'Exo 2',sans-serif; background:#030b0f; min-height:100vh; padding:20px 16px 112px; position:relative; overflow:hidden; color:#fff; }
.ng-radar-bg { position:fixed; inset:0; pointer-events:none; z-index:0; overflow:hidden; }
.ng-radar-bg::before { content:''; position:absolute; inset:0; background-image:linear-gradient(rgba(34,211,238,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,0.03) 1px,transparent 1px); background-size:32px 32px; }
.ng-radar-bg::after  { content:''; position:absolute; inset:0; background:radial-gradient(ellipse 80% 60% at 50% 0%,rgba(34,211,238,0.06) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 90%,rgba(6,182,212,0.04) 0%,transparent 50%); }
.ng-scanline { position:fixed; inset:0; background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(34,211,238,0.015) 3px,rgba(34,211,238,0.015) 4px); pointer-events:none; z-index:0; }
.ng-content  { position:relative; z-index:1; }

.ng-eyebrow  { text-align:center; font-size:9px; letter-spacing:6px; color:rgba(34,211,238,0.4); text-transform:uppercase; margin-bottom:6px; }
.ng-title    { font-family:'Black Ops One',sans-serif; font-size:42px; text-align:center; letter-spacing:3px; color:#22d3ee; text-shadow:0 0 30px rgba(34,211,238,0.5),0 0 60px rgba(34,211,238,0.2); line-height:1; margin-bottom:4px; }
.ng-subtitle { text-align:center; font-size:11px; color:rgba(255,255,255,0.2); letter-spacing:2px; margin-bottom:20px; }

/* ── Daily limit pips ── */
.ng-limit-wrap  { display:flex; flex-direction:column; align-items:center; gap:8px; margin-bottom:18px; }
.ng-limit-label { font-family:'Exo 2',sans-serif; font-size:11px; letter-spacing:2px; color:rgba(255,255,255,0.25); text-transform:uppercase; display:flex; align-items:center; gap:6px; }
.ng-limit-label span { color:#22d3ee; font-weight:600; }
.ng-pips { display:flex; gap:7px; }
.ng-pip  { width:28px; height:8px; border-radius:4px; transition:background 0.3s,box-shadow 0.3s; animation:ngPipPop 0.3s ease both; }
.ng-pip.used  { background:#22d3ee; box-shadow:0 0 8px rgba(34,211,238,0.5); }
.ng-pip.avail { background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); }

/* ── Maxed banner ── */
.ng-maxed { background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.2); border-radius:16px; padding:16px; text-align:center; margin-bottom:16px; position:relative; overflow:hidden; }
.ng-maxed::before { content:''; position:absolute; top:0; left:10%; right:10%; height:1px; background:linear-gradient(90deg,transparent,rgba(239,68,68,0.35),transparent); }
.ng-maxed-icon  { font-size:36px; margin-bottom:8px; animation:ngLimitPulse 2s ease-in-out infinite; }
.ng-maxed-title { font-family:'Black Ops One',sans-serif; font-size:18px; letter-spacing:2px; color:#ef4444; margin-bottom:4px; }
.ng-maxed-sub   { font-size:12px; color:rgba(255,255,255,0.3); letter-spacing:1px; }

.ng-arena { background:rgba(34,211,238,0.02); border:1px solid rgba(34,211,238,0.1); border-radius:28px; padding:28px 20px; margin-bottom:14px; position:relative; overflow:hidden; }
.ng-arena::before { content:''; position:absolute; top:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,rgba(34,211,238,0.4),transparent); }
.ng-arena-glow { position:absolute; inset:-1px; border-radius:28px; pointer-events:none; transition:box-shadow 0.5s; }

.ng-idle-icon { font-size:52px; text-align:center; margin-bottom:14px; animation:ngFloat 3s ease-in-out infinite; filter:drop-shadow(0 0 16px rgba(34,211,238,0.4)); }
.ng-idle-text { text-align:center; font-size:13px; color:rgba(255,255,255,0.3); letter-spacing:1px; line-height:1.6; margin-bottom:20px; }

.ng-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin-bottom:4px; }
.ng-num-btn { aspect-ratio:1; border-radius:14px; border:none; cursor:pointer; font-family:'Black Ops One',sans-serif; font-size:20px; transition:transform 0.12s,box-shadow 0.2s,background 0.3s,border-color 0.3s,color 0.3s; position:relative; overflow:hidden; }
.ng-num-btn:active { transform:scale(0.88); }
.ng-num-btn.pickable:hover { transform:translateY(-3px) scale(1.05); }
.ng-num-btn.selected { transform:scale(1.1); z-index:2; }
.ng-num-btn.target   { animation:ngReveal 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }

.ng-hint { text-align:center; font-size:10px; letter-spacing:3px; color:rgba(34,211,238,0.4); text-transform:uppercase; margin-bottom:16px; animation:ngPulse 2s ease-in-out infinite; }

.ng-compare { display:flex; align-items:center; justify-content:center; gap:16px; margin-bottom:20px; }
.ng-compare-box   { text-align:center; flex:1; }
.ng-compare-label { font-size:9px; letter-spacing:3px; text-transform:uppercase; color:rgba(255,255,255,0.25); margin-bottom:6px; }
.ng-compare-num   { font-family:'Black Ops One',sans-serif; font-size:56px; line-height:1; animation:ngReveal 0.4s cubic-bezier(0.34,1.56,0.64,1); }
.ng-compare-arrow { font-size:20px; color:rgba(255,255,255,0.15); flex-shrink:0; }

.ng-tier-pill { display:inline-flex; align-items:center; gap:6px; padding:5px 18px; border-radius:20px; font-family:'Black Ops One',sans-serif; font-size:16px; letter-spacing:2px; margin-bottom:16px; animation:ngReveal 0.4s 0.1s cubic-bezier(0.34,1.56,0.64,1) both; }

.ng-pts       { text-align:center; margin-bottom:24px; animation:ngPtsPop 0.5s 0.2s cubic-bezier(0.34,1.56,0.64,1) both; }
.ng-pts-num   { font-family:'Black Ops One',sans-serif; font-size:68px; line-height:1; letter-spacing:2px; }
.ng-pts-label { font-size:10px; letter-spacing:4px; color:rgba(255,255,255,0.25); text-transform:uppercase; margin-top:2px; }

.ng-prox-wrap  { margin-bottom:24px; }
.ng-prox-label { display:flex; justify-content:space-between; font-size:9px; letter-spacing:2px; color:rgba(255,255,255,0.2); text-transform:uppercase; margin-bottom:6px; }
.ng-prox-track { height:6px; border-radius:3px; background:rgba(255,255,255,0.06); overflow:hidden; }
.ng-prox-fill  { height:100%; border-radius:3px; transition:width 0.8s cubic-bezier(0.34,1.56,0.64,1); }

/* Remaining pill */
.ng-remaining { display:inline-flex; align-items:center; gap:5px; padding:6px 14px; border-radius:20px; margin-bottom:14px; font-size:12px; letter-spacing:0.5px; }

.ng-btn { width:100%; padding:18px; border-radius:16px; border:none; font-family:'Black Ops One',sans-serif; font-size:18px; letter-spacing:2px; cursor:pointer; transition:transform 0.1s,box-shadow 0.2s; display:block; position:relative; overflow:hidden; }
.ng-btn::after { content:''; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent); animation:ngShine 3s ease-in-out infinite; }
.ng-btn:active { transform:scale(0.97); }
.ng-btn:disabled { opacity:0.4; cursor:not-allowed; }
.ng-btn:disabled::after { display:none; }
.ng-btn-cyan  { background:linear-gradient(135deg,#22d3ee,#0891b2,#0e7490); color:#001a20; box-shadow:0 6px 32px rgba(34,211,238,0.35); }
.ng-btn-gold  { background:linear-gradient(135deg,#fbbf24,#f59e0b,#d97706); color:#1a0800; box-shadow:0 6px 32px rgba(251,191,36,0.35); }
.ng-btn-ghost { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); color:rgba(255,255,255,0.35); font-size:14px; margin-top:8px; letter-spacing:1px; }
.ng-btn-ghost::after { display:none; }

.ng-loading { text-align:center; padding:16px 0; }
.ng-loading-dots span { display:inline-block; width:8px; height:8px; border-radius:50%; background:#22d3ee; margin:0 4px; animation:ngDot 1.2s ease-in-out infinite; }
.ng-loading-dots span:nth-child(2){animation-delay:0.2s} .ng-loading-dots span:nth-child(3){animation-delay:0.4s}

.ng-table       { background:rgba(34,211,238,0.02); border:1px solid rgba(34,211,238,0.08); border-radius:18px; padding:16px; }
.ng-table-title { font-size:9px; letter-spacing:3px; color:rgba(255,255,255,0.2); text-transform:uppercase; margin-bottom:12px; }
.ng-table-row   { display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.04); }
.ng-table-row:last-child { border-bottom:none; }
.ng-table-diff  { width:42px; height:42px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-family:'Black Ops One',sans-serif; font-size:14px; flex-shrink:0; }
.ng-table-info  { flex:1; }
.ng-table-label { font-size:13px; font-weight:600; }
.ng-table-sub   { font-size:10px; color:rgba(255,255,255,0.25); letter-spacing:1px; margin-top:1px; }
.ng-table-pts   { font-family:'Black Ops One',sans-serif; font-size:20px; letter-spacing:1px; }
`;

export default function NumberGuessPage() {
  const { user, refreshBalance } = useApp();
  const [phase, setPhase]         = useState<'locked'|'loading'|'guessing'|'result'>('locked');
  const [target, setTarget]       = useState(1);
  const [guess, setGuess]         = useState<number|null>(null);
  const [reward, setReward]       = useState(0);
  const [activeTier, setActiveTier] = useState<typeof TIERS[0]|null>(null);
  const [proxPct, setProxPct]     = useState(0);

  /* ── Daily limit ── */
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
      .eq('type', 'number_guess')
      .gte('created_at', start.toISOString());
    setGamesPlayedToday(count || 0);
    setLimitLoading(false);
  }

  const onAdWatched = useCallback(() => {
    setTarget(Math.floor(Math.random() * 10) + 1);
    setGuess(null);
    setActiveTier(null);
    setProxPct(0);
    setPhase('guessing');
  }, []);

  const { showAd } = useRewardedAd(onAdWatched);

  const handleUnlock = async () => {
    if (isMaxed) return;
    setPhase('loading');
    const ok = await showAd();
    if (!ok) setPhase('locked');
  };

  const handleGuess = async (n: number) => {
    if (!user || phase !== 'guessing') return;
    triggerHaptic('impact');

    const diff = Math.abs(n - target);
    const tier = getTier(diff);
    const pct  = Math.max(5, Math.round(100 - (diff / 9) * 95));

    setGuess(n);
    setReward(tier.pts);
    setActiveTier(tier);
    setProxPct(pct);
    setPhase('result');

    /* Count game */
    setGamesPlayedToday(p => p + 1);
    triggerHaptic(diff === 0 ? 'success' : diff <= 2 ? 'success' : 'error');

    if (user) {
      const { data: bal } = await supabase
        .from('balances').select('points,total_earned').eq('user_id', user.id).single();
      if (bal) {
        await supabase.from('balances').update({
          points: bal.points + tier.pts,
          total_earned: bal.total_earned + tier.pts,
        }).eq('user_id', user.id);
        await supabase.from('transactions').insert({
          user_id: user.id, type: 'number_guess', points: tier.pts,
          description: `🎯 Number Guess: ${tier.label} (picked ${n}, answer ${target}) +${tier.pts} pts`,
        });
      }
      refreshBalance();
    }
  };

  const tier = activeTier;
  const diff = guess !== null ? Math.abs(guess - target) : 0;
  const nextRemaining = MAX_DAILY_GAMES - gamesPlayedToday;

  return (
    <>
      <style>{CSS}</style>
      <div className="ng-root">
        <div className="ng-radar-bg"/>
        <div className="ng-scanline"/>

        <div className="ng-content">
          <div className="ng-eyebrow">Radar · Guess</div>
          <div className="ng-title">NUMBER<br/>GUESS</div>
          <div className="ng-subtitle">Pick 1–10 · Closer = more points</div>

          {/* ── Daily limit pips ── */}
          <div className="ng-limit-wrap">
            <div className="ng-limit-label">
              Daily Guesses &nbsp;
              <span>{limitLoading ? '...' : `${remaining} left`}</span>
            </div>
            <div className="ng-pips">
              {Array.from({ length: MAX_DAILY_GAMES }, (_, i) => (
                <div key={i}
                  className={`ng-pip ${i < gamesPlayedToday ? 'used' : 'avail'}`}
                  style={{ animationDelay:`${i * 0.06}s` }}
                />
              ))}
            </div>
          </div>

          {/* ── Maxed banner ── */}
          {isMaxed && (
            <div className="ng-maxed">
              <div className="ng-maxed-icon">🔒</div>
              <div className="ng-maxed-title">DAILY LIMIT REACHED</div>
              <div className="ng-maxed-sub">Come back tomorrow for 5 more guesses</div>
            </div>
          )}

          {/* Sonar ring */}
          {phase === 'guessing' && <SonarRing active={true} color="#22d3ee"/>}
          {phase === 'result' && tier && <SonarRing active={true} color={tier.color}/>}

          {/* Arena */}
          <div className="ng-arena">
            {phase === 'result' && tier && (
              <div className="ng-arena-glow" style={{
                boxShadow:`0 0 40px ${tier.glow},inset 0 0 40px ${tier.glow}20`,
              }}/>
            )}

            {/* LOCKED */}
            {phase === 'locked' && (
              <>
                <div className="ng-idle-icon">🎯</div>
                <div className="ng-idle-text">
                  {isMaxed
                    ? "You've used all 5 guesses today.\nCome back tomorrow."
                    : `Watch a short ad to reveal\na hidden number (1–10) · ${remaining} play${remaining !== 1 ? 's' : ''} left`}
                </div>
                <button className="ng-btn ng-btn-cyan" onClick={handleUnlock}
                  disabled={isMaxed || limitLoading}>
                  {isMaxed ? '🔒  Daily Limit Reached' : '📺  Watch Ad to Play'}
                </button>
              </>
            )}

            {/* LOADING */}
            {phase === 'loading' && (
              <div className="ng-loading">
                <div style={{ fontSize:'10px', letterSpacing:'3px', color:'rgba(34,211,238,0.35)', marginBottom:'10px' }}>
                  LOADING AD
                </div>
                <div className="ng-loading-dots"><span/><span/><span/></div>
              </div>
            )}

            {/* GUESSING */}
            {phase === 'guessing' && (
              <>
                <div className="ng-hint">✦ Select your number ✦</div>
                <div className="ng-grid">
                  {Array.from({ length:10 }, (_,i) => i+1).map(n => (
                    <button key={n} className="ng-num-btn pickable"
                      onClick={() => handleGuess(n)}
                      style={{ background:'rgba(34,211,238,0.06)', border:'1px solid rgba(34,211,238,0.2)', color:'rgba(255,255,255,0.7)' }}>
                      {n}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* RESULT */}
            {phase === 'result' && tier && guess !== null && (
              <>
                <div className="ng-compare">
                  <div className="ng-compare-box">
                    <div className="ng-compare-label">Your Pick</div>
                    <div className="ng-compare-num" style={{ color:'rgba(255,255,255,0.8)' }}>{guess}</div>
                  </div>
                  <div className="ng-compare-arrow">vs</div>
                  <div className="ng-compare-box">
                    <div className="ng-compare-label">Answer</div>
                    <div className="ng-compare-num" style={{ color:tier.color, textShadow:`0 0 20px ${tier.color}` }}>
                      {target}
                    </div>
                  </div>
                </div>

                <div className="ng-grid" style={{ marginBottom:'20px' }}>
                  {Array.from({ length:10 }, (_,i) => i+1).map(n => {
                    const h = heatColor(n, target, true);
                    const isGuess  = n === guess;
                    const isTarget = n === target;
                    return (
                      <div key={n}
                        className={`ng-num-btn ${isTarget ? 'target' : ''} ${isGuess ? 'selected' : ''}`}
                        style={{
                          background:h.bg, border:`1px solid ${h.border}`,
                          color:h.color, boxShadow:h.shadow,
                          animationDelay: isTarget ? '0.1s' : '0s',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontFamily:"'Black Ops One',sans-serif", fontSize:'20px',
                          aspectRatio:'1', borderRadius:'14px',
                        }}>
                        {n}
                      </div>
                    );
                  })}
                </div>

                <div style={{ textAlign:'center', marginBottom:'12px' }}>
                  <div className="ng-tier-pill" style={{
                    background:`${tier.color}12`, border:`1px solid ${tier.color}35`, color:tier.color,
                  }}>
                    {tier.label}
                    {diff > 0 && <span style={{ opacity:0.6, fontSize:'12px' }}> · Off by {diff}</span>}
                  </div>
                </div>

                <div className="ng-prox-wrap">
                  <div className="ng-prox-label">
                    <span>Proximity</span>
                    <span style={{ color:tier.color }}>{proxPct}%</span>
                  </div>
                  <div className="ng-prox-track">
                    <div className="ng-prox-fill" style={{
                      width:`${proxPct}%`,
                      background:`linear-gradient(90deg,${tier.color}80,${tier.color})`,
                      boxShadow:`0 0 8px ${tier.color}60`,
                    }}/>
                  </div>
                </div>

                <div className="ng-pts">
                  <div className="ng-pts-num" style={{
                    background:`linear-gradient(135deg,${tier.color},#ffffff)`,
                    WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
                    filter:`drop-shadow(0 0 20px ${tier.color})`,
                  }}>+{reward}</div>
                  <div className="ng-pts-label">Points Earned</div>
                </div>

                {/* Remaining + Play again */}
                <div style={{ textAlign:'center' }}>
                  <div className="ng-remaining" style={{
                    background: nextRemaining <= 0 ? 'rgba(239,68,68,0.08)' : 'rgba(34,211,238,0.06)',
                    border:`1px solid ${nextRemaining <= 0 ? 'rgba(239,68,68,0.2)' : 'rgba(34,211,238,0.15)'}`,
                    color: nextRemaining <= 0 ? '#ef4444' : 'rgba(255,255,255,0.4)',
                  }}>
                    {nextRemaining <= 0
                      ? '🔒 No guesses remaining today'
                      : `${nextRemaining} guess${nextRemaining !== 1 ? 'es' : ''} remaining today`}
                  </div>
                </div>

                <button
                  className="ng-btn ng-btn-gold"
                  onClick={handleUnlock}
                  disabled={nextRemaining <= 0}
                  style={nextRemaining <= 0 ? {
                    background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.3)',
                    boxShadow:'none', cursor:'not-allowed',
                  } : {}}
                >
                  {nextRemaining <= 0 ? '🔒  COME BACK TOMORROW' : '📺  Play Again'}
                </button>
              </>
            )}
          </div>

          {/* Reward table */}
          <div className="ng-table">
            <div className="ng-table-title">Reward Table</div>
            {TIERS.map((t,i) => (
              <div key={i} className="ng-table-row">
                <div className="ng-table-diff" style={{ background:`${t.color}12`, border:`1px solid ${t.color}25`, color:t.color }}>
                  {i === 0 ? '=0' : i === TIERS.length-1 ? '5+' : `±${t.diff}`}
                </div>
                <div className="ng-table-info">
                  <div className="ng-table-label" style={{ color:t.color }}>{t.label}</div>
                  <div className="ng-table-sub">{t.sublabel}</div>
                </div>
                <div className="ng-table-pts" style={{ color:t.color }}>{t.pts} pts</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
