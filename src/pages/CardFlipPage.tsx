import React, { useState, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { useRewardedAd } from '@/hooks/useAdsgram';
import { supabase } from '@/integrations/supabase/client';

const SYMBOLS = ['💎', '🌟', '🔥', '🍀', '💰', '🎯', '🏆', '⚡'];

export default function CardFlipPage() {
  const { user, refreshBalance } = useApp();
  const [phase, setPhase] = useState<'locked' | 'loading' | 'picking' | 'result'>('locked');
  const [cards, setCards] = useState<string[]>([]);
  const [flipped, setFlipped] = useState<boolean[]>([]);
  const [reward, setReward] = useState(0);

  const onAdWatched = useCallback(() => {
    const c = Array.from({ length: 3 }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
    setCards(c);
    setFlipped([false, false, false]);
    setPhase('picking');
  }, []);

  const { showAd } = useRewardedAd(onAdWatched);

  const handleUnlock = async () => {
    setPhase('loading');
    const ok = await showAd();
    if (!ok) setPhase('locked');
  };

  const flipCard = (i: number) => {
    if (flipped[i]) return;

    const next = [...flipped];
    next[i] = true;
    setFlipped(next);

    if (next.every(Boolean)) {
      const unique = new Set(cards).size;
      let pts = 10;

      if (unique === 1) pts = 100;
      else if (unique === 2) pts = 50;
      else pts = 15 + Math.floor(Math.random() * 10);

      setReward(pts);
      setPhase('result');

      if (user) {
        supabase.functions.invoke('log-ad', {
          body: { userId: user.id, adType: 'card_flip', rewardGiven: pts },
        });

        refreshBalance();
      }
    }
  };

  return (
    <div className="px-4 pb-28 text-center">

      {/* Card Flip GIF */}
      <img
        src="https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773236194044-d5413577.gif"
        alt="Card Flip"
        className="w-20 h-20 mx-auto mb-2 object-contain animate-float"
      />

      <h2 className="text-2xl font-bold shimmer-text mb-1">Card Flip</h2>

      <p
        className="text-xs mb-6"
        style={{ color: 'hsl(var(--muted-foreground))' }}
      >
        Watch an ad, flip 3 cards — match them for big rewards!
      </p>

      <div
        className="glass-card rounded-2xl p-6 mb-4"
        style={{ border: '1px solid hsl(var(--purple) / 0.3)' }}
      >

        {phase === 'locked' && (
          <button
            onClick={handleUnlock}
            className="w-full py-3 rounded-xl font-bold text-sm"
            style={{
              background:
                'linear-gradient(135deg, hsl(var(--gold)), hsl(35 100% 45%))',
              color: '#000',
            }}
          >
            📺 Watch Ad to Play
          </button>
        )}

        {phase === 'loading' && (
          <div
            className="text-sm"
            style={{ color: 'hsl(var(--muted-foreground))' }}
          >
            Loading ad...
          </div>
        )}

        {phase === 'picking' && (
          <div>
            <div
              className="text-sm mb-4"
              style={{ color: 'hsl(var(--muted-foreground))' }}
            >
              Tap each card to flip!
            </div>

            <div className="flex justify-center gap-3">

              {cards.map((sym, i) => (
                <button
                  key={i}
                  onClick={() => flipCard(i)}
                  className="w-24 h-32 rounded-xl font-bold text-4xl transition-all duration-300"
                  style={{
                    background: flipped[i]
                      ? 'hsl(var(--purple) / 0.2)'
                      : 'linear-gradient(135deg, hsl(var(--purple) / 0.4), hsl(var(--purple) / 0.15))',
                    border: `1px solid hsl(var(--purple) / ${flipped[i] ? '0.5' : '0.3'})`,
                    transform: flipped[i] ? 'rotateY(180deg)' : 'none',
                  }}
                >
                  {flipped[i] ? sym : '❓'}
                </button>
              ))}

            </div>
          </div>
        )}

        {phase === 'result' && (
          <div>
            <div className="text-5xl flex justify-center gap-3 mb-3">
              {cards.map((s, i) => (
                <span key={i}>{s}</span>
              ))}
            </div>

            <div
              className="text-xs mb-2"
              style={{ color: 'hsl(var(--muted-foreground))' }}
            >
              {new Set(cards).size === 1
                ? '🎉 TRIPLE MATCH!'
                : new Set(cards).size === 2
                ? '✨ Pair Found!'
                : 'No match'}
            </div>

            <div
              className="text-2xl font-bold"
              style={{ color: 'hsl(var(--gold))' }}
            >
              +{reward} Points!
            </div>

            <button
              onClick={() => setPhase('locked')}
              className="mt-4 w-full py-2 rounded-xl text-xs font-bold"
              style={{
                background: 'hsl(var(--purple) / 0.15)',
                color: 'hsl(var(--purple))',
              }}
            >
              Play Again
            </button>
          </div>
        )}

      </div>

      <div
        className="glass-card rounded-xl p-3 text-xs"
        style={{ color: 'hsl(var(--muted-foreground))' }}
      >
        <div className="font-bold mb-1">Rewards</div>
        <div>
          Triple Match → 100 pts | Pair → 50 pts | All Different → 15-25 pts
        </div>
      </div>
    </div>
  );
}