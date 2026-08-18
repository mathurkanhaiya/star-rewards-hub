import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireTelegramUser, secureCorsHeaders as corsHeaders } from "../_shared/telegramAuth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { appUser } = await requireTelegramUser(req, supabase);
    const userId = appUser.id;
    const today = new Date().toISOString().split('T')[0];

    const { data: existing } = await supabase.from('daily_claims').select('id').eq('user_id', userId).eq('claim_date', today).maybeSingle();
    if (existing) return new Response(JSON.stringify({ success: false, message: 'Already claimed today! Come back tomorrow 🌙' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const { data: lastClaim } = await supabase.from('daily_claims').select('day_streak').eq('user_id', userId).eq('claim_date', yesterday).maybeSingle();
    const streak = lastClaim ? Number(lastClaim.day_streak) + 1 : 1;
    const totalPoints = 100 + Math.min(streak * 10, 500);

    const { error: claimError } = await supabase.from('daily_claims').insert({ user_id: userId, claim_date: today, day_streak: streak, points_earned: totalPoints });
    if (claimError) {
      if (claimError.code === '23505') return new Response(JSON.stringify({ success: false, message: 'Already claimed today!' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      throw claimError;
    }

    await supabase.rpc('increment_points', { p_user_id: userId, p_points: totalPoints });
    await supabase.from('transactions').insert({ user_id: userId, type: 'daily', points: totalPoints, description: `🎁 Daily reward (Day ${streak} streak)` });
    const { data: currentUser } = await supabase.from('users').select('total_points').eq('id', userId).single();
    if (currentUser) await supabase.from('users').update({ level: Math.floor(Number(currentUser.total_points || 0) / 10000) + 1 }).eq('id', userId);

    return new Response(JSON.stringify({ success: true, points: totalPoints, streak }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    const message = (error as Error).message;
    const status = /Telegram|registered|banned|expired|signature/i.test(message) ? 401 : 400;
    return new Response(JSON.stringify({ success: false, message }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
