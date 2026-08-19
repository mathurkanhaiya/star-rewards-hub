const SUPABASE_URL='https://eoppaqrqlpyqoizohoba.supabase.co';
const ANON_KEY='sb_publishable_DJ7o0hTt3DPL8O_3HbAWuw_NkdvY0na';
function headers(){return{'Content-Type':'application/json','apikey':ANON_KEY,'x-telegram-init-data':window.Telegram?.WebApp?.initData||''}}
async function post(body:Record<string,unknown>){const r=await fetch(`${SUPABASE_URL}/functions/v1/game-api`,{method:'POST',headers:headers(),body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||'Game request failed');return d}
export type GameKey='dice_roll'|'lucky_box'|'card_flip'|'number_guess'|'tower_climb';
export type GameStatus={limit:number;towerLimit:number;counts:Record<GameKey,number>;enabled:Record<GameKey,boolean>;dayStart:string};
export async function getGameStatus():Promise<GameStatus|null>{try{return(await post({action:'status'})).data||null}catch{return null}}
export async function playGame(game:GameKey,payload:Record<string,unknown>={}){try{return await post({action:'play',game,...payload})}catch(e){return{success:false,message:(e as Error).message}}}
