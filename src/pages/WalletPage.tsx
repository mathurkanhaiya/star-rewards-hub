import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { submitWithdrawal, getWithdrawals } from '@/lib/api';
import { Withdrawal } from '@/types/telegram';

/* ===============================
   TELEGRAM HAPTIC
================================ */
function triggerHaptic(type: 'impact' | 'success' | 'error' = 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;
    if (type === 'success') tg?.HapticFeedback?.notificationOccurred('success');
    else if (type === 'error') tg?.HapticFeedback?.notificationOccurred('error');
    else tg?.HapticFeedback?.impactOccurred('medium');
  }
}

/* ===============================
   ANIMATED NUMBER
================================ */
function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    let start = prev.current;
    const diff = value - start;
    const duration = 600;
    const steps = 30;
    const increment = diff / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      start += increment;
      if (step >= steps) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(start));
      }
    }, duration / steps);

    prev.current = value;
    return () => clearInterval(timer);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

/* ===============================
   METHODS
================================ */
const METHODS = [
  { id: 'stars', label: 'Telegram Stars', icon: '⭐', color: '#22d3ee', rateKey: 'stars_conversion_rate' },
  { id: 'ton', label: 'TON', icon: '💎', color: '#3b82f6', rateKey: 'ton_conversion_rate' },
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

  const availablePoints = balance?.points || 0;
  const minPoints = parseInt(settings.min_withdrawal_points || '10000');

  useEffect(() => {
    if (user) {
      getWithdrawals(user.id).then(w => setWithdrawals(w));
    }
  }, [user]);

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
      triggerHaptic('error');
      setMessage(`Minimum withdrawal: ${minPoints.toLocaleString()} pts`);
      return;
    }

    if (pts > availablePoints) {
      triggerHaptic('error');
      setMessage('Insufficient balance');
      return;
    }

    if (selectedMethod !== 'stars' && !wallet.trim()) {
      triggerHaptic('error');
      setMessage('Enter wallet address');
      return;
    }

    triggerHaptic();
    setSubmitting(true);

    const result = await submitWithdrawal(user.id, selectedMethod, pts, wallet || undefined);

    if (result.success) {
      triggerHaptic('success');
      setMessage('✅ Withdrawal submitted!');
      setPoints('');
      setWallet('');
      setSelectedMethod(null);
      await refreshBalance();
      getWithdrawals(user.id).then(w => setWithdrawals(w));
    } else {
      triggerHaptic('error');
      setMessage(result.message || 'Withdrawal failed');
    }

    setSubmitting(false);
    setTimeout(() => setMessage(''), 4000);
  }

  const statusColor: Record<string, string> = {
    pending: '#facc15',
    approved: '#22c55e',
    rejected: '#ef4444',
    processing: '#38bdf8',
  };

  return (
    <div className="px-4 pb-28 text-white">

      {/* HEADER */}
      <div className="mb-6">
        <h2 className="text-xl font-bold">Wallet</h2>
        <p className="text-xs text-gray-400">Withdraw your earnings</p>
      </div>

      {/* PREMIUM 3D BALANCE CARD */}
      <div
        className="rounded-3xl p-6 mb-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(145deg,#0f172a,#1e293b)',
          border: '1px solid rgba(250,204,21,0.3)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
        }}
      >
        <div className="text-xs text-gray-400 mb-2">Available Balance</div>
        <div className="text-4xl font-bold text-yellow-400 drop-shadow-lg">
          <AnimatedNumber value={availablePoints} /> pts
        </div>
      </div>

      {/* TABS */}
      <div className="flex bg-[#0f172a] rounded-xl p-1 mb-5">
        {(['withdraw', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => {
              triggerHaptic();
              setTab(t);
            }}
            className="flex-1 py-2 rounded-lg text-xs font-bold capitalize active:scale-95 transition-all"
            style={{
              background: tab === t ? 'linear-gradient(135deg,#facc15,#f97316)' : 'transparent',
              color: tab === t ? '#111' : '#94a3b8',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'withdraw' ? (
        <>
          {/* METHODS */}
          <div className="space-y-3 mb-5">
            {METHODS.map(m => (
              <button
                key={m.id}
                onClick={() => {
                  triggerHaptic();
                  setSelectedMethod(m.id);
                }}
                className="w-full flex items-center justify-between p-4 rounded-2xl transition-all active:scale-[0.97]"
                style={{
                  background: selectedMethod === m.id ? `${m.color}15` : '#0f172a',
                  border: `1px solid ${selectedMethod === m.id ? m.color : '#1e293b'}`,
                  boxShadow: selectedMethod === m.id ? `0 0 20px ${m.color}40` : 'none',
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{m.icon}</span>
                  <div className="text-left">
                    <div className="font-semibold">{m.label}</div>
                    <div className="text-xs text-gray-400">
                      {parseInt(settings[m.rateKey] || '1000')} pts = 1 {m.id.toUpperCase()}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* INPUTS */}
          {selectedMethod && (
            <div className="space-y-4 mb-4">
              <input
                type="number"
                value={points}
                onChange={e => setPoints(e.target.value)}
                placeholder={`Min ${minPoints}`}
                className="w-full px-4 py-4 rounded-2xl bg-[#0f172a] border border-[#1e293b] outline-none"
              />

              {points && (
                <div className="text-xs text-gray-400 animate-pulse">
                  ≈ {getConvertedAmount(parseInt(points), selectedMethod)} {selectedMethod.toUpperCase()}
                </div>
              )}

              {selectedMethod !== 'stars' && (
                <input
                  type="text"
                  value={wallet}
                  onChange={e => setWallet(e.target.value)}
                  placeholder="Enter wallet address"
                  className="w-full px-4 py-4 rounded-2xl bg-[#0f172a] border border-[#1e293b] outline-none"
                />
              )}
            </div>
          )}

          {message && (
            <div
              className="rounded-xl p-3 mb-4 text-sm text-center font-medium animate-fadeIn"
              style={{
                background: message.startsWith('✅')
                  ? 'rgba(34,197,94,0.1)'
                  : 'rgba(239,68,68,0.1)',
                border: `1px solid ${
                  message.startsWith('✅')
                    ? 'rgba(34,197,94,0.4)'
                    : 'rgba(239,68,68,0.4)'
                }`,
              }}
            >
              {message}
            </div>
          )}

          <button
            onClick={handleWithdraw}
            disabled={submitting || !selectedMethod}
            className="w-full py-4 rounded-2xl font-bold text-black active:scale-95 transition-all"
            style={{
              background: 'linear-gradient(135deg,#facc15,#f97316)',
              opacity: submitting || !selectedMethod ? 0.6 : 1,
              boxShadow: '0 15px 30px rgba(250,204,21,0.4)',
            }}
          >
            {submitting ? '⏳ Processing...' : '💰 Submit Withdrawal'}
          </button>
        </>
      ) : (
        <div className="space-y-3">
          {withdrawals.map(w => (
            <div
              key={w.id}
              className="p-4 rounded-2xl"
              style={{
                background: '#0f172a',
                border: '1px solid #1e293b',
                boxShadow: '0 10px 20px rgba(0,0,0,0.4)',
              }}
            >
              <div className="flex justify-between mb-1">
                <div className="font-medium">
                  {w.points_spent.toLocaleString()} pts → {Number(w.amount).toFixed(w.method === 'ton' ? 3 : 2)} {w.method.toUpperCase()}
                </div>
                <div
                  className="text-xs font-bold px-2 py-1 rounded capitalize"
                  style={{
                    background: `${statusColor[w.status]}20`,
                    color: statusColor[w.status],
                  }}
                >
                  {w.status}
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {new Date(w.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}