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

    const { userId, adType, rewardGiven } = await req.json();
    if (!userId || !adType) throw new Error('Missing fields');

    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count } = await supabase
      .from('ad_logs')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo);

    if ((count || 0) >= 10) {
      return new Response(JSON.stringify({ success: false, message: 'Ad rate limit reached' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    await supabase.from('ad_logs').insert({
      user_id: userId,
      ad_type: adType,
      reward_given: rewardGiven || 0,
      provider: 'adsgram',
    });

    if (rewardGiven > 0) {
      const { data: balance } = await supabase.from('balances').select('points, total_earned').eq('user_id', userId).single();
      if (balance) {
        await supabase.from('balances').update({
          points: balance.points + rewardGiven,
          total_earned: balance.total_earned + rewardGiven,
        }).eq('user_id', userId);

        await supabase.from('transactions').insert({
          user_id: userId,
          type: 'ad_reward',
          points: rewardGiven,
          description: `📺 Ad reward: ${adType}`,
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
