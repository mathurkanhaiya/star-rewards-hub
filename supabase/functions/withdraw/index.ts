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

    const { userId, method, points, walletAddress } = await req.json();
    if (!userId || !method || !points) throw new Error('Missing fields');

    // Get settings
    const { data: settings } = await supabase.from('settings').select('key, value');
    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: { key: string; value: string }) => { settingsMap[s.key] = s.value; });

    const minPoints = parseInt(settingsMap.min_withdrawal_points || '10000');
    if (points < minPoints) {
      return new Response(JSON.stringify({ success: false, message: `Minimum withdrawal is ${minPoints.toLocaleString()} points` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get rate and calc amount
    const rateKey = `${method}_conversion_rate`;
    const rate = parseInt(settingsMap[rateKey] || '1000');
    const amount = points / rate;

    // Check balance
    const { data: balance } = await supabase.from('balances').select('points').eq('user_id', userId).single();
    if (!balance || balance.points < points) {
      return new Response(JSON.stringify({ success: false, message: 'Insufficient balance' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Anti-fraud: check for recent pending withdrawals
    const { count: pendingCount } = await supabase
      .from('withdrawals')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('status', 'pending');

    if ((pendingCount || 0) >= 2) {
      return new Response(JSON.stringify({ success: false, message: 'You have too many pending withdrawals' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create withdrawal request
    await supabase.from('withdrawals').insert({
      user_id: userId,
      method,
      points_spent: points,
      amount,
      wallet_address: walletAddress || null,
      status: 'pending',
    });

    // Deduct points immediately
    await supabase.from('balances').update({
      points: balance.points - points,
      total_withdrawn: (balance as { total_withdrawn?: number }).total_withdrawn + points,
    }).eq('user_id', userId);

    // Log transaction
    await supabase.from('transactions').insert({
      user_id: userId,
      type: 'spend',
      points: -points,
      description: `💸 Withdrawal request: ${amount.toFixed(2)} ${method.toUpperCase()}`,
    });

    return new Response(JSON.stringify({ success: true, message: 'Withdrawal request submitted!' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
