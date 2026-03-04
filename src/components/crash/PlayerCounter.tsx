import React, { useState, useEffect } from 'react';

interface PlayerCounterProps {
  gameState: string;
}

export default function PlayerCounter({ gameState }: PlayerCounterProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Simulate player count
    const base = 12 + Math.floor(Math.random() * 30);
    setCount(base);

    const interval = setInterval(() => {
      setCount(prev => {
        const delta = Math.floor(Math.random() * 5) - 2;
        return Math.max(5, prev + delta);
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [gameState]);

  return (
    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
      <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'hsl(var(--green-reward))' }} />
      <span><span className="font-bold" style={{ color: 'hsl(var(--foreground))' }}>{count}</span> playing now</span>
    </div>
  );
}
