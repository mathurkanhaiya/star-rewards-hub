import React, { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AdminUser {
  id: string;
  telegram_id: number;
  first_name: string;
  username: string;
  photo_url: string | null;
  level: number;
  total_points: number;
  is_banned: boolean;
  created_at: string;
  balances: Array<{ points: number; total_earned: number }>;
}

interface EarningsBreakdown {
  tap: number;
  farm: number;
  ads: number;
  games: number;
  daily: number;
  drop: number;
  referral: number;
  spin: number;
  tasks: number;
  promo: number;
  admin: number;
  other: number;
}

interface Transaction {
  id: string;
  type: string;
  points: number;
  description: string;
  created_at: string;
}

interface UserActivity {
  breakdown: EarningsBreakdown;
  transactions: Transaction[];
  totalEarned: number;
  currentBalance: number;
  lastSeen: string | null;
  adCount: number;
  tapCount: number;
  farmCount: number;
  dropStreak: number;
}

interface Props {
  users: AdminUser[];
  onBan: (userId: string, banned: boolean) => void;
  onAdjustBalance: (userId: string, points: number, reason: string) => void;
}

function txIcon(type: string): string {
  const map: Record<string, string> = {
    tap_earn: '👆',
    farm_claim: '🌾',
    adsgram_reward: '🎬', adsgram_task: '📺', ad_reward: '🎬', ad_watch: '🎬',
    tower_climb: '🏗️', lucky_box: '🎁', dice_roll: '🎲',
    card_flip: '🃏', number_guess: '🎯', game: '🎮',
    daily_reward: '🔥', daily: '🔥', daily_drop: '🎁',
    referral: '👥', referral_bonus: '👥',
    spin: '🎡', spin_reward: '🎡',
    promo: '🏷️', task_complete: '✅',
    admin_credit: '⬆️', admin_debit: '⬇️', admin_adjust: '⚙️',
  };
  return map[type] || '💰';
}

function txLabel(type: string): string {
  const map: Record<string, string> = {
    tap_earn: 'Tap Earn',
    farm_claim: 'Farm Claim',
    adsgram_reward: 'Adsgram Ad', adsgram_task: 'Adsgram Task',
    ad_reward: 'Ad Reward', ad_watch: 'Ad Watch',
    tower_climb: 'Tower Climb', lucky_box: 'Lucky Box',
    dice_roll: 'Dice Roll', card_flip: 'Card Flip',
    number_guess: 'Number Guess', game: 'Game Reward',
    daily_reward: 'Daily Reward', daily: 'Daily Reward',
    daily_drop: 'Daily Drop',
    referral: 'Referral Bonus', referral_bonus: 'Referral Bonus',
    spin: 'Spin Reward', spin_reward: 'Spin Reward',
    promo: 'Promo Reward', task_complete: 'Task Complete',
    admin_credit: 'Admin Credit', admin_debit: 'Admin Debit',
    admin_adjust: 'Admin Adjustment',
  };
  return map[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function txColor(type: string): string {
  if (type === 'tap_earn') return '#ffbe00';
  if (type === 'farm_claim') return '#4ade80';
  if (['adsgram_reward','adsgram_task','ad_reward','ad_watch'].includes(type)) return '#f59e0b';
  if (['tower_climb','lucky_box','dice_roll','card_flip','number_guess','game'].includes(type)) return '#a78bfa';
  if (['daily_reward','daily'].includes(type)) return '#4ade80';
  if (type === 'daily_drop') return '#ffbe00';
  if (['referral','referral_bonus'].includes(type)) return '#22d3ee';
  if (['spin','spin_reward'].includes(type)) return '#f472b6';
  if (type === 'task_complete') return '#34d399';
  if (type === 'promo') return '#fb923c';
  if (['admin_credit'].includes(type)) return '#4ade80';
  if (['admin_debit','admin_adjust'].includes(type)) return '#ef4444';
  return '#94a3b8';
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

type InnerTab = 'overview' | 'history';

interface UserPanelState {
  innerTab: InnerTab;
  loading: boolean;
  activity: UserActivity | null;
  adjustOpen: boolean;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;900&family=Rajdhani:wght@500;600;700&display=swap');

@keyframes auFadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
@keyframes auSpin   { to{transform:rotate(360deg)} }
@keyframes auShine  { 0%{left:-100%} 40%,100%{left:150%} }
@keyframes auPulse  { 0%,100%{opacity:0.5} 50%{opacity:1} }

.au-root { font-family:'Rajdhani',sans-serif; color:#fff; }

/* Search */
.au-search-wrap { position:relative; margin-bottom:10px; }
.au-search { width:100%; padding:11px 16px 11px 42px; border-radius:14px; outline:none; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); color:#fff; font-family:'Rajdhani',sans-serif; font-size:14px; transition:border-color 0.2s; box-sizing:border-box; }
.au-search:focus { border-color:rgba(239,68,68,0.4); }
.au-search::placeholder { color:rgba(255,255,255,0.2); }
.au-search-icon { position:absolute; left:14px; top:50%; transform:translateY(-50%); font-size:16px; pointer-events:none; }

/* Stats bar */
.au-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin-bottom:12px; }
.au-stat { border-radius:12px; padding:10px 8px; text-align:center; }
.au-stat-val   { font-family:'Orbitron',monospace; font-size:16px; font-weight:700; line-height:1; margin-bottom:2px; }
.au-stat-label { font-family:'Orbitron',monospace; font-size:7px; letter-spacing:1.5px; color:rgba(255,255,255,0.2); text-transform:uppercase; }

/* Controls */
.au-controls { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; gap:8px; }
.au-count { font-family:'Orbitron',monospace; font-size:9px; letter-spacing:2px; color:rgba(255,255,255,0.2); text-transform:uppercase; }
.au-controls-right { display:flex; gap:6px; }
.au-select { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:5px 10px; color:#fff; font-family:'Orbitron',monospace; font-size:9px; letter-spacing:1px; outline:none; cursor:pointer; }

/* Filter pills */
.au-filters { display:flex; gap:5px; margin-bottom:12px; overflow-x:auto; scrollbar-width:none; padding-bottom:2px; }
.au-filters::-webkit-scrollbar { display:none; }
.au-filter-pill { padding:4px 12px; border-radius:20px; border:none; font-family:'Orbitron',monospace; font-size:8px; font-weight:700; letter-spacing:1px; cursor:pointer; white-space:nowrap; transition:all 0.2s; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); color:rgba(255,255,255,0.3); }
.au-filter-pill.active { background:rgba(239,68,68,0.12); border-color:rgba(239,68,68,0.4); color:#ef4444; }

/* User card */
.au-card { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:18px; margin-bottom:8px; overflow:hidden; transition:border-color 0.2s; }
.au-card.banned  { border-color:rgba(239,68,68,0.2); background:rgba(239,68,68,0.02); }
.au-card.expanded{ border-color:rgba(239,68,68,0.25); }

.au-card-header { display:flex; align-items:center; gap:10px; padding:13px 14px; cursor:pointer; position:relative; overflow:hidden; }
.au-card-header::before { content:''; position:absolute; top:0; left:10%; right:10%; height:1px; background:linear-gradient(90deg,transparent,rgba(239,68,68,0.2),transparent); }

/* Avatar */
.au-avatar { width:42px; height:42px; border-radius:50%; overflow:hidden; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:18px; background:rgba(255,255,255,0.06); border:2px solid rgba(255,255,255,0.08); position:relative; }
.au-avatar img { width:100%; height:100%; object-fit:cover; }
.au-online-dot { position:absolute; bottom:1px; right:1px; width:9px; height:9px; border-radius:50%; border:2px solid #06080f; }

.au-user-info { flex:1; min-width:0; }
.au-user-name  { font-size:14px; font-weight:700; color:rgba(255,255,255,0.9); display:flex; align-items:center; gap:5px; flex-wrap:wrap; margin-bottom:3px; }
.au-username   { color:rgba(255,255,255,0.3); font-weight:500; font-size:12px; }
.au-banned-tag { font-family:'Orbitron',monospace; font-size:7px; letter-spacing:1px; padding:1px 6px; border-radius:6px; background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); color:#ef4444; }
.au-user-meta  { font-size:11px; color:rgba(255,255,255,0.25); display:flex; gap:8px; flex-wrap:wrap; }
.au-meta-chip  { display:inline-flex; align-items:center; gap:3px; }

/* Rank badge */
.au-rank-badge { font-family:'Orbitron',monospace; font-size:8px; font-weight:700; padding:2px 7px; border-radius:8px; }

/* Actions */
.au-actions { display:flex; gap:5px; flex-shrink:0; }
.au-action-btn { padding:5px 10px; border-radius:9px; border:none; font-family:'Orbitron',monospace; font-size:8px; font-weight:700; letter-spacing:1px; cursor:pointer; transition:transform 0.12s; white-space:nowrap; }
.au-action-btn:active { transform:scale(0.93); }
.au-btn-balance { background:rgba(255,190,0,0.1); border:1px solid rgba(255,190,0,0.25); color:#ffbe00; }
.au-btn-ban     { background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); color:#ef4444; }
.au-btn-unban   { background:rgba(74,222,128,0.1); border:1px solid rgba(74,222,128,0.25); color:#4ade80; }
.au-expand-arr  { font-size:10px; color:rgba(255,255,255,0.2); transition:transform 0.2s; flex-shrink:0; }
.au-expand-arr.open { transform:rotate(180deg); }

/* Expanded */
.au-expanded { border-top:1px solid rgba(255,255,255,0.05); animation:auFadeIn 0.25s ease; }

.au-inner-tabs { display:flex; gap:4px; padding:12px 14px 0; }
.au-inner-tab  { flex:1; padding:7px; border-radius:10px; border:none; font-family:'Orbitron',monospace; font-size:8px; font-weight:600; letter-spacing:1.5px; text-transform:uppercase; cursor:pointer; transition:all 0.2s; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); color:rgba(255,255,255,0.25); }
.au-inner-tab.active { background:rgba(239,68,68,0.1); border-color:rgba(239,68,68,0.35); color:#ef4444; }

/* Activity summary row */
.au-activity-row { display:flex; gap:6px; padding:12px 14px 0; overflow-x:auto; scrollbar-width:none; }
.au-activity-row::-webkit-scrollbar { display:none; }
.au-activity-chip { flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:2px; padding:8px 12px; border-radius:12px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); min-width:56px; text-align:center; }
.au-activity-chip-val   { font-family:'Orbitron',monospace; font-size:13px; font-weight:700; line-height:1; }
.au-activity-chip-label { font-family:'Orbitron',monospace; font-size:7px; letter-spacing:1px; color:rgba(255,255,255,0.2); text-transform:uppercase; }

/* Breakdown grid */
.au-breakdown { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; padding:10px 14px; }
.au-breakdown-item { background:rgba(255,255,255,0.02); border-radius:12px; padding:10px 8px; text-align:center; border:1px solid rgba(255,255,255,0.05); }
.au-breakdown-icon  { font-size:15px; margin-bottom:3px; }
.au-breakdown-val   { font-family:'Orbitron',monospace; font-size:13px; font-weight:700; line-height:1; margin-bottom:2px; }
.au-breakdown-label { font-size:9px; letter-spacing:1px; color:rgba(255,255,255,0.2); text-transform:uppercase; }

/* Total banner */
.au-total-banner { margin:0 14px 10px; background:rgba(255,190,0,0.05); border:1px solid rgba(255,190,0,0.18); border-radius:12px; padding:10px 14px; display:flex; align-items:center; justify-content:space-between; }
.au-total-label  { font-family:'Orbitron',monospace; font-size:9px; letter-spacing:2px; color:rgba(255,255,255,0.25); text-transform:uppercase; }
.au-total-val    { font-family:'Orbitron',monospace; font-size:15px; font-weight:700; color:#ffbe00; }

/* Extra stats grid */
.au-extra-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; padding:0 14px 14px; }
.au-extra-item { background:rgba(255,255,255,0.02); border-radius:12px; padding:10px 12px; }
.au-extra-label { font-family:'Orbitron',monospace; font-size:8px; letter-spacing:1.5px; color:rgba(255,255,255,0.2); text-transform:uppercase; margin-bottom:4px; }
.au-extra-val   { font-family:'Orbitron',monospace; font-size:13px; font-weight:700; }

/* TX list */
.au-tx-list  { padding:0 14px 14px; }
.au-tx-empty { text-align:center; padding:20px 0; font-family:'Orbitron',monospace; font-size:9px; letter-spacing:3px; color:rgba(255,255,255,0.1); }
.au-tx-row   { display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.04); }
.au-tx-row:last-child { border-bottom:none; }
.au-tx-icon-wrap { width:32px; height:32px; border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; }
.au-tx-body  { flex:1; min-width:0; }
.au-tx-label { font-size:12px; font-weight:600; color:rgba(255,255,255,0.8); }
.au-tx-desc  { font-size:10px; color:rgba(255,255,255,0.2); letter-spacing:0.5px; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.au-tx-right { text-align:right; flex-shrink:0; }
.au-tx-pts   { font-family:'Orbitron',monospace; font-size:12px; font-weight:700; letter-spacing:0.5px; }
.au-tx-time  { font-size:9px; color:rgba(255,255,255,0.15); letter-spacing:1px; margin-top:1px; }

/* Spinner */
.au-spinner { width:22px; height:22px; border-radius:50%; border:2px solid rgba(239,68,68,0.15); border-top:2px solid #ef4444; animation:auSpin 0.7s linear infinite; margin:18px auto; }

/* Balance adjust */
.au-adjust { margin:0 14px 14px; background:rgba(255,190,0,0.04); border:1px solid rgba(255,190,0,0.15); border-radius:14px; padding:13px; animation:auFadeIn 0.2s ease; }
.au-adjust-title { font-family:'Orbitron',monospace; font-size:9px; letter-spacing:2px; color:rgba(255,190,0,0.5); text-transform:uppercase; margin-bottom:10px; }
.au-adjust-row   { display:flex; gap:6px; margin-bottom:8px; }
.au-adjust-input { flex:1; padding:9px 11px; border-radius:10px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.08); color:#fff; font-family:'Rajdhani',sans-serif; font-size:13px; outline:none; transition:border-color 0.2s; }
.au-adjust-input:focus { border-color:rgba(255,190,0,0.4); }
.au-adjust-input::placeholder { color:rgba(255,255,255,0.2); }
.au-adjust-presets { display:flex; gap:5px; margin-bottom:8px; flex-wrap:wrap; }
.au-preset-btn { padding:4px 10px; border-radius:8px; border:none; font-family:'Orbitron',monospace; font-size:8px; font-weight:600; cursor:pointer; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.4); transition:all 0.15s; }
.au-preset-btn:hover { background:rgba(255,190,0,0.08); border-color:rgba(255,190,0,0.25); color:#ffbe00; }
.au-adjust-btn { width:100%; padding:11px; border-radius:10px; border:none; background:linear-gradient(135deg,#ffbe00,#f59e0b); color:#1a0800; font-family:'Orbitron',monospace; font-size:11px; font-weight:700; letter-spacing:1px; cursor:pointer; transition:transform 0.12s; }
.au-adjust-btn:active { transform:scale(0.97); }
.au-adjust-btn:disabled { opacity:0.4; cursor:not-allowed; }

/* Pagination */
.au-pagination { display:flex; justify-content:center; gap:5px; padding-top:12px; flex-wrap:wrap; }
.au-page-btn { padding:6px 11px; border-radius:9px; border:none; font-family:'Orbitron',monospace; font-size:9px; font-weight:600; letter-spacing:1px; cursor:pointer; transition:transform 0.12s; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); color:rgba(255,255,255,0.35); }
.au-page-btn.active { background:#ef4444; border-color:#ef4444; color:#fff; }
.au-page-btn:active { transform:scale(0.93); }
`;

const BREAKDOWN_ITEMS = [
  { key: 'tap',      icon: '👆', label: 'Tap',      color: '#ffbe00' },
  { key: 'farm',     icon: '🌾', label: 'Farm',     color: '#4ade80' },
  { key: 'ads',      icon: '🎬', label: 'Ads',      color: '#f59e0b' },
  { key: 'games',    icon: '🎮', label: 'Games',    color: '#a78bfa' },
  { key: 'daily',    icon: '🔥', label: 'Daily',    color: '#4ade80' },
  { key: 'drop',     icon: '🎁', label: 'Drop',     color: '#ffbe00' },
  { key: 'referral', icon: '👥', label: 'Refer',    color: '#22d3ee' },
  { key: 'spin',     icon: '🎡', label: 'Spin',     color: '#f472b6' },
  { key: 'tasks',    icon: '✅', label: 'Tasks',    color: '#34d399' },
  { key: 'promo',    icon: '🏷️', label: 'Promo',   color: '#fb923c' },
  { key: 'admin',    icon: '⚙️', label: 'Admin',    color: '#ef4444' },
  { key: 'other',    icon: '💰', label: 'Other',    color: '#94a3b8' },
];

type FilterType = 'all' | 'active' | 'banned' | 'new';

export default function AdminUsersTab({ users, onBan, onAdjustBalance }: Props) {
  const [searchQuery, setSearchQuery]   = useState('');
  const [currentPage, setCurrentPage]   = useState(1);
  const [perPage, setPerPage]           = useState<number | 'all'>(20);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [panels, setPanels]             = useState<Record<string, UserPanelState>>({});
  const [filter, setFilter]             = useState<FilterType>('all');
  const [sortBy, setSortBy]             = useState<'newest' | 'balance' | 'level'>('newest');

  /* ── Global stats ── */
  const globalStats = useMemo(() => {
    const total   = users.length;
    const banned  = users.filter(u => u.is_banned).length;
    const today   = new Date(); today.setUTCHours(0,0,0,0);
    const newToday = users.filter(u => new Date(u.created_at) >= today).length;
    const totalPts = users.reduce((s, u) => s + (u.balances?.[0]?.points || 0), 0);
    return { total, banned, newToday, totalPts };
  }, [users]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = [...users];

    /* filter */
    if (filter === 'banned') list = list.filter(u => u.is_banned);
    else if (filter === 'active') list = list.filter(u => !u.is_banned);
    else if (filter === 'new') {
      const cutoff = Date.now() - 7 * 86400000;
      list = list.filter(u => new Date(u.created_at).getTime() > cutoff);
    }

    /* search */
    if (q) list = list.filter(u =>
      u.first_name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      String(u.telegram_id).includes(q) ||
      u.id.toLowerCase().includes(q)
    );

    /* sort */
    if (sortBy === 'balance') list.sort((a,b) => (b.balances?.[0]?.points||0) - (a.balances?.[0]?.points||0));
    else if (sortBy === 'level') list.sort((a,b) => (b.level||1) - (a.level||1));
    else list.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return list;
  }, [users, searchQuery, filter, sortBy]);

  const totalPages     = perPage === 'all' ? 1 : Math.ceil(filtered.length / (perPage as number));
  const paginatedUsers = useMemo(() => {
    if (perPage === 'all') return filtered;
    const start = (currentPage - 1) * (perPage as number);
    return filtered.slice(start, start + (perPage as number));
  }, [filtered, currentPage, perPage]);

  function getPanel(id: string): UserPanelState {
    return panels[id] || { innerTab: 'overview', loading: false, activity: null, adjustOpen: false };
  }
  function setPanel(id: string, patch: Partial<UserPanelState>) {
    setPanels(prev => ({ ...prev, [id]: { ...getPanel(id), ...patch } }));
  }

  async function loadActivity(userId: string) {
    if (getPanel(userId).activity) return;
    setPanel(userId, { loading: true });

    const [txRes, adRes, dropRes] = await Promise.all([
      supabase.from('transactions').select('id,type,points,description,created_at')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(150),
      supabase.from('ad_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('daily_claims').select('claim_date')
        .eq('user_id', userId).order('claim_date', { ascending: false }).limit(7),
    ]);

    const txs: Transaction[] = txRes.data || [];
    const breakdown: EarningsBreakdown = {
      tap:0, farm:0, ads:0, games:0, daily:0, drop:0,
      referral:0, spin:0, tasks:0, promo:0, admin:0, other:0,
    };
    let totalEarned = 0;

    txs.forEach(t => {
      const pts = t.points || 0;
      if (pts <= 0) return;
      totalEarned += pts;
      const ty = t.type;
      if (ty === 'tap_earn') breakdown.tap += pts;
      else if (ty === 'farm_claim') breakdown.farm += pts;
      else if (['adsgram_reward','adsgram_task','ad_reward','ad_watch'].includes(ty)) breakdown.ads += pts;
      else if (['tower_climb','lucky_box','dice_roll','card_flip','number_guess','game'].includes(ty)) breakdown.games += pts;
      else if (['daily_reward','daily'].includes(ty)) breakdown.daily += pts;
      else if (ty === 'daily_drop') breakdown.drop += pts;
      else if (['referral','referral_bonus'].includes(ty)) breakdown.referral += pts;
      else if (['spin','spin_reward'].includes(ty)) breakdown.spin += pts;
      else if (ty === 'task_complete') breakdown.tasks += pts;
      else if (ty === 'promo') breakdown.promo += pts;
      else if (['admin_credit','admin_debit','admin_adjust'].includes(ty)) breakdown.admin += pts;
      else breakdown.other += pts;
    });

    /* tap count from transactions */
    const tapCount  = txs.filter(t => t.type === 'tap_earn').length;
    const farmCount = txs.filter(t => t.type === 'farm_claim').length;

    /* drop streak */
    let dropStreak = 0;
    const drops = dropRes.data || [];
    if (drops.length > 0) {
      const now = new Date(); now.setUTCHours(0,0,0,0);
      for (let i = 0; i < drops.length; i++) {
        const d = new Date(drops[i].claim_date);
        const exp = new Date(now); exp.setUTCDate(now.getUTCDate() - i);
        if (d.toISOString().split('T')[0] === exp.toISOString().split('T')[0]) dropStreak++;
        else break;
      }
    }

    const { data: balData } = await supabase
      .from('balances').select('points').eq('user_id', userId).single();

    setPanel(userId, {
      loading: false,
      activity: {
        breakdown, transactions: txs, totalEarned,
        currentBalance: balData?.points || 0,
        lastSeen: txs[0]?.created_at || null,
        adCount: adRes.count || 0,
        tapCount, farmCount, dropStreak,
      },
    });
  }

  function toggleExpand(userId: string) {
    if (expandedUser === userId) { setExpandedUser(null); return; }
    setExpandedUser(userId);
    loadActivity(userId);
  }

  function getLevelColor(lvl: number) {
    if (lvl >= 50) return '#ef4444';
    if (lvl >= 25) return '#a855f7';
    if (lvl >= 14) return '#ffbe00';
    if (lvl >= 10) return '#e2e8f0';
    if (lvl >= 7)  return '#f97316';
    if (lvl >= 5)  return '#94a3b8';
    return '#60a5fa';
  }

  const PRESETS = ['+100', '+500', '+1000', '-100', '-500'];

  return (
    <>
      <style>{CSS}</style>
      <div className="au-root">

        {/* Global stats */}
        <div className="au-stats">
          {[
            { label: 'Total',   val: globalStats.total,    color: '#ef4444' },
            { label: 'Banned',  val: globalStats.banned,   color: '#f97316' },
            { label: 'New 7d',  val: globalStats.newToday, color: '#4ade80' },
            { label: 'Tot PTS', val: `${(globalStats.totalPts/1000).toFixed(0)}k`, color: '#ffbe00', isStr: true },
          ].map((s, i) => (
            <div key={i} className="au-stat" style={{ background:`${s.color}08`, border:`1px solid ${s.color}18` }}>
              <div className="au-stat-val" style={{ color: s.color }}>
                {(s as any).isStr ? s.val : s.val.toLocaleString()}
              </div>
              <div className="au-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="au-search-wrap">
          <span className="au-search-icon">🔍</span>
          <input
            className="au-search"
            placeholder="Search name, @username, Telegram ID..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          />
        </div>

        {/* Filter pills */}
        <div className="au-filters">
          {(['all','active','banned','new'] as FilterType[]).map(f => (
            <button key={f} className={`au-filter-pill ${filter===f?'active':''}`}
              onClick={() => { setFilter(f); setCurrentPage(1); }}>
              {f === 'all' ? `All (${users.length})`
               : f === 'active' ? `Active (${users.filter(u=>!u.is_banned).length})`
               : f === 'banned' ? `Banned (${globalStats.banned})`
               : `New 7d (${globalStats.newToday})`}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="au-controls">
          <div className="au-count">{paginatedUsers.length} of {filtered.length} users</div>
          <div className="au-controls-right">
            <select className="au-select" value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}>
              <option value="newest">Newest</option>
              <option value="balance">Balance</option>
              <option value="level">Level</option>
            </select>
            <select className="au-select" value={perPage}
              onChange={e => { setPerPage(e.target.value==='all'?'all':parseInt(e.target.value)); setCurrentPage(1); }}>
              <option value={20}>20 / pg</option>
              <option value={50}>50 / pg</option>
              <option value={100}>100 / pg</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        {/* User cards */}
        {paginatedUsers.map(u => {
          const panel   = getPanel(u.id);
          const isOpen  = expandedUser === u.id;
          const balance = u.balances?.[0]?.points ?? 0;
          const lvlColor = getLevelColor(u.level || 1);
          const isRecent = panel.activity?.lastSeen
            ? (Date.now() - new Date(panel.activity.lastSeen).getTime()) < 86400000
            : false;

          return (
            <div key={u.id}
              className={`au-card ${u.is_banned?'banned':''} ${isOpen?'expanded':''}`}>

              {/* Header */}
              <div className="au-card-header" onClick={() => toggleExpand(u.id)}>
                <div className="au-avatar">
                  {u.photo_url ? <img src={u.photo_url} alt="" /> : <span>👤</span>}
                  <div className="au-online-dot"
                    style={{ background: isRecent ? '#4ade80' : 'rgba(255,255,255,0.1)' }}/>
                </div>

                <div className="au-user-info">
                  <div className="au-user-name">
                    {u.first_name || 'Anonymous'}
                    {u.username && <span className="au-username">@{u.username}</span>}
                    {u.is_banned && <span className="au-banned-tag">BANNED</span>}
                    <span className="au-rank-badge"
                      style={{ background:`${lvlColor}15`, border:`1px solid ${lvlColor}30`, color: lvlColor }}>
                      Lv{u.level || 1}
                    </span>
                  </div>
                  <div className="au-user-meta">
                    <span className="au-meta-chip">🪙 {balance.toLocaleString()}</span>
                    <span className="au-meta-chip">🆔 {u.telegram_id}</span>
                    {panel.activity && (
                      <>
                        <span className="au-meta-chip">👆 {panel.activity.tapCount}</span>
                        <span className="au-meta-chip">🎬 {panel.activity.adCount}</span>
                        <span className="au-meta-chip">🔥 {panel.activity.dropStreak}d</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="au-actions" onClick={e => e.stopPropagation()}>
                  <button className="au-action-btn au-btn-balance"
                    onClick={() => setPanel(u.id, { adjustOpen: !panel.adjustOpen })}>
                    💰
                  </button>
                  <button
                    className={`au-action-btn ${u.is_banned ? 'au-btn-unban' : 'au-btn-ban'}`}
                    onClick={() => onBan(u.id, !u.is_banned)}>
                    {u.is_banned ? 'Unban' : 'Ban'}
                  </button>
                </div>

                <div className={`au-expand-arr ${isOpen ? 'open' : ''}`}>▼</div>
              </div>

              {/* Balance adjust */}
              {panel.adjustOpen && (
                <div className="au-adjust">
                  <div className="au-adjust-title">Adjust Balance</div>
                  <div className="au-adjust-presets">
                    {PRESETS.map(p => (
                      <button key={p} className="au-preset-btn"
                        onClick={() => setAdjustAmount(p)}>
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="au-adjust-row">
                    <input className="au-adjust-input" type="number"
                      value={adjustAmount} placeholder="Points (+ or -)"
                      onChange={e => setAdjustAmount(e.target.value)}/>
                    <input className="au-adjust-input"
                      value={adjustReason} placeholder="Reason"
                      onChange={e => setAdjustReason(e.target.value)}/>
                  </div>
                  <button className="au-adjust-btn"
                    disabled={!adjustAmount || !adjustReason.trim()}
                    onClick={() => {
                      const pts = parseInt(adjustAmount);
                      if (!isNaN(pts) && adjustReason.trim()) {
                        onAdjustBalance(u.id, pts, adjustReason.trim());
                        setPanel(u.id, { adjustOpen: false });
                        setAdjustAmount(''); setAdjustReason('');
                      }
                    }}>
                    Apply Balance Change
                  </button>
                </div>
              )}

              {/* Expanded panel */}
              {isOpen && (
                <div className="au-expanded">
                  <div className="au-inner-tabs">
                    {(['overview','history'] as InnerTab[]).map(t => (
                      <button key={t}
                        className={`au-inner-tab ${panel.innerTab===t?'active':''}`}
                        onClick={() => setPanel(u.id, { innerTab: t })}>
                        {t === 'overview' ? '📊 Overview' : '📜 History'}
                      </button>
                    ))}
                  </div>

                  {panel.loading && <div className="au-spinner"/>}

                  {/* ── Overview ── */}
                  {!panel.loading && panel.innerTab === 'overview' && panel.activity && (
                    <>
                      {/* Quick activity chips */}
                      <div className="au-activity-row">
                        {[
                          { icon:'👆', val: panel.activity.tapCount,   label:'TAPS',  color:'#ffbe00' },
                          { icon:'🌾', val: panel.activity.farmCount,  label:'FARMS', color:'#4ade80' },
                          { icon:'🎬', val: panel.activity.adCount,    label:'ADS',   color:'#f59e0b' },
                          { icon:'🔥', val: panel.activity.dropStreak, label:'STREAK',color:'#ef4444' },
                          { icon:'📋', val: panel.activity.transactions.filter(t=>t.type==='task_complete').length, label:'TASKS', color:'#34d399' },
                        ].map((c, i) => (
                          <div key={i} className="au-activity-chip"
                            style={{ borderColor:`${c.color}20` }}>
                            <div className="au-activity-chip-val" style={{ color: c.color }}>
                              {c.val.toLocaleString()}
                            </div>
                            <div className="au-activity-chip-label">{c.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Total earned */}
                      <div className="au-total-banner">
                        <div className="au-total-label">Total Earned</div>
                        <div className="au-total-val">
                          {panel.activity.totalEarned.toLocaleString()} PTS
                        </div>
                      </div>

                      {/* Breakdown */}
                      <div className="au-breakdown">
                        {BREAKDOWN_ITEMS.map(item => {
                          const val = (panel.activity!.breakdown as any)[item.key] || 0;
                          if (val === 0) return null;
                          return (
                            <div key={item.key} className="au-breakdown-item">
                              <div className="au-breakdown-icon">{item.icon}</div>
                              <div className="au-breakdown-val" style={{ color: item.color }}>
                                {val.toLocaleString()}
                              </div>
                              <div className="au-breakdown-label">{item.label}</div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Extra stats */}
                      <div className="au-extra-grid">
                        {[
                          { label:'Current Balance', val:`${panel.activity.currentBalance.toLocaleString()} pts`, color:'#ffbe00' },
                          { label:'Last Active',     val: panel.activity.lastSeen ? timeAgo(panel.activity.lastSeen) : 'Never', color:'#4ade80' },
                          { label:'Member Since',    val: new Date(u.created_at).toLocaleDateString('en-US',{month:'short',year:'numeric'}), color:'#a78bfa' },
                          { label:'Telegram ID',     val: String(u.telegram_id), color:'#22d3ee' },
                        ].map((s,i) => (
                          <div key={i} className="au-extra-item"
                            style={{ border:`1px solid ${s.color}15` }}>
                            <div className="au-extra-label">{s.label}</div>
                            <div className="au-extra-val" style={{ color: s.color }}>{s.val}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* ── History ── */}
                  {!panel.loading && panel.innerTab === 'history' && panel.activity && (
                    <div className="au-tx-list">
                      {panel.activity.transactions.length === 0 ? (
                        <div className="au-tx-empty">✦ No transactions ✦</div>
                      ) : (
                        panel.activity.transactions.map(tx => {
                          const color = txColor(tx.type);
                          return (
                            <div key={tx.id} className="au-tx-row">
                              <div className="au-tx-icon-wrap"
                                style={{ background:`${color}12`, border:`1px solid ${color}22` }}>
                                {txIcon(tx.type)}
                              </div>
                              <div className="au-tx-body">
                                <div className="au-tx-label">{txLabel(tx.type)}</div>
                                <div className="au-tx-desc">
                                  {tx.description || formatDate(tx.created_at)}
                                </div>
                              </div>
                              <div className="au-tx-right">
                                <div className="au-tx-pts" style={{ color }}>
                                  {tx.points > 0 ? '+' : ''}{tx.points}
                                </div>
                                <div className="au-tx-time">{timeAgo(tx.created_at)}</div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Pagination */}
        {perPage !== 'all' && totalPages > 1 && (
          <div className="au-pagination">
            <button className="au-page-btn"
              onClick={() => currentPage > 1 && setCurrentPage(p => p-1)}>
              ← Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => (
              <button key={i}
                className={`au-page-btn ${currentPage===i+1?'active':''}`}
                onClick={() => setCurrentPage(i+1)}>
                {i + 1}
              </button>
            ))}
            <button className="au-page-btn"
              onClick={() => currentPage < totalPages && setCurrentPage(p => p+1)}>
              Next →
            </button>
          </div>
        )}

      </div>
    </>
  );
}
