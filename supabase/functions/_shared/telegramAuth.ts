import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export type VerifiedTelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
  is_premium?: boolean;
};

export async function verifyTelegramInitData(initData: string, botToken: string, maxAgeSeconds = 3600): Promise<VerifiedTelegramUser> {
  if (!initData || !botToken) throw new Error('Missing Telegram authentication data');

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash) throw new Error('Missing Telegram hash');
  params.delete('hash');
  params.delete('signature');

  const authDate = Number(params.get('auth_date') || 0);
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || authDate > now + 60 || now - authDate > maxAgeSeconds) {
    throw new Error('Expired Telegram authentication data');
  }

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = await hmacSha256(encoder.encode('WebAppData'), botToken);
  const calculatedHash = bytesToHex(await hmacSha256(secretKey, dataCheckString));
  if (!constantTimeEqual(calculatedHash, receivedHash.toLowerCase())) throw new Error('Invalid Telegram signature');

  const rawUser = params.get('user');
  if (!rawUser) throw new Error('Telegram user missing');
  const user = JSON.parse(rawUser) as VerifiedTelegramUser;
  if (!Number.isSafeInteger(user.id) || user.id <= 0 || !user.first_name) throw new Error('Invalid Telegram user');
  return user;
}

export async function requireTelegramUser(req: Request, supabase: SupabaseClient) {
  const initData = req.headers.get('x-telegram-init-data') || '';
  const telegramUser = await verifyTelegramInitData(initData, Deno.env.get('TELEGRAM_BOT_TOKEN') || '');

  const { data: appUser, error } = await supabase
    .from('users')
    .select('id, telegram_id, username, first_name, last_name, photo_url, is_banned')
    .eq('telegram_id', telegramUser.id)
    .single();

  if (error || !appUser) throw new Error('User not registered');
  if (appUser.is_banned) throw new Error('Account is banned');
  return { telegramUser, appUser };
}

export const secureCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-init-data',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
