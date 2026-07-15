-- Add an "Other" source bucket and let Production-owned budget lines choose
-- their own Budget bucket before they generate ledger rows.

alter table public.budget_entries
  drop constraint if exists budget_entries_budget_bucket_check;

alter table public.budget_entries
  add constraint budget_entries_budget_bucket_check
  check (budget_bucket in ('events', 'production', 'marketing', 'other'));

alter table public.production_budget_lines
  add column budget_bucket text not null default 'production';

alter table public.production_budget_lines
  add constraint production_budget_lines_budget_bucket_check
  check (budget_bucket in ('events', 'production', 'marketing', 'other'));

create index production_budget_lines_bucket_idx
  on public.production_budget_lines (budget_bucket);
