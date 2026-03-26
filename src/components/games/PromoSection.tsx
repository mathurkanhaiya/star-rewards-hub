import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';

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
  const [claimed, setClaimed] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPromos();
  }, [user]);

  async function loadPromos() {
    if (!user) return;
    const { data } = await supabase
      .from('promos')
      .select('id, title, reward_points, max_claims, total_claimed')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!data || data.length === 0) { setPromos([]); return; }

    // Check which ones user already claimed
    const { data: claims } = await supabase
      .from('promo_claims')
      .select('promo_id')
      .eq('user_id', user.id)
      .in('promo_id', data.map(p => p.id));

    const claimedSet = new Set((claims || []).map((c: any) => c.promo_id));
    setClaimed(claimedSet);

    // Filter out full promos and already claimed
    setPromos((data as Promo[]).filter(p => p.total_claimed < p.max_claims && !claimedSet.has(p.id)));
  }

  async function claimPromo(promo: Promo) {
    if (!user || claiming) return;
    setClaiming(promo.id);

    try {
      // Show ad first
      if (typeof window !== 'undefined' && (window as any).Adsgram) {
        try {
          const adController = (window as any).Adsgram.init({ blockId: 'int-23322' });
          await adController.show();
        } catch {
          // Ad failed/skipped, still allow claim
        }
      }

      // Check not already claimed
      const { data: existing } = await supabase
        .from('promo_claims')
        .select('id')
        .eq('promo_id', promo.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) { setClaiming(null); return; }

      // Check slots available
      const { data: promoData } = await supabase
        .from('promos')
        .select('total_claimed, max_claims')
        .eq('id', promo.id)
        .single();

      if (!promoData || promoData.total_claimed >= promoData.max_claims) {
        setClaiming(null);
        loadPromos();
        return;
      }

      // Claim
      await supabase.from('promo_claims').insert({ promo_id: promo.id, user_id: user.id });
      await supabase.from('promos').update({ total_claimed: promoData.total_claimed + 1 }).eq('id', promo.id);

      // Award points
      await supabase.rpc('increment_points', { p_user_id: user.id, p_points: promo.reward_points });
      await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'promo',
        points: promo.reward_points,
        description: `🎁 Promo: ${promo.title}`,
      });

      refreshBalance();

      // Haptic
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }

      // Remove from list
      setPromos(prev => prev.filter(p => p.id !== promo.id));
      setClaimed(prev => new Set(prev).add(promo.id));
    } catch (err) {
      console.error('Promo claim error:', err);
    } finally {
      setClaiming(null);
    }
  }

  if (promos.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      <div className="text-xs uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>
        🎁 Active Promos
      </div>
      {promos.map(promo => (
        <div
          key={promo.id}
          className="glass-card rounded-2xl p-4 relative overflow-hidden"
          style={{ border: '1px solid hsl(45 100% 55% / 0.3)' }}
        >
          <div
            className="absolute inset-0 pointer-events-none opacity-10"
            style={{ background: 'linear-gradient(135deg, hsl(45 100% 55%), transparent)' }}
          />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="font-bold text-white">{promo.title}</div>
              <div className="text-xs mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                🎁 {promo.reward_points} pts • {promo.max_claims - promo.total_claimed} slots left
              </div>
            </div>
            <button
              onClick={() => claimPromo(promo)}
              disabled={claiming === promo.id}
              className="px-5 py-2 rounded-xl font-bold text-sm active:scale-95 transition-all"
              style={{
                background: 'linear-gradient(135deg, hsl(45 100% 50%), hsl(30 100% 50%))',
                color: '#000',
                opacity: claiming === promo.id ? 0.5 : 1,
              }}
            >
              {claiming === promo.id ? '...' : '📺 Claim'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
