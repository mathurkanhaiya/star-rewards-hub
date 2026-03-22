import React from 'react';
import { useApp } from '@/context/AppContext';

type Page =
  | 'home'
  | 'tasks'
  | 'spin'
  | 'referral'
  | 'leaderboard'
  | 'wallet'
  | 'notifications'
  | 'admin'
  | 'games'
  | 'tower'
  | 'dice'
  | 'cardflip'
  | 'numberguess'
  | 'luckybox';

interface BottomNavProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems = [
  {
    id: 'home' as Page,
    icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773233659516-1634eac5.gif',
    label: 'Home',
  },
  {
    id: 'tasks' as Page,
    icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773233768415-b3ab10fa.gif',
    label: 'Tasks',
  },
  {
    id: 'games' as Page,
    icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773233806742-9483b1e2.gif',
    label: 'Games',
  },
  {
    id: 'referral' as Page,
    icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773233943001-33f1c354.gif',
    label: 'Refer',
  },
  {
    id: 'wallet' as Page,
    icon: 'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773234069854-77c4066d.gif',
    label: 'Wallet',
  },
];

const notificationIcon =
  'https://repgyetdcodkynrbxocg.supabase.co/storage/v1/object/public/images/telegram-1773234754093-d8278f25.gif';

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700&display=swap');

.bn-root {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  max-width: 480px;
  margin: 0 auto;
  padding: 0 12px 10px;
}

.bn-bar {
  background: rgba(6, 8, 15, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 20px;
  padding: 6px 4px;
  display: flex;
  align-items: center;
  justify-content: space-around;
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  position: relative;
  overflow: hidden;
}

/* Top edge light */
.bn-bar::before {
  content: '';
  position: absolute;
  top: 0; left: 10%; right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,190,0,0.25), transparent);
  pointer-events: none;
}

/* Grid texture */
.bn-bar::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
  background-size: 20px 20px;
  pointer-events: none;
  border-radius: 20px;
}

.bn-item {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 6px 8px;
  border-radius: 14px;
  border: none;
  background: none;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.2s ease;
  min-width: 52px;
  -webkit-tap-highlight-color: transparent;
}

.bn-item:active {
  transform: scale(0.88);
}

.bn-item.active {
  background: rgba(255, 190, 0, 0.08);
}

.bn-icon {
  width: 28px;
  height: 28px;
  object-fit: contain;
  transition: filter 0.2s, transform 0.2s;
  filter: grayscale(0.4) brightness(0.7);
}

.bn-item.active .bn-icon {
  filter: grayscale(0) brightness(1.1) drop-shadow(0 0 6px rgba(255,190,0,0.5));
  transform: translateY(-1px) scale(1.08);
}

.bn-label {
  font-family: 'Orbitron', monospace;
  font-size: 7px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.25);
  transition: color 0.2s;
  line-height: 1;
}

.bn-item.active .bn-label {
  color: #ffbe00;
}

/* Gold underline pip for active */
.bn-pip {
  position: absolute;
  bottom: 3px;
  left: 50%;
  transform: translateX(-50%);
  width: 16px;
  height: 2px;
  border-radius: 1px;
  background: #ffbe00;
  box-shadow: 0 0 6px rgba(255,190,0,0.7);
  opacity: 0;
  transition: opacity 0.2s, width 0.2s;
}

.bn-item.active .bn-pip {
  opacity: 1;
}

/* Notification badge */
.bn-badge {
  position: absolute;
  top: 2px;
  right: 4px;
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
  border: 1px solid rgba(0,0,0,0.4);
  box-shadow: 0 0 6px rgba(239,68,68,0.6);
  animation: bnBadgePulse 2s ease-in-out infinite;
}

@keyframes bnBadgePulse {
  0%, 100% { box-shadow: 0 0 6px rgba(239,68,68,0.6); }
  50%       { box-shadow: 0 0 12px rgba(239,68,68,0.9); }
}

/* Admin emoji icon */
.bn-admin-icon {
  font-size: 22px;
  line-height: 1;
  transition: filter 0.2s, transform 0.2s;
  filter: grayscale(0.6) brightness(0.7);
}
.bn-item.active .bn-admin-icon {
  filter: grayscale(0) brightness(1.1) drop-shadow(0 0 6px rgba(255,190,0,0.5));
  transform: translateY(-1px) scale(1.08);
}
`;

export default function BottomNav({ currentPage, onNavigate }: BottomNavProps) {
  const { isAdmin, unreadCount } = useApp();

  /* Treat any game sub-page as 'games' being active */
  const activePage: Page =
    ['tower', 'dice', 'cardflip', 'numberguess', 'luckybox'].includes(currentPage)
      ? 'games'
      : currentPage;

  return (
    <>
      <style>{CSS}</style>
      <div className="bn-root">
        <div className="bn-bar">

          {navItems.map((item) => (
            <button
              key={item.id}
              className={`bn-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <img src={item.icon} alt={item.label} className="bn-icon" />
              <span className="bn-label">{item.label}</span>
              <div className="bn-pip" />
            </button>
          ))}

          {/* Notifications */}
          <button
            className={`bn-item ${activePage === 'notifications' ? 'active' : ''}`}
            onClick={() => onNavigate('notifications')}
          >
            <img src={notificationIcon} alt="Notifications" className="bn-icon" />
            {unreadCount > 0 && (
              <div className="bn-badge">
                {unreadCount > 9 ? '9+' : unreadCount}
              </div>
            )}
            <span className="bn-label">Notifs</span>
            <div className="bn-pip" />
          </button>

          {/* Admin */}
          {isAdmin && (
            <button
              className={`bn-item ${activePage === 'admin' ? 'active' : ''}`}
              onClick={() => onNavigate('admin')}
            >
              <span className="bn-admin-icon">⚙️</span>
              <span className="bn-label">Admin</span>
              <div className="bn-pip" />
            </button>
          )}

        </div>
      </div>
    </>
  );
}
