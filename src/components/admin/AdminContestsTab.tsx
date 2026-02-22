import React, { useState } from 'react';
import { Contest } from '@/types/telegram';

interface Props {
  contests: Contest[];
  onCreateContest: (contest: {
    title: string;
    contest_type: string;
    ends_at: string;
    reward_1st: number;
    reward_2nd: number;
    reward_3rd: number;
    reward_4th: number;
    reward_5th: number;
  }) => void;
  onEndContest: (id: string) => void;
}

export default function AdminContestsTab({ contests, onCreateContest, onEndContest }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    contest_type: 'ads_watch',
    duration_hours: 24,
    reward_1st: 5000,
    reward_2nd: 3000,
    reward_3rd: 2000,
    reward_4th: 1000,
    reward_5th: 500,
  });

  function handleCreate() {
    const endsAt = new Date(Date.now() + form.duration_hours * 60 * 60 * 1000).toISOString();
    onCreateContest({
      title: form.title,
      contest_type: form.contest_type,
      ends_at: endsAt,
      reward_1st: form.reward_1st,
      reward_2nd: form.reward_2nd,
      reward_3rd: form.reward_3rd,
      reward_4th: form.reward_4th,
      reward_5th: form.reward_5th,
    });
    setShowForm(false);
    setForm({ title: '', contest_type: 'ads_watch', duration_hours: 24, reward_1st: 5000, reward_2nd: 3000, reward_3rd: 2000, reward_4th: 1000, reward_5th: 500 });
  }

  function getTimeRemaining(endsAt: string) {
    const diff = new Date(endsAt).getTime() - Date.now();
    if (diff <= 0) return 'Ended';
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff / (1000 * 60)) % 60);
    return `${h}h ${m}m left`;
  }

  const inputStyle = { background: 'hsl(220 25% 5%)', border: '1px solid hsl(220 20% 20%)', color: 'hsl(210 40% 95%)' };

  return (
    <div className="space-y-3">
      <button onClick={() => setShowForm(!showForm)}
        className="w-full py-2.5 rounded-xl text-sm font-bold"
        style={{ background: 'hsl(265 80% 65% / 0.15)', color: 'hsl(265 80% 70%)', border: '1px solid hsl(265 80% 65% / 0.3)' }}>
        {showForm ? '✕ Cancel' : '🏆 Create New Contest'}
      </button>

      {showForm && (
        <div className="p-4 rounded-xl space-y-3 glass-card" style={{ border: '1px solid hsl(265 80% 65% / 0.3)' }}>
          <input placeholder="Contest Title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
          <select value={form.contest_type} onChange={e => setForm(p => ({ ...p, contest_type: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
            <option value="ads_watch">📺 Ads Watch Contest</option>
            <option value="referral">👥 Referral Contest</option>
          </select>
          <div>
            <label className="text-xs text-muted-foreground">Duration (hours)</label>
            <input type="number" value={form.duration_hours} onChange={e => setForm(p => ({ ...p, duration_hours: +e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
          </div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rewards (points)</div>
          <div className="grid grid-cols-5 gap-1.5">
            {['1st', '2nd', '3rd', '4th', '5th'].map((label, i) => (
              <div key={label}>
                <label className="text-xs text-muted-foreground">{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</label>
                <input type="number" value={[form.reward_1st, form.reward_2nd, form.reward_3rd, form.reward_4th, form.reward_5th][i]}
                  onChange={e => {
                    const key = `reward_${label.replace(/[^a-z0-9]/gi, '')}` as keyof typeof form;
                    setForm(p => ({ ...p, [key]: +e.target.value }));
                  }}
                  className="w-full px-2 py-1.5 rounded-lg text-xs outline-none text-center" style={inputStyle} />
              </div>
            ))}
          </div>
          <button onClick={handleCreate} disabled={!form.title}
            className="w-full py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'hsl(265 80% 65%)', color: 'white', opacity: form.title ? 1 : 0.5 }}>
            🏆 Launch Contest
          </button>
        </div>
      )}

      {contests.map(c => (
        <div key={c.id} className="p-3 rounded-xl glass-card" style={{ border: '1px solid hsl(220 20% 15%)' }}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-medium text-foreground">{c.contest_type === 'ads_watch' ? '📺' : '👥'} {c.title}</div>
              <div className="text-xs text-muted-foreground">
                {c.is_active && !c.rewards_distributed ? (
                  <span style={{ color: 'hsl(140 70% 55%)' }}>{getTimeRemaining(c.ends_at)}</span>
                ) : c.rewards_distributed ? (
                  <span style={{ color: 'hsl(45 100% 55%)' }}>✓ Rewards distributed</span>
                ) : (
                  <span style={{ color: 'hsl(0 80% 60%)' }}>Ended</span>
                )}
              </div>
            </div>
            {c.is_active && !c.rewards_distributed && new Date(c.ends_at).getTime() <= Date.now() && (
              <button onClick={() => onEndContest(c.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: 'hsl(45 100% 55% / 0.2)', color: 'hsl(45 100% 60%)' }}>
                🎁 Distribute
              </button>
            )}
          </div>
          <div className="flex gap-1 text-xs">
            {[c.reward_1st, c.reward_2nd, c.reward_3rd, c.reward_4th, c.reward_5th].map((r, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded" style={{ background: 'hsl(220 25% 12%)', color: 'hsl(45 100% 60%)' }}>
                {['🥇','🥈','🥉','4','5'][i]}{r.toLocaleString()}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
