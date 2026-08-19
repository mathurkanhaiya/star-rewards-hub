import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireTelegramUser, secureCorsHeaders as corsHeaders } from "../_shared/telegramAuth.ts";

const num=(m:Record<string,string>,k:string,f:number,min=0,max=1e9)=>Math.max(min,Math.min(max,Number(m[k]??f)));
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
function dayKey(offsetMinutes:number,date=new Date()){const shifted=new Date(date.getTime()+offsetMinutes*60000);return shifted.toISOString().slice(0,10)}
function nextReset(offsetMinutes:number){const now=new Date();const shifted=new Date(now.getTime()+offsetMinutes*60000);const next=new Date(Date.UTC(shifted.getUTCFullYear(),shifted.getUTCMonth(),shifted.getUTCDate()+1));return new Date(next.getTime()-offsetMinutes*60000).toISOString()}

serve(async(req)=>{
 if(req.method==='OPTIONS') return new Response(null,{headers:corsHeaders});
 try{
  const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {appUser}=await requireTelegramUser(req,supabase); const userId=appUser.id;
  const body=await req.json().catch(()=>({})); const action=String(body.action||'state');
  const {data:rows,error:settingsError}=await supabase.from('settings').select('key,value'); if(settingsError) throw settingsError;
  const settings=Object.fromEntries((rows||[]).map((r:any)=>[r.key,String(r.value)]));
  const farmMinutes=num(settings,'farm_duration_minutes',15,1,10080); const farmReward=Math.floor(num(settings,'farm_reward_points',100,0,1e7));
  const dropBase=Math.floor(num(settings,'daily_drop_base',100,0,1e7)); const dropInc=Math.floor(num(settings,'daily_drop_increment',10,0,1e7)); const dropMax=Math.floor(num(settings,'daily_drop_max_days',7,1,365));
  const resetOffset=Math.floor(num(settings,'daily_reset_offset_minutes',330,-720,840));
  const {data:state}=await supabase.from('home_reward_state').select('farm_started_at,last_farm_claim_at,last_drop_date,drop_streak').eq('user_id',userId).maybeSingle();
  const today=dayKey(resetOffset); const claimedToday=String(state?.last_drop_date||'')===today;
  const farmStartedAt=state?.farm_started_at?new Date(state.farm_started_at):null; const farmReadyAt=farmStartedAt?new Date(farmStartedAt.getTime()+farmMinutes*60000):null;
  const common={farm:{startedAt:farmStartedAt?.toISOString()||null,readyAt:farmReadyAt?.toISOString()||null,durationMinutes:farmMinutes,rewardPoints:farmReward},drop:{claimedToday,streak:Number(state?.drop_streak||0),base:dropBase,increment:dropInc,maxDays:dropMax,nextResetAt:nextReset(resetOffset)}};
  if(action==='state') return json({success:true,data:common});
  if(action==='farm-start'){
   if(farmStartedAt && farmReadyAt && farmReadyAt.getTime()>Date.now()) return json({success:false,message:'Farm already running',data:common},409);
   const now=new Date().toISOString(); const {error}=await supabase.from('home_reward_state').upsert({user_id:userId,farm_started_at:now,updated_at:now},{onConflict:'user_id'}); if(error) throw error;
   return json({success:true,data:{...common,farm:{...common.farm,startedAt:now,readyAt:new Date(Date.now()+farmMinutes*60000).toISOString()}}});
  }
  if(action==='farm-claim'){
   if(!farmStartedAt) return json({success:false,message:'Start farming first'},409);
   if(!farmReadyAt || farmReadyAt.getTime()>Date.now()) return json({success:false,message:'Farm is not ready yet',readyAt:farmReadyAt?.toISOString()},409);
   const now=new Date().toISOString(); const {error:updateError}=await supabase.from('home_reward_state').update({farm_started_at:null,last_farm_claim_at:now,updated_at:now}).eq('user_id',userId).eq('farm_started_at',state!.farm_started_at); if(updateError) throw updateError;
   if(farmReward>0){await supabase.rpc('increment_points',{p_user_id:userId,p_points:farmReward}); await supabase.from('transactions').insert({user_id:userId,type:'farm_claim',points:farmReward,description:`Farm reward: +${farmReward} pts`});}
   return json({success:true,points:farmReward,data:{...common,farm:{...common.farm,startedAt:null,readyAt:null}}});
  }
  if(action==='daily-drop'){
   if(claimedToday) return json({success:false,message:'Daily drop already claimed',data:common},409);
   const yesterday=dayKey(resetOffset,new Date(Date.now()-86400000)); const nextStreak=String(state?.last_drop_date||'')===yesterday?Math.min(dropMax,Number(state?.drop_streak||0)+1):1; const points=dropBase+(nextStreak-1)*dropInc; const now=new Date().toISOString();
   const {error:upsertError}=await supabase.from('home_reward_state').upsert({user_id:userId,last_drop_date:today,drop_streak:nextStreak,updated_at:now},{onConflict:'user_id'}); if(upsertError) throw upsertError;
   await supabase.from('daily_claims').upsert({user_id:userId,claim_date:today,day_streak:nextStreak,points_earned:points,claimed_at:now},{onConflict:'user_id,claim_date'});
   if(points>0){await supabase.rpc('increment_points',{p_user_id:userId,p_points:points}); await supabase.from('transactions').insert({user_id:userId,type:'daily_drop',points,description:`Daily Drop Day ${nextStreak}: +${points} pts`});}
   return json({success:true,points,streak:nextStreak,data:{...common,drop:{...common.drop,claimedToday:true,streak:nextStreak}}});
  }
  return json({success:false,message:'Unknown action'},400);
 }catch(error){const message=(error as Error).message;return json({success:false,message,error:message},/Telegram|registered|banned|expired|signature/i.test(message)?401:400)}
});
