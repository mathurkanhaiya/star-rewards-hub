import React from 'react';
import { useApp } from '@/context/AppContext';

type Page =
  | 'home' | 'tasks' | 'spin' | 'referral' | 'leaderboard'
  | 'wallet' | 'notifications' | 'admin' | 'games'
  | 'tower' | 'dice' | 'cardflip' | 'numberguess' | 'luckybox';

interface BottomNavProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems = [
  { id: 'home'     as Page, emoji: '🏠', label: 'Home'   },
  { id: 'tasks'    as Page, emoji: '📋', label: 'Tasks'  },
  { id: 'games'    as Page, emoji: '🎮', label: 'Games'  },
  { id: 'referral' as Page, emoji: '🤝', label: 'Refer'  },
  { id: 'wallet'   as Page, emoji: '👛', label: 'Wallet' },
];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700&display=swap');

.bn-safe {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  /* Safe area for iPhone home bar */
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: rgba(6,8,15,0.98);
  border-top: 1px solid rgba(255,255,255,0.07);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}

.bn-bar {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 6px 4px 8px;
  position: relative;
  max-width: 480px;
  margin: 0 auto;
}

/* Top gold line */
.bn-bar::before {
  content: '';
  position: absolute;
  top: 0; left: 8%; right: 8%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,190,0,0.2), transparent);
  pointer-events: none;
}

.bn-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 6px 10px 4px;
  border-radius: 14px;
  border: none;
  background: none;
  cursor: pointer;
  min-width: 50px;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;
}

.bn-item:active {
  transform: scale(0.9);
}

.bn-item.active {
  background: rgba(255,190,0,0.08);
}

/* Emoji icon */
.bn-emoji {
  font-size: 22px;
  line-height: 1;
  transition: transform 0.15s, filter 0.15s;
  filter: grayscale(0.5) brightness(0.65);
}

.bn-item.active .bn-emoji {
  filter: grayscale(0) brightness(1);
  transform: translateY(-1px) scale(1.12);
}

.bn-label {
  font-family: 'Orbitron', monospace;
  font-size: 7px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: rgba(255,255,255,0.2);
  transition: color 0.15s;
  line-height: 1;
}

.bn-item.active .bn-label {
  color: #ffbe00;
}

/* Active pip */
.bn-pip {
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 2px;
  border-radius: 1px;
  background: #ffbe00;
  box-shadow: 0 0 6px rgba(255,190,0,0.6);
  transition: width 0.2s;
}
.bn-item.active .bn-pip { width: 18px; }

/* Notification badge */
.bn-badge {
  position: absolute;
  top: 2px;
  right: 5px;
  min-width: 15px;
  height: 15px;
  padding: 0 3px;
  border-radius: 8px;
  background: #ef4444;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Orbitron', monospace;
  font-size: 7px;
  font-weight: 700;
  color: #fff;
  border: 1.5px solid #06080f;
  box-shadow: 0 0 6px rgba(239,68,68,0.5);
}
`;

export default function BottomNav({ currentPage, onNavigate }: BottomNavProps) {
  const { isAdmin, isTelegram, unreadCount } = useApp();
  const showAdmin = isAdmin && isTelegram;

  const activePage: Page =
    ['tower','dice','cardflip','numberguess','luckybox'].includes(currentPage)
      ? 'games'
      : currentPage;

  return (
    <>
      <style>{CSS}</style>
      <div className="bn-safe">
        <div className="bn-bar">

          {navItems.map(item => (
            <button
              key={item.id}
              className={`bn-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="bn-emoji">{item.emoji}</span>
              <span className="bn-label">{item.label}</span>
              <div className="bn-pip"/>
            </button>
          ))}

          {/* Notifications */}
          <button
            className={`bn-item ${activePage === 'notifications' ? 'active' : ''}`}
            onClick={() => onNavigate('notifications')}
          >
            <span className="bn-emoji">🔔</span>
            {unreadCount > 0 && (
              <div className="bn-badge">{unreadCount > 9 ? '9+' : unreadCount}</div>
            )}
            <span className="bn-label">Notifs</span>
            <div className="bn-pip"/>
          </button>

          {/* Admin — only visible inside Telegram Mini App */}
          {showAdmin && (
            <button
              className={`bn-item ${activePage === 'admin' ? 'active' : ''}`}
              onClick={() => onNavigate('admin')}
            >
              <span className="bn-emoji">⚙️</span>
              <span className="bn-label">Admin</span>
              <div className="bn-pip"/>
            </button>
          )}

        </div>
      </div>

      {/* Spacer so content is never hidden behind nav */}
      <div style={{
        height: `calc(72px + env(safe-area-inset-bottom, 0px))`,
        flexShrink: 0,
      }}/>
    </>
  );
}
