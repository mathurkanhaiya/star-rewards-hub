import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPIN_PRIZES = [
  { type: 'points', points: 100, stars: 0, probability: 0.30 },
  { type: 'points', points: 250, stars: 0, probability: 0.25 },
  { type: 'points', points: 500, stars: 0, probability: 0.15 },
  { type: 'points', points: 750, stars: 0, probability: 0.08 },
  { type: 'points', points: 1000, stars: 0, probability: 0.05 },
  { type: 'stars', points: 0, stars: 1, probability: 0.07 },
  { type: 'stars', points: 0, stars: 2, probability: 0.03 },
  { type: 'empty', points: 0, stars: 0, probability: 0.07 },
];

function selectPrize() {
  const rand = Math.random();
  let cumulative = 0;
  for (const prize of SPIN_PRIZES) {
    cumulative += prize.probability;
    if (rand <= cumulative) return prize;
  }
  return SPIN_PRIZES[0];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { userId } = await req.json();
    if (!userId) throw new Error('No userId');

    // Check daily spin limit
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('spin_results')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .gte('spun_at', `${today}T00:00:00Z`);

    const maxSpins = 3;
    if ((count || 0) >= maxSpins) {
      return new Response(JSON.stringify({ success: false, message: 'Daily spin limit reached! Come back tomorrow.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const prize = selectPrize();

    // Save spin result
    await supabase.from('spin_results').insert({
      user_id: userId,
      result_type: prize.type,
      points_earned: prize.points,
      stars_earned: prize.stars,
    });

    if (prize.type !== 'empty' && (prize.points > 0 || prize.stars > 0)) {
      const { data: balance } = await supabase.from('balances').select('*').eq('user_id', userId).single();
      if (balance) {
        const updates: Record<string, number> = { 
          points: balance.points + prize.points,
          total_earned: balance.total_earned + prize.points,
        };
        if (prize.stars > 0) updates.stars_balance = balance.stars_balance + prize.stars;
        await supabase.from('balances').update(updates).eq('user_id', userId);
      }

      await supabase.from('transactions').insert({
        user_id: userId,
        type: 'spin',
        points: prize.points,
        description: prize.stars > 0 ? `🎡 Spin: ${prize.stars} ⭐ Stars won!` : `🎡 Spin: ${prize.points} points won!`,
      });

      // Update total_points
      const { data: user } = await supabase.from('users').select('total_points').eq('id', userId).single();
      if (user && prize.points > 0) {
        const newTotal = user.total_points + prize.points;
        const newLevel = Math.floor(newTotal / 10000) + 1;
        await supabase.from('users').update({ total_points: newTotal, level: newLevel }).eq('id', userId);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      result: prize.type,
      points: prize.points,
      stars: prize.stars,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
