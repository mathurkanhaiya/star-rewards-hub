import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { getReferrals } from '@/lib/api';

function triggerHaptic(type: 'impact' | 'success' = 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;
    if (type === 'success') tg?.HapticFeedback?.notificationOccurred('success');
    else tg?.HapticFeedback?.impactOccurred('medium');
  }
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'Just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);
  useEffect(() => {
    let start = previous.current;
    const diff = value - start;
    const steps = 30;
    const increment = diff / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      start += increment;
      if (step >= steps) { setDisplay(value); clearInterval(timer); }
      else setDisplay(Math.floor(start));
    }, 20);
    previous.current = value;
    return () => clearInterval(timer);
  }, [value]);
  return <>{display.toLocaleString()}</>;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;900&family=Rajdhani:wght@500;600;700&display=swap');

.rp-root {
  font-family: 'Rajdhani', sans-serif;
  padding: 0 16px 112px;
  color: #fff;
  min-height: 100vh;
}

/* ── Header ── */
.rp-header { padding: 4px 0 20px; }
.rp-eyebrow {
  font-family: 'Orbitron', monospace;
  font-size: 9px;
  letter-spacing: 5px;
  color: rgba(255,255,255,0.2);
  text-transform: uppercase;
  margin-bottom: 4px;
}
.rp-title {
  font-family: 'Orbitron', monospace;
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 2px;
  color: #fff;
  line-height: 1;
}
.rp-title span { color: #4ade80; text-shadow: 0 0 16px rgba(74,222,128,0.4); }

/* ── Hero card ── */
.rp-hero {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(74,222,128,0.15);
  border-radius: 22px;
  padding: 22px 20px;
  margin-bottom: 12px;
  position: relative;
  overflow: hidden;
  text-align: center;
}
.rp-hero::before {
  content: '';
  position: absolute;
  top: 0; left: 10%; right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(74,222,128,0.4), transparent);
}
.rp-hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px);
  background-size: 28px 28px;
  pointer-events: none;
  border-radius: 22px;
}
.rp-hero-inner { position: relative; z-index: 1; }

.rp-hero-icon {
  font-size: 40px;
  margin-bottom: 10px;
  filter: drop-shadow(0 0 16px rgba(74,222,128,0.4));
  animation: rpFloat 3s ease-in-out infinite;
}
@keyframes rpFloat {
  0%,100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
}

.rp-hero-label {
  font-family: 'Orbitron', monospace;
  font-size: 9px;
  letter-spacing: 4px;
  color: rgba(255,255,255,0.2);
  text-transform: uppercase;
  margin-bottom: 6px;
}
.rp-hero-val {
  font-family: 'Orbitron', monospace;
  font-size: 48px;
  font-weight: 900;
  line-height: 1;
  color: #4ade80;
  text-shadow: 0 0 30px rgba(74,222,128,0.4), 0 0 60px rgba(74,222,128,0.15);
  letter-spacing: 2px;
  margin-bottom: 4px;
}
.rp-hero-sub {
  font-size: 12px;
  color: rgba(255,255,255,0.25);
  letter-spacing: 2px;
}

/* ── Stats grid ── */
.rp-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 14px;
}
.rp-stat {
  background: rgba(255,255,255,0.02);
  border-radius: 16px;
  padding: 14px 8px;
  text-align: center;
  position: relative;
  overflow: hidden;
}
.rp-stat::before {
  content: '';
  position: absolute;
  top: 0; left: 15%; right: 15%;
  height: 1px;
}
.rp-stat-val {
  font-family: 'Orbitron', monospace;
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 4px;
}
.rp-stat-lbl {
  font-size: 9px;
  letter-spacing: 2px;
  color: rgba(255,255,255,0.25);
  text-transform: uppercase;
}

/* ── Link card ── */
.rp-link-card {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 20px;
  padding: 18px;
  margin-bottom: 14px;
  position: relative;
  overflow: hidden;
}
.rp-link-card::before {
  content: '';
  position: absolute;
  top: 0; left: 10%; right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,190,0,0.3), transparent);
}
.rp-link-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px);
  background-size: 28px 28px;
  pointer-events: none;
  border-radius: 20px;
}
.rp-link-inner { position: relative; z-index: 1; }

.rp-link-label {
  font-family: 'Orbitron', monospace;
  font-size: 9px;
  letter-spacing: 3px;
  color: rgba(255,255,255,0.2);
  text-transform: uppercase;
  margin-bottom: 10px;
}
.rp-link-box {
  background: rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  padding: 10px 14px;
  font-family: 'Rajdhani', sans-serif;
  font-size: 12px;
  color: rgba(255,255,255,0.35);
  word-break: break-all;
  letter-spacing: 0.3px;
  margin-bottom: 12px;
  line-height: 1.5;
}

.rp-btn-row {
  display: flex;
  gap: 8px;
}
.rp-btn {
  flex: 1;
  padding: 14px;
  border-radius: 14px;
  border: none;
  font-family: 'Orbitron', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  transition: transform 0.12s, box-shadow 0.2s;
  position: relative;
  overflow: hidden;
}
.rp-btn::after {
  content: '';
  position: absolute;
  top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  animation: rpShine 3s ease-in-out infinite;
}
@keyframes rpShine { 0%{left:-100%} 40%,100%{left:150%} }
.rp-btn:active { transform: scale(0.96); }

.rp-btn-copy {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6);
}
.rp-btn-copy.copied {
  background: rgba(74,222,128,0.1);
  border-color: rgba(74,222,128,0.3);
  color: #4ade80;
}
.rp-btn-share {
  background: linear-gradient(135deg, #4ade80, #16a34a);
  color: #001a0a;
  box-shadow: 0 4px 20px rgba(74,222,128,0.3);
}

/* ── How it works ── */
.rp-how {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 20px;
  padding: 16px 18px;
  margin-bottom: 14px;
}
.rp-how-title {
  font-family: 'Orbitron', monospace;
  font-size: 9px;
  letter-spacing: 3px;
  color: rgba(255,255,255,0.2);
  text-transform: uppercase;
  margin-bottom: 14px;
}
.rp-how-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}
.rp-how-step:last-child { margin-bottom: 0; }
.rp-how-num {
  width: 28px; height: 28px;
  border-radius: 8px;
  background: rgba(74,222,128,0.1);
  border: 1px solid rgba(74,222,128,0.25);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Orbitron', monospace;
  font-size: 11px;
  font-weight: 700;
  color: #4ade80;
  flex-shrink: 0;
}
.rp-how-text { flex: 1; }
.rp-how-main { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.8); }
.rp-how-sub { font-size: 11px; color: rgba(255,255,255,0.25); letter-spacing: 0.5px; margin-top: 1px; }

/* ── Referral list ── */
.rp-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.rp-list-title {
  font-family: 'Orbitron', monospace;
  font-size: 9px;
  letter-spacing: 3px;
  color: rgba(255,255,255,0.2);
  text-transform: uppercase;
}
.rp-list-count {
  font-family: 'Orbitron', monospace;
  font-size: 9px;
  letter-spacing: 1px;
  color: rgba(74,222,128,0.5);
}

.rp-empty {
  text-align: center;
  padding: 40px 0;
  font-family: 'Orbitron', monospace;
  font-size: 9px;
  letter-spacing: 4px;
  color: rgba(255,255,255,0.1);
  text-transform: uppercase;
}

.rp-ref-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 14px;
  padding: 12px 14px;
  margin-bottom: 8px;
  transition: border-color 0.2s;
}
.rp-ref-avatar {
  width: 38px; height: 38px;
  border-radius: 50%;
  background: rgba(74,222,128,0.1);
  border: 1px solid rgba(74,222,128,0.2);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Orbitron', monospace;
  font-size: 12px;
  font-weight: 700;
  color: #4ade80;
  flex-shrink: 0;
}
.rp-ref-body { flex: 1; min-width: 0; }
.rp-ref-name { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.8); }
.rp-ref-time { font-size: 10px; color: rgba(255,255,255,0.2); letter-spacing: 1px; margin-top: 1px; }
.rp-ref-pts {
  font-family: 'Orbitron', monospace;
  font-size: 14px;
  font-weight: 700;
  color: #4ade80;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}
.rp-ref-badge {
  display: inline-block;
  font-size: 8px;
  letter-spacing: 1.5px;
  font-family: 'Orbitron', monospace;
  padding: 2px 6px;
  border-radius: 6px;
  margin-left: 6px;
  vertical-align: middle;
}
`;

export default function ReferralPage() {
  const { user } = useApp();
  const [referrals, setReferrals] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) getReferrals(user.id).then(r => setReferrals(r || []));
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
    if ((window as any).Telegram?.WebApp) {
      (window as any).Telegram.WebApp.openTelegramLink(
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
    <>
      <style>{CSS}</style>
      <div className="rp-root">

        {/* ── Header ── */}
        <div className="rp-header">
          <div className="rp-eyebrow">Invite · Earn</div>
          <div className="rp-title">REFER <span>FRIENDS</span></div>
        </div>

        {/* ── Hero ── */}
        <div className="rp-hero">
          <div className="rp-hero-inner">
            <div className="rp-hero-icon">👥</div>
            <div className="rp-hero-label">Total Earned</div>
            <div className="rp-hero-val">
              <AnimatedNumber value={totalEarned} />
            </div>
            <div className="rp-hero-sub">{verified} verified friend{verified !== 1 ? 's' : ''}</div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="rp-stats">
          {[
            { val: referrals.length, label: 'Invited',  color: '#22d3ee' },
            { val: verified,          label: 'Verified', color: '#4ade80' },
            { val: totalEarned,       label: 'Pts Earned', color: '#ffbe00' },
          ].map((s, i) => (
            <div
              key={i}
              className="rp-stat"
              style={{
                border: `1px solid ${s.color}20`,
                boxShadow: `0 0 16px ${s.color}08`,
              }}
            >
              <div
                className="rp-stat"
                style={{
                  position: 'absolute', top: 0, left: '15%', right: '15%',
                  height: '1px', background: `linear-gradient(90deg, transparent, ${s.color}35, transparent)`,
                  padding: 0, margin: 0, border: 'none',
                }}
              />
              <div className="rp-stat-val" style={{ color: s.color }}>
                <AnimatedNumber value={s.val} />
              </div>
              <div className="rp-stat-lbl">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Referral link ── */}
        <div className="rp-link-card">
          <div className="rp-link-inner">
            <div className="rp-link-label">Your Referral Link</div>
            <div className="rp-link-box">{referralLink || '—'}</div>
            <div className="rp-btn-row">
              <button
                className={`rp-btn rp-btn-copy ${copied ? 'copied' : ''}`}
                onClick={handleCopy}
              >
                {copied ? '✓ COPIED' : '📋 COPY'}
              </button>
              <button className="rp-btn rp-btn-share" onClick={handleShare}>
                🚀 SHARE
              </button>
            </div>
          </div>
        </div>

        {/* ── How it works ── */}
        <div className="rp-how">
          <div className="rp-how-title">How It Works</div>
          {[
            { step: '1', main: 'Share your link', sub: 'Send to friends via Telegram or copy link' },
            { step: '2', main: 'Friend joins',    sub: 'They open the app using your referral' },
            { step: '3', main: 'Both earn',       sub: 'You receive bonus points instantly' },
          ].map((s) => (
            <div key={s.step} className="rp-how-step">
              <div className="rp-how-num">{s.step}</div>
              <div className="rp-how-text">
                <div className="rp-how-main">{s.main}</div>
                <div className="rp-how-sub">{s.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Referral list ── */}
        <div className="rp-list-header">
          <div className="rp-list-title">Your Referrals</div>
          {referrals.length > 0 && (
            <div className="rp-list-count">{referrals.length} total</div>
          )}
        </div>

        {referrals.length === 0 ? (
          <div className="rp-empty">✦ No referrals yet ✦</div>
        ) : (
          <div>
            {referrals.map((ref, i) => (
              <div key={ref.id} className="rp-ref-row">
                <div className="rp-ref-avatar">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div className="rp-ref-body">
                  <div className="rp-ref-name">
                    Friend #{ref.referred_id?.slice(0, 6)}
                    {ref.is_verified && (
                      <span
                        className="rp-ref-badge"
                        style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80' }}
                      >
                        VERIFIED
                      </span>
                    )}
                  </div>
                  <div className="rp-ref-time">{timeAgo(ref.created_at)}</div>
                </div>
                <div className="rp-ref-pts">+{ref.points_earned}</div>
              </div>
            ))}
          </div>
        )}

      </div>
    </>
  );
}
