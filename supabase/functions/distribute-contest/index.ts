import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireTelegramUser, secureCorsHeaders as corsHeaders } from "../_shared/telegramAuth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { telegramUser }=await requireTelegramUser(req,supabase);
    if (telegramUser.id!==Number(Deno.env.get('ADMIN_TELEGRAM_ID')||'2139807311')) throw new Error('Admin access required');
    const { contestId }=await req.json();
    if (!contestId) throw new Error('Missing contestId');

    const { data: contest }=await supabase.from('contests').select('*').eq('id',contestId).single();
    if (!contest) throw new Error('Contest not found');
    if (contest.rewards_distributed) return new Response(JSON.stringify({success:false,message:'Rewards already distributed'}),{headers:{...corsHeaders,'Content-Type':'application/json'}});

    // Claim the distribution lock first so repeated/concurrent requests cannot double-pay winners.
    const { data: locked }=await supabase.from('contests').update({rewards_distributed:true,is_active:false}).eq('id',contestId).eq('rewards_distributed',false).select('id').maybeSingle();
    if (!locked) throw new Error('Contest already being processed');

    const { data: entries }=await supabase.from('contest_entries').select('user_id,score').eq('contest_id',contestId).order('score',{ascending:false}).limit(5);
    if (!entries?.length) return new Response(JSON.stringify({success:false,message:'No entries found'}),{headers:{...corsHeaders,'Content-Type':'application/json'}});

    const rewards=[contest.reward_1st,contest.reward_2nd,contest.reward_3rd,contest.reward_4th,contest.reward_5th];
    const medals=['🥇','🥈','🥉','4th','5th'];
    let paid=0;
    for (let i=0;i<entries.length;i++) {
      const reward=Number(rewards[i]||0);
      if (!Number.isInteger(reward)||reward<=0||reward>100000000) continue;
      await supabase.rpc('increment_points',{p_user_id:entries[i].user_id,p_points:reward});
      await Promise.all([
        supabase.from('transactions').insert({user_id:entries[i].user_id,type:'contest_reward',points:reward,description:`🏆 ${medals[i]} Contest "${contest.title}" reward!`,reference_id:contestId}),
        supabase.from('notifications').insert({user_id:entries[i].user_id,title:'🏆 Contest Winner!',message:`You placed ${medals[i]} in "${contest.title}" and won ${reward.toLocaleString()} points!`,type:'reward'}),
      ]);
      paid++;
    }
    await supabase.from('admin_logs').insert({admin_telegram_id:telegramUser.id,action:'contest_distributed',details:{contestId,winners:paid}});
    return new Response(JSON.stringify({success:true,message:`Rewards distributed to ${paid} winners!`}),{headers:{...corsHeaders,'Content-Type':'application/json'}});
  } catch(error) {
    const message=(error as Error).message;
    const status=/Admin access/i.test(message)?403:/Telegram|registered|banned|expired|signature/i.test(message)?401:400;
    return new Response(JSON.stringify({success:false,message}),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
  }
});
