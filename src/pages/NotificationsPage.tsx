import React from 'react';
import { useApp } from '@/context/AppContext';

const typeIcons: Record<string, string> = {
  info: '📢',
  reward: '🎁',
  withdrawal: '💸',
  referral: '👥',
};

const typeColors: Record<string, string> = {
  info: 'hsl(190 100% 55%)',
  reward: 'hsl(45 100% 55%)',
  withdrawal: 'hsl(140 70% 50%)',
  referral: 'hsl(265 80% 65%)',
};

export default function NotificationsPage() {
  const { notifications, markRead } = useApp();

  return (
    <div className="px-4 pb-28">
      <div className="mb-4">
        <h2 className="text-lg font-display font-bold text-gold-gradient mb-1">Notifications</h2>
        <p className="text-xs text-muted-foreground">Stay updated on your activity</p>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🔔</div>
          <div className="text-sm text-muted-foreground">No notifications yet</div>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <button
              key={n.id}
              onClick={() => !n.is_read && markRead(n.id)}
              className="w-full text-left p-3 rounded-xl transition-all"
              style={{
                background: n.is_read ? 'hsl(220 25% 8% / 0.4)' : 'hsl(220 25% 10%)',
                border: `1px solid ${n.is_read ? 'hsl(220 20% 12%)' : (typeColors[n.type] || 'hsl(220 20% 20%)') + '40'}`,
              }}
            >
              <div className="flex items-start gap-3">
                <div className="text-lg flex-shrink-0 mt-0.5">{typeIcons[n.type] || '🔔'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-foreground">{n.title}</div>
                    {!n.is_read && (
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'hsl(0 80% 55%)' }} />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{n.message}</div>
                  <div className="text-xs text-muted-foreground mt-1 opacity-60">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
