import React from 'react';
import { useApp } from '@/context/AppContext';

function triggerHaptic(type: 'impact' | 'success' = 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;
    if (type === 'success') tg?.HapticFeedback?.notificationOccurred('success');
    else tg?.HapticFeedback?.impactOccurred('light');
  }
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; glow: string; label: string }> = {
  info:       { icon: '📢', color: '#22d3ee', glow: 'rgba(34,211,238,0.4)',   label: 'Info'       },
  reward:     { icon: '🎁', color: '#ffbe00', glow: 'rgba(255,190,0,0.4)',    label: 'Reward'     },
  withdrawal: { icon: '💸', color: '#4ade80', glow: 'rgba(74,222,128,0.4)',   label: 'Withdrawal' },
  referral:   { icon: '👥', color: '#a78bfa', glow: 'rgba(167,139,250,0.4)',  label: 'Referral'   },
};

const DEFAULT_TYPE = { icon: '🔔', color: '#94a3b8', glow: 'rgba(148,163,184,0.3)', label: 'Notice' };

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'Just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;900&family=Rajdhani:wght@500;600;700&display=swap');

.np-root {
  font-family: 'Rajdhani', sans-serif;
  padding: 0 16px 112px;
  color: #fff;
  min-height: 100vh;
}

/* ── Header ── */
.np-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 4px 0 20px;
}
.np-eyebrow {
  font-family: 'Orbitron', monospace;
  font-size: 9px;
  letter-spacing: 5px;
  color: rgba(255,255,255,0.2);
  text-transform: uppercase;
  margin-bottom: 4px;
}
.np-title {
  font-family: 'Orbitron', monospace;
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 2px;
  color: #fff;
  line-height: 1;
}
.np-title span { color: #22d3ee; text-shadow: 0 0 16px rgba(34,211,238,0.4); }

.np-unread-badge {
  margin-top: 4px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 20px;
  background: rgba(255,190,0,0.08);
  border: 1px solid rgba(255,190,0,0.25);
  font-family: 'Orbitron', monospace;
  font-size: 10px;
  font-weight: 700;
  color: #ffbe00;
  letter-spacing: 1px;
  animation: npPulse 2s ease-in-out infinite;
}
@keyframes npPulse {
  0%,100% { box-shadow: 0 0 0 rgba(255,190,0,0); }
  50%      { box-shadow: 0 0 12px rgba(255,190,0,0.2); }
}

/* ── Empty state ── */
.np-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  text-align: center;
}
.np-empty-icon {
  font-size: 52px;
  margin-bottom: 16px;
  animation: npFloat 3s ease-in-out infinite;
  filter: drop-shadow(0 0 16px rgba(34,211,238,0.3));
}
@keyframes npFloat {
  0%,100% { transform: translateY(0); }
  50%      { transform: translateY(-8px); }
}
.np-empty-title {
  font-family: 'Orbitron', monospace;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 2px;
  color: rgba(255,255,255,0.4);
  margin-bottom: 6px;
}
.np-empty-sub {
  font-size: 12px;
  color: rgba(255,255,255,0.15);
  letter-spacing: 1px;
}

/* ── Notification card ── */
.np-card {
  width: 100%;
  text-align: left;
  border-radius: 18px;
  padding: 14px 16px;
  margin-bottom: 8px;
  display: block;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: transform 0.12s, box-shadow 0.2s;
  border: none;
}
.np-card:active { transform: scale(0.98); }

/* Unread top beam */
.np-card-beam {
  position: absolute;
  top: 0; left: 10%; right: 10%;
  height: 1px;
  pointer-events: none;
}

/* Grid texture */
.np-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.01) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.01) 1px, transparent 1px);
  background-size: 28px 28px;
  pointer-events: none;
  border-radius: 18px;
}

.np-card-inner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  position: relative;
  z-index: 1;
}

/* Icon tile */
.np-icon-tile {
  width: 44px; height: 44px;
  border-radius: 13px;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

/* Content */
.np-card-body { flex: 1; min-width: 0; }

.np-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.np-card-title {
  font-family: 'Rajdhani', sans-serif;
  font-size: 15px;
  font-weight: 700;
  color: rgba(255,255,255,0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}
.np-card-title.read { color: rgba(255,255,255,0.45); }

.np-type-tag {
  font-family: 'Orbitron', monospace;
  font-size: 7px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 6px;
  flex-shrink: 0;
}

.np-card-msg {
  font-size: 12px;
  color: rgba(255,255,255,0.35);
  line-height: 1.5;
  margin-bottom: 8px;
}
.np-card-msg.unread { color: rgba(255,255,255,0.6); }

.np-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.np-time {
  font-family: 'Orbitron', monospace;
  font-size: 8px;
  letter-spacing: 1.5px;
  color: rgba(255,255,255,0.15);
}

.np-unread-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  animation: npDotPulse 2s ease-in-out infinite;
}
@keyframes npDotPulse {
  0%,100% { transform: scale(1);   opacity: 1;   }
  50%      { transform: scale(1.4); opacity: 0.7; }
}

/* Read indicator */
.np-read-check {
  font-size: 10px;
  color: rgba(255,255,255,0.12);
}

/* Section divider */
.np-divider {
  font-family: 'Orbitron', monospace;
  font-size: 8px;
  letter-spacing: 3px;
  color: rgba(255,255,255,0.1);
  text-transform: uppercase;
  margin: 14px 0 8px 2px;
}
`;

export default function NotificationsPage() {
  const { notifications, markRead } = useApp();

  const unread = notifications.filter(n => !n.is_read);
  const read   = notifications.filter(n =>  n.is_read);

  function renderCard(n: any) {
    const tc = TYPE_CONFIG[n.type] || DEFAULT_TYPE;
    return (
      <button
        key={n.id}
        className="np-card"
        onClick={() => {
          triggerHaptic();
          if (!n.is_read) {
            markRead(n.id);
            triggerHaptic('success');
          }
        }}
        style={{
          background: n.is_read
            ? 'rgba(255,255,255,0.02)'
            : `rgba(${hexToRgb(tc.color)}, 0.05)`,
          border: `1px solid ${n.is_read ? 'rgba(255,255,255,0.05)' : `${tc.color}35`}`,
          boxShadow: n.is_read ? 'none' : `0 0 20px ${tc.glow}10`,
        }}
      >
        {/* Top beam (unread only) */}
        {!n.is_read && (
          <div
            className="np-card-beam"
            style={{ background: `linear-gradient(90deg, transparent, ${tc.color}40, transparent)` }}
          />
        )}

        <div className="np-card-inner">
          {/* Icon tile */}
          <div
            className="np-icon-tile"
            style={{
              background: `${tc.color}${n.is_read ? '08' : '12'}`,
              border: `1px solid ${tc.color}${n.is_read ? '15' : '30'}`,
              filter: n.is_read ? 'grayscale(0.4)' : `drop-shadow(0 0 6px ${tc.glow})`,
            }}
          >
            {tc.icon}
          </div>

          <div className="np-card-body">
            <div className="np-card-top">
              <div className={`np-card-title ${n.is_read ? 'read' : ''}`}>{n.title}</div>
              <div
                className="np-type-tag"
                style={{
                  background: `${tc.color}10`,
                  border: `1px solid ${tc.color}25`,
                  color: n.is_read ? 'rgba(255,255,255,0.2)' : tc.color,
                }}
              >
                {tc.label}
              </div>
            </div>

            <div className={`np-card-msg ${n.is_read ? '' : 'unread'}`}>{n.message}</div>

            <div className="np-card-footer">
              <div className="np-time">{timeAgo(n.created_at)}</div>
              {!n.is_read ? (
                <div className="np-unread-dot" style={{ background: tc.color, boxShadow: `0 0 6px ${tc.glow}` }} />
              ) : (
                <div className="np-read-check">✓</div>
              )}
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="np-root">

        {/* ── Header ── */}
        <div className="np-header">
          <div>
            <div className="np-eyebrow">Activity · Updates</div>
            <div className="np-title">NOTIFI<span>CATIONS</span></div>
          </div>
          {unread.length > 0 && (
            <div className="np-unread-badge">
              ● {unread.length} NEW
            </div>
          )}
        </div>

        {/* ── Empty ── */}
        {notifications.length === 0 && (
          <div className="np-empty">
            <div className="np-empty-icon">🔔</div>
            <div className="np-empty-title">All Caught Up</div>
            <div className="np-empty-sub">No notifications yet</div>
          </div>
        )}

        {/* ── Unread section ── */}
        {unread.length > 0 && (
          <>
            <div className="np-divider">✦ Unread · {unread.length}</div>
            {unread.map(renderCard)}
          </>
        )}

        {/* ── Read section ── */}
        {read.length > 0 && (
          <>
            <div className="np-divider">Earlier</div>
            {read.map(renderCard)}
          </>
        )}

      </div>
    </>
  );
}

/* hex → "r,g,b" for rgba() */
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}
