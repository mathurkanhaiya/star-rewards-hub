import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireTelegramUser, secureCorsHeaders as corsHeaders } from "../_shared/telegramAuth.ts";

function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})}
function requireAdmin(id:number){const admin=Number(Deno.env.get('ADMIN_TELEGRAM_ID')||'2139807311');if(id!==admin)throw new Error('Admin access required')}
const esc=(v:unknown)=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const PROMO_CHANNEL='@AdsRewards';
const MINI_APP_URL='https://t.me/Adsrewartsbot/app';

async function telegram(method:string,payload:Record<string,unknown>){
 const token=Deno.env.get('TELEGRAM_BOT_TOKEN')||Deno.env.get('BOT_TOKEN')||'';
 if(!token)throw new Error('Telegram bot token is not configured');
 const res=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const body=await res.json().catch(()=>({ok:false,description:'Bad Telegram response'}));
 if(!res.ok||!body.ok)throw new Error(body.description||`Telegram ${method} failed`);
 return body.result;
}

function promoChannelText(promo:any){
 const claimed=Number(promo.total_claimed||0),limit=Number(promo.max_claims||0);
 const full=limit>0&&claimed>=limit;
 const expired=promo.expires_at&&new Date(promo.expires_at).getTime()<=Date.now();
 const active=Boolean(promo.is_active)&&!full&&!expired;
 const status=full?'🔴 Fully Claimed':expired?'⚫ Expired':active?'🟢 Active':'⚫ Inactive';
 return `🎁 <b>ADR Promo Drop</b>\n\n<b>Code:</b> <code>${esc(promo.code)}</code>\n<b>Reward:</b> ${Number(promo.reward_points||0).toLocaleString('en-US')} ADR\n<b>Claims:</b> ${claimed.toLocaleString('en-US')} / ${limit.toLocaleString('en-US')}\n<b>Status:</b> ${status}\n\nClaim it before all spots are taken.`;
}

async function updatePromoChannelMessage(sb:any,promo:any){
 if(!promo?.channel_message_id)return;
 try{
  await telegram('editMessageText',{
   chat_id:promo.channel_chat_id||PROMO_CHANNEL,
   message_id:Number(promo.channel_message_id),
   text:promoChannelText(promo),
   parse_mode:'HTML',
   disable_web_page_preview:true,
   reply_markup:{inline_keyboard:[[{text:'🚀 Open Mini App',url:MINI_APP_URL}]]}
  });
  await sb.from('promos').update({channel_last_synced_at:new Date().toISOString(),channel_sync_error:null}).eq('id',promo.id);
 }catch(e){
  console.error('promo channel sync failed',e);
  await sb.from('promos').update({channel_sync_error:String((e as Error).message||e).slice(0,500)}).eq('id',promo.id);
 }
}

serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:corsHeaders});
 try{
  const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {telegramUser,appUser}=await requireTelegramUser(req,sb);
  const body=await req.json().catch(()=>({})); const action=String(body.action||'');
  if(action==='list'){
   const {data,error}=await sb.from('promos').select('id,title,reward_points,max_claims,total_claimed').eq('is_active',true).order('created_at',{ascending:false}); if(error)throw error;
   const {data:claims}=await sb.from('promo_claims').select('promo_id').eq('user_id',appUser.id); const claimed=new Set((claims||[]).map((x:any)=>x.promo_id));
   return json({data:(data||[]).filter((p:any)=>Number(p.total_claimed)<Number(p.max_claims)&&!claimed.has(p.id))});
  }
  if(action==='claims'){const {data}=await sb.from('promo_claims').select('promo_id').eq('user_id',appUser.id);return json({data:data||[]});}
  if(action==='claim'){
   const promoId=String(body.promoId||''); if(!promoId)throw new Error('Promo required');
   const {data:existing}=await sb.from('promo_claims').select('id').eq('user_id',appUser.id).eq('promo_id',promoId).maybeSingle(); if(existing)throw new Error('Promo already claimed');
   const {data:promo}=await sb.from('promos').select('*').eq('id',promoId).eq('is_active',true).single(); if(!promo)throw new Error('Promo unavailable');
   if(promo.expires_at&&new Date(promo.expires_at).getTime()<=Date.now())throw new Error('Promo expired');
   if(Number(promo.total_claimed)>=Number(promo.max_claims))throw new Error('Promo full');
   const {error:claimError}=await sb.from('promo_claims').insert({promo_id:promoId,user_id:appUser.id}); if(claimError)throw claimError;
   const nextClaimed=Number(promo.total_claimed)+1;
   const {data:updated,error:updateError}=await sb.from('promos').update({total_claimed:nextClaimed}).eq('id',promoId).eq('total_claimed',promo.total_claimed).select('*').maybeSingle(); if(updateError)throw updateError;
   if(!updated){await sb.from('promo_claims').delete().eq('promo_id',promoId).eq('user_id',appUser.id);throw new Error('Promo was claimed by someone else');}
   await sb.rpc('increment_points',{p_user_id:appUser.id,p_points:Number(promo.reward_points)});
   await sb.from('transactions').insert({user_id:appUser.id,type:'promo',points:Number(promo.reward_points),description:`🎁 Promo: ${String(promo.title).slice(0,150)}`});
   await updatePromoChannelMessage(sb,updated);
   return json({success:true,points:Number(promo.reward_points),claimed:nextClaimed,maxClaims:Number(promo.max_claims)});
  }
  if(action.startsWith('admin-'))requireAdmin(telegramUser.id);
  if(action==='admin-create'){
   const title=String(body.title||'').trim().slice(0,150); if(!title)throw new Error('Title required');
   const rewardPoints=Math.max(0,Math.floor(Number(body.rewardPoints||0))); const maxClaims=Math.max(1,Math.floor(Number(body.maxClaims||1)));
   const {data,error}=await sb.from('promos').insert({title,reward_points:rewardPoints,max_claims:maxClaims,total_claimed:0,is_active:true}).select().single(); if(error)throw error; return json({success:true,data});
  }
  if(action==='admin-update'){
   const id=String(body.id||''); const patch:any={};
   if(typeof body.isActive==='boolean')patch.is_active=body.isActive;
   if(body.title!==undefined)patch.title=String(body.title).trim().slice(0,150);
   if(body.rewardPoints!==undefined)patch.reward_points=Math.max(0,Math.floor(Number(body.rewardPoints)));
   if(body.maxClaims!==undefined)patch.max_claims=Math.max(1,Math.floor(Number(body.maxClaims)));
   const {data,error}=await sb.from('promos').update(patch).eq('id',id).select().single(); if(error)throw error; await updatePromoChannelMessage(sb,data); return json({success:true,data});
  }
  if(action==='admin-delete'){const {error}=await sb.from('promos').delete().eq('id',String(body.id||''));if(error)throw error;return json({success:true});}
  return json({error:'Unknown action'},400);
 }catch(e){const message=(e as Error).message;const status=/Admin access/i.test(message)?403:/Telegram|registered|banned|expired|signature/i.test(message)?401:400;return json({success:false,error:message,message},status)}
});
