import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireTelegramUser, secureCorsHeaders as corsHeaders } from "../_shared/telegramAuth.ts";

async function verifyTelegramMembership(botToken: string, chatId: string, telegramId: number): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${chatId}&user_id=${telegramId}`);
    const data = await res.json();
    return Boolean(data.ok && ['member', 'administrator', 'creator'].includes(data.result?.status));
  } catch { return false; }
}

function extractChatId(link: string): string | null {
  const match = link?.match(/t\.me\/([a-zA-Z0-9_]+)/);
  return match ? `@${match[1]}` : null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { appUser } = await requireTelegramUser(req, supabase);
    const { taskId } = await req.json();
    if (!taskId || typeof taskId !== 'string') throw new Error('Missing taskId');
    const userId = appUser.id;

    const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).eq('is_active', true).single();
    if (!task) return new Response(JSON.stringify({ success: false, message: 'Task not found or inactive' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (!task.is_repeatable) {
      const { data: existing } = await supabase.from('user_tasks').select('id').eq('user_id', userId).eq('task_id', taskId).maybeSingle();
      if (existing) return new Response(JSON.stringify({ success: false, message: 'Task already completed!' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } else {
      const { data: last } = await supabase.from('user_tasks').select('next_available_at').eq('user_id', userId).eq('task_id', taskId).order('completed_at', { ascending: false }).limit(1).maybeSingle();
      if (last?.next_available_at && new Date(last.next_available_at) > new Date()) {
        return new Response(JSON.stringify({ success: false, message: 'Task cooldown not finished yet' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    if (task.task_type === 'social' && task.link?.includes('t.me/')) {
      const chatId = extractChatId(task.link);
      const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
      if (chatId && botToken && !(await verifyTelegramMembership(botToken, chatId, appUser.telegram_id))) {
        return new Response(JSON.stringify({ success: false, message: 'Please join the channel/group first, then try again!' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const points = Number(task.reward_points) || 0;
    if (points <= 0 || points > 1000000) throw new Error('Invalid task reward');
    const nextAvailable = task.is_repeatable ? new Date(Date.now() + (task.repeat_hours || 24) * 3600000).toISOString() : null;

    const { error: completionError } = await supabase.from('user_tasks').insert({ user_id: userId, task_id: taskId, points_earned: points, next_available_at: nextAvailable });
    if (completionError) throw completionError;

    await supabase.rpc('increment_points', { p_user_id: userId, p_points: points });
    await supabase.from('transactions').insert({ user_id: userId, type: 'earn', points, description: `✅ Task: ${task.title}`, reference_id: taskId });

    const { data: currentUser } = await supabase.from('users').select('total_points').eq('id', userId).single();
    if (currentUser) await supabase.from('users').update({ level: Math.floor(Number(currentUser.total_points || 0) / 10000) + 1 }).eq('id', userId);

    // Qualification is idempotent and only succeeds after this user has both
    // a completed task and a verified rewarded-ad log.
    const { error: qualificationError } = await supabase.rpc('qualify_referral', { p_referred_id: userId });
    if (qualificationError) console.error('Referral qualification failed:', qualificationError.message);

    return new Response(JSON.stringify({ success: true, points }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    const message = (error as Error).message;
    const status = /Telegram|registered|banned|expired|signature/i.test(message) ? 401 : 400;
    return new Response(JSON.stringify({ success: false, message }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
