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
  adminAdjustBalance,
  adminGetContests,
  adminCreateContest,
  adminEndContest,
  adminSendBroadcast,
  getTasks,
  getSettings,
} from '@/lib/api';
import { Task, Contest } from '@/types/telegram';
import AdminUsersTab from '@/components/admin/AdminUsersTab';
import AdminWithdrawalsTab from '@/components/admin/AdminWithdrawalsTab';
import AdminTasksTab from '@/components/admin/AdminTasksTab';
import AdminSettingsTab from '@/components/admin/AdminSettingsTab';
import AdminContestsTab from '@/components/admin/AdminContestsTab';

type AdminTab = 'dashboard' | 'users' | 'withdrawals' | 'tasks' | 'contests' | 'broadcast' | 'settings';

export default function AdminPanel() {
  const { telegramUser, refreshUser } = useApp();
  const [settings, setSettingsState] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [stats, setStats] = useState({ totalUsers: 0, totalWithdrawals: 0, pendingWithdrawals: 0, totalTransactions: 0, totalAdViews: 0 });
  const [users, setUsers] = useState<Array<{ id: string; telegram_id: number; first_name: string; username: string; level: number; total_points: number; is_banned: boolean; created_at: string; balances: Array<{ points: number }> }>>([]);
  const [withdrawals, setWithdrawals] = useState<Array<{ id: string; method: string; points_spent: number; amount: number; status: string; wallet_address: string | null; created_at: string; admin_note: string | null; users: { first_name: string; username: string; telegram_id: number; photo_url: string | null } | null }>>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [editSettings, setEditSettings] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    const [s, u, w, t, settingsData, c] = await Promise.all([
      adminGetStats(),
      adminGetUsers(),
      adminGetWithdrawals(),
      getTasks(),
      getSettings(),
      adminGetContests(),
    ]);
    setStats(s);
    setUsers(u as unknown as typeof users);
    setWithdrawals(w as unknown as typeof withdrawals);
    setTasks(t);
    setSettingsState(settingsData);
    setEditSettings(settingsData);
    setContests(c as Contest[]);
  }

  function showMsg(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(''), 3000);
  }

  async function handleSaveSetting(key: string) {
    setSaving(key);
    const result = await adminUpdateSetting(key, editSettings[key]);
    if (result.success) {
      setSettingsState(prev => ({ ...prev, [key]: editSettings[key] }));
      showMsg(`Setting "${key}" saved ✓`);
      refreshUser();
    } else {
      showMsg(`Failed to save "${key}"`);
    }
    setSaving(null);
  }

  async function handleCreateTask(task: Omit<Task, 'id'>) {
    const result = await adminCreateTask(task);
    if (result.success && result.data) {
      setTasks(prev => [...prev, result.data as Task]);
      showMsg('Task created ✓');
    } else {
      showMsg('Failed to create task');
    }
  }

  async function handleCreateContest(contest: Parameters<typeof adminCreateContest>[0]) {
    const result = await adminCreateContest(contest);
    if (result.success && result.data) {
      setContests(prev => [result.data as Contest, ...prev]);
      showMsg('Contest launched! 🏆');
    } else {
      showMsg('Failed to create contest');
    }
  }

  async function handleEndContest(id: string) {
    const result = await adminEndContest(id);
    if (result.success) {
      setContests(prev => prev.map(c => c.id === id ? { ...c, rewards_distributed: true, is_active: false } : c));
      showMsg(result.message || 'Rewards distributed! 🎁');
    } else {
      showMsg(result.message || 'Failed to distribute');
    }
  }

  async function handleBroadcast() {
    if (!broadcastText.trim() || !telegramUser) return;
    setBroadcasting(true);
    const result = await adminSendBroadcast(broadcastText.trim(), telegramUser.id);
    if (result.success) {
      showMsg('Broadcast sent to all users! 📢');
      setBroadcastText('');
    } else {
      showMsg('Failed to send broadcast');
    }
    setBroadcasting(false);
  }

  const tabItems: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Stats', icon: '📊' },
    { id: 'users', label: 'Users', icon: '👤' },
    { id: 'withdrawals', label: 'Withdraw', icon: '💰' },
    { id: 'tasks', label: 'Tasks', icon: '📋' },
    { id: 'contests', label: 'Contests', icon: '🏆' },
    { id: 'broadcast', label: 'Broadcast', icon: '📢' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="px-4 pb-28">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
          style={{ background: 'linear-gradient(135deg, hsl(0 80% 55% / 0.2), hsl(0 80% 55% / 0.05))', border: '1px solid hsl(0 80% 55% / 0.3)' }}>
          🛡️
        </div>
        <div>
          <h2 className="text-lg font-display font-bold" style={{ color: 'hsl(0 80% 60%)' }}>Admin Panel</h2>
          <p className="text-xs text-muted-foreground">Production Dashboard</p>
        </div>
      </div>

      {message && (
        <div className="mb-3 p-2.5 rounded-xl text-xs text-center font-medium animate-pulse"
          style={{ background: 'hsl(140 70% 50% / 0.1)', color: 'hsl(140 70% 50%)', border: '1px solid hsl(140 70% 50% / 0.3)' }}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-4 no-scrollbar">
        {tabItems.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1"
            style={{
              background: tab === t.id ? 'linear-gradient(135deg, hsl(0 80% 55%), hsl(0 70% 45%))' : 'hsl(220 25% 10%)',
              color: tab === t.id ? 'white' : 'hsl(220 15% 60%)',
              border: `1px solid ${tab === t.id ? 'transparent' : 'hsl(220 20% 15%)'}`,
              boxShadow: tab === t.id ? '0 0 15px hsl(0 80% 55% / 0.3)' : 'none',
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Dashboard */}
      {tab === 'dashboard' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total Users', value: stats.totalUsers, icon: '👥', color: 'hsl(190 100% 55%)' },
              { label: 'Withdrawals', value: stats.totalWithdrawals, icon: '💸', color: 'hsl(45 100% 55%)' },
              { label: 'Pending', value: stats.pendingWithdrawals, icon: '⏳', color: 'hsl(0 80% 55%)' },
              { label: 'Transactions', value: stats.totalTransactions, icon: '📊', color: 'hsl(140 70% 50%)' },
              { label: 'Ad Views', value: stats.totalAdViews, icon: '🎬', color: 'hsl(265 80% 65%)' },
              { label: 'Active Tasks', value: tasks.filter(t => t.is_active).length, icon: '📋', color: 'hsl(210 100% 60%)' },
            ].map(s => (
              <div key={s.label} className="stat-card p-4 rounded-xl relative overflow-hidden">
                <div className="absolute top-2 right-2 text-2xl opacity-20">{s.icon}</div>
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Users', tab: 'users' as AdminTab, icon: '👤', color: 'hsl(190 100% 55%)' },
              { label: 'Withdraw', tab: 'withdrawals' as AdminTab, icon: '💰', color: 'hsl(45 100% 55%)' },
              { label: 'Contests', tab: 'contests' as AdminTab, icon: '🏆', color: 'hsl(265 80% 65%)' },
            ].map(a => (
              <button key={a.label} onClick={() => setTab(a.tab)}
                className="p-3 rounded-xl text-center transition-all active:scale-95"
                style={{ background: `${a.color}10`, border: `1px solid ${a.color}25` }}>
                <div className="text-xl mb-1">{a.icon}</div>
                <div className="text-xs font-bold" style={{ color: a.color }}>{a.label}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'users' && (
        <AdminUsersTab
          users={users}
          onBan={async (userId, banned) => {
            await adminBanUser(userId, banned);
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_banned: banned } : u));
            showMsg(banned ? 'User banned' : 'User unbanned');
          }}
          onAdjustBalance={async (userId, points, reason) => {
            const result = await adminAdjustBalance(userId, points, reason);
            if (result.success) {
              showMsg(`Balance adjusted: ${points >= 0 ? '+' : ''}${points} pts`);
              loadDashboard();
            } else {
              showMsg('Failed to adjust balance');
            }
          }}
          message={message}
        />
      )}

      {tab === 'withdrawals' && (
        <AdminWithdrawalsTab
          withdrawals={withdrawals}
          onApprove={async (id) => {
            await adminUpdateWithdrawal(id, 'approved');
            setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: 'approved' } : w));
            showMsg('Withdrawal approved ✓');
          }}
          onReject={async (id) => {
            await adminUpdateWithdrawal(id, 'rejected', 'Rejected by admin');
            setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: 'rejected' } : w));
            showMsg('Withdrawal rejected ✗');
          }}
        />
      )}

      {tab === 'tasks' && (
        <AdminTasksTab
          tasks={tasks}
          onToggle={async (id, active) => {
            await adminToggleTask(id, active);
            setTasks(prev => prev.map(t => t.id === id ? { ...t, is_active: active } : t));
          }}
          onDelete={async (id) => {
            await adminDeleteTask(id);
            setTasks(prev => prev.filter(t => t.id !== id));
            showMsg('Task deleted ✓');
          }}
          onCreate={handleCreateTask}
        />
      )}

      {tab === 'contests' && (
        <AdminContestsTab
          contests={contests}
          onCreateContest={handleCreateContest}
          onEndContest={handleEndContest}
        />
      )}

      {tab === 'broadcast' && (
        <div className="space-y-3">
          <div className="p-3 rounded-xl text-xs" style={{ background: 'hsl(265 80% 65% / 0.08)', border: '1px solid hsl(265 80% 65% / 0.2)', color: 'hsl(265 80% 70%)' }}>
            📢 Send a notification to all users. This will appear in their notifications.
          </div>
          <textarea
            value={broadcastText}
            onChange={e => setBroadcastText(e.target.value)}
            placeholder="Type your broadcast message..."
            rows={4}
            className="w-full px-3 py-3 rounded-xl text-sm outline-none resize-none"
            style={{ background: 'hsl(220 25% 8%)', border: '1px solid hsl(220 20% 20%)', color: 'hsl(210 40% 95%)' }}
          />
          <button
            onClick={handleBroadcast}
            disabled={broadcasting || !broadcastText.trim()}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
            style={{
              background: broadcastText.trim() ? 'linear-gradient(135deg, hsl(265 80% 65%), hsl(265 70% 55%))' : 'hsl(220 25% 12%)',
              color: broadcastText.trim() ? 'white' : 'hsl(220 15% 50%)',
              opacity: broadcasting ? 0.5 : 1,
            }}>
            {broadcasting ? '⏳ Sending...' : '📢 Send Broadcast'}
          </button>
        </div>
      )}

      {tab === 'settings' && (
        <AdminSettingsTab
          settings={settings}
          editSettings={editSettings}
          setEditSettings={setEditSettings}
          onSave={handleSaveSetting}
          saving={saving}
        />
      )}
    </div>
  );
}
