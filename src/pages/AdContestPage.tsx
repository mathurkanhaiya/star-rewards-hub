import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { getActiveContests } from '@/lib/api';
import { Contest } from '@/types/telegram';

interface AdLeaderEntry {
  rank: number;
  user_id: string;
  ad_count: number;
  first_name: string;
  username: string;
  photo_url: string | null;
  telegram_id: number;
}

function triggerHaptic(type: 'impact' | 'success' = 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;
    if (type === 'success') tg?.HapticFeedback?.notificationOccurred('success');
    else tg?.HapticFeedback?.impactOccurred('medium');
  }
}

function formatCountdown(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return { text: 'ENDED', urgent: false };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const urgent = diff < 3600000; // less than 1 hour
  if (h > 0) return { text: `${h}h ${m}m ${s}s`, urgent };
  return { text: `${m}m ${s}s`, urgent };
}

function getProgressPct(contest: Contest): number {
  const durationHours = (contest as any).duration_hours || 24;
  const start = new Date(contest.ends_at).getTime() - durationHours * 3600000;
  const total = new Date(contest.ends_at).getTime() - start;
  const elapsed = Date.now() - start;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

const REWARD_METHODS: Record<string, { icon: string; color: string }> = {
  points: { icon: '🪙', color: '#ffbe00' },
  ton:    { icon: '💎', color: '#22d3ee' },
  usdt:   { icon: '💵', color: '#4ade80' },
};

const RANK_COLORS  = ['#fbbf24', '#94a3b8', '#f97316', '#a78bfa', '#4ade80'];
const RANK_MEDALS  = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
const PODIUM_ORDER = [1, 0, 2]; // 2nd, 1st, 3rd visual positions
const PODIUM_H     = [76, 100, 58];
const PODIUM_SIZE  = [46, 58, 40];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;900&family=Rajdhani:wght@500;600;700&display=swap');

@keyframes acpFadeIn  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
@keyframes acpSpin    { to{transform:rotate(360deg)} }
@keyframes acpFloat   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
@keyframes acpPulse   { 0%,100%{opacity:0.6} 50%{opacity:1} }
@keyframes acpUrgent  { 0%,100%{color:#ef4444} 50%{color:#fca5a5} }
@keyframes acpShimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
@keyframes acpLive    {
  0%,100% { box-shadow: 0 0 0 0 rgba(74,222,128,0); }
  50%     { box-shadow: 0 0 0 6px rgba(74,222,128,0); }
}

.acp-root {
  font-family: 'Rajdhani', sans-serif;
  padding: 0 16px 112px;
  color: #fff; min-height: 100vh;
  position: relative;
}

/* Ambient */
.acp-ambient {
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background:
    radial-gradient(ellipse 80% 40% at 50% 0%, rgba(255,190,0,0.06) 0%, transparent 60%),
    radial-gradient(ellipse 60% 30% at 80% 90%, rgba(34,211,238,0.04) 0%, transparent 60%);
}
.acp-grid {
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
  background-size: 32px 32px;
}
.acp-content { position: relative; z-index: 1; }

/* Header */
.acp-header { padding: 4px 0 20px; }
.acp-eyebrow { font-family:'Orbitron',monospace; font-size:9px; letter-spacing:5px; color:rgba(255,255,255,0.2); text-transform:uppercase; margin-bottom:4px; }
.acp-title { font-family:'Orbitron',monospace; font-size:22px; font-weight:900; letter-spacing:2px; color:#fff; line-height:1; }
.acp-title span { color:#ffbe00; text-shadow:0 0 16px rgba(255,190,0,0.4); }

/* ── Contest banner ── */
.acp-banner {
  border-radius: 22px; padding: 20px; margin-bottom: 16px;
  position: relative; overflow: hidden;
  animation: acpFadeIn 0.4s ease;
}
.acp-banner::before {
  content: ''; position: absolute; top: 0; left: 10%; right: 10%; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,190,0,0.5), transparent);
}
.acp-banner-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
  background-size: 20px 20px; pointer-events: none;
}

.acp-banner-top { display:flex; align-items:flex-start; gap:14px; margin-bottom:14px; position:relative; z-index:1; }
.acp-banner-icon {
  width:52px; height:52px; border-radius:16px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center; font-size:26px;
  animation: acpFloat 3s ease-in-out infinite;
}
.acp-banner-info { flex:1; min-width:0; }
.acp-banner-title {
  font-family:'Orbitron',monospace; font-size:16px; font-weight:900;
  letter-spacing:1px; color:#fff; line-height:1.1; margin-bottom:6px;
}
.acp-banner-meta { font-size:12px; color:rgba(255,255,255,0.3); letter-spacing:0.5px; display:flex; gap:10px; flex-wrap:wrap; }
.acp-live-dot {
  display:inline-flex; align-items:center; gap:5px;
  font-family:'Orbitron',monospace; font-size:8px; font-weight:700;
  letter-spacing:2px; color:#4ade80;
}
.acp-live-pulse {
  width:8px; height:8px; border-radius:50%; background:#4ade80;
  animation: acpPulse 1.2s ease-in-out infinite;
}

/* Countdown */
.acp-countdown-wrap {
  display:flex; justify-content:center; gap:8px; margin-bottom:14px; position:relative; z-index:1;
}
.acp-cd-block {
  flex:1; max-width:70px; background:rgba(0,0,0,0.3);
  border-radius:12px; padding:10px 6px; text-align:center;
}
.acp-cd-val {
  font-family:'Orbitron',monospace; font-size:24px; font-weight:900; line-height:1;
  margin-bottom:3px;
}
.acp-cd-label { font-family:'Orbitron',monospace; font-size:7px; letter-spacing:2px; color:rgba(255,255,255,0.25); text-transform:uppercase; }
.acp-cd-sep { font-family:'Orbitron',monospace; font-size:22px; font-weight:900; color:rgba(255,255,255,0.2); align-self:center; padding-bottom:14px; }

/* Progress bar */
.acp-prog-wrap { position:relative; z-index:1; }
.acp-prog-labels { display:flex; justify-content:space-between; font-family:'Orbitron',monospace; font-size:8px; letter-spacing:1px; color:rgba(255,255,255,0.2); margin-bottom:5px; }
.acp-prog-track { height:6px; border-radius:3px; background:rgba(255,255,255,0.06); overflow:hidden; }
.acp-prog-fill { height:100%; border-radius:3px; transition:width 0.5s; }

/* Reward chips strip */
.acp-rewards-strip {
  display:flex; gap:6px; flex-wrap:wrap; margin-bottom:16px;
}
.acp-reward-chip {
  display:flex; align-items:center; gap:5px; padding:6px 12px;
  border-radius:20px; font-family:'Orbitron',monospace; font-size:9px; font-weight:700; letter-spacing:0.5px;
}

/* My rank pill */
.acp-my-rank {
  display:inline-flex; align-items:center; gap:6px; padding:6px 14px;
  border-radius:20px; margin-bottom:14px;
  background:rgba(255,190,0,0.08); border:1px solid rgba(255,190,0,0.25);
  font-family:'Orbitron',monospace; font-size:11px; font-weight:700; color:#ffbe00; letter-spacing:1px;
  animation: acpPulse 2s ease-in-out infinite;
}

/* Podium */
.acp-podium { display:flex; align-items:flex-end; justify-content:center; gap:10px; margin-bottom:20px; }
.acp-pod-item { display:flex; flex-direction:column; align-items:center; gap:6px; flex:1; max-width:110px; animation:acpFadeIn 0.4s ease both; cursor:pointer; }
.acp-pod-crown { font-size:22px; animation:acpFloat 2s ease-in-out infinite; }
.acp-pod-avatar {
  border-radius:50%; overflow:hidden;
  display:flex; align-items:center; justify-content:center;
  font-family:'Orbitron',monospace; font-weight:700; position:relative;
}
.acp-pod-avatar img { width:100%; height:100%; object-fit:cover; }
.acp-pod-name { font-family:'Orbitron',monospace; font-size:8px; font-weight:700; letter-spacing:1px; text-transform:uppercase; text-align:center; width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.acp-pod-count { font-family:'Orbitron',monospace; font-size:11px; font-weight:700; text-align:center; }
.acp-pod-count-label { font-size:8px; letter-spacing:1px; color:rgba(255,255,255,0.2); }
.acp-pod-base { width:100%; border-radius:12px 12px 0 0; display:flex; align-items:center; justify-content:center; font-family:'Orbitron',monospace; font-size:18px; font-weight:900; }

/* Rows */
.acp-section-label { font-family:'Orbitron',monospace; font-size:9px; letter-spacing:3px; color:rgba(255,255,255,0.15); text-transform:uppercase; margin-bottom:10px; padding-left:2px; }

.acp-row {
  display:flex; align-items:center; gap:12px;
  background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05);
  border-radius:16px; padding:12px 14px; margin-bottom:8px;
  cursor:pointer; transition:transform 0.12s, border-color 0.2s;
  animation:acpFadeIn 0.3s ease both;
}
.acp-row:active { transform:scale(0.98); }
.acp-row.me { background:rgba(255,190,0,0.06); border-color:rgba(255,190,0,0.3); box-shadow:0 0 20px rgba(255,190,0,0.08); }
.acp-row.me::before { content:''; position:absolute; top:0; left:10%; right:10%; height:1px; background:linear-gradient(90deg,transparent,rgba(255,190,0,0.35),transparent); }

.acp-row-rank { font-family:'Orbitron',monospace; font-size:13px; font-weight:700; width:32px; text-align:center; flex-shrink:0; }
.acp-row-avatar { width:40px; height:40px; border-radius:50%; overflow:hidden; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-family:'Orbitron',monospace; font-size:14px; font-weight:700; background:rgba(255,255,255,0.06); }
.acp-row-avatar img { width:100%; height:100%; object-fit:cover; }
.acp-row-body { flex:1; min-width:0; }
.acp-row-name { font-size:14px; font-weight:700; color:rgba(255,255,255,0.85); display:flex; align-items:center; gap:6px; }
.acp-you-badge { font-family:'Orbitron',monospace; font-size:7px; font-weight:700; letter-spacing:1px; padding:1px 6px; border-radius:6px; background:rgba(255,190,0,0.15); border:1px solid rgba(255,190,0,0.3); color:#ffbe00; flex-shrink:0; }
.acp-row-sub { font-size:10px; color:rgba(255,255,255,0.2); letter-spacing:0.5px; margin-top:1px; }
.acp-row-score { text-align:right; flex-shrink:0; }
.acp-row-val { font-family:'Orbitron',monospace; font-size:16px; font-weight:700; color:#ffbe00; letter-spacing:0.5px; }
.acp-row-label { font-size:9px; letter-spacing:1px; color:rgba(255,255,255,0.2); }

/* No contest */
.acp-no-contest { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 20px; text-align:center; }
.acp-no-icon { font-size:56px; margin-bottom:16px; animation:acpFloat 3s ease-in-out infinite; filter:drop-shadow(0 0 16px rgba(255,190,0,0.3)); }
.acp-no-title { font-family:'Orbitron',monospace; font-size:14px; font-weight:700; letter-spacing:2px; color:rgba(255,255,255,0.4); margin-bottom:6px; }
.acp-no-sub { font-size:12px; color:rgba(255,255,255,0.15); letter-spacing:1px; }

/* Loading */
.acp-loading { display:flex; flex-direction:column; align-items:center; padding:56px 0; gap:12px; }
.acp-spinner { width:32px; height:32px; border-radius:50%; border:2px solid rgba(255,190,0,0.15); border-top:2px solid #ffbe00; animation:acpSpin 0.8s linear infinite; }
.acp-loading-txt { font-family:'Orbitron',monospace; font-size:9px; letter-spacing:3px; color:rgba(255,255,255,0.15); }
`;

export default function AdContestPage() {
  const { user } = useApp();

  const [contest, setContest]     = useState<Contest | null>(null);
  const [leaders, setLeaders]     = useState<AdLeaderEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [countdown, setCountdown] = useState({ h: 0, m: 0, s: 0, urgent: false });
  const [progPct, setProgPct]     = useState(0);
  const [myRank, setMyRank]       = useState<number | null>(null);
  const [myCount, setMyCount]     = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /* ── Load active ads contest ── */
  const loadContest = useCallback(async () => {
    const all = await getActiveContests();
    const adsContest = (all as Contest[]).find(c => c.contest_type === 'ads_watch' && c.is_active && !c.rewards_distributed);
    setContest(adsContest || null);
    if (adsContest) await loadLeaderboard(adsContest);
    setLoading(false);
  }, []);

  /* ── Load leaderboard ── */
  const loadLeaderboard = useCallback(async (c: Contest) => {
    const start = new Date(c.ends_at).getTime() - ((c as any).duration_hours || 24) * 3600000;
    const startISO = new Date(start).toISOString();

    const { data: logs } = await supabase
      .from('ad_logs')
      .select('user_id, created_at')
      .gte('created_at', startISO)
      .lt('created_at', c.ends_at);

    const counts: Record<string, number> = {};
    (logs || []).forEach((l: any) => {
      counts[l.user_id] = (counts[l.user_id] || 0) + 1;
    });

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50);

    if (sorted.length === 0) { setLeaders([]); return; }

    const userIds = sorted.map(([uid]) => uid);
    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, username, telegram_id, photo_url')
      .in('id', userIds);

    const userMap: Record<string, any> = {};
    (users || []).forEach(u => { userMap[u.id] = u; });

    const entries: AdLeaderEntry[] = sorted.map(([uid, cnt], i) => ({
      rank:       i + 1,
      user_id:    uid,
      ad_count:   cnt,
      first_name: userMap[uid]?.first_name || 'User',
      username:   userMap[uid]?.username   || '',
      photo_url:  userMap[uid]?.photo_url  || null,
      telegram_id: userMap[uid]?.telegram_id || 0,
    }));

    setLeaders(entries);

    // My rank
    if (user) {
      const { data: myBal } = await supabase
        .from('balances').select('user_id').eq('user_id', user.id).single();
      const myEntry = entries.find(e => e.user_id === user.id);
      if (myEntry) { setMyRank(myEntry.rank); setMyCount(myEntry.ad_count); }
      else { setMyRank(null); setMyCount(0); }
    }
  }, [user]);

  /* ── Countdown ticker ── */
  useEffect(() => {
    if (!contest) return;

    function tick() {
      const diff = new Date(contest!.ends_at).getTime() - Date.now();
      if (diff <= 0) { setCountdown({ h: 0, m: 0, s: 0, urgent: false }); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown({ h, m, s, urgent: diff < 3600000 });
      setProgPct(getProgressPct(contest!));
    }

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [contest]);

  /* ── Auto-refresh leaderboard ── */
  useEffect(() => {
    loadContest();
    const interval = setInterval(() => {
      if (contest) loadLeaderboard(contest);
    }, 20000);
    return () => clearInterval(interval);
  }, [loadContest]);

  function openProfile(entry: AdLeaderEntry) {
    triggerHaptic();
    if (entry.username) window.open(`https://t.me/${entry.username}`, '_blank');
    else if (entry.telegram_id) window.open(`tg://user?id=${entry.telegram_id}`);
  }

  const rewardMethod = REWARD_METHODS[(contest as any)?.reward_method || 'points'];
  const podiumEntries = leaders.length >= 3
    ? [leaders[1], leaders[0], leaders[2]]
    : leaders.slice(0, 3);

  const rewardChips = (['1st','2nd','3rd','4th','5th'] as const)
    .map((k, i) => ({ i, val: (contest as any)?.[`reward_${k}`] }))
    .filter(r => r.val > 0);

  return (
    <>
      <style>{CSS}</style>
      <div className="acp-root">
        <div className="acp-ambient" />
        <div className="acp-grid" />
        <div className="acp-content">

          {/* Header */}
          <div className="acp-header">
            <div className="acp-eyebrow">Live · Competition</div>
            <div className="acp-title">ADS <span>CONTEST</span></div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="acp-loading">
              <div className="acp-spinner" />
              <div className="acp-loading-txt">Loading Contest</div>
            </div>
          )}

          {/* No active contest */}
          {!loading && !contest && (
            <div className="acp-no-contest">
              <div className="acp-no-icon">🏆</div>
              <div className="acp-no-title">No Active Contest</div>
              <div className="acp-no-sub">Check back soon for the next ads watch competition</div>
            </div>
          )}

          {/* Active contest */}
          {!loading && contest && (
            <>
              {/* Contest banner */}
              <div className="acp-banner" style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,190,0,0.2)',
              }}>
                <div className="acp-banner-grid" />

                <div className="acp-banner-top">
                  <div className="acp-banner-icon" style={{ background: 'rgba(255,190,0,0.1)', border: '1px solid rgba(255,190,0,0.25)' }}>
                    {(contest as any).banner_emoji || '📺'}
                  </div>
                  <div className="acp-banner-info">
                    <div className="acp-banner-title">{contest.title}</div>
                    <div className="acp-banner-meta">
                      <span>📺 Ads Watch</span>
                      <span>{rewardMethod.icon} {(contest as any).reward_method?.toUpperCase() || 'POINTS'}</span>
                      <span>🏆 {rewardChips.length} winners</span>
                    </div>
                  </div>
                  <div className="acp-live-dot">
                    <div className="acp-live-pulse" />
                    LIVE
                  </div>
                </div>

                {/* Countdown blocks */}
                <div className="acp-countdown-wrap">
                  {[
                    { val: countdown.h, label: 'Hours'   },
                    { val: countdown.m, label: 'Minutes' },
                    { val: countdown.s, label: 'Seconds' },
                  ].map((cd, i) => (
                    <React.Fragment key={cd.label}>
                      {i > 0 && <div className="acp-cd-sep">:</div>}
                      <div className="acp-cd-block" style={{ border: `1px solid ${countdown.urgent ? 'rgba(239,68,68,0.2)' : 'rgba(255,190,0,0.1)'}` }}>
                        <div className="acp-cd-val" style={{ color: countdown.urgent ? '#ef4444' : '#ffbe00' }}>
                          {String(cd.val).padStart(2, '0')}
                        </div>
                        <div className="acp-cd-label">{cd.label}</div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>

                {/* Progress bar */}
                <div className="acp-prog-wrap">
                  <div className="acp-prog-labels">
                    <span>Contest Progress</span>
                    <span>{Math.round(progPct)}% elapsed</span>
                  </div>
                  <div className="acp-prog-track">
                    <div className="acp-prog-fill" style={{
                      width: `${progPct}%`,
                      background: countdown.urgent
                        ? 'linear-gradient(90deg,#ef444480,#ef4444)'
                        : 'linear-gradient(90deg,#ffbe0080,#ffbe00)',
                      boxShadow: `0 0 8px ${countdown.urgent ? 'rgba(239,68,68,0.6)' : 'rgba(255,190,0,0.5)'}`,
                    }} />
                  </div>
                </div>
              </div>

              {/* Reward chips */}
              <div className="acp-rewards-strip">
                {rewardChips.map(r => (
                  <div key={r.i} className="acp-reward-chip" style={{
                    background: `${RANK_COLORS[r.i]}10`,
                    border: `1px solid ${RANK_COLORS[r.i]}25`,
                  }}>
                    <span>{RANK_MEDALS[r.i]}</span>
                    <span style={{ color: RANK_COLORS[r.i] }}>
                      {Number(r.val).toLocaleString()} {rewardMethod.icon}
                    </span>
                  </div>
                ))}
              </div>

              {/* My rank pill */}
              {myRank && (
                <div className="acp-my-rank">
                  ✦ YOUR RANK &nbsp; #{myRank} &nbsp;·&nbsp; {myCount} ads
                </div>
              )}

              {/* Empty leaderboard */}
              {leaders.length === 0 && (
                <div style={{ textAlign:'center', padding:'40px 0', fontFamily:"'Orbitron',monospace", fontSize:9, letterSpacing:'3px', color:'rgba(255,255,255,0.1)', textTransform:'uppercase' }}>
                  ✦ Be the first to watch ads ✦
                </div>
              )}

              {/* Podium */}
              {leaders.length >= 3 && (
                <div className="acp-podium">
                  {PODIUM_ORDER.map((leaderIdx, podIdx) => {
                    const entry = podiumEntries[podIdx];
                    if (!entry) return null;
                    const visualRank = [2, 1, 3][podIdx];
                    const color = RANK_COLORS[visualRank - 1];
                    const isMe = user && entry.user_id === user.id;
                    return (
                      <div key={entry.user_id} className="acp-pod-item"
                        onClick={() => openProfile(entry)}
                        style={{ animationDelay: `${podIdx * 0.1}s` }}>
                        {visualRank === 1 && <div className="acp-pod-crown">👑</div>}
                        <div className="acp-pod-avatar" style={{
                          width: PODIUM_SIZE[podIdx], height: PODIUM_SIZE[podIdx],
                          border: `2px solid ${color}60`, boxShadow: `0 0 16px ${color}40`,
                          fontSize: PODIUM_SIZE[podIdx] / 3, color,
                          background: `${color}12`,
                        }}>
                          {entry.photo_url ? <img src={entry.photo_url} alt="" /> : entry.first_name[0]}
                        </div>
                        <div className="acp-pod-name" style={{ color: isMe ? '#ffbe00' : 'rgba(255,255,255,0.7)' }}>
                          {entry.first_name}
                        </div>
                        <div>
                          <div className="acp-pod-count" style={{ color }}>{entry.ad_count}</div>
                          <div className="acp-pod-count-label">ADS</div>
                        </div>
                        <div className="acp-pod-base" style={{
                          height: PODIUM_H[podIdx],
                          background: `${color}10`,
                          border: `1px solid ${color}25`,
                          color,
                        }}>
                          {RANK_MEDALS[visualRank - 1]}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Rank 4+ rows */}
              {leaders.slice(3).length > 0 && (
                <>
                  <div className="acp-section-label">More Competitors</div>
                  {leaders.slice(3).map((entry, idx) => {
                    const isMe = user && entry.user_id === user.id;
                    return (
                      <div
                        key={entry.user_id}
                        className={`acp-row ${isMe ? 'me' : ''}`}
                        onClick={() => openProfile(entry)}
                        style={{ animationDelay: `${idx * 0.04}s`, position: 'relative' }}
                      >
                        <div className="acp-row-rank" style={{
                          color: entry.rank <= 3 ? RANK_COLORS[entry.rank - 1] : 'rgba(255,255,255,0.3)',
                        }}>
                          #{entry.rank}
                        </div>
                        <div className="acp-row-avatar" style={isMe ? { border: '1px solid rgba(255,190,0,0.4)' } : {}}>
                          {entry.photo_url
                            ? <img src={entry.photo_url} alt="" />
                            : <span style={{ color: '#ffbe00' }}>{entry.first_name[0]}</span>}
                        </div>
                        <div className="acp-row-body">
                          <div className="acp-row-name">
                            {entry.first_name}
                            {entry.username && <span style={{ color:'rgba(255,255,255,0.25)', fontSize:12 }}>@{entry.username}</span>}
                            {isMe && <span className="acp-you-badge">YOU</span>}
                          </div>
                          <div className="acp-row-sub">Rank #{entry.rank}</div>
                        </div>
                        <div className="acp-row-score">
                          <div className="acp-row-val">{entry.ad_count}</div>
                          <div className="acp-row-label">ADS</div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}

        </div>
      </div>
    </>
  );
}
