import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { spinWheel, logAdWatch, getSpinCount } from '@/lib/api';
import { useRewardedAd } from '@/hooks/useAdsgram';

/* ===============================
   TELEGRAM HAPTIC
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
   UPDATED REWARD BALANCE
================================ */
const WHEEL_SEGMENTS = [
  { points: 50, stars: 0, color: '#1f2937', type: 'points' },
  { points: 100, stars: 0, color: '#78350f', type: 'points' },
  { points: 0, stars: 5, color: '#0e7490', type: 'stars' },
  { points: 200, stars: 0, color: '#4c1d95', type: 'points' },
  { points: 500, stars: 0, color: '#92400e', type: 'points' },
  { points: 0, stars: 0, color: '#7f1d1d', type: 'empty' },
  { points: 300, stars: 0, color: '#14532d', type: 'points' },
  { points: 0, stars: 10, color: '#0f766e', type: 'stars' },
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
  const [adLoading, setAdLoading] = useState(false);

  const wheelRef = useRef<HTMLDivElement>(null);
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

  /* COOLDOWN */
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

  /* SPIN */
  async function handleSpin() {
    if (!user || spinning || spinsLeft <= 0) return;

    triggerHaptic('impact');
    setSpinning(true);
    setResult(null);
    setWinningIndex(null);

    const res = await spinWheel(user.id);
    let targetIndex = 5;

    if (res.success) {
      if (res.result === 'points') {
        const p = res.points || 0;
        targetIndex = WHEEL_SEGMENTS.findIndex(s => s.points === p);
      } else if (res.result === 'stars') {
        targetIndex = WHEEL_SEGMENTS.findIndex(s => s.stars === res.stars);
      }
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

        if (res.result === 'points') {
          setResult(`💰 +${res.points} Points!`);
        } else {
          setResult(`⭐ +${res.stars} Stars!`);
        }
        refreshBalance();
      } else {
        triggerHaptic('error');
        setResult('🎯 Better luck next time!');
      }
    }, 4500);
  }

  const onAdReward = useCallback(async () => {
    if (!user) return;
    setSpinsLeft(prev => prev + 1);
    await logAdWatch(user.id, 'extra_spin', 0);
  }, [user]);

  const { showAd } = useRewardedAd(onAdReward);

  async function handleWatchAd() {
    setAdLoading(true);
    await showAd();
    setAdLoading(false);
  }

  return (
    <div className="px-4 pb-28 text-white">

      {/* WHEEL */}
      <div className="flex justify-center mb-6 relative">

        {/* ARROW */}
        <div
          style={{
            position: 'absolute',
            top: -8,
            width: 0,
            height: 0,
            borderLeft: '12px solid transparent',
            borderRight: '12px solid transparent',
            borderTop: '24px solid gold',
            filter: 'drop-shadow(0 0 12px gold)',
            zIndex: 5
          }}
        />

        <div
          ref={wheelRef}
          style={{
            width: 260,
            height: 260,
            borderRadius: '50%',
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? 'transform 4.5s cubic-bezier(0.17,0.67,0.12,0.99)'
              : 'none',
            opacity: spinsLeft <= 0 ? 0.6 : 1,
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

              const midAngle =
                ((i + 0.5) * segmentAngle * Math.PI) / 180;
              const tx = cx + 75 * Math.sin(midAngle);
              const ty = cy - 75 * Math.cos(midAngle);

              return (
                <g key={i}>
                  <path
                    d={`M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 0,1 ${x2},${y2} Z`}
                    fill={seg.color}
                    stroke="#000"
                    strokeWidth="2"
                    style={{
                      filter:
                        winningIndex === i
                          ? 'drop-shadow(0 0 20px gold)'
                          : 'none'
                    }}
                  />
                  <text
                    x={tx}
                    y={ty}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="12"
                    fontWeight="bold"
                    transform={`rotate(${(i + 0.5) * segmentAngle}, ${tx}, ${ty})`}
                  >
                    {seg.type === 'points' && `💰 ${seg.points}`}
                    {seg.type === 'stars' && `⭐ ${seg.stars}`}
                    {seg.type === 'empty' && `🎯`}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* REWARD RESULT BELOW */}
      {result && (
        <div className="text-center py-3 font-bold text-yellow-400">
          {result}
        </div>
      )}

      {/* COOLDOWN CARD */}
      {spinsLeft <= 0 && cooldown > 0 && (
        <div className="text-center mb-4 p-4 rounded-xl bg-gray-700">
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
        className="w-full py-4 rounded-2xl font-bold text-lg mb-3"
        style={{
          background:
            spinsLeft > 0
              ? 'linear-gradient(135deg,#facc15,#f97316)'
              : '#374151',
          color: spinsLeft > 0 ? '#000' : '#9ca3af'
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
        className="w-full py-4 rounded-2xl font-bold"
        style={{
          background: 'rgba(250,204,21,0.1)',
          border: '1px solid gold',
          color: 'gold'
        }}
      >
        🎬 Watch Ad +1 Spin
      </button>

    </div>
  );
}