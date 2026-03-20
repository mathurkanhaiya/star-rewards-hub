import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { submitWithdrawal } from '@/lib/api';
import { TonConnectButton, useTonWallet } from '@tonconnect/ui-react';

const TIERS = [
  { pts: 5000, ton: 0.05 },
  { pts: 10000, ton: 0.10 },
  { pts: 15000, ton: 0.15 },
  { pts: 20000, ton: 0.20 },
  { pts: 25000, ton: 0.25 },
  { pts: 30000, ton: 0.30 },
];

const REQUIRED_ADS = 40;

export default function WalletPage() {
  const { user, balance, refreshBalance } = useApp();
  const walletData = useTonWallet();

  const [adCount, setAdCount] = useState(0);
  const [selectedTier, setSelectedTier] = useState<any>(null);
  const [message, setMessage] = useState('');

  const pts = balance?.points || 0;
  const walletAddress = walletData?.account?.address || '';

  /* 🔐 AUTO SAVE WALLET */
  useEffect(() => {
    if (!user || !walletAddress) return;

    supabase
      .from('users')
      .update({ ton_wallet: walletAddress })
      .eq('id', user.id);

  }, [walletAddress, user]);

  /* 📊 DAILY ADS */
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

    if (!walletAddress) {
      setMessage('Connect wallet first ❗');
      return;
    }

    if (adCount < REQUIRED_ADS) {
      setMessage(`Watch ${REQUIRED_ADS - adCount} more ads`);
      return;
    }

    if (pts < selectedTier.pts) {
      setMessage('Not enough balance');
      return;
    }

    const res = await submitWithdrawal(
      user.id,
      'ton',
      selectedTier.pts,
      walletAddress
    );

    if (res.success) {
      setMessage('✅ Withdrawal successful');
      setSelectedTier(null);
      refreshBalance();
    } else {
      setMessage('Failed');
    }
  }

  return (
    <div className="px-4 pb-24 text-white">

      {/* 🔗 CONNECT WALLET */}
      <div className="mb-4 flex justify-center">
        <TonConnectButton />
      </div>

      {/* WALLET */}
      {walletAddress && (
        <div className="text-center text-xs text-green-400 mb-4">
          Connected: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
        </div>
      )}

      {/* BALANCE */}
      <div className="mb-5 p-5 rounded-2xl bg-[#0f172a] border">
        <div className="text-sm text-gray-400">Balance</div>
        <div className="text-3xl text-yellow-400 font-bold">
          {pts.toLocaleString()} pts
        </div>
      </div>

      {/* TIERS */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {TIERS.map((t, i) => (
          <div
            key={i}
            onClick={() => setSelectedTier(t)}
            className="p-4 rounded-xl text-center cursor-pointer"
            style={{
              background: '#0f172a',
              border: '1px solid #1e293b',
              opacity: pts < t.pts ? 0.5 : 1,
            }}
          >
            <div className="text-sm">{t.pts} pts</div>
            <div className="text-blue-400 font-bold">{t.ton} TON</div>
          </div>
        ))}
      </div>

      {/* ADS */}
      <div className="p-4 rounded-xl bg-[#0f172a] border mb-5">
        {adCount >= REQUIRED_ADS
          ? '✅ Daily requirement completed'
          : `🔒 Watch ${REQUIRED_ADS - adCount} more ads today`}
      </div>

      {/* POPUP */}
      {selectedTier && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
          <div className="bg-[#0f172a] p-5 rounded-2xl w-[90%] max-w-sm">

            <div className="text-lg font-bold mb-2">
              Withdraw {selectedTier.ton} TON
            </div>

            <div className="text-xs text-gray-400 mb-3">
              Wallet: {walletAddress || 'Not connected'}
            </div>

            {message && (
              <div className="text-red-400 text-sm mb-2">{message}</div>
            )}

            <button
              onClick={handleWithdraw}
              className="w-full py-3 bg-yellow-400 text-black rounded-xl font-bold"
            >
              Confirm Withdraw
            </button>

            <button
              onClick={() => setSelectedTier(null)}
              className="w-full mt-2 text-gray-400 text-sm"
            >
              Cancel
            </button>

          </div>
        </div>
      )}
    </div>
  );
}