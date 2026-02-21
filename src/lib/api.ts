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

// Admin functions
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
    .select('*, users(first_name, username, telegram_id)')
    .order('created_at', { ascending: false });
  return data || [];
}

export async function adminUpdateWithdrawal(withdrawalId: string, status: string, adminNote?: string) {
  const { error } = await supabase
    .from('withdrawals')
    .update({ status, admin_note: adminNote, processed_at: new Date().toISOString() })
    .eq('id', withdrawalId);
  return { success: !error };
}

export async function adminUpdateSetting(key: string, value: string) {
  const { error } = await supabase
    .from('settings')
    .update({ value, updated_at: new Date().toISOString() })
    .eq('key', key);
  return { success: !error };
}

export async function adminBanUser(userId: string, banned: boolean) {
  const { error } = await supabase
    .from('users')
    .update({ is_banned: banned })
    .eq('id', userId);
  return { success: !error };
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
  // Delete user_tasks referencing this task first
  await supabase.from('user_tasks').delete().eq('task_id', taskId);
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  return { success: !error };
}

export async function adminGetStats() {
  const [usersRes, withdrawalsRes, transactionsRes] = await Promise.all([
    supabase.from('users').select('id, total_points, created_at', { count: 'exact' }),
    supabase.from('withdrawals').select('id, points_spent, status', { count: 'exact' }),
    supabase.from('transactions').select('id, points', { count: 'exact' }),
  ]);
  return {
    totalUsers: usersRes.count || 0,
    totalWithdrawals: withdrawalsRes.count || 0,
    pendingWithdrawals: (withdrawalsRes.data || []).filter((w: { status: string }) => w.status === 'pending').length,
    totalTransactions: transactionsRes.count || 0,
  };
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
