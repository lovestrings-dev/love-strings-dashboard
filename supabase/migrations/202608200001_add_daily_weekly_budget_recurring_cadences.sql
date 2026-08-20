-- Extend the existing Budget recurrence constraint without rewriting rows.
alter table public.budget_entries
  drop constraint if exists budget_entries_recurring_cadence_check;

alter table public.budget_entries
  add constraint budget_entries_recurring_cadence_check
  check (
    recurring_cadence is null
    or recurring_cadence in ('daily', 'weekly', 'monthly', 'yearly')
  );
