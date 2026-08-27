import { useCallback, useRef, useEffect } from 'react';
import {grantPartialAdReward,partialRewardMessage,trackAdFocusLoss} from '@/lib/adFocus';

declare global {
  interface Window {
    Adsgram?: { init:(config:{blockId:string;debug?:boolean})=>AdController };
  }
}
interface AdController { show:()=>Promise<{done:boolean;description?:string;state?:string;error?:boolean}>; destroy?:()=>void; }
const INTERSTITIAL_ID='int-44760';
const REWARDED_ID='44757';

export function useRewardedAd(onReward:()=>void){
 const adRef=useRef<AdController|null>(null);
 useEffect(()=>{if(window.Adsgram?.init)adRef.current=window.Adsgram.init({blockId:REWARDED_ID,debug:false});return()=>{try{adRef.current?.destroy?.()}catch{}}},[]);
 const showAd=useCallback(async():Promise<boolean>=>{
  if(!window.Telegram?.WebApp?.initData||!window.Adsgram?.init)return false;
  if(!adRef.current)adRef.current=window.Adsgram.init({blockId:REWARDED_ID,debug:false});
  const focusTracker=trackAdFocusLoss();
  try{
   focusTracker.start();
   const result=await adRef.current.show();
   if(!result?.done)return false;
   if(!focusTracker.clicked()){
    await grantPartialAdReward('adsgram');
    return false;
   }
   onReward();
   return true;
  }catch{return false}finally{focusTracker.stop()}
 },[onReward]);
 return{showAd};
}
export async function showInterstitialAd():Promise<boolean>{
 if(!window.Telegram?.WebApp?.initData)throw new Error('Open the Mini App inside Telegram');
 if(!window.Adsgram?.init)throw new Error('Adsgram is not available right now');
 const focusTracker=trackAdFocusLoss();
 try{
  const ad=window.Adsgram.init({blockId:INTERSTITIAL_ID,debug:false});
  try{
   focusTracker.start();
   const result=await ad.show();
   if(!result?.done)throw new Error(result?.description||'Ad was not completed');
   if(!focusTracker.clicked()){
    const partial=await grantPartialAdReward('adsgram');
    throw new Error(partialRewardMessage(partial));
   }
   return true;
  }finally{try{ad.destroy?.()}catch{}}
 }finally{focusTracker.stop()}
}
