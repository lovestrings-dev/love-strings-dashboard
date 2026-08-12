-- A workspace calendar is an IANA timezone, not a user or server setting.
alter table public.app_workspace_settings
  add column if not exists timezone text not null default 'Europe/Vienna';

update public.app_workspace_settings
set timezone = 'Europe/Vienna'
where timezone is null or btrim(timezone) = '';
