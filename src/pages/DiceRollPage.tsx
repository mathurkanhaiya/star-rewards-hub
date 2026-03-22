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

/* ── Reward tiers ── */
const REWARD_TIERS = [
  { min: 12, max: 12, pts: 100, label: 'PERFECT ROLL',  color: '#fbbf24', glow: 'rgba(251,191,36,0.7)'  },
  { min: 10, max: 11, pts: 60,  label: 'GREAT ROLL',    color: '#4ade80', glow: 'rgba(74,222,128,0.6)'  },
  { min: 8,  max: 9,  pts: 40,  label: 'SOLID ROLL',    color: '#22d3ee', glow: 'rgba(34,211,238,0.5)'  },
  { min: 6,  max: 7,  pts: 25,  label: 'GOOD ROLL',     color: '#a78bfa', glow: 'rgba(167,139,250,0.5)' },
  { min: 2,  max: 5,  pts: 10,  label: 'LOW ROLL',      color: '#94a3b8', glow: 'rgba(148,163,184,0.4)' },
];

function getTier(sum: number) {
  return REWARD_TIERS.find(t => sum >= t.min && sum <= t.max) || REWARD_TIERS[4];
}

function calcReward(d1: number, d2: number) { return getTier(d1 + d2).pts; }

/* ── SVG Dice Face ── */
function DieFace({ value, rolling, color = '#ffffff' }: { value: number; rolling: boolean; color?: string }) {
  const dots: [number, number][] = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [75, 25], [25, 75], [75, 75]],
    5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
    6: [[25, 20], [75, 20], [25, 50], [75, 50], [25, 80], [75, 80]],
  }[value] || [[50, 50]];

  return (
    <div style={{
      width: '100%', height: '100%',
      borderRadius: '20px',
      background: 'linear-gradient(145deg, #1e2535, #0f1420)',
      border: `2px solid ${color}40`,
      boxShadow: rolling
        ? `0 0 30px ${color}60, inset 0 1px 0 rgba(255,255,255,0.1)`
        : `0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.05)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
      transition: 'box-shadow 0.3s ease',
    }}>
      {/* Top highlight */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
        borderRadius: '18px 18px 0 0',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />
      <svg viewBox="0 0 100 100" width="80%" height="80%">
        {dots.map(([cx, cy], i) => (
          <circle
            key={i} cx={cx} cy={cy} r={8}
            fill={color}
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          />
        ))}
      </svg>
    </div>
  );
}

/* ── Rolling number counter ── */
function RollingNumber({ target, rolling }: { target: number; rolling: boolean }) {
  const [display, setDisplay] = useState(target);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (rolling) {
      intervalRef.current = setInterval(() => {
        setDisplay(Math.floor(Math.random() * 11) + 2);
      }, 80);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setDisplay(target);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [rolling, target]);

  return <>{display}</>;
}

/* ── CSS ── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Teko:wght@400;500;600;700&family=Barlow:wght@400;500;600&display=swap');

.dr-root {
  font-family: 'Barlow', sans-serif;
  background: #05080f;
  min-height: 100vh;
  padding: 20px 16px 112px;
  position: relative;
  overflow: hidden;
  color: #fff;
}

/* Felt texture overlay */
.dr-felt {
  position: fixed;
  inset: 0;
  background-image:
    radial-gradient(ellipse 120% 60% at 50% 0%, rgba(34,197,94,0.04) 0%, transparent 60%),
    radial-gradient(ellipse 80% 40% at 80% 100%, rgba(251,191,36,0.04) 0%, transparent 60%);
  pointer-events: none;
  z-index: 0;
}

/* Dot grid */
.dr-dots {
  position: fixed;
  inset: 0;
  background-image: radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px);
  background-size: 28px 28px;
  pointer-events: none;
  z-index: 0;
}

.dr-content { position: relative; z-index: 1; }

/* Title */
.dr-eyebrow {
  text-align: center;
  font-size: 10px;
  letter-spacing: 5px;
  color: rgba(255,255,255,0.2);
  text-transform: uppercase;
  margin-bottom: 6px;
}
.dr-title {
  font-family: 'Teko', sans-serif;
  font-size: 52px;
  font-weight: 700;
  letter-spacing: 3px;
  text-align: center;
  line-height: 1;
  color: #fff;
  text-shadow: 0 0 40px rgba(255,255,255,0.15);
  margin-bottom: 6px;
}
.dr-subtitle {
  text-align: center;
  font-size: 12px;
  color: rgba(255,255,255,0.25);
  letter-spacing: 1px;
  margin-bottom: 28px;
}

/* Reward strip */
.dr-strip {
  display: flex;
  gap: 6px;
  margin-bottom: 24px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}
.dr-strip::-webkit-scrollbar { display: none; }
.dr-strip-item {
  flex-shrink: 0;
  text-align: center;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  min-width: 62px;
}
.dr-strip-sum {
  font-family: 'Teko', sans-serif;
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
}
.dr-strip-pts {
  font-size: 9px;
  letter-spacing: 1px;
  color: rgba(255,255,255,0.3);
  margin-top: 1px;
}

/* Main arena */
.dr-arena {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 28px;
  padding: 28px 20px;
  margin-bottom: 16px;
  position: relative;
  overflow: hidden;
}
.dr-arena::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
}

/* Dice row */
.dr-dice-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-bottom: 20px;
}
.dr-die-wrap {
  width: 110px;
  height: 110px;
  transition: transform 0.15s;
}
.dr-die-wrap.rolling {
  animation: drRollAnim 0.15s ease-in-out infinite alternate;
}
@keyframes drRollAnim {
  from { transform: rotate(-8deg) scale(1.02); }
  to   { transform: rotate(8deg)  scale(0.98); }
}

.dr-plus {
  font-family: 'Teko', sans-serif;
  font-size: 36px;
  color: rgba(255,255,255,0.15);
  line-height: 1;
}

/* Sum display */
.dr-sum-wrap {
  text-align: center;
  margin-bottom: 24px;
  height: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.dr-sum-label {
  font-size: 10px;
  letter-spacing: 3px;
  color: rgba(255,255,255,0.2);
  text-transform: uppercase;
  margin-bottom: 2px;
}
.dr-sum-val {
  font-family: 'Teko', sans-serif;
  font-size: 48px;
  font-weight: 700;
  line-height: 1;
  transition: color 0.3s, text-shadow 0.3s;
}

/* Tier banner */
.dr-tier-banner {
  text-align: center;
  margin-bottom: 20px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dr-tier-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 16px;
  border-radius: 20px;
  font-family: 'Teko', sans-serif;
  font-size: 18px;
  letter-spacing: 2px;
  animation: drTierPop 0.4s cubic-bezier(0.34,1.56,0.64,1);
}
@keyframes drTierPop {
  from { transform: scale(0.5); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}

/* Points reveal */
.dr-pts-wrap {
  text-align: center;
  margin-bottom: 24px;
}
.dr-pts-val {
  font-family: 'Teko', sans-serif;
  font-size: 64px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 2px;
  animation: drPtsPop 0.5s cubic-bezier(0.34,1.56,0.64,1);
}
@keyframes drPtsPop {
  from { transform: scale(0.6) translateY(10px); opacity: 0; }
  to   { transform: scale(1)   translateY(0);    opacity: 1; }
}
.dr-pts-label {
  font-size: 12px;
  letter-spacing: 3px;
  color: rgba(255,255,255,0.3);
  text-transform: uppercase;
}

/* Buttons */
.dr-btn {
  width: 100%;
  padding: 18px;
  border-radius: 16px;
  border: none;
  font-family: 'Teko', sans-serif;
  font-size: 22px;
  letter-spacing: 2px;
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.2s;
  display: block;
  position: relative;
  overflow: hidden;
}
.dr-btn::after {
  content: '';
  position: absolute;
  top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  animation: drShine 3s ease-in-out infinite;
}
@keyframes drShine { 0%{left:-100%} 40%,100%{left:150%} }
.dr-btn:active { transform: scale(0.97); }
.dr-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.dr-btn-gold {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 60%, #d97706 100%);
  color: #1a0a00;
  box-shadow: 0 6px 32px rgba(251,191,36,0.35);
}
.dr-btn-cyan {
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 60%, #0e7490 100%);
  color: #001a20;
  box-shadow: 0 6px 32px rgba(6,182,212,0.35);
}
.dr-btn-ghost {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.5);
  font-size: 16px;
  letter-spacing: 1px;
  margin-top: 8px;
}
.dr-btn-ghost::after { display: none; }

/* Loading dots */
.dr-loading {
  text-align: center;
  padding: 16px 0;
}
.dr-loading-dots span {
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #fbbf24;
  margin: 0 4px;
  animation: drDot 1.2s ease-in-out infinite;
}
.dr-loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.dr-loading-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes drDot { 0%,80%,100%{transform:scale(0.5);opacity:0.3} 40%{transform:scale(1);opacity:1} }

/* Glow ring on result */
.dr-result-glow {
  position: absolute;
  inset: -1px;
  border-radius: 28px;
  pointer-events: none;
  transition: box-shadow 0.5s ease;
}
`;

export default function DiceRollPage() {
  const { user, refreshBalance } = useApp();
  const [phase, setPhase] = useState<'locked' | 'loading' | 'rolling' | 'result'>('locked');
  const [dice, setDice] = useState<[number, number]>([6, 6]);
  const [reward, setReward] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [activeTier, setActiveTier] = useState<typeof REWARD_TIERS[0] | null>(null);
  const [displayDice, setDisplayDice] = useState<[number, number]>([6, 6]);
  const shuffleRef = useRef<NodeJS.Timeout | null>(null);

  const onAdWatched = useCallback(() => { setPhase('rolling'); }, []);
  const { showAd } = useRewardedAd(onAdWatched);

  const handleUnlock = async () => {
    setPhase('loading');
    const ok = await showAd();
    if (!ok) setPhase('locked');
  };

  /* Shuffle dice faces during roll */
  useEffect(() => {
    if (rolling) {
      shuffleRef.current = setInterval(() => {
        setDisplayDice([
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
        ]);
      }, 80);
    } else {
      if (shuffleRef.current) clearInterval(shuffleRef.current);
      setDisplayDice(dice);
    }
    return () => { if (shuffleRef.current) clearInterval(shuffleRef.current); };
  }, [rolling, dice]);

  const handleRoll = async () => {
    if (!user || rolling) return;
    triggerHaptic('impact');
    setRolling(true);
    setActiveTier(null);

    await new Promise(r => setTimeout(r, 1400));

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const pts = calcReward(d1, d2);
    const tier = getTier(d1 + d2);

    setDice([d1, d2]);
    setReward(pts);
    setRolling(false);
    setActiveTier(tier);
    setPhase('result');

    triggerHaptic(pts >= 60 ? 'success' : 'impact');

    await supabase.functions.invoke('log-ad', {
      body: { userId: user.id, adType: 'dice_roll', rewardGiven: pts },
    });
    refreshBalance();
  };

  const sum = dice[0] + dice[1];
  const tier = activeTier;

  return (
    <>
      <style>{CSS}</style>
      <div className="dr-root">
        <div className="dr-felt" />
        <div className="dr-dots" />

        <div className="dr-content">
          {/* Title */}
          <div className="dr-eyebrow">Casino · Rewards</div>
          <div className="dr-title">DICE ROLL</div>
          <div className="dr-subtitle">Roll two dice · Earn up to 100 points</div>

          {/* Reward strip */}
          <div className="dr-strip">
            {REWARD_TIERS.map((t, i) => (
              <div key={i} className="dr-strip-item"
                style={tier?.pts === t.pts && phase === 'result' ? {
                  borderColor: `${t.color}60`,
                  background: `${t.color}10`,
                } : {}}>
                <div className="dr-sum-val dr-strip-sum" style={{ color: t.color, fontSize: '18px' }}>
                  {t.min === t.max ? t.min : `${t.min}–${t.max}`}
                </div>
                <div className="dr-strip-pts">{t.pts} PTS</div>
              </div>
            ))}
          </div>

          {/* Arena */}
          <div className="dr-arena">
            {/* Glow ring on result */}
            {phase === 'result' && tier && (
              <div className="dr-result-glow"
                style={{ boxShadow: `0 0 40px ${tier.glow}, inset 0 0 40px ${tier.glow}20` }} />
            )}

            {/* Dice */}
            <div className="dr-dice-row">
              <div className={`dr-die-wrap ${rolling ? 'rolling' : ''}`}>
                <DieFace
                  value={displayDice[0]}
                  rolling={rolling}
                  color={phase === 'result' && tier ? tier.color : '#ffffff'}
                />
              </div>
              <div className="dr-plus">+</div>
              <div className={`dr-die-wrap ${rolling ? 'rolling' : ''}`}
                style={{ animationDirection: 'alternate-reverse' }}>
                <DieFace
                  value={displayDice[1]}
                  rolling={rolling}
                  color={phase === 'result' && tier ? tier.color : '#ffffff'}
                />
              </div>
            </div>

            {/* Sum */}
            <div className="dr-sum-wrap">
              {(phase === 'rolling' || phase === 'result') && (
                <>
                  <div className="dr-sum-label">Total</div>
                  <div className="dr-sum-val"
                    style={{ color: phase === 'result' && tier ? tier.color : 'rgba(255,255,255,0.6)' }}>
                    <RollingNumber target={sum} rolling={rolling} />
                  </div>
                </>
              )}
            </div>

            {/* Tier banner */}
            <div className="dr-tier-banner">
              {phase === 'result' && tier && (
                <div className="dr-tier-pill"
                  style={{ background: `${tier.color}15`, border: `1px solid ${tier.color}40`, color: tier.color }}>
                  {tier.label}
                </div>
              )}
            </div>

            {/* Points */}
            {phase === 'result' && tier && (
              <div className="dr-pts-wrap">
                <div className="dr-pts-val" style={{
                  background: `linear-gradient(135deg, ${tier.color}, #fff)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: `drop-shadow(0 0 20px ${tier.color})`,
                }}>
                  +{reward}
                </div>
                <div className="dr-pts-label">Points Earned</div>
              </div>
            )}

            {/* Buttons */}
            {phase === 'locked' && (
              <button className="dr-btn dr-btn-gold" onClick={handleUnlock}>
                📺 &nbsp;WATCH AD TO PLAY
              </button>
            )}

            {phase === 'loading' && (
              <div className="dr-loading">
                <div style={{ fontSize: '11px', letterSpacing: '3px', color: 'rgba(255,255,255,0.25)', marginBottom: '10px' }}>
                  LOADING AD
                </div>
                <div className="dr-loading-dots">
                  <span /><span /><span />
                </div>
              </div>
            )}

            {phase === 'rolling' && !rolling && (
              <button className="dr-btn dr-btn-cyan" onClick={handleRoll} disabled={rolling}>
                🎲 &nbsp;ROLL THE DICE
              </button>
            )}

            {phase === 'rolling' && rolling && (
              <div className="dr-loading">
                <div style={{ fontSize: '11px', letterSpacing: '3px', color: 'rgba(255,255,255,0.25)', marginBottom: '10px' }}>
                  ROLLING...
                </div>
                <div className="dr-loading-dots">
                  <span /><span /><span />
                </div>
              </div>
            )}

            {phase === 'result' && (
              <button className="dr-btn dr-btn-gold" onClick={handleUnlock}>
                📺 &nbsp;ROLL AGAIN
              </button>
            )}
          </div>

          {/* Reward table */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '18px',
            padding: '16px',
          }}>
            <div style={{ fontSize: '9px', letterSpacing: '3px', color: 'rgba(255,255,255,0.2)', marginBottom: '12px', textTransform: 'uppercase' }}>
              Reward Table
            </div>
            {REWARD_TIERS.map((t, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 0',
                borderBottom: i < REWARD_TIERS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: `${t.color}12`,
                  border: `1px solid ${t.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Teko', sans-serif", fontSize: '16px', fontWeight: '700', color: t.color,
                }}>
                  {t.min === t.max ? t.min : `${t.min}+`}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>{t.label}</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', letterSpacing: '1px' }}>
                    Sum {t.min === t.max ? t.min : `${t.min}–${t.max}`}
                  </div>
                </div>
                <div style={{
                  fontFamily: "'Teko', sans-serif", fontSize: '22px', fontWeight: '700',
                  color: t.color, letterSpacing: '1px',
                }}>
                  {t.pts} PTS
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
