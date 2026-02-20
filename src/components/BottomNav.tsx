import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';

type Page = 'home' | 'tasks' | 'spin' | 'referral' | 'leaderboard' | 'wallet' | 'admin';

interface BottomNavProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems = [
  { id: 'home' as Page, icon: '🏠', label: 'Home' },
  { id: 'tasks' as Page, icon: '📋', label: 'Tasks' },
  { id: 'spin' as Page, icon: '🎡', label: 'Spin' },
  { id: 'referral' as Page, icon: '👥', label: 'Invite' },
  { id: 'wallet' as Page, icon: '💰', label: 'Wallet' },
];

export default function BottomNav({ currentPage, onNavigate }: BottomNavProps) {
  const { isAdmin } = useApp();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50" style={{ maxWidth: 480, margin: '0 auto' }}>
      <div
        className="glass-card mx-3 mb-3 rounded-2xl px-2 py-2"
        style={{
          background: 'linear-gradient(135deg, hsl(220 25% 8% / 0.95), hsl(220 25% 6% / 0.95))',
          border: '1px solid hsl(220 30% 20% / 0.6)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-center justify-around">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`bottom-nav-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
          {isAdmin && (
            <button
              className={`bottom-nav-item ${currentPage === 'admin' ? 'active' : ''}`}
              onClick={() => onNavigate('admin')}
            >
              <span className="text-xl">⚙️</span>
              <span className="font-medium">Admin</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
