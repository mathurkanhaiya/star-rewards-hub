
-- Contests table for leaderboard competitions
CREATE TABLE public.contests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_type text NOT NULL DEFAULT 'ads_watch', -- 'ads_watch' or 'referral'
  title text NOT NULL,
  starts_at timestamp with time zone NOT NULL DEFAULT now(),
  ends_at timestamp with time zone NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  reward_1st bigint NOT NULL DEFAULT 5000,
  reward_2nd bigint NOT NULL DEFAULT 3000,
  reward_3rd bigint NOT NULL DEFAULT 2000,
  reward_4th bigint NOT NULL DEFAULT 1000,
  reward_5th bigint NOT NULL DEFAULT 500,
  rewards_distributed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_contests" ON public.contests FOR ALL USING (true) WITH CHECK (true);

-- Contest entries for tracking participation
CREATE TABLE public.contest_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  score bigint NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(contest_id, user_id)
);

ALTER TABLE public.contest_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_contest_entries" ON public.contest_entries FOR ALL USING (true) WITH CHECK (true);

-- Broadcasts table for admin messages
CREATE TABLE public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  sent_by bigint NOT NULL, -- admin telegram_id
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  target text NOT NULL DEFAULT 'all' -- 'all' or specific user_id
);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_broadcasts" ON public.broadcasts FOR ALL USING (true) WITH CHECK (true);

-- Notifications table for in-app notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info', -- 'info', 'reward', 'withdrawal', 'referral'
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.balances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contest_entries;
