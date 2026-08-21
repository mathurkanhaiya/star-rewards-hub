import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireTelegramUser, secureCorsHeaders as corsHeaders } from "../_shared/telegramAuth.ts";

const SPIN_PRIZES = [
  { type: 'points', points: 10, stars: 0, probability: 0.30 },
  { type: 'points', points: 15, stars: 0, probability: 0.25 },
  { type: 'points', points: 20, stars: 0, probability: 0.15 },
  { type: 'points', points: 30, stars: 0, probability: 0.08 },
  { type: 'points', points: 25, stars: 0, probability: 0.05 },
  { type: 'points', points: 17, stars: 0, probability: 0.07 },
  { type: 'points', points: 35, stars: 0, probability: 0.03 },
  { type: 'empty', points: 0, stars: 0, probability: 0.07 },
];
function selectPrize() {
  const rand = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  let cumulative = 0;
  for (const prize of SPIN_PRIZES) {
    cumulative += prize.probability;
    if (rand <= cumulative) return prize;
  }
  return SPIN_PRIZES[SPIN_PRIZES.length - 1];
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { appUser } = await requireTelegramUser(req, supabase);
    const prize = selectPrize();
    const { data, error } = await supabase.rpc('claim_spin_reward_atomic', {
      p_user_id: appUser.id, p_result_type: prize.type, p_points: prize.points, p_stars: prize.stars,
    });
    if (error) throw error;
    return json(data || { success: false, message: 'Spin reward failed' });
  } catch (error) {
    const message = (error as Error).message;
    const status = /Telegram|registered|banned|expired|signature/i.test(message) ? 401 : 400;
    return json({ success: false, message }, status);
  }
});
