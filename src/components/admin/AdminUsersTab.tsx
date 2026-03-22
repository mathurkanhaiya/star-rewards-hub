import React, { useMemo, useState, useEffect } from 'react';
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
  balances: Array<{ points: number }>;
}

interface EarningsBreakdown {
  ads: number;
  games: number;
  daily: number;
  referral: number;
  spin: number;
  promo: number;
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
  lastSeen: string | null;
  adCount: number;
}

interface Props {
  users: AdminUser[];
  onBan: (userId: string, banned: boolean) => void;
  onAdjustBalance: (userId: string, points: number, reason: string) => void;
}

/* ── TX helpers ── */
function txIcon(type: string): string {
  const map: Record<string, string> = {
    adsgram_reward: '🎬', adsgram_task: '📺', ad_reward: '🎬', ad_watch: '🎬',
    tower_climb: '🏗️', lucky_box: '🎁', dice_roll: '🎲', card_flip: '🃏',
    number_guess: '🎯', game: '🎮',
    daily_reward: '🔥', daily: '🔥',
    referral: '👥', referral_bonus: '👥',
    spin: '🎡', spin_reward: '🎡',
    promo: '🎁', task_complete: '✅',
    admin_adjust: '⚙️',
  };
  return map[type] || '💰';
}

function txLabel(type: string): string {
  const map: Record<string, string> = {
    adsgram_reward: 'Adsgram Ad', adsgram_task: 'Adsgram Task',
    ad_reward: 'Ad Reward', ad_watch: 'Ad Watch',
    tower_climb: 'Tower Climb', lucky_box: 'Lucky Box',
    dice_roll: 'Dice Roll', card_flip: 'Card Flip',
    number_guess: 'Number Guess', game: 'Game Reward',
    daily_reward: 'Daily Reward', daily: 'Daily Reward',
    referral: 'Referral Bonus', referral_bonus: 'Referral Bonus',
    spin: 'Spin Reward', spin_reward: 'Spin Reward',
    promo: 'Promo Reward', task_complete: 'Task Complete',
    admin_adjust: 'Admin Adjustment',
  };
  return map[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function txColor(type: string): string {
  if (['adsgram_reward','adsgram_task','ad_reward','ad_watch'].includes(type)) return '#ffbe00';
  if (['tower_climb','lucky_box','dice_roll','card_flip','number_guess','game'].includes(type)) return '#a78bfa';
  if (['daily_reward','daily'].includes(type)) return '#4ade80';
  if (['referral','referral_bonus'].includes(type)) return '#22d3ee';
  if (['spin','spin_reward'].includes(type)) return '#f472b6';
  if (type === 'admin_adjust') return '#ef4444';
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
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;900&family=Rajdhani:wght@500;600;700&display=swap');

@keyframes auFadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
@keyframes auSpin { to{transform:rotate(360deg)} }
@keyframes auShine { 0%{left:-100%} 40%,100%{left:150%} }

.au-root { font-family: 'Rajdhani', sans-serif; color: #fff; }

/* Search */
.au-search-wrap { position: relative; margin-bottom: 12px; }
.au-search {
  width: 100%; padding: 12px 16px 12px 42px;
  border-radius: 14px; outline: none;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  color: #fff; font-family: 'Rajdhani', sans-serif;
  font-size: 14px; transition: border-color 0.2s;
  box-sizing: border-box;
}
.au-search:focus { border-color: rgba(239,68,68,0.4); }
.au-search::placeholder { color: rgba(255,255,255,0.2); }
.au-search-icon {
  position: absolute; left: 14px; top: 50%;
  transform: translateY(-50%); font-size: 16px; pointer-events: none;
}

/* Controls row */
.au-controls {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px;
}
.au-count {
  font-family: 'Orbitron', monospace; font-size: 9px;
  letter-spacing: 2px; color: rgba(255,255,255,0.2); text-transform: uppercase;
}
.au-select {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px; padding: 5px 10px; color: #fff;
  font-family: 'Orbitron', monospace; font-size: 9px; letter-spacing: 1px;
  outline: none; cursor: pointer;
}

/* User card */
.au-card {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 18px; margin-bottom: 8px;
  overflow: hidden; transition: border-color 0.2s;
}
.au-card.banned { border-color: rgba(239,68,68,0.2); background: rgba(239,68,68,0.03); }
.au-card.expanded { border-color: rgba(239,68,68,0.25); }

/* Card header */
.au-card-header {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; cursor: pointer;
  position: relative; overflow: hidden;
}
.au-card-header::before {
  content: ''; position: absolute;
  top: 0; left: 10%; right: 10%; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(239,68,68,0.2), transparent);
}

/* Avatar */
.au-avatar {
  width: 44px; height: 44px; border-radius: 50%;
  overflow: hidden; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; background: rgba(255,255,255,0.06);
  border: 2px solid rgba(255,255,255,0.08);
  position: relative;
}
.au-avatar img { width: 100%; height: 100%; object-fit: cover; }
.au-online-dot {
  position: absolute; bottom: 1px; right: 1px;
  width: 10px; height: 10px; border-radius: 50%;
  border: 2px solid #06080f;
}

.au-user-info { flex: 1; min-width: 0; }
.au-user-name {
  font-size: 14px; font-weight: 700;
  color: rgba(255,255,255,0.9);
  display: flex; align-items: center; gap: 6px;
  flex-wrap: wrap;
}
.au-username { color: rgba(255,255,255,0.35); font-weight: 500; font-size: 13px; }
.au-banned-tag {
  font-family: 'Orbitron', monospace; font-size: 7px;
  letter-spacing: 1px; padding: 1px 6px; border-radius: 6px;
  background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3);
  color: #ef4444;
}
.au-user-meta {
  font-size: 11px; color: rgba(255,255,255,0.25);
  letter-spacing: 0.5px; margin-top: 2px;
  display: flex; gap: 8px; flex-wrap: wrap;
}
.au-meta-chip {
  display: inline-flex; align-items: center; gap: 3px;
}

/* Actions */
.au-actions { display: flex; gap: 6px; flex-shrink: 0; }
.au-action-btn {
  padding: 6px 12px; border-radius: 10px; border: none;
  font-family: 'Orbitron', monospace; font-size: 8px;
  font-weight: 700; letter-spacing: 1px; cursor: pointer;
  transition: transform 0.12s; white-space: nowrap;
}
.au-action-btn:active { transform: scale(0.93); }
.au-btn-balance {
  background: rgba(255,190,0,0.1); border: 1px solid rgba(255,190,0,0.25); color: #ffbe00;
}
.au-btn-ban {
  background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); color: #ef4444;
}
.au-btn-unban {
  background: rgba(74,222,128,0.1); border: 1px solid rgba(74,222,128,0.25); color: #4ade80;
}
.au-expand-arrow {
  font-size: 10px; color: rgba(255,255,255,0.2);
  transition: transform 0.2s; flex-shrink: 0;
}
.au-expand-arrow.open { transform: rotate(180deg); }

/* Expanded panel */
.au-expanded {
  border-top: 1px solid rgba(255,255,255,0.05);
  animation: auFadeIn 0.25s ease;
}

/* Tabs inside expanded */
.au-inner-tabs {
  display: flex; gap: 4px; padding: 12px 16px 0;
}
.au-inner-tab {
  flex: 1; padding: 7px; border-radius: 10px; border: none;
  font-family: 'Orbitron', monospace; font-size: 8px;
  font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase;
  cursor: pointer; transition: all 0.2s;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.25);
}
.au-inner-tab.active {
  background: rgba(239,68,68,0.12);
  border-color: rgba(239,68,68,0.35);
  color: #ef4444;
}

/* Breakdown grid */
.au-breakdown {
  display: grid; grid-template-columns: repeat(3,1fr);
  gap: 6px; padding: 12px 16px;
}
.au-breakdown-item {
  background: rgba(255,255,255,0.02);
  border-radius: 12px; padding: 10px 8px; text-align: center;
  border: 1px solid rgba(255,255,255,0.05);
}
.au-breakdown-icon { font-size: 16px; margin-bottom: 4px; }
.au-breakdown-val {
  font-family: 'Orbitron', monospace;
  font-size: 14px; font-weight: 700; line-height: 1;
  margin-bottom: 2px;
}
.au-breakdown-label {
  font-size: 9px; letter-spacing: 1px;
  color: rgba(255,255,255,0.2); text-transform: uppercase;
}

/* Total earned banner */
.au-total-banner {
  margin: 0 16px 12px;
  background: rgba(255,190,0,0.06);
  border: 1px solid rgba(255,190,0,0.2);
  border-radius: 12px; padding: 10px 14px;
  display: flex; align-items: center; justify-content: space-between;
}
.au-total-label {
  font-family: 'Orbitron', monospace; font-size: 9px;
  letter-spacing: 2px; color: rgba(255,255,255,0.25); text-transform: uppercase;
}
.au-total-val {
  font-family: 'Orbitron', monospace; font-size: 16px;
  font-weight: 700; color: #ffbe00; letter-spacing: 1px;
}

/* Transaction list */
.au-tx-list { padding: 0 16px 14px; }
.au-tx-empty {
  text-align: center; padding: 24px 0;
  font-family: 'Orbitron', monospace; font-size: 9px;
  letter-spacing: 3px; color: rgba(255,255,255,0.1);
}
.au-tx-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.au-tx-row:last-child { border-bottom: none; }
.au-tx-icon-wrap {
  width: 34px; height: 34px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; flex-shrink: 0;
}
.au-tx-body { flex: 1; min-width: 0; }
.au-tx-label { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.8); }
.au-tx-desc { font-size: 10px; color: rgba(255,255,255,0.2); letter-spacing: 0.5px; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.au-tx-right { text-align: right; flex-shrink: 0; }
.au-tx-pts {
  font-family: 'Orbitron', monospace; font-size: 13px;
  font-weight: 700; letter-spacing: 0.5px;
}
.au-tx-time {
  font-size: 9px; color: rgba(255,255,255,0.15);
  letter-spacing: 1px; margin-top: 1px;
}

/* Loading spinner */
.au-spinner {
  width: 24px; height: 24px; border-radius: 50%;
  border: 2px solid rgba(239,68,68,0.15);
  border-top: 2px solid #ef4444;
  animation: auSpin 0.7s linear infinite;
  margin: 20px auto;
}

/* Balance adjust panel */
.au-adjust {
  margin: 0 16px 14px;
  background: rgba(255,190,0,0.04);
  border: 1px solid rgba(255,190,0,0.15);
  border-radius: 14px; padding: 14px;
}
.au-adjust-title {
  font-family: 'Orbitron', monospace; font-size: 9px;
  letter-spacing: 2px; color: rgba(255,190,0,0.5);
  text-transform: uppercase; margin-bottom: 10px;
}
.au-adjust-row { display: flex; gap: 8px; margin-bottom: 8px; }
.au-adjust-input {
  flex: 1; padding: 10px 12px; border-radius: 10px;
  background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08);
  color: #fff; font-family: 'Rajdhani', sans-serif; font-size: 13px;
  outline: none; transition: border-color 0.2s;
}
.au-adjust-input:focus { border-color: rgba(255,190,0,0.4); }
.au-adjust-input::placeholder { color: rgba(255,255,255,0.2); }
.au-adjust-btn {
  width: 100%; padding: 12px; border-radius: 10px; border: none;
  background: linear-gradient(135deg, #ffbe00, #f59e0b);
  color: #1a0800; font-family: 'Orbitron', monospace;
  font-size: 11px; font-weight: 700; letter-spacing: 1px;
  cursor: pointer; transition: transform 0.12s;
}
.au-adjust-btn:active { transform: scale(0.97); }

/* Pagination */
.au-pagination {
  display: flex; justify-content: center; gap: 6px;
  padding-top: 14px; flex-wrap: wrap;
}
.au-page-btn {
  padding: 6px 12px; border-radius: 10px; border: none;
  font-family: 'Orbitron', monospace; font-size: 9px;
  font-weight: 600; letter-spacing: 1px; cursor: pointer;
  transition: transform 0.12s;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.4);
}
.au-page-btn.active { background: #ef4444; border-color: #ef4444; color: #fff; }
.au-page-btn:active { transform: scale(0.93); }
`;

type InnerTab = 'overview' | 'history';

interface UserPanelState {
  innerTab: InnerTab;
  loading: boolean;
  activity: UserActivity | null;
  adjustOpen: boolean;
}

export default function AdminUsersTab({ users, onBan, onAdjustBalance }: Props) {
  const [searchQuery, setSearchQuery]   = useState('');
  const [currentPage, setCurrentPage]   = useState(1);
  const [perPage, setPerPage]           = useState<number | 'all'>(20);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [panels, setPanels]             = useState<Record<string, UserPanelState>>({});

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.first_name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      String(u.telegram_id).includes(q) ||
      u.id.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const totalPages     = perPage === 'all' ? 1 : Math.ceil(filtered.length / perPage);
  const paginatedUsers = useMemo(() => {
    if (perPage === 'all') return filtered;
    const start = (currentPage - 1) * (perPage as number);
    return filtered.slice(start, start + (perPage as number));
  }, [filtered, currentPage, perPage]);

  function getPanel(userId: string): UserPanelState {
    return panels[userId] || { innerTab: 'overview', loading: false, activity: null, adjustOpen: false };
  }

  function setPanel(userId: string, patch: Partial<UserPanelState>) {
    setPanels(prev => ({ ...prev, [userId]: { ...getPanel(userId), ...patch } }));
  }

  async function loadActivity(userId: string) {
    if (getPanel(userId).activity) return;
    setPanel(userId, { loading: true });

    const [txResult, adResult] = await Promise.all([
      supabase.from('transactions').select('id, type, points, description, created_at')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
      supabase.from('ad_logs').select('id, created_at').eq('user_id', userId),
    ]);

    const txs: Transaction[] = txResult.data || [];
    const breakdown: EarningsBreakdown = { ads: 0, games: 0, daily: 0, referral: 0, spin: 0, promo: 0, other: 0 };
    let totalEarned = 0;

    txs.forEach(t => {
      const pts = t.points || 0;
      if (pts <= 0) return;
      totalEarned += pts;
      const type = t.type;
      if (['adsgram_reward','adsgram_task','ad_reward','ad_watch'].includes(type)) breakdown.ads += pts;
      else if (['tower_climb','lucky_box','dice_roll','card_flip','number_guess','game'].includes(type)) breakdown.games += pts;
      else if (['daily_reward','daily'].includes(type)) breakdown.daily += pts;
      else if (['referral','referral_bonus'].includes(type)) breakdown.referral += pts;
      else if (['spin','spin_reward'].includes(type)) breakdown.spin += pts;
      else if (type === 'promo') breakdown.promo += pts;
      else breakdown.other += pts;
    });

    const lastTx = txs[0]?.created_at || null;

    setPanel(userId, {
      loading: false,
      activity: {
        breakdown,
        transactions: txs,
        totalEarned,
        lastSeen: lastTx,
        adCount: (adResult.data || []).length,
      },
    });
  }

  function toggleExpand(userId: string) {
    if (expandedUser === userId) {
      setExpandedUser(null);
    } else {
      setExpandedUser(userId);
      loadActivity(userId);
    }
  }

  const BREAKDOWN_ITEMS = [
    { key: 'ads',      icon: '🎬', label: 'Ads',      color: '#ffbe00' },
    { key: 'games',    icon: '🎮', label: 'Games',    color: '#a78bfa' },
    { key: 'daily',    icon: '🔥', label: 'Daily',    color: '#4ade80' },
    { key: 'referral', icon: '👥', label: 'Referral', color: '#22d3ee' },
    { key: 'spin',     icon: '🎡', label: 'Spin',     color: '#f472b6' },
    { key: 'promo',    icon: '🎁', label: 'Promo',    color: '#fb923c' },
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="au-root">

        {/* Search */}
        <div className="au-search-wrap">
          <span className="au-search-icon">🔍</span>
          <input
            className="au-search"
            placeholder="Search name, @username, Telegram ID or UID..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          />
        </div>

        {/* Controls */}
        <div className="au-controls">
          <div className="au-count">
            {paginatedUsers.length} of {filtered.length} users
          </div>
          <select
            className="au-select"
            value={perPage}
            onChange={e => {
              setPerPage(e.target.value === 'all' ? 'all' : parseInt(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
            <option value="all">Show All</option>
          </select>
        </div>

        {/* User cards */}
        {paginatedUsers.map(u => {
          const panel   = getPanel(u.id);
          const isOpen  = expandedUser === u.id;
          const balance = u.balances?.[0]?.points ?? u.total_points ?? 0;
          const isRecent = panel.activity?.lastSeen
            ? (Date.now() - new Date(panel.activity.lastSeen).getTime()) < 86400000
            : false;

          return (
            <div key={u.id} className={`au-card ${u.is_banned ? 'banned' : ''} ${isOpen ? 'expanded' : ''}`}>

              {/* Header row */}
              <div className="au-card-header" onClick={() => toggleExpand(u.id)}>
                {/* Avatar */}
                <div className="au-avatar">
                  {u.photo_url
                    ? <img src={u.photo_url} alt="" />
                    : <span>👤</span>}
                  <div
                    className="au-online-dot"
                    style={{ background: isRecent ? '#4ade80' : '#374151' }}
                  />
                </div>

                {/* Info */}
                <div className="au-user-info">
                  <div className="au-user-name">
                    {u.first_name || 'Anonymous'}
                    {u.username && <span className="au-username">@{u.username}</span>}
                    {u.is_banned && <span className="au-banned-tag">BANNED</span>}
                  </div>
                  <div className="au-user-meta">
                    <span className="au-meta-chip">🪙 {balance.toLocaleString()} pts</span>
                    <span className="au-meta-chip">⭐ Lv{u.level}</span>
                    <span className="au-meta-chip">🆔 {String(u.telegram_id)}</span>
                    {panel.activity && (
                      <span className="au-meta-chip">📺 {panel.activity.adCount} ads</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="au-actions" onClick={e => e.stopPropagation()}>
                  <button
                    className="au-action-btn au-btn-balance"
                    onClick={() => setPanel(u.id, { adjustOpen: !panel.adjustOpen })}
                  >
                    💰
                  </button>
                  <button
                    className={`au-action-btn ${u.is_banned ? 'au-btn-unban' : 'au-btn-ban'}`}
                    onClick={() => onBan(u.id, !u.is_banned)}
                  >
                    {u.is_banned ? 'Unban' : 'Ban'}
                  </button>
                </div>

                <div className={`au-expand-arrow ${isOpen ? 'open' : ''}`}>▼</div>
              </div>

              {/* Balance adjust panel */}
              {panel.adjustOpen && (
                <div className="au-adjust">
                  <div className="au-adjust-title">Adjust Balance</div>
                  <div className="au-adjust-row">
                    <input
                      className="au-adjust-input"
                      type="number"
                      value={adjustAmount}
                      onChange={e => setAdjustAmount(e.target.value)}
                      placeholder="Points (+ or -)"
                    />
                    <input
                      className="au-adjust-input"
                      value={adjustReason}
                      onChange={e => setAdjustReason(e.target.value)}
                      placeholder="Reason"
                    />
                  </div>
                  <button
                    className="au-adjust-btn"
                    onClick={() => {
                      const pts = parseInt(adjustAmount);
                      if (!isNaN(pts) && adjustReason.trim()) {
                        onAdjustBalance(u.id, pts, adjustReason.trim());
                        setPanel(u.id, { adjustOpen: false });
                        setAdjustAmount(''); setAdjustReason('');
                      }
                    }}
                  >
                    Apply Balance Change
                  </button>
                </div>
              )}

              {/* Expanded activity panel */}
              {isOpen && (
                <div className="au-expanded">
                  {/* Inner tabs */}
                  <div className="au-inner-tabs">
                    {(['overview', 'history'] as InnerTab[]).map(t => (
                      <button
                        key={t}
                        className={`au-inner-tab ${panel.innerTab === t ? 'active' : ''}`}
                        onClick={() => setPanel(u.id, { innerTab: t })}
                      >
                        {t === 'overview' ? '📊 Overview' : '📜 History'}
                      </button>
                    ))}
                  </div>

                  {/* Loading */}
                  {panel.loading && <div className="au-spinner" />}

                  {/* Overview tab */}
                  {!panel.loading && panel.innerTab === 'overview' && panel.activity && (
                    <>
                      {/* Total earned */}
                      <div className="au-total-banner">
                        <div className="au-total-label">Total Earned</div>
                        <div className="au-total-val">{panel.activity.totalEarned.toLocaleString()} PTS</div>
                      </div>

                      {/* Breakdown grid */}
                      <div className="au-breakdown">
                        {BREAKDOWN_ITEMS.map(item => (
                          <div key={item.key} className="au-breakdown-item">
                            <div className="au-breakdown-icon">{item.icon}</div>
                            <div className="au-breakdown-val" style={{ color: item.color }}>
                              {((panel.activity!.breakdown as any)[item.key] || 0).toLocaleString()}
                            </div>
                            <div className="au-breakdown-label">{item.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Extra stats */}
                      <div style={{ padding: '0 16px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {[
                          { label: 'Total Ad Views', val: panel.activity.adCount, color: '#ffbe00' },
                          { label: 'Last Activity',  val: panel.activity.lastSeen ? timeAgo(panel.activity.lastSeen) : 'Never', color: '#4ade80', isStr: true },
                          { label: 'Current Balance', val: balance.toLocaleString(), color: '#22d3ee', isStr: true },
                          { label: 'Member Since', val: new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), color: '#a78bfa', isStr: true },
                        ].map((s, i) => (
                          <div key={i} style={{
                            background: 'rgba(255,255,255,0.02)', border: `1px solid ${s.color}15`,
                            borderRadius: '12px', padding: '10px 12px',
                          }}>
                            <div style={{ fontSize: 9, letterSpacing: '1.5px', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', fontFamily: "'Orbitron', monospace", marginBottom: 4 }}>
                              {s.label}
                            </div>
                            <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 14, fontWeight: 700, color: s.color }}>
                              {s.isStr ? s.val : Number(s.val).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* History tab */}
                  {!panel.loading && panel.innerTab === 'history' && panel.activity && (
                    <div className="au-tx-list">
                      {panel.activity.transactions.length === 0 ? (
                        <div className="au-tx-empty">✦ No transactions yet ✦</div>
                      ) : (
                        panel.activity.transactions.map(tx => {
                          const color = txColor(tx.type);
                          return (
                            <div key={tx.id} className="au-tx-row">
                              <div
                                className="au-tx-icon-wrap"
                                style={{ background: `${color}12`, border: `1px solid ${color}25` }}
                              >
                                {txIcon(tx.type)}
                              </div>
                              <div className="au-tx-body">
                                <div className="au-tx-label">{txLabel(tx.type)}</div>
                                <div className="au-tx-desc">{tx.description || formatDate(tx.created_at)}</div>
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
            <button
              className="au-page-btn"
              onClick={() => currentPage > 1 && setCurrentPage(p => p - 1)}
            >
              ← Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => (
              <button
                key={i}
                className={`au-page-btn ${currentPage === i + 1 ? 'active' : ''}`}
                onClick={() => setCurrentPage(i + 1)}
              >
                {i + 1}
              </button>
            ))}
            <button
              className="au-page-btn"
              onClick={() => currentPage < totalPages && setCurrentPage(p => p + 1)}
            >
              Next →
            </button>
          </div>
        )}

      </div>
    </>
  );
}
