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
   HAPTIC
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
   Simple Line Chart (SVG)
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
    <svg viewBox="0 0 100 100" className="w-full h-24">
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
    revenueLast7Days: [0, 0, 0, 0, 0, 0, 0],
    usersLast7Days: [0, 0, 0, 0, 0, 0, 0],
  });

  const [users, setUsers] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [settings, setSettingsState] = useState<Record<string, string>>({});
  const [editSettings, setEditSettings] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

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

  return (
    <div className="px-4 pb-28 text-white">

      {/* HEADER */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-red-500">Admin Dashboard</h2>
        <p className="text-xs text-gray-400">Advanced Analytics Panel</p>
      </div>

      {message && (
        <div className="mb-4 p-3 rounded-xl text-sm text-center font-semibold bg-green-500/10 text-green-400 border border-green-500/30 animate-pulse">
          {message}
        </div>
      )}

      {/* ===============================
         DASHBOARD WITH ANALYTICS
      ================================ */}
      {tab === 'dashboard' && (
        <div className="space-y-6">

          {/* Revenue Card */}
          <div
            className="rounded-3xl p-6"
            style={{
              background: 'linear-gradient(145deg,#0f172a,#1e293b)',
              border: '1px solid #facc1540',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            }}
          >
            <div className="text-xs text-gray-400 mb-2">Total Revenue</div>
            <div className="text-3xl font-bold text-yellow-400">
              <AnimatedNumber value={stats.totalRevenue || 0} /> pts
            </div>

            <LineChart
              data={stats.revenueLast7Days || [0, 0, 0, 0, 0, 0, 0]}
              color="#facc15"
            />
          </div>

          {/* User Growth Chart */}
          <div
            className="rounded-3xl p-6"
            style={{
              background: 'linear-gradient(145deg,#0f172a,#1e293b)',
              border: '1px solid #22d3ee40',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            }}
          >
            <div className="text-xs text-gray-400 mb-2">User Growth (7 days)</div>
            <LineChart
              data={stats.usersLast7Days || [0, 0, 0, 0, 0, 0, 0]}
              color="#22d3ee"
            />
          </div>

        </div>
      )}

      {/* ===============================
         WITHDRAWALS (NO REFUND ON REJECT)
      ================================ */}
      {tab === 'withdrawals' && (
        <AdminWithdrawalsTab
          withdrawals={withdrawals}
          onApprove={async id => {
            await adminUpdateWithdrawal(id, 'approved');
            showMsg('Withdrawal approved ✓');
            loadDashboard();
          }}
          onReject={async id => {
            // 🔴 IMPORTANT: no refund logic triggered here
            await adminUpdateWithdrawal(id, 'rejected', 'Rejected by admin');
            showMsg('Withdrawal rejected (no refund) ✗', 'error');
            loadDashboard();
          }}
        />
      )}

    </div>
  );
}