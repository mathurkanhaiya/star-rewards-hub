-- Fix UPI withdrawal validation on PostgreSQL.
-- PostgreSQL regex repetition bounds cannot use {2,256}; this previously caused
-- `invalid regular expression: invalid repetition count(s)` for every UPI request.
-- Keep the existing withdrawal function intact and replace only the UPI validator.

DO $migration$
DECLARE
  v_def text;
  v_updated text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'create_withdrawal_request'
    AND p.oid::regprocedure::text = 'create_withdrawal_request(uuid,text,bigint,text)';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'create_withdrawal_request function not found';
  END IF;

  v_updated := replace(
    v_def,
    $old$IF v_method = 'upi' AND v_address !~ '^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$' THEN RAISE EXCEPTION 'Invalid UPI ID format'; END IF;$old$,
    $new$IF v_method = 'upi' AND (
    v_address !~ '^[A-Za-z0-9._-]+@[A-Za-z0-9]+$'
    OR position('@' in v_address) < 3
    OR length(split_part(v_address, '@', 2)) NOT BETWEEN 2 AND 64
  ) THEN RAISE EXCEPTION 'Invalid UPI ID format'; END IF;$new$
  );

  IF v_updated = v_def THEN
    RAISE EXCEPTION 'Expected UPI validator was not found';
  END IF;

  EXECUTE v_updated;
END
$migration$;
