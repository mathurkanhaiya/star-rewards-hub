import React, { useState } from 'react';
import { useApp } from "@/context/AppContext";

type Page =
  | 'home' | 'tasks' | 'spin' | 'referral' | 'leaderboard'
  | 'wallet' | 'notifications' | 'admin' | 'games'
  | 'tower' | 'dice' | 'cardflip' | 'numberguess' | 'luckybox';

interface GamesMenuProps {
  onNavigate: (page: Page) => void;
}

const games = [
  {
    id: 'tower' as Page,
    icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773236274906-2cbfc5e2.gif',
    name: 'Tower Climb',
    desc: 'Tap at the right time to climb infinite floors.',
    accent: '#f59e0b',
    tag: 'ENDLESS',
  },
  {
    id: 'luckybox' as Page,
    icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773236074591-d9f8b5e0.gif',
    name: 'Lucky Box',
    desc: 'Pick a mystery box and claim your reward.',
    accent: '#a855f7',
    tag: 'LUCKY',
  },
  {
    id: 'dice' as Page,
    icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773236388452-80bcfe97.gif',
    name: 'Dice Roll',
    desc: 'Roll the dice and test your fortune.',
    accent: '#ef4444',
    tag: 'CHANCE',
  },
  {
    id: 'cardflip' as Page,
    icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773236194044-d5413577.gif',
    name: 'Card Flip',
    desc: 'Flip cards and reveal your prize.',
    accent: '#22d3ee',
    tag: 'FLIP',
  },
  {
    id: 'numberguess' as Page,
    icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773236312067-54b2669f.gif',
    name: 'Number Guess',
    desc: 'Guess the number and win big.',
    accent: '#4ade80',
    tag: 'GUESS',
  },
];

function GamesMenu({ onNavigate }: GamesMenuProps) {
  const { balance } = useApp();
  const [hoveredId, setHoveredId] = useState<Page | null>(null);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=DM+Sans:wght@400;500;600&display=swap');

        .gm-root {
          font-family: 'DM Sans', sans-serif;
          background: #080b14;
          min-height: 100vh;
          padding: 20px 16px 112px;
          position: relative;
          overflow: hidden;
          color: white;
        }

        .gm-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 50% at 50% -10%, rgba(250,180,0,0.12) 0%, transparent 70%),
            radial-gradient(ellipse 60% 40% at 80% 100%, rgba(168,85,247,0.08) 0%, transparent 60%);
          pointer-events: none;
          z-index: 0;
        }

        .gm-grid-bg {
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
          z-index: 0;
        }

        .gm-content {
          position: relative;
          z-index: 1;
        }

        /* Header */
        .gm-header {
          text-align: center;
          margin-bottom: 28px;
        }

        .gm-title {
          font-family: 'Orbitron', monospace;
          font-size: 26px;
          font-weight: 900;
          letter-spacing: 3px;
          text-transform: uppercase;
          background: linear-gradient(135deg, #fbbf24, #f59e0b, #d97706);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0 0 4px;
          line-height: 1.1;
        }

        .gm-subtitle {
          font-size: 11px;
          letter-spacing: 4px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.3);
        }

        /* Balance pill */
        .gm-balance {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 28px;
        }

        .gm-balance-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 100px;
          background: rgba(251,191,36,0.08);
          border: 1px solid rgba(251,191,36,0.25);
          backdrop-filter: blur(10px);
        }

        .gm-balance-icon {
          font-size: 18px;
          line-height: 1;
        }

        .gm-balance-label {
          font-size: 11px;
          color: rgba(255,255,255,0.4);
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }

        .gm-balance-value {
          font-family: 'Orbitron', monospace;
          font-size: 18px;
          font-weight: 700;
          color: #fbbf24;
          letter-spacing: 1px;
        }

        /* Section label */
        .gm-section-label {
          font-family: 'Orbitron', monospace;
          font-size: 10px;
          letter-spacing: 3px;
          color: rgba(255,255,255,0.25);
          text-transform: uppercase;
          margin-bottom: 12px;
          padding-left: 4px;
        }

        /* Game cards */
        .gm-card {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 16px;
          margin-bottom: 10px;
          cursor: pointer;
          text-align: left;
          display: block;
          transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
          position: relative;
          overflow: hidden;
        }

        .gm-card::before {
          content: '';
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.2s ease;
          border-radius: 20px;
        }

        .gm-card:active {
          transform: scale(0.97);
        }

        .gm-card-inner {
          display: flex;
          align-items: center;
          gap: 14px;
          position: relative;
          z-index: 1;
        }

        .gm-card-img-wrap {
          width: 60px;
          height: 60px;
          border-radius: 14px;
          overflow: hidden;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .gm-card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .gm-card-body {
          flex: 1;
          min-width: 0;
        }

        .gm-card-top {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .gm-card-name {
          font-family: 'Orbitron', monospace;
          font-size: 13px;
          font-weight: 700;
          color: #fff;
          letter-spacing: 0.5px;
        }

        .gm-card-tag {
          font-size: 8px;
          font-weight: 600;
          letter-spacing: 1.5px;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .gm-card-desc {
          font-size: 12px;
          color: rgba(255,255,255,0.4);
          line-height: 1.4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .gm-card-arrow {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 14px;
          transition: transform 0.2s ease;
        }

        .gm-card:hover .gm-card-arrow {
          transform: translateX(3px);
        }

        /* Scanline shimmer on hover */
        .gm-card-shine {
          position: absolute;
          top: 0; left: -100%;
          width: 60%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
          transition: left 0.4s ease;
          pointer-events: none;
        }

        .gm-card:hover .gm-card-shine {
          left: 150%;
        }
      `}</style>

      <div className="gm-root">
        <div className="gm-grid-bg" />
        <div className="gm-content">

          {/* Header */}
          <div className="gm-header">
            <h1 className="gm-title">Game Zone</h1>
            <p className="gm-subtitle">Pick your game · Earn rewards</p>
          </div>

          {/* Balance */}
          <div className="gm-balance">
            <div className="gm-balance-pill">
              <span className="gm-balance-icon">💰</span>
              <span className="gm-balance-label">Balance</span>
              <span className="gm-balance-value">{(balance?.points || 0).toLocaleString()}</span>
            </div>
          </div>

          {/* Games */}
          <div className="gm-section-label">Choose a game</div>

          {games.map((game) => (
            <button
              key={game.id}
              className="gm-card"
              onClick={() => onNavigate(game.id)}
              onMouseEnter={() => setHoveredId(game.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={hoveredId === game.id ? {
                background: `rgba(${hexToRgb(game.accent)}, 0.07)`,
                borderColor: `rgba(${hexToRgb(game.accent)}, 0.35)`,
                boxShadow: `0 0 24px rgba(${hexToRgb(game.accent)}, 0.12)`,
                transform: 'translateY(-2px)',
              } : {}}
            >
              <div className="gm-card-shine" />
              <div className="gm-card-inner">

                {/* Icon */}
                <div
                  className="gm-card-img-wrap"
                  style={{ background: `rgba(${hexToRgb(game.accent)}, 0.12)`, border: `1px solid rgba(${hexToRgb(game.accent)}, 0.2)` }}
                >
                  <img src={game.icon} alt={game.name} className="gm-card-img" />
                </div>

                {/* Text */}
                <div className="gm-card-body">
                  <div className="gm-card-top">
                    <span className="gm-card-name">{game.name}</span>
                    <span
                      className="gm-card-tag"
                      style={{
                        color: game.accent,
                        background: `rgba(${hexToRgb(game.accent)}, 0.12)`,
                      }}
                    >
                      {game.tag}
                    </span>
                  </div>
                  <div className="gm-card-desc">{game.desc}</div>
                </div>

                {/* Arrow */}
                <div
                  className="gm-card-arrow"
                  style={{ background: `rgba(${hexToRgb(game.accent)}, 0.1)`, color: game.accent }}
                >
                  ›
                </div>

              </div>
            </button>
          ))}

        </div>
      </div>
    </>
  );
}

/* Hex to RGB helper for dynamic rgba() */
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

export default GamesMenu;
export type { Page };
