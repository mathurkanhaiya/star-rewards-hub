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
  message: string;
}

export default function AdminUsersTab({ users, onBan, onAdjustBalance }: Props) {
  const [adjustUserId, setAdjustUserId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // 🔥 Optimized Search
  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return users;

    return users.filter(u => {
      return (
        u.first_name?.toLowerCase().includes(query) ||
        u.username?.toLowerCase().includes(query) ||
        String(u.telegram_id).includes(query) ||
        u.id.toLowerCase().includes(query)
      );
    });
  }, [users, searchQuery]);

  return (
    <div className="space-y-3">
      <input
        placeholder="🔍 Search by name, username, telegram ID or UID..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
        style={{
          background: 'hsl(220 25% 8%)',
          border: '1px solid hsl(220 20% 20%)',
          color: 'hsl(210 40% 95%)'
        }}
      />

      <div className="text-xs text-muted-foreground">
        Showing {filtered.length} of {users.length} users
      </div>

      {filtered.map(u => (
        <div
          key={u.id}
          className="p-3 rounded-xl glass-card"
          style={{ border: '1px solid hsl(220 20% 15%)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                style={{
                  background:
                    'linear-gradient(135deg, hsl(190 100% 55% / 0.3), hsl(265 80% 65% / 0.3))'
                }}
              >
                {u.first_name?.[0] || '?'}
              </div>

              <div>
                <div className="text-sm font-medium text-foreground">
                  {u.first_name || 'Anonymous'}{' '}
                  {u.username && `@${u.username}`}
                </div>

                <div className="text-xs text-muted-foreground">
                  UID: {u.id} • TG: {u.telegram_id} • Lv{u.level} •{' '}
                  {u.total_points.toLocaleString()} pts
                  {u.balances?.[0] && (
                    <> • Bal: {u.balances[0].points.toLocaleString()}</>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() =>
                  setAdjustUserId(adjustUserId === u.id ? null : u.id)
                }
                className="px-2 py-1 rounded-lg text-xs font-bold"
                style={{
                  background: 'hsl(45 100% 55% / 0.15)',
                  color: 'hsl(45 100% 60%)'
                }}
              >
                💰
              </button>

              <button
                onClick={() => onBan(u.id, !u.is_banned)}
                className="px-2 py-1 rounded-lg text-xs font-bold"
                style={{
                  background: u.is_banned
                    ? 'hsl(140 70% 50% / 0.15)'
                    : 'hsl(0 80% 55% / 0.15)',
                  color: u.is_banned
                    ? 'hsl(140 70% 55%)'
                    : 'hsl(0 80% 60%)'
                }}
              >
                {u.is_banned ? 'Unban' : 'Ban'}
              </button>
            </div>
          </div>

          {adjustUserId === u.id && (
            <div
              className="mt-2 p-2 rounded-lg space-y-2"
              style={{
                background: 'hsl(220 25% 6%)',
                border: '1px solid hsl(45 100% 55% / 0.2)'
              }}
            >
              <div className="flex gap-2">
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={e => setAdjustAmount(e.target.value)}
                  placeholder="Points (+/-)"
                  className="flex-1 px-2 py-1.5 rounded-lg text-xs outline-none"
                  style={{
                    background: 'hsl(220 25% 5%)',
                    border: '1px solid hsl(220 20% 20%)',
                    color: 'hsl(210 40% 95%)'
                  }}
                />

                <input
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  placeholder="Reason"
                  className="flex-1 px-2 py-1.5 rounded-lg text-xs outline-none"
                  style={{
                    background: 'hsl(220 25% 5%)',
                    border: '1px solid hsl(220 20% 20%)',
                    color: 'hsl(210 40% 95%)'
                  }}
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
                className="w-full py-1.5 rounded-lg text-xs font-bold"
                style={{
                  background: 'hsl(45 100% 55% / 0.2)',
                  color: 'hsl(45 100% 60%)'
                }}
              >
                Apply Balance Change
              </button>
            </div>
          )}

          <div className="text-xs text-muted-foreground mt-1">
            {new Date(u.created_at).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
}