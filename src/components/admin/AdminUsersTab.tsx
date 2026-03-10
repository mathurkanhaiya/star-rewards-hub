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

interface Props {
  users: AdminUser[];
  onBan: (userId: string, banned: boolean) => void;
  onAdjustBalance: (userId: string, points: number, reason: string) => void;
}

export default function AdminUsersTab({ users, onBan, onAdjustBalance }: Props) {
  const [adjustUserId, setAdjustUserId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState<number | 'all'>('all');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [earnings, setEarnings] = useState<Record<string, EarningsBreakdown>>({});

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return users;
    return users.filter(u =>
      u.first_name?.toLowerCase().includes(query) ||
      u.username?.toLowerCase().includes(query) ||
      String(u.telegram_id).includes(query) ||
      u.id.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  const totalPages = perPage === 'all' ? 1 : Math.ceil(filtered.length / perPage);
  const paginatedUsers = useMemo(() => {
    if (perPage === 'all') return filtered;
    const start = (currentPage - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, currentPage, perPage]);

  async function loadEarnings(userId: string) {
    if (earnings[userId]) return;
    const { data } = await supabase
      .from('transactions')
      .select('type, points')
      .eq('user_id', userId);

    const breakdown: EarningsBreakdown = { ads: 0, games: 0, daily: 0, referral: 0, spin: 0, promo: 0, other: 0 };
    (data || []).forEach((t: any) => {
      const pts = t.points || 0;
      if (pts <= 0) return;
      if (t.type === 'ad_reward' || t.type === 'ad_watch') breakdown.ads += pts;
      else if (['dice_roll', 'card_flip', 'number_guess', 'tower', 'lucky_box', 'game'].includes(t.type)) breakdown.games += pts;
      else if (t.type === 'daily_reward' || t.type === 'daily') breakdown.daily += pts;
      else if (t.type === 'referral' || t.type === 'referral_bonus') breakdown.referral += pts;
      else if (t.type === 'spin' || t.type === 'spin_reward') breakdown.spin += pts;
      else if (t.type === 'promo') breakdown.promo += pts;
      else breakdown.other += pts;
    });
    setEarnings(prev => ({ ...prev, [userId]: breakdown }));
  }

  function toggleExpand(userId: string) {
    if (expandedUser === userId) {
      setExpandedUser(null);
    } else {
      setExpandedUser(userId);
      loadEarnings(userId);
    }
  }

  return (
    <div className="space-y-6">
      <input
        placeholder="🔍 Search by name, username, telegram ID or UID..."
        value={searchQuery}
        onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
        className="w-full px-4 py-3 rounded-2xl text-sm outline-none bg-[hsl(220_25%_8%)] border border-[hsl(220_20%_20%)] text-white transition-all duration-300 focus:scale-[1.02]"
      />

      <div className="flex items-center justify-between text-xs text-gray-400">
        <div>Showing {perPage === 'all' ? filtered.length : paginatedUsers.length} of {filtered.length}</div>
        <select
          value={perPage}
          onChange={e => { setPerPage(e.target.value === 'all' ? 'all' : parseInt(e.target.value)); setCurrentPage(1); }}
          className="bg-black/40 border border-gray-700 rounded-lg px-2 py-1 text-white"
        >
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value="all">Show All</option>
        </select>
      </div>

      {paginatedUsers.map(u => (
        <div
          key={u.id}
          className="p-4 rounded-2xl bg-gradient-to-br from-[rgba(20,25,40,0.9)] to-[rgba(10,15,25,0.9)] border border-white/5 shadow-xl transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl"
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleExpand(u.id)}>
              {/* PFP */}
              <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-700 flex items-center justify-center">
                {u.photo_url ? (
                  <img src={u.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg">👤</span>
                )}
              </div>
              <div>
                <div className="font-semibold text-white">
                  {u.first_name || 'Anonymous'} {u.username && <span className="text-gray-400 font-normal">@{u.username}</span>}
                </div>
                <div className="text-xs text-gray-400">
                  UID: {u.id.slice(0, 8)}... • TG: {u.telegram_id} • Lv{u.level} • {u.total_points.toLocaleString()} pts
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setAdjustUserId(adjustUserId === u.id ? null : u.id)}
                className="px-3 py-1 rounded-lg text-xs bg-yellow-500/10 text-yellow-400 hover:scale-110 transition">💰</button>
              <button onClick={() => onBan(u.id, !u.is_banned)}
                className={`px-3 py-1 rounded-lg text-xs transition hover:scale-110 ${u.is_banned ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {u.is_banned ? 'Unban' : 'Ban'}
              </button>
            </div>
          </div>

          {/* Earnings breakdown */}
          {expandedUser === u.id && earnings[u.id] && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {([
                { label: '📺 Ads', val: earnings[u.id].ads },
                { label: '🎮 Games', val: earnings[u.id].games },
                { label: '📅 Daily', val: earnings[u.id].daily },
                { label: '👥 Referral', val: earnings[u.id].referral },
                { label: '🎡 Spin', val: earnings[u.id].spin },
                { label: '🎁 Promo', val: earnings[u.id].promo },
              ]).map(e => (
                <div key={e.label} className="text-center p-2 rounded-lg bg-black/30 border border-white/5">
                  <div className="text-xs text-gray-400">{e.label}</div>
                  <div className="text-sm font-bold text-white">{e.val.toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}

          {/* Balance panel */}
          {adjustUserId === u.id && (
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <input type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)}
                  placeholder="Points" className="flex-1 px-2 py-2 rounded bg-black/40 border border-gray-700 text-white text-xs" />
                <input value={adjustReason} onChange={e => setAdjustReason(e.target.value)}
                  placeholder="Reason" className="flex-1 px-2 py-2 rounded bg-black/40 border border-gray-700 text-white text-xs" />
              </div>
              <button
                onClick={() => {
                  const pts = parseInt(adjustAmount);
                  if (!isNaN(pts) && adjustReason.trim()) {
                    onAdjustBalance(u.id, pts, adjustReason.trim());
                    setAdjustUserId(null); setAdjustAmount(''); setAdjustReason('');
                  }
                }}
                className="w-full py-2 rounded-lg bg-yellow-500 text-black text-xs font-bold hover:scale-105 transition"
              >Apply Balance Change</button>
            </div>
          )}
        </div>
      ))}

      {perPage !== 'all' && totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4 flex-wrap">
          <button onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
            className="px-3 py-1 rounded-lg bg-black/40 text-white border border-gray-700 hover:scale-110 transition">Prev</button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => (
            <button key={i} onClick={() => setCurrentPage(i + 1)}
              className={`px-3 py-1 rounded-lg text-xs transition ${currentPage === i + 1 ? 'bg-yellow-500 text-black' : 'bg-black/40 text-white border border-gray-700 hover:scale-110'}`}>
              {i + 1}
            </button>
          ))}
          <button onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
            className="px-3 py-1 rounded-lg bg-black/40 text-white border border-gray-700 hover:scale-110 transition">Next</button>
        </div>
      )}
    </div>
  );
}
