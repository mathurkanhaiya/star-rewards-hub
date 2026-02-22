import React, { useEffect, useState } from 'react';
import { getLeaderboard, getActiveContests, getContestLeaderboard, getReferralLeaderboard } from '@/lib/api';
import { LeaderboardEntry, Contest } from '@/types/telegram';
import { useApp } from '@/context/AppContext';

type LeaderboardTab = 'points' | 'ads' | 'referrals';

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
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<LeaderboardTab>('points');
  const [contests, setContests] = useState<Contest[]>([]);
  const [contestLeaders, setContestLeaders] = useState<Array<{ user_id: string; score: number; users: { first_name: string; username: string; photo_url: string | null; telegram_id: number } | null }>>([]);
  const [referralLeaders, setReferralLeaders] = useState<Array<{ user_id: string; count: number; user: { first_name: string; username: string; photo_url: string | null } | null }>>([]);

  useEffect(() => {
    loadData();
  }, [tab]);

  async function loadData() {
    setLoading(true);
    if (tab === 'points') {
      const data = await getLeaderboard();
      setLeaders(data);
    } else if (tab === 'ads') {
      const activeContests = await getActiveContests();
      setContests(activeContests as Contest[]);
      if (activeContests.length > 0) {
        const adContest = activeContests.find((c: { contest_type: string }) => c.contest_type === 'ads_watch');
        if (adContest) {
        const entries = await getContestLeaderboard(adContest.id);
          setContestLeaders(entries as unknown as typeof contestLeaders);
        }
      }
    } else if (tab === 'referrals') {
      const activeContests = await getActiveContests();
      const refContest = (activeContests as Contest[]).find(c => c.contest_type === 'referral');
      setContests(activeContests as Contest[]);
      if (refContest) {
        const entries = await getContestLeaderboard(refContest.id);
        setContestLeaders(entries as unknown as typeof contestLeaders);
      } else {
        const data = await getReferralLeaderboard();
        setReferralLeaders(data as typeof referralLeaders);
      }
    }
    setLoading(false);
  }

  const myRank = user ? leaders.find(l => l.telegram_id === user.telegram_id)?.rank : null;

  function getMedalColor(rank: number) {
    if (rank === 1) return 'hsl(45 100% 55%)';
    if (rank === 2) return 'hsl(0 0% 70%)';
    if (rank === 3) return 'hsl(25 80% 55%)';
    return 'hsl(220 15% 50%)';
  }

  const tabs: { id: LeaderboardTab; label: string; icon: string }[] = [
    { id: 'points', label: 'Points', icon: '⚡' },
    { id: 'ads', label: 'Ads Watch', icon: '🎬' },
    { id: 'referrals', label: 'Inviters', icon: '👥' },
  ];

  const activeContest = tab === 'ads'
    ? contests.find(c => c.contest_type === 'ads_watch')
    : tab === 'referrals'
    ? contests.find(c => c.contest_type === 'referral')
    : null;

  return (
    <div className="px-4 pb-28">
      <div className="mb-4">
        <h2 className="text-lg font-display font-bold text-gold-gradient mb-1">Leaderboard</h2>
        <p className="text-xs text-muted-foreground">Compete & win rewards</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: 'hsl(220 25% 8%)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
            style={{
              background: tab === t.id ? 'hsl(45 100% 55%)' : 'transparent',
              color: tab === t.id ? 'hsl(220 30% 5%)' : 'hsl(220 15% 55%)',
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Active contest banner */}
      {activeContest && (
        <div className="rounded-xl p-3 mb-4 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, hsl(265 80% 65% / 0.15), hsl(45 100% 55% / 0.1))',
            border: '1px solid hsl(265 80% 65% / 0.3)',
          }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-foreground">🏆 {activeContest.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Prizes: 🥇{activeContest.reward_1st.toLocaleString()} 🥈{activeContest.reward_2nd.toLocaleString()} 🥉{activeContest.reward_3rd.toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Ends in</div>
              <div className="text-sm font-bold" style={{ color: 'hsl(0 80% 60%)' }}>{formatCountdown(activeContest.ends_at)}</div>
            </div>
          </div>
        </div>
      )}

      {/* My rank */}
      {tab === 'points' && myRank && (
        <div className="rounded-xl p-3 mb-4 flex items-center justify-between"
          style={{ background: 'hsl(45 100% 55% / 0.1)', border: '1px solid hsl(45 100% 55% / 0.3)' }}>
          <div className="text-sm font-semibold text-foreground">Your Rank</div>
          <div className="text-lg font-bold text-gold-gradient">#{myRank}</div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : tab === 'points' ? (
        <>
          {/* Top 3 podium */}
          {leaders.length >= 3 && (
            <div className="flex items-end justify-center gap-2 mb-6 h-32">
              {[leaders[1], leaders[0], leaders[2]].map((leader, i) => {
                const heights = ['h-20', 'h-28', 'h-16'];
                const medals = ['🥈', '🥇', '🥉'];
                const colors = ['hsl(0 0% 70%)', 'hsl(45 100% 55%)', 'hsl(25 80% 55%)'];
                return (
                  <div key={leader.id} className={`flex-1 flex flex-col items-center justify-end ${heights[i]}`}>
                    {leader.photo_url ? (
                      <img src={leader.photo_url} alt="" className="w-8 h-8 rounded-full object-cover mb-1" />
                    ) : (
                      <div className="text-2xl mb-1">{medals[i]}</div>
                    )}
                    <div className="w-full rounded-t-xl flex flex-col items-center justify-center p-2"
                      style={{
                        background: `linear-gradient(to top, ${colors[i]}20, ${colors[i]}10)`,
                        border: `1px solid ${colors[i]}30`,
                        borderBottom: 'none',
                        minHeight: i === 1 ? '80px' : i === 0 ? '60px' : '45px',
                      }}>
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
          <div className="space-y-2">
            {leaders.map(leader => {
              const isMe = user && leader.telegram_id === user.telegram_id;
              const medal = leader.rank <= 3 ? ['🥇', '🥈', '🥉'][leader.rank - 1] : null;
              return (
                <div key={leader.id} className="flex items-center gap-3 p-3 rounded-xl transition-all"
                  style={{
                    background: isMe ? 'hsl(45 100% 55% / 0.1)' : 'hsl(220 25% 8% / 0.6)',
                    border: `1px solid ${isMe ? 'hsl(45 100% 55% / 0.4)' : 'hsl(220 20% 15% / 0.5)'}`,
                  }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={{ background: medal ? `${getMedalColor(leader.rank)}20` : 'hsl(220 25% 12%)', color: getMedalColor(leader.rank) }}>
                    {medal || `#${leader.rank}`}
                  </div>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, hsl(190 100% 55% / 0.3), hsl(265 80% 65% / 0.3))' }}>
                    {leader.photo_url ? (
                      <img src={leader.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      leader.first_name?.[0] || '?'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {leader.first_name || leader.username || 'Anonymous'}
                      {isMe && <span className="text-xs ml-1" style={{ color: 'hsl(45 100% 55%)' }}>(you)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">Level {leader.level}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold" style={{ color: 'hsl(45 100% 55%)' }}>
                      {(leader.total_points || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">pts</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* Contest / Referral leaderboard */
        <div className="space-y-2">
          {contestLeaders.length > 0 ? contestLeaders.map((entry, i) => {
            const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
            const colors = ['hsl(45 100% 55%)', 'hsl(0 0% 70%)', 'hsl(25 80% 55%)', 'hsl(220 15% 50%)', 'hsl(220 15% 50%)'];
            return (
              <div key={entry.user_id} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'hsl(220 25% 8% / 0.6)', border: '1px solid hsl(220 20% 15% / 0.5)' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{ background: `${colors[i] || 'hsl(220 25% 12%)'}20`, color: colors[i] || 'hsl(220 15% 50%)' }}>
                  {medals[i] || `#${i + 1}`}
                </div>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, hsl(190 100% 55% / 0.3), hsl(265 80% 65% / 0.3))' }}>
                  {entry.users?.photo_url ? (
                    <img src={entry.users.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    entry.users?.first_name?.[0] || '?'
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {entry.users?.first_name || entry.users?.username || 'User'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold" style={{ color: 'hsl(45 100% 55%)' }}>{entry.score}</div>
                  <div className="text-xs text-muted-foreground">{tab === 'ads' ? 'ads' : 'invites'}</div>
                </div>
              </div>
            );
          }) : referralLeaders.length > 0 ? referralLeaders.map((entry, i) => {
            const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
            return (
              <div key={entry.user_id} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'hsl(220 25% 8% / 0.6)', border: '1px solid hsl(220 20% 15% / 0.5)' }}>
                <div className="text-lg">{medals[i] || `#${i + 1}`}</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">
                    {(entry.user as { first_name?: string })?.first_name || 'User'}
                  </div>
                </div>
                <div className="text-sm font-bold" style={{ color: 'hsl(45 100% 55%)' }}>{entry.count} invites</div>
              </div>
            );
          }) : (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">{tab === 'ads' ? '🎬' : '👥'}</div>
              <div className="text-sm text-muted-foreground">
                {activeContest ? 'No entries yet — be the first!' : 'No active contest right now'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
