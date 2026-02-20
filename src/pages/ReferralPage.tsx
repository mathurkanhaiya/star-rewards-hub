import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { getReferrals } from '@/lib/api';

export default function ReferralPage() {
  const { user, balance } = useApp();
  const [referrals, setReferrals] = useState<Array<{ id: string; is_verified: boolean; points_earned: number; created_at: string; referred_id?: string }>>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      getReferrals(user.id).then(r => setReferrals(r as Array<{ id: string; is_verified: boolean; points_earned: number; created_at: string; referred_id?: string }>));
    }
  }, [user]);

  const referralLink = user
    ? `https://t.me/Adsrewartsbot/app?startapp=${user.telegram_id}`
    : '';

  function handleCopy() {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
    });
  }

  function handleShare() {
    const text = `🎮 Join AdsRewards and earn crypto!\n\nComplete tasks, spin the wheel, and withdraw USDT, TON & Stars!\n\n🔗 ${referralLink}`;
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`);
    } else {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const verifiedReferrals = referrals.filter(r => r.is_verified).length;
  const totalEarned = referrals.reduce((sum, r) => sum + (r.points_earned || 0), 0);

  return (
    <div className="px-4 pb-28">
      <div className="mb-4">
        <h2 className="text-lg font-display font-bold text-gold-gradient mb-1">Referral Program</h2>
        <p className="text-xs text-muted-foreground">Invite friends & earn together</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: 'Invited', value: referrals.length, icon: '👥', color: 'hsl(190 100% 55%)' },
          { label: 'Verified', value: verifiedReferrals, icon: '✅', color: 'hsl(140 70% 50%)' },
          { label: 'Earned', value: `${totalEarned}`, icon: '⚡', color: 'hsl(45 100% 55%)' },
        ].map(stat => (
          <div
            key={stat.label}
            className="rounded-xl p-3 text-center"
            style={{
              background: `${stat.color}10`,
              border: `1px solid ${stat.color}25`,
            }}
          >
            <div className="text-xl">{stat.icon}</div>
            <div className="text-base font-bold" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div
        className="rounded-2xl p-4 mb-4"
        style={{
          background: 'linear-gradient(135deg, hsl(140 30% 8%), hsl(220 25% 10%))',
          border: '1px solid hsl(140 50% 20% / 0.4)',
        }}
      >
        <div className="font-bold text-sm text-foreground mb-3">How It Works</div>
        <div className="space-y-2">
          {[
            { step: '1', text: 'Share your unique referral link', icon: '🔗' },
            { step: '2', text: 'Friend joins via your link', icon: '👤' },
            { step: '3', text: 'Both earn bonus points instantly', icon: '⚡' },
            { step: '4', text: 'More friends = more rewards!', icon: '🚀' },
          ].map(item => (
            <div key={item.step} className="flex items-center gap-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: 'hsl(140 70% 50% / 0.2)', color: 'hsl(140 70% 50%)' }}
              >
                {item.step}
              </div>
              <span className="text-xs text-foreground">{item.icon} {item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Referral link */}
      <div
        className="rounded-2xl p-4 mb-4"
        style={{
          background: 'hsl(220 25% 8% / 0.8)',
          border: '1px solid hsl(45 100% 55% / 0.2)',
        }}
      >
        <div className="text-xs text-muted-foreground mb-2 font-medium">Your Referral Link</div>
        <div
          className="text-xs text-foreground p-2 rounded-lg mb-3 break-all"
          style={{ background: 'hsl(220 25% 6%)' }}
        >
          {referralLink || 'Loading...'}
        </div>
        <div className="flex gap-2">
          <button
            className="flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
            onClick={handleCopy}
            style={{
              background: copied ? 'hsl(140 70% 50% / 0.2)' : 'hsl(220 25% 12%)',
              border: `1px solid ${copied ? 'hsl(140 70% 50% / 0.5)' : 'hsl(220 20% 20%)'}`,
              color: copied ? 'hsl(140 70% 55%)' : 'hsl(210 40% 80%)',
            }}
          >
            {copied ? '✓ Copied!' : '📋 Copy'}
          </button>
          <button
            className="flex-1 py-3 rounded-xl text-sm font-bold btn-gold active:scale-95"
            onClick={handleShare}
          >
            📤 Share
          </button>
        </div>
      </div>

      {/* Bonus info */}
      <div
        className="rounded-xl p-3 mb-5 text-center"
        style={{
          background: 'hsl(45 100% 55% / 0.08)',
          border: '1px solid hsl(45 100% 55% / 0.2)',
        }}
      >
        <span className="text-xs text-muted-foreground">You earn </span>
        <span className="text-xs font-bold text-gold">+500 pts</span>
        <span className="text-xs text-muted-foreground"> • Friend gets </span>
        <span className="text-xs font-bold" style={{ color: 'hsl(140 70% 50%)' }}>+200 pts</span>
        <span className="text-xs text-muted-foreground"> per referral</span>
      </div>

      {/* Referral list */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground mb-3 tracking-wider uppercase">Your Referrals</div>
        {referrals.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">👥</div>
            <div className="text-sm text-muted-foreground">No referrals yet</div>
            <div className="text-xs text-muted-foreground mt-1">Share your link to start earning!</div>
          </div>
        ) : (
          <div className="space-y-2">
            {referrals.map(ref => (
              <div
                key={ref.id}
                className="flex items-center justify-between p-3 rounded-xl"
                style={{
                  background: 'hsl(220 25% 8% / 0.6)',
                  border: '1px solid hsl(220 20% 15% / 0.5)',
                }}
              >
                  <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: 'hsl(190 100% 55% / 0.15)', color: 'hsl(190 100% 55%)' }}
                  >
                    F
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      Friend #{ref.referred_id?.slice(0, 6) || '?'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(ref.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold" style={{ color: 'hsl(45 100% 55%)' }}>
                    +{ref.points_earned} pts
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: ref.is_verified ? 'hsl(140 70% 50%)' : 'hsl(45 70% 60%)' }}
                  >
                    {ref.is_verified ? '✓ verified' : '⏳ pending'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
