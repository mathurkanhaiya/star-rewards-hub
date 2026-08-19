import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyTelegramInitData, secureCorsHeaders as corsHeaders } from "../_shared/telegramAuth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const initData = req.headers.get('x-telegram-init-data') || '';
    const telegramUser = await verifyTelegramInitData(initData, Deno.env.get('TELEGRAM_BOT_TOKEN') || '');
    const { referralCode } = await req.json().catch(() => ({}));

    const { data: existingUser } = await supabase.from('users').select('*').eq('telegram_id', telegramUser.id).maybeSingle();
    if (existingUser) {
      if (existingUser.is_banned) return new Response(JSON.stringify({ error:'Account is banned' }), { status:403, headers:{...corsHeaders,'Content-Type':'application/json'} });
      const { data: updated } = await supabase.from('users').update({
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name || null,
        username: telegramUser.username || null,
        photo_url: telegramUser.photo_url || null,
        last_active_at: new Date().toISOString(),
      }).eq('id', existingUser.id).select().single();
      return new Response(JSON.stringify({ user: updated || existingUser }), { headers:{...corsHeaders,'Content-Type':'application/json'} });
    }

    const safeReferral = typeof referralCode === 'string' && /^\d{1,20}$/.test(referralCode) ? referralCode : undefined;
    let referrerId: string | null = null;
    if (safeReferral && safeReferral !== String(telegramUser.id)) {
      const { data: referrer } = await supabase.from('users').select('id').eq('telegram_id', Number(safeReferral)).maybeSingle();
      referrerId = referrer?.id || null;
    }

    const { data: newUser, error: userError } = await supabase.from('users').insert({
      telegram_id: telegramUser.id,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name || null,
      username: telegramUser.username || null,
      photo_url: telegramUser.photo_url || null,
      referral_code: String(telegramUser.id),
      referred_by: referrerId ? Number(safeReferral) : null,
    }).select().single();
    if (userError || !newUser) throw userError || new Error('Failed to create user');

    await supabase.from('balances').insert({ user_id:newUser.id, points:0 });
    const { data: settings } = await supabase.from('settings').select('key,value').in('key',['welcome_bonus']);
    const map=Object.fromEntries((settings||[]).map((s)=>[s.key,s.value]));
    const welcomeBonus=Math.max(0,Math.min(100000,Number(map.welcome_bonus||200)));

    if (welcomeBonus>0) {
      await supabase.rpc('increment_points',{p_user_id:newUser.id,p_points:welcomeBonus});
      await supabase.from('transactions').insert({user_id:newUser.id,type:'bonus',points:welcomeBonus,description:'🎉 Welcome bonus'});
    }

    if (referrerId) {
      const { error: refError } = await supabase.from('referrals').insert({
        referrer_id:referrerId,
        referred_id:newUser.id,
        points_earned:0,
        is_verified:false,
      });
      if (!refError) {
        await supabase.from('notifications').insert([
          {
            user_id:referrerId,
            title:'👥 New referral joined',
            message:`${telegramUser.first_name} joined using your link. Their referral becomes valid after 1 task and 1 verified ad.`,
            type:'referral',
          },
          {
            user_id:newUser.id,
            title:'🎁 Referral reward pending',
            message:'Complete 1 task and watch 1 verified ad to unlock both referral rewards.',
            type:'referral',
          },
        ]);
      }
    }

    const { data: finalUser } = await supabase.from('users').select('*').eq('id',newUser.id).single();
    return new Response(JSON.stringify({ user: finalUser || newUser }), { headers:{...corsHeaders,'Content-Type':'application/json'} });
  } catch (error) {
    const message=(error as Error).message;
    const status=/Telegram|expired|signature|authentication/i.test(message)?401:400;
    return new Response(JSON.stringify({ error:message }), {status,headers:{...corsHeaders,'Content-Type':'application/json'}});
  }
});
