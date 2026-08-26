export type AdFocusTracker={start:()=>void;clicked:()=>boolean;stop:()=>void};

export type PartialRewardResult={success:boolean;points:number;left:number;fullReward:number;awardedNow:boolean;message?:string};

const SUPABASE_URL='https://eoppaqrqlpyqoizohoba.supabase.co';
const ANON_KEY='sb_publishable_DJ7o0hTt3DPL8O_3HbAWuw_NkdvY0na';
const MIN_HIDDEN_MS=450;

export function trackAdFocusLoss():AdFocusTracker{
 let adStarted=false;
 let hiddenSince=0;
 let interacted=false;
 const onVisibility=()=>{
  if(!adStarted)return;
  if(document.visibilityState==='hidden'){
   hiddenSince=Date.now();
   return;
  }
  if(hiddenSince>0&&Date.now()-hiddenSince>=MIN_HIDDEN_MS)interacted=true;
  hiddenSince=0;
 };
 document.addEventListener('visibilitychange',onVisibility,true);
 return{
  start:()=>{adStarted=true;hiddenSince=0;interacted=false},
  clicked:()=>interacted||(adStarted&&document.visibilityState==='hidden'&&hiddenSince>0&&Date.now()-hiddenSince>=MIN_HIDDEN_MS),
  stop:()=>{document.removeEventListener('visibilitychange',onVisibility,true)}
 };
}

export async function grantPartialAdReward(provider='adsgram'):Promise<PartialRewardResult>{
 const initData=window.Telegram?.WebApp?.initData||'';
 if(!initData)throw new Error('Open the Mini App inside Telegram');
 const response=await fetch(`${SUPABASE_URL}/functions/v1/log-ad`,{
  method:'POST',
  headers:{'Content-Type':'application/json','apikey':ANON_KEY,'x-telegram-init-data':initData},
  body:JSON.stringify({adType:'ad_partial',provider})
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data?.success)throw new Error(data?.message||'Partial ad reward failed');
 return{success:true,points:Number(data.points||0),left:Number(data.left||0),fullReward:Number(data.fullReward||0),awardedNow:data.awardedNow!==false,message:data.message};
}

export function partialRewardMessage(result:PartialRewardResult){
 return result.awardedNow
  ? `+${result.points} ADR received. You can get the remaining ${result.left} ADR if you tap the ad / CTA and watch again.`
  : `You already received ${result.points} ADR. Tap the ad / CTA and watch again to get the remaining ${result.left} ADR.`;
}

export function showPartialRewardPopup(result:PartialRewardResult):Promise<'retry'|'close'>{
 return new Promise(resolve=>{
  const old=document.getElementById('adr-partial-ad-popup');
  if(old)old.remove();
  const wrap=document.createElement('div');
  wrap.id='adr-partial-ad-popup';
  wrap.style.cssText='position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;padding:20px;background:rgba(3,7,18,.72);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)';
  const card=document.createElement('div');
  card.style.cssText='width:min(100%,360px);border:1px solid rgba(255,255,255,.12);border-radius:24px;padding:20px;background:linear-gradient(155deg,rgba(19,27,42,.97),rgba(7,12,22,.96));box-shadow:0 24px 70px rgba(0,0,0,.45);text-align:center;color:#f8fafc;font-family:inherit';
  const earned=result.awardedNow?`+${result.points} ADR received`:`${result.points} ADR already received`;
  card.innerHTML=`<div style="font-size:28px;margin-bottom:8px">⚡</div><div style="font-weight:850;font-size:17px;letter-spacing:.2px">PARTIAL REWARD</div><div style="margin-top:8px;font-weight:800;font-size:22px;color:#facc15">${earned}</div><div style="margin:9px auto 16px;max-width:280px;font-size:12px;line-height:1.5;color:rgba(248,250,252,.65)">You can still get <b style="color:#fff">${result.left} ADR</b>. Watch again and tap the ad / CTA before finishing.</div><button data-retry style="width:100%;min-height:46px;border:0;border-radius:15px;background:linear-gradient(135deg,#22d3ee,#facc15);color:#071018;font:800 11px inherit;letter-spacing:.6px">WATCH AD</button><button data-close style="margin-top:10px;border:0;background:transparent;color:rgba(248,250,252,.5);font:600 11px inherit;padding:8px 14px">Not now</button>`;
  wrap.appendChild(card);
  document.body.appendChild(wrap);
  const done=(value:'retry'|'close')=>{wrap.remove();resolve(value)};
  card.querySelector('[data-retry]')?.addEventListener('click',()=>done('retry'),{once:true});
  card.querySelector('[data-close]')?.addEventListener('click',()=>done('close'),{once:true});
 });
}

export class PartialAdRewardError extends Error{
 result:PartialRewardResult;
 constructor(result:PartialRewardResult){super('Partial ad reward');this.name='PartialAdRewardError';this.result=result;}
}

export const AD_CTA_REQUIRED_MESSAGE='Tap the ad / CTA (Visit, Play or Open) before finishing the ad to unlock the full reward.';
