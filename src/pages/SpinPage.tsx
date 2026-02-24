import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { spinWheel, logAdWatch, getSpinCount } from '@/lib/api';
import { useRewardedAd } from '@/hooks/useAdsgram';

const WHEEL_SEGMENTS = [
  { label: '100 pts', points: 100, stars: 0, color: 'hsl(220 30% 15%)', type: 'points' },
  { label: '500 pts', points: 500, stars: 0, color: 'hsl(45 80% 30%)', type: 'points' },
  { label: '⭐ 1 Star', points: 0, stars: 1, color: 'hsl(190 50% 20%)', type: 'stars' },
  { label: '250 pts', points: 250, stars: 0, color: 'hsl(265 40% 20%)', type: 'points' },
  { label: '1000 pts', points: 1000, stars: 0, color: 'hsl(45 100% 20%)', type: 'points' },
  { label: '🎯 Try Again', points: 0, stars: 0, color: 'hsl(0 50% 20%)', type: 'empty' },
  { label: '750 pts', points: 750, stars: 0, color: 'hsl(140 40% 15%)', type: 'points' },
  { label: '⭐ 2 Stars', points: 0, stars: 2, color: 'hsl(190 80% 25%)', type: 'stars' },
];

const MAX_SPINS = 3;
const SPIN_COOLDOWN_HOURS = 4;
const SPIN_DURATION = 4500;

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
  const [adLoading, setAdLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const SEGMENTS = WHEEL_SEGMENTS.length;
  const segmentAngle = 360 / SEGMENTS;

  // ===============================
  // LOAD SPIN STATE
  // ===============================
  useEffect(() => {
    if (!user) return;
    loadSpinState();
  }, [user]);

  async function loadSpinState() {
    if (!user) return;

    try {
      const data = await getSpinCount(user.id);
      if (!data?.length) return;

      const cutoff = Date.now() - SPIN_COOLDOWN_HOURS * 60 * 60 * 1000;

      const recentSpins = data.filter(
        (s: { spun_at: string }) =>
          new Date(s.spun_at).getTime() > cutoff
      );

      const used = recentSpins.length;
      const remaining = Math.max(0, MAX_SPINS - used);
      setSpinsLeft(remaining);

      if (remaining === 0 && recentSpins.length) {
        const oldest = Math.min(
          ...recentSpins.map((s: any) =>
            new Date(s.spun_at).getTime()
          )
        );

        const resetTime =
          oldest + SPIN_COOLDOWN_HOURS * 60 * 60 * 1000;

        const secondsLeft = Math.max(
          0,
          Math.floor((resetTime - Date.now()) / 1000)
        );

        setCooldown(secondsLeft);
      }
    } catch (err) {
      console.error('Failed to load spin state', err);
    }
  }

  // ===============================
  // COOLDOWN TIMER
  // ===============================
  useEffect(() => {
    if (cooldown <= 0) return;

    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          setSpinsLeft(MAX_SPINS);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldown]);

  // ===============================
  // SPIN LOGIC
  // ===============================
  async function handleSpin() {
    if (!user || spinning || spinsLeft <= 0) return;

    setSpinning(true);
    setResult(null);

    try {
      const res = await spinWheel(user.id);

      let targetIndex = 5; // default: try again

      if (res?.success) {
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

      const extraSpins = 6;
      const targetAngle =
        360 * extraSpins +
        (360 - targetIndex * segmentAngle - segmentAngle / 2);

      setRotation((prev) => prev + targetAngle);

      setTimeout(() => {
        setSpinning(false);

        setSpinsLeft((prev) => {
          const updated = Math.max(0, prev - 1);
          if (updated === 0) {
            setCooldown(SPIN_COOLDOWN_HOURS * 3600);
          }
          return updated;
        });

        if (res?.success && res.result !== 'empty') {
          const points = res.points || 0;
          const stars = res.stars || 0;

          if (points > 0) {
            setResult(`+${points} points! 🎉`);
          } else if (stars > 0) {
            setResult(`+${stars} ⭐ Stars! 🎊`);
          }
          refreshBalance();
        } else {
          setResult('Better luck next time! 🎯');
        }
      }, SPIN_DURATION);
    } catch (err) {
      console.error('Spin failed', err);
      setSpinning(false);
      setResult('Something went wrong ❗');
    }
  }

  // ===============================
  // AD REWARD
  // ===============================
  const onAdReward = useCallback(async () => {
    if (!user) return;

    setSpinsLeft((prev) => prev + 1);
    setCooldown(0);

    await logAdWatch(user.id, 'extra_spin', 0);

    setResult('🎡 Extra spin granted!');
    setTimeout(() => setResult(null), 2000);
  }, [user]);

  const { showAd } = useRewardedAd(onAdReward);

  async function handleWatchAd() {
    if (!user || adLoading) return;
    setAdLoading(true);
    try {
      await showAd();
    } finally {
      setAdLoading(false);
    }
  }

  // ===============================
  // UI
  // ===============================
  return (
    <div className="px-4 pb-28">
      <h2 className="text-lg font-bold mb-1">Spin Wheel</h2>
      <p className="text-xs mb-4">Spin to win amazing prizes!</p>

      {/* Spins Counter */}
      <div className="flex items-center justify-center gap-2 mb-4">
        {Array.from({ length: MAX_SPINS }).map((_, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-full"
            style={{
              background:
                i < spinsLeft
                  ? 'hsl(45 100% 55%)'
                  : 'hsl(220 20% 20%)',
              transition: '0.3s',
            }}
          />
        ))}
        <span className="text-xs ml-2">
          {spinsLeft} spin{spinsLeft !== 1 ? 's' : ''} left
        </span>
      </div>

      {/* Cooldown */}
      {cooldown > 0 && spinsLeft === 0 && (
        <div className="text-center mb-4">
          <div className="text-xs">Spins reset in</div>
          <div className="font-mono text-lg">
            {formatCountdown(cooldown)}
          </div>
        </div>
      )}

      {/* Wheel */}
      <div className="flex justify-center mb-6">
        <div
          style={{
            width: 260,
            height: 260,
            transition: spinning
              ? 'transform 4.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)'
              : 'none',
            transform: `rotate(${rotation}deg)`,
          }}
        >
          <svg viewBox="0 0 260 260" width="260" height="260">
            {WHEEL_SEGMENTS.map((seg, i) => {
              const angle = (i * segmentAngle * Math.PI) / 180;
              const nextAngle =
                ((i + 1) * segmentAngle * Math.PI) / 180;

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
                  />
                  <text
                    x={tx}
                    y={ty}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="9"
                    fontWeight="700"
                  >
                    {seg.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {result && (
        <div className="text-center font-bold mb-4">
          {result}
        </div>
      )}

      <button
        className="w-full py-4 mb-4 rounded bg-yellow-500 font-bold"
        onClick={handleSpin}
        disabled={spinning || spinsLeft <= 0}
      >
        {spinning
          ? '🌀 Spinning...'
          : spinsLeft > 0
          ? '🎡 SPIN NOW'
          : '🚫 No Spins Left'}
      </button>

      <button
        className="w-full py-4 rounded bg-orange-400 font-bold"
        onClick={handleWatchAd}
        disabled={adLoading}
      >
        {adLoading
          ? '⏳ Loading...'
          : '🎬 WATCH & EARN → +1 Extra Spin'}
      </button>
    </div>
  );
}