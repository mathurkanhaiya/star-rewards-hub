import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireTelegramUser, secureCorsHeaders as corsHeaders } from "../_shared/telegramAuth.ts";

const PROVIDERS = ['adsgram', 'monetag', 'gigapub'] as const;
type Provider = typeof PROVIDERS[number];

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

function startFor(offsetMinutes: number, daysAgo = 0) {
  const now = new Date(Date.now() + offsetMinutes * 60_000);
  const shifted = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo));
  return new Date(shifted.getTime() - offsetMinutes * 60_000);
}

function numberSetting(map: Record<string, string>, key: string, fallback: number, min: number, max: number) {
  const parsed = Number(map[key]);
  return Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : fallback));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { appUser } = await requireTelegramUser(req, supabase);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const { data: settingRows, error: settingsError } = await supabase.from('settings').select('key,value');
    if (settingsError) throw settingsError;

    const settings = Object.fromEntries((settingRows || []).map((row) => [row.key, String(row.value)]));
    const offset = numberSetting(settings, 'daily_reset_offset_minutes', 330, -720, 840);
    const max = numberSetting(settings, 'leaderboard_max_entries', 50, 1, 100);

    if (action === 'today-ads') {
      const from = startFor(offset).toISOString();
      const { count, error } = await supabase
        .from('ad_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', appUser.id)
        .eq('ad_type', 'ad_watch')
        .gte('created_at', from);
      if (error) throw error;
      return json({ success: true, count: count || 0, from });
    }

    if (action === 'ad-provider-stats') {
      const dayStart = startFor(offset);
      const nextResetAt = new Date(dayStart.getTime() + 86_400_000).toISOString();
      const rewardPoints = numberSetting(settings, 'ad_reward_points', 50, 0, 10_000);
      const fallbackLimit = numberSetting(settings, 'max_ads_per_day', 50, 0, 1_000);
      const fallbackCooldown = numberSetting(settings, 'ad_cooldown_seconds', 10, 0, 3_600);
      const hourlyLimit = numberSetting(settings, 'max_ads_per_hour', 10, 0, 100);
      const hourStart = new Date(Date.now() - 3_600_000);
      const logFrom = new Date(Math.min(dayStart.getTime(), hourStart.getTime())).toISOString();
      const { data: recentLogs, error: logsError } = await supabase
        .from('ad_logs')
        .select('provider,created_at')
        .eq('user_id', appUser.id)
        .eq('ad_type', 'ad_watch')
        .gte('created_at', logFrom)
        .order('created_at', { ascending: false })
        .limit(5_000);
      if (logsError) throw logsError;

      const entries = PROVIDERS.map((provider) => {
        const limit = numberSetting(settings, `${provider}_max_ads_per_day`, fallbackLimit, 0, 1_000);
        const cooldownSeconds = numberSetting(settings, `${provider}_cooldown_seconds`, fallbackCooldown, 0, 3_600);
        const providerLogs = (recentLogs || []).filter((log) => log.provider === provider);
        const count = providerLogs.filter((log) => new Date(log.created_at).getTime() >= dayStart.getTime()).length;
        const hourLogs = providerLogs.filter((log) => new Date(log.created_at).getTime() >= hourStart.getTime());
        const lastAt = providerLogs[0]?.created_at ? new Date(providerLogs[0].created_at).getTime() : 0;
        const cooldownAvailableMs = lastAt + cooldownSeconds * 1_000;
        const oldestHourlyAt = hourLogs.at(-1)?.created_at ? new Date(hourLogs.at(-1)!.created_at).getTime() : 0;
        const hourlyAvailableMs = hourlyLimit > 0 && hourLogs.length >= hourlyLimit ? oldestHourlyAt + 3_600_000 : 0;
        const nextAvailableMs = Math.max(cooldownAvailableMs, hourlyAvailableMs);
        return [provider, {
          count,
          limit,
          remaining: Math.max(0, limit - count),
          cooldownSeconds,
          hourlyCount: hourLogs.length,
          hourlyLimit,
          nextAvailableAt: nextAvailableMs > Date.now() ? new Date(nextAvailableMs).toISOString() : null,
          enabled: limit > 0 && hourlyLimit > 0,
        }] as const;
      });

      return json({
        success: true,
        rewardPoints,
        nextResetAt,
        providers: Object.fromEntries(entries) as Record<Provider, unknown>,
      });
    }

    if (action === 'points-leaderboard') {
      const { data: balances, error } = await supabase
        .from('balances')
        .select('user_id,points')
        .order('points', { ascending: false })
        .limit(max);
      if (error) throw error;

      const ids = (balances || []).map((balance) => balance.user_id);
      const { data: users, error: usersError } = ids.length
        ? await supabase.from('users').select('id,telegram_id,first_name,username,photo_url').in('id', ids)
        : { data: [], error: null };
      if (usersError) throw usersError;
      const userMap = Object.fromEntries((users || []).map((user) => [user.id, user]));
      return json({
        success: true,
        data: (balances || []).map((balance, index) => ({
          ...userMap[balance.user_id],
          id: balance.user_id,
          user_id: balance.user_id,
          points: Number(balance.points || 0),
          total_points: Number(balance.points || 0),
          rank: index + 1,
        })),
      });
    }

    if (action === 'ads-leaderboard') {
      const range = String(body.range || 'today');
      let from = startFor(offset).toISOString();
      let to: string | undefined;
      if (range === 'yesterday') {
        from = startFor(offset, 1).toISOString();
        to = startFor(offset).toISOString();
      } else if (range === 'week') {
        from = startFor(offset, 6).toISOString();
      }

      let query = supabase.from('ad_logs').select('user_id').eq('ad_type', 'ad_watch').gte('created_at', from);
      if (to) query = query.lt('created_at', to);
      const { data: logs, error } = await query.limit(10_000);
      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const row of logs || []) counts[row.user_id] = (counts[row.user_id] || 0) + 1;
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, max);
      const ids = top.map(([id]) => id);
      const { data: users, error: usersError } = ids.length
        ? await supabase.from('users').select('id,telegram_id,first_name,username,photo_url').in('id', ids)
        : { data: [], error: null };
      if (usersError) throw usersError;
      const userMap = Object.fromEntries((users || []).map((user) => [user.id, user]));
      return json({
        success: true,
        data: top.map(([id, score], index) => ({ user_id: id, score, rank: index + 1, users: userMap[id] || {} })),
        from,
        to,
      });
    }

    if (action === 'invite-leaderboard') {
      const range = ['week', 'month', 'all'].includes(String(body.range)) ? String(body.range) : 'week';
      const { data, error } = await supabase.rpc('get_invite_leaderboard', {
        p_range: range,
        p_limit: max,
        p_offset_minutes: offset,
      });
      if (error) throw error;
      return json({
        success: true,
        data: (data || []).map((row: Record<string, unknown>) => ({
          user_id: row.user_id,
          score: Number(row.score || 0),
          rank: Number(row.rank || 0),
          user: {
            id: row.user_id,
            telegram_id: row.telegram_id,
            first_name: row.first_name,
            username: row.username,
            photo_url: row.photo_url,
          },
        })),
      });
    }

    return json({ success: false, message: 'Unknown action' }, 400);
  } catch (error) {
    const message = (error as Error).message;
    const status = /Telegram|registered|banned|expired|signature/i.test(message) ? 401 : 400;
    return json({ success: false, message, error: message }, status);
  }
});
