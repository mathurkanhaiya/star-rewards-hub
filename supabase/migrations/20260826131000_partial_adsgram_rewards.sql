BEGIN;

CREATE OR REPLACE FUNCTION public.claim_ad_partial_reward(p_user_id uuid, p_provider text DEFAULT 'adsgram')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider text := lower(trim(p_provider));
  v_full_reward bigint;
  v_partial bigint;
  v_existing bigint;
  v_last_success timestamptz;
BEGIN
  IF v_provider <> 'adsgram' THEN
    RAISE EXCEPTION 'Partial reward is only available for AdsGram';
  END IF;

  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id = p_user_id AND is_banned = false) THEN
    RAISE EXCEPTION 'User unavailable';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || v_provider, 0));

  SELECT LEAST(10000, GREATEST(0, COALESCE(
    (SELECT CASE WHEN value ~ '^[0-9]+$' THEN value::bigint END FROM public.settings WHERE key = 'ad_reward_points'),
    50
  ))) INTO v_full_reward;

  SELECT max(created_at)
  INTO v_last_success
  FROM public.ad_logs
  WHERE user_id = p_user_id
    AND ad_type = 'ad_watch'
    AND provider = v_provider;

  SELECT COALESCE(sum(reward_given), 0)::bigint
  INTO v_existing
  FROM public.ad_logs
  WHERE user_id = p_user_id
    AND ad_type = 'ad_partial'
    AND provider = v_provider
    AND created_at > COALESCE(v_last_success, '1970-01-01'::timestamptz);

  IF v_existing > 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'points', v_existing,
      'left', GREATEST(0, v_full_reward - v_existing),
      'fullReward', v_full_reward,
      'awardedNow', false
    );
  END IF;

  IF v_full_reward <= 0 THEN
    RETURN jsonb_build_object('success', true, 'points', 0, 'left', 0, 'fullReward', 0, 'awardedNow', false);
  END IF;

  v_partial := LEAST(v_full_reward, (10 + floor(random() * 11))::bigint);

  INSERT INTO public.ad_logs(user_id, ad_type, reward_given, provider)
  VALUES (p_user_id, 'ad_partial', v_partial, v_provider);

  IF v_partial > 0 THEN
    PERFORM public.increment_points(p_user_id, v_partial);
    INSERT INTO public.transactions(user_id, type, points, description)
    VALUES (p_user_id, 'ad_partial_reward', v_partial, 'AdsGram partial reward — CTA not detected');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'points', v_partial,
    'left', GREATEST(0, v_full_reward - v_partial),
    'fullReward', v_full_reward,
    'awardedNow', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ad_partial_reward(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ad_partial_reward(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_ad_reward(p_user_id uuid, p_provider text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider text := lower(trim(p_provider));
  v_reward bigint;
  v_payout bigint;
  v_partial_pending bigint := 0;
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
  IF v_provider NOT IN ('adsgram', 'monetag', 'gigapub') THEN RAISE EXCEPTION 'Invalid ad provider'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id = p_user_id AND is_banned = false) THEN RAISE EXCEPTION 'User unavailable'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || v_provider, 0));

  SELECT LEAST(10000, GREATEST(0, COALESCE((SELECT CASE WHEN value ~ '^[0-9]+$' THEN value::bigint END FROM public.settings WHERE key='ad_reward_points'),50))) INTO v_reward;
  SELECT LEAST(100, GREATEST(0, COALESCE((SELECT CASE WHEN value ~ '^[0-9]+$' THEN value::integer END FROM public.settings WHERE key='max_ads_per_hour'),10))) INTO v_hourly_limit;
  SELECT LEAST(1000, GREATEST(0, COALESCE((SELECT CASE WHEN value ~ '^[0-9]+$' THEN value::integer END FROM public.settings WHERE key=v_provider||'_max_ads_per_day'),(SELECT CASE WHEN value ~ '^[0-9]+$' THEN value::integer END FROM public.settings WHERE key='max_ads_per_day'),50))) INTO v_daily_limit;
  SELECT LEAST(3600, GREATEST(0, COALESCE((SELECT CASE WHEN value ~ '^[0-9]+$' THEN value::integer END FROM public.settings WHERE key=v_provider||'_cooldown_seconds'),(SELECT CASE WHEN value ~ '^[0-9]+$' THEN value::integer END FROM public.settings WHERE key='ad_cooldown_seconds'),10))) INTO v_cooldown;
  SELECT LEAST(840, GREATEST(-720, COALESCE((SELECT CASE WHEN value ~ '^-?[0-9]+$' THEN value::integer END FROM public.settings WHERE key='daily_reset_offset_minutes'),330))) INTO v_offset;

  v_day_start := date_trunc('day', now()+make_interval(mins=>v_offset))-make_interval(mins=>v_offset);
  v_next_reset := v_day_start + interval '1 day';

  SELECT count(*)::integer INTO v_hour_count FROM public.ad_logs WHERE user_id=p_user_id AND ad_type='ad_watch' AND provider=v_provider AND created_at>=v_hour_start;
  SELECT count(*)::integer INTO v_day_count FROM public.ad_logs WHERE user_id=p_user_id AND ad_type='ad_watch' AND provider=v_provider AND created_at>=v_day_start;
  SELECT created_at INTO v_last_at FROM public.ad_logs WHERE user_id=p_user_id AND ad_type='ad_watch' AND provider=v_provider ORDER BY created_at DESC LIMIT 1;

  IF v_daily_limit=0 OR v_hourly_limit=0 THEN RETURN jsonb_build_object('success',false,'message',format('%s ads are disabled',initcap(v_provider)),'count',v_day_count,'limit',v_daily_limit,'nextResetAt',v_next_reset); END IF;
  IF v_day_count>=v_daily_limit THEN RETURN jsonb_build_object('success',false,'message',format('%s daily limit reached',initcap(v_provider)),'count',v_day_count,'limit',v_daily_limit,'nextAvailableAt',v_next_reset,'nextResetAt',v_next_reset); END IF;
  IF v_hour_count>=v_hourly_limit THEN
    SELECT min(created_at) INTO v_first_hour_at FROM public.ad_logs WHERE user_id=p_user_id AND ad_type='ad_watch' AND provider=v_provider AND created_at>=v_hour_start;
    v_next_available:=v_first_hour_at+interval '1 hour'; v_retry_after:=GREATEST(1,ceil(extract(epoch FROM (v_next_available-now())))::integer);
    RETURN jsonb_build_object('success',false,'message',format('%s hourly limit reached',initcap(v_provider)),'count',v_day_count,'limit',v_daily_limit,'retryAfter',v_retry_after,'nextAvailableAt',v_next_available,'nextResetAt',v_next_reset);
  END IF;
  IF v_cooldown>0 AND v_last_at IS NOT NULL AND v_last_at+make_interval(secs=>v_cooldown)>now() THEN
    v_next_available:=v_last_at+make_interval(secs=>v_cooldown); v_retry_after:=GREATEST(1,ceil(extract(epoch FROM (v_next_available-now())))::integer);
    RETURN jsonb_build_object('success',false,'message',format('Next %s ad available in %ss',initcap(v_provider),v_retry_after),'count',v_day_count,'limit',v_daily_limit,'retryAfter',v_retry_after,'nextAvailableAt',v_next_available,'nextResetAt',v_next_reset);
  END IF;

  IF v_provider='adsgram' THEN
    SELECT COALESCE(sum(reward_given),0)::bigint INTO v_partial_pending
    FROM public.ad_logs
    WHERE user_id=p_user_id AND ad_type='ad_partial' AND provider=v_provider
      AND created_at>COALESCE(v_last_at,'1970-01-01'::timestamptz);
  END IF;

  v_payout:=GREATEST(0,v_reward-v_partial_pending);

  INSERT INTO public.ad_logs(user_id,ad_type,reward_given,provider) VALUES(p_user_id,'ad_watch',v_payout,v_provider);
  IF v_payout>0 THEN
    PERFORM public.increment_points(p_user_id,v_payout);
    INSERT INTO public.transactions(user_id,type,points,description) VALUES(p_user_id,'ad_reward',v_payout,format('Ad reward: %s',v_provider));
  END IF;

  PERFORM public.qualify_referral(p_user_id);
  v_next_available:=CASE WHEN v_cooldown>0 THEN now()+make_interval(secs=>v_cooldown) ELSE NULL END;

  RETURN jsonb_build_object('success',true,'provider',v_provider,'points',v_payout,'fullReward',v_reward,'partialAlready',v_partial_pending,'totalReward',v_payout+v_partial_pending,'count',v_day_count+1,'limit',v_daily_limit,'nextAvailableAt',v_next_available,'nextResetAt',v_next_reset);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ad_reward(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ad_reward(uuid, text) TO service_role;

COMMIT;
