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
    if (type === 'success') {
      tg?.HapticFeedback?.notificationOccurred('success');
    } else if (type === 'error') {
      tg?.HapticFeedback?.notificationOccurred('error');
    } else {
      tg?.HapticFeedback?.impactOccurred('medium');
    }
  }
}

/* ===============================
   ANIMATED NUMBER
================================ */
function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);

  useEffect(() => {
    let start = previous.current;
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

    previous.current = value;
    return () => clearInterval(timer);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

export default function WalletPage() {
  const { user, balance, settings, refreshBalance } = useApp();
  const [points, setPoints] = useState('');
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

  async function handleWithdraw() {
    if (!user) return;

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

    triggerHaptic();
    setSubmitting(true);

    const result = await submitWithdrawal(user.id, 'points', pts);

    if (result.success) {
      triggerHaptic('success');
      setMessage('✅ Withdrawal request submitted!');
      setPoints('');
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
        <p className="text-xs text-gray-400">Withdraw your points</p>
      </div>

      {/* 3D BALANCE CARD */}
      <div
        className="rounded-3xl p-6 mb-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, #111827, #1f2937)',
          border: '1px solid rgba(250,204,21,0.25)',
          boxShadow:
            '0 20px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <div className="text-xs text-gray-400 mb-2">Available Balance</div>

        <div className="text-4xl font-bold text-yellow-400 drop-shadow-lg">
          <AnimatedNumber value={availablePoints} /> pts
        </div>

        <div className="text-xs text-gray-500 mt-2">
          Minimum withdrawal: {minPoints.toLocaleString()} pts
        </div>
      </div>

      {/* TABS */}
      <div className="flex bg-[#111827] rounded-xl p-1 mb-5">
        {(['withdraw', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => {
              triggerHaptic();
              setTab(t);
            }}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all capitalize active:scale-95"
            style={{
              background:
                tab === t
                  ? 'linear-gradient(135deg,#facc15,#f97316)'
                  : 'transparent',
              color:
                tab === t ? '#111' : '#9ca3af',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'withdraw' ? (
        <>
          {/* INPUT */}
          <div className="mb-4">
            <label className="text-xs text-gray-400 mb-1 block">
              Points to withdraw
            </label>

            <input
              type="number"
              value={points}
              onChange={e => setPoints(e.target.value)}
              placeholder={`Min ${minPoints}`}
              className="w-full px-4 py-4 rounded-2xl text-sm font-medium outline-none transition"
              style={{
                background: '#111827',
                border: '1px solid #374151',
              }}
            />
          </div>

          {/* MESSAGE */}
          {message && (
            <div
              className="rounded-xl p-3 mb-4 text-sm text-center font-medium animate-pulse"
              style={{
                background: message.startsWith('✅')
                  ? 'rgba(34,197,94,0.1)'
                  : 'rgba(239,68,68,0.1)',
                border: `1px solid ${
                  message.startsWith('✅')
                    ? 'rgba(34,197,94,0.4)'
                    : 'rgba(239,68,68,0.4)'
                }`,
                color: message.startsWith('✅')
                  ? '#22c55e'
                  : '#ef4444',
              }}
            >
              {message}
            </div>
          )}

          {/* BUTTON */}
          <button
            onClick={handleWithdraw}
            disabled={submitting}
            className="w-full py-4 rounded-2xl font-bold text-black transition-all active:scale-95"
            style={{
              background:
                'linear-gradient(135deg,#facc15,#f97316)',
              opacity: submitting ? 0.6 : 1,
              boxShadow:
                '0 10px 25px rgba(250,204,21,0.4)',
            }}
          >
            {submitting ? '⏳ Processing...' : '💰 Withdraw Points'}
          </button>
        </>
      ) : (
        <div className="space-y-3">
          {withdrawals.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              📭 No withdrawals yet
            </div>
          ) : (
            withdrawals.map(w => (
              <div
                key={w.id}
                className="p-4 rounded-2xl transition-all hover:scale-[1.02]"
                style={{
                  background: '#111827',
                  border: '1px solid rgba(255,255,255,0.05)',
                  boxShadow: '0 10px 20px rgba(0,0,0,0.4)',
                }}
              >
                <div className="flex justify-between mb-2">
                  <div className="font-medium">
                    {w.points_spent.toLocaleString()} pts
                  </div>
                  <div
                    className="text-xs font-bold px-2 py-1 rounded capitalize"
                    style={{
                      background: `${statusColor[w.status] || '#999'}20`,
                      color: statusColor[w.status] || '#999',
                    }}
                  >
                    {w.status}
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  {new Date(w.created_at).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}