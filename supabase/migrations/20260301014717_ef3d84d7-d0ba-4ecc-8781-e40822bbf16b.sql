
-- Tower Climb: stores each run's high score
CREATE TABLE public.tower_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  floors_reached INTEGER NOT NULL DEFAULT 0,
  points_earned BIGINT NOT NULL DEFAULT 0,
  revives_used INTEGER NOT NULL DEFAULT 0,
  shields_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tower Climb: persistent best scores for leaderboard
CREATE TABLE public.tower_leaderboard (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  best_floor INTEGER NOT NULL DEFAULT 0,
  total_floors BIGINT NOT NULL DEFAULT 0,
  total_runs INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Idle Miner: persistent progress
CREATE TABLE public.miner_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  coins NUMERIC NOT NULL DEFAULT 0,
  coins_per_second NUMERIC NOT NULL DEFAULT 1,
  mine_level INTEGER NOT NULL DEFAULT 1,
  pickaxe_level INTEGER NOT NULL DEFAULT 1,
  worker_count INTEGER NOT NULL DEFAULT 0,
  total_coins_earned NUMERIC NOT NULL DEFAULT 0,
  last_collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Idle Miner leaderboard
CREATE TABLE public.miner_leaderboard (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  total_coins_earned NUMERIC NOT NULL DEFAULT 0,
  mine_level INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS policies (open like other tables in this project)
ALTER TABLE public.tower_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tower_leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miner_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miner_leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open_tower_runs" ON public.tower_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_tower_leaderboard" ON public.tower_leaderboard FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_miner_progress" ON public.miner_progress FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_miner_leaderboard" ON public.miner_leaderboard FOR ALL USING (true) WITH CHECK (true);
