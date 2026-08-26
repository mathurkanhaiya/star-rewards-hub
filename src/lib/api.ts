import { AppUser, UserBalance, Task, Withdrawal, LeaderboardEntry } from '@/types/telegram';
import { showRewardAd } from '@/lib/adNetworks';

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

export async function initUser(_telegramUser:{id:number;first_name:string;last_name?:string;username?:string;photo_url?:string},referralCode?:string):Promise<AppUser|null>{
  try{
    if(!telegramInitData())return null;
    const d=await edgePost<any>('telegram-auth',{referralCode});
    return d.user?{...d.user,support_username:d.support_username||null}:null;
  }catch(err){console.error('initUser error:',err);return null;}
}
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
export async function getLeaderboard():Promise<LeaderboardEntry[]>{try{return(await edgePost<{data:LeaderboardEntry[]}>('metrics-api',{action:'points-leaderboard'})).data||[];}catch{return[];}}
export async function getAdLeaderboard(range:'today'|'yesterday'|'week'){try{return(await edgePost<{data:any[]}>('metrics-api',{action:'ads-leaderboard',range})).data||[];}catch{return[];}}
export async function getInviteLeaderboard(range:'week'|'month'|'all'){try{return(await edgePost<{data:LeaderboardRow[]}>('metrics-api',{action:'invite-leaderboard',range})).data||[];}catch{return[];}}
export async function getTodayAdCount():Promise<number>{try{return(await edgePost<{count:number}>('metrics-api',{action:'today-ads'})).count||0;}catch{return 0;}}
export async function getReferrals(_userId:string):Promise<ReferralRecord[]>{try{return(await securePost<{data:ReferralRecord[]}>('get-referrals')).data||[];}catch{return[];}}
export async function getTransactions(_userId:string){try{return(await securePost<{data:any[]}>('get-transactions')).data||[];}catch{return[];}}
export async function logAdWatch(_userId:string,adType:string,_rewardGiven:number,provider='adsgram'){try{return await edgePost('log-ad',{adType,provider});}catch(e){return{success:false,message:(e as Error).message};}}
export async function claimAdsgramTaskReward(blockId:string):Promise<{success:boolean;points?:number;message?:string;retryAfter?:number;nextAvailableAt?:string}>{try{return await edgePost('log-ad',{adType:'adsgram_task',blockId});}catch(e){return{success:false,message:(e as Error).message};}}

export type AdProviderId='adsgram'|'monetag'|'gigapub';
export type AdProviderStatus={count:number;limit:number;remaining:number;cooldownSeconds:number;hourlyCount:number;hourlyLimit:number;nextAvailableAt:string|null;enabled:boolean};
export type AdProviderState={
  rewardPoints:number;
  nextResetAt:string;
  providers:Record<AdProviderId,AdProviderStatus>;
};
export async function getAdProviderState():Promise<AdProviderState|null>{
  try{return await edgePost<AdProviderState>('metrics-api',{action:'ad-provider-stats'});}catch(err){console.error('ad provider state error:',err);return null;}
}

export type ReferralUser={id:string;telegram_id:number;first_name:string|null;last_name:string|null;username:string|null;photo_url:string|null};
export type ReferralRecord={id:string;referred_id:string;points_earned:number;is_verified:boolean;created_at:string;verified_at:string|null;referred_user:ReferralUser|null};
export type LeaderboardRow={user_id:string;score:number;rank:number;user?:Partial<ReferralUser>;users?:Partial<ReferralUser>};

export type HomeRewardState={
  farm:{startedAt:string|null;readyAt:string|null;durationMinutes:number;rewardPoints:number};
  drop:{claimedToday:boolean;streak:number;base:number;increment:number;maxDays:number;nextResetAt:string};
};
export async function getHomeRewardState():Promise<HomeRewardState|null>{try{return(await edgePost<{data:HomeRewardState}>('home-rewards',{action:'state'})).data||null;}catch(err){console.error('home state error:',err);return null;}}
export async function startFarm(){try{return await edgePost<any>('home-rewards',{action:'farm-start'});}catch(e){return{success:false,message:(e as Error).message};}}
export async function claimFarm(){try{return await edgePost<any>('home-rewards',{action:'farm-claim'});}catch(e){return{success:false,message:(e as Error).message};}}
export async function claimDailyDrop(){try{return await edgePost<any>('home-rewards',{action:'daily-drop'});}catch(e){return{success:false,message:(e as Error).message};}}

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

export type PromoClaimResult={success:boolean;code?:string;promoCode?:string;reward?:number;balance?:number;title?:string;message?:string};
export type AdminPromo={id:string;code:string;title:string;reward_points:number;max_claims:number;total_claimed:number;is_active:boolean;expires_at:string|null;created_at:string;updated_at?:string};
export async function claimPromoCode(code:string):Promise<PromoClaimResult>{
  try{
    await showRewardAd('adsgram');
    return await edgePost<PromoClaimResult>('promo-api',{action:'claim',code:code.trim().toUpperCase()});
  }
  catch(e){return{success:false,message:(e as Error).message};}
}
export async function adminGetPromos():Promise<AdminPromo[]>{try{return(await edgePost<{success:boolean;data:AdminPromo[]}>('promo-api',{action:'admin-list'})).data||[];}catch(err){console.error('admin promos error:',err);return[];}}
export async function adminGeneratePromoCode():Promise<{success:boolean;code?:string;message?:string}>{try{return await edgePost('promo-api',{action:'admin-generate'});}catch(e){return{success:false,message:(e as Error).message};}}
export async function adminCreatePromo(promo:{code:string;rewardPoints:number;maxClaims:number;expiresAt?:string|null;isActive?:boolean}){try{return await edgePost('promo-api',{action:'admin-create',...promo,title:`Promo ${promo.code.trim().toUpperCase()}`});}catch(e){return{success:false,message:(e as Error).message};}}
export async function adminUpdatePromo(id:string,patch:{isActive?:boolean;rewardPoints?:number;maxClaims?:number;expiresAt?:string|null}){try{return await edgePost('promo-api',{action:'admin-update',id,...patch});}catch(e){return{success:false,message:(e as Error).message};}}
export async function adminDeletePromo(id:string){try{return await edgePost('promo-api',{action:'admin-delete',id});}catch(e){return{success:false,message:(e as Error).message};}}

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
export async function adminBanUser(userId:string,banned:boolean,reason?:string){try{return await edgePost('admin-user-status',{userId,banned,reason:reason||''});}catch(e){return{success:false,message:(e as Error).message};}}
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
