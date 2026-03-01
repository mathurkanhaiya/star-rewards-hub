import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version',
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

    const { telegramUser, referralCode } = await req.json();

    if (!telegramUser?.id) {
      return new Response(JSON.stringify({ error: 'No telegram user' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramUser.id)
      .single();

    if (existingUser) {
      await supabase
        .from('users')
        .update({ last_active_at: new Date().toISOString(), photo_url: telegramUser.photo_url })
        .eq('id', existingUser.id);

      return new Response(JSON.stringify({ user: existingUser }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create new user
    const referralCodeGen = `${telegramUser.id}`;

    let referrerId: string | null = null;
    if (referralCode && referralCode !== String(telegramUser.id)) {
      const { data: referrer } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', parseInt(referralCode))
        .single();
      if (referrer) referrerId = referrer.id;
    }

    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        telegram_id: telegramUser.id,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name || null,
        username: telegramUser.username || null,
        photo_url: telegramUser.photo_url || null,
        referral_code: referralCodeGen,
        referred_by: referralCode ? parseInt(referralCode) : null,
      })
      .select()
      .single();

    if (userError) throw userError;

    await supabase.from('balances').insert({ user_id: newUser.id, points: 200 });

    const { data: settings } = await supabase.from('settings').select('key, value');
    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: { key: string; value: string }) => { settingsMap[s.key] = s.value; });

    const welcomeBonus = 200;
    const referralBonus = parseInt(settingsMap.points_per_referral || '500');
    const referredBonus = parseInt(settingsMap.referral_bonus_referred || '200');

    await supabase.from('transactions').insert({
      user_id: newUser.id, type: 'bonus', points: welcomeBonus,
      description: '🎉 Welcome bonus',
    });

    // Send welcome message via bot
    await sendTelegramMessage(telegramUser.id,
      `🎉 <b>Welcome to the app!</b>\n\nYou received <b>${welcomeBonus} points</b> as a welcome bonus!\n\nComplete tasks, spin the wheel, and invite friends to earn more! 🚀`
    );

    // Handle referral
    if (referrerId) {
      await supabase.from('referrals').insert({
        referrer_id: referrerId, referred_id: newUser.id,
        points_earned: referralBonus, is_verified: true,
      });

      await supabase.rpc('increment_points', { p_user_id: referrerId, p_points: referralBonus });
      await supabase.from('transactions').insert({
        user_id: referrerId, type: 'referral', points: referralBonus,
        description: `👥 Referral bonus from @${telegramUser.username || telegramUser.first_name}`,
      });

      await supabase.from('notifications').insert({
        user_id: referrerId,
        title: '👥 New Referral!',
        message: `@${telegramUser.username || telegramUser.first_name} joined using your link! +${referralBonus} points!`,
        type: 'referral',
      });

      // Send TG bot alert to referrer
      const { data: referrerUser } = await supabase.from('users').select('telegram_id').eq('id', referrerId).single();
      if (referrerUser) {
        await sendTelegramMessage(referrerUser.telegram_id,
          `👥 <b>New Referral!</b>\n\n@${telegramUser.username || telegramUser.first_name} joined using your link!\n+${referralBonus} points added to your balance! 🎉`
        );
      }

      // Award referred user
      await supabase.rpc('increment_points', { p_user_id: newUser.id, p_points: referredBonus });
      await supabase.from('transactions').insert({
        user_id: newUser.id, type: 'referral', points: referredBonus,
        description: '🔗 Joined via referral bonus',
      });

      // Track active invite contests
      const now = new Date().toISOString();
      const { data: inviteContests } = await supabase
        .from('contests')
        .select('id')
        .eq('contest_type', 'invite')
        .eq('is_active', true)
        .lte('starts_at', now)
        .gte('ends_at', now);

      if (inviteContests && inviteContests.length > 0) {
        for (const contest of inviteContests) {
          const { data: existing } = await supabase
            .from('contest_entries')
            .select('id, score')
            .eq('contest_id', contest.id)
            .eq('user_id', referrerId)
            .single();

          if (existing) {
            await supabase.from('contest_entries').update({
              score: existing.score + 1, updated_at: now,
            }).eq('id', existing.id);
          } else {
            await supabase.from('contest_entries').insert({
              contest_id: contest.id, user_id: referrerId, score: 1,
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({ user: newUser }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('telegram-auth error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
