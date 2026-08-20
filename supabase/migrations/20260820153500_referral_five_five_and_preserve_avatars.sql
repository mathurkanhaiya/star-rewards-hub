BEGIN;

INSERT INTO public.settings(key,value,description)
VALUES
  ('referral_required_tasks','5','Completed tasks required for referral qualification'),
  ('referral_required_ads','5','Verified rewarded ads required for referral qualification')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES (
  'user-avatars',
  'user-avatars',
  true,
  2097152,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.register_telegram_user(
  p_telegram_id bigint,
  p_first_name text,
  p_last_name text DEFAULT NULL::text,
  p_username text DEFAULT NULL::text,
  p_photo_url text DEFAULT NULL::text,
  p_referral_code text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user public.users%ROWTYPE;
  v_referrer public.users%ROWTYPE;
  v_welcome_bonus bigint := 0;
  v_join_bonus bigint := 0;
  v_total_bonus bigint := 0;
  v_balance bigint := 0;
  v_referral_id uuid;
  v_created boolean := false;
BEGIN
  IF p_telegram_id <= 0 OR length(trim(coalesce(p_first_name, ''))) = 0 THEN
    RAISE EXCEPTION 'Invalid Telegram user';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('telegram-user:' || p_telegram_id::text, 0));

  SELECT * INTO v_user
  FROM public.users
  WHERE telegram_id = p_telegram_id
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.users
    SET first_name = left(trim(p_first_name), 128),
        last_name = nullif(left(trim(coalesce(p_last_name, '')), 128), ''),
        username = nullif(left(trim(coalesce(p_username, '')), 64), ''),
        photo_url = coalesce(
          nullif(left(trim(coalesce(p_photo_url, '')), 1000), ''),
          public.users.photo_url
        ),
        last_active_at = now(),
        updated_at = now()
    WHERE id = v_user.id
    RETURNING * INTO v_user;

    RETURN jsonb_build_object(
      'created', false,
      'user', to_jsonb(v_user),
      'welcomeBonus', 0,
      'referralBonus', 0,
      'totalBonus', 0
    );
  END IF;

  IF p_referral_code ~ '^[0-9]{1,20}$' AND p_referral_code::bigint <> p_telegram_id THEN
    SELECT * INTO v_referrer
    FROM public.users
    WHERE telegram_id = p_referral_code::bigint
      AND is_banned = false;
  END IF;

  INSERT INTO public.users(
    telegram_id, first_name, last_name, username, photo_url,
    referral_code, referred_by, last_active_at
  )
  VALUES (
    p_telegram_id,
    left(trim(p_first_name), 128),
    nullif(left(trim(coalesce(p_last_name, '')), 128), ''),
    nullif(left(trim(coalesce(p_username, '')), 64), ''),
    nullif(left(trim(coalesce(p_photo_url, '')), 1000), ''),
    p_telegram_id::text,
    CASE WHEN v_referrer.id IS NOT NULL THEN v_referrer.telegram_id ELSE NULL END,
    now()
  )
  RETURNING * INTO v_user;

  v_created := true;
  INSERT INTO public.balances(user_id) VALUES (v_user.id);

  SELECT LEAST(1000000, GREATEST(0, COALESCE(
    (SELECT CASE WHEN value ~ '^[0-9]+$' THEN value::bigint END
     FROM public.settings WHERE key = 'welcome_bonus'),
    200
  ))) INTO v_welcome_bonus;

  IF v_referrer.id IS NOT NULL THEN
    SELECT LEAST(1000000, GREATEST(0, COALESCE(
      (SELECT CASE WHEN value ~ '^[0-9]+$' THEN value::bigint END
       FROM public.settings WHERE key = 'referral_bonus_referred'),
      200
    ))) INTO v_join_bonus;

    INSERT INTO public.referrals(
      referrer_id, referred_id, points_earned, is_verified,
      join_bonus, join_bonus_awarded_at
    )
    VALUES (
      v_referrer.id, v_user.id, 0, false,
      v_join_bonus, CASE WHEN v_join_bonus > 0 THEN now() ELSE NULL END
    )
    RETURNING id INTO v_referral_id;
  END IF;

  v_total_bonus := v_welcome_bonus + v_join_bonus;
  IF v_total_bonus > 0 THEN
    v_balance := public.increment_points(v_user.id, v_total_bonus);
  END IF;

  IF v_welcome_bonus > 0 THEN
    INSERT INTO public.transactions(user_id, type, points, description)
    VALUES (v_user.id, 'bonus', v_welcome_bonus, 'Welcome bonus');
  END IF;

  IF v_join_bonus > 0 THEN
    INSERT INTO public.transactions(user_id, type, points, description, reference_id)
    VALUES (v_user.id, 'referral_join', v_join_bonus, 'Referral joining bonus', v_referral_id);
  END IF;

  INSERT INTO public.notifications(user_id, title, message, type)
  VALUES (
    v_user.id,
    'Welcome to AdsReward',
    CASE
      WHEN v_join_bonus > 0 THEN format('Welcome %s + referral %s = %s points added.', v_welcome_bonus, v_join_bonus, v_total_bonus)
      ELSE format('%s welcome points added.', v_welcome_bonus)
    END,
    'bonus'
  );

  PERFORM public.queue_bot_event(
    v_user.telegram_id,
    v_user.id,
    'welcome:' || v_user.id::text,
    'welcome',
    jsonb_build_object(
      'name', v_user.first_name,
      'welcomeBonus', v_welcome_bonus,
      'referralBonus', v_join_bonus,
      'totalBonus', v_total_bonus,
      'balance', v_balance,
      'referred', v_referrer.id IS NOT NULL
    ),
    now()
  );

  IF v_referrer.id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, message, type)
    VALUES (
      v_referrer.id,
      'New referral joined',
      format('%s joined. The referral reward unlocks after the required task and ad.', v_user.first_name),
      'referral'
    );

    PERFORM public.queue_bot_event(
      v_referrer.telegram_id,
      v_referrer.id,
      'new-referral:' || v_referral_id::text,
      'new_referral',
      jsonb_build_object(
        'name', v_user.first_name,
        'telegramId', v_user.telegram_id
      ),
      now()
    );
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = v_user.id;
  RETURN jsonb_build_object(
    'created', v_created,
    'user', to_jsonb(v_user),
    'welcomeBonus', v_welcome_bonus,
    'referralBonus', v_join_bonus,
    'totalBonus', v_total_bonus,
    'balance', v_balance
  );
END;
$function$;

COMMIT;