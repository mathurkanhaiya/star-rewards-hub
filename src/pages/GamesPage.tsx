import React from 'react';
import PromoSection from '@/components/games/PromoSection';

type Page =
  | 'home'
  | 'tasks'
  | 'spin'
  | 'referral'
  | 'leaderboard'
  | 'wallet'
  | 'notifications'
  | 'admin'
  | 'games'
  | 'tower'
  | 'dice'
  | 'cardflip'
  | 'numberguess'
  | 'luckybox';

interface GamesMenuProps {
  onNavigate: (page: Page) => void;
}

const games = [
  {
    id: 'tower' as Page,
    icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773236274906-2cbfc5e2.gif',
    name: 'Tower Climb',
    desc: 'Tap at the right time to climb infinite floors. How high can you go?',
    color: 'gold',
  },
  {
    id: 'luckybox' as Page,
    icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773236074591-d9f8b5e0.gif',
    name: 'Lucky Box',
    desc: 'Watch an ad, pick a mystery box, win big prizes!',
    color: 'gold',
  },
  {
    id: 'dice' as Page,
    icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773236312067-54b2669f.gif',
    name: 'Dice Roll',
    desc: 'Watch an ad, roll two dice, earn 10–100 points!',
    color: 'cyan',
  },
  {
    id: 'cardflip' as Page,
    icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773236194044-d5413577.gif',
    name: 'Card Flip',
    desc: 'Watch an ad, flip 3 cards — match them for big rewards!',
    color: 'purple',
  },
  {
    id: 'numberguess' as Page,
    icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773236388452-80bcfe97.gif',
    name: 'Number Guess',
    desc: 'Watch an ad, guess the hidden number, closer = more points!',
    color: 'cyan',
  },
];

function GamesMenu({ onNavigate }: GamesMenuProps) {
  return (
    <div className="px-4 pb-28">
      <div className="text-center mb-6">

        {/* Header GIF */}
        <img
          src="https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773233806742-9483b1e2.gif"
          alt="Games"
          className="w-20 h-20 mx-auto mb-2 object-contain animate-float drop-shadow-lg"
        />

        <h2 className="text-2xl font-bold shimmer-text">Games</h2>

        <p
          className="text-sm mt-1"
          style={{ color: 'hsl(var(--muted-foreground))' }}
        >
          Play games, earn points & climb leaderboards!
        </p>
      </div>

      <PromoSection />

      <div className="space-y-3">

        {games.map((game) => (
          <button
            key={game.id}
            onClick={() => onNavigate(game.id)}
            className="game-card w-full rounded-2xl p-5 text-left"
            style={{ border: `1px solid hsl(var(--${game.color}) / 0.3)` }}
          >
            <div className="flex items-center gap-4">

              {/* Game Icon */}
              <div className="game-icon">
                <img
                  src={game.icon}
                  alt={game.name}
                  className="w-14 h-14 object-contain"
                />
              </div>

              <div className="flex-1">
                <div className="font-bold text-lg">{game.name}</div>

                <div
                  className="text-xs mt-1"
                  style={{ color: 'hsl(var(--muted-foreground))' }}
                >
                  {game.desc}
                </div>
              </div>

              <div className="game-arrow">→</div>

            </div>
          </button>
        ))}

      </div>
    </div>
  );
}

export default GamesMenu;
export type { Page };