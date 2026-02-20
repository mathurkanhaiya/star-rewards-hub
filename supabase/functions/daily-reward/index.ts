import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { userId } = await req.json();
    if (!userId) throw new Error('No userId');

    const today = new Date().toISOString().split('T')[0];

    // Check if already claimed today
    const { data: existing } = await supabase
      .from('daily_claims')
      .select('id')
      .eq('user_id', userId)
      .eq('claim_date', today)
      .single();

    if (existing) {
      return new Response(JSON.stringify({ success: false, message: 'Already claimed today! Come back tomorrow 🌙' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get streak
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const { data: lastClaim } = await supabase
      .from('daily_claims')
      .select('day_streak')
      .eq('user_id', userId)
      .eq('claim_date', yesterday)
      .single();

    const streak = lastClaim ? lastClaim.day_streak + 1 : 1;
    const basePoints = 100;
    const streakBonus = Math.min(streak * 10, 500);
    const totalPoints = basePoints + streakBonus;

    // Create claim record
    await supabase.from('daily_claims').insert({
      user_id: userId,
      claim_date: today,
      day_streak: streak,
      points_earned: totalPoints,
    });

    // Update balance
    const { data: balance } = await supabase.from('balances').select('points, total_earned').eq('user_id', userId).single();
    if (balance) {
      await supabase.from('balances').update({
        points: balance.points + totalPoints,
        total_earned: balance.total_earned + totalPoints,
      }).eq('user_id', userId);
    }

    // Log transaction
    await supabase.from('transactions').insert({
      user_id: userId,
      type: 'daily',
      points: totalPoints,
      description: `🎁 Daily reward (Day ${streak} streak)`,
    });

    // Update user total_points
    const { data: user } = await supabase.from('users').select('total_points').eq('id', userId).single();
    if (user) {
      const newTotal = user.total_points + totalPoints;
      const newLevel = Math.floor(newTotal / 10000) + 1;
      await supabase.from('users').update({ total_points: newTotal, level: newLevel }).eq('id', userId);
    }

    return new Response(JSON.stringify({ success: true, points: totalPoints, streak }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
