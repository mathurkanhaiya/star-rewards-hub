import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { spinWheel, logAdWatch, getSpinCount } from '@/lib/api';
import { useRewardedAd } from '@/hooks/useAdsgram';

/* =====================================================
   TELEGRAM EMOJI COMPONENT
===================================================== */
function TgEmoji({ id, size = 18 }: { id: string; size?: number }) {
  return (
    <tg-emoji
      emoji-id={id}
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
    />
  );
}

/* =====================================================
   TELEGRAM HAPTIC SAFE CALL
===================================================== */
function triggerHaptic(type: 'success' | 'error' | 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;
    if (tg?.HapticFeedback) {
      if (type === 'impact') tg.HapticFeedback.impactOccurred('medium');
      if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
      if (type === 'error') tg.HapticFeedback.notificationOccurred('error');
    }
  }
}

/* =====================================================
   SEGMENTS
===================================================== */
const WHEEL_SEGMENTS = [
  { points: 100, stars: 0, color: 'hsl(220 30% 15%)', type: 'points' },
  { points: 500, stars: 0, color: 'hsl(45 80% 30%)', type: 'points' },
  { points: 0, stars: 1, color: 'hsl(190 50% 20%)', type: 'stars' },
  { points: 250, stars: 0, color: 'hsl(265 40% 20%)', type: 'points' },
  { points: 1000, stars: 0, color: 'hsl(45 100% 20%)', type: 'points' },
  { points: 0, stars: 0, color: 'hsl(0 50% 20%)', type: 'empty' },
  { points: 750, stars: 0, color: 'hsl(140 40% 15%)', type: 'points' },
  { points: 0, stars: 2, color: 'hsl(190 80% 25%)', type: 'stars' },
];

const MAX_SPINS = 3;
const SPIN_COOLDOWN_HOURS = 4;

function formatCountdown(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function SpinPage() {
  const { user, refreshBalance } = useApp();

  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<React.ReactNode | null>(null);
  const [spinsLeft, setSpinsLeft] = useState(MAX_SPINS);
  const [adLoading, setAdLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [winningIndex, setWinningIndex] = useState<number | null>(null);

  const wheelRef = useRef<HTMLDivElement>(null);

  const SEGMENTS = WHEEL_SEGMENTS.length;
  const segmentAngle = 360 / SEGMENTS;

  /* =====================================================
     LOAD SPINS
  ===================================================== */
  useEffect(() => {
    if (user) loadSpinState();
  }, [user]);

  async function loadSpinState() {
    if (!user) return;
    const data = await getSpinCount(user.id);
    if (!data?.length) return;

    const cutoff = Date.now() - SPIN_COOLDOWN_HOURS * 3600000;
    const recent = data.filter((s: any) => new Date(s.spun_at).getTime() > cutoff);

    const remaining = Math.max(0, MAX_SPINS - recent.length);
    setSpinsLeft(remaining);

    if (remaining === 0 && recent.length) {
      const oldest = Math.min(...recent.map((s: any) => new Date(s.spun_at).getTime()));
      const reset = oldest + SPIN_COOLDOWN_HOURS * 3600000;
      setCooldown(Math.max(0, Math.floor((reset - Date.now()) / 1000)));
    }
  }

  /* =====================================================
     COOLDOWN
  ===================================================== */
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          setSpinsLeft(MAX_SPINS);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  /* =====================================================
     SPIN
  ===================================================== */
  async function handleSpin() {
    if (!user || spinning || spinsLeft <= 0) return;

    setSpinning(true);
    setResult(null);
    setWinningIndex(null);
    triggerHaptic('impact');

    const res = await spinWheel(user.id);

    let targetIndex = 5;

    if (res.success) {
      if (res.result === 'points') {
        const p = res.points || 0;
        if (p >= 1000) targetIndex = 4;
        else if (p >= 750) targetIndex = 6;
        else if (p >= 500) targetIndex = 1;
        else if (p >= 250) targetIndex = 3;
        else targetIndex = 0;
      } else if (res.result === 'stars') {
        targetIndex = res.stars >= 2 ? 7 : 2;
      }
    }

    const targetAngle = 360 * 8 + (360 - targetIndex * segmentAngle - segmentAngle / 2);
    setRotation(prev => prev + targetAngle);

    setTimeout(() => {
      setSpinning(false);
      setWinningIndex(targetIndex);
      setSpinsLeft(prev => prev - 1);

      if (res.success && res.result !== 'empty') {
        triggerHaptic('success');

        if (res.result === 'points') {
          setResult(
            <>
              <TgEmoji id="5375296873982604963" size={20} /> +{res.points} Points!
            </>
          );
        } else {
          setResult(
            <>
              <TgEmoji id="5458799228719472718" size={20} /> +{res.stars} Stars!
            </>
          );
        }

        refreshBalance();
      } else {
        triggerHaptic('error');
        setResult(
          <>
            <TgEmoji id="5310278924616356636" size={20} /> Better luck next time!
          </>
        );
      }
    }, 4500);
  }

  /* =====================================================
     AD
  ===================================================== */
  const onAdReward = useCallback(async () => {
    if (!user) return;
    setSpinsLeft(prev => prev + 1);
    await logAdWatch(user.id, 'extra_spin', 0);
    setResult(
      <>
        <TgEmoji id="5375296873982604963" size={20} /> Extra spin granted!
      </>
    );
  }, [user]);

  const { showAd } = useRewardedAd(onAdReward);

  async function handleWatchAd() {
    if (!user) return;
    setAdLoading(true);
    await showAd();
    setAdLoading(false);
  }

  /* =====================================================
     RENDER
  ===================================================== */
  return (
    <div className="px-4 pb-28">

      {/* WHEEL */}
      <div className="flex flex-col items-center mb-6">
        <div className="relative">
          
          {/* Pointer */}
          <div
            className="absolute top-0 left-1/2 z-20"
            style={{
              transform: 'translate(-50%, -12px)',
              width: 0,
              height: 0,
              borderLeft: '10px solid transparent',
              borderRight: '10px solid transparent',
              borderTop: '20px solid gold',
              filter: 'drop-shadow(0 0 10px gold)'
            }}
          />

          <div
            ref={wheelRef}
            style={{
              width: 260,
              height: 260,
              transition: spinning ? 'transform 4.5s cubic-bezier(0.17,0.67,0.12,0.99)' : 'none',
              transform: `rotate(${rotation}deg)`
            }}
          >
            <svg viewBox="0 0 260 260" width="260" height="260">
              {WHEEL_SEGMENTS.map((seg, i) => {
                const angle = (i * segmentAngle * Math.PI) / 180;
                const nextAngle = ((i + 1) * segmentAngle * Math.PI) / 180;
                const r = 120;
                const cx = 130;
                const cy = 130;

                const x1 = cx + r * Math.sin(angle);
                const y1 = cy - r * Math.cos(angle);
                const x2 = cx + r * Math.sin(nextAngle);
                const y2 = cy - r * Math.cos(nextAngle);

                const midAngle = ((i + 0.5) * segmentAngle * Math.PI) / 180;
                const tx = cx + 75 * Math.sin(midAngle);
                const ty = cy - 75 * Math.cos(midAngle);

                return (
                  <g key={i}>
                    <path
                      d={`M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 0,1 ${x2},${y2} Z`}
                      fill={seg.color}
                      stroke="hsl(220 30% 5%)"
                      strokeWidth="2"
                      style={{
                        filter:
                          winningIndex === i
                            ? 'drop-shadow(0 0 15px gold)'
                            : 'none'
                      }}
                    />
                    <foreignObject x={tx - 30} y={ty - 15} width="60" height="30">
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
                        {seg.type === 'points' && <TgEmoji id="5375296873982604963" size={14} />}
                        {seg.type === 'stars' && <TgEmoji id="5458799228719472718" size={14} />}
                        {seg.type === 'empty' && <TgEmoji id="5310278924616356636" size={14} />}
                        <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>
                          {seg.points || seg.stars || ''}
                        </span>
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
              <circle cx="130" cy="130" r="25" fill="hsl(220 30% 8%)" stroke="gold" strokeWidth="3" />
              <foreignObject x="115" y="115" width="30" height="30">
                <TgEmoji id="5458799228719472718" size={20} />
              </foreignObject>
            </svg>
          </div>
        </div>
      </div>

      {result && (
        <div className="text-center py-3 font-bold text-yellow-400">
          {result}
        </div>
      )}

      <button
        className="btn-gold w-full py-4 rounded-2xl font-bold"
        onClick={handleSpin}
        disabled={spinning || spinsLeft <= 0}
      >
        {spinning ? 'Spinning...' : 'SPIN NOW'}
      </button>

      <button
        className="w-full rounded-2xl p-4 mt-4 font-bold"
        onClick={handleWatchAd}
        disabled={adLoading}
      >
        <TgEmoji id="5375296873982604963" size={18} /> WATCH & EARN
      </button>
    </div>
  );
}