import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireTelegramUser, secureCorsHeaders as corsHeaders } from "../_shared/telegramAuth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { telegramUser } = await requireTelegramUser(req, supabase);
    const adminId = Number(Deno.env.get('ADMIN_TELEGRAM_ID') || '2139807311');
    if (telegramUser.id !== adminId) throw new Error('Admin access required');

    const { withdrawalId, status, adminNote } = await req.json();
    if (!withdrawalId || !['approved','rejected'].includes(status)) throw new Error('Invalid withdrawal update');

    const { data: withdrawal } = await supabase.from('withdrawals')
      .select('user_id,points_spent,amount,method,status')
      .eq('id', withdrawalId).single();
    if (!withdrawal) throw new Error('Withdrawal not found');
    if (withdrawal.status !== 'pending') throw new Error('Withdrawal already processed');

    const { data: updated, error } = await supabase.from('withdrawals')
      .update({ status, admin_note:String(adminNote || '').slice(0,500) || null, processed_at:new Date().toISOString() })
      .eq('id', withdrawalId).eq('status','pending').select('id').maybeSingle();
    if (error || !updated) throw new Error('Withdrawal status changed; refresh and try again');

    if (status === 'rejected') {
      const { data: balance } = await supabase.from('balances').select('points,total_withdrawn').eq('user_id', withdrawal.user_id).single();
      if (balance) {
        await supabase.from('balances').update({
          points:Number(balance.points)+Number(withdrawal.points_spent),
          total_withdrawn:Math.max(0,Number(balance.total_withdrawn||0)-Number(withdrawal.points_spent)),
        }).eq('user_id',withdrawal.user_id);
        await supabase.from('transactions').insert({
          user_id:withdrawal.user_id,type:'refund',points:withdrawal.points_spent,
          description:`🔄 Withdrawal rejected — ${Number(withdrawal.points_spent).toLocaleString()} pts refunded`,
          reference_id:withdrawalId,
        });
      }
    }

    const methodLabel = withdrawal.method === 'usdt_polygon'
      ? 'USDT · Polygon'
      : withdrawal.method === 'ton'
        ? 'GRAM (TON)'
        : withdrawal.method === 'upi'
          ? 'INR · UPI'
          : String(withdrawal.method).toUpperCase();
    const amountLabel = withdrawal.method === 'upi'
      ? `₹${Number(withdrawal.amount).toFixed(2)}`
      : withdrawal.method === 'usdt_polygon'
        ? `${Number(withdrawal.amount).toFixed(4)} USDT`
        : `${Number(withdrawal.amount).toFixed(4)} TON`;

    const title=status==='approved'?'✅ Withdrawal Approved!':'❌ Withdrawal Rejected';
    const message=status==='approved'
      ? `Your ${methodLabel} withdrawal of ${amountLabel} was approved.`
      : `Your ${methodLabel} withdrawal was rejected and ${Number(withdrawal.points_spent).toLocaleString()} points were refunded.${adminNote?` Reason: ${String(adminNote).slice(0,300)}`:''}`;
    await supabase.from('notifications').insert({ user_id:withdrawal.user_id,title,message,type:'withdrawal' });

    await supabase.from('admin_logs').insert({ admin_telegram_id:telegramUser.id, action:`withdrawal_${status}`, target_user_id:withdrawal.user_id, details:{ withdrawalId, method:withdrawal.method, adminNote:String(adminNote||'').slice(0,500) } });
    return new Response(JSON.stringify({success:true}),{headers:{...corsHeaders,'Content-Type':'application/json'}});
  } catch(error) {
    const message=(error as Error).message;
    const status=/Admin access/i.test(message)?403:/Telegram|registered|banned|expired|signature/i.test(message)?401:400;
    return new Response(JSON.stringify({success:false,message}),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
  }
});
