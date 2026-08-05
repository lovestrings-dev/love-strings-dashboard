alter table public.marketing_campaigns
  add column if not exists show_progress_bar boolean not null default true;
