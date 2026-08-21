BEGIN;

CREATE OR REPLACE FUNCTION public.prevent_final_withdrawal_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('paid','rejected') THEN
      RAISE EXCEPTION 'Final withdrawal records are immutable';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status IN ('paid','rejected') THEN
    RAISE EXCEPTION 'Final withdrawal records are immutable';
  END IF;

  IF OLD.status = 'pending' AND NEW.status NOT IN ('pending','approved','rejected') THEN
    RAISE EXCEPTION 'Invalid withdrawal transition from pending to %', NEW.status;
  END IF;

  IF OLD.status = 'approved' AND NEW.status NOT IN ('approved','paid') THEN
    RAISE EXCEPTION 'Invalid withdrawal transition from approved to %', NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_withdrawal_log_delivery(p_delivery_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  d public.withdrawal_log_deliveries%ROWTYPE;
BEGIN
  SELECT * INTO d
  FROM public.withdrawal_log_deliveries
  WHERE id = p_delivery_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery not found';
  END IF;

  IF d.delivery_status = 'sent' THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'already_sent');
  END IF;

  IF d.delivery_status = 'processing'
     AND d.last_attempt_at IS NOT NULL
     AND d.last_attempt_at > now() - interval '2 minutes' THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'already_processing');
  END IF;

  UPDATE public.withdrawal_log_deliveries
  SET delivery_status = 'processing',
      attempt_count = attempt_count + 1,
      last_attempt_at = now(),
      delivery_error = NULL,
      updated_at = now()
  WHERE id = p_delivery_id;

  RETURN jsonb_build_object('claimed', true, 'attemptCount', d.attempt_count + 1);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_withdrawal_log_delivery(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_withdrawal_log_delivery(uuid) TO service_role;

COMMIT;
