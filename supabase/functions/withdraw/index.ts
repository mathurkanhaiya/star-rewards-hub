import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireTelegramUser, secureCorsHeaders as corsHeaders } from "../_shared/telegramAuth.ts";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { appUser } = await requireTelegramUser(req, supabase);
    const body = await req.json().catch(() => ({}));
    const method = String(body.method || '');
    const points = Number(body.points);
    const walletAddress = String(body.walletAddress || '');
    if (!Number.isSafeInteger(points)) return json({ success: false, message: 'Invalid points' }, 400);

    const { data, error } = await supabase.rpc('create_withdrawal_atomic', {
      p_user_id: appUser.id, p_method: method, p_points: points, p_wallet_address: walletAddress,
    });
    if (error) throw error;
    return json(data || { success: false, message: 'Withdrawal failed' });
  } catch (error) {
    const message = (error as Error).message;
    const status = /Telegram|registered|banned|expired|signature/i.test(message) ? 401 : 400;
    return json({ success: false, message }, status);
  }
});
