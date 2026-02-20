import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { submitWithdrawal, getWithdrawals } from '@/lib/api';
import { Withdrawal } from '@/types/telegram';

const METHODS = [
  { id: 'stars', label: 'Telegram Stars', icon: '⭐', color: 'hsl(190 100% 55%)', rateKey: 'stars_conversion_rate' },
  { id: 'usdt', label: 'USDT', icon: '💵', color: 'hsl(140 70% 50%)', rateKey: 'usdt_conversion_rate' },
  { id: 'ton', label: 'TON', icon: '💎', color: 'hsl(210 100% 60%)', rateKey: 'ton_conversion_rate' },
];

export default function WalletPage() {
  const { user, balance, settings, refreshBalance } = useApp();
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [points, setPoints] = useState('');
  const [wallet, setWallet] = useState('');
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<'withdraw' | 'history'>('withdraw');

  useEffect(() => {
    if (user) {
      getWithdrawals(user.id).then(w => setWithdrawals(w));
    }
  }, [user]);

  const minPoints = parseInt(settings.min_withdrawal_points || '10000');

  function getConvertedAmount(pts: number, method: string) {
    const m = METHODS.find(m => m.id === method);
    if (!m) return 0;
    const rate = parseInt(settings[m.rateKey] || '1000');
    return (pts / rate).toFixed(method === 'ton' ? 3 : 2);
  }

  async function handleWithdraw() {
    if (!user || !selectedMethod) return;
    const pts = parseInt(points);
    if (isNaN(pts) || pts < minPoints) {
      setMessage(`Minimum withdrawal: ${minPoints.toLocaleString()} points`);
      return;
    }
    if (pts > (balance?.points || 0)) {
      setMessage('Insufficient balance');
      return;
    }
    if (selectedMethod !== 'stars' && !wallet.trim()) {
      setMessage('Please enter your wallet address');
      return;
    }

    setSubmitting(true);
    const result = await submitWithdrawal(user.id, selectedMethod, pts, wallet || undefined);
    if (result.success) {
      setMessage('✅ Withdrawal request submitted! Processing in 24-48h.');
      setPoints('');
      setWallet('');
      setSelectedMethod(null);
      await refreshBalance();
      getWithdrawals(user.id).then(w => setWithdrawals(w));
    } else {
      setMessage(result.message || 'Withdrawal failed');
    }
    setSubmitting(false);
    setTimeout(() => setMessage(''), 5000);
  }

  const statusColor: Record<string, string> = {
    pending: 'hsl(45 100% 55%)',
    approved: 'hsl(140 70% 50%)',
    rejected: 'hsl(0 80% 55%)',
    processing: 'hsl(190 100% 55%)',
  };

  return (
    <div className="px-4 pb-28">
      <div className="mb-4">
        <h2 className="text-lg font-display font-bold text-gold-gradient mb-1">Wallet</h2>
        <p className="text-xs text-muted-foreground">Withdraw your earnings</p>
      </div>

      {/* Balance overview */}
      <div
        className="rounded-2xl p-4 mb-4"
        style={{
          background: 'linear-gradient(135deg, hsl(220 30% 10%), hsl(220 25% 8%))',
          border: '1px solid hsl(45 100% 55% / 0.2)',
        }}
      >
        <div className="text-xs text-muted-foreground mb-2">Available Balance</div>
        <div className="text-3xl font-bold text-gold-gradient mb-3">
          {(balance?.points || 0).toLocaleString()} <span className="text-base">pts</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          {METHODS.map(m => (
            <div key={m.id} style={{ color: m.color }}>
              <div className="font-bold">{getConvertedAmount(balance?.points || 0, m.id)}</div>
              <div className="text-muted-foreground">{m.label.split(' ')[0]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: 'hsl(220 25% 8%)' }}>
        {(['withdraw', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all capitalize"
            style={{
              background: tab === t ? 'hsl(45 100% 55%)' : 'transparent',
              color: tab === t ? 'hsl(220 30% 5%)' : 'hsl(220 15% 55%)',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'withdraw' ? (
        <>
          {/* Min requirement */}
          <div
            className="rounded-xl p-3 mb-4 text-xs text-center"
            style={{
              background: 'hsl(45 100% 55% / 0.05)',
              border: '1px solid hsl(45 100% 55% / 0.15)',
              color: 'hsl(220 15% 60%)',
            }}
          >
            Minimum withdrawal: <span className="font-bold text-gold">{minPoints.toLocaleString()} points</span>
          </div>

          {/* Select method */}
          <div className="mb-4">
            <div className="text-xs font-semibold text-muted-foreground mb-2 tracking-wider uppercase">Select Method</div>
            <div className="space-y-2">
              {METHODS.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMethod(m.id)}
                  className="w-full flex items-center justify-between p-3 rounded-xl transition-all"
                  style={{
                    background: selectedMethod === m.id ? `${m.color}15` : 'hsl(220 25% 8%)',
                    border: `1px solid ${selectedMethod === m.id ? `${m.color}50` : 'hsl(220 20% 15%)'}`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{m.icon}</span>
                    <div className="text-left">
                      <div className="text-sm font-semibold" style={{ color: selectedMethod === m.id ? m.color : 'hsl(210 40% 90%)' }}>
                        {m.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Rate: {parseInt(settings[m.rateKey] || '1000').toLocaleString()} pts = 1 {m.id.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  <div
                    className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                    style={{ borderColor: selectedMethod === m.id ? m.color : 'hsl(220 20% 30%)' }}
                  >
                    {selectedMethod === m.id && (
                      <div className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Amount input */}
          {selectedMethod && (
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Points to withdraw</label>
                <input
                  type="number"
                  value={points}
                  onChange={e => setPoints(e.target.value)}
                  placeholder={`Min ${minPoints.toLocaleString()}`}
                  className="w-full px-3 py-3 rounded-xl text-sm font-medium outline-none"
                  style={{
                    background: 'hsl(220 25% 8%)',
                    border: '1px solid hsl(220 20% 20%)',
                    color: 'hsl(210 40% 95%)',
                  }}
                />
                {points && !isNaN(parseInt(points)) && (
                  <div className="text-xs text-muted-foreground mt-1">
                    ≈ {getConvertedAmount(parseInt(points), selectedMethod)} {selectedMethod.toUpperCase()}
                  </div>
                )}
              </div>

              {selectedMethod !== 'stars' && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    {selectedMethod === 'usdt' ? 'USDT Wallet Address' : 'TON Wallet Address'}
                  </label>
                  <input
                    type="text"
                    value={wallet}
                    onChange={e => setWallet(e.target.value)}
                    placeholder="Enter wallet address..."
                    className="w-full px-3 py-3 rounded-xl text-sm font-medium outline-none"
                    style={{
                      background: 'hsl(220 25% 8%)',
                      border: '1px solid hsl(220 20% 20%)',
                      color: 'hsl(210 40% 95%)',
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {message && (
            <div
              className="rounded-xl p-3 mb-4 text-sm text-center font-medium"
              style={{
                background: message.startsWith('✅') ? 'hsl(140 70% 50% / 0.1)' : 'hsl(0 80% 55% / 0.1)',
                border: `1px solid ${message.startsWith('✅') ? 'hsl(140 70% 50% / 0.3)' : 'hsl(0 80% 55% / 0.3)'}`,
                color: message.startsWith('✅') ? 'hsl(140 70% 55%)' : 'hsl(0 80% 60%)',
              }}
            >
              {message}
            </div>
          )}

          <button
            className="btn-gold w-full py-4 rounded-2xl text-sm font-bold"
            onClick={handleWithdraw}
            disabled={submitting || !selectedMethod}
            style={{ opacity: submitting || !selectedMethod ? 0.5 : 1 }}
          >
            {submitting ? '⏳ Processing...' : '💰 Submit Withdrawal'}
          </button>
        </>
      ) : (
        <div className="space-y-2">
          {withdrawals.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">📭</div>
              <div className="text-sm text-muted-foreground">No withdrawals yet</div>
            </div>
          ) : (
            withdrawals.map(w => (
              <div
                key={w.id}
                className="p-3 rounded-xl"
                style={{
                  background: 'hsl(220 25% 8% / 0.6)',
                  border: '1px solid hsl(220 20% 15% / 0.5)',
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span>{METHODS.find(m => m.id === w.method)?.icon || '💰'}</span>
                    <span className="text-sm font-medium text-foreground capitalize">{w.method}</span>
                  </div>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded capitalize"
                    style={{
                      background: `${statusColor[w.status] || 'hsl(220 15% 50%)'}20`,
                      color: statusColor[w.status] || 'hsl(220 15% 50%)',
                    }}
                  >
                    {w.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{w.points_spent.toLocaleString()} pts → {Number(w.amount).toFixed(w.method === 'ton' ? 3 : 2)} {w.method.toUpperCase()}</span>
                  <span>{new Date(w.created_at).toLocaleDateString()}</span>
                </div>
                {w.admin_note && (
                  <div className="mt-1 text-xs" style={{ color: 'hsl(0 80% 60%)' }}>Note: {w.admin_note}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
