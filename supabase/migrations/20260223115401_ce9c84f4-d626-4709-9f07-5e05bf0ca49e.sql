
-- Add unique constraint on settings key if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'settings_key_unique'
  ) THEN
    ALTER TABLE public.settings ADD CONSTRAINT settings_key_unique UNIQUE (key);
  END IF;
END $$;

-- Insert default settings that may be missing
INSERT INTO public.settings (key, value, description) VALUES
  ('spin_cooldown_hours', '4', 'Hours between spin resets'),
  ('spin_reward_min', '100', 'Minimum spin reward'),
  ('spin_reward_max', '1000', 'Maximum spin reward'),
  ('spin_jackpot', '5000', 'Jackpot reward points'),
  ('spin_jackpot_chance', '2', 'Jackpot chance percentage'),
  ('ad_reward_points', '50', 'Points per ad watch'),
  ('max_pending_withdrawals', '2', 'Max pending withdrawals per user')
ON CONFLICT (key) DO NOTHING;
