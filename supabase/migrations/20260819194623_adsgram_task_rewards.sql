BEGIN;

INSERT INTO public.settings(key, value, description)
VALUES
  ('adsgram_task_reward_points', '10', 'Points credited for a completed Adsgram task'),
  ('adsgram_task_cooldown_seconds', '15', 'Minimum seconds between Adsgram task rewards')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_ad_logs_adsgram_task_user_created
  ON public.ad_logs(user_id, created_at DESC)
  WHERE ad_type = 'adsgram_task';

CREATE OR REPLACE FUNCTION public.claim_adsgram_task_reward(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward bigint;
  v_cooldown integer;
  v_last_at timestamptz;
  v_next_available timestamptz;
  v_retry_after integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id = p_user_id AND is_banned = false) THEN
    RAISE EXCEPTION 'User unavailable';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('adsgram-task:' || p_user_id::text, 0));

  SELECT LEAST(10000, GREATEST(0, COALESCE(
    (SELECT CASE WHEN value ~ '^[0-9]+$' THEN value::bigint END FROM public.settings WHERE key = 'adsgram_task_reward_points'),
    10
  ))) INTO v_reward;

  SELECT LEAST(3600, GREATEST(1, COALESCE(
    (SELECT CASE WHEN value ~ '^[0-9]+$' THEN value::integer END FROM public.settings WHERE key = 'adsgram_task_cooldown_seconds'),
    15
  ))) INTO v_cooldown;

  SELECT created_at
  INTO v_last_at
  FROM public.ad_logs
  WHERE user_id = p_user_id
    AND ad_type = 'adsgram_task'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last_at IS NOT NULL AND v_last_at + make_interval(secs => v_cooldown) > now() THEN
    v_next_available := v_last_at + make_interval(secs => v_cooldown);
    v_retry_after := GREATEST(1, ceil(extract(epoch FROM (v_next_available - now())))::integer);
    RETURN jsonb_build_object(
      'success', false,
      'message', format('New task available in %ss', v_retry_after),
      'retryAfter', v_retry_after,
      'nextAvailableAt', v_next_available
    );
  END IF;

  IF v_reward = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Adsgram task rewards are disabled');
  END IF;

  INSERT INTO public.ad_logs(user_id, ad_type, reward_given, provider)
  VALUES (p_user_id, 'adsgram_task', v_reward, 'adsgram');

  PERFORM public.increment_points(p_user_id, v_reward);
  INSERT INTO public.transactions(user_id, type, points, description)
  VALUES (p_user_id, 'adsgram_task', v_reward, 'Adsgram task reward');

  v_next_available := now() + make_interval(secs => v_cooldown);
  RETURN jsonb_build_object(
    'success', true,
    'points', v_reward,
    'nextAvailableAt', v_next_available
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_adsgram_task_reward(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_adsgram_task_reward(uuid) TO service_role;

COMMIT;
