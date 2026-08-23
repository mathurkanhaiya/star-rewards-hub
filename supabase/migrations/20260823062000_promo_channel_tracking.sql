alter table public.promos
  add column if not exists channel_chat_id text,
  add column if not exists channel_message_id bigint,
  add column if not exists channel_last_synced_at timestamptz,
  add column if not exists channel_sync_error text;

comment on column public.promos.channel_chat_id is 'Telegram channel username or chat id used for the promo post';
comment on column public.promos.channel_message_id is 'Telegram message id for the live promo post';
comment on column public.promos.channel_last_synced_at is 'Last successful live claim counter sync to Telegram';
comment on column public.promos.channel_sync_error is 'Last Telegram promo post sync error, if any';
