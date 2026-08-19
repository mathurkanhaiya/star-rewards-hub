import { AppUser, UserBalance, Task, Withdrawal, LeaderboardEntry } from '@/types/telegram';

const SUPABASE_URL = 'https://eoppaqrqlpyqoizohoba.supabase.co';
const EDGE_FN = `${SUPABASE_URL}/functions/v1`;
const ANON_KEY = 'sb_publishable_DJ7o0hTt3DPL8O_3HbAWuw_NkdvY0na';
const ADMIN_TELEGRAM_ID = 2139807311;

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(id); }
}
function telegramInitData(): string { return window.Telegram?.WebApp?.initData || ''; }
function isAdminTelegram(): boolean {
  try { const raw = new URLSearchParams(telegramInitData()).get('user'); return !!raw && Number(JSON.parse(raw)?.id) === ADMIN_TELEGRAM_ID; }
  catch { return false; }
}
function protectedHeaders() { return { 'Content-Type':'application/json', 'apikey':ANON_KEY, 'x-telegram-init-data':telegramInitData() }; }
async function edgePost<T = any>(fn:string, body:Record<string,unknown> = {}):Promise<T> {
  const response=await fetchWithTimeout(`${EDGE_FN}/${fn}`,{method:'POST',headers:protectedHeaders(),body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data?.message||data?.error||`${fn} request failed`);
  return data;
}
async function securePost<T = any>(action:string,payload:Record<string,unknown> = {}):Promise<T>{ return edgePost<T>('secure-api',{action,...payload}); }

export async function initUser(_telegramUser:{id:number;first_name:string;last_name?:string;username?:string;photo_url?:string},referralCode?:string):Promise<AppUser|null>{try{if(!telegramInitData())return null;const d=await edgePost<any>('telegram-auth',{referralCode});return d.user||null;}catch(err){console.error('initUser error:',err);return null;}}
export async function getUser(_telegramId:number):Promise<AppUser|null>{try{return(await securePost<{data:AppUser|null}>('get-user')).data||null;}catch{return null;}}
export async function getUserBalance(_userId:string):Promise<UserBalance|null>{try{return(await securePost<{data:UserBalance|null}>('get-balance')).data||null;}catch{return null;}}
export async function getTasks():Promise<Task[]>{
  if(isAdminTelegram()){
    try{return(await edgePost<{data:Task[]}>('admin-catalog',{action:'tasks'})).data||[];}catch(err){console.error('admin task catalog error:',err);}
  }
  try{return(await securePost<{data:Task[]}>('get-tasks')).data||[];}catch(err){console.error('getTasks error:',err);return[];}
}
export async function getUserTasks(_userId:string){try{return(await securePost<{data:any[]}>('get-user-tasks')).data||[];}catch{return[];}}
export async function completeTask(_userId:string,taskId:string):Promise<{success:boolean;points?:number;message?:string}>{try{return await edgePost('complete-task',{taskId});}catch(e){return{success:false,message:(e as Error).message};}}
export async function claimDailyReward(_userId:string):Promise<{success:boolean;points?:number;streak?:number;message?:string}>{try{return await edgePost('daily-reward');}catch(e){return{success:false,message:(e as Error).message};}}
export async function spinWheel(_userId:string):Promise<{success:boolean;result?:string;points?:number;stars?:number;message?:string}>{try{return await edgePost('spin-wheel');}catch(e){return{success:false,message:(e as Error).message};}}
export async function submitWithdrawal(_userId:string,method:string,points:number,walletAddress?:string):Promise<{success:boolean;message?:string}>{try{return await edgePost('withdraw',{method,points,walletAddress});}catch(e){return{success:false,message:(e as Error).message};}}
export async function getWithdrawals(_userId:string):Promise<Withdrawal[]>{try{return(await securePost<{data:Withdrawal[]}>('get-withdrawals')).data||[];}catch{return[];}}
export async function getLeaderboard():Promise<LeaderboardEntry[]>{try{return(await securePost<{data:LeaderboardEntry[]}>('leaderboard')).data||[];}catch{return[];}}
export async function getReferrals(_userId:string){try{return(await securePost<{data:any[]}>('get-referrals')).data||[];}catch{return[];}}
export async function getTransactions(_userId:string){try{return(await securePost<{data:any[]}>('get-transactions')).data||[];}catch{return[];}}
export async function logAdWatch(_userId:string,adType:string,_rewardGiven:number,provider='adsgram'){try{return await edgePost('log-ad',{adType,provider});}catch(e){return{success:false,message:(e as Error).message};}}
export async function claimHomeReward(type:string,points:number,description:string):Promise<{success:boolean;points?:number;message?:string}>{try{return await edgePost('legacy-bridge',{action:'reward',type,points,description});}catch(e){return{success:false,message:(e as Error).message};}}

export async function getSettings():Promise<Record<string,string>>{
  try{
    if(isAdminTelegram()){
      const r=await edgePost<{data:Array<{key:string;value:string}>}>('settings-admin',{action:'list'});
      return Object.fromEntries((r.data||[]).map(s=>[s.key,s.value]));
    }
    const r=await securePost<{data:Array<{key:string;value:string}>}>('get-settings');
    return Object.fromEntries((r.data||[]).map(s=>[s.key,s.value]));
  }catch(err){console.error('getSettings error:',err);return{};}
}

export async function getDailyClaim(_userId:string){try{return(await securePost<{data:any}>('get-daily-claim')).data;}catch{return null;}}
export async function getSpinCount(_userId:string){try{return(await securePost<{data:any[]}>('get-spin-count')).data||[];}catch{return[];}}
export async function getNotifications(_userId:string){try{return(await securePost<{data:any[]}>('get-notifications')).data||[];}catch{return[];}}
export async function markNotificationRead(notifId:string){try{await securePost('mark-notification-read',{notificationId:notifId});}catch{}}
export async function getUnreadNotifCount(_userId:string):Promise<number>{try{return(await securePost<{count:number}>('unread-count')).count||0;}catch{return 0;}}

export async function getActivePromos(){try{return(await edgePost<{data:any[]}>('promo-api',{action:'list'})).data||[];}catch(err){console.error('getActivePromos error:',err);return[];}}
export async function claimPromoReward(promoId:string):Promise<{success:boolean;points?:number;message?:string}>{try{return await edgePost('promo-api',{action:'claim',promoId});}catch(e){return{success:false,message:(e as Error).message};}}

const EMPTY_ADMIN_STATS={totalUsers:0,totalWithdrawals:0,pendingWithdrawals:0,totalTransactions:0,totalAdViews:0};
export async function adminGetStats(){try{return(await securePost<{data:any}>('admin:stats')).data||EMPTY_ADMIN_STATS;}catch(err){console.error('admin stats error:',err);return EMPTY_ADMIN_STATS;}}
export async function adminGetUsers(){try{return(await securePost<{data:any[]}>('admin:users')).data||[];}catch(err){console.error('admin users error:',err);return[];}}
export async function adminGetWithdrawals(){try{return(await securePost<{data:any[]}>('admin:withdrawals')).data||[];}catch(err){console.error('admin withdrawals error:',err);return[];}}
export async function adminUpdateWithdrawal(withdrawalId:string,status:string,adminNote?:string){try{return await edgePost('admin-withdrawal',{withdrawalId,status,adminNote});}catch(e){return{success:false,message:(e as Error).message};}}
export async function adminUpdateSetting(key:string,value:string){
  try{
    const r=await edgePost<{success:boolean;data?:{key:string;value:string};message?:string}>('settings-admin',{action:'update',key,value});
    if(!r.success||r.data?.value!==String(value).trim()) return {success:false,message:r.message||'Database did not confirm the new value'};
    return r;
  }catch(e){return{success:false,message:(e as Error).message};}
}
export async function adminBanUser(userId:string,banned:boolean){try{return await securePost('admin:ban-user',{userId,banned});}catch(e){return{success:false,message:(e as Error).message};}}
export async function adminAdjustBalance(userId:string,points:number,reason:string){try{return await securePost('admin:adjust-balance',{userId,points,reason});}catch(e){return{success:false,message:(e as Error).message};}}
export async function adminCreateTask(task:Omit<Task,'id'>){try{return await securePost('admin:create-task',{task});}catch(e){return{success:false,message:(e as Error).message};}}
export async function adminToggleTask(taskId:string,isActive:boolean){try{return await securePost('admin:toggle-task',{taskId,isActive});}catch(e){return{success:false,message:(e as Error).message};}}
export async function adminDeleteTask(taskId:string){try{return await securePost('admin:delete-task',{taskId});}catch(e){return{success:false,message:(e as Error).message};}}
export async function adminGetContests(){try{return(await securePost<{data:any[]}>('admin:contests')).data||[];}catch(err){console.error('admin contests error:',err);return[];}}
export async function adminCreateContest(contest:{title:string;contest_type:string;ends_at:string;reward_1st:number;reward_2nd:number;reward_3rd:number;reward_4th:number;reward_5th:number}){try{return await securePost('admin:create-contest',{contest});}catch(e){return{success:false,message:(e as Error).message};}}
export async function adminEndContest(contestId:string){try{return await edgePost('distribute-contest',{contestId});}catch(e){return{success:false,message:(e as Error).message};}}
export async function getContestLeaderboard(contestId:string){try{return(await securePost<{data:any[]}>('contest-leaderboard',{contestId})).data||[];}catch{return[];}}
export async function getActiveContests(){try{return(await securePost<{data:any[]}>('get-active-contests')).data||[];}catch(err){console.error('getActiveContests error:',err);return[];}}
export async function adminSendBroadcast(message:string,_adminTelegramId:number){try{return await securePost('admin:broadcast',{message});}catch(e){return{success:false,message:(e as Error).message};}}
export async function getAdWatchLeaderboard(contestId?:string){try{return(await securePost<{data:any[]}>('ad-watch-leaderboard',{contestId})).data||[];}catch{return[];}}
export async function getReferralLeaderboard(){try{return(await securePost<{data:any[]}>('referral-leaderboard')).data||[];}catch{return[];}}
