import React, { useEffect, useState, useRef } from 'react';
import { getLeaderboard, getActiveContests } from '@/lib/api';
import { LeaderboardEntry, Contest } from '@/types/telegram';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';

type LeaderboardTab = 'points' | 'ads';
type AdsSubTab = 'today' | 'yesterday' | 'week';

function triggerHaptic(type: 'impact' | 'success' = 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;
    if (type === 'success') tg?.HapticFeedback?.notificationOccurred('success');
    else tg?.HapticFeedback?.impactOccurred('medium');
  }
}

function AnimatedPoints({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);
  useEffect(() => {
    let start = previous.current;
    const diff = value - start;
    const steps = 30;
    const increment = diff / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      start += increment;
      if (step >= steps) { setDisplay(value); clearInterval(timer); }
      else setDisplay(Math.floor(start));
    }, 600 / steps);
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

function getDateRange(subTab: AdsSubTab): { from: string; to?: string } {
  const now = new Date();
  if (subTab === 'today') {
    return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString() };
  }
  if (subTab === 'yesterday') {
    return {
      from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)).toISOString(),
      to:   new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString(),
    };
  }
  return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7)).toISOString() };
}

const ADS_SUBTABS: { id: AdsSubTab; label: string }[] = [
  { id: 'today',     label: 'Today'     },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week',      label: '7 Days'    },
];

const RANK_COLORS = ['#fbbf24', '#94a3b8', '#f97316'];
const RANK_LABELS = ['🥇', '🥈', '🥉'];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;900&family=Rajdhani:wght@500;600;700&display=swap');

@keyframes lbFloat  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
@keyframes lbSpin   { to{transform:rotate(360deg)} }
@keyframes lbFadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
@keyframes lbPulse  { 0%,100%{opacity:0.6} 50%{opacity:1} }
@keyframes lbShine  { 0%{left:-100%} 40%,100%{left:150%} }

.lb-root {
  font-family: 'Rajdhani', sans-serif;
  padding: 0 16px 112px;
  color: #fff;
  min-height: 100vh;
}

/* Header */
.lb-header { padding: 4px 0 20px; }
.lb-eyebrow {
  font-family: 'Orbitron', monospace;
  font-size: 9px; letter-spacing: 5px;
  color: rgba(255,255,255,0.2);
  text-transform: uppercase; margin-bottom: 4px;
}
.lb-title {
  font-family: 'Orbitron', monospace;
  font-size: 22px; font-weight: 900; letter-spacing: 2px;
  color: #fff; line-height: 1;
}
.lb-title span { color: #ffbe00; text-shadow: 0 0 16px rgba(255,190,0,0.4); }

/* My rank pill */
.lb-my-rank {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 14px; border-radius: 20px; margin-bottom: 14px;
  background: rgba(255,190,0,0.08); border: 1px solid rgba(255,190,0,0.25);
  font-family: 'Orbitron', monospace; font-size: 11px;
  font-weight: 700; color: #ffbe00; letter-spacing: 1px;
}

/* Main tabs */
.lb-tabs {
  display: flex; gap: 6px; margin-bottom: 14px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px; padding: 4px;
}
.lb-tab {
  flex: 1; padding: 9px; border-radius: 10px; border: none;
  font-family: 'Orbitron', monospace; font-size: 10px;
  font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;
  cursor: pointer; transition: background 0.2s, color 0.2s, box-shadow 0.2s;
  color: rgba(255,255,255,0.25); background: none;
}
.lb-tab.active {
  background: #ffbe00; color: #1a0800;
  box-shadow: 0 2px 12px rgba(255,190,0,0.3);
}

/* Sub-tabs */
.lb-subtabs {
  display: flex; gap: 6px; margin-bottom: 14px;
}
.lb-subtab {
  flex: 1; padding: 7px; border-radius: 12px; border: none;
  font-family: 'Orbitron', monospace; font-size: 9px;
  font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase;
  cursor: pointer; transition: all 0.2s;
  color: rgba(255,255,255,0.25);
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
}
.lb-subtab.active {
  background: rgba(34,211,238,0.12);
  border-color: rgba(34,211,238,0.35);
  color: #22d3ee;
  box-shadow: 0 0 12px rgba(34,211,238,0.2);
}

/* Contest banner */
.lb-contest {
  background: rgba(255,190,0,0.05);
  border: 1px solid rgba(255,190,0,0.2);
  border-radius: 16px; padding: 14px 16px;
  margin-bottom: 14px; position: relative; overflow: hidden;
}
.lb-contest::before {
  content: ''; position: absolute;
  top: 0; left: 10%; right: 10%; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,190,0,0.4), transparent);
}
.lb-contest-title {
  font-family: 'Orbitron', monospace;
  font-size: 12px; font-weight: 700; letter-spacing: 1px;
  color: #ffbe00; margin-bottom: 3px;
}
.lb-contest-sub {
  font-size: 11px; color: rgba(255,255,255,0.3); letter-spacing: 1px;
}

/* Loading */
.lb-loading {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 56px 0; gap: 12px;
}
.lb-spinner {
  width: 36px; height: 36px; border-radius: 50%;
  border: 2px solid rgba(255,190,0,0.15);
  border-top: 2px solid #ffbe00;
  animation: lbSpin 0.8s linear infinite;
}
.lb-loading-txt {
  font-family: 'Orbitron', monospace;
  font-size: 9px; letter-spacing: 3px;
  color: rgba(255,255,255,0.15);
}

/* Empty */
.lb-empty {
  text-align: center; padding: 48px 0;
  font-family: 'Orbitron', monospace;
  font-size: 9px; letter-spacing: 3px;
  color: rgba(255,255,255,0.1); text-transform: uppercase;
}

/* Podium (top 3) */
.lb-podium {
  display: flex; align-items: flex-end;
  justify-content: center; gap: 8px;
  margin-bottom: 20px;
}
.lb-podium-item {
  display: flex; flex-direction: column;
  align-items: center; gap: 6px;
  flex: 1; max-width: 110px;
  animation: lbFadeIn 0.4s ease both;
}
.lb-podium-item:nth-child(1) { animation-delay: 0.1s; }
.lb-podium-item:nth-child(2) { animation-delay: 0s; }
.lb-podium-item:nth-child(3) { animation-delay: 0.2s; }

.lb-podium-crown { font-size: 20px; animation: lbFloat 2s ease-in-out infinite; }

.lb-podium-avatar {
  border-radius: 50%; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Orbitron', monospace; font-weight: 700;
  position: relative;
}
.lb-podium-avatar img { width: 100%; height: 100%; object-fit: cover; }

.lb-podium-name {
  font-family: 'Orbitron', monospace;
  font-size: 9px; font-weight: 700; letter-spacing: 1px;
  text-transform: uppercase; text-align: center;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  width: 100%;
}
.lb-podium-pts {
  font-family: 'Orbitron', monospace;
  font-size: 11px; font-weight: 700; letter-spacing: 1px;
  text-align: center;
}
.lb-podium-base {
  width: 100%; border-radius: 12px 12px 0 0;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Orbitron', monospace; font-size: 18px; font-weight: 900;
}

/* Row entries */
.lb-row {
  display: flex; align-items: center; gap: 12px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 16px; padding: 12px 14px;
  margin-bottom: 8px; cursor: pointer;
  transition: transform 0.12s, border-color 0.2s;
  position: relative; overflow: hidden;
  animation: lbFadeIn 0.3s ease both;
}
.lb-row:active { transform: scale(0.98); }
.lb-row.me {
  background: rgba(255,190,0,0.06);
  border-color: rgba(255,190,0,0.3);
  box-shadow: 0 0 20px rgba(255,190,0,0.1);
}
.lb-row.me::before {
  content: ''; position: absolute;
  top: 0; left: 10%; right: 10%; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,190,0,0.4), transparent);
}

.lb-row-rank {
  font-family: 'Orbitron', monospace;
  font-size: 13px; font-weight: 700; width: 32px;
  text-align: center; flex-shrink: 0;
  color: rgba(255,255,255,0.3);
}
.lb-row-rank.gold   { color: #fbbf24; }
.lb-row-rank.silver { color: #94a3b8; }
.lb-row-rank.bronze { color: #f97316; }

.lb-row-avatar {
  width: 40px; height: 40px; border-radius: 50%;
  overflow: hidden; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Orbitron', monospace; font-size: 14px; font-weight: 700;
  background: rgba(255,255,255,0.06);
}
.lb-row-avatar img { width: 100%; height: 100%; object-fit: cover; }

.lb-row-body { flex: 1; min-width: 0; }
.lb-row-name {
  font-size: 14px; font-weight: 600;
  color: rgba(255,255,255,0.85);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  display: flex; align-items: center; gap: 6px;
}
.lb-you-badge {
  font-family: 'Orbitron', monospace; font-size: 7px;
  font-weight: 700; letter-spacing: 1px;
  padding: 1px 6px; border-radius: 6px;
  background: rgba(255,190,0,0.15);
  border: 1px solid rgba(255,190,0,0.3);
  color: #ffbe00; flex-shrink: 0;
}
.lb-row-sub { font-size: 10px; color: rgba(255,255,255,0.2); letter-spacing: 1px; margin-top: 1px; }

.lb-row-pts { text-align: right; flex-shrink: 0; }
.lb-row-pts-val {
  font-family: 'Orbitron', monospace;
  font-size: 16px; font-weight: 700; color: #ffbe00;
  letter-spacing: 0.5px;
}
.lb-row-pts-val.ads { color: #22d3ee; }
.lb-row-pts-lbl {
  font-size: 9px; letter-spacing: 1px;
  color: rgba(255,255,255,0.2); text-align: right;
}

.lb-movement {
  font-size: 10px; font-weight: 700;
  animation: lbPulse 1.5s ease-in-out infinite;
}
`;

export default function LeaderboardPage() {
  const { user } = useApp();
  const [leaders, setLeaders]             = useState<LeaderboardEntry[]>([]);
  const [previousRanks, setPreviousRanks] = useState<Record<number, number>>({});
  const [contests, setContests]           = useState<Contest[]>([]);
  const [loading, setLoading]             = useState(true);
  const [tab, setTab]                     = useState<LeaderboardTab>('points');
  const [adsSubTab, setAdsSubTab]         = useState<AdsSubTab>('today');
  const [adLeaders, setAdLeaders]         = useState<any[]>([]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [tab, adsSubTab]);

  async function loadData() {
    setLoading(true);

    if (tab === 'points') {
      /* ── FIX: fetch balances joined with users ── */
      const { data: balances } = await supabase
        .from('balances')
        .select('user_id, points, total_earned, users:user_id(id, first_name, username, telegram_id, photo_url)')
        .order('points', { ascending: false })
        .limit(50);

      if (balances && balances.length > 0) {
        const prev: Record<number, number> = {};
        leaders.forEach((l, i) => { prev[l.telegram_id] = i + 1; });
        setPreviousRanks(prev);

        const mapped: LeaderboardEntry[] = balances.map((b: any, i: number) => ({
          id:           b.user_id,
          user_id:      b.user_id,
          telegram_id:  b.users?.telegram_id,
          first_name:   b.users?.first_name || 'User',
          username:     b.users?.username,
          photo_url:    b.users?.photo_url,
          total_points: b.points,
          points:       b.points,
          rank:         i + 1,
        }));
        setLeaders(mapped);
      } else {
        /* fallback to existing api */
        const data = await getLeaderboard();
        const newLeaders = (data || []).map((l: any, i: number) => ({
          ...l,
          total_points: l.total_points ?? l.points ?? 0,
          rank: l.rank ?? i + 1,
        }));
        const prev: Record<number, number> = {};
        leaders.forEach(l => { prev[l.telegram_id] = l.rank; });
        setPreviousRanks(prev);
        setLeaders(newLeaders);
      }
    }

    if (tab === 'ads') {
      const activeContests = await getActiveContests();
      setContests(activeContests as Contest[]);

      const range = getDateRange(adsSubTab);
      let query = supabase.from('ad_logs').select('user_id, created_at');
      if (range.from) query = query.gte('created_at', range.from);
      if (range.to)   query = query.lt('created_at', range.to);

      const { data: adLogs, error } = await query;
      if (error) { setAdLeaders([]); setLoading(false); return; }

      const counts: Record<string, number> = {};
      (adLogs || []).forEach((log: any) => {
        counts[log.user_id] = (counts[log.user_id] || 0) + 1;
      });

      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 50);
      if (sorted.length === 0) { setAdLeaders([]); setLoading(false); return; }

      const userIds = sorted.map(([uid]) => uid);
      const { data: users } = await supabase
        .from('users').select('id, first_name, username, telegram_id, photo_url').in('id', userIds);

      const userMap: Record<string, any> = {};
      (users || []).forEach(u => { userMap[u.id] = u; });

      setAdLeaders(sorted.map(([uid, score]) => ({
        user_id: uid, score, users: userMap[uid] || {},
      })));
    }

    setLoading(false);
  }

  const myRank = user && leaders.length > 0
    ? leaders.find(l => l.telegram_id === user.telegram_id)?.rank
    : null;

  const activeContest = tab === 'ads' ? contests.find(c => c.contest_type === 'ads_watch') : null;

  /* ── helpers ── */
  function openProfile(telegramId?: number, username?: string) {
    triggerHaptic();
    if (username) window.open(`https://t.me/${username}`, '_blank');
    else if (telegramId) window.open(`tg://user?id=${telegramId}`);
  }

  function rankClass(rank: number) {
    if (rank === 1) return 'gold';
    if (rank === 2) return 'silver';
    if (rank === 3) return 'bronze';
    return '';
  }

  const podiumOrder = leaders.slice(0, 3).length === 3
    ? [leaders[1], leaders[0], leaders[2]]   // 2nd, 1st, 3rd visual order
    : leaders.slice(0, 3);

  const podiumHeights = [80, 104, 64];   // 2nd, 1st, 3rd base heights
  const podiumSizes   = [48, 60, 44];    // avatar sizes

  return (
    <>
      <style>{CSS}</style>
      <div className="lb-root">

        {/* Header */}
        <div className="lb-header">
          <div className="lb-eyebrow">Compete · Rank</div>
          <div className="lb-title">LEADER<span>BOARD</span></div>
        </div>

        {/* My rank pill */}
        {myRank && (
          <div className="lb-my-rank">
            ✦ YOUR RANK &nbsp; #{myRank}
          </div>
        )}

        {/* Main tabs */}
        <div className="lb-tabs">
          {[
            { id: 'points', label: 'Points'    },
            { id: 'ads',    label: 'Ads Watch' },
          ].map(t => (
            <button
              key={t.id}
              className={`lb-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => { triggerHaptic(); setTab(t.id as LeaderboardTab); }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Contest banner */}
        {activeContest && (
          <div className="lb-contest">
            <div className="lb-contest-title">🏆 {activeContest.title}</div>
            <div className="lb-contest-sub">Ends in {formatCountdown(activeContest.ends_at)}</div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="lb-loading">
            <div className="lb-spinner" />
            <div className="lb-loading-txt">Loading Rankings</div>
          </div>
        )}

        {/* ══ POINTS TAB ══ */}
        {!loading && tab === 'points' && (
          <>
            {leaders.length === 0 ? (
              <div className="lb-empty">✦ No players yet ✦</div>
            ) : (
              <>
                {/* Podium (top 3) */}
                {leaders.length >= 3 && (
                  <div className="lb-podium">
                    {podiumOrder.map((leader, podiumIdx) => {
                      if (!leader) return null;
                      const visualRank = [2, 1, 3][podiumIdx];
                      const color = RANK_COLORS[visualRank - 1];
                      const totalPoints = leader.total_points ?? (leader as any).points ?? 0;
                      const isMe = user && leader.telegram_id === user.telegram_id;

                      return (
                        <div
                          key={leader.id}
                          className="lb-podium-item"
                          onClick={() => openProfile(leader.telegram_id, leader.username)}
                          style={{ animationDelay: `${podiumIdx * 0.1}s` }}
                        >
                          {visualRank === 1 && <div className="lb-podium-crown">👑</div>}
                          <div
                            className="lb-podium-avatar"
                            style={{
                              width: podiumSizes[podiumIdx],
                              height: podiumSizes[podiumIdx],
                              border: `2px solid ${color}60`,
                              boxShadow: `0 0 16px ${color}40`,
                              fontSize: podiumSizes[podiumIdx] / 3,
                              color,
                            }}
                          >
                            {leader.photo_url
                              ? <img src={leader.photo_url} alt="" />
                              : (leader.first_name?.[0] || '?')}
                          </div>
                          <div className="lb-podium-name" style={{ color: isMe ? '#ffbe00' : 'rgba(255,255,255,0.7)' }}>
                            {leader.first_name || 'User'}
                          </div>
                          <div className="lb-podium-pts" style={{ color }}>
                            {totalPoints.toLocaleString()}
                          </div>
                          <div
                            className="lb-podium-base"
                            style={{
                              height: podiumHeights[podiumIdx],
                              background: `${color}12`,
                              border: `1px solid ${color}30`,
                              color,
                            }}
                          >
                            {RANK_LABELS[visualRank - 1]}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Rows (rank 4+) */}
                {leaders.slice(3).map((leader, idx) => {
                  const isMe = user && leader.telegram_id === user.telegram_id;
                  const totalPoints = leader.total_points ?? (leader as any).points ?? 0;
                  const prevRank = previousRanks[leader.telegram_id];
                  const movement = prevRank
                    ? (leader.rank < prevRank ? 'up' : leader.rank > prevRank ? 'down' : null)
                    : null;

                  return (
                    <div
                      key={leader.id}
                      className={`lb-row ${isMe ? 'me' : ''}`}
                      onClick={() => openProfile(leader.telegram_id, leader.username)}
                      style={{ animationDelay: `${idx * 0.04}s` }}
                    >
                      <div className={`lb-row-rank ${rankClass(leader.rank)}`}>
                        #{leader.rank}
                      </div>
                      <div
                        className="lb-row-avatar"
                        style={isMe ? { border: '1px solid rgba(255,190,0,0.4)' } : {}}
                      >
                        {leader.photo_url
                          ? <img src={leader.photo_url} alt="" />
                          : <span style={{ color: '#ffbe00' }}>{leader.first_name?.[0] || '?'}</span>}
                      </div>
                      <div className="lb-row-body">
                        <div className="lb-row-name">
                          {leader.first_name || leader.username || 'User'}
                          {movement === 'up'   && <span className="lb-movement" style={{ color: '#4ade80' }}>↑</span>}
                          {movement === 'down' && <span className="lb-movement" style={{ color: '#ef4444' }}>↓</span>}
                          {isMe && <span className="lb-you-badge">YOU</span>}
                        </div>
                        <div className="lb-row-sub">@{leader.username || `uid_${leader.telegram_id}`}</div>
                      </div>
                      <div className="lb-row-pts">
                        <div className="lb-row-pts-val">
                          <AnimatedPoints value={totalPoints} />
                        </div>
                        <div className="lb-row-pts-lbl">pts</div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}

        {/* ══ ADS TAB ══ */}
        {!loading && tab === 'ads' && (
          <>
            <div className="lb-subtabs">
              {ADS_SUBTABS.map(st => (
                <button
                  key={st.id}
                  className={`lb-subtab ${adsSubTab === st.id ? 'active' : ''}`}
                  onClick={() => { triggerHaptic(); setAdsSubTab(st.id); }}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {adLeaders.length === 0 ? (
              <div className="lb-empty">✦ No data yet ✦</div>
            ) : adLeaders.map((entry: any, i: number) => {
              const isMe = user && entry.users?.telegram_id === user.telegram_id;
              const rank = i + 1;

              return (
                <div
                  key={entry.user_id}
                  className={`lb-row ${isMe ? 'me' : ''}`}
                  onClick={() => openProfile(entry.users?.telegram_id, entry.users?.username)}
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <div className={`lb-row-rank ${rankClass(rank)}`}>
                    {rank <= 3 ? RANK_LABELS[rank - 1] : `#${rank}`}
                  </div>
                  <div
                    className="lb-row-avatar"
                    style={isMe ? { border: '1px solid rgba(255,190,0,0.4)' } : {}}
                  >
                    {entry.users?.photo_url
                      ? <img src={entry.users.photo_url} alt="" />
                      : <span style={{ color: '#22d3ee' }}>{entry.users?.first_name?.[0] || '?'}</span>}
                  </div>
                  <div className="lb-row-body">
                    <div className="lb-row-name">
                      {entry.users?.first_name || entry.users?.username || 'User'}
                      {isMe && <span className="lb-you-badge">YOU</span>}
                    </div>
                    <div className="lb-row-sub">@{entry.users?.username || `uid_${entry.users?.telegram_id}`}</div>
                  </div>
                  <div className="lb-row-pts">
                    <div className="lb-row-pts-val ads">{entry.score}</div>
                    <div className="lb-row-pts-lbl">ads</div>
                  </div>
                </div>
              );
            })}
          </>
        )}

      </div>
    </>
  );
}
