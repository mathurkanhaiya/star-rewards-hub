import React, { useState } from 'react';
import { Task } from '@/types/telegram';

const TASK_TYPES = [
  { value: 'social', label: '📢 Telegram Channel Join' },
  { value: 'video', label: '🎬 Adsgram Ad Task' },
  { value: 'special', label: '⚡ Special Ad Task' },
  { value: 'daily', label: '🎁 Manual Reward Task' },
  { value: 'referral', label: '👥 Referral Task' },
];

interface Props {
  tasks: Task[];
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  onCreate: (task: Omit<Task, 'id'>) => void;
}

export default function AdminTasksTab({ tasks, onToggle, onDelete, onCreate }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', task_type: 'social', reward_points: 100, reward_stars: 0,
    icon: '✨', link: '', is_repeatable: false, display_order: 0,
  });

  const inputStyle = { background: 'hsl(220 25% 5%)', border: '1px solid hsl(220 20% 20%)', color: 'hsl(210 40% 95%)' };

  function handleCreate() {
    onCreate({
      title: form.title,
      description: form.description || null,
      task_type: form.task_type,
      reward_points: form.reward_points,
      reward_stars: form.reward_stars,
      icon: form.icon || null,
      link: form.link || null,
      is_repeatable: form.is_repeatable,
      is_active: true,
      display_order: form.display_order,
    } as Omit<Task, 'id'>);
    setShowForm(false);
    setForm({ title: '', description: '', task_type: 'social', reward_points: 100, reward_stars: 0, icon: '✨', link: '', is_repeatable: false, display_order: 0 });
  }

  return (
    <div className="space-y-3">
      <button onClick={() => setShowForm(!showForm)}
        className="w-full py-2.5 rounded-xl text-sm font-bold"
        style={{ background: 'hsl(45 100% 55% / 0.15)', color: 'hsl(45 100% 60%)', border: '1px solid hsl(45 100% 55% / 0.3)' }}>
        {showForm ? '✕ Cancel' : '＋ Create New Task'}
      </button>

      {showForm && (
        <div className="p-4 rounded-xl space-y-3 glass-card" style={{ border: '1px solid hsl(45 100% 55% / 0.3)' }}>
          <input placeholder="Task title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
          <input placeholder="Description (optional)" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
          <select value={form.task_type} onChange={e => setForm(p => ({ ...p, task_type: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
            {TASK_TYPES.map(tt => <option key={tt.value} value={tt.value}>{tt.label}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Points</label>
              <input type="number" value={form.reward_points} onChange={e => setForm(p => ({ ...p, reward_points: +e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Stars</label>
              <input type="number" value={form.reward_stars} onChange={e => setForm(p => ({ ...p, reward_stars: +e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Icon emoji" value={form.icon} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            <input placeholder="Link (optional)" value={form.link} onChange={e => setForm(p => ({ ...p, link: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={form.is_repeatable} onChange={e => setForm(p => ({ ...p, is_repeatable: e.target.checked }))} />
            Repeatable task
          </label>
          <button onClick={handleCreate} disabled={!form.title}
            className="w-full py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'hsl(140 70% 50%)', color: 'white', opacity: form.title ? 1 : 0.5 }}>
            ✓ Save Task
          </button>
        </div>
      )}

      {tasks.map(t => (
        <div key={t.id} className="p-3 rounded-xl flex items-center justify-between glass-card" style={{ border: '1px solid hsl(220 20% 15%)' }}>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground">{t.icon} {t.title}</div>
            <div className="text-xs text-muted-foreground">+{t.reward_points} pts {t.reward_stars > 0 && `+${t.reward_stars}⭐`} • {t.task_type}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => onToggle(t.id, !t.is_active)}
              className="px-2 py-1 rounded-lg text-xs font-bold"
              style={{
                background: t.is_active ? 'hsl(140 70% 50% / 0.15)' : 'hsl(0 80% 55% / 0.15)',
                color: t.is_active ? 'hsl(140 70% 55%)' : 'hsl(0 80% 60%)',
              }}>
              {t.is_active ? 'On' : 'Off'}
            </button>
            <button onClick={() => onDelete(t.id)}
              className="px-2 py-1 rounded-lg text-xs font-bold"
              style={{ background: 'hsl(0 80% 55% / 0.15)', color: 'hsl(0 80% 60%)' }}>
              🗑
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
