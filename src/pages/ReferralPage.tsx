import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { getReferrals } from '@/lib/api';

/* ===============================
   TELEGRAM HAPTIC
================================ */
function triggerHaptic(type: 'impact' | 'success' = 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;
    if (type === 'success') {
      tg?.HapticFeedback?.notificationOccurred('success');
    } else {
      tg?.HapticFeedback?.impactOccurred('medium');
    }
  }
}

/* ===============================
   TIME AGO
================================ */
function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'Just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
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

export default function ReferralPage() {
  const { user } = useApp();
  const [referrals, setReferrals] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      getReferrals(user.id).then(r => setReferrals(r || []));
    }
  }, [user]);

  const referralLink = user
    ? `https://t.me/Adsrewartsbot/app?startapp=${user.telegram_id}`
    : '';

  function handleCopy() {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      triggerHaptic('success');
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleShare() {
    triggerHaptic();
    const text = `🎮 Join & earn crypto!\n\n🔗 ${referralLink}`;
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`
      );
    } else {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const verified = referrals.filter(r => r.is_verified).length;
  const totalEarned = referrals.reduce((sum, r) => sum + (r.points_earned || 0), 0);

  return (
    <div className="px-4 pb-28 text-white">

      {/* HEADER */}
      <div className="mb-6">
        <h2 className="text-xl font-bold">Referral Program</h2>
        <p className="text-xs text-gray-400">Invite friends & earn together</p>
      </div>

      {/* HERO CARD */}
      <div
        className="rounded-2xl p-5 mb-6"
        style={{
          background: 'linear-gradient(135deg, #111827, #1f2937)',
          border: '1px solid rgba(250,204,21,0.2)',
          boxShadow: '0 0 40px rgba(250,204,21,0.08)'
        }}
      >
        <div className="text-sm text-gray-400 mb-2">Total Earned</div>
        <div className="text-3xl font-bold text-yellow-400">
          <AnimatedNumber value={totalEarned} /> pts
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {verified} verified friends
        </div>
      </div>

      {/* LINK BOX */}
      <div className="rounded-2xl p-4 mb-6 bg-[#111827] border border-yellow-500/20">
        <div className="text-xs text-gray-400 mb-2">Your Referral Link</div>

        <div className="text-xs break-all bg-black/40 p-2 rounded-lg mb-3">
          {referralLink}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 py-3 rounded-xl font-bold transition-all active:scale-95"
            style={{
              background: copied ? '#22c55e20' : '#1f2937',
              border: `1px solid ${copied ? '#22c55e60' : '#374151'}`,
              color: copied ? '#22c55e' : '#e5e7eb',
            }}
          >
            {copied ? '✓ Copied!' : '📋 Copy'}
          </button>

          <button
            onClick={handleShare}
            className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 text-black active:scale-95"
          >
            🚀 Share
          </button>
        </div>
      </div>

      {/* REFERRAL LIST */}
      <div>
        <div className="text-xs uppercase text-gray-500 mb-3 tracking-wider">
          Your Referrals
        </div>

        {referrals.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <div className="text-4xl mb-3">👥</div>
            No referrals yet
          </div>
        ) : (
          <div className="space-y-3">
            {referrals.map(ref => {

              const openChat = () => {
                if (!ref.referred_id) return;

                triggerHaptic();

                if (ref.username) {
                  window.open(`https://t.me/${ref.username}`, '_blank');
                } else {
                  window.open(`tg://user?id=${ref.referred_id}`);
                }
              };

              return (
                <div
                  key={ref.id}
                  onClick={openChat}
                  className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition active:scale-[0.97]"
                  style={{
                    background: 'rgba(17,24,39,0.85)',
                    border: ref.is_verified
                      ? '1px solid rgba(34,197,94,0.3)'
                      : '1px solid rgba(250,204,21,0.3)',
                  }}
                >
                  <div className="flex items-center gap-3">

                    {/* PROFILE PHOTO */}
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center text-sm font-bold">
                      {ref.photo_url ? (
                        <img
                          src={ref.photo_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        ref.referred_id?.toString().slice(0, 1) || '?'
                      )}
                    </div>

                    {/* USER INFO */}
                    <div>
                      <div className="text-sm font-medium">
                        {ref.username || 'Friend'}
                      </div>
                      <div className="text-xs text-gray-500">
                        UID: {ref.referred_id}
                      </div>
                      <div className="text-xs text-gray-500">
                        {timeAgo(ref.created_at)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-yellow-400 font-bold">
                      +{ref.points_earned}
                    </div>

                    <div
                      className="text-xs"
                      style={{
                        color: ref.is_verified
                          ? '#22c55e'
                          : '#facc15',
                      }}
                    >
                      {ref.is_verified ? '✓ verified' : '⏳ pending'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}