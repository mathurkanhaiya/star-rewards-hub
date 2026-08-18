import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireTelegramUser, secureCorsHeaders as corsHeaders } from "../_shared/telegramAuth.ts";

const TON_TIERS: Record<number, number> = { 5000: 0.05, 10000: 0.1, 15000: 0.15, 20000: 0.2 };
const UPI_RATE = 0.0012;

function response(success: boolean, message: string, status = 200) {
  return new Response(JSON.stringify({ success, message }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { appUser } = await requireTelegramUser(req, supabase);
    const userId = appUser.id;
    const body = await req.json();
    const { method, points, walletAddress } = body;

    if (!['ton', 'upi'].includes(method)) return response(false, 'Invalid withdrawal method');
    if (!Number.isInteger(points) || points <= 0) return response(false, 'Invalid points');
    if (!walletAddress?.trim() || walletAddress.length > 256) return response(false, 'Wallet/UPI address is required');
    if (method === 'ton' && !/^UQ[A-Za-z0-9_-]{46,}$/.test(walletAddress.trim())) return response(false, 'Invalid TON wallet address format');
    if (method === 'upi' && !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(walletAddress.trim())) return response(false, 'Invalid UPI ID format');

    const { data: settings } = await supabase.from('settings').select('key,value');
    const map = Object.fromEntries((settings || []).map((s) => [s.key, s.value]));
    const minPoints = Number(map.min_withdrawal_points || 5000);
    if (points < minPoints) return response(false, `Minimum withdrawal is ${minPoints.toLocaleString()} points`);

    let amount: number;
    if (method === 'ton') {
      amount = TON_TIERS[points];
      if (!amount) return response(false, `Invalid TON tier. Valid: ${Object.keys(TON_TIERS).join(', ')} pts`);
    } else {
      amount = Number((points * UPI_RATE).toFixed(2));
      if (amount <= 0) return response(false, 'Invalid withdrawal amount');
    }

    const { data: balance } = await supabase.from('balances').select('points,total_withdrawn').eq('user_id', userId).single();
    if (!balance) return response(false, 'Balance not found');
    if (Number(balance.points) < points) return response(false, 'Insufficient balance');

    const [{ count: pendingCount }, { count: todayCount }] = await Promise.all([
      supabase.from('withdrawals').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'pending'),
      (() => { const d = new Date(); d.setUTCHours(0,0,0,0); return supabase.from('withdrawals').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', d.toISOString()); })(),
    ]);
    if ((pendingCount || 0) >= Number(map.max_pending_withdrawals || 2)) return response(false, 'Too many pending withdrawals');
    if ((todayCount || 0) >= Number(map.max_daily_withdrawals || 3)) return response(false, 'Daily withdrawal limit reached');

    // Optimistic concurrency guard: deduct only if the balance still has enough points.
    const newBalance = Number(balance.points) - points;
    const { data: deducted, error: deductError } = await supabase
      .from('balances')
      .update({ points: newBalance, total_withdrawn: Number(balance.total_withdrawn || 0) + points })
      .eq('user_id', userId)
      .eq('points', balance.points)
      .select('points')
      .maybeSingle();
    if (deductError || !deducted) return response(false, 'Balance changed. Please try again.');

    const { data: withdrawal, error: withdrawError } = await supabase.from('withdrawals').insert({
      user_id: userId,
      method,
      points_spent: points,
      amount,
      wallet_address: walletAddress.trim(),
      status: 'pending',
    }).select('id').single();

    if (withdrawError || !withdrawal) {
      await supabase.from('balances').update({ points: Number(balance.points), total_withdrawn: Number(balance.total_withdrawn || 0) }).eq('user_id', userId).eq('points', newBalance);
      return response(false, 'Failed to create withdrawal');
    }

    const amountStr = method === 'upi' ? `₹${amount} INR` : `${amount.toFixed(2)} TON`;
    await Promise.all([
      supabase.from('transactions').insert({ user_id: userId, type: 'spend', points: -points, description: `💸 Withdrawal: ${amountStr} via ${method.toUpperCase()}`, reference_id: withdrawal.id }),
      supabase.from('notifications').insert({ user_id: userId, title: '💸 Withdrawal Submitted', message: `Your ${points.toLocaleString()} point withdrawal is pending review.`, type: 'withdrawal' }),
    ]);

    return response(true, 'Withdrawal request submitted successfully!');
  } catch (error) {
    const message = (error as Error).message;
    const status = /Telegram|registered|banned|expired|signature/i.test(message) ? 401 : 400;
    return response(false, message, status);
  }
});
