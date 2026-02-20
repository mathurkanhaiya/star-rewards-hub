
-- Create app role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create users table (Telegram users)
CREATE TABLE public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  photo_url TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  total_points BIGINT NOT NULL DEFAULT 0,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by BIGINT,
  is_banned BOOLEAN NOT NULL DEFAULT false,
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create balances table
CREATE TABLE public.balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  points BIGINT NOT NULL DEFAULT 0,
  stars_balance NUMERIC(20,6) NOT NULL DEFAULT 0,
  usdt_balance NUMERIC(20,6) NOT NULL DEFAULT 0,
  ton_balance NUMERIC(20,6) NOT NULL DEFAULT 0,
  total_earned BIGINT NOT NULL DEFAULT 0,
  total_withdrawn BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL DEFAULT 'social',
  reward_points BIGINT NOT NULL DEFAULT 100,
  reward_stars NUMERIC(10,4) NOT NULL DEFAULT 0,
  link TEXT,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_repeatable BOOLEAN NOT NULL DEFAULT false,
  repeat_hours INTEGER DEFAULT 24,
  max_completions INTEGER DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_tasks
CREATE TABLE public.user_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  points_earned BIGINT NOT NULL DEFAULT 0,
  next_available_at TIMESTAMP WITH TIME ZONE
);

-- Create referrals table
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  points_earned BIGINT NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(referred_id)
);

-- Create withdrawals table
CREATE TABLE public.withdrawals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  points_spent BIGINT NOT NULL DEFAULT 0,
  amount NUMERIC(20,6) NOT NULL,
  wallet_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  points BIGINT NOT NULL DEFAULT 0,
  description TEXT,
  reference_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create daily_claims table (no expression-based unique constraint)
CREATE TABLE public.daily_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
  day_streak INTEGER NOT NULL DEFAULT 1,
  points_earned BIGINT NOT NULL DEFAULT 0,
  claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, claim_date)
);

-- Create spin_results table
CREATE TABLE public.spin_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  result_type TEXT NOT NULL,
  points_earned BIGINT NOT NULL DEFAULT 0,
  stars_earned NUMERIC(10,4) NOT NULL DEFAULT 0,
  spun_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ad_logs table
CREATE TABLE public.ad_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ad_type TEXT NOT NULL,
  reward_given BIGINT NOT NULL DEFAULT 0,
  provider TEXT NOT NULL DEFAULT 'adsgram',
  ip_address TEXT,
  device_info TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create admin_logs table
CREATE TABLE public.admin_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_telegram_id BIGINT NOT NULL,
  action TEXT NOT NULL,
  target_user_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create settings table
CREATE TABLE public.settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Insert default settings
INSERT INTO public.settings (key, value, description) VALUES
  ('points_per_referral', '500', 'Points awarded for each referral'),
  ('min_withdrawal_points', '10000', 'Minimum points for withdrawal'),
  ('stars_conversion_rate', '1000', 'Points per 1 Telegram Star'),
  ('usdt_conversion_rate', '5000', 'Points per 1 USDT'),
  ('ton_conversion_rate', '2000', 'Points per 1 TON'),
  ('daily_bonus_base', '100', 'Base points for daily claim'),
  ('spin_cost_points', '0', 'Points cost per spin'),
  ('maintenance_mode', 'false', 'Put app in maintenance mode'),
  ('ad_double_reward_multiplier', '2', 'Multiplier for ad double reward'),
  ('max_daily_spins', '3', 'Maximum free spins per day'),
  ('referral_bonus_referred', '200', 'Bonus points for referred user');

-- Insert default tasks
INSERT INTO public.tasks (title, description, task_type, reward_points, link, icon, display_order) VALUES
  ('Join our Telegram Channel', 'Join @Adsrewartsbot channel for updates', 'social', 500, 'https://t.me/Adsrewartsbot', '📢', 1),
  ('Follow on Twitter/X', 'Follow our official Twitter account', 'social', 300, 'https://twitter.com/', '🐦', 2),
  ('Join Telegram Group', 'Join our community group', 'social', 400, 'https://t.me/', '💬', 3),
  ('Invite 1 Friend', 'Refer your first friend', 'referral', 500, NULL, '👥', 4),
  ('Invite 5 Friends', 'Refer 5 friends total', 'referral', 2000, NULL, '🎯', 5),
  ('Watch an Ad', 'Watch a rewarded advertisement', 'video', 200, NULL, '▶️', 6);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spin_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Helper function: check admin
CREATE OR REPLACE FUNCTION public.is_telegram_admin(_telegram_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _telegram_id = 2139807311
$$;

-- Helper function: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Open RLS policies (using service role key from edge functions)
CREATE POLICY "open_users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_balances" ON public.balances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_user_tasks" ON public.user_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_referrals" ON public.referrals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_withdrawals" ON public.withdrawals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_daily_claims" ON public.daily_claims FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_spin_results" ON public.spin_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_ad_logs" ON public.ad_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_admin_logs" ON public.admin_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_user_roles" ON public.user_roles FOR ALL USING (true) WITH CHECK (true);

-- update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_balances_updated_at BEFORE UPDATE ON public.balances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Leaderboard view
CREATE VIEW public.leaderboard AS
SELECT 
  u.id,
  u.telegram_id,
  u.username,
  u.first_name,
  u.photo_url,
  u.level,
  u.total_points,
  b.points as current_points,
  ROW_NUMBER() OVER (ORDER BY u.total_points DESC) as rank
FROM public.users u
LEFT JOIN public.balances b ON b.user_id = u.id
WHERE u.is_banned = false
ORDER BY u.total_points DESC;
