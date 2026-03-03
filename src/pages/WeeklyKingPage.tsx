import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { useRewardedAd } from '@/hooks/useAdsgram';
import { supabase } from '@/integrations/supabase/client';
import { logAdWatch } from '@/lib/api';

function triggerHaptic(type: 'success' | 'error' | 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.HapticFeedback) {
    const hf = (window as any).Telegram.WebApp.HapticFeedback;
    if (type === 'impact') hf.impactOccurred('medium');
    else hf.notificationOccurred(type);
  }
}

interface WeeklyEntry {
  user_id: string;
  total_earned: number;
  first_name: string;
  username: string;
  photo_url: string | null;
  rank: number;
}

const RANK_REWARDS = [5000, 3000, 2000, 1500, 1000, 750, 500, 400, 300, 200];
const RANK_BADGES = ['👑', '🥈', '🥉', '⭐', '⭐', '🌟', '🌟', '✨', '✨', '✨'];

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const start = new Date(now.setDate(diff));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatTimeLeft(end: Date): string {
  const diff = end.getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export default function WeeklyKingPage() {
  const { user, balance, refreshBalance } = useApp();
  const [entries, setEntries] = useState<WeeklyEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myEarnings, setMyEarnings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [boostActive, setBoostActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  const { end: weekEnd } = getWeekBounds();

  // Ad hooks
  const onBoostReward = useCallback(() => {
    triggerHaptic('success');
    setBoostActive(true);
    // 10% weekly bonus: add 10% of current earnings
    const bonus = Math.floor(myEarnings * 0.1);
    if (user && bonus > 0) {
      supabase.from('balances').select('points, total_earned').eq('user_id', user.id).single().then(({ data }) => {
        if (data) {
          supabase.from('balances').update({
            points: data.points + bonus,
            total_earned: data.total_earned + bonus,
          }).eq('user_id', user.id).then(() => refreshBalance());
          supabase.from('transactions').insert({
            user_id: user.id,
            type: 'weekly_boost',
            points: bonus,
            description: `👑 Weekly King: 10% boost (+${bonus})`,
          });
        }
      });
      logAdWatch(user.id, 'weekly_boost', bonus);
    }
  }, [user, myEarnings, refreshBalance]);

  const { showAd: showBoostAd } = useRewardedAd(onBoostReward);

  // Timer
  useEffect(() => {
    setTimeLeft(formatTimeLeft(weekEnd));
    const interval = setInterval(() => setTimeLeft(formatTimeLeft(weekEnd)), 60000);
    return () => clearInterval(interval);
  }, []);

  // Load leaderboard
  useEffect(() => {
    loadWeeklyLeaderboard();
  }, [user]);

  async function loadWeeklyLeaderboard() {
    setLoading(true);
    const { start } = getWeekBounds();

    // Get transactions from this week grouped by user
    const { data: txns } = await supabase
      .from('transactions')
      .select('user_id, points')
      .gte('created_at', start.toISOString())
      .gt('points', 0);

    if (!txns || txns.length === 0) {
      setEntries([]);
      setLoading(false);
      return;
    }

    // Aggregate
    const totals: Record<string, number> = {};
    for (const tx of txns) {
      totals[tx.user_id] = (totals[tx.user_id] || 0) + tx.points;
    }

    const sorted = Object.entries(totals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20);

    const userIds = sorted.map(([uid]) => uid);
    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, username, photo_url')
      .in('id', userIds);

    const userMap: Record<string, any> = {};
    (users || []).forEach(u => { userMap[u.id] = u; });

    const result: WeeklyEntry[] = sorted.map(([uid, total], i) => ({
      user_id: uid,
      total_earned: total,
      first_name: userMap[uid]?.first_name || 'Unknown',
      username: userMap[uid]?.username || '',
      photo_url: userMap[uid]?.photo_url || null,
      rank: i + 1,
    }));

    setEntries(result);

    // Find my rank
    if (user) {
      const myIdx = result.findIndex(e => e.user_id === user.id);
      if (myIdx >= 0) {
        setMyRank(myIdx + 1);
        setMyEarnings(result[myIdx].total_earned);
      } else {
        setMyRank(null);
        setMyEarnings(totals[user.id] || 0);
      }
    }

    setLoading(false);
  }

  return (
    <div className="px-4 pb-28">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="text-6xl mb-3 animate-float">👑</div>
        <h2 className="text-2xl font-bold shimmer-text">Weekly King</h2>
        <p className="text-sm mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Top earners win rewards every week!
        </p>
      </div>

      {/* Timer */}
      <div className="glass-card rounded-2xl p-4 mb-4 text-center neon-border-gold">
        <div className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Week ends in</div>
        <div className="text-2xl font-black" style={{ color: 'hsl(var(--gold))' }}>{timeLeft}</div>
      </div>

      {/* My rank */}
      <div className="glass-card rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Your Rank</div>
            <div className="text-2xl font-black" style={{ color: myRank && myRank <= 3 ? 'hsl(var(--gold))' : 'hsl(var(--foreground))' }}>
              {myRank ? `#${myRank} ${RANK_BADGES[myRank - 1] || ''}` : 'Unranked'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>This Week</div>
            <div className="text-lg font-bold" style={{ color: 'hsl(var(--green-reward))' }}>{myEarnings.toLocaleString()}</div>
          </div>
        </div>
        {myRank && myRank <= 10 && (
          <div className="mt-2 px-3 py-1.5 rounded-xl text-xs font-bold text-center" style={{ background: 'hsl(var(--gold) / 0.15)', color: 'hsl(var(--gold))' }}>
            🎁 Prize: {RANK_REWARDS[myRank - 1]?.toLocaleString()} pts
          </div>
        )}
      </div>

      {/* Boost */}
      {!boostActive && (
        <button onClick={() => showBoostAd()} className="w-full btn-purple rounded-2xl py-3 text-sm font-bold mb-4">
          🎬 Watch Ad for 10% Weekly Boost
        </button>
      )}
      {boostActive && (
        <div className="text-center text-xs font-bold mb-4" style={{ color: 'hsl(var(--green-reward))' }}>
          ✅ 10% Boost Applied!
        </div>
      )}

      {/* Rewards info */}
      <div className="glass-card rounded-2xl p-4 mb-4">
        <div className="text-xs font-bold mb-2" style={{ color: 'hsl(var(--gold))' }}>🏆 Weekly Rewards</div>
        <div className="grid grid-cols-5 gap-1">
          {RANK_REWARDS.slice(0, 5).map((r, i) => (
            <div key={i} className="text-center">
              <div className="text-lg">{RANK_BADGES[i]}</div>
              <div className="text-[10px] font-bold" style={{ color: 'hsl(var(--gold))' }}>#{i + 1}</div>
              <div className="text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{r.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <h3 className="text-sm font-bold mb-3" style={{ color: 'hsl(var(--gold))' }}>📊 This Week's Leaderboard</h3>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-pulse text-2xl">⏳</div>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => {
            const isMe = user && entry.user_id === user.id;
            return (
              <div
                key={entry.user_id}
                className="glass-card rounded-xl p-3 flex items-center gap-3 transition-all"
                style={{
                  border: isMe ? '1px solid hsl(var(--gold) / 0.5)' : '1px solid transparent',
                  background: isMe ? 'hsl(var(--gold) / 0.05)' : undefined,
                }}
              >
                <div className="text-lg font-bold w-8 text-center" style={{ color: i < 3 ? 'hsl(var(--gold))' : 'hsl(var(--muted-foreground))' }}>
                  {i < 3 ? RANK_BADGES[i] : `#${i + 1}`}
                </div>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{
                  background: `linear-gradient(135deg, hsl(var(--${i === 0 ? 'gold' : i === 1 ? 'cyan' : i === 2 ? 'purple' : 'muted'}) / 0.3), hsl(var(--${i === 0 ? 'gold' : 'muted'}) / 0.1))`,
                }}>
                  {entry.first_name?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">
                    {entry.first_name} {isMe && <span className="text-[10px]" style={{ color: 'hsl(var(--cyan))' }}>(You)</span>}
                  </div>
                  {entry.rank <= 10 && (
                    <div className="text-[10px]" style={{ color: 'hsl(var(--gold))' }}>Prize: {RANK_REWARDS[entry.rank - 1]?.toLocaleString()}</div>
                  )}
                </div>
                <div className="font-bold text-sm" style={{ color: 'hsl(var(--gold))' }}>
                  {entry.total_earned.toLocaleString()}
                </div>
              </div>
            );
          })}
          {entries.length === 0 && (
            <div className="text-center py-8 glass-card rounded-2xl">
              <div className="text-3xl mb-2">🏜️</div>
              <div className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>No activity yet this week. Start earning!</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
