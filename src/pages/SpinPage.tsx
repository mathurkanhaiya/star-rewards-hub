import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { spinWheel, logAdWatch, getSpinCount } from '@/lib/api';
import { useRewardedAd } from '@/hooks/useAdsgram';

/* ===============================
   TELEGRAM EMOJI COMPONENT
================================ */
function TgEmoji({ id, size = 20 }: { id: string; size?: number }) {
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

/* ===============================
   WHEEL SEGMENTS (emoji removed from label text)
================================ */
const WHEEL_SEGMENTS = [
  { label: '100 pts', points: 100, stars: 0, color: 'hsl(220 30% 15%)', type: 'points' },
  { label: '500 pts', points: 500, stars: 0, color: 'hsl(45 80% 30%)', type: 'points' },
  { label: '1 Star', points: 0, stars: 1, color: 'hsl(190 50% 20%)', type: 'stars' },
  { label: '250 pts', points: 250, stars: 0, color: 'hsl(265 40% 20%)', type: 'points' },
  { label: '1000 pts', points: 1000, stars: 0, color: 'hsl(45 100% 20%)', type: 'points' },
  { label: 'Try Again', points: 0, stars: 0, color: 'hsl(0 50% 20%)', type: 'empty' },
  { label: '750 pts', points: 750, stars: 0, color: 'hsl(140 40% 15%)', type: 'points' },
  { label: '2 Stars', points: 0, stars: 2, color: 'hsl(190 80% 25%)', type: 'stars' },
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
  const [result, setResult] = useState<string | null>(null);
  const [spinsLeft, setSpinsLeft] = useState(MAX_SPINS);
  const [adLoading, setAdLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);

  const SEGMENTS = WHEEL_SEGMENTS.length;
  const segmentAngle = 360 / SEGMENTS;

  useEffect(() => {
    if (user) loadSpinState();
  }, [user]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setSpinsLeft(MAX_SPINS);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  async function loadSpinState() {
    if (!user) return;
    const data = await getSpinCount(user.id);
    if (data && data.length > 0) {
      const cutoff = Date.now() - SPIN_COOLDOWN_HOURS * 60 * 60 * 1000;
      const recentSpins = data.filter((s: { spun_at: string }) => new Date(s.spun_at).getTime() > cutoff);
      const used = recentSpins.length;
      const remaining = Math.max(0, MAX_SPINS - used);
      setSpinsLeft(remaining);

      if (remaining === 0 && recentSpins.length > 0) {
        const oldest = recentSpins.reduce((min: string, s: { spun_at: string }) => s.spun_at < min ? s.spun_at : min, recentSpins[0].spun_at);
        const resetTime = new Date(oldest).getTime() + SPIN_COOLDOWN_HOURS * 60 * 60 * 1000;
        const remaining_s = Math.max(0, Math.floor((resetTime - Date.now()) / 1000));
        setCooldown(remaining_s);
      }
    }
  }

  async function handleSpin() {
    if (spinning || !user || spinsLeft <= 0) return;
    setSpinning(true);
    setResult(null);

    const res = await spinWheel(user.id);

    let targetIndex = 0;
    if (res.success) {
      if (res.result === 'points') {
        if (res.points && res.points >= 1000) targetIndex = 4;
        else if (res.points && res.points >= 750) targetIndex = 6;
        else if (res.points && res.points >= 500) targetIndex = 1;
        else if (res.points && res.points >= 250) targetIndex = 3;
        else targetIndex = 0;
      } else if (res.result === 'stars') {
        targetIndex = res.stars && res.stars >= 2 ? 7 : 2;
      } else {
        targetIndex = 5;
      }
    }

    const targetAngle = 360 * 8 + (360 - targetIndex * segmentAngle - segmentAngle / 2);
    setRotation(prev => prev + targetAngle);

    setTimeout(() => {
      setSpinning(false);
      const newSpinsLeft = spinsLeft - 1;
      setSpinsLeft(newSpinsLeft);

      if (newSpinsLeft <= 0) {
        setCooldown(SPIN_COOLDOWN_HOURS * 60 * 60);
      }

      if (res.success && res.result !== 'empty') {
        const points = res.points || 0;
        const stars = res.stars || 0;

        setResult(
          points > 0
            ? `+${points} points!`
            : stars > 0
            ? `+${stars} Stars!`
            : 'Better luck next time!'
        );

        refreshBalance();
      } else {
        setResult('Better luck next time!');
      }
    }, 4500);
  }

  const onAdReward = useCallback(async () => {
    if (!user) return;
    setSpinsLeft(prev => prev + 1);
    if (cooldown > 0) setCooldown(0);
    await logAdWatch(user.id, 'extra_spin', 0);
    setResult('Extra spin granted!');
    setTimeout(() => setResult(null), 2000);
  }, [user, cooldown]);

  const { showAd } = useRewardedAd(onAdReward);

  async function handleWatchAd() {
    if (!user) return;
    setAdLoading(true);
    await showAd();
    setAdLoading(false);
  }

  return (
    <div className="px-4 pb-28">

      <div className="mb-4">
        <h2 className="text-lg font-display font-bold text-gold-gradient mb-1">
          <TgEmoji id="5458799228719472718" size={20} /> Spin Wheel
        </h2>
        <p className="text-xs text-muted-foreground">Spin to win amazing prizes!</p>
      </div>

      {/* Wheel */}
      <div className="flex flex-col items-center mb-6">
        <div className="relative spin-wheel-container">
          
          {/* Pointer */}
          <div
            className="absolute top-0 left-1/2 z-20"
            style={{
              transform: 'translate(-50%, -12px)',
              width: 0, height: 0,
              borderLeft: '10px solid transparent',
              borderRight: '10px solid transparent',
              borderTop: '20px solid hsl(45 100% 55%)',
            }}
          />

          <div
            ref={wheelRef}
            style={{
              width: 260, height: 260,
              transition: spinning ? 'transform 4.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
              transform: `rotate(${rotation}deg)`,
            }}
          >
            <svg viewBox="0 0 260 260" width="260" height="260">
              {WHEEL_SEGMENTS.map((seg, i) => {
                const angle = (i * segmentAngle * Math.PI) / 180;
                const nextAngle = ((i + 1) * segmentAngle * Math.PI) / 180;
                const r = 120;
                const cx = 130, cy = 130;
                const x1 = cx + r * Math.sin(angle);
                const y1 = cy - r * Math.cos(angle);
                const x2 = cx + r * Math.sin(nextAngle);
                const y2 = cy - r * Math.cos(nextAngle);
                const midAngle = ((i + 0.5) * segmentAngle * Math.PI) / 180;
                const tx = cx + 75 * Math.sin(midAngle);
                const ty = cy - 75 * Math.cos(midAngle);

                return (
                  <g key={i}>
                    <path d={`M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 0,1 ${x2},${y2} Z`} fill={seg.color} stroke="hsl(220 30% 5%)" strokeWidth="2" />
                    <foreignObject x={tx - 30} y={ty - 15} width="60" height="30">
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
                        {seg.type === 'stars' && <TgEmoji id="5458799228719472718" size={16} />}
                        {seg.type === 'empty' && <TgEmoji id="5310278924616356636" size={16} />}
                        <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>
                          {seg.label}
                        </span>
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
              <circle cx="130" cy="130" r="25" fill="hsl(220 30% 8%)" stroke="hsl(45 100% 55%)" strokeWidth="3" />
              <foreignObject x="115" y="115" width="30" height="30">
                <TgEmoji id="5458799228719472718" size={22} />
              </foreignObject>
            </svg>
          </div>
        </div>
      </div>

      {/* WATCH BUTTON */}
      <button
        className="w-full rounded-2xl p-4 mb-4 flex flex-col items-center justify-center gap-1 font-bold"
        onClick={handleWatchAd}
        disabled={adLoading}
      >
        <div className="text-xl">
          <TgEmoji id="5375296873982604963" size={22} />
        </div>
        <div className="text-sm font-black">
          WATCH & EARN → +1 Extra Spin
        </div>
      </button>
    </div>
  );
}