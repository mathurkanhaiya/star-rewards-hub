import { supabase } from '@/integrations/supabase/client';
import { AppUser, UserBalance, Task, Withdrawal, LeaderboardEntry } from '@/types/telegram';

const SUPABASE_URL = 'https://eoppaqrqlpyqoizohoba.supabase.co';
const EDGE_FN = `${SUPABASE_URL}/functions/v1`;
const ANON_KEY = 'sb_publishable_DJ7o0hTt3DPL8O_3HbAWuw_NkdvY0na';

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(id); }
}

function telegramInitData(): string {
  return window.Telegram?.WebApp?.initData || '';
}

function protectedHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': ANON_KEY,
    'x-telegram-init-data': telegramInitData(),
  };
}

async function securePost<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await fetchWithTimeout(`${EDGE_FN}/secure-api`, {
    method: 'POST',
    headers: protectedHeaders(),
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || data?.error || 'Backend request failed');
  return data;
}

export async function initUser(_telegramUser: { id:number; first_name:string; last_name?:string; username?:string; photo_url?:string }, referralCode?: string): Promise<AppUser | null> {
  try {
    if (!telegramInitData()) return null;
    const response = await fetchWithTimeout(`${EDGE_FN}/telegram-auth`, {
      method: 'POST', headers: protectedHeaders(), body: JSON.stringify({ referralCode }),
    });
    const data = await response.json();
    return response.ok ? data.user || null : null;
  } catch (err) { console.error('initUser error:', err); return null; }
}

export async function getUser(_telegramId: number): Promise<AppUser | null> {
  try { return (await securePost<{data:AppUser|null}>('get-user')).data || null; } catch { return null; }
}

export async function getUserBalance(_userId: string): Promise<UserBalance | null> {
  try { return (await securePost<{data:UserBalance|null}>('get-balance')).data || null; } catch { return null; }
}

export async function getTasks(): Promise<Task[]> {
  const { data } = await supabase.from('tasks').select('*').eq('is_active', true).order('display_order');
  return (data as Task[]) || [];
}

export async function getUserTasks(_userId: string) {
  try { return (await securePost<{data:any[]}>('get-user-tasks')).data || []; } catch { return []; }
}

export async function completeTask(_userId: string, taskId: string): Promise<{success:boolean;points?:number;message?:string}> {
  try {
    const r = await fetchWithTimeout(`${EDGE_FN}/complete-task`, { method:'POST', headers:protectedHeaders(), body:JSON.stringify({ taskId }) });
    return await r.json();
  } catch { return { success:false, message:'Error completing task' }; }
}

export async function claimDailyReward(_userId: string): Promise<{success:boolean;points?:number;streak?:number;message?:string}> {
  try {
    const r = await fetchWithTimeout(`${EDGE_FN}/daily-reward`, { method:'POST', headers:protectedHeaders(), body:'{}' });
    return await r.json();
  } catch { return { success:false, message:'Error claiming daily reward' }; }
}

export async function spinWheel(_userId: string): Promise<{success:boolean;result?:string;points?:number;stars?:number;message?:string}> {
  try {
    const r = await fetchWithTimeout(`${EDGE_FN}/spin-wheel`, { method:'POST', headers:protectedHeaders(), body:'{}' });
    return await r.json();
  } catch { return { success:false, message:'Error spinning wheel' }; }
}

export async function submitWithdrawal(_userId:string, method:string, points:number, walletAddress?:string): Promise<{success:boolean;message?:string}> {
  try {
    const r = await fetchWithTimeout(`${EDGE_FN}/withdraw`, { method:'POST', headers:protectedHeaders(), body:JSON.stringify({ method, points, walletAddress }) });
    return await r.json();
  } catch { return { success:false, message:'Error submitting withdrawal' }; }
}

export async function getWithdrawals(_userId:string): Promise<Withdrawal[]> {
  try { return (await securePost<{data:Withdrawal[]}>('get-withdrawals')).data || []; } catch { return []; }
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  try { return (await securePost<{data:LeaderboardEntry[]}>('leaderboard')).data || []; } catch { return []; }
}

export async function getReferrals(_userId:string) {
  try { return (await securePost<{data:any[]}>('get-referrals')).data || []; } catch { return []; }
}

export async function getTransactions(_userId:string) {
  try { return (await securePost<{data:any[]}>('get-transactions')).data || []; } catch { return []; }
}

export async function logAdWatch(_userId:string, adType:string, _rewardGiven:number, provider='adsgram') {
  try {
    const r = await fetchWithTimeout(`${EDGE_FN}/log-ad`, { method:'POST', headers:protectedHeaders(), body:JSON.stringify({ adType, provider }) });
    return await r.json();
  } catch { return { success:false }; }
}

export async function getSettings(): Promise<Record<string,string>> {
  const { data } = await supabase.from('settings').select('key,value');
  return Object.fromEntries((data || []).map((s:{key:string;value:string}) => [s.key,s.value]));
}

export async function getDailyClaim(_userId:string) {
  try { return (await securePost<{data:any}>('get-daily-claim')).data; } catch { return null; }
}

export async function getSpinCount(_userId:string) {
  try { return (await securePost<{data:any[]}>('get-spin-count')).data || []; } catch { return []; }
}

export async function getNotifications(_userId:string) {
  try { return (await securePost<{data:any[]}>('get-notifications')).data || []; } catch { return []; }
}

export async function markNotificationRead(notifId:string) {
  try { await securePost('mark-notification-read', { notificationId:notifId }); } catch {}
}

export async function getUnreadNotifCount(_userId:string): Promise<number> {
  try { return (await securePost<{count:number}>('unread-count')).count || 0; } catch { return 0; }
}

export async function adminGetStats() { return (await securePost<{data:any}>('admin:stats')).data; }
export async function adminGetUsers() { return (await securePost<{data:any[]}>('admin:users')).data || []; }
export async function adminGetWithdrawals() { return (await securePost<{data:any[]}>('admin:withdrawals')).data || []; }

export async function adminUpdateWithdrawal(withdrawalId:string, status:string, adminNote?:string) {
  try {
    const r=await fetchWithTimeout(`${EDGE_FN}/admin-withdrawal`,{method:'POST',headers:protectedHeaders(),body:JSON.stringify({withdrawalId,status,adminNote})});
    return await r.json();
  } catch { return {success:false,message:'Error updating withdrawal'}; }
}

export async function adminUpdateSetting(key:string,value:string) {
  try { return await securePost('admin:update-setting',{key,value}); } catch(e) { return {success:false,message:(e as Error).message}; }
}
export async function adminBanUser(userId:string,banned:boolean) {
  try { return await securePost('admin:ban-user',{userId,banned}); } catch { return {success:false}; }
}
export async function adminAdjustBalance(userId:string,points:number,reason:string) {
  try { return await securePost('admin:adjust-balance',{userId,points,reason}); } catch { return {success:false}; }
}
export async function adminCreateTask(task:Omit<Task,'id'>) {
  try { return await securePost('admin:create-task',{task}); } catch { return {success:false}; }
}
export async function adminToggleTask(taskId:string,isActive:boolean) {
  try { return await securePost('admin:toggle-task',{taskId,isActive}); } catch { return {success:false}; }
}
export async function adminDeleteTask(taskId:string) {
  try { return await securePost('admin:delete-task',{taskId}); } catch { return {success:false}; }
}
export async function adminGetContests() {
  try { return (await securePost<{data:any[]}>('admin:contests')).data || []; } catch { return []; }
}
export async function adminCreateContest(contest:{title:string;contest_type:string;ends_at:string;reward_1st:number;reward_2nd:number;reward_3rd:number;reward_4th:number;reward_5th:number}) {
  try { return await securePost('admin:create-contest',{contest}); } catch { return {success:false}; }
}
export async function adminEndContest(contestId:string) {
  try {
    const r=await fetchWithTimeout(`${EDGE_FN}/distribute-contest`,{method:'POST',headers:protectedHeaders(),body:JSON.stringify({contestId})});
    return await r.json();
  } catch { return {success:false,message:'Error distributing rewards'}; }
}
export async function getContestLeaderboard(contestId:string) {
  try { return (await securePost<{data:any[]}>('contest-leaderboard',{contestId})).data || []; } catch { return []; }
}
export async function getActiveContests() {
  const { data }=await supabase.from('contests').select('*').eq('is_active',true).gte('ends_at',new Date().toISOString()).order('ends_at');
  return data || [];
}
export async function adminSendBroadcast(message:string,_adminTelegramId:number) {
  try { return await securePost('admin:broadcast',{message}); } catch { return {success:false}; }
}
export async function getAdWatchLeaderboard(contestId?:string) {
  try { return (await securePost<{data:any[]}>('ad-watch-leaderboard',{contestId})).data || []; } catch { return []; }
}
export async function getReferralLeaderboard() {
  try { return (await securePost<{data:any[]}>('referral-leaderboard')).data || []; } catch { return []; }
}
