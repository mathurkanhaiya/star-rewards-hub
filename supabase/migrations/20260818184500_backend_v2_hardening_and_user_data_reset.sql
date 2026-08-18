-- Backend V2 hardening + clean user-data reset
-- IMPORTANT: keeps public.users rows and Telegram identities.
-- Resets balances/progress/history while preserving profile identity and admin ban state.

BEGIN;

-- 1) Remove user-generated/progress data without deleting users.
TRUNCATE TABLE public.user_tasks RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.referrals RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.withdrawals RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.transactions RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.daily_claims RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.spin_results RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.ad_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.notifications RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.contest_entries RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.tower_runs RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.tower_leaderboard RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.miner_progress RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.miner_leaderboard RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.crash_rounds RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.crash_leaderboard RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.lab_progress RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.lab_leaderboard RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.weekly_kings RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.promo_claims RESTART IDENTITY CASCADE;

-- Reset account progress but retain Telegram/profile identity, referral_code and ban state.
UPDATE public.users
SET
  level = 1,
  total_points = 0,
  referred_by = NULL,
  updated_at = now();

-- Every retained user keeps exactly one clean balance row.
UPDATE public.balances
SET
  points = 0,
  stars_balance = 0,
  usdt_balance = 0,
  ton_balance = 0,
  total_earned = 0,
  total_withdrawn = 0,
  updated_at = now();

INSERT INTO public.balances (user_id)
SELECT u.id
FROM public.users u
LEFT JOIN public.balances b ON b.user_id = u.id
WHERE b.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- 2) Remove dangerous open RLS policies created by legacy migrations.
DROP POLICY IF EXISTS "open_users" ON public.users;
DROP POLICY IF EXISTS "open_balances" ON public.balances;
DROP POLICY IF EXISTS "open_tasks" ON public.tasks;
DROP POLICY IF EXISTS "open_user_tasks" ON public.user_tasks;
DROP POLICY IF EXISTS "open_referrals" ON public.referrals;
DROP POLICY IF EXISTS "open_withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "open_transactions" ON public.transactions;
DROP POLICY IF EXISTS "open_daily_claims" ON public.daily_claims;
DROP POLICY IF EXISTS "open_spin_results" ON public.spin_results;
DROP POLICY IF EXISTS "open_ad_logs" ON public.ad_logs;
DROP POLICY IF EXISTS "open_admin_logs" ON public.admin_logs;
DROP POLICY IF EXISTS "open_settings" ON public.settings;
DROP POLICY IF EXISTS "open_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "open_contests" ON public.contests;
DROP POLICY IF EXISTS "open_contest_entries" ON public.contest_entries;
DROP POLICY IF EXISTS "open_broadcasts" ON public.broadcasts;
DROP POLICY IF EXISTS "open_notifications" ON public.notifications;
DROP POLICY IF EXISTS "open_tower_runs" ON public.tower_runs;
DROP POLICY IF EXISTS "open_tower_leaderboard" ON public.tower_leaderboard;
DROP POLICY IF EXISTS "open_miner_progress" ON public.miner_progress;
DROP POLICY IF EXISTS "open_miner_leaderboard" ON public.miner_leaderboard;
DROP POLICY IF EXISTS "open_crash_rounds" ON public.crash_rounds;
DROP POLICY IF EXISTS "open_crash_leaderboard" ON public.crash_leaderboard;
DROP POLICY IF EXISTS "open_lab_progress" ON public.lab_progress;
DROP POLICY IF EXISTS "open_lab_leaderboard" ON public.lab_leaderboard;
DROP POLICY IF EXISTS "open_weekly_kings" ON public.weekly_kings;
DROP POLICY IF EXISTS "open_promos" ON public.promos;
DROP POLICY IF EXISTS "open_promo_claims" ON public.promo_claims;

-- 3) Public client is read-only only for genuinely public configuration/catalog data.
CREATE POLICY "public_read_tasks"
ON public.tasks FOR SELECT TO anon, authenticated
USING (is_active = true);

CREATE POLICY "public_read_settings"
ON public.settings FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "public_read_contests"
ON public.contests FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "public_read_promos"
ON public.promos FOR SELECT TO anon, authenticated
USING (is_active = true);

-- Sensitive/user-owned tables intentionally get NO anon write policies.
-- Access them only through verified Edge Functions using service_role.

-- 4) Defensive constraints/indexes for reward integrity and performance.
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON public.users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_balances_user_id ON public.balances(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_user_task ON public.user_tasks(user_id, task_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON public.transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_created ON public.withdrawals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_logs_user_created ON public.ad_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_spin_results_user_spun ON public.spin_results(user_id, spun_at DESC);

ALTER TABLE public.balances
  DROP CONSTRAINT IF EXISTS balances_points_nonnegative,
  ADD CONSTRAINT balances_points_nonnegative CHECK (points >= 0),
  DROP CONSTRAINT IF EXISTS balances_stars_nonnegative,
  ADD CONSTRAINT balances_stars_nonnegative CHECK (stars_balance >= 0),
  DROP CONSTRAINT IF EXISTS balances_usdt_nonnegative,
  ADD CONSTRAINT balances_usdt_nonnegative CHECK (usdt_balance >= 0),
  DROP CONSTRAINT IF EXISTS balances_ton_nonnegative,
  ADD CONSTRAINT balances_ton_nonnegative CHECK (ton_balance >= 0);

-- 5) Harden point mutation. Only service-role/backend should call this.
CREATE OR REPLACE FUNCTION public.increment_points(p_user_id uuid, p_points bigint)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance bigint;
BEGIN
  IF p_points <= 0 THEN
    RAISE EXCEPTION 'increment must be positive';
  END IF;

  UPDATE public.balances
  SET points = points + p_points,
      total_earned = total_earned + p_points,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING points INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'balance not found';
  END IF;

  UPDATE public.users
  SET total_points = total_points + p_points,
      updated_at = now()
  WHERE id = p_user_id;

  RETURN new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_points(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_points(uuid, bigint) TO service_role;

COMMIT;
