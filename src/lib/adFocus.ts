export type AdFocusTracker={start:()=>void;clicked:()=>boolean;stop:()=>void};

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

export const AD_CTA_REQUIRED_MESSAGE='Tap the ad / CTA (Visit, Play or Open) before finishing the ad to unlock the reward.';
