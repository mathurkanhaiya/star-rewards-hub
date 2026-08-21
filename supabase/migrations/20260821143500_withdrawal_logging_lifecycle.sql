BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.withdrawal_public_seq START WITH 10284;

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS public_id text,
  ADD COLUMN IF NOT EXISTS fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS txid text,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by bigint,
  ADD COLUMN IF NOT EXISTS processed_by bigint,
  ADD COLUMN IF NOT EXISTS processed_by_name text;

UPDATE public.withdrawals SET public_id='#ADR-'||nextval('public.withdrawal_public_seq')::text WHERE public_id IS NULL;
ALTER TABLE public.withdrawals ALTER COLUMN public_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawals_public_id ON public.withdrawals(public_id);

CREATE TABLE IF NOT EXISTS public.telegram_bot_chats(
  chat_id bigint PRIMARY KEY, chat_title text, chat_username text, chat_type text NOT NULL,
  bot_member_status text, is_admin boolean NOT NULL DEFAULT false,
  can_send_messages boolean NOT NULL DEFAULT false, can_post_messages boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true, last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.telegram_bot_chats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_bot_chats FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.telegram_bot_chats TO service_role;

CREATE TABLE IF NOT EXISTS public.withdrawal_log_deliveries(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), withdrawal_id uuid NOT NULL REFERENCES public.withdrawals(id) ON DELETE CASCADE,
  destination_key text NOT NULL, chat_id bigint, chat_title text, chat_type text, message_id bigint,
  delivery_status text NOT NULL DEFAULT 'pending' CHECK(delivery_status IN('pending','processing','sent','failed')),
  delivery_error text, attempt_count integer NOT NULL DEFAULT 0, last_attempt_at timestamptz, sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.withdrawal_log_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.withdrawal_log_deliveries FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.withdrawal_log_deliveries TO service_role;
CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawal_delivery_destination ON public.withdrawal_log_deliveries(withdrawal_id,destination_key);
CREATE INDEX IF NOT EXISTS idx_withdrawal_log_deliveries_status ON public.withdrawal_log_deliveries(delivery_status,updated_at DESC);

CREATE OR REPLACE FUNCTION public.assign_withdrawal_public_id() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN IF NEW.public_id IS NULL THEN NEW.public_id:='#ADR-'||nextval('public.withdrawal_public_seq')::text; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_assign_withdrawal_public_id ON public.withdrawals;
CREATE TRIGGER trg_assign_withdrawal_public_id BEFORE INSERT ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.assign_withdrawal_public_id();

CREATE OR REPLACE FUNCTION public.prevent_final_withdrawal_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN IF OLD.status IN('paid','rejected') THEN RAISE EXCEPTION 'Final withdrawal records are immutable'; END IF; RETURN COALESCE(NEW,OLD); END $$;
DROP TRIGGER IF EXISTS trg_prevent_final_withdrawal_mutation ON public.withdrawals;
CREATE TRIGGER trg_prevent_final_withdrawal_mutation BEFORE UPDATE OR DELETE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.prevent_final_withdrawal_mutation();

CREATE OR REPLACE FUNCTION public.process_withdrawal_admin(
  p_withdrawal_id uuid,p_action text,p_admin_telegram_id bigint,p_admin_name text DEFAULT NULL,
  p_txid text DEFAULT NULL,p_payment_reference text DEFAULT NULL,p_rejection_reason text DEFAULT NULL,p_fee numeric DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w public.withdrawals%ROWTYPE; new_status text;
BEGIN
  IF p_action NOT IN('approve','paid','reject') THEN RAISE EXCEPTION 'Invalid withdrawal action'; END IF;
  SELECT * INTO w FROM public.withdrawals WHERE id=p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF w.status IN('paid','rejected') THEN RAISE EXCEPTION 'Withdrawal is final and cannot be processed again'; END IF;
  IF p_action='approve' THEN
    IF w.status<>'pending' THEN RAISE EXCEPTION 'Only pending withdrawals can be approved'; END IF;
    UPDATE public.withdrawals SET status='approved',approved_at=now(),approved_by=p_admin_telegram_id WHERE id=p_withdrawal_id; new_status:='approved';
  ELSIF p_action='paid' THEN
    IF w.status<>'approved' THEN RAISE EXCEPTION 'Withdrawal must be approved before marking paid'; END IF;
    IF w.method IN('ton','usdt_polygon') AND COALESCE(trim(p_txid),'')='' THEN RAISE EXCEPTION 'TXID is required for blockchain withdrawals'; END IF;
    IF w.method='upi' AND COALESCE(trim(p_payment_reference),'')='' THEN RAISE EXCEPTION 'Payment reference/UTR is required for UPI withdrawals'; END IF;
    UPDATE public.withdrawals SET status='paid',txid=NULLIF(trim(p_txid),''),payment_reference=NULLIF(trim(p_payment_reference),''),fee=GREATEST(COALESCE(p_fee,0),0),processed_at=now(),processed_by=p_admin_telegram_id,processed_by_name=NULLIF(trim(p_admin_name),'') WHERE id=p_withdrawal_id; new_status:='paid';
  ELSE
    IF w.status<>'pending' THEN RAISE EXCEPTION 'Only pending withdrawals can be rejected'; END IF;
    IF COALESCE(trim(p_rejection_reason),'')='' THEN RAISE EXCEPTION 'Rejection reason is required'; END IF;
    UPDATE public.withdrawals SET status='rejected',rejection_reason=left(trim(p_rejection_reason),1000),admin_note=left(trim(p_rejection_reason),500),processed_at=now(),processed_by=p_admin_telegram_id,processed_by_name=NULLIF(trim(p_admin_name),'') WHERE id=p_withdrawal_id; new_status:='rejected';
  END IF;
  INSERT INTO public.admin_logs(admin_telegram_id,action,target_user_id,details) VALUES(p_admin_telegram_id,'withdrawal_'||new_status,w.user_id,jsonb_build_object('withdrawalId',p_withdrawal_id,'publicId',w.public_id,'fromStatus',w.status,'toStatus',new_status,'txid',NULLIF(trim(p_txid),''),'paymentReference',NULLIF(trim(p_payment_reference),''),'rejectionReason',NULLIF(trim(p_rejection_reason),''),'fee',GREATEST(COALESCE(p_fee,0),0)));
  RETURN jsonb_build_object('success',true,'withdrawalId',p_withdrawal_id,'status',new_status);
END $$;
REVOKE ALL ON FUNCTION public.process_withdrawal_admin(uuid,text,bigint,text,text,text,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_withdrawal_admin(uuid,text,bigint,text,text,text,text,numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_adsreward_telegram_router() RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE worker_token text; request_id bigint;
BEGIN
  SELECT public.get_bot_internal_secret('adsreward_bot_worker_token') INTO worker_token;
  SELECT net.http_post(url:='https://eoppaqrqlpyqoizohoba.supabase.co/functions/v1/telegram-router',headers:=jsonb_build_object('Content-Type','application/json','x-bot-worker-token',worker_token),body:=jsonb_build_object('action','sync-webhook')) INTO request_id;
  RETURN request_id;
END $$;
REVOKE ALL ON FUNCTION public.sync_adsreward_telegram_router() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_adsreward_telegram_router() TO service_role;
DO $$ DECLARE j record; BEGIN FOR j IN SELECT jobid FROM cron.job WHERE jobname='adsreward-telegram-router-sync' LOOP PERFORM cron.unschedule(j.jobid); END LOOP; END $$;
SELECT cron.schedule('adsreward-telegram-router-sync','* * * * *','select public.sync_adsreward_telegram_router();');

COMMIT;
