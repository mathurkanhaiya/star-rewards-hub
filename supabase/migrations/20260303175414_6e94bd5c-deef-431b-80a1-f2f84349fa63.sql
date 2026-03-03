
-- Crash game rounds
CREATE TABLE public.crash_rounds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bet_amount BIGINT NOT NULL DEFAULT 0,
  multiplier_at_cashout NUMERIC,
  crash_multiplier NUMERIC NOT NULL,
  won BOOLEAN NOT NULL DEFAULT false,
  points_earned BIGINT NOT NULL DEFAULT 0,
  had_shield BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crash_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_crash_rounds" ON public.crash_rounds FOR ALL USING (true) WITH CHECK (true);

-- Crash leaderboard
CREATE TABLE public.crash_leaderboard (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  total_rounds INTEGER NOT NULL DEFAULT 0,
  total_won INTEGER NOT NULL DEFAULT 0,
  total_earned BIGINT NOT NULL DEFAULT 0,
  best_multiplier NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crash_leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_crash_leaderboard" ON public.crash_leaderboard FOR ALL USING (true) WITH CHECK (true);

-- Lab progress (idle upgrade lab)
CREATE TABLE public.lab_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  coins NUMERIC NOT NULL DEFAULT 0,
  coins_per_second NUMERIC NOT NULL DEFAULT 1,
  generator_level INTEGER NOT NULL DEFAULT 1,
  booster_level INTEGER NOT NULL DEFAULT 0,
  accelerator_level INTEGER NOT NULL DEFAULT 0,
  quantum_level INTEGER NOT NULL DEFAULT 0,
  total_coins_earned NUMERIC NOT NULL DEFAULT 0,
  last_collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lab_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_lab_progress" ON public.lab_progress FOR ALL USING (true) WITH CHECK (true);

-- Lab leaderboard
CREATE TABLE public.lab_leaderboard (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  total_coins_earned NUMERIC NOT NULL DEFAULT 0,
  highest_machine TEXT NOT NULL DEFAULT 'generator',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lab_leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_lab_leaderboard" ON public.lab_leaderboard FOR ALL USING (true) WITH CHECK (true);

-- Weekly king tracking
CREATE TABLE public.weekly_kings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  total_earned BIGINT NOT NULL DEFAULT 0,
  rank INTEGER,
  badge TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_kings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_weekly_kings" ON public.weekly_kings FOR ALL USING (true) WITH CHECK (true);
