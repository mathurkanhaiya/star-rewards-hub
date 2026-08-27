create table if not exists public.mandatory_channels (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  chat_id text not null,
  username text,
  join_url text not null,
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mandatory_channels_active_order_idx
  on public.mandatory_channels(is_active, sort_order, created_at);

alter table public.mandatory_channels enable row level security;
revoke all on public.mandatory_channels from anon, authenticated;

create table if not exists public.mandatory_join_checks (
  user_id uuid not null references public.users(id) on delete cascade,
  channel_id uuid not null references public.mandatory_channels(id) on delete cascade,
  is_joined boolean not null default false,
  telegram_status text,
  checked_at timestamptz not null default now(),
  primary key (user_id, channel_id)
);

alter table public.mandatory_join_checks enable row level security;
revoke all on public.mandatory_join_checks from anon, authenticated;
