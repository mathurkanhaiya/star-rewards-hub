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
   COUNT UP COMPONENT
================================ */
function AnimatedPoints({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);

  useEffect(() => {
    let start = previous.current;
    const diff = value - start;
    const duration = 600;
    const steps = 30;
    const increment = diff / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      start += increment;
      if (currentStep >= steps) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(start));
      }
    }, duration / steps);

    previous.current = value;
    return () => clearInterval(timer);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

function formatCountdown(endsAt?: string) {
  if (!endsAt) return '';
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
  const [contestLeaders, setContestLeaders] = useState<any[]>([]);
  const [referralLeaders, setReferralLeaders] = useState<any[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<LeaderboardTab>('points');

  useEffect(() => {
    loadData();
  }, [tab]);

  async function loadData() {
    setLoading(true);
    try {
      if (tab === 'points') {
        const data = await getLeaderboard();
        const newLeaders = data || [];

        const prev: Record<number, number> = {};
        leaders.forEach(l => {
          prev[l.telegram_id] = l.rank;
        });

        setPreviousRanks(prev);
        setLeaders(newLeaders);
      }

      if (tab === 'ads' || tab === 'referrals') {
        const active = (await getActiveContests()) || [];
        setContests(active);

        const contestType =
          tab === 'ads' ? 'ads_watch' : 'referral';

        const activeContest = active.find(
          (c: Contest) => c.contest_type === contestType
        );

        if (activeContest) {
          const entries = await getContestLeaderboard(activeContest.id);
          setContestLeaders(entries || []);
          setReferralLeaders([]);
        } else if (tab === 'referrals') {
          const data = await getReferralLeaderboard();
          setReferralLeaders(data || []);
          setContestLeaders([]);
        }
      }
    } catch (err) {
      console.error('Leaderboard error:', err);
    }
    setLoading(false);
  }

  const myRank =
    user && leaders.length > 0
      ? leaders.find(l => l.telegram_id === user.telegram_id)?.rank
      : null;

  return (
    <div className="px-4 pb-28 text-white">

      <div className="mb-5">
        <h2 className="text-xl font-bold">Leaderboard</h2>
        <p className="text-xs text-gray-400">
          Compete and climb the ranks
        </p>
      </div>

      {tab === 'points' && myRank && (
        <div className="p-3 mb-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-center font-bold">
          Your Rank: #{myRank}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-500">
          Loading...
        </div>
      ) : (
        <div className="space-y-3">
          {leaders.map((leader, index) => {
            const isMe =
              user &&
              leader.telegram_id === user.telegram_id;

            const availablePoints =
              leader.points ??
              (leader as any).available_points ??
              0;

            const previousRank = previousRanks[leader.telegram_id];
            let movement: 'up' | 'down' | 'new' | null = null;

            if (previousRank) {
              if (leader.rank < previousRank) {
                movement = 'up';
                triggerHaptic('success');
              } else if (leader.rank > previousRank) {
                movement = 'down';
              }
            } else {
              movement = 'new';
            }

            const openChat = () => {
              triggerHaptic();
              if (leader.username) {
                window.open(`https://t.me/${leader.username}`, '_blank');
              } else if (leader.telegram_id) {
                window.open(`tg://user?id=${leader.telegram_id}`);
              }
            };

            return (
              <div
                key={leader.id}
                onClick={openChat}
                className="flex items-center justify-between p-4 rounded-2xl cursor-pointer transition active:scale-[0.96]"
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
                  <div className="relative w-8 text-yellow-400 font-bold">
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
                      {movement === 'new' && (
                        <span className="text-blue-400 text-xs">NEW</span>
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

                {/* Animated Points */}
                <div className="text-right">
                  <div className="font-bold text-yellow-400 text-lg">
                    <AnimatedPoints value={availablePoints} />
                  </div>
                  <div className="text-xs text-gray-500">
                    pts available
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating crown animation keyframe */}
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