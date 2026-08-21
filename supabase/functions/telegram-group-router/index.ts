import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const BASE_URL = Deno.env.get('SUPABASE_URL') || '';
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const sb = createClient(BASE_URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const PVP_CMDS = new Set(['/pvp','/games','/credits','/convert','/challenge','/pvpstats','/pvpboard','/matches','/pvpsettings']);

const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });
function same(a: string, b: string) { if (!a || a.length !== b.length) return false; let m = 0; for (let i = 0; i < a.length; i++) m |= a.charCodeAt(i) ^ b.charCodeAt(i); return m === 0; }
async function secret() { const { data, error } = await sb.rpc('get_bot_internal_secret', { p_name: 'adsreward_telegram_webhook_secret' }); if (error || !data) throw error || new Error('Missing webhook secret'); return String(data); }
async function tg(method: string, payload: any) { const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const b = await r.json().catch(() => ({ ok: false })); if (!r.ok || !b.ok) throw new Error(b.description || method); return b.result; }
async function call(name: string, body: any, wh: string) {
  const r = await fetch(`${BASE_URL}/functions/v1/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-telegram-bot-api-secret-token': wh }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) console.error(`${name} route failed`, r.status, j);
  return j;
}
async function isPvpCandidate(body: any) {
  const cb = body?.callback_query;
  if (String(cb?.data || '').startsWith('pvp')) return true;
  const msg = body?.message;
  if (!msg?.from || msg.from.is_bot) return false;
  const cmd = msg.text?.startsWith('/') ? String(msg.text).trim().split(/\s+/)[0].split('@')[0].toLowerCase() : '';
  if (PVP_CMDS.has(cmd)) return true;
  if (msg.dice && ['group','supergroup'].includes(String(msg.chat?.type))) return true;
  if (/^\d+$/.test(String(msg.text || '').trim()) && ['group','supergroup'].includes(String(msg.chat?.type))) {
    const { data: user } = await sb.from('users').select('id').eq('telegram_id', Number(msg.from.id)).maybeSingle();
    if (!user?.id) return false;
    const { data: flow } = await sb.from('pvp_pending_flows').select('expires_at').eq('group_id', Number(msg.chat.id)).eq('user_id', user.id).maybeSingle();
    return !!flow?.expires_at && new Date(flow.expires_at).getTime() > Date.now();
  }
  return false;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'GET') {
      if (new URL(req.url).searchParams.get('sync') === '1') {
        const wh = await secret();
        await tg('setWebhook', { url: `${BASE_URL}/functions/v1/telegram-group-router`, secret_token: wh, allowed_updates: ['message','callback_query','channel_post','my_chat_member'], drop_pending_updates: false });
        return json({ success: true, synced: true });
      }
      return json({ success: true, service: 'telegram-group-router', version: 'group-router-pvp-v1' });
    }
    if (req.method !== 'POST') return json({ success: false }, 405);
    const wh = await secret();
    const got = req.headers.get('x-telegram-bot-api-secret-token') || '';
    if (!same(wh, got)) return json({ success: false, error: 'unauthorized' }, 401);
    const body = await req.json().catch(() => ({}));

    try {
      const hj = await call('telegram-command-help', body, wh);
      if (hj?.handled) return json({ success: true, handledBy: 'telegram-command-help' });
    } catch (e) { console.error('command help route failed', e); }

    // Giveaway/tip gets first claim on its own callbacks and active giveaway dice.
    try {
      const gj = await call('telegram-group-rewards', body, wh);
      if (gj?.handled) return json({ success: true, handledBy: 'telegram-group-rewards' });
    } catch (e) { console.error('group rewards route failed', e); }

    // Route only genuine PvP candidates. This prevents telegram-pvp's fallback
    // from bypassing the normal admin/legacy router for unrelated updates.
    try {
      if (await isPvpCandidate(body)) {
        const pj = await call('telegram-pvp', body, wh);
        if (pj?.pvp || pj?.forwarded || pj?.success) return json({ success: true, handledBy: pj?.pvp ? 'telegram-pvp' : 'telegram-pvp-forward' });
      }
    } catch (e) { console.error('pvp route failed', e); }

    const r = await fetch(`${BASE_URL}/functions/v1/telegram-router`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-telegram-bot-api-secret-token': wh }, body: JSON.stringify(body) });
    const t = await r.text();
    if (!r.ok) console.error('legacy router failed', r.status, t);
    return json({ success: true, forwarded: r.ok });
  } catch (e) {
    console.error('telegram-group-router', e);
    return json({ success: false, error: (e as Error).message }, 500);
  }
});
