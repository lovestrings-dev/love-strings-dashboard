-- Shared Focus Queue tasks that do not belong to Marketing or Production.
-- Browser access stays private; the app reads and writes through its server route.

create table public.focus_other_tasks (
  id uuid primary key default gen_random_uuid(),
  stable_key text not null unique,
  title text not null default '',
  notes text not null default '',
  due_date date not null,
  status text not null default 'not-started',
  source text not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('not-started', 'in-progress', 'done', 'irrelevant'))
);

create index focus_other_tasks_status_due_date_idx
  on public.focus_other_tasks (status, due_date);

create trigger focus_other_tasks_set_updated_at
before update on public.focus_other_tasks
for each row execute function public.set_updated_at();

alter table public.focus_other_tasks enable row level security;
