const encoder = new TextEncoder();

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
}

export type VerifiedTelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

/**
 * Verifies Telegram Mini App initData according to Telegram's HMAC scheme.
 * Never trust a Telegram user object or userId supplied by the browser by itself.
 */
export async function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 3600,
): Promise<VerifiedTelegramUser> {
  if (!initData || !botToken) throw new Error('Missing Telegram authentication data');

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash) throw new Error('Missing Telegram hash');
  params.delete('hash');

  const authDate = Number(params.get('auth_date') || 0);
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || authDate > now + 60 || now - authDate > maxAgeSeconds) {
    throw new Error('Expired Telegram authentication data');
  }

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // secret_key = HMAC_SHA256("WebAppData", bot_token)
  const secretKey = await hmacSha256(encoder.encode('WebAppData'), botToken);
  const calculatedHash = bytesToHex(await hmacSha256(secretKey, dataCheckString));

  // Constant-time-ish comparison to avoid an early-exit timing leak.
  if (calculatedHash.length !== receivedHash.length) throw new Error('Invalid Telegram signature');
  let mismatch = 0;
  for (let i = 0; i < calculatedHash.length; i++) {
    mismatch |= calculatedHash.charCodeAt(i) ^ receivedHash.charCodeAt(i);
  }
  if (mismatch !== 0) throw new Error('Invalid Telegram signature');

  const rawUser = params.get('user');
  if (!rawUser) throw new Error('Telegram user missing');

  const user = JSON.parse(rawUser) as VerifiedTelegramUser;
  if (!Number.isSafeInteger(user.id) || user.id <= 0 || !user.first_name) {
    throw new Error('Invalid Telegram user');
  }

  return user;
}
