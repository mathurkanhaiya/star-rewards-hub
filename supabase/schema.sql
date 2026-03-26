-- =========================================


-- ENUM
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── USERS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id     bigint UNIQUE NOT NULL,
  first_name      text,
  last_name       text,
  username        text,
  photo_url       text,
  referral_code   text UNIQUE NOT NULL,
  referred_by     bigint,
  is_banned       boolean NOT NULL DEFAULT false,
  level           int NOT NULL DEFAULT 1,
  total_points    int NOT NULL DEFAULT 0,
  last_active_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (true);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (true);

-- ── BALANCES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.balances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  points          int NOT NULL DEFAULT 0,
  stars_balance   numeric NOT NULL DEFAULT 0,
  ton_balance     numeric NOT NULL DEFAULT 0,
  usdt_balance    numeric NOT NULL DEFAULT 0,
  total_earned    int NOT NULL DEFAULT 0,
  total_withdrawn int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "balances_select" ON public.balances FOR SELECT USING (true);

-- ── TRANSACTIONS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type         text NOT NULL,
  points       int NOT NULL DEFAULT 0,
  description  text,
  reference_id uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions_select" ON public.transactions FOR SELECT USING (true);

-- ── TASKS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  description     text,
  task_type       text NOT NULL DEFAULT 'social',
  link            text,
  icon            text,
  reward_points   int NOT NULL DEFAULT 0,
  reward_stars    int NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  is_repeatable   boolean NOT NULL DEFAULT false,
  repeat_hours    int,
  max_completions int,
  display_order   int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT USING (true);

-- ── USER_TASKS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id         uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  points_earned   int NOT NULL DEFAULT 0,
  completed_at    timestamptz NOT NULL DEFAULT now(),
  next_available_at timestamptz
);
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_tasks_select" ON public.user_tasks FOR SELECT USING (true);

-- ── DAILY_CLAIMS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_claims (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  claim_date    date NOT NULL DEFAULT CURRENT_DATE,
  claimed_at    timestamptz NOT NULL DEFAULT now(),
  day_streak    int NOT NULL DEFAULT 1,
  points_earned int NOT NULL DEFAULT 0,
  UNIQUE(user_id, claim_date)
);
ALTER TABLE public.daily_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_claims_select" ON public.daily_claims FOR SELECT USING (true);

-- ── SPIN_RESULTS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.spin_results (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  result_type   text NOT NULL,
  points_earned int NOT NULL DEFAULT 0,
  stars_earned  int NOT NULL DEFAULT 0,
  spun_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.spin_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spin_results_select" ON public.spin_results FOR SELECT USING (true);

-- ── AD_LOGS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ad_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ad_type      text NOT NULL,
  reward_given int NOT NULL DEFAULT 0,
  provider     text NOT NULL DEFAULT 'adsgram',
  ip_address   text,
  device_info  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ad_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad_logs_select" ON public.ad_logs FOR SELECT USING (true);

-- ── REFERRALS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.referrals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_id  uuid UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  points_earned int NOT NULL DEFAULT 0,
  is_verified  boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals_select" ON public.referrals FOR SELECT USING (true);

-- ── WITHDRAWALS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  method         text NOT NULL,
  points_spent   int NOT NULL DEFAULT 0,
  amount         numeric NOT NULL,
  wallet_address text,
  status         text NOT NULL DEFAULT 'pending',
  admin_note     text,
  requested_at   timestamptz NOT NULL DEFAULT now(),
  processed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "withdrawals_select" ON public.withdrawals FOR SELECT USING (true);

-- ── NOTIFICATIONS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  message    text NOT NULL,
  type       text NOT NULL DEFAULT 'info',
  is_read    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (true);

-- ── SETTINGS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text UNIQUE NOT NULL,
  value       text NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select" ON public.settings FOR SELECT USING (true);

-- ── PROMOS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.promos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  reward_points int NOT NULL DEFAULT 0,
  max_claims    int NOT NULL DEFAULT 100,
  total_claimed int NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promos_select" ON public.promos FOR SELECT USING (true);

-- ── PROMO_CLAIMS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.promo_claims (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id   uuid NOT NULL REFERENCES public.promos(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(promo_id, user_id)
);
ALTER TABLE public.promo_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo_claims_select" ON public.promo_claims FOR SELECT USING (true);

-- ── CONTESTS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                text NOT NULL,
  contest_type         text NOT NULL DEFAULT 'points',
  is_active            boolean NOT NULL DEFAULT true,
  starts_at            timestamptz NOT NULL DEFAULT now(),
  ends_at              timestamptz NOT NULL,
  reward_1st           int NOT NULL DEFAULT 0,
  reward_2nd           int NOT NULL DEFAULT 0,
  reward_3rd           int NOT NULL DEFAULT 0,
  reward_4th           int NOT NULL DEFAULT 0,
  reward_5th           int NOT NULL DEFAULT 0,
  rewards_distributed  boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contests_select" ON public.contests FOR SELECT USING (true);

-- ── CONTEST_ENTRIES ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.contest_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id  uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score       int NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contest_id, user_id)
);
ALTER TABLE public.contest_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contest_entries_select" ON public.contest_entries FOR SELECT USING (true);

-- ── BROADCASTS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message  text NOT NULL,
  sent_by  bigint NOT NULL,
  target   text NOT NULL DEFAULT 'all',
  sent_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "broadcasts_select" ON public.broadcasts FOR SELECT USING (true);

-- ── ADMIN_LOGS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_telegram_id bigint NOT NULL,
  action            text NOT NULL,
  target_user_id    uuid,
  details           jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_logs_select" ON public.admin_logs FOR SELECT USING (true);

-- ── TOWER_LEADERBOARD ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.tower_leaderboard (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  best_floor   int NOT NULL DEFAULT 0,
  total_floors int NOT NULL DEFAULT 0,
  total_runs   int NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tower_leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tower_leaderboard_select" ON public.tower_leaderboard FOR SELECT USING (true);

-- ── TOWER_RUNS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tower_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  floors_reached int NOT NULL DEFAULT 0,
  points_earned  int NOT NULL DEFAULT 0,
  revives_used   int NOT NULL DEFAULT 0,
  shields_used   int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tower_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tower_runs_select" ON public.tower_runs FOR SELECT USING (true);

-- ── CRASH_LEADERBOARD ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.crash_leaderboard (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  best_multiplier  numeric NOT NULL DEFAULT 0,
  total_rounds     int NOT NULL DEFAULT 0,
  total_won        int NOT NULL DEFAULT 0,
  total_earned     int NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crash_leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crash_leaderboard_select" ON public.crash_leaderboard FOR SELECT USING (true);

-- ── CRASH_ROUNDS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crash_rounds (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bet_amount            int NOT NULL DEFAULT 0,
  crash_multiplier      numeric NOT NULL,
  multiplier_at_cashout numeric,
  points_earned         int NOT NULL DEFAULT 0,
  won                   boolean NOT NULL DEFAULT false,
  had_shield            boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crash_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crash_rounds_select" ON public.crash_rounds FOR SELECT USING (true);

-- ── MINER_PROGRESS ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.miner_progress (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mine_level        int NOT NULL DEFAULT 1,
  pickaxe_level     int NOT NULL DEFAULT 1,
  worker_count      int NOT NULL DEFAULT 0,
  coins             numeric NOT NULL DEFAULT 0,
  coins_per_second  numeric NOT NULL DEFAULT 0,
  total_coins_earned numeric NOT NULL DEFAULT 0,
  last_collected_at timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.miner_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "miner_progress_select" ON public.miner_progress FOR SELECT USING (true);

-- ── MINER_LEADERBOARD ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.miner_leaderboard (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mine_level         int NOT NULL DEFAULT 1,
  total_coins_earned numeric NOT NULL DEFAULT 0,
  updated_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.miner_leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "miner_leaderboard_select" ON public.miner_leaderboard FOR SELECT USING (true);

-- ── LAB_PROGRESS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lab_progress (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  generator_level   int NOT NULL DEFAULT 1,
  accelerator_level int NOT NULL DEFAULT 1,
  booster_level     int NOT NULL DEFAULT 1,
  quantum_level     int NOT NULL DEFAULT 1,
  coins             numeric NOT NULL DEFAULT 0,
  coins_per_second  numeric NOT NULL DEFAULT 0,
  total_coins_earned numeric NOT NULL DEFAULT 0,
  last_collected_at timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lab_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab_progress_select" ON public.lab_progress FOR SELECT USING (true);

-- ── LAB_LEADERBOARD ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.lab_leaderboard (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  highest_machine    text NOT NULL DEFAULT 'generator',
  total_coins_earned numeric NOT NULL DEFAULT 0,
  updated_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lab_leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab_leaderboard_select" ON public.lab_leaderboard FOR SELECT USING (true);

-- ── USER_ROLES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT USING (true);

-- ── WEEKLY_KINGS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.weekly_kings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_start   date NOT NULL,
  week_end     date NOT NULL,
  total_earned int NOT NULL DEFAULT 0,
  rank         int,
  badge        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.weekly_kings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weekly_kings_select" ON public.weekly_kings FOR SELECT USING (true);

-- ── LEADERBOARD VIEW ──────────────────────────────
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  u.id,
  u.telegram_id,
  u.first_name,
  u.username,
  u.photo_url,
  u.level,
  u.total_points,
  b.points AS current_points,
  ROW_NUMBER() OVER (ORDER BY u.total_points DESC) AS rank
FROM public.users u
LEFT JOIN public.balances b ON b.user_id = u.id
WHERE u.is_banned = false;

-- ── FUNCTIONS ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_points(p_user_id uuid, p_points int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.balances
  SET points = points + p_points, total_earned = total_earned + p_points
  WHERE user_id = p_user_id;

  UPDATE public.users
  SET total_points = total_points + p_points,
      level = FLOOR((total_points + p_points) / 10000) + 1
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_telegram_admin(_telegram_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.user_roles r ON r.user_id = u.id
    WHERE u.telegram_id = _telegram_id AND r.role = 'admin'
  );
$$;

-- ── DEFAULT SETTINGS ──────────────────────────────
INSERT INTO public.settings (key, value, description) VALUES
  ('min_withdrawal_points',   '5000',  'Minimum points required to withdraw'),
  ('max_pending_withdrawals', '2',     'Max pending withdrawal requests per user'),
  ('max_daily_withdrawals',   '3',     'Max withdrawals per day per user'),
  ('points_per_referral',     '500',   'Points earned per successful referral'),
  ('referral_bonus_referred', '200',   'Points given to new referred user'),
  ('welcome_bonus',           '200',   'Points given on first signup'),
  ('daily_reward_base',       '100',   'Base daily reward points'),
  ('ad_reward_points',        '50',    'Points per ad watch'),
  ('ad_max_per_day',          '20',    'Max ads per user per day'),
  ('farm_reward_points',      '100',   'Points for completing farm'),
  ('spin_max_per_window',     '3',     'Max spins per 4-hour window')
ON CONFLICT (key) DO NOTHING;
