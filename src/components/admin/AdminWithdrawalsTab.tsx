import React from 'react';

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

export default function AdminWithdrawalsTab({ withdrawals, onApprove, onReject }: Props) {
  const statusStyle = (s: string) => ({
    background: s === 'pending' ? 'hsl(45 100% 55% / 0.15)' : s === 'approved' ? 'hsl(140 70% 50% / 0.15)' : 'hsl(0 80% 55% / 0.15)',
    color: s === 'pending' ? 'hsl(45 100% 60%)' : s === 'approved' ? 'hsl(140 70% 55%)' : 'hsl(0 80% 60%)',
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 mb-3">
        {['pending', 'approved', 'rejected'].map(s => {
          const count = withdrawals.filter(w => w.status === s).length;
          return (
            <div key={s} className="p-2 rounded-xl text-center" style={{ ...statusStyle(s), opacity: 0.8 }}>
              <div className="text-lg font-bold">{count}</div>
              <div className="text-xs capitalize">{s}</div>
            </div>
          );
        })}
      </div>
      {withdrawals.map(w => (
        <div key={w.id} className="p-3 rounded-xl glass-card" style={{ border: '1px solid hsl(220 20% 15%)' }}>
          <div className="flex items-start gap-3 mb-2">
            {/* User avatar */}
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden"
              style={{ background: 'linear-gradient(135deg, hsl(190 100% 55% / 0.3), hsl(265 80% 65% / 0.3))' }}>
              {w.users?.photo_url ? (
                <img src={w.users.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                w.users?.first_name?.[0] || '?'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-foreground">
                  {w.users?.first_name || 'User'} {w.users?.username && `@${w.users.username}`}
                </div>
                <span className="text-xs px-2 py-0.5 rounded font-bold capitalize" style={statusStyle(w.status)}>
                  {w.status}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                TG ID: {w.users?.telegram_id || '?'} • {new Date(w.created_at).toLocaleDateString()}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                <span className="font-medium text-foreground">{w.points_spent.toLocaleString()} pts</span>
                {' → '}
                <span className="font-bold" style={{ color: 'hsl(45 100% 60%)' }}>{Number(w.amount).toFixed(2)} {w.method.toUpperCase()}</span>
              </div>
              {w.wallet_address && (
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  Wallet: <span className="font-mono text-foreground">{w.wallet_address}</span>
                </div>
              )}
            </div>
          </div>
          {w.admin_note && (
            <div className="text-xs mb-2 px-2 py-1 rounded" style={{ background: 'hsl(0 80% 55% / 0.1)', color: 'hsl(0 80% 60%)' }}>
              Note: {w.admin_note}
            </div>
          )}
          {w.status === 'pending' && (
            <div className="flex gap-2">
              <button onClick={() => onApprove(w.id)}
                className="flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                style={{ background: 'hsl(140 70% 50% / 0.15)', color: 'hsl(140 70% 55%)' }}>
                ✓ Approve
              </button>
              <button onClick={() => onReject(w.id)}
                className="flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                style={{ background: 'hsl(0 80% 55% / 0.15)', color: 'hsl(0 80% 60%)' }}>
                ✗ Reject
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
