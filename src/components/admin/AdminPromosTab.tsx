import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Promo {
  id: string;
  title: string;
  reward_points: number;
  max_claims: number;
  total_claimed: number;
  is_active: boolean;
  created_at: string;
}

interface Props {
  onMessage: (msg: string, type?: 'success' | 'error') => void;
}

export default function AdminPromosTab({ onMessage }: Props) {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [title, setTitle] = useState('');
  const [reward, setReward] = useState('50');
  const [maxClaims, setMaxClaims] = useState('100');

  useEffect(() => { loadPromos(); }, []);

  async function loadPromos() {
    const { data } = await supabase
      .from('promos')
      .select('*')
      .order('created_at', { ascending: false });
    setPromos((data as Promo[]) || []);
  }

  async function createPromo() {
    if (!title.trim()) return;
    const { error } = await supabase.from('promos').insert({
      title: title.trim(),
      reward_points: parseInt(reward) || 50,
      max_claims: parseInt(maxClaims) || 100,
    });
    if (error) { onMessage('Failed to create promo', 'error'); return; }
    onMessage('Promo created ✓');
    setTitle(''); setReward('50'); setMaxClaims('100');
    loadPromos();
  }

  async function togglePromo(id: string, active: boolean) {
    await supabase.from('promos').update({ is_active: active }).eq('id', id);
    onMessage(active ? 'Promo activated' : 'Promo deactivated');
    loadPromos();
  }

  async function deletePromo(id: string) {
    await supabase.from('promo_claims').delete().eq('promo_id', id);
    await supabase.from('promos').delete().eq('id', id);
    onMessage('Promo deleted');
    loadPromos();
  }

  return (
    <div className="space-y-6">
      {/* Create */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: '#111827', border: '1px solid rgba(239,68,68,0.3)' }}>
        <div className="text-sm font-bold text-red-400">Create Promo</div>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Promo title..."
          className="w-full px-3 py-2 rounded-lg bg-black/40 border border-gray-700 text-white text-sm"
        />
        <div className="flex gap-2">
          <input
            type="number"
            value={reward}
            onChange={e => setReward(e.target.value)}
            placeholder="Reward pts"
            className="flex-1 px-3 py-2 rounded-lg bg-black/40 border border-gray-700 text-white text-sm"
          />
          <input
            type="number"
            value={maxClaims}
            onChange={e => setMaxClaims(e.target.value)}
            placeholder="Max users"
            className="flex-1 px-3 py-2 rounded-lg bg-black/40 border border-gray-700 text-white text-sm"
          />
        </div>
        <button
          onClick={createPromo}
          className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-red-500 to-orange-500 text-white active:scale-95 transition-all"
        >
          🎁 Create Promo
        </button>
      </div>

      {/* List */}
      {promos.map(p => (
        <div
          key={p.id}
          className="rounded-2xl p-4"
          style={{
            background: 'linear-gradient(145deg, #0f172a, #1e293b)',
            border: `1px solid ${p.is_active ? 'rgba(34,197,94,0.3)' : 'rgba(107,114,128,0.3)'}`,
          }}
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="font-bold text-white">{p.title}</div>
              <div className="text-xs text-gray-400">
                🎁 {p.reward_points} pts • {p.total_claimed}/{p.max_claims} claimed
              </div>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${p.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
              {p.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => togglePromo(p.id, !p.is_active)}
              className="flex-1 py-2 rounded-lg text-xs font-bold transition active:scale-95"
              style={{
                background: p.is_active ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                color: p.is_active ? '#ef4444' : '#22c55e',
              }}
            >
              {p.is_active ? 'Deactivate' : 'Activate'}
            </button>
            <button
              onClick={() => deletePromo(p.id)}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-red-500/15 text-red-400 transition active:scale-95"
            >
              🗑️
            </button>
          </div>
        </div>
      ))}

      {promos.length === 0 && (
        <div className="text-center py-10 text-gray-500">
          <div className="text-4xl mb-2">🎁</div>
          No promos yet
        </div>
      )}
    </div>
  );
}
