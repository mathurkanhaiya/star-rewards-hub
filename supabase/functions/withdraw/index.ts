import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TON_TIERS: Record<number, number> = {
  5000:  0.075,
  10000: 0.15,
  15000: 0.225,
  20000: 0.3,
};

/* 5000 pts = ₹10 → 10/5000 = 0.002 */
const UPI_RATE = 0.002;

async function sendTelegramMessage(chatId: number, text: string) {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (e) { console.error('Telegram send error:', e); }
}

function errorResponse(message: string, status = 200) {
  return new Response(
    JSON.stringify({ success: false, message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function successResponse(message: string) {
  return new Response(
    JSON.stringify({ success: true, message }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let body: any;
    try { body = await req.json(); }
    catch { return errorResponse('Invalid request body'); }

    const { userId, method, points, walletAddress } = body;

    if (!userId || typeof userId !== 'string')
      return errorResponse('Missing userId');
    if (!method || !['ton', 'upi'].includes(method))
      return errorResponse('Invalid method — must be ton or upi');
    if (!points || typeof points !== 'number' || points <= 0)
      return errorResponse('Invalid points');

    if (method === 'ton') {
      if (!walletAddress?.trim())
        return errorResponse('TON wallet address is required');
      if (!/^UQ[A-Za-z0-9_-]{46,}$/.test(walletAddress.trim()))
        return errorResponse('Invalid TON wallet address format');
    }

    if (method === 'upi') {
      if (!walletAddress?.trim())
        return errorResponse('UPI ID is required');
      if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(walletAddress.trim()))
        return errorResponse('Invalid UPI ID format (e.g. name@upi)');
    }

    /* ── Settings ── */
    const { data: settings } = await supabase.from('settings').select('key, value');
    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: { key: string; value: string }) => {
      settingsMap[s.key] = s.value;
    });

    const minPoints = parseInt(settingsMap.min_withdrawal_points || '5000');
    if (points < minPoints)
      return errorResponse(`Minimum withdrawal is ${minPoints.toLocaleString()} points`);

    /* ── Amount calculation (server-side only) ── */
    let amount: number;
    let amountStr: string;

    if (method === 'upi') {
      amount = parseFloat((points * UPI_RATE).toFixed(2));
      if (amount <= 0) return errorResponse('Invalid UPI withdrawal amount');
      amountStr = `₹${amount} INR`;
    } else {
      const ton = TON_TIERS[points];
      if (!ton)
        return errorResponse(`Invalid TON tier. Valid: ${Object.keys(TON_TIERS).join(', ')} pts`);
      amount = ton;
      amountStr = `${amount.toFixed(2)} TON`;
    }

    const addressLabel = method === 'upi' ? 'UPI ID' : 'Wallet';

    /* ── User ── */
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, telegram_id, username, first_name')
      .eq('id', userId)
      .single();

    if (userError || !userData) return errorResponse('User not found');

    /* ── Balance ── */
    const { data: balance, error: balError } = await supabase
      .from('balances')
      .select('points, total_withdrawn')
      .eq('user_id', userId)
      .single();

    if (balError || !balance) return errorResponse('Could not fetch balance');
    if (balance.points < points)
      return errorResponse(`Insufficient balance. You have ${balance.points.toLocaleString()} pts`);

    /* ── Pending limit ── */
    const { count: pendingCount } = await supabase
      .from('withdrawals')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending');

    const maxPending = parseInt(settingsMap.max_pending_withdrawals || '2');
    if ((pendingCount || 0) >= maxPending)
      return errorResponse('You have too many pending withdrawals. Wait for them to be processed.');

    /* ── Daily limit ── */
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const { count: todayCount } = await supabase
      .from('withdrawals')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfDay.toISOString());

    const maxDaily = parseInt(settingsMap.max_daily_withdrawals || '3');
    if ((todayCount || 0) >= maxDaily)
      return errorResponse('Daily withdrawal limit reached. Try again tomorrow.');

    /* ── Insert withdrawal ── */
    const { error: withdrawError } = await supabase
      .from('withdrawals')
      .insert({
        user_id:        userId,
        method,
        points_spent:   points,
        amount,
        wallet_address: walletAddress.trim(),
        status:         'pending',
      });

    if (withdrawError) {
      console.error('Withdrawal insert error:', withdrawError);
      return errorResponse('Failed to create withdrawal. Please try again.');
    }

    /* ── Deduct points ── */
    await supabase.from('balances').update({
      points:          balance.points - points,
      total_withdrawn: (balance.total_withdrawn || 0) + points,
    }).eq('user_id', userId);

    /* ── Transaction log ── */
    await supabase.from('transactions').insert({
      user_id:     userId,
      type:        'spend',
      points:      -points,
      description: `💸 Withdrawal: ${amountStr} via ${method.toUpperCase()}`,
    });

    /* ── In-app notification ── */
    await supabase.from('notifications').insert({
      user_id: userId,
      title:   '💸 Withdrawal Submitted',
      message: `Your withdrawal of ${points.toLocaleString()} pts → ${amountStr} is pending review.`,
      type:    'withdrawal',
    });

    /* ── Telegram: user ── */
    if (userData.telegram_id) {
      await sendTelegramMessage(
        userData.telegram_id,
        `💸 <b>Withdrawal Submitted</b>\n\n` +
        `Method: <b>${method.toUpperCase()}</b>\n` +
        `Amount: <b>${amountStr}</b>\n` +
        `Points spent: <b>${points.toLocaleString()}</b>\n` +
        `${addressLabel}: <code>${walletAddress.trim()}</code>\n\n` +
        `Your request is under review. You'll be notified once processed.`
      );
    }

    /* ── Telegram: admin ── */
    const adminTgId = Deno.env.get('ADMIN_TELEGRAM_ID');
    if (adminTgId) {
      await sendTelegramMessage(
        parseInt(adminTgId),
        `🔔 <b>New Withdrawal Request</b>\n\n` +
        `👤 User: <b>${userData.first_name || 'Unknown'}</b> (@${userData.username || 'N/A'})\n` +
        `🆔 ID: <code>${userId}</code>\n` +
        `💳 Method: <b>${method.toUpperCase()}</b>\n` +
        `💰 Amount: <b>${amountStr}</b>\n` +
        `🪙 Points: <b>${points.toLocaleString()}</b>\n` +
        `${addressLabel}: <code>${walletAddress.trim()}</code>`
      );
    }

    return successResponse('Withdrawal request submitted successfully!');

  } catch (error) {
    console.error('Withdraw edge function error:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
