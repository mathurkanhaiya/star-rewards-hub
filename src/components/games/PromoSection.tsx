import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { getActivePromos, claimPromoReward } from '@/lib/api';

interface Promo {
  id: string;
  title: string;
  reward_points: number;
  max_claims: number;
  total_claimed: number;
}

export default function PromoSection() {
  const { user, refreshBalance } = useApp();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { if (user) loadPromos(); else setPromos([]); }, [user]);

  async function loadPromos() {
    const data = await getActivePromos();
    setPromos((data || []) as Promo[]);
  }

  async function claimPromo(promo: Promo) {
    if (!user || claiming) return;
    setClaiming(promo.id);
    setError('');
    try {
      if (typeof window !== 'undefined' && (window as any).Adsgram) {
        try {
          const adController = (window as any).Adsgram.init({ blockId: 'int-23322' });
          await adController.show();
        } catch {}
      }

      const result = await claimPromoReward(promo.id);
      if (!result.success) throw new Error(result.message || 'Promo claim failed');

      await refreshBalance();
      if (window.Telegram?.WebApp) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      setPromos(prev => prev.filter(p => p.id !== promo.id));
    } catch (err) {
      setError((err as Error).message || 'Promo claim failed');
      await loadPromos();
    } finally {
      setClaiming(null);
    }
  }

  if (promos.length === 0 && !error) return null;

  return (
    <div className="mb-6 space-y-3">
      <div className="text-xs uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>
        🎁 Active Promos
      </div>
      {error && <div className="text-xs text-red-400 px-1">{error}</div>}
      {promos.map(promo => (
        <div key={promo.id} className="glass-card rounded-2xl p-4 relative overflow-hidden" style={{ border: '1px solid hsl(45 100% 55% / 0.3)' }}>
          <div className="absolute inset-0 pointer-events-none opacity-10" style={{ background: 'linear-gradient(135deg, hsl(45 100% 55%), transparent)' }} />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="font-bold text-white">{promo.title}</div>
              <div className="text-xs mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                🎁 {promo.reward_points} pts • {Math.max(0, promo.max_claims - promo.total_claimed)} slots left
              </div>
            </div>
            <button onClick={() => claimPromo(promo)} disabled={claiming === promo.id} className="px-5 py-2 rounded-xl font-bold text-sm active:scale-95 transition-all" style={{ background: 'linear-gradient(135deg, hsl(45 100% 50%), hsl(30 100% 50%))', color: '#000', opacity: claiming === promo.id ? 0.5 : 1 }}>
              {claiming === promo.id ? '...' : '📺 Claim'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
