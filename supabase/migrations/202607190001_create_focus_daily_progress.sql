-- Daily Focus Queue achievement records for future consistency analysis.
-- One task can contribute at most one current status per Vienna calendar day.

create table public.focus_daily_progress (
  id uuid primary key default gen_random_uuid(),
  activity_date date not null,
  task_key text not null,
  source text not null,
  label text not null default '',
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_date, task_key),
  check (source in ('Marketing', 'Production', 'Other')),
  check (status in ('not-started', 'in-progress', 'done', 'irrelevant'))
);

create index focus_daily_progress_date_idx
  on public.focus_daily_progress (activity_date desc);

create trigger focus_daily_progress_set_updated_at
before update on public.focus_daily_progress
for each row execute function public.set_updated_at();

alter table public.focus_daily_progress enable row level security;
