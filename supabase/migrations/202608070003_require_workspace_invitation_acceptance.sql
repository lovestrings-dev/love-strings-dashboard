-- Authentication creates an identity only. Workspace membership is created
-- exclusively when a matching, pending workspace invitation is accepted.

create table public.app_workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  token_hash text not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete restrict,
  check (email = lower(email))
);

create unique index app_workspace_invitations_pending_email_workspace_key
on public.app_workspace_invitations (workspace_id, email)
where accepted_at is null;

alter table public.app_workspace_invitations enable row level security;

create or replace function public.enrol_app_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_enrol_love_strings on auth.users;
drop trigger if exists on_auth_user_created_enrol_app_user on auth.users;
create trigger on_auth_user_created_enrol_app_user
after insert on auth.users
for each row execute function public.enrol_app_user();

drop policy if exists "Users can read their dashboard preferences" on public.dashboard_preferences;
create policy "Users can read their dashboard preferences" on public.dashboard_preferences
for select to authenticated
using (user_id = auth.uid() and public.is_workspace_member(workspace_id));

drop policy if exists "Users can insert their dashboard preferences" on public.dashboard_preferences;
create policy "Users can insert their dashboard preferences" on public.dashboard_preferences
for insert to authenticated
with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

drop policy if exists "Users can update their dashboard preferences" on public.dashboard_preferences;
create policy "Users can update their dashboard preferences" on public.dashboard_preferences
for update to authenticated
using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
