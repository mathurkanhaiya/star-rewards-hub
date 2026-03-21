import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { submitWithdrawal } from '@/lib/api';

const TIERS = [
  { pts: 5000, ton: 0.08 },
  { pts: 10000, ton: 0.16 },
  { pts: 15000, ton: 0.24 },
  { pts: 20000, ton: 0.32 },
  { pts: 25000, ton: 0.4 },
  { pts: 30000, ton: 0.48 },
];

const REQUIRED_ADS = 5;

function isValidTon(addr: string) {
  return /^UQ[A-Za-z0-9_-]{46,}$/.test(addr);
}

export default function WalletPage() {
  const { user, balance, refreshBalance } = useApp();

  const [adCount, setAdCount] = useState(0);
  const [selectedTier, setSelectedTier] = useState<any>(null);
  const [wallet, setWallet] = useState('');
  const [message, setMessage] = useState('');

  const pts = balance?.points || 0;
  const progress = Math.min((adCount / REQUIRED_ADS) * 100, 100);

  /* ✅ DAILY ADS */
  useEffect(() => {
    if (!user) return;

    const todayUTC = new Date();
    const startOfDay = new Date(Date.UTC(
      todayUTC.getUTCFullYear(),
      todayUTC.getUTCMonth(),
      todayUTC.getUTCDate()
    )).toISOString();

    supabase
      .from('ad_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', startOfDay)
      .then(({ count }) => setAdCount(count || 0));
  }, [user]);

  /* 💰 WITHDRAW */
  async function handleWithdraw() {
    if (!selectedTier) return;

    if (!isValidTon(wallet)) {
      setMessage('Invalid TON wallet ❌');
      return;
    }

    const locked = pts < selectedTier.pts || adCount < REQUIRED_ADS;

    if (locked) {
      setMessage('Requirements not met ❗');
      return;
    }

    const res = await submitWithdrawal(
      user.id,
      'ton',
      selectedTier.pts,
      wallet
    );

    if (res.success) {
      setMessage('✅ Withdrawal successful');
      setSelectedTier(null);
      setWallet('');
      refreshBalance();
    } else {
      setMessage('Failed');
    }
  }

  return (
    <div className="px-4 pb-24 text-white">

      {/* 💰 BALANCE CARD */}
      <div className="mb-6 p-6 rounded-3xl bg-gradient-to-br from-[#111827] to-[#020617] border border-gray-800 shadow-xl">
        <div className="text-sm text-gray-400">Balance</div>
        <div className="text-4xl text-yellow-400 font-bold mt-1 tracking-wide">
          {pts.toLocaleString()}
        </div>
      </div>

      {/* 📊 PROGRESS BAR */}
      <div className="mb-6">
        <div className="text-xs text-gray-400 mb-1">
          Ads Progress ({adCount}/{REQUIRED_ADS})
        </div>

        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 💎 TIERS */}
      <div className="grid grid-cols-2 gap-4">
        {TIERS.map((t, i) => {
          const locked = pts < t.pts || adCount < REQUIRED_ADS;

          return (
            <div
              key={i}
              onClick={() => !locked && setSelectedTier(t)}
              className={`relative p-5 rounded-2xl transition-all duration-300
              ${locked
                ? 'bg-[#0b0f1a] border border-gray-800 opacity-60 cursor-not-allowed'
                : 'bg-gradient-to-br from-[#111827] to-[#1f2937] border border-gray-700 hover:scale-[1.05] cursor-pointer shadow-lg'
              }`}
            >
              {/* GLOW */}
              {!locked && (
                <div className="absolute inset-0 rounded-2xl bg-blue-500/10 blur-xl opacity-0 hover:opacity-100 transition" />
              )}

              {/* LOCK */}
              {locked && (
                <div className="absolute top-2 right-2 text-xs text-gray-400">
                  🔒
                </div>
              )}

              <div className="text-sm text-gray-400">
                {t.pts.toLocaleString()} pts
              </div>

              <div className="text-xl font-bold text-blue-400 mt-1">
                {t.ton} TON
              </div>

              {locked && (
                <div className="text-xs text-red-400 mt-2">
                  {pts < t.pts
                    ? 'Not enough points'
                    : 'Complete ads'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 💳 POPUP */}
      {selectedTier && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">

          <div className="bg-[#0f172a] p-6 rounded-3xl w-[90%] max-w-sm border border-gray-800 shadow-2xl animate-[fadeIn_0.3s]">

            <div className="text-lg font-bold mb-3">
              Withdraw {selectedTier.ton} TON
            </div>

            <input
              value={wallet}
              onChange={e => setWallet(e.target.value)}
              placeholder="Enter TON wallet"
              className="w-full p-3 rounded-xl bg-black border border-gray-700 mb-3 outline-none focus:border-blue-500"
            />

            <div className="text-xs text-gray-400 mb-3">
              Ads: {adCount}/{REQUIRED_ADS}
            </div>

            {message && (
              <div className="text-sm text-red-400 mb-2">
                {message}
              </div>
            )}

            <button
              onClick={handleWithdraw}
              className="w-full py-3 bg-gradient-to-r from-yellow-400 to-yellow-300 text-black rounded-xl font-bold hover:scale-[1.02] transition"
            >
              Confirm Withdraw
            </button>

            <button
              onClick={() => {
                setSelectedTier(null);
                setMessage('');
              }}
              className="w-full mt-3 text-sm text-gray-400"
            >
              Cancel
            </button>

          </div>
        </div>
      )}
    </div>
  );
}