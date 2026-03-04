import React, { useState, useEffect } from 'react';

interface CrashHistoryProps {
  latestCrash?: number;
}

const FAKE_HISTORY = [2.41, 1.0, 1.23, 5.67, 1.0, 1.87, 1.0, 3.12, 1.45, 1.0, 1.09, 8.34, 1.0, 1.56, 2.89, 1.0, 1.0, 1.34, 4.21, 1.0];

export default function CrashHistory({ latestCrash }: CrashHistoryProps) {
  const [history, setHistory] = useState<number[]>(() => FAKE_HISTORY.slice(0, 15));

  useEffect(() => {
    if (latestCrash && latestCrash > 0) {
      setHistory(prev => [latestCrash, ...prev].slice(0, 20));
    }
  }, [latestCrash]);

  function getColor(mult: number) {
    if (mult <= 1.0) return 'hsl(var(--destructive))';
    if (mult < 2.0) return 'hsl(var(--muted-foreground))';
    if (mult < 5.0) return 'hsl(var(--green-reward))';
    if (mult < 10.0) return 'hsl(var(--cyan))';
    return 'hsl(var(--gold))';
  }

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
        {history.map((m, i) => (
          <div
            key={`${i}-${m}`}
            className="shrink-0 px-2 py-1 rounded-lg text-[11px] font-bold transition-all"
            style={{
              color: getColor(m),
              background: `${getColor(m)}15`,
              border: `1px solid ${getColor(m)}30`,
              animation: i === 0 ? 'scale-in 0.3s ease-out' : undefined,
            }}
          >
            {m.toFixed(2)}x
          </div>
        ))}
      </div>
    </div>
  );
}
