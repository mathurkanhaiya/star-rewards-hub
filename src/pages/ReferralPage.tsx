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

  /* ===============================
     BANNER AD REF
  =================================*/
  const bannerAdRef = useRef<HTMLDivElement | null>(null);

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
          border: '1px solid rgba(250,204,21,0.2)'
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

      {/* STATS */}
      <div className="grid grid-cols-3 gap-3 mb-6">

        <div className="rounded-xl p-3 text-center bg-cyan-500/10 border border-cyan-500/30">
          <div className="text-lg font-bold text-cyan-400">
            <AnimatedNumber value={referrals.length} />
          </div>
          <div className="text-xs text-gray-400">Invited</div>
        </div>

        <div className="rounded-xl p-3 text-center bg-green-500/10 border border-green-500/30">
          <div className="text-lg font-bold text-green-400">
            <AnimatedNumber value={verified} />
          </div>
          <div className="text-xs text-gray-400">Verified</div>
        </div>

        <div className="rounded-xl p-3 text-center bg-yellow-500/10 border border-yellow-500/30">
          <div className="text-lg font-bold text-yellow-400">
            <AnimatedNumber value={totalEarned} />
          </div>
          <div className="text-xs text-gray-400">Earned</div>
        </div>

      </div>

      {/* LINK BOX */}
      <div className="rounded-2xl p-4 mb-5 bg-[#111827] border border-yellow-500/20">

        <div className="text-xs text-gray-400 mb-2">
          Your Referral Link
        </div>

        <div className="text-xs break-all bg-black/40 p-2 rounded-lg mb-3">
          {referralLink}
        </div>

        <div className="flex gap-2">

          <button
            onClick={handleCopy}
            className="flex-1 py-3 rounded-xl font-bold bg-gray-800"
          >
            {copied ? '✓ Copied!' : '📋 Copy'}
          </button>

          <button
            onClick={handleShare}
            className="flex-1 py-3 rounded-xl font-bold bg-yellow-400 text-black"
          >
            🚀 Share
          </button>

        </div>

      </div>

      {/* 320x50 BANNER */}
      <div
        ref={bannerAdRef}
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "20px"
        }}
      />

      {/* REFERRAL LIST */}
      <div>

        <div className="text-xs uppercase text-gray-500 mb-3">
          Your Referrals
        </div>

        {referrals.length === 0 ? (

          <div className="text-center py-10 text-gray-500">
            No referrals yet
          </div>

        ) : (

          <div className="space-y-3">

            {referrals.map(ref => (

              <div
                key={ref.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[#111827]"
              >

                <div>
                  <div className="text-sm font-medium">
                    Friend #{ref.referred_id?.slice(0,6)}
                  </div>

                  <div className="text-xs text-gray-500">
                    {timeAgo(ref.created_at)}
                  </div>
                </div>

                <div className="text-yellow-400 font-bold">
                  +{ref.points_earned}
                </div>

              </div>

            ))}

          </div>

        )}

      </div>

    </div>
  );
}