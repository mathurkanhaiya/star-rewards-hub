import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { spinWheel, logAdWatch, getSpinCount } from '@/lib/api';
import { useRewardedAd } from '@/hooks/useAdsgram';

const WHEEL_SEGMENTS = [
  { points: 100, stars: 0, color: 'hsl(220 30% 15%)', type: 'points' },
  { points: 500, stars: 0, color: 'hsl(45 80% 30%)', type: 'points' },
  { points: 0, stars: 1, color: 'hsl(190 50% 20%)', type: 'stars' },
  { points: 250, stars: 0, color: 'hsl(265 40% 20%)', type: 'points' },
  { points: 1000, stars: 0, color: 'hsl(45 100% 20%)', type: 'points' },
  { points: 0, stars: 0, color: 'hsl(0 50% 20%)', type: 'empty' },
  { points: 750, stars: 0, color: 'hsl(140 40% 15%)', type: 'points' },
  { points: 0, stars: 2, color: 'hsl(190 80% 25%)', type: 'stars' },
] as const;

const MAX_SPINS = 3;
const SPIN_COOLDOWN_HOURS = 4;

type SpinRecord = {
  spun_at: string;
};

type SpinResponse = {
  success: boolean;
  result: 'points' | 'stars' | 'empty';
  points?: number;
  stars?: number;
};

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return `${h.toString().padStart(2, '0')}:${m
    .toString()
    .padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function SpinPage(): JSX.Element {
  const { user, refreshBalance } = useApp();

  const [spinning, setSpinning] = useState<boolean>(false);
  const [rotation, setRotation] = useState<number>(0);
  const [result, setResult] = useState<string | null>(null);
  const [spinsLeft, setSpinsLeft] = useState<number>(MAX_SPINS);
  const [adLoading, setAdLoading] = useState<boolean>(false);
  const [cooldown, setCooldown] = useState<number>(0);
  const [winningIndex, setWinningIndex] = useState<number | null>(null);

  const wheelRef = useRef<HTMLDivElement | null>(null);
  const segmentAngle = 360 / WHEEL_SEGMENTS.length;

  /* ================= LOAD SPIN STATE ================= */
  useEffect(() => {
    if (user) void loadSpinState();
  }, [user]);

  async function loadSpinState(): Promise<void> {
    if (!user) return;

    try {
      const data: SpinRecord[] = await getSpinCount(user.id);
      if (!data?.length) return;

      const cutoff = Date.now() - SPIN_COOLDOWN_HOURS * 3600000;

      const recent = data.filter(
        (s) => new Date(s.spun_at).getTime() > cutoff
      );

      const remaining = Math.max(0, MAX_SPINS - recent.length);
      setSpinsLeft(remaining);

      if (remaining === 0 && recent.length) {
        const oldest = Math.min(
          ...recent.map((s) => new Date(s.spun_at).getTime())
        );
        const reset = oldest + SPIN_COOLDOWN_HOURS * 3600000;
        setCooldown(Math.max(0, Math.floor((reset - Date.now()) / 1000)));
      }
    } catch (error) {
      console.error('Failed to load spin state', error);
    }
  }

  /* ================= COOLDOWN TIMER ================= */
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

  /* ================= HANDLE SPIN ================= */
  async function handleSpin(): Promise<void> {
    if (!user || spinning || spinsLeft <= 0) return;

    setSpinning(true);
    setResult(null);
    setWinningIndex(null);

    try {
      const res: SpinResponse = await spinWheel(user.id);

      let targetIndex = 5;

      if (res.success) {
        if (res.result === 'points') {
          const p = res.points ?? 0;
          if (p >= 1000) targetIndex = 4;
          else if (p >= 750) targetIndex = 6;
          else if (p >= 500) targetIndex = 1;
          else if (p >= 250) targetIndex = 3;
          else targetIndex = 0;
        } else if (res.result === 'stars') {
          targetIndex = (res.stars ?? 0) >= 2 ? 7 : 2;
        }
      }

      const targetAngle =
        360 * 8 + (360 - targetIndex * segmentAngle - segmentAngle / 2);

      setRotation((prev) => prev + targetAngle);

      setTimeout(() => {
        setSpinning(false);
        setWinningIndex(targetIndex);
        setSpinsLeft((prev) => prev - 1);

        if (res.success && res.result !== 'empty') {
          if (res.result === 'points') {
            setResult(`💰 +${res.points ?? 0} Points!`);
          } else {
            setResult(`⭐ +${res.stars ?? 0} Stars!`);
          }
          refreshBalance();
        } else {
          setResult('🎯 Better luck next time!');
        }
      }, 4500);
    } catch (error) {
      console.error('Spin failed', error);
      setSpinning(false);
    }
  }

  /* ================= HANDLE AD ================= */
  const onAdReward = useCallback(async (): Promise<void> => {
    if (!user) return;
    setSpinsLeft((prev) => prev + 1);
    await logAdWatch(user.id, 'extra_spin', 0);
  }, [user]);

  const { showAd } = useRewardedAd(onAdReward);

  async function handleWatchAd(): Promise<void> {
    if (!user) return;
    setAdLoading(true);
    try {
      await showAd();
    } finally {
      setAdLoading(false);
    }
  }

  /* ================= RENDER ================= */
  return (
    <div className="px-4 pb-28">
      {result && (
        <div className="text-center py-3 font-bold text-yellow-400">
          {result}
        </div>
      )}

      <button
        onClick={handleSpin}
        disabled={spinning || spinsLeft <= 0}
        style={{
          width: '100%',
          padding: 16,
          borderRadius: 20,
          border: 'none',
          fontWeight: 800,
          fontSize: 16,
          background:
            spinsLeft > 0
              ? 'linear-gradient(135deg,#facc15,#f97316)'
              : 'linear-gradient(135deg,#374151,#1f2937)',
          color: spinsLeft > 0 ? '#111827' : '#9ca3af',
          cursor: spinning || spinsLeft <= 0 ? 'not-allowed' : 'pointer',
          transition: '0.2s',
        }}
      >
        {spinning
          ? '🌀 Spinning...'
          : spinsLeft > 0
          ? `💰 SPIN NOW (${spinsLeft} left)`
          : `🎯 No Spins Left ${
              cooldown > 0 ? `Reset in ${formatCountdown(cooldown)}` : ''
            }`}
      </button>

      <button
        onClick={handleWatchAd}
        disabled={adLoading}
        style={{
          width: '100%',
          marginTop: 12,
          padding: 14,
          borderRadius: 18,
          border: '1px solid rgba(250,204,21,0.4)',
          background: 'rgba(250,204,21,0.08)',
          color: '#facc15',
          fontWeight: 700,
        }}
      >
        {adLoading ? 'Loading Ad...' : '🎬 Watch Ad +1 Spin'}
      </button>
    </div>
  );
}