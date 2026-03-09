import React, { useState, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { useRewardedAd } from '@/hooks/useAdsgram';
import { logAdWatch } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';

function triggerHaptic(type: 'success' | 'error' | 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.HapticFeedback) {
    const hf = (window as any).Telegram.WebApp.HapticFeedback;
    if (type === 'impact') hf.impactOccurred('medium');
    else hf.notificationOccurred(type);
  }
}

interface BoxReward {
  points: number;
  label: string;
  emoji: string;
  tier: 'empty' | 'small' | 'medium' | 'big' | 'jackpot';
}

const BOX_EMOJIS = ['🎁', '📦', '🎀', '💎', '🏆'];

// Weighted reward pool — user feels wins but net is loss
function generateReward(): BoxReward {
  const r = Math.random();
  if (r < 0.30) return { points: 0, label: 'Empty!', emoji: '💨', tier: 'empty' };
  if (r < 0.55) return { points: 5, label: '+5 Points', emoji: '🪙', tier: 'small' };
  if (r < 0.75) return { points: 15, label: '+15 Points', emoji: '✨', tier: 'small' };
  if (r < 0.88) return { points: 50, label: '+50 Points', emoji: '🔥', tier: 'medium' };
  if (r < 0.96) return { points: 150, label: '+150 Points', emoji: '💰', tier: 'big' };
  return { points: 500, label: '+500 Points!', emoji: '🏆', tier: 'jackpot' };
}

type GameState = 'idle' | 'watching' | 'picking' | 'revealing' | 'result';

export default function LuckyBoxPage() {
  const { user, balance, refreshBalance } = useApp();
  const [gameState, setGameState] = useState<GameState>('idle');
  const [selectedBox, setSelectedBox] = useState<number | null>(null);
  const [reward, setReward] = useState<BoxReward | null>(null);
  const [revealedBoxes, setRevealedBoxes] = useState<(BoxReward | null)[]>([null, null, null, null, null]);
  const [totalPlayed, setTotalPlayed] = useState(0);
  const [totalWon, setTotalWon] = useState(0);

  const onAdReward = useCallback(() => {
    setGameState('picking');
  }, []);

  const { showAd } = useRewardedAd(onAdReward);

  const handleWatchAd = async () => {
    setGameState('watching');
    const ok = await showAd();
    if (!ok) {
      setGameState('idle');
    }
    // Log ad watch
    if (user) {
      logAdWatch(user.id, 'lucky_box', 0);
    }
  };

  const handlePickBox = async (index: number) => {
    if (gameState !== 'picking' || selectedBox !== null) return;

    triggerHaptic('impact');
    setSelectedBox(index);
    setGameState('revealing');

    // Generate rewards for all boxes
    const allRewards = Array.from({ length: 5 }, () => generateReward());
    // The picked box gets a fresh reward
    const pickedReward = allRewards[index];

    // Reveal animation — show picked box first, then others
    await new Promise(r => setTimeout(r, 800));

    const newRevealed = [...allRewards];
    setRevealedBoxes(newRevealed);
    setReward(pickedReward);
    setTotalPlayed(p => p + 1);

    if (pickedReward.points > 0) {
      triggerHaptic('success');
      setTotalWon(w => w + pickedReward.points);

      // Add points to balance
      if (user) {
        const { data: bal } = await supabase
          .from('balances')
          .select('points, total_earned')
          .eq('user_id', user.id)
          .single();

        if (bal) {
          await supabase.from('balances').update({
            points: bal.points + pickedReward.points,
            total_earned: bal.total_earned + pickedReward.points,
          }).eq('user_id', user.id);

          await supabase.from('transactions').insert({
            user_id: user.id,
            type: 'lucky_box',
            points: pickedReward.points,
            description: `🎁 Lucky Box: ${pickedReward.label}`,
          });
        }
        refreshBalance();
      }
    } else {
      triggerHaptic('error');
    }

    setGameState('result');
  };

  const resetGame = () => {
    setGameState('idle');
    setSelectedBox(null);
    setReward(null);
    setRevealedBoxes([null, null, null, null, null]);
  };

  const tierColor = (tier: string) => {
    switch (tier) {
      case 'jackpot': return 'hsl(var(--gold))';
      case 'big': return 'hsl(var(--green-reward))';
      case 'medium': return 'hsl(var(--cyan))';
      case 'small': return 'hsl(var(--muted-foreground))';
      default: return 'hsl(var(--destructive))';
    }
  };

  return (
    <div className="px-4 pb-28">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="text-5xl mb-2 animate-float">🎁</div>
        <h2 className="text-2xl font-bold shimmer-text">Lucky Box</h2>
        <p className="text-sm mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Watch an ad, pick a box, win prizes!
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="glass-card rounded-xl p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>Balance</div>
          <div className="font-bold text-sm" style={{ color: 'hsl(var(--gold))' }}>
            {balance?.points?.toLocaleString() ?? 0}
          </div>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>Played</div>
          <div className="font-bold text-sm">{totalPlayed}</div>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>Won</div>
          <div className="font-bold text-sm" style={{ color: 'hsl(var(--green-reward))' }}>
            {totalWon.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Game Area */}
      <div className="glass-card rounded-2xl p-5 mb-4" style={{ border: '1px solid hsl(var(--gold) / 0.2)' }}>
        {/* Idle — Watch Ad to Play */}
        {gameState === 'idle' && (
          <div className="text-center">
            <div className="text-6xl mb-4">🎬</div>
            <p className="text-sm mb-4" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Watch a short ad to unlock 5 mystery boxes
            </p>
            <button
              onClick={handleWatchAd}
              className="w-full py-4 rounded-xl font-bold text-lg transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--gold)), hsl(var(--gold) / 0.7))',
                color: 'hsl(220 30% 5%)',
                boxShadow: '0 4px 20px hsl(var(--gold) / 0.3)',
              }}
            >
              📺 WATCH AD & PLAY
            </button>
          </div>
        )}

        {/* Watching Ad */}
        {gameState === 'watching' && (
          <div className="text-center py-8">
            <div className="text-4xl mb-3 animate-pulse">📺</div>
            <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Loading ad...
            </p>
          </div>
        )}

        {/* Picking — Choose a Box */}
        {(gameState === 'picking' || gameState === 'revealing' || gameState === 'result') && (
          <div>
            <div className="text-center mb-4">
              <p className="font-bold text-sm" style={{ 
                color: gameState === 'picking' ? 'hsl(var(--gold))' : 'hsl(var(--muted-foreground))'
              }}>
                {gameState === 'picking' ? '👆 Pick a box!' : gameState === 'revealing' ? '✨ Revealing...' : ''}
              </p>
            </div>

            {/* Boxes Grid */}
            <div className="grid grid-cols-5 gap-2 mb-4">
              {BOX_EMOJIS.map((emoji, i) => {
                const isRevealed = revealedBoxes[i] !== null;
                const isPicked = selectedBox === i;
                const boxReward = revealedBoxes[i];

                return (
                  <button
                    key={i}
                    onClick={() => handlePickBox(i)}
                    disabled={gameState !== 'picking'}
                    className="relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all"
                    style={{
                      background: isRevealed
                        ? isPicked
                          ? `linear-gradient(135deg, ${tierColor(boxReward!.tier)} / 0.3, hsl(220 25% 10%))`
                          : 'hsl(220 25% 8%)'
                        : 'linear-gradient(135deg, hsl(220 25% 15%), hsl(220 25% 10%))',
                      border: isPicked && isRevealed
                        ? `2px solid ${tierColor(boxReward!.tier)}`
                        : '1px solid hsl(220 20% 20%)',
                      transform: gameState === 'picking' ? 'scale(1)' : 'scale(1)',
                      cursor: gameState === 'picking' ? 'pointer' : 'default',
                    }}
                  >
                    {isRevealed ? (
                      <div className="text-center">
                        <div className="text-xl">{boxReward!.emoji}</div>
                        <div className="text-[9px] font-bold mt-0.5" style={{ color: tierColor(boxReward!.tier) }}>
                          {boxReward!.points > 0 ? `+${boxReward!.points}` : '0'}
                        </div>
                      </div>
                    ) : (
                      <div className="text-3xl" style={{
                        animation: gameState === 'picking' ? 'pulse 2s infinite' : 'none',
                      }}>
                        {emoji}
                      </div>
                    )}
                    {isPicked && isRevealed && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px]"
                        style={{ background: tierColor(boxReward!.tier) }}>
                        ✓
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Result */}
            {gameState === 'result' && reward && (
              <div className="text-center">
                <div className="text-4xl mb-2">{reward.emoji}</div>
                <div className="text-xl font-bold mb-1" style={{ color: tierColor(reward.tier) }}>
                  {reward.label}
                </div>
                <p className="text-xs mb-4" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {reward.points > 0 ? 'Nice pick! Points added to your balance.' : 'Better luck next time!'}
                </p>
                <button
                  onClick={resetGame}
                  className="w-full py-3 rounded-xl font-bold transition-all active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, hsl(var(--gold)), hsl(var(--gold) / 0.7))',
                    color: 'hsl(220 30% 5%)',
                  }}
                >
                  📺 Watch Ad & Play Again
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reward Tiers Info */}
      <div className="glass-card rounded-xl p-4">
        <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Possible Rewards
        </div>
        <div className="space-y-1.5">
          {[
            { emoji: '🏆', label: '500 Points', tier: 'jackpot' },
            { emoji: '💰', label: '150 Points', tier: 'big' },
            { emoji: '🔥', label: '50 Points', tier: 'medium' },
            { emoji: '✨', label: '15 Points', tier: 'small' },
            { emoji: '🪙', label: '5 Points', tier: 'small' },
            { emoji: '💨', label: 'Empty', tier: 'empty' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span>{item.emoji}</span>
              <span style={{ color: tierColor(item.tier) }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
