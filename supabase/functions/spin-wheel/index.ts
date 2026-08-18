import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireTelegramUser, secureCorsHeaders as corsHeaders } from "../_shared/telegramAuth.ts";

const SPIN_PRIZES = [
  { type: 'points', points: 10, stars: 0, probability: 0.30 },
  { type: 'points', points: 15, stars: 0, probability: 0.25 },
  { type: 'points', points: 20, stars: 0, probability: 0.15 },
  { type: 'points', points: 30, stars: 0, probability: 0.08 },
  { type: 'points', points: 25, stars: 0, probability: 0.05 },
  { type: 'points', points: 17, stars: 0, probability: 0.07 },
  { type: 'points', points: 35, stars: 0, probability: 0.03 },
  { type: 'empty', points: 0, stars: 0, probability: 0.07 },
];

function selectPrize() {
  const rand = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  let cumulative = 0;
  for (const prize of SPIN_PRIZES) {
    cumulative += prize.probability;
    if (rand <= cumulative) return prize;
  }
  return SPIN_PRIZES[SPIN_PRIZES.length - 1];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { appUser } = await requireTelegramUser(req, supabase);
    const userId = appUser.id;

    const { data: settings } = await supabase.from('settings').select('key,value').in('key', ['max_daily_spins']);
    const maxSpins = Math.max(1, Math.min(100, Number(settings?.find((s) => s.key === 'max_daily_spins')?.value || 3)));
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase.from('spin_results').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('spun_at', `${today}T00:00:00Z`);
    if ((count || 0) >= maxSpins) return new Response(JSON.stringify({ success: false, message: 'Daily spin limit reached! Come back tomorrow.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const prize = selectPrize();
    const { error: spinError } = await supabase.from('spin_results').insert({ user_id: userId, result_type: prize.type, points_earned: prize.points, stars_earned: prize.stars });
    if (spinError) throw spinError;

    if (prize.points > 0) {
      await supabase.rpc('increment_points', { p_user_id: userId, p_points: prize.points });
      await supabase.from('transactions').insert({ user_id: userId, type: 'spin', points: prize.points, description: `🎡 Spin: ${prize.points} points won!` });
      const { data: currentUser } = await supabase.from('users').select('total_points').eq('id', userId).single();
      if (currentUser) await supabase.from('users').update({ level: Math.floor(Number(currentUser.total_points || 0) / 10000) + 1 }).eq('id', userId);
    }

    return new Response(JSON.stringify({ success: true, result: prize.type, points: prize.points, stars: prize.stars, spinsLeft: Math.max(0, maxSpins - ((count || 0) + 1)) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    const message = (error as Error).message;
    const status = /Telegram|registered|banned|expired|signature/i.test(message) ? 401 : 400;
    return new Response(JSON.stringify({ success: false, message }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
