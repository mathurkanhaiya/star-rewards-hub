import {grantPartialAdReward,partialRewardMessage,trackAdFocusLoss} from './adFocus';

export type RewardAdProvider='adsgram'|'monetag'|'gigapub';

declare global {
  interface Window {
    Adsgram?: { init:(config:{blockId:string;debug?:boolean})=>{show:()=>Promise<{done?:boolean}>;destroy?:()=>void} };
    show_10742752?: (options?:unknown)=>Promise<unknown>;
    showGiga?: ()=>Promise<unknown>|unknown;
  }
}

const ADSGRAM_BLOCK='23390';

function ensureTelegram(){
  if(!window.Telegram?.WebApp?.initData) throw new Error('Open the Mini App inside Telegram');
}

export async function showRewardAd(provider:RewardAdProvider):Promise<void>{
  ensureTelegram();
  if(provider==='adsgram'){
    if(!window.Adsgram?.init) throw new Error('Adsgram is not available right now');
    const controller=window.Adsgram.init({blockId:ADSGRAM_BLOCK,debug:false});
    const focusTracker=trackAdFocusLoss();
    try{
      focusTracker.start();
      const result=await controller.show();
      if(!result?.done) throw new Error('Ad was not completed');
      if(!focusTracker.clicked()){
        const partial=await grantPartialAdReward('adsgram');
        throw new Error(partialRewardMessage(partial));
      }
    } finally {
      focusTracker.stop();
      try{controller.destroy?.()}catch{}
    }
    return;
  }
  if(provider==='monetag'){
    const fn=window.show_10742752;
    if(typeof fn!=='function') throw new Error('Monetag is not available right now');
    await fn({type:'end',ymid:`${window.Telegram?.WebApp?.initDataUnsafe?.user?.id||'tg'}-${Date.now()}`,requestVar:'home_reward'});
    return;
  }
  const fn=window.showGiga;
  if(typeof fn!=='function') throw new Error('GigaPub is not available right now');
  const result=fn();
  if(result&&typeof (result as Promise<unknown>).then==='function') await result;
}
