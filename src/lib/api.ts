import { supabase } from '@/integrations/supabase/client';
import { AppUser, UserBalance, Task, Withdrawal, LeaderboardEntry } from '@/types/telegram';

const EDGE_FN = `https://utfkqzmrcdfbnjdkjais.supabase.co/functions/v1`;

export async function initUser(telegramUser: {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}, referralCode?: string): Promise<AppUser | null> {
  try {
    const response = await fetch(`${EDGE_FN}/telegram-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ telegramUser, referralCode }),
    });
    const data = await response.json();
    return data.user || null;
  } catch (err) {
    console.error('initUser error:', err);
    return null;
  }
}

export async function getUser(telegramId: number): Promise<AppUser | null> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();
  return data as AppUser | null;
}

export async function getUserBalance(userId: string): Promise<UserBalance | null> {
  const { data } = await supabase
    .from('balances')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data as UserBalance | null;
}

export async function getTasks(): Promise<Task[]> {
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('is_active', true)
    .order('display_order');
  return (data as Task[]) || [];
}

export async function getUserTasks(userId: string) {
  const { data } = await supabase
    .from('user_tasks')
    .select('task_id, completed_at, next_available_at')
    .eq('user_id', userId);
  return data || [];
}

export async function completeTask(userId: string, taskId: string): Promise<{ success: boolean; points?: number; message?: string }> {
  try {
    const response = await fetch(`${EDGE_FN}/complete-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ userId, taskId }),
    });
    return await response.json();
  } catch {
    return { success: false, message: 'Error completing task' };
  }
}

export async function claimDailyReward(userId: string): Promise<{ success: boolean; points?: number; streak?: number; message?: string }> {
  try {
    const response = await fetch(`${EDGE_FN}/daily-reward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ userId }),
    });
    return await response.json();
  } catch {
    return { success: false, message: 'Error claiming daily reward' };
  }
}

export async function spinWheel(userId: string): Promise<{ success: boolean; result?: string; points?: number; stars?: number; message?: string }> {
  try {
    const response = await fetch(`${EDGE_FN}/spin-wheel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ userId }),
    });
    return await response.json();
  } catch {
    return { success: false, message: 'Error spinning wheel' };
  }
}

export async function submitWithdrawal(
  userId: string,
  method: string,
  points: number,
  walletAddress?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch(`${EDGE_FN}/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ userId, method, points, walletAddress }),
    });
    return await response.json();
  } catch {
    return { success: false, message: 'Error submitting withdrawal' };
  }
}

export async function getWithdrawals(userId: string): Promise<Withdrawal[]> {
  const { data } = await supabase
    .from('withdrawals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data as Withdrawal[]) || [];
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data } = await supabase
    .from('leaderboard')
    .select('*')
    .limit(50);
  return (data as LeaderboardEntry[]) || [];
}

export async function getReferrals(userId: string) {
  const { data } = await supabase
    .from('referrals')
    .select('*')
    .eq('referrer_id', userId)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function getTransactions(userId: string) {
  const { data } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  return data || [];
}

export async function logAdWatch(userId: string, adType: string, rewardGiven: number) {
  try {
    const response = await fetch(`${EDGE_FN}/log-ad`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ userId, adType, rewardGiven }),
    });
    return await response.json();
  } catch {
    return { success: false };
  }
}

export async function getSettings(): Promise<Record<string, string>> {
  const { data } = await supabase.from('settings').select('key, value');
  const settings: Record<string, string> = {};
  (data || []).forEach((s: { key: string; value: string }) => {
    settings[s.key] = s.value;
  });
  return settings;
}

export async function getDailyClaim(userId: string) {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('daily_claims')
    .select('claimed_at')
    .eq('user_id', userId)
    .eq('claim_date', today)
    .maybeSingle();
  return data;
}

export async function getSpinCount(userId: string) {
  const { data } = await supabase
    .from('spin_results')
    .select('spun_at')
    .eq('user_id', userId)
    .order('spun_at', { ascending: false })
    .limit(10);
  return data || [];
}

export async function getNotifications(userId: string) {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  return data || [];
}

export async function markNotificationRead(notifId: string) {
  await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
}

export async function getUnreadNotifCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)
    .eq('is_read', false);
  return count || 0;
}

// ==================== Admin Functions ====================

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

export async function adminGetUsers(page = 0) {
  const { data } = await supabase
    .from('users')
    .select('*, balances(*)')
    .order('created_at', { ascending: false })
    .range(page * 20, page * 20 + 19);
  return data || [];
}

export async function adminGetWithdrawals() {
  const { data } = await supabase
    .from('withdrawals')
    .select('*, users(first_name, username, telegram_id, photo_url)')
    .order('created_at', { ascending: false });
  return data || [];
}

export async function adminUpdateWithdrawal(withdrawalId: string, status: string, adminNote?: string) {
  // Get withdrawal details first
  const { data: withdrawal } = await supabase
    .from('withdrawals')
    .select('user_id, points_spent, amount, method')
    .eq('id', withdrawalId)
    .single();

  if (!withdrawal) return { success: false };

  const { error } = await supabase
    .from('withdrawals')
    .update({ status, admin_note: adminNote, processed_at: new Date().toISOString() })
    .eq('id', withdrawalId);
  
  if (error) return { success: false };

  // If rejected, refund the points
  if (status === 'rejected') {
    const { data: balance } = await supabase
      .from('balances')
      .select('points, total_withdrawn')
      .eq('user_id', withdrawal.user_id)
      .single();
    
    if (balance) {
      await supabase.from('balances').update({
        points: balance.points + withdrawal.points_spent,
        total_withdrawn: Math.max(0, (balance.total_withdrawn || 0) - withdrawal.points_spent),
      }).eq('user_id', withdrawal.user_id);

      await supabase.from('transactions').insert({
        user_id: withdrawal.user_id,
        type: 'refund',
        points: withdrawal.points_spent,
        description: `🔄 Withdrawal rejected — ${withdrawal.points_spent.toLocaleString()} pts refunded`,
      });
    }
  }

  // Send notification to user
  const notifTitle = status === 'approved' ? '✅ Withdrawal Approved!' : '❌ Withdrawal Rejected';
  const notifMsg = status === 'approved'
    ? `Your withdrawal of ${Number(withdrawal.amount).toFixed(2)} ${withdrawal.method.toUpperCase()} has been approved and is being processed.`
    : `Your withdrawal of ${Number(withdrawal.amount).toFixed(2)} ${withdrawal.method.toUpperCase()} was rejected. ${withdrawal.points_spent.toLocaleString()} points have been refunded.${adminNote ? ` Reason: ${adminNote}` : ''}`;

  await supabase.from('notifications').insert({
    user_id: withdrawal.user_id,
    title: notifTitle,
    message: notifMsg,
    type: 'withdrawal',
  });

  return { success: true };
}

export async function adminUpdateSetting(key: string, value: string) {
  // Check if setting exists
  const { data: existing } = await supabase
    .from('settings')
    .select('id')
    .eq('key', key)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key);
    console.log(`Setting "${key}" updated to "${value}"`, error ? `ERROR: ${error.message}` : '✓');
    return { success: !error };
  } else {
    const { error } = await supabase
      .from('settings')
      .insert({ key, value, updated_at: new Date().toISOString() });
    console.log(`Setting "${key}" inserted as "${value}"`, error ? `ERROR: ${error.message}` : '✓');
    return { success: !error };
  }
}

export async function adminBanUser(userId: string, banned: boolean) {
  const { error } = await supabase
    .from('users')
    .update({ is_banned: banned })
    .eq('id', userId);
  return { success: !error };
}

export async function adminAdjustBalance(userId: string, points: number, reason: string) {
  const { data: balance } = await supabase.from('balances').select('points').eq('user_id', userId).single();
  if (!balance) return { success: false };
  
  const newPoints = Math.max(0, balance.points + points);
  const { error } = await supabase.from('balances').update({ points: newPoints }).eq('user_id', userId);
  if (error) return { success: false };
  
  await supabase.from('transactions').insert({
    user_id: userId,
    type: points >= 0 ? 'admin_credit' : 'admin_debit',
    points,
    description: `🛡️ Admin: ${reason}`,
  });
  return { success: true };
}

export async function adminCreateTask(task: Omit<Task, 'id'>) {
  const { data, error } = await supabase
    .from('tasks')
    .insert([task])
    .select()
    .single();
  return { success: !error, data };
}

export async function adminToggleTask(taskId: string, isActive: boolean) {
  const { error } = await supabase
    .from('tasks')
    .update({ is_active: isActive })
    .eq('id', taskId);
  return { success: !error };
}

export async function adminDeleteTask(taskId: string) {
  await supabase.from('user_tasks').delete().eq('task_id', taskId);
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  return { success: !error };
}

// Contest functions
export async function adminGetContests() {
  const { data } = await supabase
    .from('contests')
    .select('*')
    .order('created_at', { ascending: false });
  return data || [];
}

export async function adminCreateContest(contest: {
  title: string;
  contest_type: string;
  ends_at: string;
  reward_1st: number;
  reward_2nd: number;
  reward_3rd: number;
  reward_4th: number;
  reward_5th: number;
}) {
  const { data, error } = await supabase
    .from('contests')
    .insert([contest])
    .select()
    .single();
  return { success: !error, data };
}

export async function adminEndContest(contestId: string) {
  try {
    const response = await fetch(`${EDGE_FN}/distribute-contest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ contestId }),
    });
    return await response.json();
  } catch {
    return { success: false, message: 'Error distributing rewards' };
  }
}

export async function getContestLeaderboard(contestId: string) {
  const { data } = await supabase
    .from('contest_entries')
    .select('user_id, score, updated_at')
    .eq('contest_id', contestId)
    .order('score', { ascending: false })
    .limit(20);
  
  if (!data || data.length === 0) return [];
  
  // Fetch user info separately since no FK relation
  const userIds = data.map(d => d.user_id);
  const { data: usersData } = await supabase
    .from('users')
    .select('id, first_name, username, photo_url, telegram_id')
    .in('id', userIds);
  
  const userMap: Record<string, { first_name: string; username: string; photo_url: string | null; telegram_id: number }> = {};
  (usersData || []).forEach((u: { id: string; first_name: string | null; username: string | null; photo_url: string | null; telegram_id: number }) => {
    userMap[u.id] = { first_name: u.first_name || '', username: u.username || '', photo_url: u.photo_url, telegram_id: u.telegram_id };
  });
  
  return data.map(d => ({
    user_id: d.user_id,
    score: d.score,
    users: userMap[d.user_id] || null,
  }));
}

export async function getActiveContests() {
  const { data } = await supabase
    .from('contests')
    .select('*')
    .eq('is_active', true)
    .gte('ends_at', new Date().toISOString())
    .order('ends_at');
  return data || [];
}

// Broadcast
export async function adminSendBroadcast(message: string, adminTelegramId: number) {
  const { error } = await supabase.from('broadcasts').insert({
    message,
    sent_by: adminTelegramId,
  });
  if (error) return { success: false };
  
  // Create notifications for all users
  const { data: users } = await supabase.from('users').select('id');
  if (users && users.length > 0) {
    const notifs = users.map((u: { id: string }) => ({
      user_id: u.id,
      title: '📢 Announcement',
      message,
      type: 'info',
    }));
    // Insert in batches of 100
    for (let i = 0; i < notifs.length; i += 100) {
      await supabase.from('notifications').insert(notifs.slice(i, i + 100));
    }
  }
  return { success: true };
}

// Ad stats for leaderboard
export async function getAdWatchLeaderboard(contestId?: string) {
  if (contestId) {
    return getContestLeaderboard(contestId);
  }
  // Fallback: top ad watchers all time
  const { data } = await supabase
    .from('ad_logs')
    .select('user_id, users:user_id(first_name, username, photo_url)')
    .order('created_at', { ascending: false })
    .limit(500);
  
  if (!data) return [];
  
  // Aggregate by user
  const counts: Record<string, { user_id: string; count: number; user: unknown }> = {};
  for (const log of data as Array<{ user_id: string; users: unknown }>) {
    if (!counts[log.user_id]) {
      counts[log.user_id] = { user_id: log.user_id, count: 0, user: log.users };
    }
    counts[log.user_id].count++;
  }
  
  return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export async function getReferralLeaderboard() {
  const { data } = await supabase
    .from('referrals')
    .select('referrer_id, users:referrer_id(first_name, username, photo_url)')
    .eq('is_verified', true)
    .limit(500);
  
  if (!data) return [];
  
  const counts: Record<string, { user_id: string; count: number; user: unknown }> = {};
  for (const ref of data as Array<{ referrer_id: string; users: unknown }>) {
    if (!counts[ref.referrer_id]) {
      counts[ref.referrer_id] = { user_id: ref.referrer_id, count: 0, user: ref.users };
    }
    counts[ref.referrer_id].count++;
  }
  
  return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}
