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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { withdrawalId, status, adminNote } = await req.json();
    if (!withdrawalId || !status) throw new Error('Missing fields');

    // Get withdrawal + user
    const { data: withdrawal } = await supabase
      .from('withdrawals')
      .select('user_id, points_spent, amount, method')
      .eq('id', withdrawalId)
      .single();

    if (!withdrawal) throw new Error('Withdrawal not found');

    // Update withdrawal status
    const { error } = await supabase
      .from('withdrawals')
      .update({ status, admin_note: adminNote || null, processed_at: new Date().toISOString() })
      .eq('id', withdrawalId);

    if (error) throw error;

    // If rejected, refund
    if (status === 'rejected') {
      const { data: balance } = await supabase
        .from('balances')
        .select('points, total_withdrawn')
        .eq('user_id', withdrawal.user_id)
        .single();

      if (balance) {
        await supabase.from('balances').update({
          points: balance.points + withdrawal.points_spent,
          total_withdrawn: Math.max(0, (balance.total_withdrawn || 0) - withdrawal.points_spent),
        }).eq('user_id', withdrawal.user_id);

        await supabase.from('transactions').insert({
          user_id: withdrawal.user_id,
          type: 'refund',
          points: withdrawal.points_spent,
          description: `🔄 Withdrawal rejected — ${withdrawal.points_spent.toLocaleString()} pts refunded`,
        });
      }
    }

    // In-app notification
    const notifTitle = status === 'approved' ? '✅ Withdrawal Approved!' : '❌ Withdrawal Rejected';
    const notifMsg = status === 'approved'
      ? `Your withdrawal of ${Number(withdrawal.amount).toFixed(2)} ${withdrawal.method.toUpperCase()} has been approved and is being processed.`
      : `Your withdrawal of ${Number(withdrawal.amount).toFixed(2)} ${withdrawal.method.toUpperCase()} was rejected. ${withdrawal.points_spent.toLocaleString()} points refunded.${adminNote ? ` Reason: ${adminNote}` : ''}`;

    await supabase.from('notifications').insert({
      user_id: withdrawal.user_id,
      title: notifTitle,
      message: notifMsg,
      type: 'withdrawal',
    });

    // Telegram bot alert to user
    const { data: userData } = await supabase.from('users').select('telegram_id').eq('id', withdrawal.user_id).single();
    if (userData) {
      const tgMsg = status === 'approved'
        ? `✅ <b>Withdrawal Approved!</b>\n\nYour withdrawal of <b>${Number(withdrawal.amount).toFixed(2)} ${withdrawal.method.toUpperCase()}</b> has been approved and is being processed! 🎉`
        : `❌ <b>Withdrawal Rejected</b>\n\nYour withdrawal of ${Number(withdrawal.amount).toFixed(2)} ${withdrawal.method.toUpperCase()} was rejected.\n${withdrawal.points_spent.toLocaleString()} points have been refunded.${adminNote ? `\nReason: ${adminNote}` : ''}`;

      await sendTelegramMessage(userData.telegram_id, tgMsg);
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
