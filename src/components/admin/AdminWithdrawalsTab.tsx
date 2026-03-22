import React, { useState, useMemo } from 'react';

interface WithdrawalItem {
  id: string;
  method: string;
  points_spent: number;
  amount: number;
  status: string;
  wallet_address: string | null;
  created_at: string;
  admin_note: string | null;
  users: { first_name: string; username: string; telegram_id: number; photo_url: string | null } | null;
}

interface Props {
  withdrawals: WithdrawalItem[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

const STATUS_CONFIG = {
  pending:  { color: '#ffbe00', glow: 'rgba(255,190,0,0.4)',   bg: 'rgba(255,190,0,0.08)',   border: 'rgba(255,190,0,0.25)',   label: 'PENDING'  },
  approved: { color: '#4ade80', glow: 'rgba(74,222,128,0.4)',  bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.25)',  label: 'APPROVED' },
  rejected: { color: '#ef4444', glow: 'rgba(239,68,68,0.4)',   bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',   label: 'REJECTED' },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;900&family=Rajdhani:wght@500;600;700&display=swap');

@keyframes awFadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
@keyframes awShine  { 0%{left:-100%} 40%,100%{left:150%} }

.aw-root { font-family: 'Rajdhani', sans-serif; color: #fff; }

/* ── Summary row ── */
.aw-summary {
  display: grid; grid-template-columns: repeat(3,1fr);
  gap: 8px; margin-bottom: 16px;
}
.aw-summary-tile {
  border-radius: 16px; padding: 14px 10px; text-align: center;
  position: relative; overflow: hidden;
}
.aw-summary-tile::before {
  content: ''; position: absolute;
  top: 0; left: 10%; right: 10%; height: 1px;
}
.aw-summary-val {
  font-family: 'Orbitron', monospace;
  font-size: 26px; font-weight: 900; line-height: 1; margin-bottom: 3px;
}
.aw-summary-label {
  font-family: 'Orbitron', monospace;
  font-size: 8px; letter-spacing: 2px;
  color: rgba(255,255,255,0.25); text-transform: uppercase;
}

/* ── Filter strip ── */
.aw-filters {
  display: flex; gap: 6px; margin-bottom: 14px;
}
.aw-filter-btn {
  flex: 1; padding: 7px; border-radius: 12px; border: none;
  font-family: 'Orbitron', monospace; font-size: 8px;
  font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase;
  cursor: pointer; transition: all 0.2s;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.25);
}

/* ── Card ── */
.aw-card {
  background: rgba(255,255,255,0.02);
  border-radius: 18px; margin-bottom: 8px;
  overflow: hidden; position: relative;
  animation: awFadeIn 0.3s ease both;
}
.aw-card-beam {
  position: absolute; top: 0; left: 10%; right: 10%; height: 1px; pointer​​​​​​​​​​​​​​​​
