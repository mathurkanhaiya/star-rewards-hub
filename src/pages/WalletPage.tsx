import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { submitWithdrawal } from '@/lib/api';

const TIERS = [
  { pts: 5000, ton: 0.05 },
  { pts: 10000, ton: 0.10 },
  { pts: 15000, ton: 0.15 },
  { pts: 20000, ton: 0.20 },
  { pts: 25000, ton: 0.25 },
  { pts: 30000, ton: 0.30 },
];

const REQUIRED_ADS = 40;

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

      {/* 💰 BALANCE */}
      <div className="mb-6 p-6 rounded-2xl bg-gradient-to-br from-[#0f172a] to-[#020617] border border-gray-800 shadow-lg">
        <div className="text-sm text-gray-400">Balance</div>
        <div className="text-4xl text-yellow-400 font-bold mt-1">
          {pts.toLocaleString()}
        </div>
      </div>

      {/* 🎯 REQUIREMENT */}
      <div className="mb-6 text-center text-sm text-gray-400">
        Ads today: {adCount}/{REQUIRED_ADS}
      </div>

      {/* 💎 TIERS */}
      <div className="grid grid-cols-2 gap-4">
        {TIERS.map((t, i) => {
          const locked = pts < t.pts || adCount < REQUIRED_ADS;

          return (
            <div
              key={i}
              onClick={() => !locked && setSelectedTier(t)}
              className={`relative p-5 rounded-2xl transition-all
              ${locked 
                ? 'bg-[#0b0f1a] border border-gray-800 opacity-60 cursor-not-allowed'
                : 'bg-[#111827] border border-gray-700 hover:scale-[1.03] cursor-pointer shadow-md'
              }`}
            >
              {/* 🔒 LOCK ICON */}
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

              {/* REQUIREMENT TEXT */}
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">

          <div className="bg-[#0f172a] p-6 rounded-2xl w-[90%] max-w-sm border border-gray-800 shadow-xl">

            <div className="text-lg font-bold mb-3">
              Withdraw {selectedTier.ton} TON
            </div>

            <input
              value={wallet}
              onChange={e => setWallet(e.target.value)}
              placeholder="Enter TON wallet"
              className="w-full p-3 rounded bg-black border border-gray-700 mb-3 outline-none"
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
              className="w-full py-3 bg-yellow-400 text-black rounded-xl font-bold hover:opacity-90"
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