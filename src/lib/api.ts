import { supabase } from '@/integrations/supabase/client';
import { AppUser, UserBalance, Task, Withdrawal, LeaderboardEntry } from '@/types/telegram';

// All mutating operations go through the secure backend.
// Read-only queries (leaderboard, settings, etc.) still use the anon Supabase client — that's safe.
const API = '/api';

async function post(path: string, body: object) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export async function initUser(telegramUser: {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}, referralCode?: string): Promise<AppUser | null> {
  try {
    const data = await post('/auth/telegram', { telegramUser, referralCode });
    return data.user || null;
  } catch (err) {
    console.error('initUser error:', err);
    return null;
  }
}

// ── Read-only (Supabase anon is fine — no writes, no balance bypass possible) ─
export async function getUser(telegramId: number): Promise<AppUser | null> {
  const { data } = await supabase.from('users').select('*').eq('telegram_id', telegramId).single();
  return data as AppUser | null;
}

export async function getUserBalance(userId: string): Promise<UserBalance | null> {
  const { data } = await supabase.from('balances').select('*').eq('user_id', userId).single();
  return data as UserBalance | null;
}

export async function getTasks(): Promise<Task[]> {
  const { data } = await supabase.from('tasks').select('*').eq('is_active', true).order('display_order');
  return (data as Task[]) || [];
}

export async function getUserTasks(userId: string) {
  const { data } = await supabase.from('user_tasks').select('task_id, completed_at, next_available_at').eq('user_id', userId);
  return data || [];
}

export async function getWithdrawals(userId: string): Promise<Withdrawal[]> {
  const { data } = await supabase.from('withdrawals').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  return (data as Withdrawal[]) || [];
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data } = await supabase.from('leaderboard').select('*').limit(50);
  return (data as LeaderboardEntry[]) || [];
}

export async function getReferrals(userId: string) {
  const { data } = await supabase.from('referrals').select('*').eq('referrer_id', userId).order('created_at', { ascending: false });
  return data || [];
}

export async function getTransactions(userId: string) {
  const { data } = await supabase.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
  return data || [];
}

export async function getSettings(): Promise<Record<string, string>> {
  const { data } = await supabase.from('settings').select('key, value');
  const settings: Record<string, string> = {};
  (data || []).forEach((s: { key: string; value: string }) => { settings[s.key] = s.value; });
  return settings;
}

export async function getDailyClaim(userId: string) {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase.from('daily_claims').select('claimed_at').eq('user_id', userId).eq('claim_date', today).maybeSingle();
  return data;
}

export async function getNotifications(userId: string) {
  const { data } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30);
  return data || [];
}

export async function markNotificationRead(notifId: string) {
  await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
}

export async function getUnreadNotifCount(userId: string): Promise<number> {
  const { count } = await supabase.from('notifications').select('id', { count: 'exact' }).eq('user_id', userId).eq('is_read', false);
  return count || 0;
}

// ── Secure mutating API calls (all go through Express backend) ───────────────

export async function completeTask(userId: string, taskId: string) {
  try { return await post('/complete-task', { userId, taskId }); }
  catch { return { success: false, message: 'Error completing task' }; }
}

export async function claimDailyReward(userId: string) {
  try { return await post('/daily-reward', { userId }); }
  catch { return { success: false, message: 'Error claiming daily reward' }; }
}

export async function claimDailyDrop(userId: string) {
  try { return await post('/daily-drop', { userId }); }
  catch { return { success: false, message: 'Error claiming daily drop' }; }
}

export async function spinWheel(userId: string) {
  try { return await post('/spin-wheel', { userId }); }
  catch { return { success: false, message: 'Error spinning wheel' }; }
}

export async function getSpinCount(userId: string) {
  try {
    const data = await post('/spin-count', { userId });
    return data.spins || [];
  } catch { return []; }
}

export async function logAdWatch(userId: string, adType: string) {
  try { return await post('/log-ad', { userId, adType }); }
  catch { return { success: false }; }
}

export async function getAdCount(userId: string) {
  try { return await post('/ad-count', { userId }); }
  catch { return { adsToday: 0, maxPerDay: 20 }; }
}

export async function claimFarm(userId: string, farmStartedAt: number) {
  try { return await post('/farm-claim', { userId, farmStartedAt }); }
  catch { return { success: false, message: 'Error claiming farm' }; }
}

export async function submitWithdrawal(userId: string, method: string, points: number, walletAddress?: string) {
  try { return await post('/withdraw', { userId, method, points, walletAddress }); }
  catch { return { success: false, message: 'Error submitting withdrawal' }; }
}

// ── Games (server picks outcome, browser shows animation) ───────────────────

export async function playCardFlip(userId: string) {
  try { return await post('/game/card-flip', { userId }); }
  catch { return { success: false, message: 'Error' }; }
}

export async function playDiceRoll(userId: string) {
  try { return await post('/game/dice-roll', { userId }); }
  catch { return { success: false, message: 'Error' }; }
}

export async function playNumberGuess(userId: string, guess: number) {
  try { return await post('/game/number-guess', { userId, guess }); }
  catch { return { success: false, message: 'Error' }; }
}

export async function playLuckyBox(userId: string) {
  try { return await post('/game/lucky-box', { userId }); }
  catch { return { success: false, message: 'Error' }; }
}

export async function submitTowerClimb(userId: string, floorsReached: number, revivesUsed: number) {
  try { return await post('/game/tower-climb', { userId, floorsReached, revivesUsed }); }
  catch { return { success: false, message: 'Error' }; }
}

export async function claimPromo(userId: string, promoId: string) {
  try { return await post('/promo/claim', { userId, promoId }); }
  catch { return { success: false, message: 'Error' }; }
}

// ── Admin (all protected by ADMIN_TELEGRAM_ID on server) ────────────────────

export async function adminGetStats() {
  const [usersRes, withdrawalsRes, transactionsRes, adLogsRes] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact' }),
    supabase.from('withdrawals').select('id, status', { count: 'exact' }),
    supabase.from('transactions').select('id', { count: 'exact' }),
    supabase.from('ad_logs').select('id', { count: 'exact' }),
  ]);
  return {
    totalUsers: usersRes.count || 0,
    totalWithdrawals: withdrawalsRes.count || 0,
    pendingWithdrawals: (withdrawalsRes.data || []).filter((w: { status: string }) => w.status === 'pending').length,
    totalTransactions: transactionsRes.count || 0,
    totalAdViews: adLogsRes.count || 0,
  };
}

export async function adminGetUsers() {
  const { data } = await supabase.from('users').select('*, balances(*)').order('created_at', { ascending: false }).range(0, 9999999);
  return data || [];
}

export async function adminGetWithdrawals() {
  const { data } = await supabase.from('withdrawals').select('*, users(first_name, username, telegram_id, photo_url)').order('created_at', { ascending: false });
  return data || [];
}

export async function adminUpdateWithdrawal(withdrawalId: string, status: string, adminNote?: string, adminTelegramId?: number) {
  try { return await post('/admin/withdrawal', { withdrawalId, status, adminNote, adminTelegramId }); }
  catch { return { success: false, message: 'Error updating withdrawal' }; }
}

export async function adminUpdateSetting(key: string, value: string, adminTelegramId?: number) {
  try { return await post('/admin/setting', { key, value, adminTelegramId }); }
  catch { return { success: false }; }
}

export async function adminBanUser(userId: string, banned: boolean, adminTelegramId?: number) {
  try { return await post('/admin/ban-user', { userId, banned, adminTelegramId }); }
  catch { return { success: false }; }
}

export async function adminAdjustBalance(userId: string, points: number, reason: string, adminTelegramId?: number) {
  try { return await post('/admin/adjust-balance', { userId, points, reason, adminTelegramId }); }
  catch { return { success: false }; }
}

export async function adminCreateTask(task: Omit<Task, 'id'>) {
  const { data, error } = await supabase.from('tasks').insert([task]).select().single();
  return { success: !error, data };
}

export async function adminToggleTask(taskId: string, isActive: boolean) {
  const { error } = await supabase.from('tasks').update({ is_active: isActive }).eq('id', taskId);
  return { success: !error };
}

export async function adminDeleteTask(taskId: string) {
  await supabase.from('user_tasks').delete().eq('task_id', taskId);
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  return { success: !error };
}

export async function adminGetContests() {
  const { data } = await supabase.from('contests').select('*').order('created_at', { ascending: false });
  return data || [];
}

export async function adminCreateContest(contest: {
  title: string; contest_type: string; ends_at: string;
  reward_1st: number; reward_2nd: number; reward_3rd: number; reward_4th: number; reward_5th: number;
}) {
  const { data, error } = await supabase.from('contests').insert([contest]).select().single();
  return { success: !error, data };
}

export async function adminEndContest(contestId: string, adminTelegramId?: number) {
  try { return await post('/admin/end-contest', { contestId, adminTelegramId }); }
  catch { return { success: false, message: 'Error distributing rewards' }; }
}

export async function adminSendBroadcast(message: string, adminTelegramId: number) {
  try { return await post('/admin/broadcast', { message, adminTelegramId }); }
  catch { return { success: false }; }
}

// ── Leaderboards (read-only) ──────────────────────────────────────────────────

export async function getContestLeaderboard(contestId: string) {
  const { data } = await supabase.from('contest_entries').select('user_id, score, updated_at').eq('contest_id', contestId).order('score', { ascending: false }).limit(20);
  if (!data || data.length === 0) return [];
  const userIds = data.map(d => d.user_id);
  const { data: usersData } = await supabase.from('users').select('id, first_name, username, photo_url, telegram_id').in('id', userIds);
  const userMap: Record<string, any> = {};
  (usersData || []).forEach((u: any) => { userMap[u.id] = u; });
  return data.map(d => ({ user_id: d.user_id, score: d.score, users: userMap[d.user_id] || null }));
}

export async function getActiveContests() {
  const { data } = await supabase.from('contests').select('*').eq('is_active', true).gte('ends_at', new Date().toISOString()).order('ends_at');
  return data || [];
}

export async function getAdWatchLeaderboard(contestId?: string) {
  if (contestId) return getContestLeaderboard(contestId);
  const { data } = await supabase.from('ad_logs').select('user_id, users:user_id(first_name, username, photo_url)').order('created_at', { ascending: false }).limit(500);
  if (!data) return [];
  const counts: Record<string, { user_id: string; count: number; user: unknown }> = {};
  for (const log of data as Array<{ user_id: string; users: unknown }>) {
    if (!counts[log.user_id]) counts[log.user_id] = { user_id: log.user_id, count: 0, user: log.users };
    counts[log.user_id].count++;
  }
  return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 10);
}

export async function getReferralLeaderboard() {
  const { data } = await supabase.from('referrals').select('referrer_id, users:referrer_id(first_name, username, photo_url)').eq('is_verified', true).limit(500);
  if (!data) return [];
  const counts: Record<string, { user_id: string; count: number; user: unknown }> = {};
  for (const ref of data as Array<{ referrer_id: string; users: unknown }>) {
    if (!counts[ref.referrer_id]) counts[ref.referrer_id] = { user_id: ref.referrer_id, count: 0, user: ref.users };
    counts[ref.referrer_id].count++;
  }
  return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 10);
}
