import React, { useState, useEffect, useRef } from 'react';

interface FakeBet {
  id: string;
  name: string;
  amount: number;
  cashedOut?: number;
  profit?: number;
}

const NAMES = ['Alex', 'Maria', 'Dmitry', 'Sofia', 'Ahmed', 'Yuki', 'Carlos', 'Elena', 'Kim', 'Ivan', 'Liam', 'Priya', 'Olga', 'Amir', 'Nina', 'Raj', 'Vera', 'Leo', 'Zara', 'Max'];

function randomName() {
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}

function randomBet() {
  const amounts = [100, 250, 500, 750, 1000];
  return amounts[Math.floor(Math.random() * amounts.length)];
}

interface LiveBetsProps {
  gameState: string;
  multiplier: number;
  crashPoint: number;
}

export default function LiveBets({ gameState, multiplier, crashPoint }: LiveBetsProps) {
  const [bets, setBets] = useState<FakeBet[]>([]);
  const intervalRef = useRef<NodeJS.Timeout>();

  // Generate fake bets when betting phase starts
  useEffect(() => {
    if (gameState === 'betting' || gameState === 'running') {
      const count = 5 + Math.floor(Math.random() * 10);
      const fakeBets: FakeBet[] = Array.from({ length: count }, (_, i) => ({
        id: `fb-${Date.now()}-${i}`,
        name: randomName(),
        amount: randomBet(),
      }));
      setBets(fakeBets);
    }
  }, [gameState === 'betting']);

  // Simulate cashouts during running
  useEffect(() => {
    if (gameState !== 'running') return;

    intervalRef.current = setInterval(() => {
      setBets(prev => {
        const uncashed = prev.filter(b => !b.cashedOut);
        if (uncashed.length === 0) return prev;

        // Random chance to cash out 1 bot
        if (Math.random() < 0.3) {
          const idx = Math.floor(Math.random() * uncashed.length);
          const bot = uncashed[idx];
          return prev.map(b =>
            b.id === bot.id
              ? { ...b, cashedOut: multiplier, profit: Math.floor(bot.amount * multiplier) - bot.amount }
              : b
          );
        }
        return prev;
      });
    }, 800);

    return () => clearInterval(intervalRef.current);
  }, [gameState, multiplier]);

  // On crash, mark remaining as lost
  useEffect(() => {
    if (gameState === 'crashed') {
      setBets(prev => prev.map(b => b.cashedOut ? b : { ...b, cashedOut: -1, profit: -b.amount }));
    }
  }, [gameState]);

  if (gameState !== 'running' && gameState !== 'crashed' && gameState !== 'cashout') return null;

  const sorted = [...bets].sort((a, b) => {
    if (a.cashedOut && !b.cashedOut) return -1;
    if (!a.cashedOut && b.cashedOut) return 1;
    return (b.amount - a.amount);
  });

  return (
    <div className="glass-card rounded-xl p-3 mb-3 max-h-40 overflow-y-auto">
      <div className="text-[10px] font-bold mb-2 uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>
        Live Bets ({bets.length})
      </div>
      <div className="space-y-1">
        {sorted.slice(0, 8).map(b => (
          <div key={b.id} className="flex items-center justify-between text-[11px]">
            <span className="font-medium truncate w-16">{b.name}</span>
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>{b.amount}</span>
            {b.cashedOut ? (
              b.cashedOut > 0 ? (
                <span className="font-bold" style={{ color: 'hsl(var(--green-reward))' }}>
                  {b.cashedOut.toFixed(2)}x +{b.profit}
                </span>
              ) : (
                <span className="font-bold" style={{ color: 'hsl(var(--destructive))' }}>💥</span>
              )
            ) : (
              <span className="animate-pulse" style={{ color: 'hsl(var(--gold))' }}>playing...</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
