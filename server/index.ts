import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

const app = express();
const PORT = 3001;

// ── Supabase admin client (SERVICE ROLE — never sent to browser) ─────────────
const SUPABASE_URL = 'https://sxuffcmantqbfhcxvwij.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TELEGRAM_BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_TELEGRAM_ID    = parseInt(process.env.ADMIN_TELEGRAM_ID || '0', 10);

if (!SUPABASE_SERVICE_KEY) {
  console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Security middleware ──────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '16kb' }));

// Global rate limit: 120 req / minute per IP
const globalLimiter = rateLimit({
  windowMs: 60_000, max: 120,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many requests' },
});
app.use(globalLimiter);

// Strict limiter for mutating endpoints: 30 req / minute per IP
const strictLimiter = rateLimit({
  windowMs: 60_000, max: 30,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Rate limit exceeded' },
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function isUUID(s: unknown): s is string {
  return typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

async function resolveUserId(userId: string): Promise<string | null> {
  if (!isUUID(userId)) return null;
  const { data } = await db.from('users').select('id, is_banned').eq('id', userId).single();
  if (!data || data.is_banned) return null;
  return data.id;
}

async function getBalance(userId: string) {
  const { data } = await db.from('balances').select('points, total_earned, stars_balance').eq('user_id', userId).single();
  return data;
}

async function creditPoints(userId: string, pts: number, type: string, description: string) {
  const { data: bal, error } = await db.from('balances').select('points, total_earned').eq('user_id', userId).single();
  if (error || !bal) throw new Error('Balance not found');
  await db.from('balances').update({ points: bal.points + pts, total_earned: bal.total_earned + pts }).eq('user_id', userId);
  await db.from('users').select('total_points').eq('id', userId).single().then(async ({ data: u }) => {
    if (u) {
      const newTotal = u.total_points + pts;
      await db.from('users').update({ total_points: newTotal, level: Math.floor(newTotal / 10000) + 1 }).eq('id', userId);
    }
  });
  await db.from('transactions').insert({ user_id: userId, type, points: pts, description });
}

async function sendTg(chatId: number, text: string, extra: Record<string, any> = {}) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...extra }),
    });
  } catch {}
}

async function editTgMsg(chatId: number, messageId: number, text: string, extra: Record<string, any> = {}) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', ...extra }),
    });
  } catch {}
}

const MINI_APP_URL = 'https://t.me/Adsrewartsbot/app';
const MINI_APP_BTN = { inline_keyboard: [[{ text: '🎮 Open Mini App', web_app: { url: MINI_APP_URL } }]] };

// Get Telegram user bio via Bot API
async function getTgBio(telegramId: number): Promise<string> {
  if (!TELEGRAM_BOT_TOKEN) return '';
  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat?chat_id=${telegramId}`);
    const d = await r.json() as any;
    return d?.result?.bio || '';
  } catch { return ''; }
}

// Multi-level referral commission — called after every real earn
// COMMISSION_TYPES are excluded from triggering further commissions
const COMMISSION_TYPES = new Set(['commission_l1', 'commission_l2', 'commission_l3', 'referral_verified']);

async function payCommission(earnerUserId: string, pts: number) {
  if (pts < 1) return;
  try {
    // Fetch referral chain  (up to 3 hops via referred_by on users)
    const { data: earner } = await db.from('users').select('referred_by').eq('id', earnerUserId).single();
    if (!earner?.referred_by) return;

    // Read pcts from cache (no network call)
    const l1Pct = parseFloat(getSettingSync('referral_commission_l1_pct', '10'));
    const l2Pct = parseFloat(getSettingSync('referral_commission_l2_pct', '5'));
    const l3Pct = parseFloat(getSettingSync('referral_commission_l3_pct', '2.5'));

    // L1
    const { data: l1 } = await db.from('users').select('id, telegram_id, referred_by').eq('telegram_id', earner.referred_by).single();
    if (!l1) return;
    const l1Pts = Math.floor(pts * l1Pct / 100);
    if (l1Pts > 0) await creditPoints(l1.id, l1Pts, 'commission_l1', `💰 L1 commission: +${l1Pts} ADR`);

    // L2
    if (!l1.referred_by) return;
    const { data: l2 } = await db.from('users').select('id, telegram_id, referred_by').eq('telegram_id', l1.referred_by).single();
    if (!l2) return;
    const l2Pts = Math.floor(pts * l2Pct / 100);
    if (l2Pts > 0) await creditPoints(l2.id, l2Pts, 'commission_l2', `💰 L2 commission: +${l2Pts} ADR`);

    // L3
    if (!l2.referred_by) return;
    const { data: l3 } = await db.from('users').select('id, telegram_id').eq('telegram_id', l2.referred_by).single();
    if (!l3) return;
    const l3Pts = Math.floor(pts * l3Pct / 100);
    if (l3Pts > 0) await creditPoints(l3.id, l3Pts, 'commission_l3', `💰 L3 commission: +${l3Pts} ADR`);
  } catch { /* silent – never block the primary earn */ }
}

// Verify referral after first real user action (ad watch)
async function verifyReferral(newUserId: string, newUserIp: string, newUserName: string) {
  try {
    const { data: ref } = await db.from('referrals')
      .select('id, referrer_id, is_verified')
      .eq('referred_id', newUserId)
      .single();
    if (!ref || ref.is_verified) return;

    // IP uniqueness check – compare with referrer's reg_ip
    const { data: referrer } = await db.from('users').select('id, telegram_id, reg_ip, first_name').eq('id', ref.referrer_id).single();
    if (!referrer) return;
    if (referrer.reg_ip && referrer.reg_ip === newUserIp) return; // same IP → reject

    // Mark verified
    await db.from('referrals').update({ is_verified: true }).eq('id', ref.id);

    // Pay $0.015 equivalent to referrer
    const reward = parseInt(await getSetting('referral_verified_reward', '150'), 10);
    await creditPoints(referrer.id, reward, 'referral_verified', `✅ Verified referral: @${newUserName} +${reward} ADR`);
    await db.from('notifications').insert({
      user_id: referrer.id,
      title: '✅ Referral Verified!',
      message: `@${newUserName} completed their first activity! +${reward} ADR added.`,
      type: 'referral',
    });
    if (referrer.telegram_id) {
      await sendTg(referrer.telegram_id,
        `✅ <b>Referral Verified!</b>\n\n@${newUserName} passed verification!\n💰 +${reward} ADR added to your balance.\n\n🔗 You also earn <b>10% lifetime commission</b> on their earnings!`,
        { reply_markup: MINI_APP_BTN }
      );
    }
  } catch { /* silent */ }
}

function ok(res: express.Response, data: object = {}) {
  return res.json({ success: true, ...data });
}
function err(res: express.Response, message: string, status = 200) {
  return res.status(status).json({ success: false, message });
}

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ── DB Setup page (apply schema to Supabase) ─────────────────────────────────
const SCHEMA_SQL = `-- ENUM
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), telegram_id bigint UNIQUE NOT NULL,
  first_name text, last_name text, username text, photo_url text,
  referral_code text UNIQUE NOT NULL, referred_by bigint, is_banned boolean NOT NULL DEFAULT false,
  level int NOT NULL DEFAULT 1, total_points int NOT NULL DEFAULT 0,
  last_active_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (true);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (true);

CREATE TABLE IF NOT EXISTS public.balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  points int NOT NULL DEFAULT 0, stars_balance numeric NOT NULL DEFAULT 0, ton_balance numeric NOT NULL DEFAULT 0,
  usdt_balance numeric NOT NULL DEFAULT 0, total_earned int NOT NULL DEFAULT 0, total_withdrawn int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "balances_select" ON public.balances FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL, points int NOT NULL DEFAULT 0, description text, reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions_select" ON public.transactions FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, description text,
  task_type text NOT NULL DEFAULT 'social', link text, icon text,
  reward_points int NOT NULL DEFAULT 0, reward_stars int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true, is_repeatable boolean NOT NULL DEFAULT false,
  repeat_hours int, max_completions int, display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.user_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  points_earned int NOT NULL DEFAULT 0, completed_at timestamptz NOT NULL DEFAULT now(),
  next_available_at timestamptz
);
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_tasks_select" ON public.user_tasks FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.daily_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  claim_date date NOT NULL DEFAULT CURRENT_DATE, claimed_at timestamptz NOT NULL DEFAULT now(),
  day_streak int NOT NULL DEFAULT 1, points_earned int NOT NULL DEFAULT 0,
  UNIQUE(user_id, claim_date)
);
ALTER TABLE public.daily_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_claims_select" ON public.daily_claims FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.spin_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  result_type text NOT NULL, points_earned int NOT NULL DEFAULT 0,
  stars_earned int NOT NULL DEFAULT 0, spun_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.spin_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spin_results_select" ON public.spin_results FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.ad_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ad_type text NOT NULL, reward_given int NOT NULL DEFAULT 0,
  provider text NOT NULL DEFAULT 'adsgram', ip_address text, device_info text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ad_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad_logs_select" ON public.ad_logs FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_id uuid UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  points_earned int NOT NULL DEFAULT 0, is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals_select" ON public.referrals FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  method text NOT NULL, points_spent int NOT NULL DEFAULT 0, amount numeric NOT NULL,
  wallet_address text, status text NOT NULL DEFAULT 'pending', admin_note text,
  requested_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "withdrawals_select" ON public.withdrawals FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL, message text NOT NULL, type text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (true);

CREATE TABLE IF NOT EXISTS public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key text UNIQUE NOT NULL,
  value text NOT NULL, description text, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select" ON public.settings FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.promos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL,
  reward_points int NOT NULL DEFAULT 0, max_claims int NOT NULL DEFAULT 100,
  total_claimed int NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promos_select" ON public.promos FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.promo_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id uuid NOT NULL REFERENCES public.promos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(), UNIQUE(promo_id, user_id)
);
ALTER TABLE public.promo_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo_claims_select" ON public.promo_claims FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.contests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL,
  contest_type text NOT NULL DEFAULT 'points', is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(), ends_at timestamptz NOT NULL,
  reward_1st int NOT NULL DEFAULT 0, reward_2nd int NOT NULL DEFAULT 0,
  reward_3rd int NOT NULL DEFAULT 0, reward_4th int NOT NULL DEFAULT 0,
  reward_5th int NOT NULL DEFAULT 0, rewards_distributed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contests_select" ON public.contests FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.contest_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score int NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contest_id, user_id)
);
ALTER TABLE public.contest_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contest_entries_select" ON public.contest_entries FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), message text NOT NULL,
  sent_by bigint NOT NULL, target text NOT NULL DEFAULT 'all',
  sent_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "broadcasts_select" ON public.broadcasts FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), admin_telegram_id bigint NOT NULL,
  action text NOT NULL, target_user_id uuid, details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_logs_select" ON public.admin_logs FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.tower_leaderboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  best_floor int NOT NULL DEFAULT 0, total_floors int NOT NULL DEFAULT 0,
  total_runs int NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tower_leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tower_leaderboard_select" ON public.tower_leaderboard FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.tower_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  floors_reached int NOT NULL DEFAULT 0, points_earned int NOT NULL DEFAULT 0,
  revives_used int NOT NULL DEFAULT 0, shields_used int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tower_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tower_runs_select" ON public.tower_runs FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.crash_leaderboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  best_multiplier numeric NOT NULL DEFAULT 0, total_rounds int NOT NULL DEFAULT 0,
  total_won int NOT NULL DEFAULT 0, total_earned int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crash_leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crash_leaderboard_select" ON public.crash_leaderboard FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.crash_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bet_amount int NOT NULL DEFAULT 0, crash_multiplier numeric NOT NULL,
  multiplier_at_cashout numeric, points_earned int NOT NULL DEFAULT 0,
  won boolean NOT NULL DEFAULT false, had_shield boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crash_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crash_rounds_select" ON public.crash_rounds FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.miner_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mine_level int NOT NULL DEFAULT 1, pickaxe_level int NOT NULL DEFAULT 1,
  worker_count int NOT NULL DEFAULT 0, coins numeric NOT NULL DEFAULT 0,
  coins_per_second numeric NOT NULL DEFAULT 0, total_coins_earned numeric NOT NULL DEFAULT 0,
  last_collected_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.miner_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "miner_progress_select" ON public.miner_progress FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.miner_leaderboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mine_level int NOT NULL DEFAULT 1, total_coins_earned numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.miner_leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "miner_leaderboard_select" ON public.miner_leaderboard FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.lab_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  generator_level int NOT NULL DEFAULT 1, accelerator_level int NOT NULL DEFAULT 1,
  booster_level int NOT NULL DEFAULT 1, quantum_level int NOT NULL DEFAULT 1,
  coins numeric NOT NULL DEFAULT 0, coins_per_second numeric NOT NULL DEFAULT 0,
  total_coins_earned numeric NOT NULL DEFAULT 0,
  last_collected_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lab_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab_progress_select" ON public.lab_progress FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.lab_leaderboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  highest_machine text NOT NULL DEFAULT 'generator', total_coins_earned numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lab_leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab_leaderboard_select" ON public.lab_leaderboard FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user', created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.weekly_kings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_start date NOT NULL, week_end date NOT NULL, total_earned int NOT NULL DEFAULT 0,
  rank int, badge text, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.weekly_kings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weekly_kings_select" ON public.weekly_kings FOR SELECT USING (true);

CREATE OR REPLACE VIEW public.leaderboard AS
SELECT u.id, u.telegram_id, u.first_name, u.username, u.photo_url, u.level,
  u.total_points, b.points AS current_points,
  ROW_NUMBER() OVER (ORDER BY u.total_points DESC) AS rank
FROM public.users u LEFT JOIN public.balances b ON b.user_id = u.id
WHERE u.is_banned = false;

CREATE OR REPLACE FUNCTION public.increment_points(p_user_id uuid, p_points int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.balances SET points = points + p_points, total_earned = total_earned + p_points WHERE user_id = p_user_id;
  UPDATE public.users SET total_points = total_points + p_points, level = FLOOR((total_points + p_points) / 10000) + 1 WHERE id = p_user_id;
END; $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_telegram_admin(_telegram_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u JOIN public.user_roles r ON r.user_id = u.id WHERE u.telegram_id = _telegram_id AND r.role = 'admin');
$$;

INSERT INTO public.settings (key, value, description) VALUES
  ('min_withdrawal_points','5000','Minimum points required to withdraw'),
  ('max_pending_withdrawals','2','Max pending withdrawal requests per user'),
  ('max_daily_withdrawals','3','Max withdrawals per day per user'),
  ('points_per_referral','500','Points earned per successful referral'),
  ('referral_bonus_referred','200','Points given to new referred user'),
  ('welcome_bonus','200','Points given on first signup'),
  ('daily_reward_base','100','Base daily reward points'),
  ('ad_reward_points','50','Points per ad watch'),
  ('ad_max_per_day','20','Max ads per user per day'),
  ('farm_reward_points','100','Points for completing farm'),
  ('spin_max_per_window','3','Max spins per 4-hour window'),
  ('tap_daily_limit','2000','Max tap earn points per 24 hours'),
  ('tap_reward_per_tap','1','Base points per tap (x2 boost doubles this)'),
  ('pvp_house_fee_pct','3','House fee percentage for PVP games (e.g. 3 = 3%)'),
  ('pvp_min_bet','100','Minimum ADR for PVP challenges'),
  ('pvp_challenge_timeout_min','5','Minutes before open challenge expires')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.pvp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type text NOT NULL,
  amount int NOT NULL,
  challenger_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  challenger_name text NOT NULL,
  challenger_tg_id bigint NOT NULL,
  acceptor_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  acceptor_name text,
  acceptor_tg_id bigint,
  status text NOT NULL DEFAULT 'open',
  chat_id bigint NOT NULL,
  message_id int,
  expires_at timestamptz NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pvp_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pvp_challenges_select" ON public.pvp_challenges FOR SELECT USING (true);

-- Beg logs (cooldown tracking for /beg command)
CREATE TABLE IF NOT EXISTS public.beg_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  won boolean NOT NULL DEFAULT false,
  points_earned int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.beg_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "beg_logs_select" ON public.beg_logs FOR SELECT USING (true);

-- IP tracking for referral verification
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS reg_ip text;

-- New settings
INSERT INTO public.settings (key, value, description) VALUES
  ('referral_verified_reward',   '150',  'ADR points per verified referral (~$0.015)'),
  ('referral_commission_l1_pct', '10',   'L1 lifetime commission %'),
  ('referral_commission_l2_pct', '5',    'L2 lifetime commission %'),
  ('referral_commission_l3_pct', '2.5',  'L3 lifetime commission %'),
  ('beg_cooldown_hours',         '12',   'Hours between /beg commands'),
  ('beg_reward_min',             '10',   'Min ADR from /beg win'),
  ('beg_reward_max',             '50',   'Max ADR from /beg win'),
  ('claim_reward_min',           '50',   'Min ADR from /claim'),
  ('claim_reward_max',           '200',  'Max ADR from /claim')
ON CONFLICT (key) DO NOTHING;`;

app.get('/api/setup', (_req, res) => {
  const escaped = SCHEMA_SQL.replace(/`/g, '\\`').replace(/\$/g, '\\$');
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Database Setup</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0a0e1a; color: #fff; font-family: system-ui, sans-serif; padding: 24px; min-height: 100vh; }
    h1 { color: #ffbe00; font-size: 22px; margin-bottom: 8px; }
    p  { color: rgba(255,255,255,0.5); font-size: 14px; margin-bottom: 20px; line-height: 1.5; }
    .step { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
    .step-num { color: #ffbe00; font-size: 12px; font-weight: 700; letter-spacing: 2px; margin-bottom: 6px; }
    .step-text { color: rgba(255,255,255,0.7); font-size: 14px; }
    .btn { display: block; width: 100%; padding: 14px; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; border: none; margin-bottom: 12px; transition: opacity 0.2s; }
    .btn:active { opacity: 0.8; }
    .btn-copy { background: #ffbe00; color: #000; }
    .btn-open { background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2); }
    .copied { background: #22c55e !important; color: #fff !important; }
    .status { font-size: 13px; color: rgba(255,255,255,0.4); text-align: center; margin-top: 8px; }
    pre { background: rgba(0,0,0,0.4); border-radius: 8px; padding: 12px; font-size: 11px; overflow-x: auto; color: rgba(255,255,255,0.5); max-height: 200px; margin-top: 12px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>Database Setup</h1>
  <p>The new Supabase project needs its tables created. Follow these 3 steps:</p>

  <div class="step">
    <div class="step-num">STEP 1</div>
    <div class="step-text">Click the button below to copy all the SQL to your clipboard.</div>
  </div>

  <button class="btn btn-copy" id="copyBtn" onclick="copySQL()">Copy SQL to Clipboard</button>

  <div class="step">
    <div class="step-num">STEP 2</div>
    <div class="step-text">Open the Supabase SQL Editor for your project.</div>
  </div>

  <button class="btn btn-open" onclick="openSupabase()">Open Supabase SQL Editor</button>

  <div class="step">
    <div class="step-num">STEP 3</div>
    <div class="step-text">Paste (Ctrl+V or long press → Paste) and click the green <strong>Run</strong> button.</div>
  </div>

  <div class="status" id="status">Ready to copy</div>

  <pre id="preview">${SCHEMA_SQL.slice(0, 500)}...</pre>

  <script>
    const SQL = \`${escaped}\`;

    function copySQL() {
      const btn = document.getElementById('copyBtn');
      const status = document.getElementById('status');
      navigator.clipboard.writeText(SQL).then(() => {
        btn.textContent = 'Copied!';
        btn.className = 'btn copied';
        status.textContent = 'SQL copied — now open the editor and paste it';
        setTimeout(() => {
          btn.textContent = 'Copy SQL to Clipboard';
          btn.className = 'btn btn-copy';
        }, 3000);
      }).catch(() => {
        // Fallback: select textarea
        const ta = document.createElement('textarea');
        ta.value = SQL;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        btn.textContent = 'Copied!';
        btn.className = 'btn copied';
        status.textContent = 'SQL copied via fallback — paste in the editor';
        setTimeout(() => {
          btn.textContent = 'Copy SQL to Clipboard';
          btn.className = 'btn btn-copy';
        }, 3000);
      });
    }

    function openSupabase() {
      window.open('https://supabase.com/dashboard/project/sxuffcmantqbfhcxvwij/sql/new', '_blank');
    }
  </script>
</body>
</html>`);
});

// ════════════════════════════════════════════════════════════════════════════
// AUTH — Telegram user init
// ════════════════════════════════════════════════════════════════════════════
app.post('/api/auth/telegram', strictLimiter, async (req, res) => {
  const { telegramUser, referralCode } = req.body;
  if (!telegramUser?.id || typeof telegramUser.id !== 'number') return err(res, 'Invalid telegram user', 400);
  if (telegramUser.first_name && typeof telegramUser.first_name !== 'string') return err(res, 'Invalid data', 400);

  try {
    const { data: existingUser } = await db.from('users').select('*').eq('telegram_id', telegramUser.id).single();

    const regIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim();

    if (existingUser) {
      await db.from('users').update({ last_active_at: new Date().toISOString(), photo_url: telegramUser.photo_url || null }).eq('id', existingUser.id);
      return ok(res, { user: existingUser });
    }

    const referralCodeGen = String(telegramUser.id);
    let referrerId: string | null = null;
    let referrerTgId: number | null = null;
    if (referralCode && referralCode !== String(telegramUser.id)) {
      const refId = parseInt(String(referralCode), 10);
      if (!isNaN(refId)) {
        const { data: referrer } = await db.from('users').select('id, telegram_id').eq('telegram_id', refId).single();
        if (referrer) { referrerId = referrer.id; referrerTgId = referrer.telegram_id; }
      }
    }

    const { data: newUser, error: userError } = await db.from('users').insert({
      telegram_id:   telegramUser.id,
      first_name:    String(telegramUser.first_name || '').slice(0, 64),
      last_name:     telegramUser.last_name ? String(telegramUser.last_name).slice(0, 64) : null,
      username:      telegramUser.username  ? String(telegramUser.username).slice(0, 64)  : null,
      photo_url:     telegramUser.photo_url ? String(telegramUser.photo_url).slice(0, 512): null,
      referral_code: referralCodeGen,
      referred_by:   referralCode ? parseInt(String(referralCode), 10) : null,
      reg_ip:        regIp || null,
    }).select().single();

    if (userError || !newUser) throw userError || new Error('Failed to create user');

    // Welcome balance
    await db.from('balances').insert({ user_id: newUser.id, points: 200 });
    await db.from('transactions').insert({ user_id: newUser.id, type: 'bonus', points: 200, description: '🎉 Welcome bonus' });

    await sendTg(telegramUser.id,
      `🎉 <b>Welcome to ADS REWARDS!</b>\n\nYou received <b>200 ADR</b> as a welcome bonus!\n\n👥 Invite friends to earn <b>$0.015 per verified referral</b> + lifetime commissions!`,
      { reply_markup: MINI_APP_BTN }
    );

    // Referral — stored as UNVERIFIED; reward paid only after first real activity
    if (referrerId) {
      const displayName = telegramUser.username || telegramUser.first_name || 'User';
      await db.from('referrals').insert({ referrer_id: referrerId, referred_id: newUser.id, points_earned: 0, is_verified: false });

      await db.from('notifications').insert({ user_id: referrerId, title: '👥 New Referral Joined!', message: `@${displayName} joined via your link. Reward unlocks after their first verified activity.`, type: 'referral' });

      if (referrerTgId) {
        await sendTg(referrerTgId,
          `👥 <b>New Referral Joined!</b>\n\n@${displayName} signed up using your link! 🎉\n\n💰 Your <b>$0.015 reward (150 ADR)</b> unlocks once they complete their first real activity (watch an ad).\n\n🔗 L1 commission: <b>10% lifetime</b> on their earnings!`,
          { reply_markup: MINI_APP_BTN }
        );
      }

      // Track invite contests
      const now = new Date().toISOString();
      const { data: inviteContests } = await db.from('contests').select('id').eq('contest_type', 'invite').eq('is_active', true).lte('starts_at', now).gte('ends_at', now);
      for (const contest of (inviteContests || [])) {
        const { data: existing } = await db.from('contest_entries').select('id, score').eq('contest_id', contest.id).eq('user_id', referrerId).single();
        if (existing) await db.from('contest_entries').update({ score: existing.score + 1, updated_at: now }).eq('id', existing.id);
        else await db.from('contest_entries').insert({ contest_id: contest.id, user_id: referrerId, score: 1 });
      }
    }

    return ok(res, { user: newUser });
  } catch (e: any) {
    console.error('telegram-auth error:', e);
    return err(res, 'Internal error', 500);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// DAILY REWARD
// ════════════════════════════════════════════════════════════════════════════
app.post('/api/daily-reward', strictLimiter, async (req, res) => {
  const { userId } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);

  const today = new Date().toISOString().split('T')[0];
  const { data: existing } = await db.from('daily_claims').select('id').eq('user_id', uid).eq('claim_date', today).single();
  if (existing) return err(res, 'Already claimed today! Come back tomorrow 🌙');

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const { data: lastClaim } = await db.from('daily_claims').select('day_streak').eq('user_id', uid).eq('claim_date', yesterday).single();
  const streak = lastClaim ? lastClaim.day_streak + 1 : 1;
  const totalPoints = 100 + Math.min(streak * 10, 500);

  await db.from('daily_claims').insert({ user_id: uid, claim_date: today, day_streak: streak, points_earned: totalPoints });
  await creditPoints(uid, totalPoints, 'daily', `🎁 Daily reward (Day ${streak} streak)`);
  payCommission(uid, totalPoints).catch(() => {});

  const { data: user } = await db.from('users').select('telegram_id').eq('id', uid).single();
  if (user) await sendTg(user.telegram_id, `🎁 <b>Daily Reward!</b>\n\n+${totalPoints} points\n🔥 Streak: Day ${streak}`, { reply_markup: MINI_APP_BTN });

  return ok(res, { points: totalPoints, streak });
});

// ════════════════════════════════════════════════════════════════════════════
// DAILY DROP (streak calendar)
// ════════════════════════════════════════════════════════════════════════════
const DAILY_DROP = [100, 120, 130, 140, 150, 160, 170];

app.post('/api/daily-drop', strictLimiter, async (req, res) => {
  const { userId } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);

  const today = new Date().toISOString().split('T')[0];

  // Check already claimed today
  const { data: todayClaim } = await db.from('daily_claims').select('id').eq('user_id', uid).eq('claim_date', today).maybeSingle();
  if (todayClaim) return err(res, 'Already claimed today');

  // Get streak
  const { data: claims } = await db.from('daily_claims').select('claim_date').eq('user_id', uid).order('claim_date', { ascending: false }).limit(8);
  let streak = 0;
  const now = new Date(); now.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < (claims || []).length; i++) {
    const claimDate = new Date((claims![i] as any).claim_date);
    const expected = new Date(now); expected.setUTCDate(now.getUTCDate() - (i + 1));
    if (claimDate.toISOString().split('T')[0] === expected.toISOString().split('T')[0]) streak++;
    else break;
  }

  const dayIndex = streak % 7;
  const reward = DAILY_DROP[dayIndex];

  const { error: claimError } = await db.from('daily_claims').insert({ user_id: uid, claim_date: today, day_streak: streak + 1, points_earned: reward });
  if (claimError) return err(res, 'Already claimed');

  await creditPoints(uid, reward, 'daily_drop', `🎁 Daily Drop Day ${dayIndex + 1}: +${reward} pts`);
  payCommission(uid, reward).catch(() => {});

  return ok(res, { points: reward, streak: streak + 1, dayIndex });
});

// ════════════════════════════════════════════════════════════════════════════
// SPIN WHEEL — server picks outcome, not client
// ════════════════════════════════════════════════════════════════════════════
const SPIN_PRIZES = [
  { type: 'points', points: 50  },
  { type: 'points', points: 100 },
  { type: 'points', points: 40  },
  { type: 'points', points: 200 },
  { type: 'points', points: 500 },
  { type: 'empty',  points: 0   },
  { type: 'points', points: 300 },
  { type: 'empty',  points: 0   },
];
const SPIN_WEIGHTS = [0.30, 0.25, 0.15, 0.08, 0.02, 0.07, 0.06, 0.07];

function selectSpinPrize() {
  const rand = Math.random();
  let cum = 0;
  for (let i = 0; i < SPIN_PRIZES.length; i++) {
    cum += SPIN_WEIGHTS[i];
    if (rand <= cum) return { ...SPIN_PRIZES[i], index: i };
  }
  return { ...SPIN_PRIZES[0], index: 0 };
}

const SPIN_COOLDOWN_HOURS = 4;
const MAX_SPINS_PER_WINDOW = 3;

app.post('/api/spin-wheel', strictLimiter, async (req, res) => {
  const { userId } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);

  const cutoff = new Date(Date.now() - SPIN_COOLDOWN_HOURS * 3_600_000).toISOString();
  const { count } = await db.from('spin_results').select('id', { count: 'exact', head: true }).eq('user_id', uid).gte('spun_at', cutoff);
  if ((count || 0) >= MAX_SPINS_PER_WINDOW) return err(res, `Daily spin limit reached! Come back in ${SPIN_COOLDOWN_HOURS} hours.`);

  const prize = selectSpinPrize();

  await db.from('spin_results').insert({ user_id: uid, result_type: prize.type, points_earned: prize.points, stars_earned: 0 });

  if (prize.type !== 'empty' && prize.points > 0) {
    await creditPoints(uid, prize.points, 'spin', `🎡 Spin: ${prize.points} points won!`);
    payCommission(uid, prize.points).catch(() => {});
    if (prize.points >= 200) {
      const { data: user } = await db.from('users').select('telegram_id').eq('id', uid).single();
      if (user) await sendTg(user.telegram_id, `🎡 <b>Spin Win!</b>\n\nYou won <b>${prize.points} points</b>! 🎉`, { reply_markup: MINI_APP_BTN });
    }
  }

  const remaining = MAX_SPINS_PER_WINDOW - ((count || 0) + 1);
  return ok(res, { result: prize.type, points: prize.points, stars: 0, index: prize.index, spinsLeft: remaining });
});

// Get spin count
app.post('/api/spin-count', async (req, res) => {
  const { userId } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);

  const cutoff = new Date(Date.now() - SPIN_COOLDOWN_HOURS * 3_600_000).toISOString();
  const { data } = await db.from('spin_results').select('spun_at').eq('user_id', uid).gte('spun_at', cutoff).order('spun_at', { ascending: false });
  return ok(res, { spins: data || [], cooldownHours: SPIN_COOLDOWN_HOURS, maxSpins: MAX_SPINS_PER_WINDOW });
});

// ════════════════════════════════════════════════════════════════════════════
// COMPLETE TASK
// ════════════════════════════════════════════════════════════════════════════
async function verifyTgMembership(chatId: string, telegramId: number): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) return true;
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${chatId}&user_id=${telegramId}`;
    const res = await fetch(url);
    const data = await res.json() as any;
    return data.ok && ['member', 'administrator', 'creator'].includes(data.result?.status);
  } catch { return false; }
}

app.post('/api/complete-task', strictLimiter, async (req, res) => {
  const { userId, taskId } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid || !isUUID(taskId)) return err(res, 'Invalid request', 400);

  const { data: task } = await db.from('tasks').select('*').eq('id', taskId).eq('is_active', true).single();
  if (!task) return err(res, 'Task not found or inactive');

  // Check completion
  if (!task.is_repeatable) {
    const { data: existing } = await db.from('user_tasks').select('id').eq('user_id', uid).eq('task_id', taskId).single();
    if (existing) return err(res, 'Task already completed!');
  } else {
    const { data: last } = await db.from('user_tasks').select('next_available_at').eq('user_id', uid).eq('task_id', taskId).order('completed_at', { ascending: false }).limit(1).single();
    if (last?.next_available_at && new Date(last.next_available_at) > new Date()) return err(res, 'Task cooldown not finished yet');
  }

  // Verify TG membership
  if (task.task_type === 'social' && task.link?.includes('t.me/')) {
    const { data: userData } = await db.from('users').select('telegram_id').eq('id', uid).single();
    if (userData) {
      const match = task.link.match(/t\.me\/([a-zA-Z0-9_]+)/);
      if (match) {
        const isMember = await verifyTgMembership(`@${match[1]}`, userData.telegram_id);
        if (!isMember) return err(res, 'Please join the channel/group first, then try again!');
      }
    }
  }

  const points = task.reward_points;
  const nextAvailable = task.is_repeatable ? new Date(Date.now() + (task.repeat_hours || 24) * 3_600_000).toISOString() : null;

  await db.from('user_tasks').insert({ user_id: uid, task_id: taskId, points_earned: points, next_available_at: nextAvailable });
  await creditPoints(uid, points, 'task_complete', `✅ Task: ${task.title}`);
  payCommission(uid, points).catch(() => {});

  const { data: user } = await db.from('users').select('telegram_id').eq('id', uid).single();
  if (user) await sendTg(user.telegram_id, `✅ <b>Task Completed!</b>\n\n${task.title}\n+${points} points earned! 🎉`, { reply_markup: MINI_APP_BTN });

  return ok(res, { points });
});

// ════════════════════════════════════════════════════════════════════════════
// LOG AD WATCH — rate-limited, server tracks count
// ════════════════════════════════════════════════════════════════════════════
const AD_REWARD_PTS = 50;
const AD_MAX_PER_DAY = 20;

app.post('/api/log-ad', strictLimiter, async (req, res) => {
  const { userId, adType } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid || typeof adType !== 'string') return err(res, 'Invalid request', 400);

  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
  const { count } = await db.from('ad_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('ad_type', 'ad_watch').gte('created_at', startOfDay.toISOString());
  if ((count || 0) >= AD_MAX_PER_DAY) return err(res, 'Daily ad limit reached');

  await db.from('ad_logs').insert({ user_id: uid, ad_type: adType.slice(0, 64), reward_given: AD_REWARD_PTS, provider: 'adsgram' });
  await creditPoints(uid, AD_REWARD_PTS, 'ad_watch', `🎬 Ad Watch: +${AD_REWARD_PTS} pts`);

  // Pay referral commissions
  payCommission(uid, AD_REWARD_PTS).catch(() => {});

  // Referral verification — triggered by first ad watch
  const { data: userForVerify } = await db.from('users').select('reg_ip, username, first_name').eq('id', uid).single();
  if (userForVerify) {
    const userIp  = userForVerify.reg_ip || '';
    const userName = userForVerify.username || userForVerify.first_name || 'User';
    verifyReferral(uid, userIp, userName).catch(() => {});
  }

  // Track ads_watch contests
  const now = new Date().toISOString();
  const { data: activeContests } = await db.from('contests').select('id').eq('contest_type', 'ads_watch').eq('is_active', true).lte('starts_at', now).gte('ends_at', now);
  for (const contest of (activeContests || [])) {
    const { data: existing } = await db.from('contest_entries').select('id, score').eq('contest_id', contest.id).eq('user_id', uid).single();
    if (existing) await db.from('contest_entries').update({ score: existing.score + 1, updated_at: now }).eq('id', existing.id);
    else await db.from('contest_entries').insert({ contest_id: contest.id, user_id: uid, score: 1 });
  }

  const newCount = (count || 0) + 1;
  return ok(res, { points: AD_REWARD_PTS, adsToday: newCount, remaining: AD_MAX_PER_DAY - newCount });
});

// Get today's ad count
app.post('/api/ad-count', async (req, res) => {
  const { userId } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);
  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
  const { count } = await db.from('ad_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('ad_type', 'ad_watch').gte('created_at', startOfDay.toISOString());
  return ok(res, { adsToday: count || 0, maxPerDay: AD_MAX_PER_DAY });
});

// ════════════════════════════════════════════════════════════════════════════
// TAP EARN — batched, server-side reward
// ════════════════════════════════════════════════════════════════════════════
const TAP_MAX_BATCH    = 50;   // max taps per API call
const TAP_DAILY_LIMIT  = 2000; // max tap_earn points per 24 h

app.post('/api/tap', strictLimiter, async (req, res) => {
  const { userId, taps, x2 } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);

  const tapCount = parseInt(String(taps), 10);
  if (!tapCount || tapCount < 1 || tapCount > TAP_MAX_BATCH) return err(res, 'Invalid tap count', 400);

  // Daily limit check
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await db
    .from('transactions')
    .select('points')
    .eq('user_id', uid)
    .eq('type', 'tap_earn')
    .gte('created_at', cutoff);
  const todayPts = (recent || []).reduce((s: number, t: any) => s + (t.points || 0), 0);
  if (todayPts >= TAP_DAILY_LIMIT) return err(res, 'Daily tap limit reached');

  const pts = tapCount * (x2 ? 2 : 1);
  const capped = Math.min(pts, TAP_DAILY_LIMIT - todayPts);
  if (capped <= 0) return err(res, 'Daily tap limit reached');

  await creditPoints(uid, capped, 'tap_earn', `👆 Tap${x2 ? ' (2x)' : ''}: +${capped} pts`);
  payCommission(uid, capped).catch(() => {});
  return ok(res, { points: capped });
});

// ════════════════════════════════════════════════════════════════════════════
// FARM CLAIM — server validates timing
// ════════════════════════════════════════════════════════════════════════════
const FARM_DURATION_MS = 15 * 60 * 1000;
const FARM_REWARD_PTS  = 100;

app.post('/api/farm-claim', strictLimiter, async (req, res) => {
  const { userId, farmStartedAt } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);
  if (typeof farmStartedAt !== 'number') return err(res, 'Invalid farm time', 400);

  const elapsed = Date.now() - farmStartedAt;
  if (elapsed < FARM_DURATION_MS) return err(res, `Farm not ready yet. ${Math.ceil((FARM_DURATION_MS - elapsed) / 60000)} min remaining.`);

  // Prevent multiple claims: check if they already claimed a farm recently
  const recentCutoff = new Date(Date.now() - FARM_DURATION_MS).toISOString();
  const { count } = await db.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('type', 'farm_claim').gte('created_at', recentCutoff);
  if ((count || 0) > 0) return err(res, 'Farm already claimed recently');

  await creditPoints(uid, FARM_REWARD_PTS, 'farm_claim', `🌾 Farm: +${FARM_REWARD_PTS} pts`);
  payCommission(uid, FARM_REWARD_PTS).catch(() => {});
  return ok(res, { points: FARM_REWARD_PTS });
});

// ════════════════════════════════════════════════════════════════════════════
// GAME RESULTS — server validates outcome & credits
// ════════════════════════════════════════════════════════════════════════════
const GAME_DAILY_LIMITS: Record<string, number> = {
  card_flip:    10,
  dice_roll:    10,
  number_guess: 10,
  lucky_box:    5,
  tower_climb:  20,
};

async function checkGameLimit(uid: string, gameType: string): Promise<boolean> {
  const limit = GAME_DAILY_LIMITS[gameType];
  if (!limit) return false;
  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
  const table = gameType === 'tower_climb' ? 'tower_runs' : 'transactions';
  const field  = gameType === 'tower_climb' ? 'created_at' : 'created_at';
  const filter = gameType === 'tower_climb'
    ? db.from(table).select('id', { count: 'exact', head: true }).eq('user_id', uid).gte(field, startOfDay.toISOString())
    : db.from(table).select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('type', gameType).gte(field, startOfDay.toISOString());
  const { count } = await filter;
  return (count || 0) >= limit;
}

// Card Flip
app.post('/api/game/card-flip', strictLimiter, async (req, res) => {
  const { userId } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);
  if (await checkGameLimit(uid, 'card_flip')) return err(res, 'Daily game limit reached');

  const SYMBOLS = ['🎯','⭐','💎','🔥','🎪','🚀','👑','🌟'];
  const cards = Array.from({ length: 3 }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
  const unique = new Set(cards).size;

  let pts: number;
  let matchType: string;
  if (unique === 1)      { pts = 100; matchType = 'triple'; }
  else if (unique === 2) { pts = 50;  matchType = 'pair';   }
  else                   { pts = 10 + Math.floor(Math.random() * 15); matchType = 'none'; }

  await creditPoints(uid, pts, 'card_flip', `🃏 Card Flip: ${matchType === 'triple' ? 'Triple Match' : matchType === 'pair' ? 'Pair' : 'No Match'} +${pts} pts`);
  return ok(res, { cards, pts, matchType });
});

// Dice Roll
app.post('/api/game/dice-roll', strictLimiter, async (req, res) => {
  const { userId } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);
  if (await checkGameLimit(uid, 'dice_roll')) return err(res, 'Daily game limit reached');

  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const total = d1 + d2;

  let pts: number;
  if (total === 12)      pts = 100;
  else if (total >= 10)  pts = 60;
  else if (total >= 8)   pts = 40;
  else if (total >= 6)   pts = 20;
  else                   pts = 10;

  await creditPoints(uid, pts, 'dice_roll', `🎲 Dice Roll: ${d1}+${d2}=${total} → +${pts} pts`);
  return ok(res, { d1, d2, total, pts });
});

// Number Guess
const NG_TIERS = [
  { range: 1, pts: 100, label: 'Exact Hit!' },
  { range: 2, pts: 60,  label: 'Very Close!' },
  { range: 4, pts: 30,  label: 'Close!' },
  { range: 7, pts: 15,  label: 'Near' },
];

app.post('/api/game/number-guess', strictLimiter, async (req, res) => {
  const { userId, guess } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);
  if (typeof guess !== 'number' || guess < 1 || guess > 10 || !Number.isInteger(guess)) return err(res, 'Invalid guess', 400);
  if (await checkGameLimit(uid, 'number_guess')) return err(res, 'Daily game limit reached');

  const secret = Math.floor(Math.random() * 10) + 1;
  const diff = Math.abs(guess - secret);
  const tier = NG_TIERS.find(t => diff <= t.range) || { pts: 5, label: 'Too far' };

  await creditPoints(uid, tier.pts, 'number_guess', `🎯 Number Guess: guessed ${guess}, was ${secret} → +${tier.pts} pts`);
  return ok(res, { guess, secret, diff, pts: tier.pts, label: tier.label });
});

// Lucky Box
const LUCKY_BOX_PRIZES = [
  { points: 0,   label: 'Empty',       emoji: '💨', tier: 'empty',   prob: 0.30 },
  { points: 10,  label: '+10 Points',  emoji: '🪙', tier: 'small',   prob: 0.25 },
  { points: 25,  label: '+25 Points',  emoji: '✨', tier: 'small',   prob: 0.20 },
  { points: 50,  label: '+50 Points',  emoji: '🔥', tier: 'medium',  prob: 0.14 },
  { points: 100, label: '+100 Points', emoji: '💰', tier: 'big',     prob: 0.05 },
  { points: 200, label: '+200 Points', emoji: '💎', tier: 'big',     prob: 0.03 },
  { points: 300, label: '+300 Points', emoji: '👑', tier: 'big',     prob: 0.02 },
  { points: 500, label: '+500 Points!',emoji: '🏆', tier: 'jackpot', prob: 0.01 },
];

app.post('/api/game/lucky-box', strictLimiter, async (req, res) => {
  const { userId } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);
  if (await checkGameLimit(uid, 'lucky_box')) return err(res, 'Daily game limit reached');

  const rand = Math.random();
  let cum = 0;
  let prize = LUCKY_BOX_PRIZES[0];
  for (const p of LUCKY_BOX_PRIZES) { cum += p.prob; if (rand <= cum) { prize = p; break; } }

  if (prize.points > 0) {
    await creditPoints(uid, prize.points, 'lucky_box', `🎁 Lucky Box: ${prize.label}`);
  } else {
    await db.from('transactions').insert({ user_id: uid, type: 'lucky_box', points: 0, description: '🎁 Lucky Box: Empty' });
  }
  return ok(res, prize);
});

// Tower Climb
const TOWER_MAX_FLOORS = 50;
const TOWER_PTS_PER_FLOOR = 3;

app.post('/api/game/tower-climb', strictLimiter, async (req, res) => {
  const { userId, floorsReached, revivesUsed } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);

  // Server-side sanity check
  const floors = Math.min(Math.max(0, Math.floor(Number(floorsReached) || 0)), TOWER_MAX_FLOORS);
  const revives = Math.min(Math.max(0, Math.floor(Number(revivesUsed) || 0)), 3);

  if (await checkGameLimit(uid, 'tower_climb')) return err(res, 'Daily game limit reached');

  const pts = Math.floor(floors * TOWER_PTS_PER_FLOOR);

  await db.from('tower_runs').insert({ user_id: uid, floors_reached: floors, points_earned: pts, revives_used: revives, shields_used: 0 });

  const { data: existing } = await db.from('tower_leaderboard').select('id, best_floor, total_runs, total_floors').eq('user_id', uid).maybeSingle();
  if (existing) {
    await db.from('tower_leaderboard').update({ best_floor: Math.max(existing.best_floor, floors), total_runs: existing.total_runs + 1, total_floors: existing.total_floors + floors, updated_at: new Date().toISOString() }).eq('id', existing.id);
  } else {
    await db.from('tower_leaderboard').insert({ user_id: uid, best_floor: floors, total_floors: floors, total_runs: 1 });
  }

  if (pts > 0) await creditPoints(uid, pts, 'tower_climb', `🏗️ Tower Climb: ${floors} floors → +${pts} pts`);

  return ok(res, { floors, pts });
});

// ════════════════════════════════════════════════════════════════════════════
// WITHDRAWAL
// ════════════════════════════════════════════════════════════════════════════
const TON_TIERS: Record<number, number> = { 5000: 0.05, 10000: 0.1, 15000: 0.15, 20000: 0.2 };
const UPI_RATE = 0.0012;

app.post('/api/withdraw', strictLimiter, async (req, res) => {
  const { userId, method, points, walletAddress } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);
  if (!method || !['ton', 'upi'].includes(method)) return err(res, 'Invalid method');
  if (!points || typeof points !== 'number' || points <= 0 || !Number.isInteger(points)) return err(res, 'Invalid points');
  if (typeof walletAddress !== 'string' || !walletAddress.trim()) return err(res, 'Wallet/UPI required');

  if (method === 'ton' && !/^UQ[A-Za-z0-9_-]{46,}$/.test(walletAddress.trim())) return err(res, 'Invalid TON wallet address');
  if (method === 'upi' && !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(walletAddress.trim())) return err(res, 'Invalid UPI ID format');

  const { data: settings } = await db.from('settings').select('key, value');
  const s: Record<string, string> = {};
  (settings || []).forEach((x: any) => { s[x.key] = x.value; });
  const minPoints  = parseInt(s.min_withdrawal_points || '5000', 10);
  const maxPending = parseInt(s.max_pending_withdrawals || '2', 10);
  const maxDaily   = parseInt(s.max_daily_withdrawals || '3', 10);

  if (points < minPoints) return err(res, `Minimum withdrawal is ${minPoints.toLocaleString()} points`);

  // Compute amount server-side
  let amount: number;
  let amountStr: string;
  if (method === 'upi') {
    amount = parseFloat((points * UPI_RATE).toFixed(2));
    amountStr = `₹${amount} INR`;
  } else {
    const ton = TON_TIERS[points];
    if (!ton) return err(res, `Invalid TON tier. Valid: ${Object.keys(TON_TIERS).join(', ')} pts`);
    amount = ton; amountStr = `${amount.toFixed(2)} TON`;
  }

  const bal = await getBalance(uid);
  if (!bal || bal.points < points) return err(res, `Insufficient balance. You have ${(bal?.points || 0).toLocaleString()} pts`);

  const { count: pendingCount } = await db.from('withdrawals').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'pending');
  if ((pendingCount || 0) >= maxPending) return err(res, 'Too many pending withdrawals. Wait for them to be processed.');

  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
  const { count: todayCount } = await db.from('withdrawals').select('id', { count: 'exact', head: true }).eq('user_id', uid).gte('created_at', startOfDay.toISOString());
  if ((todayCount || 0) >= maxDaily) return err(res, 'Daily withdrawal limit reached. Try again tomorrow.');

  await db.from('withdrawals').insert({ user_id: uid, method, points_spent: points, amount, wallet_address: walletAddress.trim(), status: 'pending' });
  await db.from('balances').update({ points: bal.points - points, total_withdrawn: (bal as any).total_withdrawn + points }).eq('user_id', uid);
  await db.from('transactions').insert({ user_id: uid, type: 'spend', points: -points, description: `💸 Withdrawal: ${amountStr} via ${method.toUpperCase()}` });
  await db.from('notifications').insert({ user_id: uid, title: '💸 Withdrawal Submitted', message: `Your withdrawal of ${points.toLocaleString()} pts → ${amountStr} is pending review.`, type: 'withdrawal' });

  const { data: userData } = await db.from('users').select('telegram_id, first_name, username').eq('id', uid).single();
  if (userData) {
    await sendTg(userData.telegram_id, `💸 <b>Withdrawal Submitted</b>\n\nMethod: <b>${method.toUpperCase()}</b>\nAmount: <b>${amountStr}</b>\nPoints: <b>${points.toLocaleString()}</b>`);
    if (ADMIN_TELEGRAM_ID) {
      await sendTg(ADMIN_TELEGRAM_ID, `🔔 <b>New Withdrawal</b>\n\n👤 ${userData.first_name || 'Unknown'} (@${userData.username || 'N/A'})\n💳 ${method.toUpperCase()} · ${amountStr}\n🪙 ${points.toLocaleString()} pts`);
    }
  }

  return ok(res, { message: 'Withdrawal request submitted successfully!' });
});

// ════════════════════════════════════════════════════════════════════════════
// PROMO CLAIM
// ════════════════════════════════════════════════════════════════════════════
app.post('/api/promo/claim', strictLimiter, async (req, res) => {
  const { userId, promoId } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid || !isUUID(promoId)) return err(res, 'Invalid request', 400);

  const { data: promo } = await db.from('promos').select('*').eq('id', promoId).eq('is_active', true).single();
  if (!promo) return err(res, 'Promo not found or inactive');

  // Atomic check+claim via unique constraint
  const { error: claimErr } = await db.from('promo_claims').insert({ promo_id: promoId, user_id: uid });
  if (claimErr) return err(res, 'Already claimed this promo');

  const { data: fresh } = await db.from('promos').select('total_claimed, max_claims').eq('id', promoId).single();
  if (!fresh || fresh.total_claimed >= fresh.max_claims) {
    await db.from('promo_claims').delete().eq('promo_id', promoId).eq('user_id', uid);
    return err(res, 'Promo slots are full');
  }

  await db.from('promos').update({ total_claimed: fresh.total_claimed + 1 }).eq('id', promoId);
  await creditPoints(uid, promo.reward_points, 'promo', `🎁 Promo: ${promo.title}`);
  return ok(res, { points: promo.reward_points });
});

// ════════════════════════════════════════════════════════════════════════════
// ADMIN — protected by session token (from OTP login) or adminTelegramId
// ════════════════════════════════════════════════════════════════════════════
async function requireAdmin(req: express.Request, res: express.Response): Promise<number | null> {
  // Prefer session token check (set after OTP login)
  const token = String(req.body.admin_token || req.headers['x-admin-token'] || '');
  if (token) {
    const session = adminSessions.get(token);
    if (session && Date.now() <= session.expiresAt) return ADMIN_TELEGRAM_ID || 0;
    if (session) adminSessions.delete(token);
    err(res, 'Session expired or invalid', 403); return null;
  }
  // Fallback: raw adminTelegramId (legacy)
  const adminId = parseInt(String(req.body.adminTelegramId || req.query.adminTelegramId), 10);
  if (!adminId || adminId !== ADMIN_TELEGRAM_ID) { err(res, 'Unauthorized', 403); return null; }
  return adminId;
}

app.post('/api/admin/withdrawal', strictLimiter, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const { withdrawalId, status, adminNote } = req.body;
  if (!isUUID(withdrawalId) || !['approved', 'rejected'].includes(status)) return err(res, 'Invalid request', 400);

  const { data: withdrawal } = await db.from('withdrawals').select('user_id, points_spent, amount, method').eq('id', withdrawalId).single();
  if (!withdrawal) return err(res, 'Withdrawal not found');

  await db.from('withdrawals').update({ status, admin_note: adminNote || null, processed_at: new Date().toISOString() }).eq('id', withdrawalId);

  if (status === 'rejected') {
    const bal = await getBalance(withdrawal.user_id);
    if (bal) {
      await db.from('balances').update({ points: bal.points + withdrawal.points_spent, total_withdrawn: Math.max(0, (bal as any).total_withdrawn - withdrawal.points_spent) }).eq('user_id', withdrawal.user_id);
      await db.from('transactions').insert({ user_id: withdrawal.user_id, type: 'refund', points: withdrawal.points_spent, description: `🔄 Withdrawal rejected — ${withdrawal.points_spent.toLocaleString()} pts refunded` });
    }
  }

  const msg = status === 'approved'
    ? `✅ Your withdrawal of ${Number(withdrawal.amount).toFixed(2)} ${withdrawal.method.toUpperCase()} has been approved!`
    : `❌ Your withdrawal was rejected.${adminNote ? ` Reason: ${adminNote}` : ''} Points refunded.`;
  await db.from('notifications').insert({ user_id: withdrawal.user_id, title: status === 'approved' ? '✅ Withdrawal Approved!' : '❌ Withdrawal Rejected', message: msg, type: 'withdrawal' });

  const { data: userData } = await db.from('users').select('telegram_id').eq('id', withdrawal.user_id).single();
  if (userData) await sendTg(userData.telegram_id, msg);

  return ok(res, { message: 'Updated' });
});

app.post('/api/admin/adjust-balance', strictLimiter, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const { userId, points, reason } = req.body;
  const uid = isUUID(userId) ? userId : null;
  if (!uid || typeof points !== 'number' || !Number.isInteger(points)) return err(res, 'Invalid request', 400);

  const bal = await getBalance(uid);
  if (!bal) return err(res, 'User not found');
  const newPoints = Math.max(0, bal.points + points);
  await db.from('balances').update({ points: newPoints }).eq('user_id', uid);
  await db.from('transactions').insert({ user_id: uid, type: points > 0 ? 'admin_credit' : 'admin_debit', points, description: `⚙️ Admin adjustment: ${reason || 'No reason'}` });
  return ok(res, { newPoints });
});

app.post('/api/admin/ban-user', strictLimiter, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const { userId, banned } = req.body;
  if (!isUUID(userId)) return err(res, 'Invalid userId', 400);
  await db.from('users').update({ is_banned: !!banned }).eq('id', userId);
  return ok(res);
});

app.post('/api/admin/setting', strictLimiter, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const { key, value } = req.body;
  if (typeof key !== 'string' || typeof value !== 'string') return err(res, 'Invalid request', 400);
  const { data: existing } = await db.from('settings').select('id').eq('key', key).single();
  if (existing) await db.from('settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
  else await db.from('settings').insert({ key, value });
  invalidateSettingsCache();
  return ok(res);
});

app.post('/api/admin/broadcast', strictLimiter, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const { message, adminTelegramId } = req.body;
  if (typeof message !== 'string' || !message.trim()) return err(res, 'No message', 400);

  await db.from('broadcasts').insert({ message, sent_by: adminTelegramId });
  const { data: users } = await db.from('users').select('id').limit(10000);
  if (users && users.length > 0) {
    const notifs = (users as any[]).map(u => ({ user_id: u.id, title: '📢 Announcement', message, type: 'info' }));
    for (let i = 0; i < notifs.length; i += 100) await db.from('notifications').insert(notifs.slice(i, i + 100));
  }
  return ok(res, { sent: users?.length || 0 });
});

app.post('/api/admin/end-contest', strictLimiter, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const { contestId } = req.body;
  if (!isUUID(contestId)) return err(res, 'Invalid contestId', 400);

  const { data: contest } = await db.from('contests').select('*').eq('id', contestId).single();
  if (!contest) return err(res, 'Contest not found');
  if (contest.rewards_distributed) return err(res, 'Rewards already distributed');

  const { data: entries } = await db.from('contest_entries').select('user_id, score').eq('contest_id', contestId).order('score', { ascending: false }).limit(5);
  if (!entries || entries.length === 0) return err(res, 'No entries found');

  const rewards = [contest.reward_1st, contest.reward_2nd, contest.reward_3rd, contest.reward_4th, contest.reward_5th];
  const medals = ['🥇', '🥈', '🥉', '4th', '5th'];

  for (let i = 0; i < entries.length; i++) {
    const reward = rewards[i] || 0;
    if (reward <= 0) continue;
    const entry = entries[i] as any;
    await creditPoints(entry.user_id, reward, 'contest_reward', `🏆 ${medals[i]} Contest "${contest.title}" reward!`);
    await db.from('notifications').insert({ user_id: entry.user_id, title: '🏆 Contest Winner!', message: `You placed ${medals[i]} in "${contest.title}" and won ${reward.toLocaleString()} points!`, type: 'reward' });
    const { data: u } = await db.from('users').select('telegram_id').eq('id', entry.user_id).single();
    if (u) await sendTg((u as any).telegram_id, `🏆 <b>Contest Winner!</b>\n\nYou placed <b>${medals[i]}</b> in "${contest.title}"!\n+${reward.toLocaleString()} points! 🎉`);
  }

  await db.from('contests').update({ rewards_distributed: true, is_active: false }).eq('id', contestId);
  return ok(res, { distributed: entries.length });
});

// ════════════════════════════════════════════════════════════════════════════
// Admin OTP Login
// ════════════════════════════════════════════════════════════════════════════
const otpStore   = new Map<number, { otp: string; expiresAt: number }>();
const adminSessions = new Map<string, { expiresAt: number }>();

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

app.post('/api/admin/request-otp', strictLimiter, async (req, res) => {
  const telegramId = parseInt(req.body?.telegramId || '0');
  if (!ADMIN_TELEGRAM_ID || telegramId !== ADMIN_TELEGRAM_ID) {
    return fail(res, 'Unauthorized', 403);
  }
  const otp = generateOTP();
  otpStore.set(ADMIN_TELEGRAM_ID, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });
  await sendTg(
    ADMIN_TELEGRAM_ID,
    `🔐 <b>Admin Login OTP</b>\n\nYour one-time code:\n<code>${otp}</code>\n\n⏱ Expires in <b>5 minutes</b>.\n⚠️ Never share this code with anyone.`
  );
  return ok(res, { sent: true });
});

app.post('/api/admin/verify-otp', strictLimiter, async (req, res) => {
  const telegramId = parseInt(req.body?.telegramId || '0');
  const otp = String(req.body?.otp || '');
  if (!ADMIN_TELEGRAM_ID || telegramId !== ADMIN_TELEGRAM_ID) {
    return fail(res, 'Unauthorized', 403);
  }
  const stored = otpStore.get(ADMIN_TELEGRAM_ID);
  if (!stored || stored.otp !== otp || Date.now() > stored.expiresAt) {
    return fail(res, 'Invalid or expired OTP', 401);
  }
  otpStore.delete(ADMIN_TELEGRAM_ID);
  const token = crypto.randomUUID();
  adminSessions.set(token, { expiresAt: Date.now() + 4 * 60 * 60 * 1000 });
  return ok(res, { token });
});

app.post('/api/admin/verify-session', async (req, res) => {
  const token = String(req.body?.token || '');
  const session = adminSessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    adminSessions.delete(token);
    return fail(res, 'Session expired', 401);
  }
  return ok(res, { valid: true });
});

// ════════════════════════════════════════════════════════════════════════════
// BOT WEBHOOK — all bot commands + PVP games
// ════════════════════════════════════════════════════════════════════════════
const PVP_EMOJIS: Record<string, string> = {
  dice: '🎲', dart: '🎯', football: '⚽', bowling: '🎳',
};
const PVP_NAMES: Record<string, string> = {
  dice: 'DICE', dart: 'DART', football: 'FOOTBALL', bowling: 'BOWLING',
};

function uName(u: any): string {
  return u?.first_name || u?.username || 'Unknown';
}

app.post('/api/bot/webhook', async (req, res) => {
  res.sendStatus(200); // Always respond 200 immediately
  const update = req.body;
  try {
    if (update.message) await handleBotMessage(update.message);
  } catch (e) { console.error('Bot webhook error:', e); }
});

async function getBotUser(telegramId: number) {
  const { data } = await db.from('users').select('*, balances(*)').eq('telegram_id', telegramId).single();
  return data as any;
}

// ── Settings cache — one Supabase round-trip per minute, not per call ──────
let settingsCache: Record<string, string> = {};
let settingsCacheAt = 0;
const SETTINGS_TTL = 60_000; // 1 minute

async function loadSettingsCache() {
  const { data } = await db.from('settings').select('key, value');
  if (data) {
    settingsCache = {};
    for (const row of data as any[]) settingsCache[row.key] = row.value;
  }
  settingsCacheAt = Date.now();
}

// Pre-warm on startup
loadSettingsCache().catch(() => {});

async function getSetting(key: string, def: string): Promise<string> {
  if (Date.now() - settingsCacheAt > SETTINGS_TTL) await loadSettingsCache();
  return settingsCache[key] ?? def;
}

function getSettingSync(key: string, def: string): string {
  return settingsCache[key] ?? def;
}

// Invalidate cache after admin changes a setting
function invalidateSettingsCache() { settingsCacheAt = 0; }

async function handleBotMessage(msg: any) {
  const chatId: number = msg.chat.id;
  const fromId: number = msg.from?.id;
  const text: string = (msg.text || '').trim();
  if (!text.startsWith('/')) return;

  // Ensure settings in memory (single call if stale, no-op if fresh)
  if (Date.now() - settingsCacheAt > SETTINGS_TTL) loadSettingsCache().catch(() => {});

  // Parallel: fetch user + their balance in one query
  const user = fromId ? await getBotUser(fromId) : null;
  const balance = (user?.balances as any[])?.[0] || { points: 0 };

  // /start — welcome
  if (text.startsWith('/start')) {
    const refCode = text.split(' ')[1] || '';
    const miniAppUrl = `https://t.me/Adsrewartsbot/app${refCode ? `?startapp=${refCode}` : ''}`;
    return sendTg(chatId,
      `🚀 <b>Welcome to ADS REWARDS!</b>\n\n` +
      `Watch ads, complete tasks, and earn ADR points.\n` +
      `👥 Invite friends to earn <b>$0.015 per verified referral</b> + lifetime commissions!\n\n` +
      (user ? `💰 Your balance: <b>${balance.points.toLocaleString()} ADR</b>` : `👉 Open the Mini App to get started!`) +
      `\n\n📋 Commands: /balance /beg /claim /farm /leaderboard`,
      { reply_markup: { inline_keyboard: [[{ text: '🎮 Open Mini App', web_app: { url: miniAppUrl } }]] } }
    );
  }

  // /balance — show ADR balance
  if (text.startsWith('/balance')) {
    if (!user) return sendTg(chatId, '❌ Not registered. Open the Mini App first!', { reply_markup: MINI_APP_BTN });
    return sendTg(chatId,
      `💰 <b>Your ADR Balance</b>\n\n` +
      `🪙 Points: <b>${balance.points.toLocaleString()} ADR</b>\n` +
      `📈 Total Earned: <b>${(user.total_points || 0).toLocaleString()} ADR</b>\n` +
      `🏆 Level: <b>${user.level || 1}</b>`,
      { reply_markup: MINI_APP_BTN }
    );
  }

  // /farm — show farm status
  if (text.startsWith('/farm')) {
    if (!user) return sendTg(chatId, '❌ Not registered. Open the Mini App first!', { reply_markup: MINI_APP_BTN });
    const farmMs = 15 * 60 * 1000;
    const { data: lastClaim } = await db.from('transactions').select('created_at').eq('user_id', user.id).eq('type', 'farm_claim').order('created_at', { ascending: false }).limit(1).single();
    if (!lastClaim) {
      return sendTg(chatId, `🌾 <b>Farm Status</b>\n\n✅ Ready to farm! Open the app to start.`, { reply_markup: MINI_APP_BTN });
    }
    const elapsed = Date.now() - new Date(lastClaim.created_at).getTime();
    if (elapsed >= farmMs) {
      return sendTg(chatId, `🌾 <b>Farm Status</b>\n\n✅ <b>Farming complete!</b> Claim your reward in the app.`, { reply_markup: MINI_APP_BTN });
    }
    const rem = farmMs - elapsed;
    const mins = Math.floor(rem / 60000);
    const secs = Math.floor((rem % 60000) / 1000);
    return sendTg(chatId, `🌾 <b>Farm Status</b>\n\n⏳ Farming in progress…\n⏱ Time left: <b>${mins}m ${secs}s</b>`, { reply_markup: MINI_APP_BTN });
  }

  // /leaderboard — top earners by lifetime points
  if (text.startsWith('/leaderboard')) {
    const { data: rows } = await db.from('users').select('first_name, total_points').order('total_points', { ascending: false }).limit(10);
    if (!rows || rows.length === 0) return sendTg(chatId, '📊 No data yet.', { reply_markup: MINI_APP_BTN });
    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
    const lines = (rows as any[]).map((r, i) =>
      `${medals[i]} <b>${(r.first_name || 'User').substring(0, 16)}</b> — ${(r.total_points || 0).toLocaleString()} ADR`
    ).join('\n');
    return sendTg(chatId, `🏆 <b>Top Earners Leaderboard</b>\n\n${lines}`, { reply_markup: MINI_APP_BTN });
  }

  // /ricklb — rich list by current balance
  if (text.startsWith('/ricklb')) {
    const { data: rows } = await db.from('balances').select('points, users(first_name)').order('points', { ascending: false }).limit(10);
    if (!rows || rows.length === 0) return sendTg(chatId, '💰 No data yet.', { reply_markup: MINI_APP_BTN });
    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
    const lines = (rows as any[]).map((r, i) =>
      `${medals[i]} <b>${((r.users as any)?.first_name || 'User').substring(0, 16)}</b> — ${(r.points || 0).toLocaleString()} ADR`
    ).join('\n');
    return sendTg(chatId, `💎 <b>Rich List</b>\n\n${lines}`, { reply_markup: MINI_APP_BTN });
  }

  // /invitelb — top inviters by referral count
  if (text.startsWith('/invitelb')) {
    const { data: rows } = await db.from('referrals').select('referrer_id, users!referrals_referrer_id_fkey(first_name)').order('created_at', { ascending: false });
    if (!rows || rows.length === 0) return sendTg(chatId, '👥 No referrals yet.', { reply_markup: MINI_APP_BTN });
    const counts: Record<string, { name: string; count: number }> = {};
    for (const r of rows as any[]) {
      const id = r.referrer_id;
      if (!counts[id]) counts[id] = { name: r.users?.first_name || 'User', count: 0 };
      counts[id].count++;
    }
    const sorted = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 10);
    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
    const lines = sorted.map((s, i) =>
      `${medals[i]} <b>${s.name.substring(0, 16)}</b> — ${s.count} invites`
    ).join('\n');
    return sendTg(chatId, `👥 <b>Invite Leaderboard</b>\n\n${lines}`, { reply_markup: MINI_APP_BTN });
  }

  // /contest — show active contest leaderboard
  if (text.startsWith('/contest')) {
    const { data: contests } = await db.from('contests').select('*').eq('is_active', true).gt('ends_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(3);
    if (!contests || contests.length === 0) {
      return sendTg(chatId, '🏆 No active contest at the moment.\n\nCheck back soon!', { reply_markup: MINI_APP_BTN });
    }
    for (const contest of contests as any[]) {
      const { data: entries } = await db.from('contest_entries').select('user_id, score').eq('contest_id', contest.id).order('score', { ascending: false }).limit(5);
      const userIds = (entries || []).map((e: any) => e.user_id);
      let userMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: users } = await db.from('users').select('id, first_name').in('id', userIds);
        (users || []).forEach((u: any) => { userMap[u.id] = u.first_name || 'User'; });
      }
      const ends = new Date(contest.ends_at);
      const diffMs = ends.getTime() - Date.now();
      const diffH = Math.floor(diffMs / 3600000);
      const diffM = Math.floor((diffMs % 3600000) / 60000);
      const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
      const lb = (entries || []).map((e: any, i: number) =>
        `${medals[i]} ${(userMap[e.user_id] || 'User').substring(0, 16)} — ${(e.score || 0).toLocaleString()} pts`
      ).join('\n') || 'No entries yet';
      await sendTg(chatId,
        `🏆 <b>${contest.title}</b>\n` +
        `⏳ Ends in: <b>${diffH}h ${diffM}m</b>\n\n` +
        `<b>Leaderboard:</b>\n${lb}\n\n` +
        `🎁 Prizes: 1st <b>${contest.reward_1st.toLocaleString()}</b> · 2nd <b>${contest.reward_2nd.toLocaleString()}</b> · 3rd <b>${contest.reward_3rd.toLocaleString()}</b> ADR`
      );
    }
    return;
  }

  // /beg — 50/50 chance at 10-50 ADR (requires @Adsrewartsbot in bio, 12h cooldown)
  if (text.startsWith('/beg')) {
    if (!user) return sendTg(chatId, '❌ Not registered. Open the Mini App first!', { reply_markup: MINI_APP_BTN });

    // Parallel: bio check + cooldown check + read settings all at once
    const cooldownHours = parseInt(getSettingSync('beg_cooldown_hours', '12'), 10);
    const [bio, lastBegResult] = await Promise.all([
      getTgBio(chatId),
      db.from('beg_logs').select('created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (!bio.includes('@Adsrewartsbot')) {
      return sendTg(chatId,
        `🔒 <b>Bio Verification Required</b>\n\nTo use <b>/beg</b> you must have exactly <code>@Adsrewartsbot</code> in your Telegram bio.\n\n` +
        `📝 Steps:\n1. Open your Telegram profile\n2. Edit bio → add <code>@Adsrewartsbot</code>\n3. Save and try again!`,
        { reply_markup: MINI_APP_BTN }
      );
    }

    const lastBeg = lastBegResult.data;
    if (lastBeg && new Date(lastBeg.created_at) > new Date(Date.now() - cooldownHours * 3600000)) {
      const nextMs = new Date(lastBeg.created_at).getTime() + cooldownHours * 3600000;
      const waitM = Math.ceil((nextMs - Date.now()) / 60000);
      return sendTg(chatId, `⏳ <b>Slow down!</b>\n\nYou can /beg again in <b>${waitM} minute${waitM !== 1 ? 's' : ''}</b>.`, { reply_markup: MINI_APP_BTN });
    }

    // 50/50 roll — settings already in memory
    const won = Math.random() < 0.5;
    const minPts = parseInt(getSettingSync('beg_reward_min', '10'), 10);
    const maxPts = parseInt(getSettingSync('beg_reward_max', '50'), 10);
    const prize  = won ? Math.floor(Math.random() * (maxPts - minPts + 1)) + minPts : 0;

    await db.from('beg_logs').insert({ user_id: user.id, won, points_earned: prize });
    if (won) {
      await creditPoints(user.id, prize, 'beg', `🙏 /beg win: +${prize} ADR`);
      return sendTg(chatId,
        `🎉 <b>Luck is on your side!</b>\n\n🙏 You begged and received <b>${prize} ADR</b>!\n\n⏰ Come back in ${cooldownHours}h to beg again.`,
        { reply_markup: MINI_APP_BTN }
      );
    } else {
      return sendTg(chatId,
        `😢 <b>No luck this time…</b>\n\n🙏 You begged but got nothing.\n\n⏰ Try again in ${cooldownHours}h!`,
        { reply_markup: MINI_APP_BTN }
      );
    }
  }

  // /claim — daily drop reward directly in bot (requires @Adsrewartsbot in bio)
  if (text.startsWith('/claim')) {
    if (!user) return sendTg(chatId, '❌ Not registered. Open the Mini App first!', { reply_markup: MINI_APP_BTN });

    // Parallel: bio + existing-claim check
    const today = new Date().toISOString().split('T')[0];
    const [bio, existingResult, claimsResult] = await Promise.all([
      getTgBio(chatId),
      db.from('daily_claims').select('id').eq('user_id', user.id).eq('claim_date', today).maybeSingle(),
      db.from('daily_claims').select('claim_date').eq('user_id', user.id).order('claim_date', { ascending: false }).limit(8),
    ]);

    if (!bio.includes('@Adsrewartsbot')) {
      return sendTg(chatId,
        `🔒 <b>Bio Verification Required</b>\n\nTo use <b>/claim</b> you must have <code>@Adsrewartsbot</code> in your Telegram bio.\n\n` +
        `📝 Add it to your bio and try again!`,
        { reply_markup: MINI_APP_BTN }
      );
    }

    // Use pre-fetched results from parallel Promise.all above
    if (existingResult.data) {
      return sendTg(chatId, `✅ <b>Already claimed today!</b>\n\nCome back tomorrow for your next daily drop. 🌙`, { reply_markup: MINI_APP_BTN });
    }

    // Streak from pre-fetched claims
    const claims = claimsResult.data;
    let streak = 0;
    const now2 = new Date(); now2.setUTCHours(0, 0, 0, 0);
    for (let i = 0; i < (claims || []).length; i++) {
      const cd = new Date((claims![i] as any).claim_date);
      const exp = new Date(now2); exp.setUTCDate(now2.getUTCDate() - (i + 1));
      if (cd.toISOString().split('T')[0] === exp.toISOString().split('T')[0]) streak++;
      else break;
    }
    const DAILY_DROP_BOT = [100, 120, 130, 140, 150, 160, 170];
    const dayIdx = streak % 7;
    const reward = DAILY_DROP_BOT[dayIdx];

    const { error: claimErr } = await db.from('daily_claims').insert({ user_id: user.id, claim_date: today, day_streak: streak + 1, points_earned: reward });
    if (claimErr) return sendTg(chatId, `✅ Already claimed today!`, { reply_markup: MINI_APP_BTN });

    await creditPoints(user.id, reward, 'daily_drop', `🎁 Daily Drop (bot claim) Day ${dayIdx + 1}: +${reward} pts`);
    payCommission(user.id, reward).catch(() => {});

    return sendTg(chatId,
      `🎁 <b>Daily Drop Claimed!</b>\n\n` +
      `💰 +<b>${reward} ADR</b> added to your balance!\n` +
      `🔥 Streak: <b>Day ${streak + 1}</b>\n\n` +
      `📅 Come back tomorrow for Day ${((dayIdx + 1) % 7) + 1}!`,
      { reply_markup: MINI_APP_BTN }
    );
  }

  // /dice, /dart, /football, /bowling — PVP games
  const pvpMatch = text.match(/^\/(dice|dart|football|bowling)\s*(\d+)?/i);
  if (pvpMatch) {
    const game = pvpMatch[1].toLowerCase();
    const rawAmount = parseInt(pvpMatch[2] || '0', 10);
    if (!user) return sendTg(chatId, '❌ Not registered. Open the Mini App first!', { reply_markup: MINI_APP_BTN });
    return handlePvpCommand(chatId, msg, user, balance, game, rawAmount);
  }
}

async function handlePvpCommand(chatId: number, msg: any, user: any, balance: any, game: string, amount: number) {
  const emoji = PVP_EMOJIS[game] || '🎮';
  const gameName = PVP_NAMES[game] || game.toUpperCase();
  // Use sync cache — settings already in memory
  const minBet    = parseInt(getSettingSync('pvp_min_bet', '100'), 10);
  const housePct  = parseFloat(getSettingSync('pvp_house_fee_pct', '3'));
  const timeoutMin = parseInt(getSettingSync('pvp_challenge_timeout_min', '5'), 10);

  if (amount < minBet) {
    return sendTg(chatId, `${emoji} Minimum bet is <b>${minBet} ADR</b>.\nUsage: <code>/${game} ${minBet}</code>`);
  }
  if (balance.points < amount) {
    return sendTg(chatId, `❌ Insufficient balance!\n\nYou have <b>${balance.points.toLocaleString()} ADR</b> but need <b>${amount} ADR</b>.`);
  }

  // Check if there's an open challenge to accept
  const { data: openChallenge } = await db.from('pvp_challenges')
    .select('*')
    .eq('game_type', game)
    .eq('amount', amount)
    .eq('status', 'open')
    .neq('challenger_tg_id', user.telegram_id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (openChallenge) {
    // Accept the challenge!
    const c = openChallenge as any;

    // Deduct from both (reserve funds)
    await db.from('balances').update({ points: balance.points - amount }).eq('user_id', user.id);
    const { data: challengerBal } = await db.from('balances').select('points').eq('user_id', c.challenger_id).single();
    await db.from('balances').update({ points: (challengerBal as any).points - amount }).eq('user_id', c.challenger_id);

    // Mark challenge accepted
    await db.from('pvp_challenges').update({
      acceptor_id: user.id,
      acceptor_name: uName(user),
      acceptor_tg_id: user.telegram_id,
      status: 'playing',
    }).eq('id', c.id);

    // "Roll" both sides
    const r1 = Math.ceil(Math.random() * 6);
    const r2 = Math.ceil(Math.random() * 6);
    const pot = amount * 2;
    const fee = Math.ceil(pot * housePct / 100);
    const winnerPrize = pot - fee;

    let resultText = '';
    let winnerId: string | null = null;
    let winnertgId: number | null = null;
    let loserPts = 0;

    await sendTg(chatId,
      `🤼 <b>Match-up: ${c.challenger_name} vs ${uName(user)}</b>\n\n` +
      `${emoji} ${c.challenger_name}: rolling...\n${emoji} ${uName(user)}: rolling...`
    );

    await new Promise(r => setTimeout(r, 1500));

    if (r1 > r2) {
      winnerId = c.challenger_id;
      winnertgId = c.challenger_tg_id;
      resultText = `🏆 <b>${c.challenger_name} wins ${winnerPrize.toLocaleString()} ADR!</b>\n${emoji} ${c.challenger_name} rolled <b>${r1}</b>  vs  ${uName(user)} rolled <b>${r2}</b>`;
    } else if (r2 > r1) {
      winnerId = user.id;
      winnertgId = user.telegram_id;
      resultText = `🏆 <b>${uName(user)} wins ${winnerPrize.toLocaleString()} ADR!</b>\n${emoji} ${c.challenger_name} rolled <b>${r1}</b>  vs  ${uName(user)} rolled <b>${r2}</b>`;
    } else {
      // Tie — refund both
      resultText = `🤝 <b>It's a tie!</b>\n${emoji} Both rolled <b>${r1}</b>\n💸 Both players get their ADR refunded.`;
      await db.from('balances').update({ points: (challengerBal as any).points }).eq('user_id', c.challenger_id);
      await db.from('balances').update({ points: balance.points }).eq('user_id', user.id);
    }

    if (winnerId) {
      await creditPoints(winnerId, winnerPrize, 'pvp_win', `${emoji} ${gameName} win vs opponent`);
      await db.from('transactions').insert({ user_id: winnerId === user.id ? c.challenger_id : user.id, type: 'pvp_loss', points: -amount, description: `${emoji} ${gameName} loss` });
    }

    await db.from('pvp_challenges').update({
      status: 'completed',
      result: { r1, r2, winner_id: winnerId, winner_prize: winnerPrize, fee },
    }).eq('id', c.id);

    await sendTg(chatId, `${emoji} <b>${gameName}</b>\n\n${resultText}\n\n🏦 House fee: ${fee} ADR`);
    if (winnertgId) await sendTg(winnertgId, `🏆 You won <b>${winnerPrize.toLocaleString()} ADR</b> in ${gameName}!`);
    return;
  }

  // No open challenge — create one
  // Deduct from challenger (reserve)
  await db.from('balances').update({ points: balance.points - amount }).eq('user_id', user.id);

  const expiresAt = new Date(Date.now() + timeoutMin * 60 * 1000).toISOString();
  await db.from('pvp_challenges').insert({
    game_type: game,
    amount,
    challenger_id: user.id,
    challenger_name: uName(user),
    challenger_tg_id: user.telegram_id,
    status: 'open',
    chat_id: chatId,
    expires_at: expiresAt,
  });

  return sendTg(chatId,
    `${emoji} <b>${uName(user)}</b> has challenged <b>${amount} ADR</b>!\n\n` +
    `Anyone can accept with:\n<code>/${game} ${amount}</code>\n\n` +
    `⏳ Challenge expires in <b>${timeoutMin} minutes</b>.`
  );
}

// Register bot webhook + commands on startup
(async () => {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    const deployed = process.env.REPLIT_DEPLOYMENT_ID || process.env.REPLIT_DEV_DOMAIN;
    if (!deployed) return;
    const baseUrl = process.env.REPLIT_DEPLOYMENT_ID
      ? `https://${process.env.REPLIT_SLUG}.replit.app`
      : `https://${process.env.REPLIT_DEV_DOMAIN}`;
    const webhookUrl = `${baseUrl}/api/bot/webhook`;
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message'] }),
    });
    console.log(`✅ Bot webhook set: ${webhookUrl}`);

    // Register bot commands
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'start',       description: '🚀 Start the bot & open mini app' },
          { command: 'balance',     description: '💰 Check your ADR balance' },
          { command: 'beg',         description: '🙏 Beg for ADR (50/50, requires bio)' },
          { command: 'claim',       description: '🎁 Claim daily drop reward (requires bio)' },
          { command: 'farm',        description: '🌾 Check farming status' },
          { command: 'leaderboard', description: '🏆 Top earners leaderboard' },
          { command: 'ricklb',      description: '💎 Rich list by balance' },
          { command: 'invitelb',    description: '👥 Top inviters leaderboard' },
          { command: 'contest',     description: '🎪 Active contest leaderboard' },
          { command: 'dice',        description: '🎲 PVP dice game (e.g. /dice 100)' },
          { command: 'dart',        description: '🎯 PVP darts game' },
          { command: 'football',    description: '⚽ PVP football game' },
          { command: 'bowling',     description: '🎳 PVP bowling game' },
        ],
      }),
    });
    console.log('✅ Bot commands registered');
  } catch (e) { console.warn('Webhook/command setup failed:', e); }
})();

// ════════════════════════════════════════════════════════════════════════════
// Serve frontend in production
// ════════════════════════════════════════════════════════════════════════════
const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));
app.get(/(.*)/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ════════════════════════════════════════════════════════════════════════════
// Start server
// ════════════════════════════════════════════════════════════════════════════
const PORT_PROD = process.env.PORT ? parseInt(process.env.PORT) : PORT;
app.listen(PORT_PROD, '0.0.0.0', () => {
  console.log(`✅ Secure backend running on port ${PORT_PROD}`);
});
