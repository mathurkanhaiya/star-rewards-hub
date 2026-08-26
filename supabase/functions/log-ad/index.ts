import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireTelegramUser, secureCorsHeaders as corsHeaders } from "../_shared/telegramAuth.ts";

type AdProvider = 'adsgram' | 'monetag' | 'gigapub';
type ClaimResult = { success:boolean; message?:string; points?:number; count?:number; limit?:number; retryAfter?:number; nextAvailableAt?:string|null; nextResetAt?:string };
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});

serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response(null,{headers:corsHeaders});
  const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let providerName='unknown';let userId:string|null=null;let adKind='unknown';
  try{
    const{appUser}=await requireTelegramUser(req,supabase);userId=appUser.id;
    const body=await req.json();const{adType,provider='adsgram',blockId}=body;providerName=String(provider);adKind=String(adType);
    if(adType==='adsgram_task'){
      providerName='adsgram';
      if(blockId!=='task-25198')throw new Error('Invalid Adsgram task block');
      const{data,error}=await supabase.rpc('claim_adsgram_task_reward',{p_user_id:appUser.id});if(error)throw error;
      return json(data||{success:false,message:'Task reward could not be verified'});
    }
    if(adType==='ad_partial'){
      if(provider!=='adsgram')throw new Error('Partial reward is only available for AdsGram');
      const{data,error}=await supabase.rpc('claim_ad_partial_reward',{p_user_id:appUser.id,p_provider:'adsgram'});if(error)throw error;
      return json(data||{success:false,message:'Partial ad reward could not be credited'});
    }
    if(adType!=='ad_watch')throw new Error('Invalid rewarded ad type');
    if(!['adsgram','monetag','gigapub'].includes(provider))throw new Error('Invalid ad provider');
    const{data,error}=await supabase.rpc('claim_ad_reward',{p_user_id:appUser.id,p_provider:provider as AdProvider});if(error)throw error;
    const result=(data||{success:false,message:'Ad reward could not be verified'}) as ClaimResult;
    if(!result.success)return json(result,result.retryAfter?429:200);
    const now=new Date().toISOString();const{data:contests}=await supabase.from('contests').select('id').eq('contest_type','ads_watch').eq('is_active',true).lte('starts_at',now).gte('ends_at',now);
    for(const contest of contests||[]){const{error:scoreError}=await supabase.rpc('increment_contest_score',{p_contest_id:contest.id,p_user_id:appUser.id,p_delta:1});if(scoreError)console.error('Contest score update failed:',scoreError.message)}
    return json(result);
  }catch(error){
    const message=(error as Error).message;
    if(providerName!=='unknown')await supabase.from('ad_provider_errors').insert({user_id:userId,provider:providerName,error_message:message.slice(0,1000),context:{adType:adKind}}).catch(()=>{});
    const status=/Telegram|registered|banned|expired|signature/i.test(message)?401:400;
    return json({success:false,message},status);
  }
});