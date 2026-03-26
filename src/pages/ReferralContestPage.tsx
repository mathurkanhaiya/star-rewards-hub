import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { getActiveContests } from '@/lib/api';
import { Contest } from '@/types/telegram';

interface ReferralLeaderEntry {
  rank: number;
  user_id: string;
  referral_count: number;
  verified_count: number;
  points_earned: number;
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

function getProgressPct(contest: Contest): number {
  const dh = (contest as any).duration_hours || 24;
  const start = new Date(contest.ends_at).getTime() - dh * 3600000;
  const total = new Date(contest.ends_at).getTime() - start;
  return Math.min(100, Math.max(0, ((Date.now() - start) / total) * 100));
}

const RANK_COLORS = ['#fbbf24', '#94a3b8', '#f97316', '#a78bfa', '#4ade80'];
const RANK_MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
const PODIUM_ORDER = [1, 0, 2];
const PODIUM_H = [76, 100, 58];
const PODIUM_SIZE = [46, 58, 40];

const REWARD_METHOD_MAP: Record<string, { icon: string; color: string; label: string }> = {
  points: { icon: '🪙', color: '#ffbe00', label: 'PTS'  },
  ton:    { icon: '💎', color: '#22d3ee', label: 'TON'  },
  usdt:   { icon: '💵', color: '#4ade80', label: 'USDT' },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;900&family=Rajdhani:wght@500;600;700&display=swap');

@keyframes rcFadeIn  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
@keyframes rcSpin    { to{transform:rotate(360deg)} }
@keyframes rcFloat   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
@keyframes rcPulse   { 0%,100%{opacity:0.5} 50%{opacity:1} }
@keyframes rcShimmer { 0%{left:-100%} 40%,100%{left:150%} }
@keyframes rcLivePulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.4); }
  50%     { box-shadow: 0 0 0 5px rgba(74,222,128,0);  }
}

.rc-root {
  font-family: 'Rajdhani', sans-serif;
  padding: 0 16px 112px;
  color: #fff; min-height: 100vh; position: relative;
}

/* Ambient */
.rc-ambient {
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background:
    radial-gradient(ellipse 80% 40% at 50% 0%, rgba(74,222,128,0.06) 0%, transparent 60%),
    radial-gradient(ellipse 60% 30% at 20% 90%, rgba(74,222,128,0.04) 0%, transparent 60%),
    radial-gradient(ellipse 50% 30% at 85% 60%, rgba(34,211,238,0.03) 0%, transparent 50%);
}
.rc-grid {
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background-image:
    linear-gradient(rgba(74,222,128,0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(74,222,128,0.02) 1px, transparent 1px);
  background-size: 32px 32px;
}
.rc-content { position: relative; z-index: 1; }

/* ── Header ── */
.rc-header { padding: 4px 0 20px; }
.rc-eyebrow { font-family:'Orbitron',monospace; font-size:9px; letter-spacing:5px; color:rgba(255,255,255,0.2); text-transform:uppercase; margin-bottom:4px; }
.rc-title { font-family:'Orbitron',monospace; font-size:22px; font-weight:900; letter-spacing:2px; color:#fff; line-height:1; }
.rc-title span { color:#4ade80; text-shadow:0 0 16px rgba(74,222,128,0.5); }

/* ── Contest Banner ── */
.rc-banner {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(74,222,128,0.2);
  border-radius: 22px; padding: 20px; margin-bottom: 16px;
  position: relative; overflow: hidden; animation: rcFadeIn 0.4s ease;
}
.rc-banner::before {
  content: ''; position: absolute; top: 0; left: 10%; right: 10%; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(74,222,128,0.5), transparent);
}
.rc-banner-grid {
  position: absolute; inset: 0; pointer-events: none;
  background-image:
    linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px);
  background-size: 22px 22px;
}

.rc-banner-top {
  display: flex; align-items: flex-start; gap: 14px;
  margin-bottom: 14px; position: relative; z-index: 1;
}
.rc-banner-icon {
  width: 52px; height: 52px; border-radius: 16px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 26px;
  background: rgba(74,222,128,0.1); border: 1px solid rgba(74,222,128,0.3);
  box-shadow: 0 0 20px rgba(74,222,128,0.15);
  animation: rcFloat 3s ease-in-out infinite;
}
.rc-banner-info { flex: 1; min-width: 0; }
.rc-banner-title {
  font-family:'Orbitron',monospace; font-size:16px; font-weight:900;
  letter-spacing:1px; color:#fff; line-height:1.1; margin-bottom:6px;
}
.rc-banner-meta {
  font-size:12px; color:rgba(255,255,255,0.3);
  letter-spacing:0.5px; display:flex; gap:10px; flex-wrap:wrap;
}
.rc-live-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-family:'Orbitron',monospace; font-size:8px; font-weight:700;
  letter-spacing:2px; color:#4ade80;
  background: rgba(74,222,128,0.08); border: 1px solid rgba(74,222,128,0.25);
  padding: 4px 10px; border-radius: 20px; flex-shrink: 0;
}
.rc-live-dot {
  width: 8px; height: 8px; border-radius: 50%; background: #4ade80;
  animation: rcPulse 1.2s ease-in-out infinite;
}

/* ── Countdown ── */
.rc-countdown {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  margin-bottom: 14px; position: relative; z-index: 1;
}
.rc-cd-block {
  flex: 1; max-width: 68px;
  background: rgba(0,0,0,0.25); border-radius: 12px;
  padding: 10px 6px; text-align: center;
}
.rc-cd-val {
  font-family:'Orbitron',monospace; font-size:22px; font-weight:900;
  line-height:1; margin-bottom:3px; transition: color 0.3s;
}
.rc-cd-label { font-family:'Orbitron',monospace; font-size:7px; letter-spacing:2px; color:rgba(255,255,255,0.2); text-transform:uppercase; }
.rc-cd-sep { font-family:'Orbitron',monospace; font-size:20px; font-weight:900; color:rgba(255,255,255,0.15); padding-bottom:14px; }

/* ── Progress bar ── */
.rc-prog-wrap { margin-bottom: 12px; position: relative; z-index: 1; }
.rc-prog-labels { display:flex; justify-content:space-between; font-family:'Orbitron',monospace; font-size:8px; letter-spacing:1px; color:rgba(255,255,255,0.2); margin-bottom:5px; }
.rc-prog-track { height: 5px; border-radius: 3px; background: rgba(255,255,255,0.06); overflow: hidden; }
.rc-prog-fill  { height: 100%; border-radius: 3px; transition: width 0.5s; }

/* ── Reward chips ── */
.rc-rewards-strip {
  display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px;
}
.rc-reward-chip {
  display: flex; align-items: center; gap: 5px;
  padding: 5px 12px; border-radius: 20px;
  font-family:'Orbitron',monospace; font-size:9px; font-weight:700; letter-spacing:0.5px;
}

/* ── Stats row ── */
.rc-stats {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 8px; margin-bottom: 16px;
}
.rc-stat {
  border-radius: 14px; padding: 12px 8px; text-align: center;
  position: relative; overflow: hidden;
}
.rc-stat::before {
  content: ''; position: absolute; top: 0; left: 15%; right: 15%; height: 1px;
}
.rc-stat-val { font-family:'Orbitron',monospace; font-size:20px; font-weight:900; line-height:1; margin-bottom:3px; }
.rc-stat-label { font-family:'Orbitron',monospace; font-size:8px; letter-spacing:2px; color:rgba(255,255,255,0.2); text-transform:uppercase; }

/* ── My rank pill ── */
.rc-my-rank {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px; border-radius: 14px; margin-bottom: 16px;
  background: rgba(74,222,128,0.06); border: 1px solid rgba(74,222,128,0.2);
  animation: rcPulse 2s ease-in-out infinite;
}
.rc-my-rank-left { font-family:'Orbitron',monospace; font-size:9px; letter-spacing:2px; color:rgba(255,255,255,0.25); text-transform:uppercase; }
.rc-my-rank-right { font-family:'Orbitron',monospace; font-size:14px; font-weight:700; color:#4ade80; letter-spacing:1px; }

/* ── Podium ── */
.rc-podium {
  display: flex; align-items: flex-end; justify-content: center;
  gap: 10px; margin-bottom: 24px;
}
.rc-pod-item {
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  flex: 1; max-width: 110px; cursor: pointer;
  animation: rcFadeIn 0.4s ease both;
}
.rc-pod-crown { font-size: 22px; animation: rcFloat 2s ease-in-out infinite; }
.rc-pod-avatar {
  border-radius: 50%; overflow: hidden; position: relative;
  display: flex; align-items: center; justify-content: center;
  font-family:'Orbitron',monospace; font-weight:700;
}
.rc-pod-avatar img { width:100%; height:100%; object-fit:cover; }
.rc-pod-name {
  font-family:'Orbitron',monospace; font-size:8px; font-weight:700;
  letter-spacing:1px; text-transform:uppercase; text-align:center;
  width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.rc-pod-stat { text-align: center; }
.rc-pod-val { font-family:'Orbitron',monospace; font-size:13px; font-weight:700; line-height:1; }
.rc-pod-lbl { font-size:8px; letter-spacing:1px; color:rgba(255,255,255,0.2); margin-top:1px; }
.rc-pod-base {
  width:100%; border-radius:12px 12px 0 0;
  display:flex; align-items:center; justify-content:center;
  font-family:'Orbitron',monospace; font-size:18px; font-weight:900;
}

/* ── Rank rows ── */
.rc-section-label { font-family:'Orbitron',monospace; font-size:9px; letter-spacing:3px; color:rgba(255,255,255,0.15); text-transform:uppercase; margin:0 0 10px 2px; }

.rc-row {
  display: flex; align-items: center; gap: 12px;
  background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
  border-radius: 16px; padding: 12px 14px; margin-bottom: 8px;
  cursor: pointer; transition: transform 0.12s, border-color 0.2s;
  animation: rcFadeIn 0.3s ease both; position: relative;
}
.rc-row:active { transform: scale(0.98); }
.rc-row.me {
  background: rgba(74,222,128,0.05); border-color: rgba(74,222,128,0.3);
  box-shadow: 0 0 20px rgba(74,222,128,0.08);
}
.rc-row.me::before {
  content: ''; position: absolute; top: 0; left: 10%; right: 10%; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(74,222,128,0.35), transparent);
}

.rc-row-rank {
  font-family:'Orbitron',monospace; font-size:13px; font-weight:700;
  width:32px; text-align:center; flex-shrink:0;
}
.rc-row-avatar {
  width:42px; height:42px; border-radius:50%; overflow:hidden; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  font-family:'Orbitron',monospace; font-size:15px; font-weight:700;
  background: rgba(255,255,255,0.06);
}
.rc-row-avatar img { width:100%; height:100%; object-fit:cover; }
.rc-row-body { flex:1; min-width:0; }
.rc-row-name { font-size:14px; font-weight:700; color:rgba(255,255,255,0.85); display:flex; align-items:center; gap:6px; }
.rc-you-badge {
  font-family:'Orbitron',monospace; font-size:7px; font-weight:700; letter-spacing:1px;
  padding:1px 6px; border-radius:6px;
  background:rgba(74,222,128,0.15); border:1px solid rgba(74,222,128,0.3); color:#4ade80; flex-shrink:0;
}
.rc-row-meta { font-size:10px; color:rgba(255,255,255,0.2); letter-spacing:0.5px; margin-top:2px; display:flex; gap:8px; }
.rc-row-scores { display:flex; flex-direction:column; align-items:flex-end; flex-shrink:0; gap:2px; }
.rc-row-main { font-family:'Orbitron',monospace; font-size:16px; font-weight:700; color:#4ade80; letter-spacing:0.5px; }
.rc-row-sub-val { font-size:10px; color:rgba(255,255,255,0.2); letter-spacing:1px; text-align:right; }

/* ── No contest ── */
.rc-no-contest {
  display:flex; flex-direction:column; align-items:center;
  justify-content:center; padding:60px 20px; text-align:center;
}
.rc-no-icon { font-size:56px; margin-bottom:16px; animation:rcFloat 3s ease-in-out infinite; filter:drop-shadow(0 0 16px rgba(74,222,128,0.3)); }
.rc-no-title { font-family:'Orbitron',monospace; font-size:14px; font-weight:700; letter-spacing:2px; color:rgba(255,255,255,0.35); margin-bottom:8px; }
.rc-no-sub   { font-size:12px; color:rgba(255,255,255,0.15); letter-spacing:1px; line-height:1.6; }
.rc-no-hint  { margin-top:16px; font-family:'Orbitron',monospace; font-size:9px; letter-spacing:2px; color:rgba(74,222,128,0.3); text-transform:uppercase; animation:rcPulse 2s ease-in-out infinite; }

/* ── Loading ── */
.rc-loading { display:flex; flex-direction:column; align-items:center; padding:56px 0; gap:12px; }
.rc-spinner { width:32px; height:32px; border-radius:50%; border:2px solid rgba(74,222,128,0.15); border-top:2px solid #4ade80; animation:rcSpin 0.8s linear infinite; }
.rc-loading-txt { font-family:'Orbitron',monospace; font-size:9px; letter-spacing:3px; color:rgba(255,255,255,0.15); }

/* ── Empty leaderboard ── */
.rc-empty { text-align:center; padding:40px 0; font-family:'Orbitron',monospace; font-size:9px; letter-spacing:3px; color:rgba(255,255,255,0.1); text-transform:uppercase; }

/* ── How to win ── */
.rc-howto {
  background: rgba(74,222,128,0.03); border: 1px solid rgba(74,222,128,0.1);
  border-radius: 16px; padding: 16px; margin-bottom: 16px;
}
.rc-howto-title { font-family:'Orbitron',monospace; font-size:9px; letter-spacing:3px; color:rgba(74,222,128,0.4); text-transform:uppercase; margin-bottom:12px; }
.rc-howto-step { display:flex; align-items:flex-start; gap:10px; margin-bottom:10px; }
.rc-howto-step:last-child { margin-bottom:0; }
.rc-howto-num { width:26px; height:26px; border-radius:8px; background:rgba(74,222,128,0.1); border:1px solid rgba(74,222,128,0.25); display:flex; align-items:center; justify-content:center; font-family:'Orbitron',monospace; font-size:10px; font-weight:700; color:#4ade80; flex-shrink:0; }
.rc-howto-main { font-size:13px; font-weight:600; color:rgba(255,255,255,0.75); }
.rc-howto-sub  { font-size:10px; color:rgba(255,255,255,0.25); letter-spacing:0.5px; margin-top:1px; }
`;

export default function ReferralContestPage({ onBack }: { onBack?: () => void }) {
  const { user } = useApp();

  const [contest, setContest]     = useState<Contest | null>(null);
  const [leaders, setLeaders]     = useState<ReferralLeaderEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [countdown, setCountdown] = useState({ h: 0, m: 0, s: 0, urgent: false });
  const [progPct, setProgPct]     = useState(0);
  const [myEntry, setMyEntry]     = useState<ReferralLeaderEntry | null>(null);
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [totalVerified,  setTotalVerified]  = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /* ── Load active referral contest ── */
  const loadContest = useCallback(async () => {
    const all = await getActiveContests();
    const refContest = (all as Contest[]).find(
      c => c.contest_type === 'referral' && c.is_active && !c.rewards_distributed
    );
    setContest(refContest || null);
    if (refContest) await loadLeaderboard(refContest);
    setLoading(false);
  }, []);

  /* ── Build leaderboard from referrals table ── */
  const loadLeaderboard = useCallback(async (c: Contest) => {
    const dh = (c as any).duration_hours || 24;
    const startISO = new Date(new Date(c.ends_at).getTime() - dh * 3600000).toISOString();

    /* Fetch referrals created during the contest window */
    const { data: refs } = await supabase
      .from('referrals')
      .select('referrer_id, referred_id, is_verified, points_earned, created_at')
      .gte('created_at', startISO)
      .lt('created_at', c.ends_at);

    if (!refs || refs.length === 0) {
      setLeaders([]); setTotalReferrals(0); setTotalVerified(0); return;
    }

    /* Aggregate per referrer */
    const agg: Record<string, { total: number; verified: number; points: number }> = {};
    refs.forEach((r: any) => {
      if (!agg[r.referrer_id]) agg[r.referrer_id] = { total: 0, verified: 0, points: 0 };
      agg[r.referrer_id].total++;
      if (r.is_verified) agg[r.referrer_id].verified++;
      agg[r.referrer_id].points += r.points_earned || 0;
    });

    /* Sort by verified desc, then total desc */
    const sorted = Object.entries(agg)
      .sort((a, b) => b[1].verified - a[1].verified || b[1].total - a[1].total)
      .slice(0, 50);

    /* Fetch user profiles */
    const userIds = sorted.map(([uid]) => uid);
    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, username, telegram_id, photo_url')
      .in('id', userIds);

    const userMap: Record<string, any> = {};
    (users || []).forEach(u => { userMap[u.id] = u; });

    const entries: ReferralLeaderEntry[] = sorted.map(([uid, data], i) => ({
      rank:           i + 1,
      user_id:        uid,
      referral_count: data.total,
      verified_count: data.verified,
      points_earned:  data.points,
      first_name:     userMap[uid]?.first_name   || 'User',
      username:       userMap[uid]?.username      || '',
      photo_url:      userMap[uid]?.photo_url     || null,
      telegram_id:    userMap[uid]?.telegram_id   || 0,
    }));

    setLeaders(entries);
    setTotalReferrals(refs.length);
    setTotalVerified(refs.filter((r: any) => r.is_verified).length);

    /* My position */
    if (user) {
      const mine = entries.find(e => e.user_id === user.id);
      setMyEntry(mine || null);
    }
  }, [user]);

  /* ── Countdown ticker ── */
  useEffect(() => {
    if (!contest) return;
    function tick() {
      const diff = new Date(contest!.ends_at).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown({ h: 0, m: 0, s: 0, urgent: false });
        return;
      }
      setCountdown({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
        urgent: diff < 3600000,
      });
      setProgPct(getProgressPct(contest!));
    }
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [contest]);

  /* ── Auto-refresh ── */
  useEffect(() => {
    loadContest();
    const interval = setInterval(() => {
      if (contest) loadLeaderboard(contest);
    }, 30000);
    return () => clearInterval(interval);
  }, [loadContest]);

  function openProfile(entry: ReferralLeaderEntry) {
    triggerHaptic();
    if (entry.username) window.open(`https://t.me/${entry.username}`, '_blank');
    else if (entry.telegram_id) window.open(`tg://user?id=${entry.telegram_id}`);
  }

  const rewardMethod = REWARD_METHOD_MAP[(contest as any)?.reward_method || 'points'];

  const rewardChips = (['1st','2nd','3rd','4th','5th'] as const)
    .map((k, i) => ({ i, val: (contest as any)?.[`reward_${k}`] }))
    .filter(r => r.val > 0);

  const podiumEntries = leaders.length >= 3
    ? [leaders[1], leaders[0], leaders[2]]
    : leaders.slice(0, 3);

  return (
    <>
      <style>{CSS}</style>
      <div className="rc-root">
        <div className="rc-ambient" />
        <div className="rc-grid" />
        <div className="rc-content">

          {/* Back button */}
          {onBack && (
            <button onClick={onBack} style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
              color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'Orbitron, monospace',
              letterSpacing: 2, padding: '6px 14px', cursor: 'pointer', marginBottom: 12,
            }}>← BACK</button>
          )}
          {/* ── Header ── */}
          <div className="rc-header">
            <div className="rc-eyebrow">Live · Competition</div>
            <div className="rc-title">REFERRAL <span>RACE</span></div>
          </div>

          {/* ── Loading ── */}
          {loading && (
            <div className="rc-loading">
              <div className="rc-spinner" />
              <div className="rc-loading-txt">Loading Contest</div>
            </div>
          )}

          {/* ── No active contest ── */}
          {!loading && !contest && (
            <>
              <div className="rc-no-contest">
                <div className="rc-no-icon">👥</div>
                <div className="rc-no-title">No Active Contest</div>
                <div className="rc-no-sub">
                  The Referral Race hasn't started yet.<br />
                  Keep inviting friends to be ready!
                </div>
                <div className="rc-no-hint">✦ Check back soon ✦</div>
              </div>

              {/* How it works — shown even when no contest */}
              <div className="rc-howto">
                <div className="rc-howto-title">How Referral Race Works</div>
                {[
                  { step: '1', main: 'Share your referral link',   sub: 'Send it to friends via Telegram'         },
                  { step: '2', main: 'Friends join the app',        sub: 'They use your link to sign up'           },
                  { step: '3', main: 'Get verified referrals',      sub: 'Verified = friend completed first task'  },
                  { step: '4', main: 'Climb the leaderboard',       sub: 'Top referrers win prizes'                },
                ].map(s => (
                  <div key={s.step} className="rc-howto-step">
                    <div className="rc-howto-num">{s.step}</div>
                    <div>
                      <div className="rc-howto-main">{s.main}</div>
                      <div className="rc-howto-sub">{s.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Active contest ── */}
          {!loading && contest && (
            <>
              {/* Banner */}
              <div className="rc-banner">
                <div className="rc-banner-grid" />
                <div className="rc-banner-top">
                  <div className="rc-banner-icon">
                    {(contest as any).banner_emoji || '👥'}
                  </div>
                  <div className="rc-banner-info">
                    <div className="rc-banner-title">{contest.title}</div>
                    <div className="rc-banner-meta">
                      <span>👥 Referral Race</span>
                      <span>{rewardMethod.icon} {rewardMethod.label}</span>
                      <span>🏆 {rewardChips.length} winners</span>
                    </div>
                  </div>
                  <div className="rc-live-badge">
                    <div className="rc-live-dot" />
                    LIVE
                  </div>
                </div>

                {/* Countdown */}
                <div className="rc-countdown">
                  {[
                    { val: countdown.h, label: 'Hours'   },
                    { val: countdown.m, label: 'Minutes' },
                    { val: countdown.s, label: 'Seconds' },
                  ].map((cd, i) => (
                    <React.Fragment key={cd.label}>
                      {i > 0 && <div className="rc-cd-sep">:</div>}
                      <div className="rc-cd-block" style={{
                        border: `1px solid ${countdown.urgent ? 'rgba(239,68,68,0.2)' : 'rgba(74,222,128,0.12)'}`,
                      }}>
                        <div className="rc-cd-val" style={{
                          color: countdown.urgent ? '#ef4444' : '#4ade80',
                        }}>
                          {String(cd.val).padStart(2, '0')}
                        </div>
                        <div className="rc-cd-label">{cd.label}</div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>

                {/* Progress */}
                <div className="rc-prog-wrap">
                  <div className="rc-prog-labels">
                    <span>Contest Progress</span>
                    <span>{Math.round(progPct)}% elapsed</span>
                  </div>
                  <div className="rc-prog-track">
                    <div className="rc-prog-fill" style={{
                      width: `${progPct}%`,
                      background: countdown.urgent
                        ? 'linear-gradient(90deg,#ef444480,#ef4444)'
                        : 'linear-gradient(90deg,#4ade8060,#4ade80)',
                      boxShadow: `0 0 8px ${countdown.urgent ? 'rgba(239,68,68,0.5)' : 'rgba(74,222,128,0.4)'}`,
                    }} />
                  </div>
                </div>
              </div>

              {/* Reward chips */}
              {rewardChips.length > 0 && (
                <div className="rc-rewards-strip">
                  {rewardChips.map(r => (
                    <div key={r.i} className="rc-reward-chip" style={{
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
              )}

              {/* Contest stats row */}
              <div className="rc-stats">
                {[
                  { label: 'Total Refs',  val: totalReferrals, color: '#4ade80' },
                  { label: 'Verified',    val: totalVerified,  color: '#22d3ee' },
                  { label: 'Competitors', val: leaders.length, color: '#a78bfa' },
                ].map((s, i) => (
                  <div key={i} className="rc-stat" style={{
                    background: `${s.color}06`,
                    border: `1px solid ${s.color}18`,
                  }}>
                    <div
                      className="rc-stat"
                      style={{
                        position:'absolute', top:0, left:'15%', right:'15%', height:'1px',
                        background:`linear-gradient(90deg,transparent,${s.color}35,transparent)`,
                        padding:0, margin:0, border:'none', borderRadius:0,
                      }}
                    />
                    <div className="rc-stat-val" style={{ color: s.color }}>{s.val}</div>
                    <div className="rc-stat-label">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* My rank */}
              {myEntry && (
                <div className="rc-my-rank">
                  <div>
                    <div className="rc-my-rank-left">Your Position</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.2)', letterSpacing:'0.5px', marginTop:2 }}>
                      {myEntry.referral_count} invited · {myEntry.verified_count} verified
                    </div>
                  </div>
                  <div className="rc-my-rank-right">
                    #{myEntry.rank}
                    {myEntry.rank <= rewardChips.length && (
                      <span style={{ fontSize:10, color:'rgba(74,222,128,0.5)', marginLeft:8, letterSpacing:'1px' }}>
                        · IN PRIZES 🎁
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Empty */}
              {leaders.length === 0 && (
                <div className="rc-empty">✦ Be the first to refer friends ✦</div>
              )}

              {/* Podium */}
              {leaders.length >= 3 && (
                <div className="rc-podium">
                  {PODIUM_ORDER.map((_, podIdx) => {
                    const entry = podiumEntries[podIdx];
                    if (!entry) return null;
                    const visualRank = [2, 1, 3][podIdx];
                    const color = RANK_COLORS[visualRank - 1];
                    const isMe = user && entry.user_id === user.id;
                    return (
                      <div
                        key={entry.user_id}
                        className="rc-pod-item"
                        onClick={() => openProfile(entry)}
                        style={{ animationDelay: `${podIdx * 0.1}s` }}
                      >
                        {visualRank === 1 && <div className="rc-pod-crown">👑</div>}
                        <div className="rc-pod-avatar" style={{
                          width:  PODIUM_SIZE[podIdx],
                          height: PODIUM_SIZE[podIdx],
                          border: `2px solid ${color}60`,
                          boxShadow: `0 0 16px ${color}40`,
                          fontSize: PODIUM_SIZE[podIdx] / 3,
                          color,
                          background: `${color}12`,
                        }}>
                          {entry.photo_url
                            ? <img src={entry.photo_url} alt="" />
                            : entry.first_name[0]}
                        </div>
                        <div className="rc-pod-name" style={{ color: isMe ? '#ffbe00' : 'rgba(255,255,255,0.7)' }}>
                          {entry.first_name}
                        </div>
                        <div className="rc-pod-stat">
                          <div className="rc-pod-val" style={{ color }}>{entry.verified_count}</div>
                          <div className="rc-pod-lbl">VERIFIED</div>
                        </div>
                        <div className="rc-pod-base" style={{
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
                  <div className="rc-section-label">All Competitors</div>
                  {leaders.slice(3).map((entry, idx) => {
                    const isMe = user && entry.user_id === user.id;
                    const inPrizes = entry.rank <= rewardChips.length;
                    return (
                      <div
                        key={entry.user_id}
                        className={`rc-row ${isMe ? 'me' : ''}`}
                        onClick={() => openProfile(entry)}
                        style={{ animationDelay: `${idx * 0.04}s` }}
                      >
                        <div className="rc-row-rank" style={{
                          color: RANK_COLORS[entry.rank - 1] || 'rgba(255,255,255,0.25)',
                        }}>
                          {entry.rank <= 3 ? RANK_MEDALS[entry.rank - 1] : `#${entry.rank}`}
                        </div>
                        <div className="rc-row-avatar" style={isMe ? { border: '1px solid rgba(74,222,128,0.4)' } : {}}>
                          {entry.photo_url
                            ? <img src={entry.photo_url} alt="" />
                            : <span style={{ color: '#4ade80' }}>{entry.first_name[0]}</span>}
                        </div>
                        <div className="rc-row-body">
                          <div className="rc-row-name">
                            {entry.first_name}
                            {entry.username && (
                              <span style={{ color:'rgba(255,255,255,0.25)', fontSize:12 }}>
                                @{entry.username}
                              </span>
                            )}
                            {isMe && <span className="rc-you-badge">YOU</span>}
                            {inPrizes && !isMe && (
                              <span style={{ fontSize:8, color:'rgba(251,191,36,0.5)', fontFamily:"'Orbitron',monospace", letterSpacing:'1px' }}>
                                🎁
                              </span>
                            )}
                          </div>
                          <div className="rc-row-meta">
                            <span>{entry.referral_count} invited</span>
                            <span style={{ color: '#22d3ee' }}>{entry.verified_count} verified</span>
                          </div>
                        </div>
                        <div className="rc-row-scores">
                          <div className="rc-row-main">{entry.verified_count}</div>
                          <div className="rc-row-sub-val">VERIFIED</div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* How it works (shown at bottom when contest is active) */}
              <div style={{ marginTop: 20 }}>
                <div className="rc-howto">
                  <div className="rc-howto-title">How to Win</div>
                  {[
                    { step: '1', main: 'Share your referral link',  sub: 'More referrals = higher rank'           },
                    { step: '2', main: 'Get verified referrals',     sub: 'Friend must complete first action'      },
                    { step: '3', main: 'Hold your position',         sub: `Top ${rewardChips.length} win prizes`   },
                  ].map(s => (
                    <div key={s.step} className="rc-howto-step">
                      <div className="rc-howto-num">{s.step}</div>
                      <div>
                        <div className="rc-howto-main">{s.main}</div>
                        <div className="rc-howto-sub">{s.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}
