import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = 'https://eoppaqrqlpyqoizohoba.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_DJ7o0hTt3DPL8O_3HbAWuw_NkdvY0na';
const EDGE_FN = `${SUPABASE_URL}/functions/v1`;
const nativeFetch = globalThis.fetch.bind(globalThis);

function getTelegramInitData() {
  if (typeof window === 'undefined') return '';
  return (window as any).Telegram?.WebApp?.initData || '';
}
function edgeHeaders() {
  return { 'Content-Type':'application/json', apikey:SUPABASE_PUBLISHABLE_KEY, 'x-telegram-init-data':getTelegramInitData() };
}
async function bridge(action:string,payload:Record<string,unknown>={}) {
  return nativeFetch(`${EDGE_FN}/legacy-bridge`,{method:'POST',headers:edgeHeaders(),body:JSON.stringify({action,...payload})});
}
async function promoApi(action:string,payload:Record<string,unknown>={}) {
  return nativeFetch(`${EDGE_FN}/promo-api`,{method:'POST',headers:edgeHeaders(),body:JSON.stringify({action,...payload})});
}
async function adminData(action:string,payload:Record<string,unknown>={}) {
  return nativeFetch(`${EDGE_FN}/admin-data`,{method:'POST',headers:edgeHeaders(),body:JSON.stringify({action,...payload})});
}
async function adminContests(action:string,payload:Record<string,unknown>={}) {
  return nativeFetch(`${EDGE_FN}/admin-contests`,{method:'POST',headers:edgeHeaders(),body:JSON.stringify({action,...payload})});
}
function fakeJson(data:unknown,status=200,headers:Record<string,string>={}) {
  return new Response(status===204?null:JSON.stringify(data),{status,headers:{'Content-Type':'application/json',...headers}});
}
function eqValue(url:URL,key:string){const value=url.searchParams.get(key)||'';return value.startsWith('eq.')?value.slice(3):value;}
function gteValue(url:URL,key:string){const value=url.searchParams.get(key)||'';return value.startsWith('gte.')?value.slice(4):'';}
function isAdminRoute(){return typeof window!=='undefined'&&window.location.pathname.toLowerCase().includes('admin');}

const LEGACY_REWARD_TYPES=new Set(['tap_earn','farm_claim','daily_drop','dice_roll','lucky_box','card_flip','number_guess']);

async function backendV2Fetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
  const request=input instanceof Request?input:new Request(input,init);
  const url=new URL(request.url);
  if(url.origin!==new URL(SUPABASE_URL).origin||!url.pathname.startsWith('/rest/v1/')) return nativeFetch(input as any,init);

  const table=url.pathname.split('/').filter(Boolean).pop()||'';
  const method=request.method.toUpperCase();
  const targetUserId=eqValue(url,'user_id');

  if(isAdminRoute()&&targetUserId&&(method==='GET'||method==='HEAD')&&['transactions','ad_logs','daily_claims','balances'].includes(table)){
    if(table==='balances'){
      const result=await adminData('user-balance',{userId:targetUserId});
      const payload=await result.json().catch(()=>({data:null}));
      return fakeJson(payload?.data??null,result.ok?200:result.status);
    }
    const result=await adminData('user-activity',{userId:targetUserId});
    const payload=await result.json().catch(()=>({transactions:[],adCount:0,dailyClaims:[]}));
    if(!result.ok) return fakeJson(payload,result.status);
    if(table==='transactions') return fakeJson(payload.transactions||[],200);
    if(table==='daily_claims') return fakeJson(payload.dailyClaims||[],200);
    if(table==='ad_logs'){
      const count=Number(payload.adCount||0);
      const headers={'Content-Range':count>0?`0-${count-1}/${count}`:'*/0','Range-Unit':'items'};
      return method==='HEAD'?new Response(null,{status:200,headers}):fakeJson([],200,headers);
    }
  }

  // Legacy admin contest component writes directly to Supabase. Convert those writes to admin-only Edge calls.
  if(isAdminRoute()&&table==='contests'&&method==='POST'){
    const raw=await request.clone().json().catch(()=>({})) as any;
    const contest=Array.isArray(raw)?raw[0]:raw;
    const result=await adminContests('create',{contest});
    const payload=await result.json().catch(()=>({}));
    if(!result.ok) return fakeJson(payload,result.status);
    return fakeJson(payload?.data??null,201);
  }
  if(isAdminRoute()&&table==='contests'&&method==='PATCH'){
    const result=await adminContests('cancel',{id:eqValue(url,'id')});
    if(!result.ok) return result;
    return fakeJson(null,204);
  }
  if(isAdminRoute()&&table==='contests'&&method==='DELETE'){
    const result=await adminContests('delete',{id:eqValue(url,'id')});
    if(!result.ok) return result;
    return fakeJson(null,204);
  }
  if(isAdminRoute()&&(table==='contest_entries'||table==='contest_rewards')&&method==='DELETE') return fakeJson(null,204);

  if(table==='balances'&&method==='PATCH') return fakeJson(null,204);

  if(table==='transactions'&&(method==='GET'||method==='HEAD')){
    const type=eqValue(url,'type');
    if(type){
      const result=await bridge('count-transactions',{type,since:gteValue(url,'created_at')});
      const body=await result.json().catch(()=>({count:0}));
      const count=Number(body?.count||0);
      const headers={'Content-Range':count>0?`0-${count-1}/${count}`:'*/0','Range-Unit':'items'};
      if(method==='HEAD') return new Response(null,{status:result.ok?200:result.status,headers});
      return fakeJson([],result.ok?200:result.status,headers);
    }
  }

  if(table==='transactions'&&method==='POST'){
    const raw=await request.clone().json().catch(()=>null) as any;
    const rows=Array.isArray(raw)?raw:raw?[raw]:[];
    if(rows.length>0&&rows.every(row=>row?.type==='tower_climb'||row?.type==='ad_watch'||row?.type==='adsgram_reward'||row?.type==='promo')) return fakeJson(rows,201);
    if(rows.length>0&&rows.every(row=>LEGACY_REWARD_TYPES.has(String(row?.type)))){
      for(const row of rows){
        const result=await bridge('reward',{type:String(row.type),points:Number(row.points||0),description:String(row.description||row.type)});
        if(!result.ok){const error=await result.text();return new Response(error,{status:result.status,headers:{'Content-Type':'application/json'}});}
      }
      return fakeJson(rows,201);
    }
  }

  if(table==='daily_claims'&&(method==='GET'||method==='HEAD')){
    const result=await bridge('daily-claims');
    const payload=await result.json().catch(()=>({data:[]}));
    let rows=Array.isArray(payload?.data)?payload.data:[];
    const requestedDate=eqValue(url,'claim_date');
    if(requestedDate) rows=rows.filter((row:any)=>row.claim_date===requestedDate);
    const limit=Number(url.searchParams.get('limit')||0); if(limit>0) rows=rows.slice(0,limit);
    if(method==='HEAD'){const count=rows.length;return new Response(null,{status:result.ok?200:result.status,headers:{'Content-Range':count>0?`0-${count-1}/${count}`:'*/0','Range-Unit':'items'}});}
    return fakeJson(rows,result.ok?200:result.status);
  }
  if(table==='daily_claims'&&method==='POST'){
    const raw=await request.clone().json().catch(()=>({}));
    return fakeJson(Array.isArray(raw)?raw:[raw],201);
  }

  if(table==='ad_logs'&&(method==='GET'||method==='HEAD')){
    const result=await bridge('count-ads',{adType:eqValue(url,'ad_type'),since:gteValue(url,'created_at')});
    const payload=await result.json().catch(()=>({count:0})); const count=Number(payload?.count||0);
    const headers={'Content-Range':count>0?`0-${count-1}/${count}`:'*/0','Range-Unit':'items'};
    if(method==='HEAD') return new Response(null,{status:result.ok?200:result.status,headers});
    if(!url.searchParams.get('select')?.includes('id')) return nativeFetch(request);
    return fakeJson([],result.ok?200:result.status,headers);
  }

  if(table==='tower_runs'&&method==='POST'){
    const raw=await request.clone().json().catch(()=>({})) as any; const row=Array.isArray(raw)?raw[0]:raw;
    const result=await bridge('tower-run',{floor:Number(row?.floors_reached||0),points:Number(row?.points_earned||0)});
    if(!result.ok) return result;
    return fakeJson(Array.isArray(raw)?raw:[raw],201);
  }
  if(table==='tower_leaderboard'&&(method==='POST'||method==='PATCH')){
    const raw=method==='POST'?await request.clone().json().catch(()=>({})):null;
    return method==='PATCH'?fakeJson(null,204):fakeJson(Array.isArray(raw)?raw:[raw],201);
  }

  if(table==='promo_claims'&&(method==='GET'||method==='HEAD')){
    const result=await promoApi('claims');
    const payload=await result.json().catch(()=>({data:[]}));
    let rows=Array.isArray(payload?.data)?payload.data:[];
    const promoId=eqValue(url,'promo_id'); if(promoId) rows=rows.filter((r:any)=>r.promo_id===promoId);
    if(method==='HEAD'){const count=rows.length;return new Response(null,{status:result.ok?200:result.status,headers:{'Content-Range':count>0?`0-${count-1}/${count}`:'*/0','Range-Unit':'items'}});}
    return fakeJson(rows,result.ok?200:result.status);
  }
  if(table==='promo_claims'&&method==='POST'){
    const raw=await request.clone().json().catch(()=>({})) as any; const row=Array.isArray(raw)?raw[0]:raw;
    const result=await promoApi('claim',{promoId:String(row?.promo_id||'')});
    if(!result.ok) return result;
    return fakeJson(Array.isArray(raw)?raw:[raw],201);
  }
  if(table==='promo_claims'&&method==='DELETE') return fakeJson(null,204);

  if(table==='promos'&&method==='POST'){
    const raw=await request.clone().json().catch(()=>({})) as any; const row=Array.isArray(raw)?raw[0]:raw;
    const result=await promoApi('admin-create',{title:String(row?.title||''),rewardPoints:Number(row?.reward_points||50),maxClaims:Number(row?.max_claims||100)});
    if(!result.ok) return result;
    const payload=await result.json(); return fakeJson(payload?.data?[payload.data]:[],201);
  }
  if(table==='promos'&&method==='PATCH'){
    const raw=await request.clone().json().catch(()=>({})) as any;
    const result=await promoApi('admin-update',{id:eqValue(url,'id'),isActive:typeof raw?.is_active==='boolean'?raw.is_active:undefined});
    if(!result.ok) return result; return fakeJson(null,204);
  }
  if(table==='promos'&&method==='DELETE'){
    const result=await promoApi('admin-delete',{id:eqValue(url,'id')});
    if(!result.ok) return result; return fakeJson(null,204);
  }

  if(table==='increment_points'&&url.pathname.includes('/rpc/')&&method==='POST') return fakeJson(0,200);

  return nativeFetch(request);
}

export const supabase=createClient<Database>(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
  auth:{storage:localStorage,persistSession:true,autoRefreshToken:true},
  global:{fetch:backendV2Fetch},
});
