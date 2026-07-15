-- Let Event-owned budget lines choose whether they belong to Events,
-- Marketing, or Other before generating Budget ledger rows.

alter table public.event_budget_lines
  add column budget_bucket text not null default 'events';

alter table public.event_budget_lines
  add constraint event_budget_lines_budget_bucket_check
  check (budget_bucket in ('events', 'marketing', 'other'));

create index event_budget_lines_bucket_idx
  on public.event_budget_lines (budget_bucket);
