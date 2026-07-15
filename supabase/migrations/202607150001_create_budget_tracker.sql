-- Budget tracker schema.
-- Stores user-editable ledger rows and preferences for generated rows hidden
-- from Budget. Derived rows from Events, Production, Marketing, and recurring
-- plans stay computed by the app to avoid duplicate financial records.

create table public.budget_entries (
  id uuid primary key default gen_random_uuid(),
  stable_key text not null unique,
  entry_date date not null,
  description text not null default '',
  amount numeric(12, 2) not null default 0,
  entry_type text not null default 'one-off',
  recurring_cadence text,
  payment_plan_end_date date,
  source text not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (entry_type in ('earned', 'spent', 'one-off', 'recurring')),
  check (recurring_cadence is null or recurring_cadence in ('monthly', 'yearly'))
);

create table public.budget_hidden_generated_entries (
  id uuid primary key default gen_random_uuid(),
  generated_entry_id text not null unique,
  created_at timestamptz not null default now()
);

create index budget_entries_date_idx
  on public.budget_entries (entry_date desc);

create index budget_entries_type_idx
  on public.budget_entries (entry_type);

create trigger budget_entries_set_updated_at
before update on public.budget_entries
for each row execute function public.set_updated_at();

alter table public.budget_entries enable row level security;
alter table public.budget_hidden_generated_entries enable row level security;
