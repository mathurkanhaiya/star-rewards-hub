import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import {
  adminGetStats,
  adminGetUsers,
  adminGetWithdrawals,
  adminUpdateWithdrawal,
  adminUpdateSetting,
  adminBanUser,
  adminToggleTask,
  adminCreateTask,
  adminDeleteTask,
  getTasks,
  getSettings,
} from '@/lib/api';
import { Task } from '@/types/telegram';

type AdminTab = 'dashboard' | 'users' | 'withdrawals' | 'tasks' | 'settings';

const TASK_TYPES = [
  { value: 'social', label: 'Telegram Channel Join' },
  { value: 'video', label: 'Adsgram Ad Task' },
  { value: 'special', label: 'Special Ad Task' },
  { value: 'daily', label: 'Manual Reward Task' },
  { value: 'referral', label: 'Referral Task' },
];

export default function AdminPanel() {
  const { telegramUser, refreshUser } = useApp();
  const [settings, setSettingsState] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [stats, setStats] = useState({ totalUsers: 0, totalWithdrawals: 0, pendingWithdrawals: 0, totalTransactions: 0 });
  const [users, setUsers] = useState<Array<{ id: string; telegram_id: number; first_name: string; username: string; level: number; total_points: number; is_banned: boolean; created_at: string; balances: Array<{ points: number }> }>>([]);
  const [withdrawals, setWithdrawals] = useState<Array<{ id: string; method: string; points_spent: number; amount: number; status: string; created_at: string; admin_note: string | null; users: { first_name: string; username: string; telegram_id: number } | null }>>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [editSettings, setEditSettings] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  // New task form
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '', description: '', task_type: 'social', reward_points: 100, reward_stars: 0,
    icon: '✨', link: '', is_repeatable: false, display_order: 0,
  });

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    const [s, u, w, t, settingsData] = await Promise.all([
      adminGetStats(),
      adminGetUsers(),
      adminGetWithdrawals(),
      getTasks(),
      getSettings(),
    ]);
    setStats(s);
    setUsers(u as unknown as typeof users);
    setWithdrawals(w as unknown as typeof withdrawals);
    setTasks(t);
    setSettingsState(settingsData);
    setEditSettings(settingsData);
  }

  function showMsg(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(''), 3000);
  }

  async function handleApproveWithdrawal(id: string) {
    await adminUpdateWithdrawal(id, 'approved');
    setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: 'approved' } : w));
    showMsg('Withdrawal approved ✓');
  }

  async function handleRejectWithdrawal(id: string) {
    await adminUpdateWithdrawal(id, 'rejected', 'Rejected by admin');
    setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: 'rejected' } : w));
    showMsg('Withdrawal rejected ✗');
  }

  async function handleBanUser(userId: string, banned: boolean) {
    await adminBanUser(userId, banned);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_banned: banned } : u));
    showMsg(banned ? 'User banned' : 'User unbanned');
  }

  async function handleSaveSetting(key: string) {
    setSaving(key);
    const result = await adminUpdateSetting(key, editSettings[key]);
    if (result.success) {
      setSettingsState(prev => ({ ...prev, [key]: editSettings[key] }));
      showMsg(`Setting "${key}" saved to database ✓`);
      // Refresh global app context so changes propagate
      refreshUser();
    } else {
      showMsg(`Failed to save "${key}" — check logs`);
    }
    setSaving(null);
  }

  async function handleCreateTask() {
    const result = await adminCreateTask({
      title: newTask.title,
      description: newTask.description || null,
      task_type: newTask.task_type,
      reward_points: newTask.reward_points,
      reward_stars: newTask.reward_stars,
      icon: newTask.icon || null,
      link: newTask.link || null,
      is_repeatable: newTask.is_repeatable,
      is_active: true,
      display_order: newTask.display_order,
      repeat_hours: null,
      max_completions: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Omit<Task, 'id'>);
    if (result.success && result.data) {
      setTasks(prev => [...prev, result.data as Task]);
      setShowNewTask(false);
      setNewTask({ title: '', description: '', task_type: 'social', reward_points: 100, reward_stars: 0, icon: '✨', link: '', is_repeatable: false, display_order: 0 });
      showMsg('Task created ✓');
    } else {
      showMsg('Failed to create task');
    }
  }

  async function handleDeleteTask(taskId: string) {
    const result = await adminDeleteTask(taskId);
    if (result.success) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      showMsg('Task deleted ✓');
    } else {
      showMsg('Failed to delete task');
    }
  }

  const tabItems: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Stats', icon: '📊' },
    { id: 'users', label: 'Users', icon: '👤' },
    { id: 'withdrawals', label: 'Withdraw', icon: '💰' },
    { id: 'tasks', label: 'Tasks', icon: '📋' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="px-4 pb-28">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xl">🛡️</span>
        <div>
          <h2 className="text-lg font-display font-bold" style={{ color: 'hsl(0 80% 60%)' }}>Admin Panel</h2>
          <p className="text-xs text-muted-foreground">ID: {telegramUser?.id}</p>
        </div>
      </div>

      {message && (
        <div className="mb-3 p-2 rounded-lg text-xs text-center font-medium"
          style={{ background: 'hsl(140 70% 50% / 0.1)', color: 'hsl(140 70% 50%)', border: '1px solid hsl(140 70% 50% / 0.3)' }}>
          {message}
        </div>
      )}

      {/* Admin tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-4 no-scrollbar">
        {tabItems.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1"
            style={{
              background: tab === t.id ? 'hsl(0 80% 55%)' : 'hsl(220 25% 10%)',
              color: tab === t.id ? 'white' : 'hsl(220 15% 60%)',
              border: `1px solid ${tab === t.id ? 'transparent' : 'hsl(220 20% 15%)'}`,
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Dashboard */}
      {tab === 'dashboard' && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Users', value: stats.totalUsers, icon: '👥', color: 'hsl(190 100% 55%)' },
            { label: 'Withdrawals', value: stats.totalWithdrawals, icon: '💸', color: 'hsl(45 100% 55%)' },
            { label: 'Pending', value: stats.pendingWithdrawals, icon: '⏳', color: 'hsl(0 80% 55%)' },
            { label: 'Transactions', value: stats.totalTransactions, icon: '📊', color: 'hsl(140 70% 50%)' },
          ].map(s => (
            <div key={s.label} className="stat-card p-4 rounded-xl">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-xl font-bold" style={{ color: s.color }}>{s.value.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="p-3 rounded-xl" style={{ background: 'hsl(220 25% 8%)', border: '1px solid hsl(220 20% 15%)' }}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <div className="text-sm font-medium text-foreground">{u.first_name || 'Anonymous'} {u.username && `@${u.username}`}</div>
                  <div className="text-xs text-muted-foreground">ID: {u.telegram_id} • Lv{u.level} • {u.total_points.toLocaleString()} pts</div>
                </div>
                <button
                  onClick={() => handleBanUser(u.id, !u.is_banned)}
                  className="px-2 py-1 rounded-lg text-xs font-bold"
                  style={{
                    background: u.is_banned ? 'hsl(140 70% 50% / 0.15)' : 'hsl(0 80% 55% / 0.15)',
                    color: u.is_banned ? 'hsl(140 70% 55%)' : 'hsl(0 80% 60%)',
                  }}
                >
                  {u.is_banned ? 'Unban' : 'Ban'}
                </button>
              </div>
              <div className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}

      {/* Withdrawals */}
      {tab === 'withdrawals' && (
        <div className="space-y-2">
          {withdrawals.map(w => (
            <div key={w.id} className="p-3 rounded-xl" style={{ background: 'hsl(220 25% 8%)', border: '1px solid hsl(220 20% 15%)' }}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {w.users?.first_name || 'User'} • {w.method.toUpperCase()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {w.points_spent.toLocaleString()} pts → {Number(w.amount).toFixed(2)} {w.method.toUpperCase()}
                  </div>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded font-bold capitalize"
                  style={{
                    background: w.status === 'pending' ? 'hsl(45 100% 55% / 0.15)' : w.status === 'approved' ? 'hsl(140 70% 50% / 0.15)' : 'hsl(0 80% 55% / 0.15)',
                    color: w.status === 'pending' ? 'hsl(45 100% 60%)' : w.status === 'approved' ? 'hsl(140 70% 55%)' : 'hsl(0 80% 60%)',
                  }}
                >
                  {w.status}
                </span>
              </div>
              {w.status === 'pending' && (
                <div className="flex gap-2 mt-2">
                  <button onClick={() => handleApproveWithdrawal(w.id)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold"
                    style={{ background: 'hsl(140 70% 50% / 0.15)', color: 'hsl(140 70% 55%)' }}>
                    ✓ Approve
                  </button>
                  <button onClick={() => handleRejectWithdrawal(w.id)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold"
                    style={{ background: 'hsl(0 80% 55% / 0.15)', color: 'hsl(0 80% 60%)' }}>
                    ✗ Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tasks */}
      {tab === 'tasks' && (
        <div className="space-y-2">
          <button
            onClick={() => setShowNewTask(!showNewTask)}
            className="w-full py-2 rounded-xl text-sm font-bold mb-2"
            style={{ background: 'hsl(45 100% 55% / 0.15)', color: 'hsl(45 100% 60%)', border: '1px solid hsl(45 100% 55% / 0.3)' }}
          >
            {showNewTask ? '✕ Cancel' : '＋ Create New Task'}
          </button>

          {showNewTask && (
            <div className="p-4 rounded-xl space-y-3 mb-3" style={{ background: 'hsl(220 25% 8%)', border: '1px solid hsl(45 100% 55% / 0.3)' }}>
              <input placeholder="Task title" value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'hsl(220 25% 5%)', border: '1px solid hsl(220 20% 20%)', color: 'hsl(210 40% 95%)' }} />
              <input placeholder="Description (optional)" value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'hsl(220 25% 5%)', border: '1px solid hsl(220 20% 20%)', color: 'hsl(210 40% 95%)' }} />
              <select value={newTask.task_type} onChange={e => setNewTask(p => ({ ...p, task_type: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'hsl(220 25% 5%)', border: '1px solid hsl(220 20% 20%)', color: 'hsl(210 40% 95%)' }}>
                {TASK_TYPES.map(tt => <option key={tt.value} value={tt.value}>{tt.label}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Reward Points</label>
                  <input type="number" value={newTask.reward_points} onChange={e => setNewTask(p => ({ ...p, reward_points: +e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'hsl(220 25% 5%)', border: '1px solid hsl(220 20% 20%)', color: 'hsl(210 40% 95%)' }} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Reward Stars</label>
                  <input type="number" value={newTask.reward_stars} onChange={e => setNewTask(p => ({ ...p, reward_stars: +e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'hsl(220 25% 5%)', border: '1px solid hsl(220 20% 20%)', color: 'hsl(210 40% 95%)' }} />
                </div>
              </div>
              <input placeholder="Icon emoji (e.g. 📢)" value={newTask.icon} onChange={e => setNewTask(p => ({ ...p, icon: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'hsl(220 25% 5%)', border: '1px solid hsl(220 20% 20%)', color: 'hsl(210 40% 95%)' }} />
              <input placeholder="Link (e.g. https://t.me/channel)" value={newTask.link} onChange={e => setNewTask(p => ({ ...p, link: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'hsl(220 25% 5%)', border: '1px solid hsl(220 20% 20%)', color: 'hsl(210 40% 95%)' }} />
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={newTask.is_repeatable} onChange={e => setNewTask(p => ({ ...p, is_repeatable: e.target.checked }))} />
                Repeatable task
              </label>
              <button onClick={handleCreateTask} disabled={!newTask.title}
                className="w-full py-2 rounded-xl text-sm font-bold"
                style={{ background: 'hsl(140 70% 50%)', color: 'white', opacity: newTask.title ? 1 : 0.5 }}>
                ✓ Save Task
              </button>
            </div>
          )}

          {tasks.map(t => (
            <div key={t.id} className="p-3 rounded-xl flex items-center justify-between" style={{ background: 'hsl(220 25% 8%)', border: '1px solid hsl(220 20% 15%)' }}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">{t.icon} {t.title}</div>
                <div className="text-xs text-muted-foreground">+{t.reward_points} pts • {t.task_type}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => adminToggleTask(t.id, !t.is_active).then(() => setTasks(prev => prev.map(task => task.id === t.id ? { ...task, is_active: !t.is_active } : task)))}
                  className="px-2 py-1 rounded-lg text-xs font-bold"
                  style={{
                    background: t.is_active ? 'hsl(140 70% 50% / 0.15)' : 'hsl(0 80% 55% / 0.15)',
                    color: t.is_active ? 'hsl(140 70% 55%)' : 'hsl(0 80% 60%)',
                  }}
                >
                  {t.is_active ? 'On' : 'Off'}
                </button>
                <button
                  onClick={() => handleDeleteTask(t.id)}
                  className="px-2 py-1 rounded-lg text-xs font-bold"
                  style={{ background: 'hsl(0 80% 55% / 0.15)', color: 'hsl(0 80% 60%)' }}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Settings */}
      {tab === 'settings' && (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground mb-2">
            ⚠️ Changes save directly to the database. They persist across refreshes.
          </div>
          {Object.entries(editSettings).map(([key, value]) => (
            <div key={key} className="p-3 rounded-xl" style={{ background: 'hsl(220 25% 8%)', border: '1px solid hsl(220 20% 15%)' }}>
              <div className="text-xs text-muted-foreground mb-1">{key.replace(/_/g, ' ')}</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editSettings[key] || ''}
                  onChange={e => setEditSettings(prev => ({ ...prev, [key]: e.target.value }))}
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'hsl(220 25% 5%)', border: '1px solid hsl(220 20% 20%)', color: 'hsl(210 40% 95%)' }}
                />
                <button
                  onClick={() => handleSaveSetting(key)}
                  disabled={saving === key}
                  className="px-3 py-2 rounded-lg text-xs font-bold"
                  style={{ background: 'hsl(45 100% 55% / 0.2)', color: 'hsl(45 100% 60%)', opacity: saving === key ? 0.5 : 1 }}
                >
                  {saving === key ? '...' : 'Save'}
                </button>
              </div>
              {settings[key] !== editSettings[key] && (
                <div className="text-xs mt-1" style={{ color: 'hsl(45 100% 60%)' }}>
                  ⚠ Unsaved — current DB value: "{settings[key]}"
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
