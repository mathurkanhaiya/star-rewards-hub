import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { requireTelegramUser, secureCorsHeaders as corsHeaders } from "../_shared/telegramAuth.ts";

const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});

async function requireAdmin(sb:ReturnType<typeof createClient>,telegramId:number){
  const fallback=Number(Deno.env.get('ADMIN_TELEGRAM_ID')||'2139807311');
  const {data}=await sb.from('settings').select('value').eq('key','bot_admin_telegram_ids').maybeSingle();
  const allowed=new Set(String(data?.value||fallback).split(',').map(v=>Number(v.trim())).filter(Number.isSafeInteger));
  if(!allowed.has(telegramId))throw new Error('Admin access required');
}

serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response(null,{headers:corsHeaders});
  try{
    const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
    const {telegramUser}=await requireTelegramUser(req,sb);
    await requireAdmin(sb,telegramUser.id);
    const body=await req.json().catch(()=>({}));
    const userId=String(body.userId||'');
    const banned=Boolean(body.banned);
    const reason=banned?String(body.reason||'').trim().slice(0,500):null;
    if(!userId)throw new Error('User ID required');
    if(banned&&!reason)throw new Error('Ban reason required');
    const {data,error}=await sb.from('users').update({is_banned:banned,ban_reason:reason}).eq('id',userId).select('id,is_banned,ban_reason').single();
    if(error)throw error;
    try{await sb.from('admin_logs').insert({admin_telegram_id:telegramUser.id,action:banned?'user_ban':'user_unban',target_user_id:userId,details:{reason}})}catch{}
    return json({success:true,data});
  }catch(error){
    const message=(error as Error).message;
    const status=/Admin access/i.test(message)?403:/Telegram|registered|banned|expired|signature/i.test(message)?401:400;
    return json({success:false,message,error:message},status);
  }
});
