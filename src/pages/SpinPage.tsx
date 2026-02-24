import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { spinWheel, logAdWatch, getSpinCount } from '@/lib/api';
import { useRewardedAd } from '@/hooks/useAdsgram';

/* ===============================
   HAPTIC
================================ */
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

/* ===============================
   SEGMENTS
================================ */
const WHEEL_SEGMENTS = [
  { points: 50, color: '#1f2937', type: 'points' },
  { points: 100, color: '#78350f', type: 'points' },
  { points: 40, color: '#0e7490', type: 'points' },
  { points: 200, color: '#4c1d95', type: 'points' },
  { points: 500, color: '#92400e', type: 'points' },
  { points: 0, color: '#7f1d1d', type: 'empty' },
  { points: 300, color: '#14532d', type: 'points' },
  { points: 0, color: '#7f1d1d', type: 'empty' },
];

const MAX_SPINS = 3;
const SPIN_COOLDOWN_HOURS = 4;

function formatCountdown(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m
    .toString()
    .padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function SpinPage() {
  const { user, refreshBalance } = useApp();

  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [spinsLeft, setSpinsLeft] = useState(MAX_SPINS);
  const [cooldown, setCooldown] = useState(0);
  const [winningIndex, setWinningIndex] = useState<number | null>(null);
  const [coinBurst, setCoinBurst] = useState(false);
  const [adLoading, setAdLoading] = useState(false);

  const segmentAngle = 360 / WHEEL_SEGMENTS.length;

  /* LOAD SPINS */
  useEffect(() => {
    if (user) loadSpinState();
  }, [user]);

  async function loadSpinState() {
    if (!user) return;
    const data = await getSpinCount(user.id);
    if (!data?.length) return;

    const cutoff = Date.now() - SPIN_COOLDOWN_HOURS * 3600000;
    const recent = data.filter(
      (s: any) => new Date(s.spun_at).getTime() > cutoff
    );

    const remaining = Math.max(0, MAX_SPINS - recent.length);
    setSpinsLeft(remaining);

    if (remaining === 0 && recent.length) {
      const oldest = Math.min(
        ...recent.map((s: any) => new Date(s.spun_at).getTime())
      );
      const reset = oldest + SPIN_COOLDOWN_HOURS * 3600000;
      setCooldown(Math.max(0, Math.floor((reset - Date.now()) / 1000)));
    }
  }

  /* COOLDOWN TIMER */
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  /* SPIN */
  async function handleSpin() {
    if (!user || spinning || spinsLeft <= 0) return;

    triggerHaptic('impact');
    setSpinning(true);
    setResult(null);
    setWinningIndex(null);

    const res = await spinWheel(user.id);
    let targetIndex = 5;

    if (res.success && res.result === 'points') {
      targetIndex = WHEEL_SEGMENTS.findIndex(s => s.points === res.points);
    }

    const targetAngle =
      360 * 8 + (360 - targetIndex * segmentAngle - segmentAngle / 2);

    setRotation(prev => prev + targetAngle);

    setTimeout(() => {
      setSpinning(false);
      setWinningIndex(targetIndex);
      setSpinsLeft(prev => prev - 1);

      if (res.success && res.result !== 'empty') {
        triggerHaptic('success');
        setCoinBurst(true);
        setResult(`💰 +${res.points} Points!`);
        refreshBalance();
        setTimeout(() => setCoinBurst(false), 1200);
      } else {
        triggerHaptic('error');
        setResult('🎯 Better luck next time!');
      }
    }, 4500);
  }

  const onAdReward = useCallback(async () => {
    if (!user) return;
    triggerHaptic('success');
    setSpinsLeft(prev => prev + 1);
    await logAdWatch(user.id, 'extra_spin', 0);
  }, [user]);

  const { showAd } = useRewardedAd(onAdReward);

  async function handleWatchAd() {
    triggerHaptic('impact');
    setAdLoading(true);
    await showAd();
    setAdLoading(false);
  }

  return (
    <div className="px-4 pb-28 text-white relative overflow-hidden">

      {/* GLOW BACKGROUND */}
      <div className="absolute inset-0 opacity-30 animate-pulse"
        style={{
          background:
            'radial-gradient(circle at 50% 20%, rgba(250,204,21,0.4), transparent 60%)'
        }}
      />

      {/* WHEEL */}
      <div className="flex justify-center mb-8 relative">

        {/* ARROW */}
        <div
          style={{
            position: 'absolute',
            top: -10,
            width: 0,
            height: 0,
            borderLeft: '14px solid transparent',
            borderRight: '14px solid transparent',
            borderTop: '28px solid gold',
            filter: 'drop-shadow(0 0 15px gold)',
            zIndex: 10
          }}
        />

        <div
          style={{
            width: 280,
            height: 280,
            borderRadius: '50%',
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? 'transform 4.5s cubic-bezier(0.17,0.67,0.12,0.99)'
              : 'none',
            boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
          }}
        >
          <svg viewBox="0 0 260 260">
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

              return (
                <path
                  key={i}
                  d={`M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 0,1 ${x2},${y2} Z`}
                  fill={seg.color}
                  stroke="#000"
                  strokeWidth="2"
                  style={{
                    filter:
                      winningIndex === i
                        ? 'drop-shadow(0 0 25px gold)'
                        : 'none'
                  }}
                />
              );
            })}
          </svg>

          {coinBurst && (
            <div className="absolute inset-0 flex items-center justify-center text-4xl animate-bounce">
              💰
            </div>
          )}
        </div>
      </div>

      {/* RESULT CARD */}
      {result && (
        <div className="text-center mb-6 p-4 rounded-2xl backdrop-blur-xl animate-pulse"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 15px 40px rgba(0,0,0,0.5)'
          }}>
          <div className="text-xl font-bold text-yellow-400">
            {result}
          </div>
        </div>
      )}

      {/* COOLDOWN */}
      {spinsLeft <= 0 && cooldown > 0 && (
        <div className="text-center mb-6 p-4 rounded-2xl bg-gray-800/60 backdrop-blur-xl">
          🎯 No Spins Left
          <div className="mt-1 font-mono text-yellow-400">
            Reset in {formatCountdown(cooldown)}
          </div>
        </div>
      )}

      {/* SPIN BUTTON */}
      <button
        onClick={handleSpin}
        disabled={spinning || spinsLeft <= 0}
        className="w-full py-5 rounded-2xl font-bold text-lg mb-4 transition active:scale-95"
        style={{
          background:
            spinsLeft > 0
              ? 'linear-gradient(135deg,#facc15,#f97316)'
              : '#374151',
          color: spinsLeft > 0 ? '#000' : '#9ca3af',
          boxShadow:
            spinsLeft > 0
              ? '0 15px 35px rgba(250,204,21,0.4)'
              : 'none'
        }}
      >
        {spinning
          ? '🌀 Spinning...'
          : spinsLeft > 0
          ? `💰 SPIN NOW (${spinsLeft} left)`
          : '🚫 No Spins'}
      </button>

      {/* WATCH AD */}
      <button
        onClick={handleWatchAd}
        disabled={adLoading}
        className="w-full py-4 rounded-2xl font-bold border"
        style={{
          background: 'rgba(250,204,21,0.1)',
          borderColor: 'gold',
          color: 'gold'
        }}
      >
        {adLoading ? 'Loading...' : '🎬 Watch Ad +1 Spin'}
      </button>
    </div>
  );
}