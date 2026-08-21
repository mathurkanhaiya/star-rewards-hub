import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireTelegramUser, secureCorsHeaders as corsHeaders } from "../_shared/telegramAuth.ts";

async function verifyTelegramMembership(botToken: string, chatId: string, telegramId: number): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${telegramId}`);
    const data = await res.json();
    return Boolean(data.ok && ['member', 'administrator', 'creator'].includes(data.result?.status));
  } catch { return false; }
}

function extractChatId(link: string): string | null {
  const match = link?.match(/t\.me\/([a-zA-Z0-9_]+)/);
  return match ? `@${match[1]}` : null;
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { appUser } = await requireTelegramUser(req, supabase);
    const body = await req.json().catch(() => ({}));
    const taskId = String(body.taskId || '');
    if (!/^[0-9a-f-]{36}$/i.test(taskId)) throw new Error('Invalid taskId');

    const { data: task, error } = await supabase.from('tasks')
      .select('id,task_type,link,is_active,expires_at').eq('id', taskId).single();
    if (error || !task || !task.is_active || (task.expires_at && new Date(task.expires_at) <= new Date())) {
      return json({ success: false, message: 'Task not found or inactive' });
    }

    if (task.task_type === 'social' && task.link?.includes('t.me/')) {
      const chatId = extractChatId(task.link);
      const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
      if (!chatId || !botToken || !(await verifyTelegramMembership(botToken, chatId, appUser.telegram_id))) {
        return json({ success: false, message: 'Please join the channel/group first, then try again!' });
      }
    }

    const { data, error: claimError } = await supabase.rpc('claim_task_reward', {
      p_user_id: appUser.id, p_task_id: taskId,
    });
    if (claimError) throw claimError;
    return json(data || { success: false, message: 'Task reward failed' });
  } catch (error) {
    const message = (error as Error).message;
    const status = /Telegram|registered|banned|expired|signature/i.test(message) ? 401 : 400;
    return json({ success: false, message }, status);
  }
});
