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

  return (
    <div className="space-y-6 perspective-1000">
      {/* 3D Animated Search */}
      <div className="relative group">
        <input
          placeholder="🔍 Search by name, username, telegram ID or UID..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl text-sm outline-none transition-all duration-500
          bg-[hsl(220_25%_8%)]
          border border-[hsl(220_20%_20%)]
          text-[hsl(210_40%_95%)]
          shadow-[0_0_20px_rgba(0,255,255,0.1)]
          focus:shadow-[0_0_30px_rgba(0,255,255,0.4)]
          focus:scale-[1.02]"
        />
      </div>

      <div className="text-xs text-muted-foreground">
        Showing {filtered.length} of {users.length} users
      </div>

      {filtered.map(u => (
        <div
          key={u.id}
          className="relative group transition-all duration-500 transform-gpu hover:-translate-y-2 hover:rotate-x-2 hover:rotate-y-2"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Glow Border */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-30 blur-xl transition-all duration-500" />

          {/* Card */}
          <div
            className="relative p-4 rounded-2xl backdrop-blur-xl transition-all duration-500"
            style={{
              background: 'linear-gradient(145deg, rgba(20,25,40,0.9), rgba(10,15,25,0.9))',
              border: '1px solid rgba(255,255,255,0.05)',
              boxShadow:
                '0 20px 40px rgba(0,0,0,0.4), inset 0 0 20px rgba(255,255,255,0.02)'
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white
                  bg-gradient-to-br from-cyan-400 to-purple-500
                  shadow-lg shadow-purple-500/30
                  transition-all duration-500 group-hover:scale-110"
                >
                  {u.first_name?.[0] || '?'}
                </div>

                <div>
                  <div className="text-sm font-semibold text-white tracking-wide">
                    {u.first_name || 'Anonymous'}{' '}
                    {u.username && `@${u.username}`}
                  </div>

                  <div className="text-xs text-gray-400">
                    UID: {u.id} • TG: {u.telegram_id} • Lv{u.level} •{' '}
                    {u.total_points.toLocaleString()} pts
                    {u.balances?.[0] && (
                      <> • Bal: {u.balances[0].points.toLocaleString()}</>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setAdjustUserId(adjustUserId === u.id ? null : u.id)
                  }
                  className="px-3 py-1.5 rounded-xl text-xs font-bold
                  bg-yellow-500/10 text-yellow-400
                  hover:bg-yellow-500/20
                  transition-all duration-300 hover:scale-110"
                >
                  💰
                </button>

                <button
                  onClick={() => onBan(u.id, !u.is_banned)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 hover:scale-110 ${
                    u.is_banned
                      ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                      : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                  }`}
                >
                  {u.is_banned ? 'Unban' : 'Ban'}
                </button>
              </div>
            </div>

            {/* Animated Expand Panel */}
            <div
              className={`transition-all duration-500 overflow-hidden ${
                adjustUserId === u.id
                  ? 'max-h-40 opacity-100 mt-3'
                  : 'max-h-0 opacity-0'
              }`}
            >
              <div className="p-3 rounded-xl bg-black/40 backdrop-blur-md border border-yellow-500/20 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={adjustAmount}
                    onChange={e => setAdjustAmount(e.target.value)}
                    placeholder="Points (+/-)"
                    className="flex-1 px-2 py-2 rounded-lg text-xs bg-black/50 border border-gray-700 text-white outline-none focus:border-yellow-400 transition-all"
                  />

                  <input
                    value={adjustReason}
                    onChange={e => setAdjustReason(e.target.value)}
                    placeholder="Reason"
                    className="flex-1 px-2 py-2 rounded-lg text-xs bg-black/50 border border-gray-700 text-white outline-none focus:border-yellow-400 transition-all"
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
                  className="w-full py-2 rounded-xl text-xs font-bold
                  bg-gradient-to-r from-yellow-400 to-orange-500
                  text-black
                  hover:scale-105
                  transition-all duration-300"
                >
                  Apply Balance Change
                </button>
              </div>
            </div>

            <div className="text-xs text-gray-500 mt-3">
              {new Date(u.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}