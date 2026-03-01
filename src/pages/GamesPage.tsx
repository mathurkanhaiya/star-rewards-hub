import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';

type Page = 'home' | 'tasks' | 'spin' | 'referral' | 'leaderboard' | 'wallet' | 'notifications' | 'admin' | 'games' | 'tower' | 'miner';

interface GamesMenuProps {
  onNavigate: (page: Page) => void;
}

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

      <div className="space-y-4">
        <button
          onClick={() => onNavigate('tower')}
          className="w-full glass-card rounded-2xl p-5 text-left transition-all active:scale-[0.97]"
          style={{ border: '1px solid hsl(var(--gold) / 0.3)' }}
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl">🏗️</div>
            <div className="flex-1">
              <div className="font-bold text-lg">Tower Climb</div>
              <div className="text-xs mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Tap at the right time to climb infinite floors. How high can you go?
              </div>
            </div>
            <div style={{ color: 'hsl(var(--gold))' }}>→</div>
          </div>
        </button>

        <button
          onClick={() => onNavigate('miner')}
          className="w-full glass-card rounded-2xl p-5 text-left transition-all active:scale-[0.97]"
          style={{ border: '1px solid hsl(var(--purple) / 0.3)' }}
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl">⛏️</div>
            <div className="flex-1">
              <div className="font-bold text-lg">Idle Miner</div>
              <div className="text-xs mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Build your mining empire! Earn coins per second, upgrade & collect.
              </div>
            </div>
            <div style={{ color: 'hsl(var(--purple))' }}>→</div>
          </div>
        </button>
      </div>
    </div>
  );
}

export default GamesMenu;
export type { Page };
