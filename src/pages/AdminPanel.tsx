import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import {
  adminGetStats, adminGetUsers, adminGetWithdrawals,
  adminUpdateWithdrawal, adminUpdateSetting, adminBanUser,
  adminToggleTask, adminCreateTask, adminDeleteTask,
  adminAdjustBalance, adminGetContests, adminCreateContest,
  adminEndContest, adminSendBroadcast, getTasks, getSettings,
} from '@/lib/api';
import { Task, Contest } from '@/types/telegram';
import AdminUsersTab       from '@/components/admin/AdminUsersTab';
import AdminWithdrawalsTab from '@/components/admin/AdminWithdrawalsTab';
import AdminTasksTab       from '@/components/admin/AdminTasksTab';
import AdminSettingsTab    from '@/components/admin/AdminSettingsTab';
import AdminContestsTab    from '@/components/admin/AdminContestsTab';
import AdminPromosTab      from '@/components/admin/AdminPromosTab';

type AdminTab =
  | 'dashboard' | 'users' | 'withdrawals' | 'tasks'
  | 'contests'  | 'promos' | 'broadcast'  | 'settings';

function triggerHaptic(type: 'impact' | 'success' | 'error' = 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;
    if (type === 'success') tg?.HapticFeedback?.notificationOccurred('success');
    else if (type === 'error') tg?.HapticFeedback?.notificationOccurred('error');
    else tg?.HapticFeedback?.impactOccurred('medium');
  }
}

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
      if (step >= steps) { setDisplay(value); clearInterval(timer); }
      else setDisplay(Math.floor(start));
    }, 20);
    previous.current = value;
    return () => clearInterval(timer);
  }, [value]);
  return <>{display.toLocaleString()}</>;
}

const TAB_ITEMS: { id: AdminTab; label: string; icon: string; color: string }[] = [
  { id: 'dashboard',   label: 'Stats',     icon: '📊', color: '#ef4444' },
  { id: 'users',       label: 'Users',     icon: '👤', color: '#22d3ee' },
  { id: 'withdrawals', label: 'Withdraw',  icon: '💸', color: '#ffbe00' },
  { id: 'tasks',       label: 'Tasks',     icon: '📋', color: '#4ade80' },
  { id: 'contests',    label: 'Contests',  icon: '🏆', color: '#fbbf24' },
  { id: 'promos',      label: 'Promos',    icon: '🎁', color: '#a78bfa' },
  { id: 'broadcast',   label: 'Broadcast', icon: '📢', color: '#f472b6' },
  { id: 'settings',    label: 'Settings',  icon: '⚙️', color: '#94a3b8' },
];

const STAT_CONFIG = [
  { key: 'totalUsers',        label: 'Total Users',     icon: '👥', color: '#22d3ee' },
  { key: 'totalWithdrawals',  label: 'Withdrawals',     icon: '💸', color: '#ffbe00' },
  { key: 'pendingWithdrawals',label: 'Pending',         icon: '⏳', color: '#ef4444' },
  { key: 'totalTransactions', label: 'Transactions',    icon: '📊', color: '#4ade80' },
  { key: 'totalAdViews',      label: 'Ad Views',        icon: '🎬', color: '#a78bfa' },
  { key: '__activeTasks',     label: 'Active Tasks',    icon: '📋', color: '#f472b6' },
];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;900&family=Rajdhani:wght@500;600;700&display=swap');

@keyframes adFadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
@keyframes adSpin   { to{transform:rotate(360deg)} }
@keyframes adPulse  { 0%,100%{opacity:0.7} 50%{opacity:1} }
@keyframes adShine  { 0%{left:-100%} 40%,100%{left:150%} }
@keyframes adGlow   {
  0%,100% { box-shadow: 0 0 20px rgba(239,68,68,0.2); }
  50%     { box-shadow: 0 0 40px rgba(239,68,68,0.4); }
}

.ad-root {
  font-family: 'Rajdhani', sans-serif;
  padding: 0 16px 112px;
  color: #fff;
  min-height: 100vh;
  position: relative;
}

/* Ambient red glow */
.ad-ambient {
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 40% at 20% 10%, rgba(239,68,68,0.06) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 80% 90%, rgba(239,68,68,0.04) 0%, transparent 60%);
  pointer-events: none;
  z-index: 0;
}

/* Grid bg */
.ad-grid {
  position: fixed; inset: 0;
  background-image:
    linear-gradient(rgba(239,68,68,0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(239,68,68,0.02) 1px, transparent 1px);
  background-size: 32px 32px;
  pointer-events: none; z-index: 0;
}

.ad-content { position: relative; z-index: 1; }

/* Header */
.ad-header {
  display: flex; align-items: center; gap: 14px;
  padding: 4px 0 20px;
}
.ad-shield {
  width: 52px; height: 52px; border-radius: 16px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  border: 1px solid rgba(239,68,68,0.5);
  box-shadow: 0 0 24px rgba(239,68,68,0.4);
  animation: adGlow 3s ease-in-out infinite;
}
.ad-header-text {}
.ad-title {
  font-family: 'Orbitron', monospace;
  font-size: 20px; font-weight: 900; letter-spacing: 2px;
  color: #ef4444;
  text-shadow: 0 0 20px rgba(239,68,68,0.5);
  line-height: 1;
}
.ad-subtitle {
  font-size: 11px; letter-spacing: 3px;
  color: rgba(255,255,255,0.2); text-transform: uppercase; margin-top: 2px;
}

/* Message toast */
.ad-toast {
  margin-bottom: 14px; padding: 10px 16px;
  border-radius: 14px; text-align: center;
  font-family: 'Orbitron', monospace;
  font-size: 10px; letter-spacing: 2px; text-transform: uppercase;
  animation: adFadeIn 0.2s ease;
}
.ad-toast.success {
  background: rgba(74,222,128,0.08); border: 1px solid rgba(74,222,128,0.25); color: #4ade80;
}
.ad-toast.error {
  background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); color: #f87171;
}

/* Tab strip */
.ad-tabstrip {
  display: flex; gap: 6px; overflow-x: auto;
  padding-bottom: 4px; margin-bottom: 20px;
  scrollbar-width: none;
}
.ad-tabstrip::-webkit-scrollbar { display: none; }

.ad-tab {
  flex-shrink: 0;
  display: flex; align-items: center; gap: 5px;
  padding: 7px 14px; border-radius: 20px; border: none;
  font-family: 'Orbitron', monospace; font-size: 9px;
  font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase;
  cursor: pointer; transition: all 0.2s; white-space: nowrap;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.3);
}
.ad-tab.active {
  background: rgba(239,68,68,0.15);
  border-color: rgba(239,68,68,0.45);
  color: #ef4444;
  box-shadow: 0 0 16px rgba(239,68,68,0.2);
}
.ad-tab-dot {
  width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
}

/* ── Dashboard grid ── */
.ad-stat-grid {
  display: grid; grid-template-columns: repeat(2, 1fr);
  gap: 8px; margin-bottom: 8px;
}
.ad-stat-card {
  background: rgba(255,255,255,0.02);
  border-radius: 18px; padding: 16px 14px;
  position: relative; overflow: hidden;
  animation: adFadeIn 0.4s ease both;
}
.ad-stat-card::before {
  content: ''; position: absolute;
  top: 0; left: 10%; right: 10%; height: 1px;
}
.ad-stat-card::after {
  content: ''; position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.01) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.01) 1px, transparent 1px);
  background-size: 20px 20px;
  pointer-events: none; border-radius: 18px;
}
.ad-stat-icon {
  font-size: 22px; margin-bottom: 8px;
  display: block; opacity: 0.7;
}
.ad-stat-val {
  font-family: 'Orbitron', monospace;
  font-size: 28px; font-weight: 900; line-height: 1;
  margin-bottom: 4px; letter-spacing: 1px;
}
.ad-stat-label {
  font-size: 10px; letter-spacing: 2px;
  color: rgba(255,255,255,0.25); text-transform: uppercase;
}
.ad-stat-trend {
  position: absolute; top: 12px; right: 12px;
  font-size: 10px; letter-spacing: 1px;
  font-family: 'Orbitron', monospace;
  color: #4ade80; opacity: 0.7;
}

/* Section label */
.ad-section-label {
  font-family: 'Orbitron', monospace;
  font-size: 9px; letter-spacing: 3px;
  color: rgba(255,255,255,0.15); text-transform: uppercase;
  margin: 20px 0 10px 2px;
}

/* ── Broadcast ── */
.ad-textarea {
  width: 100%; padding: 14px;
  border-radius: 16px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(244,114,182,0.2);
  color: #fff;
  font-family: 'Rajdhani', sans-serif; font-size: 14px;
  resize: none; outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
  margin-bottom: 12px;
}
.ad-textarea:focus { border-color: rgba(244,114,182,0.5); }
.ad-textarea::placeholder { color: rgba(255,255,255,0.2); }

.ad-broadcast-btn {
  width: 100%; padding: 18px; border-radius: 16px; border: none;
  background: linear-gradient(135deg, #f472b6, #ec4899, #db2777);
  color: #fff;
  font-family: 'Orbitron', monospace; font-size: 14px;
  font-weight: 700; letter-spacing: 2px;
  cursor: pointer; transition: transform 0.12s, box-shadow 0.2s;
  box-shadow: 0 6px 28px rgba(244,114,182,0.35);
  position: relative; overflow: hidden;
}
.ad-broadcast-btn::after {
  content: ''; position: absolute;
  top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  animation: adShine 3s ease-in-out infinite;
}
.ad-broadcast-btn:active { transform: scale(0.97); }
.ad-broadcast-btn:disabled { opacity: 0.5; }

.ad-char-count {
  text-align: right; margin-bottom: 10px;
  font-family: 'Orbitron', monospace; font-size: 9px;
  letter-spacing: 2px; color: rgba(255,255,255,0.2);
}

/* Preview card */
.ad-preview {
  background: rgba(244,114,182,0.05);
  border: 1px solid rgba(244,114,182,0.15);
  border-radius: 16px; padding: 14px 16px;
  margin-bottom: 14px;
}
.ad-preview-label {
  font-family: 'Orbitron', monospace; font-size: 8px;
  letter-spacing: 3px; color: rgba(244,114,182,0.5);
  text-transform: uppercase; margin-bottom: 8px;
}
.ad-preview-text {
  font-size: 13px; color: rgba(255,255,255,0.7);
  white-space: pre-wrap; line-height: 1.5;
}
`;

export default function AdminPanel() {
  const { telegramUser, refreshUser } = useApp();

  const [tab, setTab]                   = useState<AdminTab>('dashboard');
  const [msgText, setMsgText]           = useState('');
  const [msgType, setMsgType]           = useState<'success' | 'error'>('success');
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [loading, setLoading]           = useState(true);

  const [stats, setStats] = useState({
    totalUsers: 0, totalWithdrawals: 0, pendingWithdrawals: 0,
    totalTransactions: 0, totalAdViews: 0,
  });
  const [users, setUsers]             = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [tasks, setTasks]             = useState<Task[]>([]);
  const [contests, setContests]       = useState<Contest[]>([]);
  const [settings, setSettingsState]  = useState<Record<string, string>>({});
  const [editSettings, setEditSettings] = useState<Record<string, string>>({});

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    setLoading(true);
    const [s, u, w, t, settingsData, c] = await Promise.all([
      adminGetStats(), adminGetUsers(), adminGetWithdrawals(),
      getTasks(), getSettings(), adminGetContests(),
    ]);
    setStats(s); setUsers(u); setWithdrawals(w); setTasks(t);
    setSettingsState(settingsData); setEditSettings(settingsData); setContests(c);
    setLoading(false);
  }

  function showMsg(text: string, type: 'success' | 'error' = 'success') {
    setMsgText(text); setMsgType(type);
    triggerHaptic(type);
    setTimeout(() => setMsgText(''), 3000);
  }

  const activeTaskCount = tasks.filter(t => t.is_active).length;
  const pendingCount    = withdrawals.filter(w => w.status === 'pending').length;

  return (
    <>
      <style>{CSS}</style>
      <div className="ad-root">
        <div className="ad-ambient" />
        <div className="ad-grid" />

        <div className="ad-content">

          {/* Header */}
          <div className="ad-header">
            <div className="ad-shield">🛡️</div>
            <div className="ad-header-text">
              <div className="ad-title">ADMIN PANEL</div>
              <div className="ad-subtitle">Production Control Center</div>
            </div>
          </div>

          {/* Toast */}
          {msgText && (
            <div className={`ad-toast ${msgType}`}>{msgText}</div>
          )}

          {/* Tab strip */}
          <div className="ad-tabstrip">
            {TAB_ITEMS.map(t => (
              <button
                key={t.id}
                className={`ad-tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => { triggerHaptic(); setTab(t.id); }}
              >
                <div
                  className="ad-tab-dot"
                  style={{ background: tab === t.id ? t.color : 'rgba(255,255,255,0.15)' }}
                />
                {t.label}
                {t.id === 'withdrawals' && pendingCount > 0 && (
                  <span style={{
                    background: '#ef4444', color: '#fff', borderRadius: '8px',
                    fontSize: '8px', fontWeight: 700, padding: '1px 5px', marginLeft: '2px',
                  }}>
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── DASHBOARD ── */}
          {tab === 'dashboard' && (
            <>
              <div className="ad-stat-grid">
                {STAT_CONFIG.map((s, i) => {
                  const raw = s.key === '__activeTasks'
                    ? activeTaskCount
                    : (stats as any)[s.key] ?? 0;

                  return (
                    <div
                      key={s.key}
                      className="ad-stat-card"
                      style={{
                        border: `1px solid ${s.color}20`,
                        boxShadow: `0 0 20px ${s.color}08`,
                        animationDelay: `${i * 0.06}s`,
                      }}
                    >
                      <div
                        className="ad-stat-card"
                        style={{
                          position: 'absolute', top: 0, left: '10%', right: '10%',
                          height: '1px', padding: 0, margin: 0, border: 'none',
                          background: `linear-gradient(90deg, transparent, ${s.color}40, transparent)`,
                          borderRadius: 0,
                        }}
                      />
                      <span className="ad-stat-icon">{s.icon}</span>
                      <div className="ad-stat-val" style={{ color: s.color }}>
                        <AnimatedNumber value={raw} />
                      </div>
                      <div className="ad-stat-label">{s.label}</div>
                    </div>
                  );
                })}
              </div>

              {/* Quick info row */}
              <div className="ad-section-label">System Status</div>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                gap: 8,
              }}>
                {[
                  { label: 'Pending Withdrawals', val: pendingCount, color: pendingCount > 0 ? '#ef4444' : '#4ade80' },
                  { label: 'Active Tasks',         val: activeTaskCount, color: '#4ade80' },
                ].map((item, i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${item.color}20`,
                    borderRadius: '14px', padding: '12px 14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.5px' }}>
                      {item.label}
                    </div>
                    <div style={{
                      fontFamily: "'Orbitron', monospace", fontSize: 16,
                      fontWeight: 700, color: item.color,
                    }}>
                      {item.val}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── USERS ── */}
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
            />
          )}

          {/* ── WITHDRAWALS ── */}
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
                showMsg('Withdrawal rejected', 'error');
                loadDashboard();
              }}
            />
          )}

          {/* ── TASKS ── */}
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

          {/* ── CONTESTS ── */}
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

          {/* ── PROMOS ── */}
          {tab === 'promos' && (
            <AdminPromosTab onMessage={showMsg} />
          )}

          {/* ── BROADCAST ── */}
          {tab === 'broadcast' && (
            <div>
              <div className="ad-section-label">Message Content</div>

              <textarea
                className="ad-textarea"
                value={broadcastText}
                onChange={e => setBroadcastText(e.target.value)}
                placeholder="Type your broadcast message here..."
                rows={5}
              />

              <div className="ad-char-count">{broadcastText.length} chars</div>

              {broadcastText.trim() && (
                <div className="ad-preview">
                  <div className="ad-preview-label">Preview</div>
                  <div className="ad-preview-text">{broadcastText}</div>
                </div>
              )}

              <button
                className="ad-broadcast-btn"
                onClick={async () => {
                  if (!broadcastText.trim() || !telegramUser) return;
                  setBroadcasting(true);
                  const result = await adminSendBroadcast(broadcastText, telegramUser.id);
                  result.success ? showMsg('Broadcast sent 📢') : showMsg('Failed', 'error');
                  setBroadcastText('');
                  setBroadcasting(false);
                }}
                disabled={broadcasting || !broadcastText.trim()}
              >
                {broadcasting ? '···' : '📢  SEND BROADCAST'}
              </button>
            </div>
          )}

          {/* ── SETTINGS ── */}
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
      </div>
    </>
  );
}
