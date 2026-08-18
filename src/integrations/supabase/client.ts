import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Backend V2 migration: force the app to the new project so stale Vercel env vars
// cannot silently route requests to the retired backend.
const SUPABASE_URL = 'https://eoppaqrqlpyqoizohoba.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_DJ7o0hTt3DPL8O_3HbAWuw_NkdvY0na';
const EDGE_FN = `${SUPABASE_URL}/functions/v1`;

const nativeFetch = globalThis.fetch.bind(globalThis);

function getTelegramInitData() {
  if (typeof window === 'undefined') return '';
  return (window as any).Telegram?.WebApp?.initData || '';
}

function bridgeHeaders() {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_PUBLISHABLE_KEY,
    'x-telegram-init-data': getTelegramInitData(),
  };
}

async function bridge(action: string, payload: Record<string, unknown> = {}) {
  return nativeFetch(`${EDGE_FN}/legacy-bridge`, {
    method: 'POST',
    headers: bridgeHeaders(),
    body: JSON.stringify({ action, ...payload }),
  });
}

function fakeJson(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

function eqValue(url: URL, key: string) {
  const value = url.searchParams.get(key) || '';
  return value.startsWith('eq.') ? value.slice(3) : value;
}

function gteValue(url: URL, key: string) {
  const value = url.searchParams.get(key) || '';
  return value.startsWith('gte.') ? value.slice(4) : '';
}

const LEGACY_REWARD_TYPES = new Set([
  'tap_earn',
  'farm_claim',
  'daily_drop',
  'dice_roll',
  'lucky_box',
  'card_flip',
  'number_guess',
]);

/**
 * Compatibility layer for screens that still use the old direct Supabase economy calls.
 * Sensitive writes never reach PostgREST. They are authenticated with Telegram initData
 * and executed by the service-role Edge Function instead.
 */
async function backendV2Fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = input instanceof Request ? input : new Request(input, init);
  const url = new URL(request.url);

  if (url.origin !== new URL(SUPABASE_URL).origin || !url.pathname.startsWith('/rest/v1/')) {
    return nativeFetch(input as any, init);
  }

  const table = url.pathname.split('/').filter(Boolean).pop() || '';
  const method = request.method.toUpperCase();

  // Legacy pages used to PATCH balances before inserting a transaction. Never allow that
  // browser write. The matching transaction below is converted into a secure reward call.
  if (table === 'balances' && method === 'PATCH') {
    return fakeJson(null, 204);
  }

  // Old game pages count their daily plays directly from transactions.
  if (table === 'transactions' && (method === 'GET' || method === 'HEAD')) {
    const type = eqValue(url, 'type');
    if (type) {
      const result = await bridge('count-transactions', {
        type,
        since: gteValue(url, 'created_at'),
      });
      const body = await result.json().catch(() => ({ count: 0 }));
      const count = Number(body?.count || 0);
      const headers = {
        'Content-Range': count > 0 ? `0-${count - 1}/${count}` : '*/0',
        'Range-Unit': 'items',
      };
      if (method === 'HEAD') return new Response(null, { status: result.ok ? 200 : result.status, headers });
      return fakeJson([], result.ok ? 200 : result.status, headers);
    }
  }

  // Convert legacy positive economy transactions into authenticated backend rewards.
  if (table === 'transactions' && method === 'POST') {
    const raw = await request.clone().json().catch(() => null) as any;
    const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];

    if (rows.length > 0 && rows.every((row) => row?.type === 'tower_climb')) {
      // Tower payout is already handled when the tower_runs insert is intercepted.
      return fakeJson(rows, 201);
    }

    if (rows.length > 0 && rows.every((row) => row?.type === 'ad_watch' || row?.type === 'adsgram_reward')) {
      // Ads are already credited by log-ad. Prevent the old Home handler from double paying.
      return fakeJson(rows, 201);
    }

    if (rows.length > 0 && rows.every((row) => LEGACY_REWARD_TYPES.has(String(row?.type)))) {
      for (const row of rows) {
        const result = await bridge('reward', {
          type: String(row.type),
          points: Number(row.points || 0),
          description: String(row.description || row.type),
        });
        if (!result.ok) {
          const error = await result.text();
          return new Response(error, { status: result.status, headers: { 'Content-Type': 'application/json' } });
        }
      }
      return fakeJson(rows, 201);
    }
  }

  // Daily Drop's old UI checks and inserts daily_claims directly. Reads are scoped through
  // Telegram auth; the insert itself is only simulated because the secure reward endpoint
  // performs the real claim atomically when the transaction follows.
  if (table === 'daily_claims' && (method === 'GET' || method === 'HEAD')) {
    const result = await bridge('daily-claims');
    const payload = await result.json().catch(() => ({ data: [] }));
    let rows = Array.isArray(payload?.data) ? payload.data : [];
    const requestedDate = eqValue(url, 'claim_date');
    if (requestedDate) rows = rows.filter((row: any) => row.claim_date === requestedDate);
    const limit = Number(url.searchParams.get('limit') || 0);
    if (limit > 0) rows = rows.slice(0, limit);
    if (method === 'HEAD') {
      const count = rows.length;
      return new Response(null, {
        status: result.ok ? 200 : result.status,
        headers: { 'Content-Range': count > 0 ? `0-${count - 1}/${count}` : '*/0', 'Range-Unit': 'items' },
      });
    }
    return fakeJson(rows, result.ok ? 200 : result.status);
  }

  if (table === 'daily_claims' && method === 'POST') {
    const raw = await request.clone().json().catch(() => ({}));
    return fakeJson(Array.isArray(raw) ? raw : [raw], 201);
  }

  // Home uses a direct count query for today's Adsgram views.
  if (table === 'ad_logs' && (method === 'GET' || method === 'HEAD')) {
    const result = await bridge('count-ads', {
      adType: eqValue(url, 'ad_type'),
      since: gteValue(url, 'created_at'),
    });
    const payload = await result.json().catch(() => ({ count: 0 }));
    const count = Number(payload?.count || 0);
    const headers = {
      'Content-Range': count > 0 ? `0-${count - 1}/${count}` : '*/0',
      'Range-Unit': 'items',
    };
    if (method === 'HEAD') return new Response(null, { status: result.ok ? 200 : result.status, headers });
    return fakeJson([], result.ok ? 200 : result.status, headers);
  }

  // Tower's old page writes run/stats directly. Route the run to the backend, which records
  // leaderboard stats and awards the capped score. Subsequent legacy stat writes are ignored.
  if (table === 'tower_runs' && method === 'POST') {
    const raw = await request.clone().json().catch(() => ({})) as any;
    const row = Array.isArray(raw) ? raw[0] : raw;
    const result = await bridge('tower-run', {
      floor: Number(row?.floors_reached || 0),
      points: Number(row?.points_earned || 0),
    });
    if (!result.ok) return result;
    return fakeJson(Array.isArray(raw) ? raw : [raw], 201);
  }

  if (table === 'tower_leaderboard' && (method === 'POST' || method === 'PATCH')) {
    const raw = method === 'POST' ? await request.clone().json().catch(() => ({})) : null;
    return method === 'PATCH' ? fakeJson(null, 204) : fakeJson(Array.isArray(raw) ? raw : [raw], 201);
  }

  return nativeFetch(request);
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: backendV2Fetch,
  },
});
