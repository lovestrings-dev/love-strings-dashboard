-- Production tracker schema.
-- Stores song-level production plans, production steps, optional subtasks, and
-- production-linked budget rows.

create table public.production_songs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  production_deadline date not null,
  album_art_url text not null default '',
  source text not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.production_steps (
  id uuid primary key default gen_random_uuid(),
  production_song_id uuid not null references public.production_songs(id) on delete cascade,
  stable_key text not null,
  label text not null,
  step_deadline date not null,
  status text not null default 'not-started',
  notes text not null default '',
  position integer not null default 0,
  is_default_step boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (production_song_id, stable_key),
  check (status in ('not-started', 'in-progress', 'done'))
);

create table public.production_step_tasks (
  id uuid primary key default gen_random_uuid(),
  production_step_id uuid not null references public.production_steps(id) on delete cascade,
  title text not null,
  status text not null default 'not-started',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('not-started', 'in-progress', 'done'))
);

create table public.production_budget_lines (
  id uuid primary key default gen_random_uuid(),
  production_step_id uuid references public.production_steps(id) on delete cascade,
  production_step_task_id uuid references public.production_step_tasks(id) on delete cascade,
  description text not null default '',
  amount numeric(12, 2) not null default 0,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (production_step_id is not null and production_step_task_id is null) or
    (production_step_id is null and production_step_task_id is not null)
  )
);

create index production_songs_deadline_idx
  on public.production_songs (production_deadline);

create index production_steps_song_position_idx
  on public.production_steps (production_song_id, position);

create index production_step_tasks_step_position_idx
  on public.production_step_tasks (production_step_id, position);

create index production_budget_lines_step_position_idx
  on public.production_budget_lines (production_step_id, position);

create index production_budget_lines_task_position_idx
  on public.production_budget_lines (production_step_task_id, position);

create trigger production_songs_set_updated_at
before update on public.production_songs
for each row execute function public.set_updated_at();

create trigger production_steps_set_updated_at
before update on public.production_steps
for each row execute function public.set_updated_at();

create trigger production_step_tasks_set_updated_at
before update on public.production_step_tasks
for each row execute function public.set_updated_at();

create trigger production_budget_lines_set_updated_at
before update on public.production_budget_lines
for each row execute function public.set_updated_at();

alter table public.production_songs enable row level security;
alter table public.production_steps enable row level security;
alter table public.production_step_tasks enable row level security;
alter table public.production_budget_lines enable row level security;

create policy "Allow public read of production songs"
on public.production_songs
for select
to anon
using (true);

create policy "Allow public read of production steps"
on public.production_steps
for select
to anon
using (true);

create policy "Allow public read of production step tasks"
on public.production_step_tasks
for select
to anon
using (true);

create policy "Allow public read of production budget lines"
on public.production_budget_lines
for select
to anon
using (true);
