export type AdFocusTracker={start:()=>void;clicked:()=>boolean;stop:()=>void};

type PartialRewardResult={success:boolean;points:number;left:number;fullReward:number;awardedNow:boolean;message?:string};

const SUPABASE_URL='https://eoppaqrqlpyqoizohoba.supabase.co';
const ANON_KEY='sb_publishable_DJ7o0hTt3DPL8O_3HbAWuw_NkdvY0na';

export function trackAdFocusLoss():AdFocusTracker{
 let interacted=false;
 let adStarted=false;
 const mark=()=>{if(adStarted)interacted=true};
 const onVisibility=()=>{if(document.visibilityState==='hidden')mark()};
 const onBlur=()=>mark();
 document.addEventListener('visibilitychange',onVisibility,true);
 window.addEventListener('blur',onBlur,true);
 return{
  start:()=>{adStarted=true},
  clicked:()=>interacted,
  stop:()=>{
   document.removeEventListener('visibilitychange',onVisibility,true);
   window.removeEventListener('blur',onBlur,true);
  }
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
  : `You already received ${result.points} ADR from this ad. Tap the ad / CTA and watch again to get the remaining ${result.left} ADR.`;
}

export const AD_CTA_REQUIRED_MESSAGE='Tap the ad / CTA (Visit, Play or Open) before finishing the ad to unlock the full reward.';
