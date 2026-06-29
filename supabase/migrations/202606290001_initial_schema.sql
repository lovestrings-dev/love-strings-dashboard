-- Love Strings Dashboard initial database schema.
-- Designed for Supabase PostgreSQL with private app access first.

create extension if not exists pgcrypto;

create table public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  isrc text unique,
  status text not null default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.releases (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  release_type text not null default 'single',
  release_date date,
  upc text unique,
  status text not null default 'planned',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.release_songs (
  release_id uuid not null references public.releases(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  track_number integer,
  created_at timestamptz not null default now(),
  primary key (release_id, song_id)
);

create table public.platforms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  created_at timestamptz not null default now()
);

create table public.platform_accounts (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.platforms(id) on delete restrict,
  account_name text not null,
  external_id text,
  url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform_id, account_name)
);

create table public.content_posts (
  id uuid primary key default gen_random_uuid(),
  platform_account_id uuid not null references public.platform_accounts(id) on delete cascade,
  title text,
  content_type text not null default 'post',
  external_id text,
  url text,
  published_at timestamptz,
  related_song_id uuid references public.songs(id) on delete set null,
  related_release_id uuid references public.releases(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform_account_id, external_id)
);

create table public.platform_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  platform_id uuid not null references public.platforms(id) on delete restrict,
  platform_account_id uuid references public.platform_accounts(id) on delete cascade,
  content_post_id uuid references public.content_posts(id) on delete cascade,
  song_id uuid references public.songs(id) on delete set null,
  release_id uuid references public.releases(id) on delete set null,
  metric_name text not null,
  metric_value numeric not null,
  metric_unit text not null default 'count',
  source text not null default 'manual',
  imported_at timestamptz not null default now(),
  notes text
);

create table public.sprints (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date,
  ends_on date,
  status text not null default 'planned',
  goal text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid references public.sprints(id) on delete set null,
  title text not null,
  status text not null default 'todo',
  priority text not null default 'normal',
  owner text,
  due_on date,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.budget_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null,
  category text not null,
  description text not null,
  amount numeric(12, 2) not null,
  currency char(3) not null default 'EUR',
  vendor text,
  related_release_id uuid references public.releases(id) on delete set null,
  related_song_id uuid references public.songs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.import_logs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_file text,
  import_status text not null default 'started',
  records_seen integer not null default 0,
  records_inserted integer not null default 0,
  records_updated integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index platform_metric_snapshots_date_idx
  on public.platform_metric_snapshots (snapshot_date desc);

create index platform_metric_snapshots_metric_idx
  on public.platform_metric_snapshots (metric_name);

create unique index platform_metric_snapshots_unique_snapshot_idx
  on public.platform_metric_snapshots (
    snapshot_date,
    platform_id,
    platform_account_id,
    content_post_id,
    song_id,
    release_id,
    metric_name,
    source
  )
  nulls not distinct;

create index content_posts_published_at_idx
  on public.content_posts (published_at desc);

create index tasks_status_due_on_idx
  on public.tasks (status, due_on);

create index budget_transactions_date_idx
  on public.budget_transactions (transaction_date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger songs_set_updated_at
before update on public.songs
for each row execute function public.set_updated_at();

create trigger releases_set_updated_at
before update on public.releases
for each row execute function public.set_updated_at();

create trigger platform_accounts_set_updated_at
before update on public.platform_accounts
for each row execute function public.set_updated_at();

create trigger content_posts_set_updated_at
before update on public.content_posts
for each row execute function public.set_updated_at();

create trigger sprints_set_updated_at
before update on public.sprints
for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create trigger budget_transactions_set_updated_at
before update on public.budget_transactions
for each row execute function public.set_updated_at();

alter table public.songs enable row level security;
alter table public.releases enable row level security;
alter table public.release_songs enable row level security;
alter table public.platforms enable row level security;
alter table public.platform_accounts enable row level security;
alter table public.content_posts enable row level security;
alter table public.platform_metric_snapshots enable row level security;
alter table public.sprints enable row level security;
alter table public.tasks enable row level security;
alter table public.budget_transactions enable row level security;
alter table public.import_logs enable row level security;

-- Private-by-default policies. Supabase service-role/API jobs can bypass RLS.
-- User-facing read/write policies should be added when Supabase Auth is enabled.

insert into public.platforms (slug, name, category)
values
  ('youtube', 'YouTube', 'video'),
  ('instagram', 'Instagram', 'social'),
  ('tiktok', 'TikTok', 'social'),
  ('spotify', 'Spotify', 'streaming'),
  ('apple-music', 'Apple Music', 'streaming'),
  ('website', 'Website', 'web'),
  ('distributor', 'Distributor', 'distribution')
on conflict (slug) do update
set
  name = excluded.name,
  category = excluded.category;
