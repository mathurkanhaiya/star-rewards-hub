import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const BASE = Deno.env.get('SUPABASE_URL') || '';
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || Deno.env.get('BOT_TOKEN') || '';
const sb = createClient(BASE, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

function same(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

async function secret() {
  const { data } = await sb.rpc('get_bot_internal_secret', { p_name: 'adsreward_telegram_webhook_secret' });
  return String(data || '');
}

async function telegram(method: string, payload: Record<string, unknown>) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await r.json().catch(() => ({ ok: false }));
  if (!r.ok || !body.ok) throw new Error(body.description || method);
  return body.result;
}

function rating(ms: number) {
  if (ms < 150) return 'Excellent';
  if (ms < 300) return 'Good';
  if (ms < 600) return 'Fair';
  return 'Slow';
}

Deno.serve(async (req: Request) => {
  const started = performance.now();
  try {
    if (req.method === 'GET') return json({ success: true, service: 'telegram-ping', version: 'v1' });
    if (req.method !== 'POST') return json({ handled: false }, 405);
    if (!same(await secret(), req.headers.get('x-telegram-bot-api-secret-token') || '')) return json({ handled: false }, 401);

    const update = await req.json().catch(() => ({}));
    const m = update?.message;
    if (!m?.from || m.from.is_bot || !m.text) return json({ handled: false });

    const cmd = String(m.text).trim().split(/\s+/)[0].split('@')[0].toLowerCase();
    if (cmd !== '/ping') return json({ handled: false });

    const dbStart = performance.now();
    const { error: dbError } = await sb.from('users').select('id', { head: true, count: 'exact' }).limit(1);
    const dbMs = Math.round(performance.now() - dbStart);

    const tgStart = performance.now();
    await telegram('getMe', {});
    const tgMs = Math.round(performance.now() - tgStart);

    const totalMs = Math.round(performance.now() - started);
    const status = dbError ? '⚠️' : '🟢';
    const text = `🏓 <b>Pong!</b>\n\n${status} Bot: <b>${totalMs} ms</b> · ${rating(totalMs)}\n📡 Telegram API: <b>${tgMs} ms</b>\n🗄 Database: <b>${dbError ? 'Unavailable' : `${dbMs} ms`}</b>`;

    await telegram('sendMessage', {
      chat_id: m.chat.id,
      reply_to_message_id: m.message_id,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });

    return json({ handled: true, total_ms: totalMs, telegram_ms: tgMs, database_ms: dbError ? null : dbMs });
  } catch (e) {
    console.error('telegram-ping', e);
    return json({ handled: false, error: (e as Error).message }, 500);
  }
});
