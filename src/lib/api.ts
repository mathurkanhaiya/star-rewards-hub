import { supabase } from '@/integrations/supabase/client';
import { AppUser, UserBalance, Task, Withdrawal, LeaderboardEntry } from '@/types/telegram';

/* ── Edge function base URL ── */
const EDGE_FN = `https://utfkqzmrcdfbnjdkjais.supabase.co/functions/v1`;

/* ── Auth headers for edge functions ── */
function edgeHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  };
}

/* ── Safe edge function caller ── */
async function callEdge<T = any>(
  fn: string,
  body: Record<string, unknown>
): Promise<T & { success: boolean; message?: string }> {
  try {
    const res = await fetch(`${EDGE_FN}/${fn}`, {
      method: 'POST',
      headers: edgeHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[${fn}] HTTP ${res.status}:`, text);
      return { success: false, message: `HTTP ${res.status}: ${text}` } as any;
    }
    return await res.json();
  } catch (err: any) {
    console.error(`[${fn}] Error:`, err);
    return { success: false, message: err?.message || 'Network error' } as any;
  }
}

/* ════════════════════════════════════════
   USER
════════════════════════════════════════ */

export async function initUser(
  telegramUser: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
  },
  referralCode?: string
): Promise<AppUser | null> {
  const data = await callEdge('telegram-auth', {
    telegramUser,
    referralCode,
  });
  return data?.user || null;
}

export async function getUser(telegramId: number): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();
  if (error) { console.error('getUser error:', error); return null; }
  return data as AppUser | null;
}

export async function getUserBalance(userId: string): Promise<UserBalance | null> {
  const { data, error } = await supabase
    .from('balances')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) { console.error('getUserBalance error:', error); return null; }
  return data as UserBalance | null;
}

export async function updateUserProfile(
  userId: string,
  updates: { first_name?: string; username?: string; photo_url?: string }
) {
  const { error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId);
  return { success: !error, message: error?.message };
}

/* ════════════════════════════════════════
   TASKS
════════════════════════════════════════ */

export async function getTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('is_active', true)
    .order('display_order');
  if (error) { console.error('getTasks error:', error); return []; }
  return (data as Task[]) || [];
}

export async function getUserTasks(userId: string) {
  const { data, error } = await supabase
    .from('user_tasks')
    .select('task_id, completed_at, next_available_at')
    .eq('user_id', userId);
  if (error) { console.error('getUserTasks error:', error); return []; }
  return data || [];
}

export async function completeTask(
  userId: string,
  taskId: string
): Promise<{ success: boolean; points?: number; message?: string }> {
  return callEdge('complete-task', { userId, taskId });
}

/* ════════════════════════════════════════
   DAILY REWARD
════════════════════════════════════════ */

export async function claimDailyReward(
  userId: string
): Promise<{ success: boolean; points?: number; streak?: number; message?: string }> {
  return callEdge('daily-reward', { userId });
}

export async function getDailyClaim(userId: string) {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('daily_claims')
    .select('claimed_at, streak')
    .eq('user_id', userId)
    .eq('claim_date', today)
    .maybeSingle();
  if (error) { console.error('getDailyClaim error:', error); return null; }
  return data;
}

/* ════════════════════════════════════════
   SPIN WHEEL
════════════════════════════════════════ */

export async function spinWheel(
  userId: string
): Promise<{ success: boolean; result?: string; points?: number; stars?: number; message?: string }> {
  return callEdge('spin-wheel', { userId });
}

export async function getSpinCount(userId: string) {
  const { data, error } = await supabase
    .from('spin_results')
    .select('spun_at')
    .eq('user_id', userId)
    .order('spun_at', { ascending: false })
    .limit(10);
  if (error) { console.error('getSpinCount error:', error); return []; }
  return data || [];
}

/* ════════════════════════════════════════
   ADS
════════════════════════════════════════ */

export async function logAdWatch(
  userId: string,
  adType: string,
  rewardGiven: number
): Promise<{ success: boolean }> {
  return callEdge('log-ad', { userId, adType, rewardGiven });
}

export async function getAdWatchCount(
  userId: string,
  since?: string
): Promise<number> {
  let query = supabase
    .from('ad_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (since) query = query.gte('created_at', since);
  const { count } = await query;
  return count || 0;
}

export async function getTodayAdCount(userId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  return getAdWatchCount(userId, startOfDay.toISOString());
}

/* ════════════════════════════════════════
   WITHDRAWALS
════════════════════════════════════════ */

export async function submitWithdrawal(
  userId: string,
  method: string,
  points: number,
  walletAddress?: string
): Promise<{ success: boolean; message?: string }> {
  return callEdge('withdraw', { userId, method, points, walletAddress });
}

export async function getWithdrawals(userId: string): Promise<Withdrawal[]> {
  const { data, error } = await supabase
    .from('withdrawals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) { console.error('getWithdrawals error:', error); return []; }
  return (data as Withdrawal[]) || [];
}

/* ════════════════════════════════════════
   LEADERBOARD
════════════════════════════════════════ */

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  /* Primary: query balances directly — most accurate */
  const { data: balances, error } = await supabase
    .from('balances')
    .select('user_id, points, total_earned')
    .order('points', { ascending: false })
    .limit(50);

  if (error || !balances || balances.length === 0) {
    /* Fallback to leaderboard view */
    const { data: lbData } = await supabase
      .from('leaderboard')
      .select('*')
      .limit(50);
    return (lbData as LeaderboardEntry[]) || [];
  }

  const userIds = balances.map(b => b.user_id);
  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, username, telegram_id, photo_url, level')
    .in('id', userIds);

  const userMap: Record<string, any> = {};
  (users || []).forEach(u => { userMap[u.id] = u; });

  return balances.map((b, i) => ({
    id:           b.user_id,
    user_id:      b.user_id,
    telegram_id:  userMap[b.user_id]?.telegram_id || 0,
    first_name:   userMap[b.user_id]?.first_name  || 'User',
    username:     userMap[b.user_id]?.username     || '',
    photo_url:    userMap[b.user_id]?.photo_url    || null,
    level:        userMap[b.user_id]?.level        || 1,
    total_points: b.points,
    points:       b.points,
    total_earned: b.total_earned,
    rank:         i + 1,
  })) as LeaderboardEntry[];
}

/* ════════════════════════════════════════
   REFERRALS
════════════════════════════════════════ */

export async function getReferrals(userId: string) {
  const { data, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('referrer_id', userId)
    .order('created_at', { ascending: false });
  if (error) { console.error('getReferrals error:', error); return []; }
  return data || [];
}

export async function getReferralStats(userId: string) {
  const { data, error } = await supabase
    .from('referrals')
    .select('is_verified, points_earned')
    .eq('referrer_id', userId);
  if (error) return { total: 0, verified: 0, totalEarned: 0 };
  return {
    total:       (data || []).length,
    verified:    (data || []).filter((r: any) => r.is_verified).length,
    totalEarned: (data || []).reduce((s: number, r: any) => s + (r.points_earned || 0), 0),
  };
}

/* ════════════════════════════════════════
   TRANSACTIONS
════════════════════════════════════════ */

export async function getTransactions(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('getTransactions error:', error); return []; }
  return data || [];
}

/* ════════════════════════════════════════
   NOTIFICATIONS
════════════════════════════════════════ */

export async function getNotifications(userId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) { console.error('getNotifications error:', error); return []; }
  return data || [];
}

export async function markNotificationRead(notifId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notifId);
  return { success: !error };
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  return { success: !error };
}

export async function getUnreadNotifCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) return 0;
  return count || 0;
}

/* ════════════════════════════════════════
   SETTINGS
════════════════════════════════════════ */

export async function getSettings(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('settings')
    .select('key, value');
  if (error) { console.error('getSettings error:', error); return {}; }
  const settings: Record<string, string> = {};
  (data || []).forEach((s: { key: string; value: string }) => {
    settings[s.key] = s.value;
  });
  return settings;
}

export async function getSetting(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .single();
  if (error) return null;
  return data?.value || null;
}

/* ════════════════════════════════════════
   CONTESTS — PUBLIC
════════════════════════════════════════ */

export async function getActiveContests() {
  const { data, error } = await supabase
    .from('contests')
    .select('*')
    .eq('is_active', true)
    .eq('rewards_distributed', false)
    .gte('ends_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) { console.error('getActiveContests error:', error); return []; }
  return data || [];
}

export async function getContestById(contestId: string) {
  const { data, error } = await supabase
    .from('contests')
    .select('*')
    .eq('id', contestId)
    .single();
  if (error) { console.error('getContestById error:', error); return null; }
  return data;
}

export async function getContestLeaderboard(contestId: string) {
  const { data, error } = await supabase
    .from('contest_entries')
    .select('user_id, score, updated_at')
    .eq('contest_id', contestId)
    .order('score', { ascending: false })
    .limit(50);

  if (error || !data || data.length === 0) return [];

  const userIds = data.map((d: any) => d.user_id);
  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, username, photo_url, telegram_id')
    .in('id', userIds);

  const userMap: Record<string, any> = {};
  (users || []).forEach((u: any) => { userMap[u.id] = u; });

  return data.map((d: any, i: number) => ({
    rank:        i + 1,
    user_id:     d.user_id,
    score:       d.score,
    first_name:  userMap[d.user_id]?.first_name  || 'User',
    username:    userMap[d.user_id]?.username     || '',
    photo_url:   userMap[d.user_id]?.photo_url    || null,
    telegram_id: userMap[d.user_id]?.telegram_id  || 0,
  }));
}

/* ── Ad-watch leaderboard for a contest window ── */
export async function getAdContestLeaderboard(
  contest: { ends_at: string; duration_hours?: number },
  limit = 50
) {
  const dh = (contest as any).duration_hours || 24;
  const startISO = new Date(
    new Date(contest.ends_at).getTime() - dh * 3600000
  ).toISOString();

  const { data: logs, error } = await supabase
    .from('ad_logs')
    .select('user_id, created_at')
    .gte('created_at', startISO)
    .lt('created_at', contest.ends_at);

  if (error || !logs || logs.length === 0) return [];

  const counts: Record<string, number> = {};
  logs.forEach((l: any) => {
    counts[l.user_id] = (counts[l.user_id] || 0) + 1;
  });

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  if (sorted.length === 0) return [];

  const userIds = sorted.map(([uid]) => uid);
  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, username, photo_url, telegram_id')
    .in('id', userIds);

  const userMap: Record<string, any> = {};
  (users || []).forEach((u: any) => { userMap[u.id] = u; });

  return sorted.map(([uid, cnt], i) => ({
    rank:        i + 1,
    user_id:     uid,
    ad_count:    cnt,
    first_name:  userMap[uid]?.first_name  || 'User',
    username:    userMap[uid]?.username     || '',
    photo_url:   userMap[uid]?.photo_url    || null,
    telegram_id: userMap[uid]?.telegram_id  || 0,
  }));
}

/* ── Referral leaderboard for a contest window ── */
export async function getReferralContestLeaderboard(
  contest: { ends_at: string; duration_hours?: number },
  limit = 50
) {
  const dh = (contest as any).duration_hours || 24;
  const startISO = new Date(
    new Date(contest.ends_at).getTime() - dh * 3600000
  ).toISOString();

  const { data: refs, error } = await supabase
    .from('referrals')
    .select('referrer_id, is_verified, points_earned, created_at')
    .gte('created_at', startISO)
    .lt('created_at', contest.ends_at);

  if (error || !refs || refs.length === 0) return [];

  const agg: Record<string, { total: number; verified: number; points: number }> = {};
  refs.forEach((r: any) => {
    if (!agg[r.referrer_id]) agg[r.referrer_id] = { total: 0, verified: 0, points: 0 };
    agg[r.referrer_id].total++;
    if (r.is_verified) agg[r.referrer_id].verified++;
    agg[r.referrer_id].points += r.points_earned || 0;
  });

  const sorted = Object.entries(agg)
    .sort((a, b) => b[1].verified - a[1].verified || b[1].total - a[1].total)
    .slice(0, limit);

  if (sorted.length === 0) return [];

  const userIds = sorted.map(([uid]) => uid);
  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, username, photo_url, telegram_id')
    .in('id', userIds);

  const userMap: Record<string, any> = {};
  (users || []).forEach((u: any) => { userMap[u.id] = u; });

  return sorted.map(([uid, data], i) => ({
    rank:            i + 1,
    user_id:         uid,
    referral_count:  data.total,
    verified_count:  data.verified,
    points_earned:   data.points,
    first_name:      userMap[uid]?.first_name  || 'User',
    username:        userMap[uid]?.username     || '',
    photo_url:       userMap[uid]?.photo_url    || null,
    telegram_id:     userMap[uid]?.telegram_id  || 0,
  }));
}

/* ── All-time ad-watch leaderboard (no contest) ── */
export async function getAdWatchLeaderboard(contestId?: string) {
  if (contestId) return getContestLeaderboard(contestId);

  const { data, error } = await supabase
    .from('ad_logs')
    .select('user_id')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error || !data) return [];

  const counts: Record<string, number> = {};
  data.forEach((l: any) => {
    counts[l.user_id] = (counts[l.user_id] || 0) + 1;
  });

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  if (sorted.length === 0) return [];

  const userIds = sorted.map(([uid]) => uid);
  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, username, photo_url, telegram_id')
    .in('id', userIds);

  const userMap: Record<string, any> = {};
  (users || []).forEach((u: any) => { userMap[u.id] = u; });

  return sorted.map(([uid, count], i) => ({
    rank:        i + 1,
    user_id:     uid,
    score:       count,
    first_name:  userMap[uid]?.first_name  || 'User',
    username:    userMap[uid]?.username     || '',
    photo_url:   userMap[uid]?.photo_url    || null,
    telegram_id: userMap[uid]?.telegram_id  || 0,
  }));
}

/* ── All-time referral leaderboard (no contest) ── */
export async function getReferralLeaderboard() {
  const { data, error } = await supabase
    .from('referrals')
    .select('referrer_id, is_verified')
    .eq('is_verified', true)
    .limit(1000);

  if (error || !data) return [];

  const counts: Record<string, number> = {};
  data.forEach((r: any) => {
    counts[r.referrer_id] = (counts[r.referrer_id] || 0) + 1;
  });

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  if (sorted.length === 0) return [];

  const userIds = sorted.map(([uid]) => uid);
  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, username, photo_url, telegram_id')
    .in('id', userIds);

  const userMap: Record<string, any> = {};
  (users || []).forEach((u: any) => { userMap[u.id] = u; });

  return sorted.map(([uid, count], i) => ({
    rank:        i + 1,
    user_id:     uid,
    count,
    first_name:  userMap[uid]?.first_name  || 'User',
    username:    userMap[uid]?.username     || '',
    photo_url:   userMap[uid]?.photo_url    || null,
    telegram_id: userMap[uid]?.telegram_id  || 0,
  }));
}

/* ════════════════════════════════════════
   PROMOS — PUBLIC
════════════════════════════════════════ */

export async function claimPromo(
  userId: string,
  code: string
): Promise<{ success: boolean; points?: number; message?: string }> {
  try {
    const { data: promo, error: promoErr } = await supabase
      .from('promos')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .eq('is_active', true)
      .single();

    if (promoErr || !promo) return { success: false, message: 'Invalid promo code' };
    if (promo.uses >= promo.max_uses) return { success: false, message: 'Promo code fully redeemed' };
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return { success: false, message: 'Promo code has expired' };
    }

    /* Check duplicate claim */
    const { data: existing } = await supabase
      .from('promo_claims')
      .select('id')
      .eq('user_id', userId)
      .eq('promo_id', promo.id)
      .maybeSingle();

    if (existing) return { success: false, message: 'You already claimed this promo' };

    /* Credit balance */
    const { data: balance } = await supabase
      .from('balances')
      .select('points, total_earned')
      .eq('user_id', userId)
      .single();

    if (balance) {
      await supabase.from('balances').update({
        points:       balance.points       + promo.points,
        total_earned: balance.total_earned + promo.points,
      }).eq('user_id', userId);
    }

    /* Log transaction */
    await supabase.from('transactions').insert({
      user_id:     userId,
      type:        'promo',
      points:      promo.points,
      description: `🎁 Promo: ${code.toUpperCase()}`,
    });

    /* Record claim */
    await supabase.from('promo_claims').insert({
      user_id:  userId,
      promo_id: promo.id,
    });

    /* Increment use count */
    await supabase.from('promos')
      .update({ uses: promo.uses + 1 })
      .eq('id', promo.id);

    return { success: true, points: promo.points };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Unknown error' };
  }
}

/* ════════════════════════════════════════
   ADMIN — STATS
════════════════════════════════════════ */

export async function adminGetStats() {
  const [
    usersRes,
    withdrawalsRes,
    transactionsRes,
    adLogsRes,
    activeContestsRes,
    tasksRes,
  ] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('withdrawals').select('id, status'),
    supabase.from('transactions').select('id', { count: 'exact', head: true }),
    supabase.from('ad_logs').select('id', { count: 'exact', head: true }),
    supabase.from('contests').select('id', { count: 'exact', head: true })
      .eq('is_active', true).eq('rewards_distributed', false),
    supabase.from('tasks').select('id, is_active'),
  ]);

  const pendingWithdrawals = (withdrawalsRes.data || [])
    .filter((w: any) => w.status === 'pending').length;

  const activeTasks = (tasksRes.data || [])
    .filter((t: any) => t.is_active).length;

  return {
    totalUsers:         usersRes.count         || 0,
    totalWithdrawals:   withdrawalsRes.data?.length || 0,
    pendingWithdrawals,
    totalTransactions:  transactionsRes.count  || 0,
    totalAdViews:       adLogsRes.count        || 0,
    activeContests:     activeContestsRes.count || 0,
    activeTasks,
  };
}

/* ════════════════════════════════════════
   ADMIN — USERS
════════════════════════════════════════ */

export async function adminGetUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*, balances(*)')
    .order('created_at', { ascending: false });
  if (error) { console.error('adminGetUsers error:', error); return []; }
  return data || [];
}

export async function adminBanUser(userId: string, banned: boolean) {
  const { error } = await supabase
    .from('users')
    .update({ is_banned: banned })
    .eq('id', userId);
  return { success: !error, message: error?.message };
}

export async function adminAdjustBalance(
  userId: string,
  points: number,
  reason: string
) {
  const { data: balance, error: balErr } = await supabase
    .from('balances')
    .select('points, total_earned')
    .eq('user_id', userId)
    .single();

  if (balErr || !balance) return { success: false, message: 'Balance not found' };

  const newPoints      = Math.max(0, balance.points + points);
  const newTotalEarned = points > 0
    ? balance.total_earned + points
    : balance.total_earned;

  const { error } = await supabase
    .from('balances')
    .update({ points: newPoints, total_earned: newTotalEarned })
    .eq('user_id', userId);

  if (error) return { success: false, message: error.message };

  await supabase.from('transactions').insert({
    user_id:     userId,
    type:        points >= 0 ? 'admin_credit' : 'admin_debit',
    points:      Math.abs(points),
    description: `🛡️ Admin: ${reason}`,
  });

  return { success: true };
}

export async function adminDeleteUser(userId: string) {
  try {
    await Promise.allSettled([
      supabase.from('transactions').delete().eq('user_id', userId),
      supabase.from('notifications').delete().eq('user_id', userId),
      supabase.from('user_tasks').delete().eq('user_id', userId),
      supabase.from('ad_logs').delete().eq('user_id', userId),
      supabase.from('spin_results').delete().eq('user_id', userId),
      supabase.from('daily_claims').delete().eq('user_id', userId),
      supabase.from('referrals').delete().eq('referrer_id', userId),
      supabase.from('withdrawals').delete().eq('user_id', userId),
      supabase.from('balances').delete().eq('user_id', userId),
    ]);
    const { error } = await supabase.from('users').delete().eq('id', userId);
    return { success: !error, message: error?.message };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Unknown error' };
  }
}

/* ════════════════════════════════════════
   ADMIN — WITHDRAWALS
════════════════════════════════════════ */

export async function adminGetWithdrawals() {
  const { data, error } = await supabase
    .from('withdrawals')
    .select('*, users(first_name, username, telegram_id, photo_url)')
    .order('created_at', { ascending: false });
  if (error) { console.error('adminGetWithdrawals error:', error); return []; }
  return data || [];
}

export async function adminUpdateWithdrawal(
  withdrawalId: string,
  status: string,
  adminNote?: string
): Promise<{ success: boolean; message?: string }> {
  return callEdge('admin-withdrawal', { withdrawalId, status, adminNote });
}

/* ════════════════════════════════════════
   ADMIN — TASKS
════════════════════════════════════════ */

export async function adminCreateTask(task: Omit<Task, 'id'>) {
  const { data, error } = await supabase
    .from('tasks')
    .insert([task])
    .select()
    .single();
  if (error) { console.error('adminCreateTask error:', error); }
  return { success: !error, data, message: error?.message };
}

export async function adminToggleTask(taskId: string, isActive: boolean) {
  const { error } = await supabase
    .from('tasks')
    .update({ is_active: isActive })
    .eq('id', taskId);
  return { success: !error, message: error?.message };
}

export async function adminDeleteTask(taskId: string) {
  await supabase.from('user_tasks').delete().eq('task_id', taskId);
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  return { success: !error, message: error?.message };
}

/* ════════════════════════════════════════
   ADMIN — SETTINGS
════════════════════════════════════════ */

export async function adminUpdateSetting(key: string, value: string) {
  const { data: existing } = await supabase
    .from('settings')
    .select('id')
    .eq('key', key)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key);
    return { success: !error, message: error?.message };
  } else {
    const { error } = await supabase
      .from('settings')
      .insert({ key, value, updated_at: new Date().toISOString() });
    return { success: !error, message: error?.message };
  }
}

/* ════════════════════════════════════════
   ADMIN — CONTESTS
════════════════════════════════════════ */

export async function adminGetContests() {
  const { data, error } = await supabase
    .from('contests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('adminGetContests error:', error); return []; }
  return data || [];
}

export async function adminCreateContest(contest: any) {
  try {
    const insertData: any = {
      title:               contest.title?.trim(),
      contest_type:        contest.contest_type,
      ends_at:             contest.ends_at,
      is_active:           true,
      rewards_distributed: false,
      reward_1st:          Number(contest.reward_1st) || 0,
      reward_2nd:          Number(contest.reward_2nd) || 0,
      reward_3rd:          Number(contest.reward_3rd) || 0,
      reward_4th:          Number(contest.reward_4th) || 0,
      reward_5th:          Number(contest.reward_5th) || 0,
    };

    /* Extended fields — added only if present */
    if (contest.description)    insertData.description    = contest.description;
    if (contest.reward_method)  insertData.reward_method  = contest.reward_method;
    if (contest.banner_emoji)   insertData.banner_emoji   = contest.banner_emoji;
    if (contest.winner_count)   insertData.winner_count   = Number(contest.winner_count);
    if (contest.duration_hours) insertData.duration_hours = Number(contest.duration_hours);

    const { data, error } = await supabase
      .from('contests')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('adminCreateContest error:', error);
      return { success: false, message: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('adminCreateContest exception:', err);
    return { success: false, message: err?.message || 'Unknown error' };
  }
}

export async function adminEndContest(
  contestId: string
): Promise<{ success: boolean; message?: string }> {
  return callEdge('distribute-contest', { contestId });
}

export async function adminCancelContest(contestId: string) {
  const { error } = await supabase
    .from('contests')
    .update({ is_active: false })
    .eq('id', contestId);
  return { success: !error, message: error?.message };
}

export async function adminDeleteContest(contestId: string) {
  try {
    /* Silently clean related tables */
    try { await supabase.from('contest_entries').delete().eq('contest_id', contestId); } catch (_) {}
    try { await supabase.from('contest_rewards').delete().eq('contest_id', contestId); } catch (_) {}

    const { error } = await supabase
      .from('contests')
      .delete()
      .eq('id', contestId);

    if (error) return { success: false, message: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Unknown error' };
  }
}

/* ════════════════════════════════════════
   ADMIN — BROADCAST
════════════════════════════════════════ */

export async function adminSendBroadcast(
  message: string,
  adminTelegramId: number
): Promise<{ success: boolean; sent?: number; message?: string }> {
  try {
    /* Log broadcast — ignore error if table doesn't exist */
    try {
      await supabase.from('broadcasts').insert({
        message,
        sent_by: adminTelegramId,
      });
    } catch (_) {}

    /* Fetch all non-banned user IDs */
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id')
      .eq('is_banned', false);

    if (usersErr || !users) {
      return { success: false, message: 'Failed to fetch users' };
    }

    /* Batch-insert notifications (100 at a time) */
    const notifs = users.map((u: { id: string }) => ({
      user_id: u.id,
      title:   '📢 Announcement',
      message,
      type:    'info',
      is_read: false,
    }));

    for (let i = 0; i < notifs.length; i += 100) {
      await supabase
        .from('notifications')
        .insert(notifs.slice(i, i + 100));
    }

    return { success: true, sent: notifs.length };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Unknown error' };
  }
}

/* ════════════════════════════════════════
   ADMIN — PROMOS
════════════════════════════════════════ */

export async function adminGetPromos() {
  const { data, error } = await supabase
    .from('promos')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('adminGetPromos error:', error); return []; }
  return data || [];
}

export async function adminCreatePromo(promo: {
  code: string;
  points: number;
  max_uses: number;
  expires_at?: string;
}) {
  const { data, error } = await supabase
    .from('promos')
    .insert({
      code:       promo.code.trim().toUpperCase(),
      points:     promo.points,
      max_uses:   promo.max_uses,
      uses:       0,
      is_active:  true,
      expires_at: promo.expires_at || null,
    })
    .select()
    .single();
  if (error) { console.error('adminCreatePromo error:', error); }
  return { success: !error, data, message: error?.message };
}

export async function adminTogglePromo(promoId: string, isActive: boolean) {
  const { error } = await supabase
    .from('promos')
    .update({ is_active: isActive })
    .eq('id', promoId);
  return { success: !error, message: error?.message };
}

export async function adminDeletePromo(promoId: string) {
  try {
    await supabase.from('promo_claims').delete().eq('promo_id', promoId);
    const { error } = await supabase.from('promos').delete().eq('id', promoId);
    return { success: !error, message: error?.message };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Unknown error' };
  }
}
