const SUPABASE_URL='https://eoppaqrqlpyqoizohoba.supabase.co';
const EDGE_FN=`${SUPABASE_URL}/functions/v1`;
const ANON_KEY='sb_publishable_DJ7o0hTt3DPL8O_3HbAWuw_NkdvY0na';

export type MandatoryJoinChannel={id:string;title:string;username:string|null;joinUrl:string;imageUrl:string|null;isJoined:boolean;status:string;error?:string|null};
export type MandatoryJoinState={success:boolean;allJoined:boolean;channels:MandatoryJoinChannel[];checkedAt?:string;message?:string};
export type AdminMandatoryChannel={id:string;title:string;chat_id:string;username:string|null;join_url:string;image_url:string|null;is_active:boolean;sort_order:number;created_at:string;updated_at:string};

function headers(){return{'Content-Type':'application/json','apikey':ANON_KEY,'x-telegram-init-data':window.Telegram?.WebApp?.initData||''};}
async function post<T>(body:Record<string,unknown>):Promise<T>{
 const controller=new AbortController();const timer=window.setTimeout(()=>controller.abort(),10000);
 try{const r=await fetch(`${EDGE_FN}/mandatory-join`,{method:'POST',headers:headers(),body:JSON.stringify(body),signal:controller.signal});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.message||'Mandatory join request failed');return d as T;}finally{window.clearTimeout(timer)}
}

export async function checkMandatoryJoins():Promise<MandatoryJoinState>{try{return await post<MandatoryJoinState>({action:'check'});}catch(e){return{success:false,allJoined:false,channels:[],message:e instanceof Error?e.message:'Membership check failed'};}}
export async function adminListMandatoryChannels(){try{return(await post<{success:boolean;data:AdminMandatoryChannel[]}>({action:'admin-list'})).data||[];}catch{return[];}}
export async function adminCreateMandatoryChannel(input:{title:string;chatId:string;username?:string;joinUrl:string;imageUrl?:string;isActive?:boolean;sortOrder?:number}){try{return await post<any>({action:'admin-create',...input});}catch(e){return{success:false,message:e instanceof Error?e.message:'Create failed'};}}
export async function adminUpdateMandatoryChannel(id:string,patch:Record<string,unknown>){try{return await post<any>({action:'admin-update',id,...patch});}catch(e){return{success:false,message:e instanceof Error?e.message:'Update failed'};}}
export async function adminDeleteMandatoryChannel(id:string){try{return await post<any>({action:'admin-delete',id});}catch(e){return{success:false,message:e instanceof Error?e.message:'Delete failed'};}}
