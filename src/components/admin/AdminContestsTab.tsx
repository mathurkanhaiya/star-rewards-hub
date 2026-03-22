import React, { useState, useMemo } from 'react';
import { Contest } from '@/types/telegram';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  contests: Contest[];
  onCreateContest: (contest: any) => void;
  onEndContest: (id: string) => void;
  onDeleteContest?: (id: string) => void;
  onRefresh: () => void;
}

const CONTEST_TYPES = [
  { value: 'ads_watch', label: 'Ads Watch',    icon: '📺', color: '#ffbe00', desc: 'Who watches the most ads'     },
  { value: 'referral',  label: 'Referral Race', icon: '👥', color: '#4ade80', desc: 'Who refers the most friends' },
  { value: 'points',    label: 'Points Earn',   icon: '⚡', color: '#22d3ee', desc: 'Who earns the most points'   },
  { value: 'games',     label: 'Game Masters',  icon: '🎮', color: '#a78bfa', desc: 'Who plays the most games'    },
  { value: 'daily',     label: 'Daily Streak',  icon: '🔥', color: '#fb923c', desc: 'Longest daily streak'        },
  { value: 'tasks',     label: 'Task Hunter',   icon: '📋', color: '#f472b6', desc: 'Most tasks completed'        },
];

const REWARD_METHODS = [
  { value: 'points', label: 'Points', icon: '🪙', color: '#ffbe00' },
  { value: 'ton',    label: 'TON',    icon: '💎', color: '#22d3ee' },
  { value: 'usdt',   label: 'USDT',   icon: '💵', color: '#4ade80' },
];

const DURATION_PRESETS = [
  { label: '1h',  hours: 1   },
  { label: '6h',  hours: 6   },
  { label: '12h', hours: 12  },
  { label: '24h', hours: 24  },
  { label: '3d',  hours: 72  },
  { label: '7d',  hours: 168 },
];

const WINNER_MEDALS = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
const MEDAL_COLORS  = ['#fbbf24','#94a3b8','#f97316','#a78bfa','#4ade80','#22d3ee','#f472b6','#fb923c','#818cf8','#34d399'];

const DEFAULT_FORM = {
  title: '', description: '', banner_emoji: '🏆',
  contest_type: 'ads_watch', duration_hours: 24,
  reward_method: 'points', winner_count: 5,
  rewards: [5000, 3000, 2000, 1000, 500, 250, 100, 100, 50, 50],
};

function getTimeRemaining(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return { text: 'Ended', active: false };
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return { text: `${d}d ${h}h left`, active: true };
  return { text: `${h}h ${m}m left`, active: true };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;900&family=Rajdhani:wght@500;600;700&display=swap');

@keyframes acFadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
@keyframes acShine  { 0%{left:-100%} 40%,100%{left:150%} }
@keyframes acPulse  { 0%,100%{opacity:0.6} 50%{opacity:1} }
@keyframes acFloat  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
@keyframes acSpin   { to{transform:rotate(360deg)} }

.ac-root { font-family:'Rajdhani',sans-serif; color:#fff; }

/* Stats */
.ac-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:14px; }
.ac-stat  { border-radius:14px; padding:12px 10px; text-align:center; position:relative; overflow:hidden; }
.ac-stat-val   { font-family:'Orbitron',monospace; font-size:22px; font-weight:900; line-height:1; margin-bottom:2px; }
.ac-stat-label { font-family:'Orbitron',monospace; font-size:8px; letter-spacing:2px; color:rgba(255,255,255,0.25); text-transform:uppercase; }

/* Create btn */
.ac-create-btn {
  width:100%; padding:14px; border-radius:14px; border:none;
  font-family:'Orbitron',monospace; font-size:12px; font-weight:700; letter-spacing:2px;
  cursor:pointer; transition:transform 0.12s,box-shadow 0.2s; margin-bottom:12px;
  display:flex; align-items:center; justify-content:center; gap:8px;
  position:relative; overflow:hidden;
}
.ac-create-btn::after { content:''; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent); animation:acShine 3s ease-in-out infinite; }
.ac-create-btn:active { transform:scale(0.97); }

/* Toast */
.ac-toast {
  padding:10px 14px; border-radius:12px; margin-bottom:12px;
  font-family:'Orbitron',monospace; font-size:10px; letter-spacing:2px;
  text-align:center; animation:acFadeIn 0.2s ease;
}
.ac-toast.success { background:rgba(74,222,128,0.08); border:1px solid rgba(74,222,128,0.25); color:#4ade80; }
.ac-toast.error   { background:rgba(239,68,68,0.08);  border:1px solid rgba(239,68,68,0.25);  color:#f87171; }

/* Form */
.ac-form {
  background:rgba(255,255,255,0.02); border:1px solid rgba(167,139,250,0.2);
  border-radius:20px; padding:20px; margin-bottom:14px;
  animation:acFadeIn 0.25s ease; position:relative; overflow:hidden;
}
.ac-form::before { content:''; position:absolute; top:0; left:10%; right:10%; height:1px; background:linear-gradient(90deg,transparent,rgba(167,139,250,0.4),transparent); }
.ac-form-title { font-family:'Orbitron',monospace; font-size:10px; letter-spacing:3px; color:rgba(167,139,250,0.5); text-transform:uppercase; margin-bottom:16px; }
.ac-section-label { font-family:'Orbitron',monospace; font-size:8px; letter-spacing:3px; color:rgba(255,255,255,0.2); text-transform:uppercase; margin:14px 0 8px; }

.ac-input {
  width:100%; padding:11px 14px; border-radius:12px;
  background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.08);
  color:#fff; font-family:'Rajdhani',sans-serif; font-size:14px;
  outline:none; transition:border-color 0.2s; margin-bottom:10px; box-sizing:border-box;
}
.ac-input:focus { border-color:rgba(167,139,250,0.4); }
.ac-input::placeholder { color:rgba(255,255,255,0.2); }

/* Type grid */
.ac-type-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin-bottom:10px; }
.ac-type-btn { padding:12px 10px; border-radius:14px; border:none; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); }
.ac-type-btn:active { transform:scale(0.95); }
.ac-type-icon { font-size:20px; flex-shrink:0; }
.ac-type-label { font-family:'Orbitron',monospace; font-size:9px; font-weight:700; letter-spacing:1px; }
.ac-type-desc  { font-size:10px; color:rgba(255,255,255,0.2); margin-top:1px; }

/* Duration */
.ac-duration-row { display:flex; gap:6px; margin-bottom:10px; flex-wrap:wrap; }
.ac-dur-btn { flex:1; min-width:44px; padding:8px; border-radius:10px; border:none; font-family:'Orbitron',monospace; font-size:9px; font-weight:600; letter-spacing:1px; cursor:pointer; transition:all 0.2s; text-align:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); color:rgba(255,255,255,0.3); }

/* Method */
.ac-method-row { display:flex; gap:6px; margin-bottom:12px; }
.ac-method-btn { flex:1; padding:10px; border-radius:12px; border:none; cursor:pointer; font-family:'Orbitron',monospace; font-size:9px; font-weight:700; letter-spacing:1px; display:flex; flex-direction:column; align-items:center; gap:4px; transition:all 0.2s; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); color:rgba(255,255,255,0.25); }
.ac-method-icon { font-size:18px; }

/* Winner count */
.ac-winner-row { display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:10px 14px; margin-bottom:10px; }
.ac-winner-label { font-family:'Orbitron',monospace; font-size:9px; letter-spacing:2px; color:rgba(255,255,255,0.3); }
.ac-winner-controls { display:flex; align-items:center; gap:10px; }
.ac-counter-btn { width:28px; height:28px; border-radius:8px; border:none; background:rgba(167,139,250,0.1); border:1px solid rgba(167,139,250,0.25); color:#a78bfa; font-size:16px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:transform 0.1s; }
.ac-counter-btn:active { transform:scale(0.88); }
.ac-winner-val { font-family:'Orbitron',monospace; font-size:18px; font-weight:700; color:#a78bfa; min-width:24px; text-align:center; }

/* Rewards grid */
.ac-rewards-grid { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
.ac-reward-row { display:flex; align-items:center; gap:10px; }
.ac-reward-medal { font-size:18px; width:28px; text-align:center; flex-shrink:0; }
.ac-reward-place { font-family:'Orbitron',monospace; font-size:9px; font-weight:700; letter-spacing:1px; width:32px; flex-shrink:0; }
.ac-reward-input { flex:1; padding:9px 12px; border-radius:10px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.07); color:#fff; font-family:'Orbitron',monospace; font-size:13px; font-weight:700; outline:none; text-align:center; transition:border-color 0.2s; }
.ac-reward-input:focus { border-color:rgba(167,139,250,0.4); }
.ac-reward-unit { font-size:10px; color:rgba(255,255,255,0.25); letter-spacing:1px; width:36px; flex-shrink:0; }

/* Preview */
.ac-preview { background:rgba(167,139,250,0.05); border:1px solid rgba(167,139,250,0.15); border-radius:14px; padding:14px; margin-bottom:12px; }
.ac-preview-label { font-family:'Orbitron',monospace; font-size:8px; letter-spacing:3px; color:rgba(167,139,250,0.4); text-transform:uppercase; margin-bottom:8px; }
.ac-preview-title { font-family:'Orbitron',monospace; font-size:14px; font-weight:900; letter-spacing:1px; color:#fff; margin-bottom:4px; }
.ac-preview-meta { font-size:11px; color:rgba(255,255,255,0.3); letter-spacing:0.5px; }

/* Launch */
.ac-launch-btn { width:100%; padding:16px; border-radius:14px; border:none; background:linear-gradient(135deg,#a78bfa,#7c3aed); color:#fff; font-family:'Orbitron',monospace; font-size:13px; font-weight:700; letter-spacing:2px; cursor:pointer; transition:transform 0.12s; box-shadow:0 4px 20px rgba(167,139,250,0.35); position:relative; overflow:hidden; }
.ac-launch-btn::after { content:''; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent); animation:acShine 3s ease-in-out infinite; }
.ac-launch-btn:active { transform:scale(0.97); }
.ac-launch-btn:disabled { opacity:0.4; cursor:not-allowed; }

/* Spinner inside button */
.ac-btn-spinner { width:16px; height:16px; border-radius:50%; border:2px solid rgba(255,255,255,0.3); border-top:2px solid #fff; animation:acSpin 0.7s linear infinite; display:inline-block; }

/* Contest card */
.ac-card { background:rgba(255,255,255,0.02); border-radius:20px; margin-bottom:10px; overflow:hidden; position:relative; animation:acFadeIn 0.3s ease both; }
.ac-card-beam { position:absolute; top:0; left:10%; right:10%; height:1px; pointer-events:none; }
.ac-card-body { padding:16px; }
.ac-card-top { display:flex; align-items:flex-start; gap:12px; margin-bottom:12px; }
.ac-card-icon { width:46px; height:46px; border-radius:14px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:22px; animation:acFloat 3s ease-in-out infinite; }
.ac-card-info { flex:1; min-width:0; }
.ac-card-title { font-family:'Orbitron',monospace; font-size:13px; font-weight:900; letter-spacing:1px; color:#fff; margin-bottom:4px; }
.ac-card-meta { font-size:11px; color:rgba(255,255,255,0.25); letter-spacing:0.5px; display:flex; gap:8px; flex-wrap:wrap; }
.ac-status-badge { font-family:'Orbitron',monospace; font-size:8px; font-weight:700; letter-spacing:2px; padding:4px 10px; border-radius:20px; flex-shrink:0; align-self:flex-start; }

/* Progress */
.ac-progress-wrap { margin-bottom:12px; }
.ac-progress-labels { display:flex; justify-content:space-between; font-family:'Orbitron',monospace; font-size:8px; letter-spacing:1px; color:rgba(255,255,255,0.2); margin-bottom:5px; }
.ac-progress-track { height:5px; border-radius:3px; background:rgba(255,255,255,0.06); overflow:hidden; }
.ac-progress-fill  { height:100%; border-radius:3px; transition:width 0.5s; }

/* Reward chips */
.ac-rewards-row { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px; }
.ac-reward-chip { display:flex; align-items:center; gap:4px; padding:4px 10px; border-radius:20px; font-family:'Orbitron',monospace; font-size:9px; font-weight:700; letter-spacing:0.5px; }

/* Action buttons row */
.ac-card-actions { display:flex; gap:8px; }
.ac-distribute-btn { flex:1; padding:12px; border-radius:12px; border:none; background:linear-gradient(135deg,#ffbe00,#f59e0b); color:#1a0800; font-family:'Orbitron',monospace; font-size:11px; font-weight:700; letter-spacing:2px; cursor:pointer; transition:transform 0.12s; box-shadow:0 3px 12px rgba(255,190,0,0.3); }
.ac-distribute-btn:active { transform:scale(0.97); }

.ac-cancel-btn { padding:12px 16px; border-radius:12px; border:none; background:rgba(251,191,36,0.08); border:1px solid rgba(251,191,36,0.2); color:#fbbf24; font-family:'Orbitron',monospace; font-size:10px; font-weight:700; letter-spacing:1px; cursor:pointer; transition:transform 0.12s,background 0.2s; }
.ac-cancel-btn:active { transform:scale(0.97); }
.ac-cancel-btn:hover  { background:rgba(251,191,36,0.12); }

.ac-delete-btn { padding:12px 14px; border-radius:12px; border:none; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); color:#ef4444; font-family:'Orbitron',monospace; font-size:10px; font-weight:700; letter-spacing:1px; cursor:pointer; transition:transform 0.12s,background 0.2s; }
.ac-delete-btn:active { transform:scale(0.97); }
.ac-delete-btn.confirm { background:rgba(239,68,68,0.2); border-color:rgba(239,68,68,0.5); }

/* Empty */
.ac-empty { text-align:center; padding:48px 0; font-family:'Orbitron',monospace; font-size:9px; letter-spacing:3px; color:rgba(255,255,255,0.1); text-transform:uppercase; }
`;

export default function AdminContestsTab({ contests, onCreateContest, onEndContest, onDeleteContest, onRefresh }: Props) {
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState({ ...DEFAULT_FORM });
  const [creating, setCreating]       = useState(false);
  const [toast, setToast]             = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  const stats = useMemo(() => ({
    active:      contests.filter(c => c.is_active && !c.rewards_distributed).length,
    distributed: contests.filter(c => c.rewards_distributed).length,
    ended:       contests.filter(c => !c.is_active && !c.rewards_distributed).length,
  }), [contests]);

  function showToast(text: string, type: 'success' | 'error' = 'success') {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  }

  function setReward(idx: number, val: number) {
    const next = [...form.rewards];
    next[idx] = val;
    setForm(p => ({ ...p, rewards: next }));
  }

  /* ── Direct Supabase insert ── */
  async function handleCreate() {
    if (!form.title.trim()) return;
    setCreating(true);

    try {
      const endsAt = new Date(Date.now() + form.duration_hours * 3600000).toISOString();

      const insertData: any = {
        title:          form.title.trim(),
        contest_type:   form.contest_type,
        ends_at:        endsAt,
        is_active:      true,
        rewards_distributed: false,
        reward_1st:     form.rewards[0] || 0,
        reward_2nd:     form.rewards[1] || 0,
        reward_3rd:     form.rewards[2] || 0,
        reward_4th:     form.rewards[3] || 0,
        reward_5th:     form.rewards[4] || 0,
        // Extended fields (store as metadata if your schema supports them)
        description:    form.description || null,
        reward_method:  form.reward_method,
        banner_emoji:   form.banner_emoji,
        winner_count:   form.winner_count,
        duration_hours: form.duration_hours,
      };

      // Add winner 6-10 if your schema has those columns
      if (form.winner_count > 5) {
        for (let i = 5; i < form.winner_count; i++) {
          const key = ['6th','7th','8th','9th','10th'][i - 5];
          insertData[`reward_${key}`] = form.rewards[i] || 0;
        }
      }

      const { data, error } = await supabase
        .from('contests')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Contest insert error:', error);
        showToast(`Failed: ${error.message}`, 'error');
        setCreating(false);
        return;
      }

      showToast('Contest launched! 🏆', 'success');
      setShowForm(false);
      setForm({ ...DEFAULT_FORM });
      onRefresh();

    } catch (err: any) {
      console.error('Contest create error:', err);
      showToast(`Error: ${err.message}`, 'error');
    }

    setCreating(false);
  }

  /* ── Cancel (set is_active = false) ── */
  async function handleCancel(id: string) {
    if (confirmCancel !== id) {
      setConfirmCancel(id);
      setTimeout(() => setConfirmCancel(null), 3000);
      return;
    }
    setConfirmCancel(null);
    const { error } = await supabase
      .from('contests')
      .update({ is_active: false })
      .eq('id', id);
    if (error) { showToast('Failed to cancel', 'error'); return; }
    showToast('Contest cancelled', 'success');
    onRefresh();
  }

  /* ── Delete contest + related data ── */
  async function handleDelete(id: string) {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
      return;
    }
    setConfirmDelete(null);

    try {
      // Delete related contest_entries if table exists
      await supabase.from('contest_entries').delete().eq('contest_id', id);
      // Delete contest rewards if table exists  
      await supabase.from('contest_rewards').delete().eq('contest_id', id);
      // Delete the contest itself
      const { error } = await supabase.from('contests').delete().eq('id', id);
      if (error) throw error;
      showToast('Contest deleted', 'success');
      if (onDeleteContest) onDeleteContest(id);
      onRefresh();
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  }

  const selectedType   = CONTEST_TYPES.find(t => t.value === form.contest_type) || CONTEST_TYPES[0];
  const selectedMethod = REWARD_METHODS.find(m => m.value === form.reward_method) || REWARD_METHODS[0];

  return (
    <>
      <style>{CSS}</style>
      <div className="ac-root">

        {/* Stats */}
        <div className="ac-stats">
          {[
            { label: 'Active',   val: stats.active,      color: '#4ade80' },
            { label: 'Ended',    val: stats.ended,        color: '#ef4444' },
            { label: 'Paid Out', val: stats.distributed,  color: '#ffbe00' },
          ].map(s => (
            <div key={s.label} className="ac-stat"
              style={{ background: `${s.color}08`, border: `1px solid ${s.color}20` }}>
              <div className="ac-stat-val" style={{ color: s.color }}>{s.val}</div>
              <div className="ac-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Toast */}
        {toast && <div className={`ac-toast ${toast.type}`}>{toast.text}</div>}

        {/* Create button */}
        <button
          className="ac-create-btn"
          onClick={() => setShowForm(v => !v)}
          style={!showForm
            ? { background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', color: '#fff', boxShadow: '0 4px 20px rgba(167,139,250,0.3)' }
            : { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', boxShadow: 'none' }
          }
        >
          {showForm ? '✕  CANCEL' : '🏆  CREATE NEW CONTEST'}
        </button>

        {/* ── FORM ── */}
        {showForm && (
          <div className="ac-form">
            <div className="ac-form-title">New Contest</div>

            {/* Emoji + title */}
            <div style={{ display:'flex', gap:8, marginBottom:10 }}>
              <input className="ac-input"
                style={{ width:56, textAlign:'center', fontSize:22, padding:'8px', marginBottom:0, flexShrink:0 }}
                value={form.banner_emoji}
                onChange={e => setForm(p => ({ ...p, banner_emoji: e.target.value }))}
                maxLength={2}
              />
              <input className="ac-input"
                style={{ flex:1, marginBottom:0 }}
                placeholder="Contest title *"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              />
            </div>
            <input className="ac-input" placeholder="Description (optional)"
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            />

            {/* Contest type */}
            <div className="ac-section-label">Contest Type</div>
            <div className="ac-type-grid">
              {CONTEST_TYPES.map(t => (
                <button key={t.value} className="ac-type-btn"
                  onClick={() => setForm(p => ({ ...p, contest_type: t.value }))}
                  style={form.contest_type === t.value
                    ? { background:`${t.color}12`, borderColor:`${t.color}40`, boxShadow:`0 0 12px ${t.color}20` }
                    : {}}
                >
                  <span className="ac-type-icon">{t.icon}</span>
                  <div>
                    <div className="ac-type-label" style={{ color: form.contest_type === t.value ? t.color : 'rgba(255,255,255,0.6)' }}>
                      {t.label}
                    </div>
                    <div className="ac-type-desc">{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Duration */}
            <div className="ac-section-label">Duration</div>
            <div className="ac-duration-row">
              {DURATION_PRESETS.map(d => (
                <button key={d.hours} className="ac-dur-btn"
                  onClick={() => setForm(p => ({ ...p, duration_hours: d.hours }))}
                  style={form.duration_hours === d.hours
                    ? { background:'rgba(167,139,250,0.12)', borderColor:'rgba(167,139,250,0.4)', color:'#a78bfa' }
                    : {}}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <input className="ac-input" type="number" placeholder="Or enter custom hours"
              value={form.duration_hours}
              onChange={e => setForm(p => ({ ...p, duration_hours: Math.max(1, +e.target.value) }))}
            />

            {/* Reward method */}
            <div className="ac-section-label">Reward Method</div>
            <div className="ac-method-row">
              {REWARD_METHODS.map(m => (
                <button key={m.value} className="ac-method-btn"
                  onClick={() => setForm(p => ({ ...p, reward_method: m.value }))}
                  style={form.reward_method === m.value
                    ? { background:`${m.color}12`, borderColor:`${m.color}40`, color:m.color, boxShadow:`0 0 12px ${m.color}20` }
                    : {}}
                >
                  <span className="ac-method-icon">{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>

            {/* Winner count */}
            <div className="ac-section-label">Number of Winners</div>
            <div className="ac-winner-row">
              <div className="ac-winner-label">WINNERS</div>
              <div className="ac-winner-controls">
                <button className="ac-counter-btn"
                  onClick={() => setForm(p => ({ ...p, winner_count: Math.max(1, p.winner_count - 1) }))}>
                  −
                </button>
                <div className="ac-winner-val">{form.winner_count}</div>
                <button className="ac-counter-btn"
                  onClick={() => setForm(p => ({ ...p, winner_count: Math.min(10, p.winner_count + 1) }))}>
                  +
                </button>
              </div>
            </div>

            {/* Reward amounts */}
            <div className="ac-section-label">Reward Amounts · {selectedMethod.label}</div>
            <div className="ac-rewards-grid">
              {Array.from({ length: form.winner_count }, (_, i) => (
                <div key={i} className="ac-reward-row">
                  <span className="ac-reward-medal">{WINNER_MEDALS[i]}</span>
                  <span className="ac-reward-place" style={{ color: MEDAL_COLORS[i] }}>
                    {['1ST','2ND','3RD','4TH','5TH','6TH','7TH','8TH','9TH','10TH'][i]}
                  </span>
                  <input className="ac-reward-input" type="number"
                    value={form.rewards[i]}
                    onChange={e => setReward(i, +e.target.value)}
                    style={{ borderColor:`${MEDAL_COLORS[i]}20` }}
                  />
                  <span className="ac-reward-unit" style={{ color: selectedMethod.color }}>
                    {selectedMethod.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Preview */}
            {form.title && (
              <div className="ac-preview">
                <div className="ac-preview-label">Preview</div>
                <div className="ac-preview-title">{form.banner_emoji} {form.title}</div>
                <div className="ac-preview-meta">
                  {selectedType.icon} {selectedType.label} · ⏱ {form.duration_hours}h ·
                  🏆 {form.winner_count} winners · {selectedMethod.icon} {selectedMethod.label}
                </div>
              </div>
            )}

            {/* Launch */}
            <button className="ac-launch-btn" onClick={handleCreate}
              disabled={!form.title.trim() || creating}>
              {creating
                ? <span style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'center' }}>
                    <span className="ac-btn-spinner" /> CREATING...
                  </span>
                : '🚀 LAUNCH CONTEST'}
            </button>
          </div>
        )}

        {/* ── CONTEST LIST ── */}
        {contests.length === 0 && !showForm && (
          <div className="ac-empty">✦ No contests yet ✦</div>
        )}

        {contests.map((c, idx) => {
          const tc = CONTEST_TYPES.find(t => t.value === c.contest_type) || CONTEST_TYPES[0];
          const mc = REWARD_METHODS.find(m => m.value === (c as any).reward_method) || REWARD_METHODS[0];
          const timeInfo   = getTimeRemaining(c.ends_at);
          const isLive     = c.is_active && !c.rewards_distributed;
          const canDistrib = c.is_active && !c.rewards_distributed && new Date(c.ends_at).getTime() <= Date.now();
          const isConfirmDel = confirmDelete === c.id;
          const isConfirmCan = confirmCancel === c.id;

          const startEst = new Date(c.ends_at).getTime() - ((c as any).duration_hours || 24) * 3600000;
          const pct = Math.min(100, Math.max(0, ((Date.now() - startEst) / (new Date(c.ends_at).getTime() - startEst)) * 100));

          const rewardChips = (['1st','2nd','3rd','4th','5th'] as const)
            .map((k, i) => ({ val: (c as any)[`reward_${k}`], i }))
            .filter(r => r.val > 0);

          const statusCfg = c.rewards_distributed
            ? { label:'PAID OUT', color:'#ffbe00', bg:'rgba(255,190,0,0.1)', border:'rgba(255,190,0,0.25)' }
            : isLive
            ? { label:'LIVE',     color:'#4ade80', bg:'rgba(74,222,128,0.1)', border:'rgba(74,222,128,0.3)' }
            : { label:'ENDED',    color:'#ef4444', bg:'rgba(239,68,68,0.1)',  border:'rgba(239,68,68,0.25)' };

          return (
            <div key={c.id} className="ac-card"
              style={{ border:`1px solid ${tc.color}20`, animationDelay:`${idx * 0.06}s` }}>
              <div className="ac-card-beam"
                style={{ background:`linear-gradient(90deg,transparent,${tc.color}35,transparent)` }} />

              <div className="ac-card-body">
                {/* Top */}
                <div className="ac-card-top">
                  <div className="ac-card-icon"
                    style={{ background:`${tc.color}12`, border:`1px solid ${tc.color}25` }}>
                    {(c as any).banner_emoji || tc.icon}
                  </div>
                  <div className="ac-card-info">
                    <div className="ac-card-title">{c.title}</div>
                    <div className="ac-card-meta">
                      <span>{tc.icon} {tc.label}</span>
                      <span>{mc.icon} {mc.label}</span>
                      <span>📅 {formatDate(c.ends_at)}</span>
                    </div>
                  </div>
                  <div className="ac-status-badge"
                    style={{ background:statusCfg.bg, border:`1px solid ${statusCfg.border}`, color:statusCfg.color }}>
                    {statusCfg.label}
                  </div>
                </div>

                {/* Progress */}
                <div className="ac-progress-wrap">
                  <div className="ac-progress-labels">
                    <span>{isLive ? timeInfo.text : 'Ended'}</span>
                    <span>{Math.round(pct)}% elapsed</span>
                  </div>
                  <div className="ac-progress-track">
                    <div className="ac-progress-fill" style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg,${tc.color}80,${tc.color})`,
                      boxShadow: isLive ? `0 0 6px ${tc.color}60` : 'none',
                    }} />
                  </div>
                </div>

                {/* Reward chips */}
                {rewardChips.length > 0 && (
                  <div className="ac-rewards-row">
                    {rewardChips.map(r => (
                      <div key={r.i} className="ac-reward-chip"
                        style={{ background:`${MEDAL_COLORS[r.i]}10`, border:`1px solid ${MEDAL_COLORS[r.i]}25` }}>
                        <span>{WINNER_MEDALS[r.i]}</span>
                        <span style={{ color: MEDAL_COLORS[r.i] }}>
                          {Number(r.val).toLocaleString()} {mc.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className="ac-card-actions">
                  {/* Distribute (only when ended but not paid) */}
                  {canDistrib && (
                    <button className="ac-distribute-btn" onClick={() => onEndContest(c.id)}>
                      🎁 DISTRIBUTE
                    </button>
                  )}

                  {/* Cancel live contest */}
                  {isLive && !canDistrib && (
                    <button
                      className="ac-cancel-btn"
                      onClick={() => handleCancel(c.id)}
                      style={isConfirmCan ? { background:'rgba(251,191,36,0.2)', borderColor:'rgba(251,191,36,0.5)' } : {}}
                    >
                      {isConfirmCan ? 'SURE? TAP AGAIN' : '⏹ CANCEL'}
                    </button>
                  )}

                  {/* Delete — always available */}
                  <button
                    className={`ac-delete-btn ${isConfirmDel ? 'confirm' : ''}`}
                    onClick={() => handleDelete(c.id)}
                  >
                    {isConfirmDel ? '⚠ DELETE?' : '🗑 DELETE'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

      </div>
    </>
  );
}
