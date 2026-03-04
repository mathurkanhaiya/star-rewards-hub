import React, { useState, useEffect } from 'react';

interface BigWinAnnouncementProps {
  multiplier: number;
  winnings: number;
  show: boolean;
}

const NAMES = ['Alex', 'Maria', 'Dmitry', 'Sofia', 'Ahmed', 'Yuki', 'Carlos', 'Elena'];

export default function BigWinAnnouncement({ multiplier, winnings, show }: BigWinAnnouncementProps) {
  const [fakeWins, setFakeWins] = useState<{ name: string; mult: number; amount: number }[]>([]);

  // Periodically show fake big wins
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() < 0.3) {
        const name = NAMES[Math.floor(Math.random() * NAMES.length)];
        const mult = Math.round((3 + Math.random() * 20) * 100) / 100;
        const bet = [250, 500, 750, 1000][Math.floor(Math.random() * 4)];
        setFakeWins([{ name, mult, amount: Math.floor(bet * mult) }]);
        setTimeout(() => setFakeWins([]), 4000);
      }
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  const displayWin = show && multiplier >= 3 
    ? { name: 'You', mult: multiplier, amount: winnings }
    : fakeWins[0];

  if (!displayWin) return null;

  return (
    <div
      className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl animate-fade-in"
      style={{
        background: 'linear-gradient(135deg, hsl(var(--gold) / 0.9), hsl(var(--gold) / 0.7))',
        color: 'hsl(var(--primary-foreground))',
        boxShadow: '0 0 40px hsl(var(--gold) / 0.5)',
      }}
    >
      <div className="text-center">
        <div className="text-xs font-bold">🎉 BIG WIN!</div>
        <div className="text-sm font-black">
          {displayWin.name} won {displayWin.amount.toLocaleString()} at {displayWin.mult.toFixed(2)}x
        </div>
      </div>
    </div>
  );
}
