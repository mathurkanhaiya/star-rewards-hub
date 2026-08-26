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

export class PartialAdRewardError extends Error{
 result:PartialRewardResult;
 constructor(result:PartialRewardResult){super('Partial ad reward');this.name='PartialAdRewardError';this.result=result;}
}

export const AD_CTA_REQUIRED_MESSAGE='Tap the ad / CTA (Visit, Play or Open) before finishing the ad to unlock the full reward.';
