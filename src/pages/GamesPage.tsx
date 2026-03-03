import React from 'react';

type Page = 'home' | 'tasks' | 'spin' | 'referral' | 'leaderboard' | 'wallet' | 'notifications' | 'admin' | 'games' | 'tower' | 'miner' | 'crash' | 'lab' | 'weekly-king';

interface GamesMenuProps {
  onNavigate: (page: Page) => void;
}

const games = [
  {
    id: 'tower' as Page,
    icon: '🏗️',
    name: 'Tower Climb',
    desc: 'Tap at the right time to climb infinite floors. How high can you go?',
    color: 'gold',
  },
  {
    id: 'crash' as Page,
    icon: '🚀',
    name: 'Crash Multiplier',
    desc: 'Watch the multiplier rise. Cash out before it crashes!',
    color: 'destructive',
  },
  {
    id: 'lab' as Page,
    icon: '🔬',
    name: 'Upgrade Lab',
    desc: 'Build machines that generate income automatically. Upgrade & grow!',
    color: 'cyan',
  },
  {
    id: 'miner' as Page,
    icon: '⛏️',
    name: 'Idle Miner',
    desc: 'Build your mining empire! Earn coins per second, upgrade & collect.',
    color: 'purple',
  },
  {
    id: 'weekly-king' as Page,
    icon: '👑',
    name: 'Weekly King',
    desc: 'Compete for the top earner crown. Top 10 win weekly rewards!',
    color: 'gold',
  },
];

function GamesMenu({ onNavigate }: GamesMenuProps) {
  return (
    <div className="px-4 pb-28">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2 animate-float">🎮</div>
        <h2 className="text-2xl font-bold shimmer-text">Games</h2>
        <p className="text-sm mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Play games, earn points & climb leaderboards!
        </p>
      </div>

      <div className="space-y-3">
        {games.map(game => (
          <button
            key={game.id}
            onClick={() => onNavigate(game.id)}
            className="w-full glass-card rounded-2xl p-5 text-left transition-all active:scale-[0.97]"
            style={{ border: `1px solid hsl(var(--${game.color}) / 0.3)` }}
          >
            <div className="flex items-center gap-4">
              <div className="text-4xl">{game.icon}</div>
              <div className="flex-1">
                <div className="font-bold text-lg">{game.name}</div>
                <div className="text-xs mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {game.desc}
                </div>
              </div>
              <div style={{ color: `hsl(var(--${game.color}))` }}>→</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default GamesMenu;
export type { Page };
