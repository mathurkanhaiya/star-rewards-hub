import React, { useEffect, useState, useRef } from 'react';
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

type AdminTab =
  | 'dashboard'
  | 'users'
  | 'withdrawals'
  | 'tasks'
  | 'contests'
  | 'broadcast'
  | 'settings';

/* ===============================
   TELEGRAM HAPTIC
================================ */
function triggerHaptic(type: 'impact' | 'success' | 'error' = 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;
    if (type === 'success') tg?.HapticFeedback?.notificationOccurred('success');
    else if (type === 'error') tg?.HapticFeedback?.notificationOccurred('error');
    else tg?.HapticFeedback?.impactOccurred('medium');
  }
}

/* ===============================
   Animated Counter
================================ */
function AnimatedNumber({ value }: { value: number }) {
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
      if (step >= steps) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(start));
      }
    }, 20);

    previous.current = value;
    return () => clearInterval(timer);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

/* ===============================
   Simple SVG Line Chart
================================ */
function LineChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - (v / max) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 100 100" className="w-full h-24 mt-4">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
    </svg>
  );
}

export default function AdminPanel() {
  const { telegramUser, refreshUser } = useApp();

  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [stats, setStats] = useState<any>({
    totalUsers: 0,
    totalWithdrawals: 0,
    pendingWithdrawals: 0,
    totalTransactions: 0,
    totalAdViews: 0,
    totalRevenue: 0,
    revenueLast7Days: [0,0,0,0,0,0,0],
    usersLast7Days: [0,0,0,0,0,0,0],
  });

  const [users, setUsers] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [settings, setSettingsState] = useState<Record<string, string>>({});
  const [editSettings, setEditSettings] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

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
    setUsers(u);
    setWithdrawals(w);
    setTasks(t);
    setSettingsState(settingsData);
    setEditSettings(settingsData);
    setContests(c);
  }

  function showMsg(text: string, type: 'success' | 'error' = 'success') {
    setMessage(text);
    triggerHaptic(type === 'success' ? 'success' : 'error');
    setTimeout(() => setMessage(''), 3000);
  }

  const tabItems = [
    { id: 'dashboard', label: 'Stats', icon: '📊' },
    { id: 'users', label: 'Users', icon: '👤' },
    { id: 'withdrawals', label: 'Withdraw', icon: '💰' },
    { id: 'tasks', label: 'Tasks', icon: '📋' },
    { id: 'contests', label: 'Contests', icon: '🏆' },
    { id: 'broadcast', label: 'Broadcast', icon: '📢' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="px-4 pb-28 text-white">

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-red-500">Admin Dashboard</h2>
        <p className="text-xs text-gray-400">Full Production Analytics</p>
      </div>

      {message && (
        <div className="mb-4 p-3 rounded-xl text-sm text-center font-semibold bg-green-500/10 text-green-400 border border-green-500/30 animate-pulse">
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {tabItems.map(t => (
          <button
            key={t.id}
            onClick={() => { triggerHaptic(); setTab(t.id as AdminTab); }}
            className="px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all active:scale-95"
            style={{
              background: tab === t.id ? 'linear-gradient(135deg,#ef4444,#dc2626)' : '#111827',
              color: tab === t.id ? 'white' : '#9ca3af',
              boxShadow: tab === t.id ? '0 10px 25px rgba(239,68,68,0.4)' : 'none',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* DASHBOARD */}
      {tab === 'dashboard' && (
        <div className="space-y-6">

          {/* Revenue Card */}
          <div className="rounded-3xl p-6 bg-gradient-to-br from-[#0f172a] to-[#1e293b] border border-yellow-500/30 shadow-2xl">
            <div className="text-xs text-gray-400">Total Revenue</div>
            <div className="text-3xl font-bold text-yellow-400 mt-2">
              <AnimatedNumber value={stats.totalRevenue || 0} /> pts
            </div>
            <LineChart data={stats.revenueLast7Days || [0,0,0,0,0,0,0]} color="#facc15" />
          </div>

          {/* User Growth */}
          <div className="rounded-3xl p-6 bg-gradient-to-br from-[#0f172a] to-[#1e293b] border border-cyan-400/30 shadow-2xl">
            <div className="text-xs text-gray-400">User Growth (7 days)</div>
            <LineChart data={stats.usersLast7Days || [0,0,0,0,0,0,0]} color="#22d3ee" />
          </div>

        </div>
      )}

      {/* USERS */}
      {tab === 'users' && (
        <AdminUsersTab
          users={users}
          onBan={async (id, banned) => {
            await adminBanUser(id, banned);
            showMsg(banned ? 'User banned' : 'User unbanned');
            loadDashboard();
          }}
          onAdjustBalance={async (id, pts, reason) => {
            const result = await adminAdjustBalance(id, pts, reason);
            result.success ? showMsg('Balance adjusted ✓') : showMsg('Failed', 'error');
            loadDashboard();
          }}
          message={message}
        />
      )}

      {/* WITHDRAWALS (NO REFUND ON REJECT) */}
      {tab === 'withdrawals' && (
        <AdminWithdrawalsTab
          withdrawals={withdrawals}
          onApprove={async id => {
            await adminUpdateWithdrawal(id, 'approved');
            showMsg('Withdrawal approved ✓');
            loadDashboard();
          }}
          onReject={async id => {
            await adminUpdateWithdrawal(id, 'rejected', 'Rejected by admin');
            showMsg('Rejected (no refund)', 'error');
            loadDashboard();
          }}
        />
      )}

      {/* TASKS */}
      {tab === 'tasks' && (
        <AdminTasksTab
          tasks={tasks}
          onToggle={async (id, active) => {
            await adminToggleTask(id, active);
            showMsg(active ? 'Task enabled' : 'Task disabled');
            loadDashboard();
          }}
          onDelete={async id => {
            await adminDeleteTask(id);
            showMsg('Task deleted');
            loadDashboard();
          }}
          onCreate={async task => {
            const result = await adminCreateTask(task);
            result.success ? showMsg('Task created ✓') : showMsg('Failed', 'error');
            loadDashboard();
          }}
        />
      )}

      {/* CONTESTS */}
      {tab === 'contests' && (
        <AdminContestsTab
          contests={contests}
          onCreateContest={async contest => {
            const result = await adminCreateContest(contest);
            result.success ? showMsg('Contest launched 🏆') : showMsg('Failed', 'error');
            loadDashboard();
          }}
          onEndContest={async id => {
            const result = await adminEndContest(id);
            result.success ? showMsg('Rewards distributed 🎁') : showMsg('Failed', 'error');
            loadDashboard();
          }}
        />
      )}

      {/* BROADCAST */}
      {tab === 'broadcast' && (
        <div className="space-y-4">
          <textarea
            value={broadcastText}
            onChange={e => setBroadcastText(e.target.value)}
            placeholder="Type broadcast..."
            rows={4}
            className="w-full p-4 rounded-2xl bg-[#111827] border border-purple-500/30 text-sm"
          />
          <button
            onClick={async () => {
              if (!broadcastText.trim() || !telegramUser) return;
              setBroadcasting(true);
              const result = await adminSendBroadcast(broadcastText, telegramUser.id);
              result.success ? showMsg('Broadcast sent 📢') : showMsg('Failed', 'error');
              setBroadcastText('');
              setBroadcasting(false);
            }}
            disabled={broadcasting}
            className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 active:scale-95"
          >
            {broadcasting ? 'Sending...' : 'Send Broadcast'}
          </button>
        </div>
      )}

      {/* SETTINGS */}
      {tab === 'settings' && (
        <AdminSettingsTab
          settings={settings}
          editSettings={editSettings}
          setEditSettings={setEditSettings}
          onSave={async key => {
            const result = await adminUpdateSetting(key, editSettings[key]);
            result.success ? showMsg('Setting saved ✓') : showMsg('Failed', 'error');
            refreshUser();
            loadDashboard();
          }}
          saving={null}
        />
      )}
    </div>
  );
}