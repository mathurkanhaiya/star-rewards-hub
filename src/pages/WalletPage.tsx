import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { submitWithdrawal } from '@/lib/api';

const TIERS = [
  { pts: 5000,  ton: 0.08 },
  { pts: 10000, ton: 0.16 },
  { pts: 15000, ton: 0.24 },
  { pts: 20000, ton: 0.32 },
  { pts: 25000, ton: 0.40 },
  { pts: 30000, ton: 0.48 },
];

const REQUIRED_ADS = 20;

function isValidTon(addr: string) {
  return /^UQ[A-Za-z0-9_-]{46,}$/.test(addr);
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;900&family=Rajdhani:wght@500;600;700&display=swap');

.wp-root {
  font-family: 'Rajdhani', sans-serif;
  padding: 0 16px 112px;
  color: #fff;
  min-height: 100vh;
}

/* ── Header ── */
.wp-header { padding: 4px 0 20px; }
.wp-eyebrow {
  font-family: 'Orbitron', monospace;
  font-size: 9px;
  letter-spacing: 5px;
  color: rgba(255,255,255,0.2);
  text-transform: uppercase;
  margin-bottom: 4px;
}
.wp-title {
  font-family: 'Orbitron', monospace;
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 2px;
  color: #fff;
  line-height: 1;
}
.wp-title span { color: #ffbe00; text-shadow: 0 0 16px rgba(255,190,0,0.4); }

/* ── Balance card ── */
.wp-balance {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,190,0,0.15);
  border-radius: 22px;
  padding: 22px 20px;
  margin-bottom: 12px;
  position: relative;
  overflow: hidden;
  text-align: center;
}
.wp-balance::before {
  content: '';
  position: absolute;
  top: 0; left: 10%; right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,190,0,0.4), transparent);
}
.wp-balance::after {
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
.wp-balance-inner { position: relative; z-index: 1; }
.wp-bal-label {
  font-family: 'Orbitron', monospace;
  font-size: 9px;
  letter-spacing: 4px;
  color: rgba(255,255,255,0.2);
  text-transform: uppercase;
  margin-bottom: 6px;
}
.wp-bal-val {
  font-family: 'Orbitron', monospace;
  font-size: 48px;
  font-weight: 900;
  line-height: 1;
  color: #ffbe00;
  text-shadow: 0 0 30px rgba(255,190,0,0.4), 0 0 60px rgba(255,190,0,0.15);
  letter-spacing: 2px;
  margin-bottom: 4px;
}
.wp-bal-sub {
  font-size: 11px;
  color: rgba(255,255,255,0.2);
  letter-spacing: 2px;
}

/* ── Ads progress ── */
.wp-ads-card {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(34,211,238,0.12);
  border-radius: 18px;
  padding: 16px 18px;
  margin-bottom: 14px;
  position: relative;
  overflow: hidden;
}
.wp-ads-card::before {
  content: '';
  position: absolute;
  top: 0; left: 10%; right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(34,211,238,0.3), transparent);
}
.wp-ads-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.wp-ads-label {
  font-family: 'Orbitron', monospace;
  font-size: 9px;
  letter-spacing: 3px;
  color: rgba(255,255,255,0.2);
  text-transform: uppercase;
}
.wp-ads-count {
  font-family: 'Orbitron', monospace;
  font-size: 13px;
  font-weight: 700;
  color: #22d3ee;
  letter-spacing: 1px;
}
.wp-progress-track {
  height: 6px;
  border-radius: 3px;
  background: rgba(255,255,255,0.06);
  overflow: hidden;
  margin-bottom: 8px;
}
.wp-progress-fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #22d3ee, #06b6d4);
  transition: width 0.6s cubic-bezier(0.34,1.56,0.64,1);
  box-shadow: 0 0 8px rgba(34,211,238,0.5);
}
.wp-ads-msg {
  font-size: 11px;
  color: rgba(255,255,255,0.2);
  letter-spacing: 1px;
}
.wp-ads-msg.done { color: #4ade80; }

/* ── Section label ── */
.wp-section-label {
  font-family: 'Orbitron', monospace;
  font-size: 9px;
  letter-spacing: 3px;
  color: rgba(255,255,255,0.15);
  text-transform: uppercase;
  margin-bottom: 10px;
  padding-left: 2px;
}

/* ── Tier grid ── */
.wp-tier-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 8px;
}

.wp-tier {
  border-radius: 18px;
  padding: 16px 14px;
  position: relative;
  overflow: hidden;
  transition: transform 0.15s, box-shadow 0.2s;
  cursor: pointer;
}
.wp-tier.locked {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
  cursor: not-allowed;
  opacity: 0.5;
}
.wp-tier.unlocked {
  background: rgba(34,211,238,0.04);
  border: 1px solid rgba(34,211,238,0.2);
}
.wp-tier.unlocked:active { transform: scale(0.96); }
.wp-tier.unlocked::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(34,211,238,0.4), transparent);
}
/* Shine on hover */
.wp-tier.unlocked::after {
  content: '';
  position: absolute;
  top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
  animation: wpShine 4s ease-in-out infinite;
}
@keyframes wpShine { 0%{left:-100%} 40%,100%{left:150%} }

.wp-tier-lock {
  position: absolute;
  top: 10px; right: 10px;
  font-size: 12px;
  opacity: 0.4;
}
.wp-tier-pts {
  font-family: 'Orbitron', monospace;
  font-size: 10px;
  letter-spacing: 1px;
  color: rgba(255,255,255,0.3);
  margin-bottom: 4px;
}
.wp-tier-ton {
  font-family: 'Orbitron', monospace;
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 4px;
}
.wp-tier-ton.locked-val { color: rgba(255,255,255,0.2); }
.wp-tier-reason {
  font-size: 10px;
  color: rgba(239,68,68,0.6);
  letter-spacing: 0.5px;
  margin-top: 4px;
}

/* ── Modal overlay ── */
.wp-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(3,5,10,0.88);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 20px;
  animation: wpFadeIn 0.2s ease;
}
@keyframes wpFadeIn { from{opacity:0} to{opacity:1} }

.wp-modal {
  background: rgba(6,8,15,0.98);
  border: 1px solid rgba(255,190,0,0.2);
  border-radius: 24px;
  width: 100%;
  max-width: 360px;
  padding: 24px;
  position: relative;
  overflow: hidden;
  animation: wpModalUp 0.3s cubic-bezier(0.34,1.2,0.64,1);
}
@keyframes wpModalUp {
  from { transform: translateY(20px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
.wp-modal::before {
  content: '';
  position: absolute;
  top: 0; left: 10%; right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,190,0,0.5), transparent);
}
.wp-modal::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px);
  background-size: 28px 28px;
  pointer-events: none;
  border-radius: 24px;
}
.wp-modal-inner { position: relative; z-index: 1; }

.wp-modal-title {
  font-family: 'Orbitron', monospace;
  font-size: 16px;
  font-weight: 900;
  letter-spacing: 2px;
  color: #fff;
  margin-bottom: 4px;
}
.wp-modal-sub {
  font-size: 12px;
  color: rgba(255,255,255,0.25);
  letter-spacing: 1px;
  margin-bottom: 20px;
}

.wp-modal-ton {
  font-family: 'Orbitron', monospace;
  font-size: 36px;
  font-weight: 900;
  color: #22d3ee;
  letter-spacing: 2px;
  text-shadow: 0 0 24px rgba(34,211,238,0.4);
  text-align: center;
  margin-bottom: 20px;
}

.wp-input-label {
  font-family: 'Orbitron', monospace;
  font-size: 9px;
  letter-spacing: 3px;
  color: rgba(255,255,255,0.2);
  text-transform: uppercase;
  margin-bottom: 6px;
}
.wp-input {
  width: 100%;
  padding: 13px 14px;
  border-radius: 14px;
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(255,255,255,0.08);
  color: #fff;
  font-family: 'Rajdhani', sans-serif;
  font-size: 13px;
  outline: none;
  margin-bottom: 14px;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.wp-input:focus { border-color: rgba(255,190,0,0.4); }
.wp-input::placeholder { color: rgba(255,255,255,0.15); }

.wp-modal-ads {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(34,211,238,0.05);
  border: 1px solid rgba(34,211,238,0.15);
  border-radius: 12px;
  padding: 10px 14px;
  margin-bottom: 16px;
}
.wp-modal-ads-label {
  font-family: 'Orbitron', monospace;
  font-size: 9px;
  letter-spacing: 2px;
  color: rgba(255,255,255,0.25);
  text-transform: uppercase;
}
.wp-modal-ads-val {
  font-family: 'Orbitron', monospace;
  font-size: 13px;
  font-weight: 700;
  color: #22d3ee;
}

.wp-msg {
  font-family: 'Orbitron', monospace;
  font-size: 10px;
  letter-spacing: 2px;
  text-align: center;
  padding: 9px 14px;
  border-radius: 10px;
  margin-bottom: 14px;
  animation: wpFadeIn 0.2s ease;
}
.wp-msg.error {
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.2);
  color: #f87171;
}
.wp-msg.success {
  background: rgba(74,222,128,0.08);
  border: 1px solid rgba(74,222,128,0.2);
  color: #4ade80;
}

.wp-confirm-btn {
  width: 100%;
  padding: 16px;
  border-radius: 14px;
  border: none;
  background: linear-gradient(135deg, #ffbe00, #f59e0b, #d97706);
  color: #1a0800;
  font-family: 'Orbitron', monospace;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 2px;
  cursor: pointer;
  transition: transform 0.12s, box-shadow 0.2s;
  box-shadow: 0 4px 20px rgba(255,190,0,0.3);
  margin-bottom: 10px;
  position: relative;
  overflow: hidden;
}
.wp-confirm-btn::after {
  content: '';
  position: absolute;
  top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  animation: wpShine 3s ease-in-out infinite;
}
.wp-confirm-btn:active { transform: scale(0.97); }

.wp-cancel-btn {
  width: 100%;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.03);
  color: rgba(255,255,255,0.3);
  font-family: 'Orbitron', monospace;
  font-size: 11px;
  letter-spacing: 1px;
  cursor: pointer;
  transition: background 0.15s;
}
.wp-cancel-btn:hover { background: rgba(255,255,255,0.05); }
`;

export default function WalletPage() {
  const { user, balance, refreshBalance } = useApp();
  const [adCount, setAdCount] = useState(0);
  const [selectedTier, setSelectedTier] = useState<typeof TIERS[0] | null>(null);
  const [wallet, setWallet] = useState('');
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState<'error' | 'success'>('error');
  const [submitting, setSubmitting] = useState(false);

  const pts = balance?.points || 0;
  const progress = Math.min((adCount / REQUIRED_ADS) * 100, 100);
  const adsComplete = adCount >= REQUIRED_ADS;

  useEffect(() => {
    if (!user) return;
    const todayUTC = new Date();
    const startOfDay = new Date(Date.UTC(
      todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), todayUTC.getUTCDate()
    )).toISOString();
    supabase
      .from('ad_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', startOfDay)
      .then(({ count }) => setAdCount(count || 0));
  }, [user]);

  async function handleWithdraw() {
    if (!selectedTier || submitting) return;
    if (!isValidTon(wallet)) {
      setMessage('Invalid TON wallet address');
      setMsgType('error');
      return;
    }
    if (pts < selectedTier.pts) {
      setMessage('Not enough points');
      setMsgType('error');
      return;
    }
    if (!adsComplete) {
      setMessage(`Watch ${REQUIRED_ADS - adCount} more ads today`);
      setMsgType('error');
      return;
    }
    setSubmitting(true);
    const res = await submitWithdrawal(user!.id, 'ton', selectedTier.pts, wallet);
    if (res.success) {
      setMessage('Withdrawal submitted!');
      setMsgType('success');
      setWallet('');
      refreshBalance();
      setTimeout(() => {
        setSelectedTier(null);
        setMessage('');
        setSubmitting(false);
      }, 1800);
    } else {
      setMessage(res.message || 'Failed to submit');
      setMsgType('error');
      setSubmitting(false);
    }
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="wp-root">

        {/* ── Header ── */}
        <div className="wp-header">
          <div className="wp-eyebrow">Withdraw · TON</div>
          <div className="wp-title">MY <span>WALLET</span></div>
        </div>

        {/* ── Balance ── */}
        <div className="wp-balance">
          <div className="wp-balance-inner">
            <div className="wp-bal-label">Available Balance</div>
            <div className="wp-bal-val">{pts.toLocaleString()}</div>
            <div className="wp-bal-sub">Points · Ready to withdraw</div>
          </div>
        </div>

        {/* ── Ads progress ── */}
        <div className="wp-ads-card">
          <div className="wp-ads-top">
            <div className="wp-ads-label">Daily Ads Progress</div>
            <div className="wp-ads-count">{adCount} / {REQUIRED_ADS}</div>
          </div>
          <div className="wp-progress-track">
            <div className="wp-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className={`wp-ads-msg ${adsComplete ? 'done' : ''}`}>
            {adsComplete
              ? '✦ Requirement met — withdrawals unlocked'
              : `Watch ${REQUIRED_ADS - adCount} more ads to unlock withdrawals`}
          </div>
        </div>

        {/* ── Tiers ── */}
        <div className="wp-section-label">Select Withdrawal Tier</div>
        <div className="wp-tier-grid">
          {TIERS.map((t, i) => {
            const notEnoughPts = pts < t.pts;
            const locked = notEnoughPts || !adsComplete;
            return (
              <div
                key={i}
                className={`wp-tier ${locked ? 'locked' : 'unlocked'}`}
                onClick={() => !locked && setSelectedTier(t)}
              >
                {locked && <div className="wp-tier-lock">🔒</div>}
                <div className="wp-tier-pts">{t.pts.toLocaleString()} pts</div>
                <div className={`wp-tier-ton ${locked ? 'locked-val' : ''}`}
                  style={!locked ? { color: '#22d3ee', textShadow: '0 0 16px rgba(34,211,238,0.4)' } : {}}>
                  {t.ton} TON
                </div>
                {locked && (
                  <div className="wp-tier-reason">
                    {notEnoughPts ? 'Need more points' : 'Complete daily ads'}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Modal ── */}
        {selectedTier && (
          <div className="wp-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setSelectedTier(null); setMessage(''); } }}>
            <div className="wp-modal">
              <div className="wp-modal-inner">
                <div className="wp-modal-title">Withdraw TON</div>
                <div className="wp-modal-sub">{selectedTier.pts.toLocaleString()} pts → {selectedTier.ton} TON</div>

                <div className="wp-modal-ton">{selectedTier.ton} TON</div>

                <div className="wp-input-label">TON Wallet Address</div>
                <input
                  className="wp-input"
                  value={wallet}
                  onChange={e => setWallet(e.target.value)}
                  placeholder="UQ..."
                  autoComplete="off"
                  spellCheck={false}
                />

                <div className="wp-modal-ads">
                  <div className="wp-modal-ads-label">Daily Ads</div>
                  <div className="wp-modal-ads-val">{adCount} / {REQUIRED_ADS} {adsComplete ? '✓' : ''}</div>
                </div>

                {message && (
                  <div className={`wp-msg ${msgType}`}>{message}</div>
                )}

                <button className="wp-confirm-btn" onClick={handleWithdraw} disabled={submitting}>
                  {submitting ? '···' : 'CONFIRM WITHDRAW'}
                </button>
                <button className="wp-cancel-btn" onClick={() => { setSelectedTier(null); setMessage(''); }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
