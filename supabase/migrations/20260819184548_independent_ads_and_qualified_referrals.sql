BEGIN;

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

UPDATE public.referrals
SET verified_at = created_at
WHERE is_verified = true
  AND verified_at IS NULL;

WITH provider_settings(key, source_key, fallback, description) AS (
  VALUES
    ('adsgram_max_ads_per_day', 'max_ads_per_day', '50', 'Adsgram daily rewarded-ad limit'),
    ('adsgram_cooldown_seconds', 'ad_cooldown_seconds', '10', 'Adsgram wait between rewarded ads'),
    ('monetag_max_ads_per_day', 'max_ads_per_day', '50', 'Monetag daily rewarded-ad limit'),
    ('monetag_cooldown_seconds', 'ad_cooldown_seconds', '10', 'Monetag wait between rewarded ads'),
    ('gigapub_max_ads_per_day', 'max_ads_per_day', '50', 'GigaPub daily rewarded-ad limit'),
    ('gigapub_cooldown_seconds', 'ad_cooldown_seconds', '10', 'GigaPub wait between rewarded ads')
)
INSERT INTO public.settings(key, value, description)
SELECT
  provider_settings.key,
  COALESCE(source.value, provider_settings.fallback),
  provider_settings.description
FROM provider_settings
LEFT JOIN public.settings AS source ON source.key = provider_settings.source_key
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_ad_logs_user_provider_created
  ON public.ad_logs(user_id, provider, created_at DESC)
  WHERE ad_type = 'ad_watch';

CREATE INDEX IF NOT EXISTS idx_referrals_verified_time_referrer
  ON public.referrals(verified_at DESC, referrer_id)
  WHERE is_verified = true;

CREATE OR REPLACE FUNCTION public.qualify_referral(p_referred_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral public.referrals%ROWTYPE;
  v_has_task boolean;
  v_has_ad boolean;
  v_referrer_reward bigint;
  v_referred_reward bigint;
  v_max_referral_bonus bigint;
  v_already_awarded bigint;
  v_name text;
BEGIN
  SELECT *
  INTO v_referral
  FROM public.referrals
  WHERE referred_id = p_referred_id
    AND is_verified = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('qualified', false, 'reason', 'not_pending');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.user_tasks WHERE user_id = p_referred_id
  ) INTO v_has_task;

  SELECT EXISTS(
    SELECT 1
    FROM public.ad_logs
    WHERE user_id = p_referred_id
      AND ad_type = 'ad_watch'
  ) INTO v_has_ad;

  IF NOT (v_has_task AND v_has_ad) THEN
    RETURN jsonb_build_object(
      'qualified', false,
      'reason', 'requirements_pending',
      'taskCompleted', v_has_task,
      'adCompleted', v_has_ad
    );
  END IF;

  -- Serialize qualifications for the same referrer so the cumulative reward
  -- cap cannot be exceeded by two referred users qualifying at once.
  PERFORM pg_advisory_xact_lock(hashtextextended('referral:' || v_referral.referrer_id::text, 0));

  SELECT LEAST(100000, GREATEST(0, COALESCE(
    (SELECT CASE WHEN value ~ '^[0-9]+$' THEN value::bigint END FROM public.settings WHERE key = 'points_per_referral'),
    500
  ))) INTO v_referrer_reward;

  SELECT LEAST(100000, GREATEST(0, COALESCE(
    (SELECT CASE WHEN value ~ '^[0-9]+$' THEN value::bigint END FROM public.settings WHERE key = 'referral_bonus_referred'),
    200
  ))) INTO v_referred_reward;

  SELECT LEAST(1000000000, GREATEST(0, COALESCE(
    (SELECT CASE WHEN value ~ '^[0-9]+$' THEN value::bigint END FROM public.settings WHERE key = 'max_referral_bonus'),
    1000000
  ))) INTO v_max_referral_bonus;

  SELECT COALESCE(sum(points_earned), 0)
  INTO v_already_awarded
  FROM public.referrals
  WHERE referrer_id = v_referral.referrer_id
    AND is_verified = true;

  v_referrer_reward := LEAST(v_referrer_reward, GREATEST(0, v_max_referral_bonus - v_already_awarded));

  UPDATE public.referrals
  SET is_verified = true,
      verified_at = now(),
      points_earned = v_referrer_reward
  WHERE id = v_referral.id;

  SELECT COALESCE(NULLIF(trim(first_name), ''), NULLIF(trim(username), ''), 'A referred user')
  INTO v_name
  FROM public.users
  WHERE id = p_referred_id;

  IF v_referrer_reward > 0 THEN
    PERFORM public.increment_points(v_referral.referrer_id, v_referrer_reward);
    INSERT INTO public.transactions(user_id, type, points, description, reference_id)
    VALUES (
      v_referral.referrer_id,
      'referral',
      v_referrer_reward,
      format('Referral qualified: %s', v_name),
      v_referral.id
    );
  END IF;

  IF v_referred_reward > 0 THEN
    PERFORM public.increment_points(p_referred_id, v_referred_reward);
    INSERT INTO public.transactions(user_id, type, points, description, reference_id)
    VALUES (
      p_referred_id,
      'referral',
      v_referred_reward,
      'Referral qualification bonus',
      v_referral.id
    );
  END IF;

  INSERT INTO public.notifications(user_id, title, message, type)
  VALUES (
    v_referral.referrer_id,
    'Referral verified',
    CASE
      WHEN v_referrer_reward > 0 THEN format('%s completed 1 task and 1 verified ad. +%s points.', v_name, v_referrer_reward)
      ELSE format('%s completed 1 task and 1 verified ad.', v_name)
    END,
    'referral'
  );

  IF v_referred_reward > 0 THEN
    INSERT INTO public.notifications(user_id, title, message, type)
    VALUES (
      p_referred_id,
      'Referral reward unlocked',
      format('You completed 1 task and 1 verified ad. +%s points.', v_referred_reward),
      'referral'
    );
  END IF;

  RETURN jsonb_build_object(
    'qualified', true,
    'referrerReward', v_referrer_reward,
    'referredReward', v_referred_reward,
    'verifiedAt', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.qualify_referral(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qualify_referral(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_ad_reward(p_user_id uuid, p_provider text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider text := lower(trim(p_provider));
  v_reward bigint;
  v_hourly_limit integer;
  v_daily_limit integer;
  v_cooldown integer;
  v_offset integer;
  v_day_start timestamptz;
  v_next_reset timestamptz;
  v_hour_start timestamptz := now() - interval '1 hour';
  v_hour_count integer;
  v_day_count integer;
  v_last_at timestamptz;
  v_first_hour_at timestamptz;
  v_retry_after integer;
  v_next_available timestamptz;
BEGIN
  IF v_provider NOT IN ('adsgram', 'monetag', 'gigapub') THEN
    RAISE EXCEPTION 'Invalid ad provider';
  END IF;

  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id = p_user_id AND is_banned = false) THEN
    RAISE EXCEPTION 'User unavailable';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || v_provider, 0));

  SELECT LEAST(10000, GREATEST(0, COALESCE(
    (SELECT CASE WHEN value ~ '^[0-9]+$' THEN value::bigint END FROM public.settings WHERE key = 'ad_reward_points'),
    50
  ))) INTO v_reward;

  SELECT LEAST(100, GREATEST(0, COALESCE(
    (SELECT CASE WHEN value ~ '^[0-9]+$' THEN value::integer END FROM public.settings WHERE key = 'max_ads_per_hour'),
    10
  ))) INTO v_hourly_limit;

  SELECT LEAST(1000, GREATEST(0, COALESCE(
    (SELECT CASE WHEN value ~ '^[0-9]+$' THEN value::integer END FROM public.settings WHERE key = v_provider || '_max_ads_per_day'),
    (SELECT CASE WHEN value ~ '^[0-9]+$' THEN value::integer END FROM public.settings WHERE key = 'max_ads_per_day'),
    50
  ))) INTO v_daily_limit;

  SELECT LEAST(3600, GREATEST(0, COALESCE(
    (SELECT CASE WHEN value ~ '^[0-9]+$' THEN value::integer END FROM public.settings WHERE key = v_provider || '_cooldown_seconds'),
    (SELECT CASE WHEN value ~ '^[0-9]+$' THEN value::integer END FROM public.settings WHERE key = 'ad_cooldown_seconds'),
    10
  ))) INTO v_cooldown;

  SELECT LEAST(840, GREATEST(-720, COALESCE(
    (SELECT CASE WHEN value ~ '^-?[0-9]+$' THEN value::integer END FROM public.settings WHERE key = 'daily_reset_offset_minutes'),
    330
  ))) INTO v_offset;

  v_day_start := date_trunc('day', now() + make_interval(mins => v_offset)) - make_interval(mins => v_offset);
  v_next_reset := v_day_start + interval '1 day';

  SELECT count(*)::integer
  INTO v_hour_count
  FROM public.ad_logs
  WHERE user_id = p_user_id
    AND ad_type = 'ad_watch'
    AND provider = v_provider
    AND created_at >= v_hour_start;

  SELECT count(*)::integer
  INTO v_day_count
  FROM public.ad_logs
  WHERE user_id = p_user_id
    AND ad_type = 'ad_watch'
    AND provider = v_provider
    AND created_at >= v_day_start;

  SELECT created_at
  INTO v_last_at
  FROM public.ad_logs
  WHERE user_id = p_user_id
    AND ad_type = 'ad_watch'
    AND provider = v_provider
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_daily_limit = 0 OR v_hourly_limit = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('%s ads are disabled', initcap(v_provider)),
      'count', v_day_count,
      'limit', v_daily_limit,
      'nextResetAt', v_next_reset
    );
  END IF;

  IF v_day_count >= v_daily_limit THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('%s daily limit reached', initcap(v_provider)),
      'count', v_day_count,
      'limit', v_daily_limit,
      'nextAvailableAt', v_next_reset,
      'nextResetAt', v_next_reset
    );
  END IF;

  IF v_hour_count >= v_hourly_limit THEN
    SELECT min(created_at)
    INTO v_first_hour_at
    FROM public.ad_logs
    WHERE user_id = p_user_id
      AND ad_type = 'ad_watch'
      AND provider = v_provider
      AND created_at >= v_hour_start;
    v_next_available := v_first_hour_at + interval '1 hour';
    v_retry_after := GREATEST(1, ceil(extract(epoch FROM (v_next_available - now())))::integer);
    RETURN jsonb_build_object(
      'success', false,
      'message', format('%s hourly limit reached', initcap(v_provider)),
      'count', v_day_count,
      'limit', v_daily_limit,
      'retryAfter', v_retry_after,
      'nextAvailableAt', v_next_available,
      'nextResetAt', v_next_reset
    );
  END IF;

  IF v_cooldown > 0 AND v_last_at IS NOT NULL AND v_last_at + make_interval(secs => v_cooldown) > now() THEN
    v_next_available := v_last_at + make_interval(secs => v_cooldown);
    v_retry_after := GREATEST(1, ceil(extract(epoch FROM (v_next_available - now())))::integer);
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Next %s ad available in %ss', initcap(v_provider), v_retry_after),
      'count', v_day_count,
      'limit', v_daily_limit,
      'retryAfter', v_retry_after,
      'nextAvailableAt', v_next_available,
      'nextResetAt', v_next_reset
    );
  END IF;

  INSERT INTO public.ad_logs(user_id, ad_type, reward_given, provider)
  VALUES (p_user_id, 'ad_watch', v_reward, v_provider);

  IF v_reward > 0 THEN
    PERFORM public.increment_points(p_user_id, v_reward);
    INSERT INTO public.transactions(user_id, type, points, description)
    VALUES (p_user_id, 'ad_reward', v_reward, format('Ad reward: %s', v_provider));
  END IF;

  PERFORM public.qualify_referral(p_user_id);

  v_next_available := CASE
    WHEN v_cooldown > 0 THEN now() + make_interval(secs => v_cooldown)
    ELSE NULL
  END;

  RETURN jsonb_build_object(
    'success', true,
    'provider', v_provider,
    'points', v_reward,
    'count', v_day_count + 1,
    'limit', v_daily_limit,
    'nextAvailableAt', v_next_available,
    'nextResetAt', v_next_reset
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ad_reward(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ad_reward(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_invite_leaderboard(
  p_range text DEFAULT 'week',
  p_limit integer DEFAULT 50,
  p_offset_minutes integer DEFAULT 330
)
RETURNS TABLE(
  user_id uuid,
  telegram_id bigint,
  first_name text,
  username text,
  photo_url text,
  score bigint,
  rank bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH params AS (
    SELECT CASE
      WHEN lower(p_range) = 'week' THEN
        date_trunc('day', now() + make_interval(mins => LEAST(840, GREATEST(-720, p_offset_minutes))))
        - ((extract(isodow FROM now() + make_interval(mins => LEAST(840, GREATEST(-720, p_offset_minutes))))::integer - 1) * interval '1 day')
        - make_interval(mins => LEAST(840, GREATEST(-720, p_offset_minutes)))
      WHEN lower(p_range) = 'month' THEN
        date_trunc('month', now() + make_interval(mins => LEAST(840, GREATEST(-720, p_offset_minutes))))
        - make_interval(mins => LEAST(840, GREATEST(-720, p_offset_minutes)))
      ELSE NULL
    END AS period_start
  ),
  scored AS (
    SELECT
      users.id AS user_id,
      users.telegram_id,
      users.first_name,
      users.username,
      users.photo_url,
      count(*)::bigint AS score,
      min(referrals.verified_at) AS first_verified_at
    FROM public.referrals
    JOIN public.users ON users.id = referrals.referrer_id
    CROSS JOIN params
    WHERE referrals.is_verified = true
      AND referrals.verified_at IS NOT NULL
      AND (params.period_start IS NULL OR referrals.verified_at >= params.period_start)
    GROUP BY users.id, users.telegram_id, users.first_name, users.username, users.photo_url
  )
  SELECT
    scored.user_id,
    scored.telegram_id,
    scored.first_name,
    scored.username,
    scored.photo_url,
    scored.score,
    row_number() OVER (ORDER BY scored.score DESC, scored.first_verified_at ASC, scored.user_id)::bigint AS rank
  FROM scored
  ORDER BY scored.score DESC, scored.first_verified_at ASC, scored.user_id
  LIMIT LEAST(100, GREATEST(1, p_limit));
$$;

REVOKE ALL ON FUNCTION public.get_invite_leaderboard(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_invite_leaderboard(text, integer, integer) TO service_role;

COMMIT;
