import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireTelegramUser, secureCorsHeaders as corsHeaders } from "../_shared/telegramAuth.ts";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function requireAdmin(telegramId: number) {
  const configured = Number(Deno.env.get('ADMIN_TELEGRAM_ID') || '2139807311');
  if (telegramId !== configured) throw new Error('Admin access required');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { telegramUser, appUser } = await requireTelegramUser(req, supabase);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const userId = appUser.id;

    switch (action) {
      case 'get-user': {
        const { data } = await supabase.from('users').select('*').eq('id', userId).single();
        return json({ data });
      }
      case 'get-balance': {
        const { data } = await supabase.from('balances').select('*').eq('user_id', userId).single();
        return json({ data });
      }
      case 'get-user-tasks': {
        const { data } = await supabase.from('user_tasks').select('task_id,completed_at,next_available_at').eq('user_id', userId);
        return json({ data: data || [] });
      }
      case 'get-withdrawals': {
        const { data } = await supabase.from('withdrawals').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100);
        return json({ data: data || [] });
      }
      case 'get-referrals': {
        const { data } = await supabase.from('referrals').select('*').eq('referrer_id', userId).order('created_at', { ascending: false }).limit(500);
        return json({ data: data || [] });
      }
      case 'get-transactions': {
        const { data } = await supabase.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
        return json({ data: data || [] });
      }
      case 'get-daily-claim': {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase.from('daily_claims').select('claimed_at').eq('user_id', userId).eq('claim_date', today).maybeSingle();
        return json({ data });
      }
      case 'get-spin-count': {
        const { data } = await supabase.from('spin_results').select('spun_at').eq('user_id', userId).order('spun_at', { ascending: false }).limit(10);
        return json({ data: data || [] });
      }
      case 'get-notifications': {
        const { data } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30);
        return json({ data: data || [] });
      }
      case 'mark-notification-read': {
        const notificationId = String(body.notificationId || '');
        await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId).eq('user_id', userId);
        return json({ success: true });
      }
      case 'unread-count': {
        const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false);
        return json({ count: count || 0 });
      }
      case 'leaderboard': {
        const { data } = await supabase.from('leaderboard').select('*').limit(50);
        return json({ data: data || [] });
      }
      case 'contest-leaderboard': {
        const contestId = String(body.contestId || '');
        const { data: entries } = await supabase.from('contest_entries').select('user_id,score,updated_at').eq('contest_id', contestId).order('score', { ascending: false }).limit(20);
        const ids = (entries || []).map((e) => e.user_id);
        const { data: users } = ids.length ? await supabase.from('users').select('id,first_name,username,photo_url,telegram_id').in('id', ids) : { data: [] };
        const map = Object.fromEntries((users || []).map((u) => [u.id, u]));
        return json({ data: (entries || []).map((e) => ({ ...e, users: map[e.user_id] || null })) });
      }
      case 'ad-watch-leaderboard': {
        if (body.contestId) {
          const { data } = await supabase.from('contest_entries').select('user_id,score').eq('contest_id', body.contestId).order('score', { ascending: false }).limit(10);
          return json({ data: data || [] });
        }
        const { data } = await supabase.from('ad_logs').select('user_id').order('created_at', { ascending: false }).limit(1000);
        const counts: Record<string, number> = {};
        for (const row of data || []) counts[row.user_id] = (counts[row.user_id] || 0) + 1;
        const top = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,10);
        const ids = top.map(([id]) => id);
        const { data: users } = ids.length ? await supabase.from('users').select('id,first_name,username,photo_url').in('id', ids) : { data: [] };
        const map = Object.fromEntries((users || []).map((u) => [u.id, u]));
        return json({ data: top.map(([id,count]) => ({ user_id:id, count, user: map[id] || null })) });
      }
      case 'referral-leaderboard': {
        const { data } = await supabase.from('referrals').select('referrer_id').eq('is_verified', true).limit(2000);
        const counts: Record<string, number> = {};
        for (const row of data || []) counts[row.referrer_id] = (counts[row.referrer_id] || 0) + 1;
        const top = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,10);
        const ids = top.map(([id]) => id);
        const { data: users } = ids.length ? await supabase.from('users').select('id,first_name,username,photo_url').in('id', ids) : { data: [] };
        const map = Object.fromEntries((users || []).map((u) => [u.id, u]));
        return json({ data: top.map(([id,count]) => ({ user_id:id, count, user: map[id] || null })) });
      }
    }

    if (!action.startsWith('admin:')) return json({ error: 'Unknown action' }, 400);
    requireAdmin(telegramUser.id);

    switch (action) {
      case 'admin:stats': {
        const [u,w,t,a] = await Promise.all([
          supabase.from('users').select('id', { count:'exact', head:true }),
          supabase.from('withdrawals').select('id,status'),
          supabase.from('transactions').select('id', { count:'exact', head:true }),
          supabase.from('ad_logs').select('id', { count:'exact', head:true }),
        ]);
        return json({ data: { totalUsers:u.count||0, totalWithdrawals:(w.data||[]).length, pendingWithdrawals:(w.data||[]).filter((x) => x.status==='pending').length, totalTransactions:t.count||0, totalAdViews:a.count||0 } });
      }
      case 'admin:users': {
        const { data } = await supabase.from('users').select('*,balances(*)').order('created_at', { ascending:false }).limit(10000);
        return json({ data: data || [] });
      }
      case 'admin:withdrawals': {
        const { data } = await supabase.from('withdrawals').select('*,users(first_name,username,telegram_id,photo_url)').order('created_at', { ascending:false }).limit(5000);
        return json({ data: data || [] });
      }
      case 'admin:update-setting': {
        const key = String(body.key || '').slice(0,100); const value = String(body.value ?? '').slice(0,500);
        if (!key) throw new Error('Invalid setting key');
        const { error } = await supabase.from('settings').upsert({ key, value, updated_at:new Date().toISOString() }, { onConflict:'key' });
        return json({ success: !error, message: error?.message });
      }
      case 'admin:ban-user': {
        const targetUserId = String(body.userId || '');
        const { error } = await supabase.from('users').update({ is_banned:Boolean(body.banned) }).eq('id', targetUserId);
        return json({ success: !error });
      }
      case 'admin:adjust-balance': {
        const targetUserId = String(body.userId || ''); const delta = Number(body.points || 0);
        if (!Number.isInteger(delta) || Math.abs(delta) > 100000000) throw new Error('Invalid adjustment');
        const { data: bal } = await supabase.from('balances').select('points,total_earned').eq('user_id', targetUserId).single();
        if (!bal) throw new Error('Balance not found');
        const next = Math.max(0, Number(bal.points) + delta);
        await supabase.from('balances').update({ points:next, total_earned: delta > 0 ? Number(bal.total_earned||0)+delta : bal.total_earned }).eq('user_id', targetUserId);
        await supabase.from('transactions').insert({ user_id:targetUserId, type:delta>=0?'admin_credit':'admin_debit', points:delta, description:`🛡️ Admin: ${String(body.reason || 'Adjustment').slice(0,200)}` });
        return json({ success:true });
      }
      case 'admin:create-task': {
        const { data, error } = await supabase.from('tasks').insert([body.task]).select().single();
        return json({ success:!error, data, message:error?.message });
      }
      case 'admin:toggle-task': {
        const { error } = await supabase.from('tasks').update({ is_active:Boolean(body.isActive) }).eq('id', String(body.taskId||''));
        return json({ success:!error });
      }
      case 'admin:delete-task': {
        const id = String(body.taskId||'');
        await supabase.from('user_tasks').delete().eq('task_id', id);
        const { error } = await supabase.from('tasks').delete().eq('id', id);
        return json({ success:!error });
      }
      case 'admin:contests': {
        const { data } = await supabase.from('contests').select('*').order('created_at', { ascending:false });
        return json({ data:data||[] });
      }
      case 'admin:create-contest': {
        const { data, error } = await supabase.from('contests').insert([body.contest]).select().single();
        return json({ success:!error, data, message:error?.message });
      }
      case 'admin:broadcast': {
        const message = String(body.message || '').trim().slice(0,4000);
        if (!message) throw new Error('Message required');
        await supabase.from('broadcasts').insert({ message, sent_by:telegramUser.id });
        const { data: users } = await supabase.from('users').select('id').eq('is_banned', false);
        for (let i=0;i<(users||[]).length;i+=100) {
          const rows=(users||[]).slice(i,i+100).map((u)=>({ user_id:u.id,title:'📢 Announcement',message,type:'info' }));
          if (rows.length) await supabase.from('notifications').insert(rows);
        }
        return json({ success:true });
      }
      default: return json({ error:'Unknown admin action' },400);
    }
  } catch (error) {
    const message = (error as Error).message;
    const status = /Admin access/i.test(message) ? 403 : /Telegram|registered|banned|expired|signature/i.test(message) ? 401 : 400;
    return json({ success:false, error:message, message }, status);
  }
});
