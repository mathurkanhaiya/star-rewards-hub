import React, { useState, useMemo } from 'react';
import { Task } from '@/types/telegram';

const TASK_TYPES = [
  { value: 'social',   label: 'Telegram Channel Join', icon: '📢', color: '#22d3ee' },
  { value: 'video',    label: 'Adsgram Ad Task',        icon: '🎬', color: '#ffbe00' },
  { value: 'special',  label: 'Special Ad Task',        icon: '⚡', color: '#ef4444' },
  { value: 'daily',    label: 'Manual Reward Task',     icon: '🎁', color: '#4ade80' },
  { value: 'referral', label: 'Referral Task',          icon: '👥', color: '#a78bfa' },
];

const TYPE_MAP = Object.fromEntries(TASK_TYPES.map(t => [t.value, t]));

interface Props {
  tasks: Task[];
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  onCreate: (task: Omit<Task, 'id'>) => void;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;900&family=Rajdhani:wght@500;600;700&display=swap');

@keyframes atFadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
@keyframes atShine  { 0%{left:-100%} 40%,100%{left:150%} }

.at-root { font-family: 'Rajdhani', sans-serif; color: #fff; }

/* ── Stats row ── */
.at-stats {
  display: grid; grid-template-columns: repeat(3,1fr);
  gap: 8px; margin-bottom: 14px;
}
.at-stat {
  border-radius: 14px; padding: 12px 10px; text-align: center;
  position: relative; overflow: hidden;
}
.at-stat-val {
  font-family: 'Orbitron', monospace;
  font-size: 22px; font-weight: 900; line-height: 1; margin-bottom: 2px;
}
.at-stat-label {
  font-family: 'Orbitron', monospace; font-size: 8px;
  letter-spacing: 2px; color: rgba(255,255,255,0.25); text-transform: uppercase;
}

/* ── Create button ── */
.at-create-btn {
  width: 100%; padding: 14px; border-radius: 14px; border: none;
  font-family: 'Orbitron', monospace; font-size: 12px;
  font-weight: 700; letter-spacing: 2px; cursor: pointer;
  transition: transform 0.12s, box-shadow 0.2s;
  margin-bottom: 12px; display: flex; align-items: center;
  justify-content: center; gap: 8px;
  position: relative; overflow: hidden;
}
.at-create-btn::after {
  content: ''; position: absolute;
  top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  animation: atShine 3s ease-in-out infinite;
}
.at-create-btn:active { transform: scale(0.97); }
.at-create-btn.open {
  background: rgba(239,68,68,0.1) !important;
  border: 1px solid rgba(239,68,68,0.3) !important;
  color: #ef4444 !important;
  box-shadow: none !important;
}
.at-create-btn.open::after { display: none; }

/* ── Form panel ── */
.at-form {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,190,0,0.2);
  border-radius: 18px; padding: 18px;
  margin-bottom: 14px;
  animation: atFadeIn 0.25s ease;
  position: relative; overflow: hidden;
}
.at-form::before {
  content: ''; position: absolute;
  top: 0; left: 10%; right: 10%; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,190,0,0.4), transparent);
}
.at-form-title {
  font-family: 'Orbitron', monospace; font-size: 10px;
  letter-spacing: 3px; color: rgba(255,190,0,0.5);
  text-transform: uppercase; margin-bottom: 14px;
}

/* Form inputs */
.at-label {
  font-family: 'Orbitron', monospace; font-size: 8px;
  letter-spacing: 2px; color: rgba(255,255,255,0.25);
  text-transform: uppercase; margin-bottom: 5px; display: block;
}
.at-input {
  width: 100%; padding: 11px 14px; border-radius: 12px;
  background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08);
  color: #fff; font-family: 'Rajdhani', sans-serif; font-size: 14px;
  outline: none; transition: border-color 0.2s; margin-bottom: 10px;
  box-sizing: border-box;
}
.at-input:focus { border-color: rgba(255,190,0,0.4); }
.at-input::placeholder { color: rgba(255,255,255,0.2); }

.at-select {
  width: 100%; padding: 11px 14px; border-radius: 12px;
  background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08);
  color: #fff; font-family: 'Rajdhani', sans-serif; font-size: 14px;
  outline: none; cursor: pointer; margin-bottom: 10px;
  box-sizing: border-box;
}

.at-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

/* Checkbox row */
.at-checkbox-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; border-radius: 12px;
  background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 12px; cursor: pointer;
}
.at-checkbox {
  width: 18px; height: 18px; border-radius: 6px; flex-shrink: 0;
  background: rgba(255,190,0,0.1); border: 1px solid rgba(255,190,0,0.3);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: #ffbe00;
  transition: all 0.15s;
}
.at-checkbox-label {
  font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.7);
}
.at-checkbox-sub {
  font-size: 10px; color: rgba(255,255,255,0.2); letter-spacing: 0.5px;
}

/* Save btn */
.at-save-btn {
  width: 100%; padding: 14px; border-radius: 12px; border: none;
  background: linear-gradient(135deg, #4ade80, #16a34a);
  color: #001a0a; font-family: 'Orbitron', monospace;
  font-size: 12px; font-weight: 700; letter-spacing: 2px;
  cursor: pointer; transition: transform 0.12s, opacity 0.2s;
  box-shadow: 0 4px 20px rgba(74,222,128,0.3);
}
.at-save-btn:active { transform: scale(0.97); }
.at-save-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Filter strip ── */
.at-filters {
  display: flex; gap: 6px; overflow-x: auto;
  padding-bottom: 4px; margin-bottom: 12px; scrollbar-width: none;
}
.at-filters::-webkit-scrollbar { display: none; }
.at-filter-btn {
  flex-shrink: 0; padding: 6px 12px; border-radius: 20px; border: none;
  font-family: 'Orbitron', monospace; font-size: 8px; font-weight: 600;
  letter-spacing: 1.5px; text-transform: uppercase; cursor: pointer;
  transition: all 0.2s; white-space: nowrap;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.25);
}

/* ── Task card ── */
.at-card {
  background: rgba(255,255,255,0.02);
  border-radius: 16px; margin-bottom: 8px;
  overflow: hidden; position: relative;
  animation: atFadeIn 0.3s ease both;
  transition: border-color 0.2s;
}
.at-card-beam {
  position: absolute; top: 0; left: 10%; right: 10%;
  height: 1px; pointer-events: none;
}
.at-card-body {
  display: flex; align-items: center; gap: 12px; padding: 13px 14px;
  position: relative; z-index: 1;
}

/* Icon */
.at-task-icon {
  width: 44px; height: 44px; border-radius: 13px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 20px;
}

/* Text */
.at-task-body { flex: 1; min-width: 0; }
.at-task-type-tag {
  font-family: 'Orbitron', monospace; font-size: 7px; font-weight: 600;
  letter-spacing: 2px; text-transform: uppercase;
  padding: 2px 7px; border-radius: 6px; display: inline-block; margin-bottom: 3px;
}
.at-task-title {
  font-size: 14px; font-weight: 700; color: rgba(255,255,255,0.9);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.at-task-meta {
  font-size: 10px; color: rgba(255,255,255,0.25);
  letter-spacing: 0.5px; margin-top: 2px;
  display: flex; gap: 8px; flex-wrap: wrap;
}

/* Buttons */
.at-card-actions { display: flex; gap: 6px; flex-shrink: 0; }
.at-toggle-btn {
  padding: 6px 12px; border-radius: 10px; border: none;
  font-family: 'Orbitron', monospace; font-size: 8px; font-weight: 700;
  letter-spacing: 1px; cursor: pointer; transition: transform 0.12s;
}
.at-toggle-btn:active { transform: scale(0.93); }
.at-toggle-on  { background: rgba(74,222,128,0.12); border: 1px solid rgba(74,222,128,0.3); color: #4ade80; }
.at-toggle-off { background: rgba(239,68,68,0.1);   border: 1px solid rgba(239,68,68,0.25);  color: #ef4444; }

.at-delete-btn {
  width: 32px; height: 32px; border-radius: 10px; border: none;
  background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
  color: #ef4444; font-size: 14px; cursor: pointer; transition: transform 0.12s;
  display: flex; align-items: center; justify-content: center;
}
.at-delete-btn:active { transform: scale(0.93); }

/* Empty */
.at-empty {
  text-align: center; padding: 40px 0;
  font-family: 'Orbitron', monospace; font-size: 9px;
  letter-spacing: 3px; color: rgba(255,255,255,0.1); text-transform: uppercase;
}
`;

const DEFAULT_FORM = {
  title: '', description: '', task_type: 'social',
  reward_points: 100, reward_stars: 0,
  icon: '✨', link: '', is_repeatable: false, display_order: 0,
};

export default function AdminTasksTab({ tasks, onToggle, onDelete, onCreate }: Props) {
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ ...DEFAULT_FORM });
  const [filterType, setFilterType] = useState<string>('all');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const stats = useMemo(() => ({
    total:    tasks.length,
    active:   tasks.filter(t => t.is_active).length,
    inactive: tasks.filter(t => !t.is_active).length,
  }), [tasks]);

  const filtered = useMemo(() =>
    filterType === 'all' ? tasks : tasks.filter(t => t.task_type === filterType),
    [tasks, filterType]
  );

  function handleCreate() {
    if (!form.title.trim()) return;
    onCreate({
      title:         form.title,
      description:   form.description || null,
      task_type:     form.task_type,
      reward_points: form.reward_points,
      reward_stars:  form.reward_stars,
      icon:          form.icon || null,
      link:          form.link || null,
      is_repeatable: form.is_repeatable,
      is_active:     true,
      display_order: form.display_order,
    } as Omit<Task, 'id'>);
    setShowForm(false);
    setForm({ ...DEFAULT_FORM });
  }

  const selectedTypeConfig = TYPE_MAP[form.task_type];

  return (
    <>
      <style>{CSS}</style>
      <div className="at-root">

        {/* Stats */}
        <div className="at-stats">
          {[
            { label: 'Total',    val: stats.total,    color: '#ffbe00' },
            { label: 'Active',   val: stats.active,   color: '#4ade80' },
            { label: 'Inactive', val: stats.inactive, color: '#ef4444' },
          ].map(s => (
            <div key={s.label} className="at-stat" style={{
              background: `${s.color}08`,
              border: `1px solid ${s.color}20`,
            }}>
              <div className="at-stat-val" style={{ color: s.color }}>{s.val}</div>
              <div className="at-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Create button */}
        <button
          className={`at-create-btn ${showForm ? 'open' : ''}`}
          onClick={() => setShowForm(v => !v)}
          style={!showForm ? {
            background: 'linear-gradient(135deg, #ffbe00, #f59e0b)',
            color: '#1a0800',
            boxShadow: '0 4px 20px rgba(255,190,0,0.3)',
          } : {}}
        >
          {showForm ? '✕  CANCEL' : '＋  CREATE NEW TASK'}
        </button>

        {/* Create form */}
        {showForm && (
          <div className="at-form">
            <div className="at-form-title">New Task</div>

            <label className="at-label">Task Title *</label>
            <input
              className="at-input"
              placeholder="e.g. Join our Telegram channel"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            />

            <label className="at-label">Description</label>
            <input
              className="at-input"
              placeholder="Optional description"
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            />

            <label className="at-label">Task Type</label>
            <select
              className="at-select"
              value={form.task_type}
              onChange={e => setForm(p => ({ ...p, task_type: e.target.value }))}
            >
              {TASK_TYPES.map(tt => (
                <option key={tt.value} value={tt.value}>
                  {tt.icon} {tt.label}
                </option>
              ))}
            </select>

            <div className="at-grid2">
              <div>
                <label className="at-label">Reward Points</label>
                <input
                  className="at-input"
                  type="number"
                  value={form.reward_points}
                  onChange={e => setForm(p => ({ ...p, reward_points: +e.target.value }))}
                />
              </div>
              <div>
                <label className="at-label">Reward Stars</label>
                <input
                  className="at-input"
                  type="number"
                  value={form.reward_stars}
                  onChange={e => setForm(p => ({ ...p, reward_stars: +e.target.value }))}
                />
              </div>
            </div>

            <div className="at-grid2">
              <div>
                <label className="at-label">Icon Emoji</label>
                <input
                  className="at-input"
                  placeholder="✨"
                  value={form.icon}
                  onChange={e => setForm(p => ({ ...p, icon: e.target.value }))}
                />
              </div>
              <div>
                <label className="at-label">Display Order</label>
                <input
                  className="at-input"
                  type="number"
                  value={form.display_order}
                  onChange={e => setForm(p => ({ ...p, display_order: +e.target.value }))}
                />
              </div>
            </div>

            <label className="at-label">Link (optional)</label>
            <input
              className="at-input"
              placeholder="https://t.me/yourchannel"
              value={form.link}
              onChange={e => setForm(p => ({ ...p, link: e.target.value }))}
            />

            {/* Repeatable toggle */}
            <div
              className="at-checkbox-row"
              onClick={() => setForm(p => ({ ...p, is_repeatable: !p.is_repeatable }))}
            >
              <div className="at-checkbox">
                {form.is_repeatable ? '✓' : ''}
              </div>
              <div>
                <div className="at-checkbox-label">Repeatable Task</div>
                <div className="at-checkbox-sub">Users can complete this task multiple times</div>
              </div>
            </div>

            {/* Preview */}
            {form.title && (
              <div style={{
                background: selectedTypeConfig ? `${selectedTypeConfig.color}08` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${selectedTypeConfig?.color || '#fff'}20`,
                borderRadius: '12px', padding: '10px 14px', marginBottom: '12px',
              }}>
                <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 8, letterSpacing: '2px', color: 'rgba(255,255,255,0.2)', marginBottom: 6 }}>
                  PREVIEW
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 20 }}>{form.icon || '✨'}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{form.title}</div>
                    <div style={{ fontSize: 10, color: selectedTypeConfig?.color || '#ffbe00', fontFamily: "'Orbitron', monospace", letterSpacing: '1px', marginTop: 2 }}>
                      ✦ +{form.reward_points} PTS
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              className="at-save-btn"
              onClick={handleCreate}
              disabled={!form.title.trim()}
            >
              ✓ SAVE TASK
            </button>
          </div>
        )}

        {/* Filter strip */}
        <div className="at-filters">
          <button
            className="at-filter-btn"
            onClick={() => setFilterType('all')}
            style={filterType === 'all' ? {
              background: 'rgba(255,190,0,0.1)', borderColor: 'rgba(255,190,0,0.3)', color: '#ffbe00',
            } : {}}
          >
            ALL ({tasks.length})
          </button>
          {TASK_TYPES.map(tt => {
            const count = tasks.filter(t => t.task_type === tt.value).length;
            if (count === 0) return null;
            const isActive = filterType === tt.value;
            return (
              <button
                key={tt.value}
                className="at-filter-btn"
                onClick={() => setFilterType(tt.value)}
                style={isActive ? {
                  background: `${tt.color}12`,
                  borderColor: `${tt.color}35`,
                  color: tt.color,
                } : {}}
              >
                {tt.icon} {tt.value.toUpperCase()} ({count})
              </button>
            );
          })}
        </div>

        {/* Empty */}
        {filtered.length === 0 && (
          <div className="at-empty">✦ No tasks found ✦</div>
        )}

        {/* Task list */}
        {filtered.map((t, idx) => {
          const tc = TYPE_MAP[t.task_type] || { color: '#ffbe00', icon: '✨', label: t.task_type };
          const isConfirming = confirmDelete === t.id;

          return (
            <div
              key={t.id}
              className="at-card"
              style={{
                border: `1px solid ${tc.color}${t.is_active ? '20' : '10'}`,
                opacity: t.is_active ? 1 : 0.6,
                animationDelay: `${idx * 0.04}s`,
              }}
            >
              <div
                className="at-card-beam"
                style={{ background: `linear-gradient(90deg, transparent, ${tc.color}${t.is_active ? '35' : '15'}, transparent)` }}
              />
              <div className="at-card-body">
                {/* Icon */}
                <div
                  className="at-task-icon"
                  style={{ background: `${tc.color}10`, border: `1px solid ${tc.color}25` }}
                >
                  {t.icon || tc.icon}
                </div>

                {/* Body */}
                <div className="at-task-body">
                  <div
                    className="at-task-type-tag"
                    style={{ background: `${tc.color}10`, border: `1px solid ${tc.color}20`, color: tc.color }}
                  >
                    {tc.value || t.task_type}
                  </div>
                  <div className="at-task-title">{t.title}</div>
                  <div className="at-task-meta">
                    <span style={{ color: '#ffbe00' }}>✦ +{t.reward_points} pts</span>
                    {t.reward_stars > 0 && <span>⭐ {t.reward_stars}</span>}
                    {t.is_repeatable && <span style={{ color: '#22d3ee' }}>↺ repeat</span>}
                    {t.link && <span>🔗 linked</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="at-card-actions">
                  <button
                    className={`at-toggle-btn ${t.is_active ? 'at-toggle-on' : 'at-toggle-off'}`}
                    onClick={() => onToggle(t.id, !t.is_active)}
                  >
                    {t.is_active ? 'ON' : 'OFF'}
                  </button>

                  {isConfirming ? (
                    <button
                      className="at-delete-btn"
                      style={{ background: 'rgba(239,68,68,0.2)', borderColor: 'rgba(239,68,68,0.5)', fontSize: 10, fontFamily: "'Orbitron', monospace", fontWeight: 700, letterSpacing: '1px', width: 'auto', padding: '0 8px', color: '#ef4444' }}
                      onClick={() => { onDelete(t.id); setConfirmDelete(null); }}
                    >
                      SURE?
                    </button>
                  ) : (
                    <button
                      className="at-delete-btn"
                      onClick={() => { setConfirmDelete(t.id); setTimeout(() => setConfirmDelete(null), 3000); }}
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

      </div>
    </>
  );
}
