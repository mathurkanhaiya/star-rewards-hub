import React, { useState, useCallback, useRef, useEffect } from 'react';
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

const SYMBOLS = [
  { emoji: '💎', name: 'Diamond', color: '#67e8f9' },
  { emoji: '🌟', name: 'Star',    color: '#fde68a' },
  { emoji: '🔥', name: 'Fire',    color: '#fb923c' },
  { emoji: '🍀', name: 'Clover',  color: '#4ade80' },
  { emoji: '💰', name: 'Gold',    color: '#fbbf24' },
  { emoji: '🎯', name: 'Target',  color: '#f472b6' },
  { emoji: '🏆', name: 'Trophy',  color: '#fbbf24' },
  { emoji: '⚡', name: 'Storm',   color: '#a78bfa' },
];

type MatchType = 'triple' | 'pair' | 'none';
interface CardSymbol { emoji: string; name: string; color: string; }

const MAX_DAILY_GAMES = 5;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Jost:wght@400;500;600&display=swap');

@keyframes cfTwinkle  { 0%,100%{opacity:0.05;transform:scale(0.8)} 50%{opacity:0.5;transform:scale(1.2)} }
@keyframes cfRuneFloat{ 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-8px) scale(1.05)} }
@keyframes cfShineBack{ 0%{left:-100%} 30%,100%{left:160%} }
@keyframes cfCardShake{ 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px) rotate(-2deg)} 75%{transform:translateX(6px) rotate(2deg)} }
@keyframes cfBtnShine { 0%{left:-100%} 40%,100%{left:150%} }
@keyframes cfDot      { 0%,80%,100%{transform:scale(0.5);opacity:0.3} 40%{transform:scale(1);opacity:1} }
@keyframes cfPulse    { 0%,100%{opacity:0.5} 50%{opacity:1} }
@keyframes cfMatchPop { from{transform:scale(0.4) translateY(10px);opacity:0} to{transform:scale(1) translateY(0);opacity:1} }
@keyframes cfPtsPop   { from{transform:scale(0.5);opacity:0} to{transform:scale(1);opacity:1} }
@keyframes cfPipPop   { from{transform:scale(0.5);opacity:0} to{transform:scale(1);opacity:1} }
@keyframes cfLimitPulse{ 0%,100%{opacity:0.5} 50%{opacity:1} }

.cf-root {
  font-family:'Jost',sans-serif; background:#08060f; min-height:100vh;
  padding:20px 16px 112px; position:relative; overflow:hidden; color:#fff;
}
.cf-bg {
  position:fixed; inset:0;
  background:
    radial-gradient(ellipse 100% 50% at 50% 0%,rgba(139,92,246,0.08) 0%,transparent 60%),
    radial-gradient(ellipse 60% 40% at 20% 80%,rgba(236,72,153,0.05) 0%,transparent 50%),
    radial-gradient(ellipse 60% 40% at 80% 80%,rgba(99,102,241,0.05) 0%,transparent 50%);
  pointer-events:none; z-index:0;
}
.cf-stars { position:fixed; inset:0; pointer-events:none; z-index:0; }
.cf-star  { position:absolute; border-radius:50%; background:#fff; animation:cfTwinkle var(--dur) ease-in-out infinite var(--delay); }
.cf-content { position:relative; z-index:1; }

.cf-eyebrow { text-align:center; font-size:10px; letter-spacing:6px; color:rgba(167,139,250,0.5); text-transform:uppercase; margin-bottom:6px; }
.cf-title   { font-family:'Cormorant Garamond',serif; font-size:46px; font-weight:700; text-align:center; line-height:1; letter-spacing:3px; background:linear-gradient(135deg,#c4b5fd,#a78bfa,#818cf8); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; filter:drop-shadow(0 0 24px rgba(167,139,250,0.4)); margin-bottom:4px; }
.cf-subtitle{ text-align:center; font-size:12px; color:rgba(255,255,255,0.2); letter-spacing:2px; margin-bottom:24px; }

/* ── Daily limit pips ── */
.cf-limit-wrap  { display:flex; flex-direction:column; align-items:center; gap:8px; margin-bottom:18px; }
.cf-limit-label { font-family:'Jost',sans-serif; font-size:11px; letter-spacing:2px; color:rgba(255,255,255,0.25); text-transform:uppercase; display:flex; align-items:center; gap:6px; }
.cf-limit-label span { color:#a78bfa; font-weight:700; }
.cf-pips { display:flex; gap:7px; }
.cf-pip-limit {
  width:28px; height:8px; border-radius:4px;
  transition:background 0.3s,box-shadow 0.3s;
  animation:cfPipPop 0.3s ease both;
}
.cf-pip-limit.used  { background:#a78bfa; box-shadow:0 0 8px rgba(167,139,250,0.5); }
.cf-pip-limit.avail { background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); }

/* ── Maxed banner ── */
.cf-maxed { background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.2); border-radius:16px; padding:16px; text-align:center; margin-bottom:16px; position:relative; overflow:hidden; }
.cf-maxed::before { content:''; position:absolute; top:0; left:10%; right:10%; height:1px; background:linear-gradient(90deg,transparent,rgba(239,68,68,0.35),transparent); }
.cf-maxed-icon  { font-size:36px; margin-bottom:8px; animation:cfLimitPulse 2s ease-in-out infinite; }
.cf-maxed-title { font-family:'Cormorant Garamond',serif; font-size:18px; color:#ef4444; margin-bottom:4px; }
.cf-maxed-sub   { font-size:12px; color:rgba(255,255,255,0.3); letter-spacing:1px; }

/* 3D card */
.cf-card-scene { perspective:800px; width:100px; height:148px; cursor:pointer; flex-shrink:0; }
.cf-card-scene.flipped .cf-card-inner { transform:rotateY(180deg); }
.cf-card-inner { position:relative; width:100%; height:100%; transform-style:preserve-3d; transition:transform 0.55s cubic-bezier(0.45,0.05,0.55,0.95); }
.cf-card-face  { position:absolute; inset:0; border-radius:16px; backface-visibility:hidden; -webkit-backface-visibility:hidden; display:flex; align-items:center; justify-content:center; flex-direction:column; }

.cf-card-back { background:linear-gradient(145deg,#1a0e2e,#12082a); border:1px solid rgba(167,139,250,0.25); box-shadow:0 8px 32px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.06); overflow:hidden; }
.cf-card-back::before { content:''; position:absolute; inset:8px; border:1px solid rgba(167,139,250,0.15); border-radius:10px; background:repeating-linear-gradient(45deg,rgba(167,139,250,0.03) 0px,rgba(167,139,250,0.03) 1px,transparent 1px,transparent 8px),repeating-linear-gradient(-45deg,rgba(167,139,250,0.03) 0px,rgba(167,139,250,0.03) 1px,transparent 1px,transparent 8px); }
.cf-card-back-symbol { font-size:28px; position:relative; z-index:1; opacity:0.4; filter:grayscale(0.5); }
.cf-card-back-shine  { position:absolute; top:0; left:-100%; width:50%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent); animation:cfShineBack 4s ease-in-out infinite; }
.cf-card-front  { transform:rotateY(180deg); border:1px solid rgba(255,255,255,0.15); box-shadow:0 8px 32px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.1); }
.cf-card-symbol { font-size:44px; line-height:1; margin-bottom:8px; }
.cf-card-name   { font-family:'Jost',sans-serif; font-size:9px; letter-spacing:2px; text-transform:uppercase; opacity:0.6; }

.cf-cards-row { display:flex; justify-content:center; gap:16px; margin-bottom:28px; }

.cf-arena { background:rgba(255,255,255,0.02); border:1px solid rgba(167,139,250,0.12); border-radius:28px; padding:28px 20px; margin-bottom:16px; position:relative; overflow:hidden; }
.cf-arena::before { content:''; position:absolute; top:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,rgba(167,139,250,0.4),transparent); }

.cf-idle-rune { font-size:56px; text-align:center; margin-bottom:14px; animation:cfRuneFloat 4s ease-in-out infinite; filter:drop-shadow(0 0 20px rgba(167,139,250,0.5)); }
.cf-idle-text { font-size:13px; color:rgba(255,255,255,0.3); text-align:center; letter-spacing:1px; line-height:1.6; margin-bottom:20px; }
.cf-tap-hint  { text-align:center; font-size:11px; letter-spacing:3px; color:rgba(167,139,250,0.5); text-transform:uppercase; margin-bottom:20px; animation:cfPulse 2s ease-in-out infinite; }

.cf-progress { display:flex; justify-content:center; gap:8px; margin-bottom:16px; }
.cf-pip { width:28px; height:4px; border-radius:2px; background:rgba(255,255,255,0.08); transition:background 0.3s; }
.cf-pip.done { background:rgba(167,139,250,0.7); box-shadow:0 0 6px rgba(167,139,250,0.5); }

.cf-match-banner { text-align:center; margin-bottom:16px; }
.cf-match-label  { display:inline-block; font-family:'Cormorant Garamond',serif; font-size:28px; font-weight:700; letter-spacing:2px; padding:6px 24px; border-radius:12px; animation:cfMatchPop 0.5s cubic-bezier(0.34,1.56,0.64,1); }

.cf-pts       { text-align:center; margin-bottom:24px; }
.cf-pts-num   { font-family:'Cormorant Garamond',serif; font-size:72px; font-weight:700; line-height:1; letter-spacing:2px; animation:cfPtsPop 0.5s 0.15s cubic-bezier(0.34,1.56,0.64,1) both; }
.cf-pts-label { font-size:11px; letter-spacing:4px; color:rgba(255,255,255,0.25); text-transform:uppercase; }

.cf-remaining-pill {
  display:inline-flex; align-items:center; gap:5px;
  padding:6px 14px; border-radius:20px; margin-bottom:14px;
  font-size:12px; letter-spacing:0.5px;
}

.cf-btn { width:100%; padding:18px; border-radius:16px; border:none; font-family:'Jost',sans-serif; font-size:15px; font-weight:700; letter-spacing:2px; text-transform:uppercase; cursor:pointer; transition:transform 0.1s,box-shadow 0.2s; display:block; position:relative; overflow:hidden; }
.cf-btn::after { content:''; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent); animation:cfBtnShine 3s ease-in-out infinite; }
.cf-btn:active { transform:scale(0.97); }
.cf-btn-purple { background:linear-gradient(135deg,#8b5cf6,#7c3aed,#6d28d9); color:#fff; box-shadow:0 6px 32px rgba(139,92,246,0.4); }
.cf-btn-gold   { background:linear-gradient(135deg,#fbbf24,#f59e0b,#d97706); color:#1a0e00; box-shadow:0 6px 32px rgba(251,191,36,0.35); }
.cf-btn:disabled { opacity:0.4; cursor:not-allowed; }
.cf-btn:disabled::after { display:none; }
.cf-btn-ghost  { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); color:rgba(255,255,255,0.4); margin-top:8px; font-size:13px; }
.cf-btn-ghost::after { display:none; }

.cf-loading { text-align:center; padding:16px 0; }
.cf-loading-dots span { display:inline-block; width:8px; height:8px; border-radius:50%; background:#a78bfa; margin:0 4px; animation:cfDot 1.2s ease-in-out infinite; }
.cf-loading-dots span:nth-child(2){animation-delay:0.2s} .cf-loading-dots span:nth-child(3){animation-delay:0.4s}

.cf-arena-glow { position:absolute; inset:-1px; border-radius:28px; pointer-events:none; transition:box-shadow 0.5s; }

.cf-reward-table { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:18px; padding:16px; }
.cf-rt-title { font-size:9px; letter-spacing:3px; color:rgba(255,255,255,0.2); text-transform:uppercase; margin-bottom:12px; }
.cf-rt-row   { display:flex; align-items:center; gap:12px; padding:9px 0; border-bottom:1px solid rgba(255,255,255,0.04); }
.cf-rt-row:last-child { border-bottom:none; }
.cf-rt-icon  { width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }
.cf-rt-label { flex:1; }
.cf-rt-name  { font-size:14px; font-weight:600; margin-bottom:1px; }
.cf-rt-desc  { font-size:10px; color:rgba(255,255,255,0.25); letter-spacing:1px; }
.cf-rt-pts   { font-family:'Cormorant Garamond',serif; font-size:22px; font-weight:700; letter-spacing:1px; }
`;

const STARS = Array.from({ length: 20 }, () => ({
  left:  `${Math.random() * 100}%`,
  top:   `${Math.random() * 100}%`,
  size:  1 + Math.random() * 2,
  dur:   `${1.5 + Math.random() * 3}s`,
  delay: `${Math.random() * 3}s`,
}));

function Card({
  symbol, isFlipped, canFlip, onClick, delay,
}: {
  symbol: CardSymbol | null;
  isFlipped: boolean;
  canFlip: boolean;
  onClick: () => void;
  delay: number;
}) {
  return (
    <div
      className={`cf-card-scene ${isFlipped ? 'flipped' : ''}`}
      onClick={canFlip && !isFlipped ? onClick : undefined}
      style={{ animationDelay:`${delay}s`, cursor: canFlip && !isFlipped ? 'pointer' : 'default' }}
    >
      <div className="cf-card-inner">
        <div className="cf-card-face cf-card-back">
          <div className="cf-card-back-symbol">🔮</div>
          <div className="cf-card-back-shine"/>
        </div>
        <div className="cf-card-face cf-card-front"
          style={symbol ? {
            background:`linear-gradient(145deg,${symbol.color}18,${symbol.color}08)`,
            borderColor:`${symbol.color}40`,
            boxShadow:`0 8px 32px rgba(0,0,0,0.6),0 0 20px ${symbol.color}30,inset 0 1px 0 rgba(255,255,255,0.08)`,
          } : {}}
        >
          {symbol && (
            <>
              <div className="cf-card-symbol" style={{ filter:`drop-shadow(0 0 12px ${symbol.color})` }}>
                {symbol.emoji}
              </div>
              <div className="cf-card-name" style={{ color: symbol.color }}>{symbol.name}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const matchConfig = {
  triple: { label:'✦ Triple Match ✦', color:'#fbbf24', bg:'rgba(251,191,36,0.12)', border:'rgba(251,191,36,0.3)', glow:'rgba(251,191,36,0.5)' },
  pair:   { label:'◈ Pair Found ◈',   color:'#a78bfa', bg:'rgba(167,139,250,0.12)', border:'rgba(167,139,250,0.3)', glow:'rgba(167,139,250,0.5)' },
  none:   { label:'No Match',          color:'#94a3b8', bg:'rgba(148,163,184,0.08)', border:'rgba(148,163,184,0.2)', glow:'rgba(148,163,184,0.3)' },
};

export default function CardFlipPage() {
  const { user, refreshBalance } = useApp();
  const [phase, setPhase]       = useState<'locked'|'loading'|'picking'|'result'>('locked');
  const [cards, setCards]       = useState<CardSymbol[]>([]);
  const [flipped, setFlipped]   = useState<boolean[]>([false,false,false]);
  const [reward, setReward]     = useState(0);
  const [matchType, setMatchType]   = useState<MatchType>('none');
  const [resultColor, setResultColor] = useState('#fbbf24');
  const processingRef = useRef(false);

  /* ── Daily limit ── */
  const [gamesPlayedToday, setGamesPlayedToday] = useState(0);
  const [limitLoading, setLimitLoading]         = useState(true);
  const isMaxed = gamesPlayedToday >= MAX_DAILY_GAMES;
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
      .eq('type', 'card_flip')
      .gte('created_at', start.toISOString());
    setGamesPlayedToday(count || 0);
    setLimitLoading(false);
  }

  const onAdWatched = useCallback(() => {
    const picked = Array.from({ length:3 }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
    setCards(picked);
    setFlipped([false,false,false]);
    setPhase('picking');
    processingRef.current = false;
  }, []);

  const { showAd } = useRewardedAd(onAdWatched);

  const handleUnlock = async () => {
    if (isMaxed) return;
    setPhase('loading');
    const ok = await showAd();
    if (!ok) setPhase('locked');
  };

  const flipCard = async (i: number) => {
    if (flipped[i] || processingRef.current) return;
    triggerHaptic('impact');
    const next = [...flipped]; next[i] = true;
    setFlipped(next);

    if (next.every(Boolean)) {
      processingRef.current = true;
      await new Promise(r => setTimeout(r, 400));

      const unique = new Set(cards.map(c => c.emoji)).size;
      let pts: number; let match: MatchType; let color: string;

      if (unique === 1) {
        pts = 100; match = 'triple'; color = '#fbbf24'; triggerHaptic('success');
      } else if (unique === 2) {
        pts = 50; match = 'pair'; color = '#a78bfa'; triggerHaptic('success');
      } else {
        pts = 15 + Math.floor(Math.random() * 10);
        match = 'none'; color = '#94a3b8'; triggerHaptic('error');
      }

      setReward(pts); setMatchType(match); setResultColor(color);
      setPhase('result');

      /* Count this game + credit balance */
      setGamesPlayedToday(p => p + 1);

      if (user) {
        const { data: bal } = await supabase
          .from('balances').select('points,total_earned').eq('user_id', user.id).single();
        if (bal) {
          await supabase.from('balances').update({
            points: bal.points + pts,
            total_earned: bal.total_earned + pts,
          }).eq('user_id', user.id);
          await supabase.from('transactions').insert({
            user_id: user.id, type: 'card_flip', points: pts,
            description: `🃏 Card Flip: ${match === 'triple' ? 'Triple Match' : match === 'pair' ? 'Pair' : 'No Match'} +${pts} pts`,
          });
        }
        refreshBalance();
      }
    }
  };

  const flippedCount = flipped.filter(Boolean).length;
  const nextRemaining = MAX_DAILY_GAMES - gamesPlayedToday;

  return (
    <>
      <style>{CSS}</style>
      <div className="cf-root">
        <div className="cf-bg"/>
        <div className="cf-stars">
          {STARS.map((s,i) => (
            <div key={i} className="cf-star" style={{
              left:s.left, top:s.top, width:s.size, height:s.size,
              '--dur':s.dur, '--delay':s.delay,
            } as React.CSSProperties}/>
          ))}
        </div>

        <div className="cf-content">
          <div className="cf-eyebrow">Mystical · Cards</div>
          <div className="cf-title">Card Flip</div>
          <div className="cf-subtitle">Reveal the cards · Claim your fate</div>

          {/* ── Daily limit pips ── */}
          <div className="cf-limit-wrap">
            <div className="cf-limit-label">
              Daily Plays &nbsp;
              <span>{limitLoading ? '...' : `${remaining} left`}</span>
            </div>
            <div className="cf-pips">
              {Array.from({ length: MAX_DAILY_GAMES }, (_, i) => (
                <div key={i}
                  className={`cf-pip-limit ${i < gamesPlayedToday ? 'used' : 'avail'}`}
                  style={{ animationDelay:`${i * 0.06}s` }}
                />
              ))}
            </div>
          </div>

          {/* ── Maxed banner ── */}
          {isMaxed && (
            <div className="cf-maxed">
              <div className="cf-maxed-icon">🔒</div>
              <div className="cf-maxed-title">Daily Limit Reached</div>
              <div className="cf-maxed-sub">Come back tomorrow for 5 more plays</div>
            </div>
          )}

          {/* Arena */}
          <div className="cf-arena">
            {phase === 'result' && (
              <div className="cf-arena-glow" style={{
                boxShadow:`0 0 40px ${matchConfig[matchType].glow},inset 0 0 40px ${matchConfig[matchType].glow}20`,
              }}/>
            )}

            {/* LOCKED */}
            {phase === 'locked' && (
              <>
                <div className="cf-idle-rune">🔮</div>
                <div className="cf-idle-text">
                  {isMaxed
                    ? "You've used all 5 plays today.\nCome back tomorrow."
                    : `Watch a short ad to receive\nthree mystical cards · ${remaining} play${remaining !== 1 ? 's' : ''} remaining`}
                </div>
                <button
                  className="cf-btn cf-btn-purple"
                  onClick={handleUnlock}
                  disabled={isMaxed || limitLoading}
                >
                  {isMaxed ? '🔒  Daily Limit Reached' : '📺  Watch Ad to Play'}
                </button>
              </>
            )}

            {/* LOADING */}
            {phase === 'loading' && (
              <div className="cf-loading">
                <div style={{ fontSize:'11px', letterSpacing:'3px', color:'rgba(167,139,250,0.4)', marginBottom:'10px' }}>
                  SUMMONING AD
                </div>
                <div className="cf-loading-dots"><span/><span/><span/></div>
              </div>
            )}

            {/* PICKING / RESULT */}
            {(phase === 'picking' || phase === 'result') && (
              <>
                {phase === 'picking' && (
                  <div className="cf-tap-hint">
                    {flippedCount === 0 ? '✦ Choose a card to reveal ✦'
                      : flippedCount < 3 ? `${3 - flippedCount} card${3 - flippedCount > 1 ? 's' : ''} remaining`
                      : 'Revealing...'}
                  </div>
                )}
                {phase === 'picking' && (
                  <div className="cf-progress">
                    {[0,1,2].map(i => (
                      <div key={i} className={`cf-pip ${flipped[i] ? 'done' : ''}`}/>
                    ))}
                  </div>
                )}

                <div className="cf-cards-row">
                  {cards.map((sym,i) => (
                    <Card key={i} symbol={sym} isFlipped={flipped[i]}
                      canFlip={phase === 'picking'} onClick={() => flipCard(i)} delay={i * 0.08}/>
                  ))}
                </div>

                {phase === 'result' && (
                  <>
                    <div className="cf-match-banner">
                      <div className="cf-match-label" style={{
                        color: matchConfig[matchType].color,
                        background: matchConfig[matchType].bg,
                        border: `1px solid ${matchConfig[matchType].border}`,
                      }}>
                        {matchConfig[matchType].label}
                      </div>
                    </div>

                    <div className="cf-pts">
                      <div className="cf-pts-num" style={{
                        background:`linear-gradient(135deg,${resultColor},#ffffff)`,
                        WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
                        filter:`drop-shadow(0 0 16px ${resultColor})`,
                      }}>
                        +{reward}
                      </div>
                      <div className="cf-pts-label">Points Earned</div>
                    </div>

                    {/* Remaining plays */}
                    <div style={{ textAlign:'center', marginBottom:14 }}>
                      <div className="cf-remaining-pill" style={{
                        background: nextRemaining <= 0 ? 'rgba(239,68,68,0.08)' : 'rgba(167,139,250,0.08)',
                        border: `1px solid ${nextRemaining <= 0 ? 'rgba(239,68,68,0.2)' : 'rgba(167,139,250,0.2)'}`,
                        color: nextRemaining <= 0 ? '#ef4444' : 'rgba(255,255,255,0.4)',
                      }}>
                        {nextRemaining <= 0
                          ? '🔒 No plays remaining today'
                          : `${nextRemaining} play${nextRemaining !== 1 ? 's' : ''} remaining today`}
                      </div>
                    </div>

                    <button
                      className="cf-btn cf-btn-gold"
                      onClick={handleUnlock}
                      disabled={nextRemaining <= 0}
                      style={nextRemaining <= 0 ? {
                        background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.3)',
                        boxShadow:'none', cursor:'not-allowed',
                      } : {}}
                    >
                      {nextRemaining <= 0 ? '🔒  Come Back Tomorrow' : '📺  Play Again'}
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          {/* Reward table */}
          <div className="cf-reward-table">
            <div className="cf-rt-title">Reward Outcomes</div>
            {[
              { icon:'🏆', label:'Triple Match', desc:'All 3 cards identical', pts:100,      color:'#fbbf24' },
              { icon:'✨', label:'Pair Found',   desc:'Two cards match',       pts:50,       color:'#a78bfa' },
              { icon:'🃏', label:'No Match',     desc:'All different symbols', pts:'15–25',  color:'#94a3b8' },
            ].map((row,i) => (
              <div key={i} className="cf-rt-row">
                <div className="cf-rt-icon" style={{ background:`${row.color}12`, border:`1px solid ${row.color}25` }}>
                  {row.icon}
                </div>
                <div className="cf-rt-label">
                  <div className="cf-rt-name" style={{ color:row.color }}>{row.label}</div>
                  <div className="cf-rt-desc">{row.desc}</div>
                </div>
                <div className="cf-rt-pts" style={{
                  background:`linear-gradient(135deg,${row.color},#fff)`,
                  WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
                }}>
                  {row.pts} pts
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
