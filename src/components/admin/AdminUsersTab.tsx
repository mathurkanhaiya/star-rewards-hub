import React, { useMemo, useState } from 'react';

interface AdminUser {
  id: string;
  telegram_id: number;
  first_name: string;
  username: string;
  level: number;
  total_points: number;
  is_banned: boolean;
  created_at: string;
  balances: Array<{ points: number }>;
}

interface Props {
  users: AdminUser[];
  onBan: (userId: string, banned: boolean) => void;
  onAdjustBalance: (userId: string, points: number, reason: string) => void;
}

export default function AdminUsersTab({
  users,
  onBan,
  onAdjustBalance
}: Props) {
  const [adjustUserId, setAdjustUserId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState<number | 'all'>(20);

  /* ---------------- FILTER ---------------- */
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

  /* ---------------- PAGINATION ---------------- */
  const totalPages =
    perPage === 'all'
      ? 1
      : Math.ceil(filtered.length / perPage);

  const paginatedUsers = useMemo(() => {
    if (perPage === 'all') return filtered;

    const start = (currentPage - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, currentPage, perPage]);

  const changePage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="space-y-6">

      {/* SEARCH */}
      <input
        placeholder="🔍 Search by name, username, telegram ID or UID..."
        value={searchQuery}
        onChange={e => {
          setSearchQuery(e.target.value);
          setCurrentPage(1);
        }}
        className="w-full px-4 py-3 rounded-2xl text-sm outline-none
        bg-[hsl(220_25%_8%)]
        border border-[hsl(220_20%_20%)]
        text-white
        transition-all duration-300 focus:scale-[1.02]"
      />

      {/* PER PAGE SELECTOR */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <div>
          Showing {perPage === 'all'
            ? filtered.length
            : paginatedUsers.length} of {filtered.length}
        </div>

        <select
          value={perPage}
          onChange={e => {
            const value =
              e.target.value === 'all'
                ? 'all'
                : parseInt(e.target.value);
            setPerPage(value);
            setCurrentPage(1);
          }}
          className="bg-black/40 border border-gray-700 rounded-lg px-2 py-1 text-white"
        >
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value="all">Show All</option>
        </select>
      </div>

      {/* USERS */}
      {paginatedUsers.map(u => (
        <div
          key={u.id}
          className="p-4 rounded-2xl bg-gradient-to-br
          from-[rgba(20,25,40,0.9)]
          to-[rgba(10,15,25,0.9)]
          border border-white/5
          shadow-xl
          transition-all duration-500
          hover:-translate-y-2 hover:shadow-2xl"
        >
          <div className="flex justify-between items-center">
            <div>
              <div className="font-semibold text-white">
                {u.first_name || 'Anonymous'} {u.username && `@${u.username}`}
              </div>
              <div className="text-xs text-gray-400">
                UID: {u.id} • TG: {u.telegram_id} • Lv{u.level} •{' '}
                {u.total_points.toLocaleString()} pts
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() =>
                  setAdjustUserId(adjustUserId === u.id ? null : u.id)
                }
                className="px-3 py-1 rounded-lg text-xs bg-yellow-500/10 text-yellow-400 hover:scale-110 transition"
              >
                💰
              </button>

              <button
                onClick={() => onBan(u.id, !u.is_banned)}
                className={`px-3 py-1 rounded-lg text-xs transition hover:scale-110 ${
                  u.is_banned
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-red-500/10 text-red-400'
                }`}
              >
                {u.is_banned ? 'Unban' : 'Ban'}
              </button>
            </div>
          </div>

          {/* BALANCE PANEL */}
          {adjustUserId === u.id && (
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={e => setAdjustAmount(e.target.value)}
                  placeholder="Points"
                  className="flex-1 px-2 py-2 rounded bg-black/40 border border-gray-700 text-white text-xs"
                />
                <input
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  placeholder="Reason"
                  className="flex-1 px-2 py-2 rounded bg-black/40 border border-gray-700 text-white text-xs"
                />
              </div>

              <button
                onClick={() => {
                  const pts = parseInt(adjustAmount);
                  if (!isNaN(pts) && adjustReason.trim()) {
                    onAdjustBalance(u.id, pts, adjustReason.trim());
                    setAdjustUserId(null);
                    setAdjustAmount('');
                    setAdjustReason('');
                  }
                }}
                className="w-full py-2 rounded-lg bg-yellow-500 text-black text-xs font-bold hover:scale-105 transition"
              >
                Apply Balance Change
              </button>
            </div>
          )}
        </div>
      ))}

      {/* PAGINATION CONTROLS */}
      {perPage !== 'all' && totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4 flex-wrap">
          <button
            onClick={() => changePage(currentPage - 1)}
            className="px-3 py-1 rounded-lg bg-black/40 text-white border border-gray-700 hover:scale-110 transition"
          >
            Prev
          </button>

          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => changePage(i + 1)}
              className={`px-3 py-1 rounded-lg text-xs transition ${
                currentPage === i + 1
                  ? 'bg-yellow-500 text-black'
                  : 'bg-black/40 text-white border border-gray-700 hover:scale-110'
              }`}
            >
              {i + 1}
            </button>
          ))}

          <button
            onClick={() => changePage(currentPage + 1)}
            className="px-3 py-1 rounded-lg bg-black/40 text-white border border-gray-700 hover:scale-110 transition"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}