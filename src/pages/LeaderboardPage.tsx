import React, { useEffect, useState, useRef } from 'react';
import {
  getLeaderboard,
  getActiveContests,
  getContestLeaderboard,
  getReferralLeaderboard,
} from '@/lib/api';
import { LeaderboardEntry, Contest } from '@/types/telegram';
import { useApp } from '@/context/AppContext';

type LeaderboardTab = 'points' | 'ads' | 'referrals';

/* ===============================
   TELEGRAM HAPTIC
================================ */
function triggerHaptic(type: 'impact' | 'success' = 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;
    if (type === 'success') {
      tg?.HapticFeedback?.notificationOccurred('success');
    } else {
      tg?.HapticFeedback?.impactOccurred('medium');
    }
  }
}

/* ===============================
   ANIMATED COUNTER
================================ */
function AnimatedPoints({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    let start = prev.current;
    const diff = value - start;
    const duration = 600;
    const steps = 30;
    const increment = diff / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      start += increment;

      if (step >= steps) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(start));
      }
    }, duration / steps);

    prev.current = value;
    return () => clearInterval(timer);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

function formatCountdown(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor((diff / (1000 * 60)) % 60);
  return `${h}h ${m}m`;
}

export default function LeaderboardPage() {
  const { user } = useApp();

  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [previousRanks, setPreviousRanks] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<LeaderboardTab>('points');
  const [contests, setContests] = useState<Contest[]>([]);
  const [contestLeaders, setContestLeaders] = useState<any[]>([]);
  const [referralLeaders, setReferralLeaders] = useState<any[]>([]);

  /* AUTO REFRESH */
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [tab]);

  async function loadData() {
    setLoading(true);

    if (tab === 'points') {
      const data = await getLeaderboard();
      const newLeaders = data || [];

      const prev: Record<number, number> = {};
      leaders.forEach(l => {
        prev[l.telegram_id] = l.rank;
      });

      setPreviousRanks(prev);
      setLeaders(newLeaders);
    } else if (tab === 'ads') {
      const activeContests = await getActiveContests();
      setContests(activeContests as Contest[]);
      if (activeContests.length > 0) {
        const adContest = activeContests.find(
          (c: { contest_type: string }) => c.contest_type === 'ads_watch'
        );
        if (adContest) {
          const entries = await getContestLeaderboard(adContest.id);
          setContestLeaders(entries || []);
        }
      }
    } else if (tab === 'referrals') {
      const activeContests = await getActiveContests();
      const refContest = (activeContests as Contest[]).find(
        c => c.contest_type === 'referral'
      );
      setContests(activeContests as Contest[]);
      if (refContest) {
        const entries = await getContestLeaderboard(refContest.id);
        setContestLeaders(entries || []);
      } else {
        const data = await getReferralLeaderboard();
        setReferralLeaders(data || []);
      }
    }

    setLoading(false);
  }

  const myRank = user
    ? leaders.find(l => l.telegram_id === user.telegram_id)?.rank
    : null;

  const activeContest =
    tab === 'ads'
      ? contests.find(c => c.contest_type === 'ads_watch')
      : tab === 'referrals'
      ? contests.find(c => c.contest_type === 'referral')
      : null;

  return (
    <div className="px-4 pb-28 text-white">

      <div className="mb-4">
        <h2 className="text-lg font-bold">Leaderboard</h2>
        <p className="text-xs text-gray-400">Compete & win rewards</p>
      </div>

      {/* My rank */}
      {tab === 'points' && myRank && (
        <div className="rounded-xl p-3 mb-4 bg-yellow-500/10 border border-yellow-500/30 text-center font-bold">
          Your Rank: #{myRank}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-3">
          {leaders.map(leader => {
            const isMe =
              user && leader.telegram_id === user.telegram_id;

            const totalPoints =
              leader.total_points ?? leader.points ?? 0;

            const previousRank = previousRanks[leader.telegram_id];
            let movement: 'up' | 'down' | null = null;

            if (previousRank) {
              if (leader.rank < previousRank) {
                movement = 'up';
                triggerHaptic('success');
              } else if (leader.rank > previousRank) {
                movement = 'down';
              }
            }

            const openChat = () => {
              triggerHaptic();
              if (leader.username) {
                window.open(`https://t.me/${leader.username}`, '_blank');
              } else {
                window.open(`tg://user?id=${leader.telegram_id}`);
              }
            };

            return (
              <div
                key={leader.id}
                onClick={openChat}
                className="flex items-center justify-between p-4 rounded-2xl cursor-pointer transition active:scale-[0.97]"
                style={{
                  background: isMe
                    ? 'rgba(250,204,21,0.12)'
                    : 'rgba(17,24,39,0.85)',
                  border: isMe
                    ? '1px solid rgba(250,204,21,0.5)'
                    : '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div className="flex items-center gap-3">

                  {/* Rank + Crown */}
                  <div className="relative text-yellow-400 font-bold w-8">
                    #{leader.rank}
                    {leader.rank === 1 && (
                      <span
                        style={{
                          position: 'absolute',
                          top: -12,
                          left: 2,
                          animation: 'float 2s ease-in-out infinite',
                          filter: 'drop-shadow(0 0 8px gold)'
                        }}
                      >
                        👑
                      </span>
                    )}
                  </div>

                  {/* PFP */}
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700">
                    {leader.photo_url ? (
                      <img
                        src={leader.photo_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        {leader.first_name?.[0] || '?'}
                      </div>
                    )}
                  </div>

                  {/* Name + Movement */}
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {leader.first_name ||
                        leader.username ||
                        'User'}

                      {movement === 'up' && (
                        <span className="text-green-400 animate-pulse">↑</span>
                      )}
                      {movement === 'down' && (
                        <span className="text-red-400 animate-pulse">↓</span>
                      )}

                      {isMe && (
                        <span className="text-yellow-400 text-xs">(you)</span>
                      )}
                    </div>

                    <div className="text-xs text-gray-500">
                      UID: {leader.telegram_id}
                    </div>
                  </div>
                </div>

                {/* Animated Total Points */}
                <div className="text-right">
                  <div className="font-bold text-yellow-400 text-lg">
                    <AnimatedPoints value={totalPoints} />
                  </div>
                  <div className="text-xs text-gray-500">
                    total pts
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>
        {`
          @keyframes float {
            0% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
            100% { transform: translateY(0); }
          }
        `}
      </style>
    </div>
  );
}