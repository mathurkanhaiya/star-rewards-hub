DO $do$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='create_withdrawal_atomic'
  LIMIT 1;

  v_def := regexp_replace(
    v_def,
    E'IF v_method=''upi'' AND v_addr !~ ''[^'']+'' THEN RETURN jsonb_build_object\\(''success'',false,''message'',''Invalid UPI ID format''\\); END IF;',
    'IF v_method=''upi'' AND v_addr !~ ''^[A-Za-z0-9._-]{2,190}@[A-Za-z0-9.-]{2,64}$'' THEN RETURN jsonb_build_object(''success'',false,''message'',''Invalid UPI ID format''); END IF;'
  );

  EXECUTE v_def;
END $do$;