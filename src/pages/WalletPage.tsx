import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { submitWithdrawal, getWithdrawals } from '@/lib/api';
import { Withdrawal } from '@/types/telegram';
import { supabase } from '@/integrations/supabase/client';

function triggerHaptic(type: 'impact' | 'success' | 'error' = 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;
    if (type === 'success') tg?.HapticFeedback?.notificationOccurred('success');
    else if (type === 'error') tg?.HapticFeedback?.notificationOccurred('error');
    else tg?.HapticFeedback?.impactOccurred('medium');
  }
}

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

const METHODS = [
  {
    id: 'ton',
    label: 'TON',
    icon: 'https://resources.cryptocompare.com/asset-management/813/1671195834071.png',
    color: '#3b82f6',
    rateKey: 'ton_conversion_rate'
  },
];

const REQUIRED_ADS = 40;

export default function WalletPage() {
  const { user, balance, settings, refreshBalance } = useApp();

  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [points, setPoints] = useState('');
  const [wallet, setWallet] = useState('');
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<'withdraw' | 'history'>('withdraw');
  const [adCount, setAdCount] = useState<number>(0);
  const [adCountLoading, setAdCountLoading] = useState(true);

  const bannerAdRef = useRef<HTMLDivElement | null>(null);

  const availablePoints = balance?.points || 0;
  const minPoints = parseInt(settings.min_withdrawal_points || '10000');
  const withdrawUnlocked = adCount >= REQUIRED_ADS;

  useEffect(() => {
    if (user) {
      getWithdrawals(user.id).then(w => setWithdrawals(w));

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
        .then(({ count }) => {
          setAdCount(count || 0);
          setAdCountLoading(false);
        });
    }
  }, [user]);

  /* BANNER LOAD */
  useEffect(() => {
    if (!bannerAdRef.current) return;

    const config = document.createElement("script");
    config.innerHTML = `
      atOptions = {
        'key' : '51ed0e5213d1e44096de5736dd56a99e',
        'format' : 'iframe',
        'height' : 50,
        'width' : 320,
        'params' : {}
      };
    `;

    const script = document.createElement("script");
    script.src = "https://www.highperformanceformat.com/51ed0e5213d1e44096de5736dd56a99e/invoke.js";
    script.async = true;

    bannerAdRef.current.appendChild(config);
    bannerAdRef.current.appendChild(script);
  }, []);

  function getConvertedAmount(pts: number, method: string) {
    const m = METHODS.find(m => m.id === method);
    if (!m) return 0;
    const rate = parseInt(settings[m.rateKey] || '1000');
    return (pts / rate).toFixed(method === 'ton' ? 3 : 2);
  }

  async function handleWithdraw() {
    if (!user || !selectedMethod) return;

    if (!withdrawUnlocked) {
      triggerHaptic('error');
      setMessage(`Watch ${REQUIRED_ADS - adCount} more ads to unlock withdrawals`);
      return;
    }

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

  const adProgress = Math.min(adCount / REQUIRED_ADS, 1);

  return (
    <div className="px-4 pb-28 text-white">

      {/* HEADER */}
      <div className="mb-6">
        <h2 className="text-xl font-bold">Wallet</h2>
        <p className="text-xs text-gray-400">Withdraw your earnings</p>
      </div>

      {/* BALANCE CARD */}
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

      {/* BANNER */}
      <div
        ref={bannerAdRef}
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "16px"
        }}
      />

      {/* AD REQUIREMENT PROGRESS */}
      <div
        className="rounded-2xl p-4 mb-5"
        style={{
          background: withdrawUnlocked ? 'rgba(34,197,94,0.08)' : 'rgba(250,204,21,0.08)',
          border: `1px solid ${withdrawUnlocked ? 'rgba(34,197,94,0.3)' : 'rgba(250,204,21,0.3)'}`,
        }}
      >
        ...
      </div>

    </div>
  );
}