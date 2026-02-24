import React, { useEffect, useState } from 'react';
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
function triggerHaptic() {
  if (typeof window !== 'undefined' && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;
    tg?.HapticFeedback?.impactOccurred('medium');
  }
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
        setLeaders(data || []);
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

  const tabs = [
    { id: 'points', label: 'Points', icon: '⚡' },
    { id: 'ads', label: 'Ads', icon: '🎬' },
    { id: 'referrals', label: 'Invites', icon: '👥' },
  ] as const;

  const activeContest =
    tab === 'ads'
      ? contests.find(c => c.contest_type === 'ads_watch')
      : tab === 'referrals'
      ? contests.find(c => c.contest_type === 'referral')
      : null;

  return (
    <div className="px-4 pb-28 text-white">

      {/* HEADER */}
      <div className="mb-5">
        <h2 className="text-xl font-bold">Leaderboard</h2>
        <p className="text-xs text-gray-400">
          Compete and climb the ranks
        </p>
      </div>

      {/* TABS */}
      <div className="flex bg-[#111827] rounded-xl p-1 mb-5">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => {
              triggerHaptic();
              setTab(t.id as LeaderboardTab);
            }}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
            style={{
              background:
                tab === t.id
                  ? 'linear-gradient(135deg,#facc15,#f97316)'
                  : 'transparent',
              color:
                tab === t.id ? '#111' : '#9ca3af',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ACTIVE CONTEST */}
      {activeContest && (
        <div className="rounded-xl p-4 mb-5 bg-[#1f2937] border border-yellow-500/30">
          <div className="font-bold mb-1">
            🏆 {activeContest.title}
          </div>
          <div className="text-xs text-gray-400">
            Ends in {formatCountdown(activeContest.ends_at)}
          </div>
        </div>
      )}

      {/* MY RANK */}
      {tab === 'points' && myRank && (
        <div className="p-3 mb-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-center font-bold">
          Your Rank: #{myRank}
        </div>
      )}

      {/* CONTENT */}
      {loading ? (
        <div className="text-center py-10 text-gray-500">
          Loading...
        </div>
      ) : tab === 'points' ? (
        <div className="space-y-3">
          {leaders.map(leader => {
            const isMe =
              user &&
              leader.telegram_id === user.telegram_id;

            const availablePoints =
              leader.points ??
              (leader as any).available_points ??
              0;

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
                className="flex items-center justify-between p-4 rounded-xl cursor-pointer transition active:scale-[0.97]"
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

                  {/* Rank */}
                  <div className="font-bold text-yellow-400 w-8">
                    #{leader.rank}
                  </div>

                  {/* PFP */}
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center text-sm font-bold">
                    {leader.photo_url ? (
                      <img
                        src={leader.photo_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      leader.first_name?.[0] || '?'
                    )}
                  </div>

                  {/* User Info */}
                  <div>
                    <div className="font-medium text-sm">
                      {leader.first_name ||
                        leader.username ||
                        'User'}
                      {isMe && (
                        <span className="text-yellow-400 text-xs ml-1">
                          (you)
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-gray-500">
                      UID: {leader.telegram_id}
                    </div>
                  </div>
                </div>

                {/* Available Balance */}
                <div className="text-right">
                  <div className="font-bold text-yellow-400">
                    {availablePoints.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">
                    pts available
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {(contestLeaders.length > 0
            ? contestLeaders
            : referralLeaders
          ).map((entry: any, i: number) => (
            <div
              key={entry.user_id || i}
              className="flex justify-between items-center p-4 rounded-xl bg-[#111827] border border-white/5"
            >
              <div className="flex items-center gap-3">
                <div className="text-yellow-400 font-bold">
                  #{i + 1}
                </div>
                <div>
                  <div className="font-medium">
                    {entry.users?.first_name ||
                      entry.user?.first_name ||
                      'User'}
                  </div>
                </div>
              </div>
              <div className="font-bold text-yellow-400">
                {entry.score ||
                  entry.count}{' '}
                {tab === 'ads' ? 'ads' : 'invites'}
              </div>
            </div>
          ))}

          {contestLeaders.length === 0 &&
            referralLeaders.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No entries yet
              </div>
            )}
        </div>
      )}
    </div>
  );
}