import React, { useEffect, useState } from 'react';
import { getLeaderboard } from '@/lib/api';
import { LeaderboardEntry } from '@/types/telegram';
import { useApp } from '@/context/AppContext';

export default function LeaderboardPage() {
  const { user } = useApp();
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard().then(data => {
      setLeaders(data);
      setLoading(false);
    });
  }, []);

  const myRank = user ? leaders.find(l => l.telegram_id === user.telegram_id)?.rank : null;

  function getMedalColor(rank: number) {
    if (rank === 1) return 'hsl(45 100% 55%)';
    if (rank === 2) return 'hsl(0 0% 70%)';
    if (rank === 3) return 'hsl(25 80% 55%)';
    return 'hsl(220 15% 50%)';
  }

  return (
    <div className="px-4 pb-28">
      <div className="mb-4">
        <h2 className="text-lg font-display font-bold text-gold-gradient mb-1">Leaderboard</h2>
        <p className="text-xs text-muted-foreground">Top earners worldwide</p>
      </div>

      {/* My rank */}
      {myRank && (
        <div
          className="rounded-xl p-3 mb-4 flex items-center justify-between"
          style={{
            background: 'hsl(45 100% 55% / 0.1)',
            border: '1px solid hsl(45 100% 55% / 0.3)',
          }}
        >
          <div className="text-sm font-semibold text-foreground">Your Rank</div>
          <div className="text-lg font-bold text-gold-gradient">#{myRank}</div>
        </div>
      )}

      {/* Top 3 podium */}
      {leaders.length >= 3 && (
        <div className="flex items-end justify-center gap-2 mb-6 h-32">
          {[leaders[1], leaders[0], leaders[2]].map((leader, i) => {
            const heights = ['h-20', 'h-28', 'h-16'];
            const medals = ['🥈', '🥇', '🥉'];
            const colors = ['hsl(0 0% 70%)', 'hsl(45 100% 55%)', 'hsl(25 80% 55%)'];
            return (
              <div key={leader.id} className={`flex-1 flex flex-col items-center justify-end ${heights[i]}`}>
                <div className="text-2xl mb-1">{medals[i]}</div>
                <div
                  className="w-full rounded-t-xl flex flex-col items-center justify-center p-2"
                  style={{
                    background: `linear-gradient(to top, ${colors[i]}20, ${colors[i]}10)`,
                    border: `1px solid ${colors[i]}30`,
                    borderBottom: 'none',
                    minHeight: i === 1 ? '80px' : i === 0 ? '60px' : '45px',
                  }}
                >
                  <div className="text-xs font-bold text-center truncate w-full" style={{ color: colors[i] }}>
                    {leader.first_name || leader.username || 'User'}
                  </div>
                  <div className="text-xs text-muted-foreground">{(leader.total_points || 0).toLocaleString()}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full list */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-2">
          {leaders.map(leader => {
            const isMe = user && leader.telegram_id === user.telegram_id;
            const medal = leader.rank <= 3 ? ['🥇', '🥈', '🥉'][leader.rank - 1] : null;

            return (
              <div
                key={leader.id}
                className="flex items-center gap-3 p-3 rounded-xl transition-all"
                style={{
                  background: isMe ? 'hsl(45 100% 55% / 0.1)' : 'hsl(220 25% 8% / 0.6)',
                  border: `1px solid ${isMe ? 'hsl(45 100% 55% / 0.4)' : 'hsl(220 20% 15% / 0.5)'}`,
                }}
              >
                {/* Rank */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{
                    background: medal ? `${getMedalColor(leader.rank)}20` : 'hsl(220 25% 12%)',
                    color: getMedalColor(leader.rank),
                  }}
                >
                  {medal || `#${leader.rank}`}
                </div>

                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, hsl(190 100% 55% / 0.3), hsl(265 80% 65% / 0.3))',
                  }}
                >
                  {leader.first_name?.[0] || leader.username?.[0] || '?'}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {leader.first_name || leader.username || 'Anonymous'}
                    {isMe && <span className="text-xs text-gold ml-1">(you)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">Level {leader.level}</div>
                </div>

                {/* Points */}
                <div className="text-right">
                  <div className="text-sm font-bold text-gold">
                    {(leader.total_points || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">pts</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
