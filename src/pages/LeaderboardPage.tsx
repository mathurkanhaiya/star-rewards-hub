import React, { useEffect, useState, useRef } from 'react';
import {
  getLeaderboard,
  getActiveContests,
  getContestLeaderboard
} from '@/lib/api';
import { LeaderboardEntry, Contest } from '@/types/telegram';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';

type LeaderboardTab = 'points' | 'ads';
type AdsSubTab = 'alltime' | 'today';

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
   ANIMATED POINTS
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

    previous.current = value;
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
  const [contestLeaders, setContestLeaders] = useState<any[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<LeaderboardTab>('points');
  const [adsSubTab, setAdsSubTab] = useState<AdsSubTab>('alltime');
  const [adLeaders, setAdLeaders] = useState<any[]>([]);

  /* AUTO REFRESH */
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [tab, adsSubTab]);

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
    }

    if (tab === 'ads') {
      // Load contest info
      const activeContests = await getActiveContests();
      setContests(activeContests as Contest[]);

      // Query ad_logs directly for leaderboard
      let query = supabase
        .from('ad_logs')
        .select('user_id');

      if (adsSubTab === 'today') {
        const now = new Date();
        const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
        query = query.gte('created_at', startOfDay);
      }

      const { data: adLogs } = await query;

      // Aggregate by user_id
      const counts: Record<string, number> = {};
      (adLogs || []).forEach((log: any) => {
        counts[log.user_id] = (counts[log.user_id] || 0) + 1;
      });

      // Sort by count desc
      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50);

      // Fetch user info
      const userIds = sorted.map(([uid]) => uid);
      const { data: users } = await supabase
        .from('users')
        .select('id, first_name, username, telegram_id, photo_url')
        .in('id', userIds.length > 0 ? userIds : ['none']);

      const userMap: Record<string, any> = {};
      (users || []).forEach(u => { userMap[u.id] = u; });

      setAdLeaders(sorted.map(([uid, score]) => ({
        user_id: uid,
        score,
        users: userMap[uid] || {},
      })));
    }

    setLoading(false);
  }

  const myRank =
    user && leaders.length > 0
      ? leaders.find(l => l.telegram_id === user.telegram_id)?.rank
      : null;

  const activeContest =
    tab === 'ads'
      ? contests.find(c => c.contest_type === 'ads_watch')
      : null;

  return (
    <div className="px-4 pb-28 text-white">

      <div className="mb-4">
        <h2 className="text-lg font-bold">Leaderboard</h2>
        <p className="text-xs text-gray-400">
          Compete & win rewards
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl bg-[#111827]">
        {[
          { id: 'points', label: 'Points', icon: '⚡' },
          { id: 'ads', label: 'Ads Watch', icon: '🎬' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => {
              triggerHaptic();
              setTab(t.id as LeaderboardTab);
            }}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
            style={{
              background:
                tab === t.id
                  ? 'linear-gradient(135deg,#facc15,#f97316)'
                  : 'transparent',
              color:
                tab === t.id ? '#111' : '#9ca3af'
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Active Contest */}
      {activeContest && (
        <div className="rounded-xl p-3 mb-4 bg-[#1f2937] border border-yellow-500/30">
          <div className="font-bold mb-1">
            🏆 {activeContest.title}
          </div>
          <div className="text-xs text-gray-400">
            Ends in {formatCountdown(activeContest.ends_at)}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-400">
          Loading...
        </div>
      ) : tab === 'points' ? (
        <div className="space-y-3">
          {leaders.map(leader => {
            const isMe =
              user && leader.telegram_id === user.telegram_id;

            const totalPoints =
              leader.total_points ?? (leader as any).points ?? 0;

            const previousRank =
              previousRanks[leader.telegram_id];

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
                className="flex items-center justify-between p-4 rounded-xl cursor-pointer transition active:scale-[0.97]"
                style={{
                  background: isMe
                    ? 'rgba(250,204,21,0.12)'
                    : 'rgba(17,24,39,0.85)',
                  border: isMe
                    ? '1px solid rgba(250,204,21,0.5)'
                    : '1px solid rgba(255,255,255,0.05)'
                }}
              >
                <div className="flex items-center gap-3">

                  <div className="relative font-bold text-yellow-400 w-8">
                    #{leader.rank}
                    {leader.rank === 1 && (
                      <span
                        style={{
                          position: 'absolute',
                          top: -12,
                          left: 2,
                          animation: 'float 2s ease-in-out infinite'
                        }}
                      >
                        👑
                      </span>
                    )}
                  </div>

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
      ) : (
        <>
          {/* Ads Sub-Tabs */}
          <div className="flex gap-1 mb-4 p-1 rounded-lg bg-[#0f172a]">
            {[
              { id: 'alltime', label: 'All Time Watch' },
              { id: 'today', label: 'Today Watch' },
            ].map(st => (
              <button
                key={st.id}
                onClick={() => {
                  triggerHaptic();
                  setAdsSubTab(st.id as AdsSubTab);
                }}
                className="flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all"
                style={{
                  background: adsSubTab === st.id ? 'rgba(250,204,21,0.2)' : 'transparent',
                  color: adsSubTab === st.id ? '#facc15' : '#6b7280',
                  border: adsSubTab === st.id ? '1px solid rgba(250,204,21,0.4)' : '1px solid transparent',
                }}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {adLeaders.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">
                No ad watches {adsSubTab === 'today' ? 'today' : 'yet'}
              </div>
            )}
            {adLeaders.map((entry: any, i: number) => {
              const openChat = () => {
                triggerHaptic();
                if (entry.users?.username) {
                  window.open(`https://t.me/${entry.users.username}`, '_blank');
                } else {
                  window.open(`tg://user?id=${entry.users?.telegram_id}`);
                }
              };

              return (
                <div
                  key={entry.user_id}
                  onClick={openChat}
                  className="flex items-center justify-between p-4 rounded-xl cursor-pointer bg-[#111827] border border-white/5 transition active:scale-[0.97]"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative font-bold text-yellow-400 w-8">
                      #{i + 1}
                      {i === 0 && (
                        <span style={{ position: 'absolute', top: -12, left: 2, animation: 'float 2s ease-in-out infinite' }}>
                          👑
                        </span>
                      )}
                    </div>

                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700">
                      {entry.users?.photo_url ? (
                        <img src={entry.users.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          {entry.users?.first_name?.[0] || '?'}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-sm font-medium">
                        {entry.users?.first_name || entry.users?.username || 'User'}
                      </div>
                      <div className="text-xs text-gray-500">
                        UID: {entry.users?.telegram_id}
                      </div>
                    </div>
                  </div>

                  <div className="font-bold text-yellow-400">
                    {entry.score} ads
                  </div>
                </div>
              );
            })}
          </div>
        </>
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