import { useCallback, useRef, useEffect } from 'react';

declare global {
  interface Window {
    Adsgram?: { init:(config:{blockId:string;debug?:boolean})=>AdController };
  }
}
interface AdController { show:()=>Promise<{done:boolean;description?:string;state?:string;error?:boolean}>; destroy?:()=>void; }
const INTERSTITIAL_ID='int-23322';
const REWARDED_ID='23390';

export function useRewardedAd(onReward:()=>void){
 const adRef=useRef<AdController|null>(null);
 useEffect(()=>{if(window.Adsgram?.init)adRef.current=window.Adsgram.init({blockId:REWARDED_ID,debug:false});return()=>{try{adRef.current?.destroy?.()}catch{}}},[]);
 const showAd=useCallback(async():Promise<boolean>=>{
  if(!window.Telegram?.WebApp?.initData||!window.Adsgram?.init)return false;
  if(!adRef.current)adRef.current=window.Adsgram.init({blockId:REWARDED_ID,debug:false});
  try{const result=await adRef.current.show();if(result?.done){onReward();return true}return false}catch{return false}
 },[onReward]);
 return{showAd};
}
export async function showInterstitialAd():Promise<boolean>{
 if(!window.Telegram?.WebApp?.initData||!window.Adsgram?.init)return false;
 try{const ad=window.Adsgram.init({blockId:INTERSTITIAL_ID,debug:false});try{const result=await ad.show();return !!result?.done}finally{try{ad.destroy?.()}catch{}}}catch{return false}
}
