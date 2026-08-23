import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireTelegramUser, secureCorsHeaders as corsHeaders } from "../_shared/telegramAuth.ts";

const PROMO_CHANNEL='@AdsRewards';
const MINI_APP_URL='https://t.me/Adsrewartsbot/app';
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
const esc=(v:unknown)=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const cleanCode=(v:unknown)=>String(v||'').trim().toUpperCase();
const validCode=(v:string)=>/^[A-HJ-NP-Z2-9]{7,8}$/.test(v);
const int=(v:unknown,fallback:number,min=0,max=10_000_000)=>{const n=Math.floor(Number(v));return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback};

async function requireAdmin(sb:any,id:number){
 const fallback=Number(Deno.env.get('ADMIN_TELEGRAM_ID')||'2139807311');
 const {data}=await sb.from('settings').select('value').eq('key','bot_admin_telegram_ids').maybeSingle();
 const ids=new Set(String(data?.value||fallback).split(',').map((x:string)=>Number(x.trim())).filter(Number.isSafeInteger));
 if(!ids.has(id))throw new Error('Admin access required');
}
async function telegram(method:string,payload:Record<string,unknown>){
 const token=Deno.env.get('TELEGRAM_BOT_TOKEN')||Deno.env.get('BOT_TOKEN')||'';
 if(!token)throw new Error('Telegram bot token is not configured');
 const res=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const body=await res.json().catch(()=>({ok:false,description:'Bad Telegram response'}));
 if(!res.ok||!body.ok)throw new Error(body.description||`Telegram ${method} failed`);
 return body.result;
}
function statusOf(p:any){
 const full=Number(p.total_claimed||0)>=Number(p.max_claims||0);
 const expired=Boolean(p.expires_at&&new Date(p.expires_at).getTime()<=Date.now());
 return full?'🔴 Fully Claimed':expired?'⚫ Expired':p.is_active?'🟢 Active':'⚫ Disabled';
}
function channelText(p:any){
 return `🎁 <b>ADR Promo Drop</b>\n\n<b>Code:</b> <code>${esc(p.code)}</code>\n<b>Reward:</b> ${Number(p.reward_points||0).toLocaleString('en-US')} ADR\n<b>Claims:</b> ${Number(p.total_claimed||0).toLocaleString('en-US')} / ${Number(p.max_claims||0).toLocaleString('en-US')}\n<b>Status:</b> ${statusOf(p)}\n\nOpen the app and claim before all spots are taken.`;
}
const miniAppMarkup={inline_keyboard:[[{text:'🚀 Open Mini App',url:MINI_APP_URL}]]};
async function postPromoChannel(sb:any,p:any){
 try{
  const msg:any=await telegram('sendMessage',{chat_id:PROMO_CHANNEL,text:channelText(p),parse_mode:'HTML',disable_web_page_preview:true,reply_markup:miniAppMarkup});
  await sb.from('promos').update({channel_chat_id:String(msg.chat?.id||PROMO_CHANNEL),channel_message_id:Number(msg.message_id),channel_last_synced_at:new Date().toISOString(),channel_sync_error:null}).eq('id',p.id);
  return {posted:true,messageId:Number(msg.message_id)};
 }catch(e){
  const error=String((e as Error).message||e).slice(0,500);
  await sb.from('promos').update({channel_sync_error:error}).eq('id',p.id);
  return {posted:false,error};
 }
}
async function syncPromoChannel(sb:any,p:any){
 if(!p?.channel_message_id)return;
 try{
  await telegram('editMessageText',{chat_id:p.channel_chat_id||PROMO_CHANNEL,message_id:Number(p.channel_message_id),text:channelText(p),parse_mode:'HTML',disable_web_page_preview:true,reply_markup:miniAppMarkup});
  await sb.from('promos').update({channel_last_synced_at:new Date().toISOString(),channel_sync_error:null}).eq('id',p.id);
 }catch(e){await sb.from('promos').update({channel_sync_error:String((e as Error).message||e).slice(0,500)}).eq('id',p.id)}
}

serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:corsHeaders});
 try{
  const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {telegramUser,appUser}=await requireTelegramUser(req,sb);
  const body=await req.json().catch(()=>({}));
  const action=String(body.action||'claim');

  if(action==='claim'){
   const code=cleanCode(body.code);
   if(!code)throw new Error('Enter a promo code');
   const {data,error}=await sb.rpc('claim_promo_code',{p_user_id:appUser.id,p_code:code});
   if(error)throw error;
   const result:any=data||{success:false,message:'Invalid code'};
   if(result.success){
    const {data:promo}=await sb.from('promos').select('*').eq('code',code).maybeSingle();
    if(promo)await syncPromoChannel(sb,promo);
   }
   return json(result);
  }

  if(action==='list'){
   const {data,error}=await sb.from('promos').select('id,code,title,reward_points,max_claims,total_claimed,is_active,expires_at').eq('is_active',true).order('created_at',{ascending:false});
   if(error)throw error;
   const {data:claims}=await sb.from('promo_claims').select('promo_id').eq('user_id',appUser.id);
   const claimed=new Set((claims||[]).map((x:any)=>x.promo_id));
   return json({data:(data||[]).filter((p:any)=>!claimed.has(p.id)&&Number(p.total_claimed)<Number(p.max_claims)&&(!p.expires_at||new Date(p.expires_at).getTime()>Date.now()))});
  }
  if(action==='claims'){const {data}=await sb.from('promo_claims').select('promo_id').eq('user_id',appUser.id);return json({data:data||[]})}

  if(!action.startsWith('admin-'))return json({success:false,message:'Unknown action'},400);
  await requireAdmin(sb,telegramUser.id);

  if(action==='admin-list'){
   const {data,error}=await sb.from('promos').select('*').order('created_at',{ascending:false}).limit(1000);
   if(error)throw error;
   return json({success:true,data:data||[]});
  }
  if(action==='admin-generate'){
   const {data,error}=await sb.rpc('generate_unique_promo_code',{p_length:Math.random()<.5?7:8});
   if(error||!data)throw error||new Error('Could not generate code');
   return json({success:true,code:String(data)});
  }
  if(action==='admin-create'){
   let code=cleanCode(body.code);
   if(!code){const {data,error}=await sb.rpc('generate_unique_promo_code',{p_length:8});if(error||!data)throw error||new Error('Could not generate code');code=String(data)}
   if(!validCode(code))throw new Error('Code must be 7–8 characters using A–Z and 2–9, without O, I, 0 or 1');
   const rewardPoints=int(body.rewardPoints,0,0,100_000_000);
   const maxClaims=int(body.maxClaims,100,1,10_000_000);
   const perUserLimit=int(body.perUserLimit,1,1,1000);
   const expiresAt=body.expiresAt?new Date(String(body.expiresAt)).toISOString():null;
   const title=String(body.title||`Promo ${code}`).trim().slice(0,150);
   const {data,error}=await sb.from('promos').insert({code,title,reward_points:rewardPoints,max_claims:maxClaims,per_user_limit:perUserLimit,total_claimed:0,is_active:body.isActive!==false,expires_at:expiresAt}).select('*').single();
   if(error)throw error;
   await sb.from('admin_logs').insert({admin_telegram_id:telegramUser.id,action:'promo_create',details:{promoId:data.id,code,rewardPoints,maxClaims,perUserLimit,expiresAt,source:'mini_app'}});
   const channel=await postPromoChannel(sb,data);
   return json({success:true,data,channel});
  }
  if(action==='admin-update'){
   const id=String(body.id||'');if(!id)throw new Error('Promo ID required');
   const patch:any={updated_at:new Date().toISOString()};
   if(typeof body.isActive==='boolean')patch.is_active=body.isActive;
   if(body.rewardPoints!==undefined)patch.reward_points=int(body.rewardPoints,0,0,100_000_000);
   if(body.maxClaims!==undefined)patch.max_claims=int(body.maxClaims,1,1,10_000_000);
   if(body.perUserLimit!==undefined)patch.per_user_limit=int(body.perUserLimit,1,1,1000);
   if(body.expiresAt!==undefined)patch.expires_at=body.expiresAt?new Date(String(body.expiresAt)).toISOString():null;
   const {data,error}=await sb.from('promos').update(patch).eq('id',id).select('*').single();if(error)throw error;
   await syncPromoChannel(sb,data);
   return json({success:true,data});
  }
  if(action==='admin-delete'){const id=String(body.id||'');const {error}=await sb.from('promos').delete().eq('id',id);if(error)throw error;return json({success:true})}
  return json({success:false,message:'Unknown action'},400);
 }catch(e){const message=(e as Error).message;const status=/Admin access/i.test(message)?403:/Telegram|registered|banned|expired|signature/i.test(message)?401:400;return json({success:false,error:message,message},status)}
});
