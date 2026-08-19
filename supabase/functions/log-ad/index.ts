import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireTelegramUser, secureCorsHeaders as corsHeaders } from "../_shared/telegramAuth.ts";

type AdProvider = 'adsgram' | 'monetag' | 'gigapub';
type ClaimResult = {
  success: boolean;
  message?: string;
  points?: number;
  count?: number;
  limit?: number;
  retryAfter?: number;
  nextAvailableAt?: string | null;
  nextResetAt?: string;
};

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { appUser } = await requireTelegramUser(req, supabase);
    const { adType, provider = 'adsgram', blockId } = await req.json();

    if (adType === 'adsgram_task') {
      if (blockId !== 'task-25198') throw new Error('Invalid Adsgram task block');

      const { data, error } = await supabase.rpc('claim_adsgram_task_reward', {
        p_user_id: appUser.id,
      });
      if (error) throw error;
      return json(data || { success: false, message: 'Task reward could not be verified' });
    }

    if (adType !== 'ad_watch') throw new Error('Invalid rewarded ad type');
    if (!['adsgram', 'monetag', 'gigapub'].includes(provider)) throw new Error('Invalid ad provider');

    // The database function serializes claims per user/provider and applies that
    // provider's own daily limit and cooldown in the same reward transaction.
    const { data, error } = await supabase.rpc('claim_ad_reward', {
      p_user_id: appUser.id,
      p_provider: provider as AdProvider,
    });
    if (error) throw error;

    const result = (data || { success: false, message: 'Ad reward could not be verified' }) as ClaimResult;
    if (!result.success) return json(result, result.retryAfter ? 429 : 200);

    const now = new Date().toISOString();
    const { data: contests } = await supabase
      .from('contests')
      .select('id')
      .eq('contest_type', 'ads_watch')
      .eq('is_active', true)
      .lte('starts_at', now)
      .gte('ends_at', now);

    for (const contest of contests || []) {
      const { data: existing } = await supabase
        .from('contest_entries')
        .select('id,score')
        .eq('contest_id', contest.id)
        .eq('user_id', appUser.id)
        .maybeSingle();

      if (existing) {
        await supabase.from('contest_entries').update({
          score: Number(existing.score) + 1,
          updated_at: now,
        }).eq('id', existing.id);
      } else {
        await supabase.from('contest_entries').insert({
          contest_id: contest.id,
          user_id: appUser.id,
          score: 1,
        });
      }
    }

    return json(result);
  } catch (error) {
    const message = (error as Error).message;
    const status = /Telegram|registered|banned|expired|signature/i.test(message) ? 401 : 400;
    return json({ success: false, message }, status);
  }
});
