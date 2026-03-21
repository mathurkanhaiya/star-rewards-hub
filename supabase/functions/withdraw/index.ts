import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendTelegramMessage(chatId: number, text: string) {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (e) { console.error('TG send error:', e); }
}

const conversionTiers: Record<number, number> = {
  5000: 0.08,
  10000: 0.16,
  15000: 0.24,
  20000: 0.32,
  25000: 0.4,
  30000: 0.48,
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

    const minPoints = parseInt(settingsMap.min_withdrawal_points || '5000'); 
    if (points < minPoints) {
      return new Response(JSON.stringify({ success: false, message: `Minimum withdrawal is ${minPoints.toLocaleString()} points` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ===== Tiered conversion logic =====
    const eligibleTiers = Object.keys(conversionTiers)
      .map(Number)
      .filter(t => t <= points)
      .sort((a, b) => b - a);

    if (eligibleTiers.length === 0) {
      return new Response(JSON.stringify({ success: false, message: 'No eligible conversion tier for your points' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const tier = eligibleTiers[0];
    const amount = conversionTiers[tier];

    // Check balance
    const { data: balance } = await supabase.from('balances').select('points, total_withdrawn').eq('user_id', userId).single();
    if (!balance || balance.points < points) {
      return new Response(JSON.stringify({ success: false, message: 'Insufficient balance' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Anti-fraud: check pending
    const { count: pendingCount } = await supabase
      .from('withdrawals')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('status', 'pending');

    const maxPending = parseInt(settingsMap.max_pending_withdrawals || '2');
    if ((pendingCount || 0) >= maxPending) {
      return new Response(JSON.stringify({ success: false, message: 'You have too many pending withdrawals' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create withdrawal
    await supabase.from('withdrawals').insert({
      user_id: userId, method, points_spent: points, amount,
      wallet_address: walletAddress || null, status: 'pending',
    });

    // Deduct points
    await supabase.from('balances').update({
      points: balance.points - points,
      total_withdrawn: (balance.total_withdrawn || 0) + points,
    }).eq('user_id', userId);

    // Log transaction
    await supabase.from('transactions').insert({
      user_id: userId, type: 'spend', points: -points,
      description: `💸 Withdrawal request: ${amount.toFixed(2)} ${method.toUpperCase()}`,
    });

    // In-app notification
    await supabase.from('notifications').insert({
      user_id: userId,
      title: '💸 Withdrawal Submitted',
      message: `Your withdrawal of ${points.toLocaleString()} pts (${amount.toFixed(2)} ${method.toUpperCase()}) is pending review.`,
      type: 'withdrawal',
    });

    // Telegram bot alert to user
    const { data: userData } = await supabase.from('users').select('telegram_id').eq('id', userId).single();
    if (userData) {
      await sendTelegramMessage(userData.telegram_id,
        `💸 <b>Withdrawal Submitted</b>\n\nAmount: <b>${amount.toFixed(2)} ${method.toUpperCase()}</b>\nPoints spent: ${points.toLocaleString()}\n\nYour request is pending admin review.`
      );
    }

    // Alert admin
    const adminTgId = Deno.env.get('ADMIN_TELEGRAM_ID');
    if (adminTgId) {
      const username = userData ? (await supabase.from('users').select('username, first_name').eq('id', userId).single()).data : null;
      await sendTelegramMessage(parseInt(adminTgId),
        `🔔 <b>New Withdrawal Request</b>\n\nUser: ${username?.first_name || 'Unknown'} (@${username?.username || 'N/A'})\nAmount: <b>${amount.toFixed(2)} ${method.toUpperCase()}</b>\nPoints: ${points.toLocaleString()}\nWallet: ${walletAddress || 'N/A'}`
      );
    }

    return new Response(JSON.stringify({ success: true, message: 'Withdrawal request submitted!' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});