const SUPABASE_URL = 'https://eoppaqrqlpyqoizohoba.supabase.co';
const ANON_KEY = 'sb_publishable_DJ7o0hTt3DPL8O_3HbAWuw_NkdvY0na';

function telegramInitData(): string {
  return window.Telegram?.WebApp?.initData || '';
}

async function post<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        'x-telegram-init-data': telegramInitData(),
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.success === false) {
      throw new Error(data?.message || data?.error || 'PvP request failed');
    }
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

export type AdminPvpGame = {
  gameKey: string;
  name: string;
  emoji: string;
  enabled: boolean;
  sortOrder: number;
};

export type AdminPvpOverview = {
  matchesToday: number;
  activePlayers: number;
  creditsConverted: number;
  creditsUsed: number;
  creditsLocked: number;
  mostPlayedGame: string;
  mostPlayedCount: number;
  settings: Record<string, string>;
  games: AdminPvpGame[];
};

export async function adminGetPvpOverview(): Promise<AdminPvpOverview | null> {
  try {
    const result = await post<{ success: boolean; data: AdminPvpOverview }>('pvp-api', { action: 'admin-overview' });
    return result.data || null;
  } catch (error) {
    console.error('admin PvP overview error:', error);
    return null;
  }
}
