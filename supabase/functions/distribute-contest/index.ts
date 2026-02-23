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

    const { contestId } = await req.json();
    if (!contestId) throw new Error('Missing contestId');

    const { data: contest } = await supabase.from('contests').select('*').eq('id', contestId).single();
    if (!contest) throw new Error('Contest not found');
    if (contest.rewards_distributed) {
      return new Response(JSON.stringify({ success: false, message: 'Rewards already distributed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: entries } = await supabase
      .from('contest_entries')
      .select('user_id, score')
      .eq('contest_id', contestId)
      .order('score', { ascending: false })
      .limit(5);

    if (!entries || entries.length === 0) {
      return new Response(JSON.stringify({ success: false, message: 'No entries found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const rewards = [contest.reward_1st, contest.reward_2nd, contest.reward_3rd, contest.reward_4th, contest.reward_5th];
    const medals = ['🥇', '🥈', '🥉', '4th', '5th'];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const reward = rewards[i] || 0;
      if (reward <= 0) continue;

      await supabase.rpc('increment_points', { p_user_id: entry.user_id, p_points: reward });

      await supabase.from('transactions').insert({
        user_id: entry.user_id, type: 'contest_reward', points: reward,
        description: `🏆 ${medals[i]} Contest "${contest.title}" reward!`,
      });

      await supabase.from('notifications').insert({
        user_id: entry.user_id,
        title: '🏆 Contest Winner!',
        message: `You placed ${medals[i]} in "${contest.title}" and won ${reward.toLocaleString()} points!`,
        type: 'reward',
      });

      // Send TG bot alert to winner
      const { data: userData } = await supabase.from('users').select('telegram_id').eq('id', entry.user_id).single();
      if (userData) {
        await sendTelegramMessage(userData.telegram_id,
          `🏆 <b>Contest Winner!</b>\n\nYou placed <b>${medals[i]}</b> in "${contest.title}"!\n+${reward.toLocaleString()} points added! 🎉`
        );
      }
    }

    await supabase.from('contests').update({ rewards_distributed: true, is_active: false }).eq('id', contestId);

    return new Response(JSON.stringify({ success: true, message: `Rewards distributed to ${entries.length} winners!` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
