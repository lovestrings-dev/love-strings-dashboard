-- Budget source buckets.
-- Adds a durable classification layer for Budget analysis by business area:
-- Events, Production, and Marketing.

alter table public.budget_entries
  add column budget_bucket text not null default 'production';

alter table public.budget_entries
  add constraint budget_entries_budget_bucket_check
  check (budget_bucket in ('events', 'production', 'marketing'));

update public.budget_entries
set budget_bucket = 'events'
where lower(description) like '%pickwick%'
   or lower(description) like '%gig%'
   or lower(description) like '%wedding%'
   or lower(description) like '%lebenszeit%'
   or lower(description) like '%event%';

update public.budget_entries
set budget_bucket = 'marketing'
where lower(description) like '%canva%'
   or lower(description) like '%photo%'
   or lower(description) like '%ads%'
   or lower(description) like '%marketing%'
   or lower(description) like '%promo%';

update public.budget_entries
set budget_bucket = 'production'
where stable_key in (
  'suno',
  'cla-plugins',
  'landr',
  'intro-release',
  'wl-licence',
  'wl-release',
  'flowers-license',
  'flowers-release',
  'rock-and-roll-license',
  'rock-and-roll-release'
);

create index budget_entries_bucket_idx
  on public.budget_entries (budget_bucket);
