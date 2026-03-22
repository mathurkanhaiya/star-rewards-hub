import React from "react";
import { useApp } from "@/context/AppContext";
import TgEmoji from "@/components/TgEmoji";

function getLevelInfo(level: number) {
  const levels = [
    { name: "Beginner",  color: "#60a5fa", glow: "rgba(96,165,250,0.4)",   min: 1,  max: 2  },
    { name: "Rookie",    color: "#818cf8", glow: "rgba(129,140,248,0.4)",   min: 3,  max: 4  },
    { name: "Iron",      color: "#94a3b8", glow: "rgba(148,163,184,0.4)",   min: 5,  max: 6  },
    { name: "Bronze",    color: "#f97316", glow: "rgba(249,115,22,0.4)",    min: 7,  max: 9  },
    { name: "Silver",    color: "#e2e8f0", glow: "rgba(226,232,240,0.4)",   min: 10, max: 13 },
    { name: "Gold",      color: "#ffbe00", glow: "rgba(255,190,0,0.5)",     min: 14, max: 18 },
    { name: "Platinum",  color: "#22d3ee", glow: "rgba(34,211,238,0.5)",    min: 19, max: 24 },
    { name: "Diamond",   color: "#c084fc", glow: "rgba(192,132,252,0.5)",   min: 25, max: 35 },
    { name: "Master",    color: "#a855f7", glow: "rgba(168,85,247,0.5)",    min: 36, max: 50 },
    { name: "LEGEND",    color: "#ef4444", glow: "rgba(239,68,68,0.5)",     min: 51, max: 99 },
  ];
  return levels.find((l) => level >= l.min && level <= l.max) || levels[0];
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;900&family=Rajdhani:wght@500;600&display=swap');

.hdr-root {
  padding: 14px 16px 10px;
  position: relative;
  overflow: hidden;
}

/* Subtle top beam */
.hdr-root::before {
  content: '';
  position: absolute;
  top: 0; left: 15%; right: 15%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,190,0,0.3), transparent);
  pointer-events: none;
}

/* Grid bg */
.hdr-root::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
  background-size: 28px 28px;
  pointer-events: none;
  z-index: 0;
}

.hdr-inner {
  position: relative;
  z-index: 1;
}

/* ── Row 1: avatar + name + points ── */
.hdr-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

/* Avatar */
.hdr-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}
.hdr-avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Orbitron', monospace;
  font-size: 16px;
  font-weight: 700;
  overflow: hidden;
  position: relative;
  transition: box-shadow 0.3s;
}
.hdr-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}
.hdr-level-badge {
  position: absolute;
  bottom: -3px;
  right: -3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Orbitron', monospace;
  font-size: 8px;
  font-weight: 700;
  color: #000;
  border: 2px solid #06080f;
  line-height: 1;
}

/* Name block */
.hdr-name-block {
  flex: 1;
  margin-left: 10px;
  min-width: 0;
}
.hdr-name {
  font-family: 'Rajdhani', sans-serif;
  font-size: 15px;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}
.hdr-username {
  font-weight: 400;
  color: rgba(255,255,255,0.3);
  font-size: 13px;
}
.hdr-level-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: 'Orbitron', monospace;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-top: 1px;
}

/* Points pill */
.hdr-points {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  border-radius: 12px;
  background: rgba(255,190,0,0.08);
  border: 1px solid rgba(255,190,0,0.25);
  flex-shrink: 0;
}
.hdr-points-val {
  font-family: 'Orbitron', monospace;
  font-size: 13px;
  font-weight: 700;
  color: #ffbe00;
  letter-spacing: 0.5px;
}

/* ── Title bar ── */
.hdr-title-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 8px 0 2px;
  border-top: 1px solid rgba(255,255,255,0.05);
  position: relative;
}
.hdr-title-bar::before,
.hdr-title-bar::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,190,0,0.15));
}
.hdr-title-bar::after {
  background: linear-gradient(270deg, transparent, rgba(255,190,0,0.15));
}
.hdr-title {
  font-family: 'Orbitron', monospace;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 4px;
  color: rgba(255,255,255,0.5);
  text-transform: uppercase;
  white-space: nowrap;
}
.hdr-title span {
  color: #ffbe00;
  text-shadow: 0 0 12px rgba(255,190,0,0.5);
}
`;

export default function Header() {
  const { user, balance, telegramUser } = useApp();

  const level = user?.level || 1;
  const levelInfo = getLevelInfo(level);
  const displayName = user?.first_name || telegramUser?.first_name || "User";
  const points = balance?.points || 0;

  return (
    <>
      <style>{CSS}</style>
      <div className="hdr-root">
        <div className="hdr-inner">

          {/* Row: avatar + name + points */}
          <div className="hdr-row">

            {/* Avatar */}
            <div className="hdr-avatar-wrap">
              <div
                className="hdr-avatar"
                style={{
                  background: `linear-gradient(135deg, ${levelInfo.color}30, rgba(6,8,15,0.9))`,
                  border: `2px solid ${levelInfo.color}50`,
                  boxShadow: `0 0 16px ${levelInfo.glow}, inset 0 0 16px ${levelInfo.color}10`,
                }}
              >
                {user?.photo_url ? (
                  <img src={user.photo_url} alt={displayName} />
                ) : (
                  <span style={{ color: levelInfo.color }}>{displayName[0]?.toUpperCase()}</span>
                )}
              </div>
              <div
                className="hdr-level-badge"
                style={{ background: levelInfo.color, boxShadow: `0 0 8px ${levelInfo.glow}` }}
              >
                {level}
              </div>
            </div>

            {/* Name + level */}
            <div className="hdr-name-block">
              <div className="hdr-name">
                {displayName}
                {user?.username && (
                  <span className="hdr-username"> @{user.username}</span>
                )}
              </div>
              <div className="hdr-level-label" style={{ color: levelInfo.color }}>
                <TgEmoji id="5325547803936572038" size={14} fallback="⭐" />
                {levelInfo.name}
              </div>
            </div>

            {/* Points */}
            <div className="hdr-points">
              <TgEmoji id="5249381781622247862" size={16} fallback="🪙" />
              <span className="hdr-points-val">{points.toLocaleString()}</span>
            </div>

          </div>

          {/* Title */}
          <div className="hdr-title-bar">
            <div className="hdr-title">
              ADS <span>REWARDS</span>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
