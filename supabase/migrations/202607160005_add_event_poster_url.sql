alter table public.events
  add column if not exists poster_url text not null default '';
