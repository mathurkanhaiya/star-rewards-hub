import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireTelegramUser, secureCorsHeaders as corsHeaders } from "../_shared/telegramAuth.ts";

function startOfConfiguredDay(offsetMinutes:number){const shifted=new Date(Date.now()+offsetMinutes*60000);const startShifted=new Date(Date.UTC(shifted.getUTCFullYear(),shifted.getUTCMonth(),shifted.getUTCDate()));return new Date(startShifted.getTime()-offsetMinutes*60000)}

serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:corsHeaders});
 try{
  const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const{appUser}=await requireTelegramUser(req,supabase);const userId=appUser.id;
  const{adType,provider='adsgram'}=await req.json();
  if(adType!=='ad_watch')throw new Error('Invalid rewarded ad type');
  if(!['adsgram','monetag','gigapub'].includes(provider))throw new Error('Invalid ad provider');
  const{data:settings}=await supabase.from('settings').select('key,value').in('key',['ad_reward_points','max_ads_per_hour','max_ads_per_day','ad_cooldown_seconds','daily_reset_offset_minutes']);
  const map=Object.fromEntries((settings||[]).map((s:any)=>[s.key,s.value]));
  const rewardGiven=Math.max(0,Math.min(10000,Number(map.ad_reward_points??50)||0));
  const hourlyLimit=Math.max(1,Math.min(100,Number(map.max_ads_per_hour??10)||10));
  const dailyLimit=Math.max(hourlyLimit,Math.min(1000,Number(map.max_ads_per_day??50)||50));
  const cooldown=Math.max(0,Math.min(3600,Number(map.ad_cooldown_seconds??10)||0));
  const resetOffset=Math.max(-720,Math.min(840,Number(map.daily_reset_offset_minutes??330)||330));
  const hourStart=new Date(Date.now()-3600000).toISOString();const dayStart=startOfConfiguredDay(resetOffset).toISOString();
  const[{count:hourCount},{count:dayCount},{data:last}]=await Promise.all([
   supabase.from('ad_logs').select('id',{count:'exact',head:true}).eq('user_id',userId).eq('ad_type','ad_watch').gte('created_at',hourStart),
   supabase.from('ad_logs').select('id',{count:'exact',head:true}).eq('user_id',userId).eq('ad_type','ad_watch').gte('created_at',dayStart),
   supabase.from('ad_logs').select('created_at').eq('user_id',userId).eq('ad_type','ad_watch').order('created_at',{ascending:false}).limit(1).maybeSingle()
  ]);
  if((hourCount||0)>=hourlyLimit)return new Response(JSON.stringify({success:false,message:'Hourly ad limit reached'}),{headers:{...corsHeaders,'Content-Type':'application/json'}});
  if((dayCount||0)>=dailyLimit)return new Response(JSON.stringify({success:false,message:'Daily ad limit reached'}),{headers:{...corsHeaders,'Content-Type':'application/json'}});
  if(cooldown>0&&last?.created_at){const wait=cooldown-Math.floor((Date.now()-new Date(last.created_at).getTime())/1000);if(wait>0)return new Response(JSON.stringify({success:false,message:`Next ad available in ${wait}s`,retryAfter:wait}),{status:429,headers:{...corsHeaders,'Content-Type':'application/json'}})}
  await supabase.from('ad_logs').insert({user_id:userId,ad_type:'ad_watch',reward_given:rewardGiven,provider});
  if(rewardGiven>0){await supabase.rpc('increment_points',{p_user_id:userId,p_points:rewardGiven});await supabase.from('transactions').insert({user_id:userId,type:'ad_reward',points:rewardGiven,description:`Ad reward: ${provider}`})}
  const now=new Date().toISOString();const{data:contests}=await supabase.from('contests').select('id').eq('contest_type','ads_watch').eq('is_active',true).lte('starts_at',now).gte('ends_at',now);
  for(const contest of contests||[]){const{data:existing}=await supabase.from('contest_entries').select('id,score').eq('contest_id',contest.id).eq('user_id',userId).maybeSingle();if(existing)await supabase.from('contest_entries').update({score:Number(existing.score)+1,updated_at:now}).eq('id',existing.id);else await supabase.from('contest_entries').insert({contest_id:contest.id,user_id:userId,score:1})}
  return new Response(JSON.stringify({success:true,points:rewardGiven,count:(dayCount||0)+1}),{headers:{...corsHeaders,'Content-Type':'application/json'}});
 }catch(error){const message=(error as Error).message;const status=/Telegram|registered|banned|expired|signature/i.test(message)?401:400;return new Response(JSON.stringify({success:false,message}),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})}
});