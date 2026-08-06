-- Individual accounts share one Love Strings workspace while keeping personal UI preferences.
-- Public signup must remain disabled in Supabase Auth; invited users are enrolled automatically.

create table public.app_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_workspace_members (
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  check (role in ('owner', 'member'))
);

create table public.dashboard_preferences (
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  visible_cards jsonb not null default '[]'::jsonb,
  card_order jsonb not null default '[]'::jsonb,
  theme text not null default 'light',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  check (theme in ('light', 'dark'))
);

insert into public.app_workspaces (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Love Strings', 'love-strings')
on conflict (slug) do nothing;

create or replace function public.enrol_love_strings_user()
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

  insert into public.app_workspace_members (workspace_id, user_id, role)
  values ('00000000-0000-0000-0000-000000000001', new.id, 'member')
  on conflict (workspace_id, user_id) do nothing;

  insert into public.dashboard_preferences (workspace_id, user_id)
  values ('00000000-0000-0000-0000-000000000001', new.id)
  on conflict (workspace_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_enrol_love_strings on auth.users;
create trigger on_auth_user_created_enrol_love_strings
after insert on auth.users
for each row execute function public.enrol_love_strings_user();

insert into public.app_profiles (id, display_name)
select id, coalesce(raw_user_meta_data ->> 'display_name', split_part(email, '@', 1), '')
from auth.users
on conflict (id) do nothing;

insert into public.app_workspace_members (workspace_id, user_id, role)
select '00000000-0000-0000-0000-000000000001', id, 'member'
from auth.users
on conflict (workspace_id, user_id) do nothing;

insert into public.dashboard_preferences (workspace_id, user_id)
select '00000000-0000-0000-0000-000000000001', id
from auth.users
on conflict (workspace_id, user_id) do nothing;

create or replace function public.is_love_strings_member(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_workspace_members
    where workspace_id = '00000000-0000-0000-0000-000000000001'
      and user_id = check_user_id
  );
$$;

alter table public.app_profiles enable row level security;
alter table public.app_workspaces enable row level security;
alter table public.app_workspace_members enable row level security;
alter table public.dashboard_preferences enable row level security;

create policy "Users can read their profile" on public.app_profiles
for select to authenticated using (id = auth.uid());
create policy "Users can update their profile" on public.app_profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Members can read their workspace" on public.app_workspaces
for select to authenticated using (public.is_love_strings_member());
create policy "Members can read their membership" on public.app_workspace_members
for select to authenticated using (user_id = auth.uid());
create policy "Users can read their dashboard preferences" on public.dashboard_preferences
for select to authenticated using (user_id = auth.uid() and public.is_love_strings_member());
create policy "Users can insert their dashboard preferences" on public.dashboard_preferences
for insert to authenticated with check (user_id = auth.uid() and public.is_love_strings_member());
create policy "Users can update their dashboard preferences" on public.dashboard_preferences
for update to authenticated using (user_id = auth.uid() and public.is_love_strings_member())
with check (user_id = auth.uid() and public.is_love_strings_member());

create trigger app_profiles_set_updated_at before update on public.app_profiles
for each row execute function public.set_updated_at();
create trigger app_workspaces_set_updated_at before update on public.app_workspaces
for each row execute function public.set_updated_at();
create trigger dashboard_preferences_set_updated_at before update on public.dashboard_preferences
for each row execute function public.set_updated_at();

-- Replace anonymous reads with authenticated workspace-member reads.
drop policy if exists "Allow public read of marketing campaigns" on public.marketing_campaigns;
drop policy if exists "Allow public read of marketing campaign days" on public.marketing_campaign_days;
drop policy if exists "Allow public read of marketing campaign tasks" on public.marketing_campaign_tasks;
drop policy if exists "Allow public read of marketing campaign budget lines" on public.marketing_campaign_budget_lines;
drop policy if exists "Allow public read of production songs" on public.production_songs;
drop policy if exists "Allow public read of production steps" on public.production_steps;
drop policy if exists "Allow public read of production step tasks" on public.production_step_tasks;
drop policy if exists "Allow public read of production budget lines" on public.production_budget_lines;
drop policy if exists "Allow public read of roadmap phases" on public.roadmap_phases;
drop policy if exists "Allow public read of platforms" on public.platforms;
drop policy if exists "Allow public read of platform accounts" on public.platform_accounts;
drop policy if exists "Allow public read of content posts" on public.content_posts;
drop policy if exists "Allow public read of releases" on public.releases;
drop policy if exists "Allow public read of platform metric snapshots" on public.platform_metric_snapshots;

create policy "Members can read marketing campaigns" on public.marketing_campaigns
for select to authenticated using (public.is_love_strings_member());
create policy "Members can read marketing campaign days" on public.marketing_campaign_days
for select to authenticated using (public.is_love_strings_member());
create policy "Members can read marketing campaign tasks" on public.marketing_campaign_tasks
for select to authenticated using (public.is_love_strings_member());
create policy "Members can read marketing campaign budget lines" on public.marketing_campaign_budget_lines
for select to authenticated using (public.is_love_strings_member());
create policy "Members can read production songs" on public.production_songs
for select to authenticated using (public.is_love_strings_member());
create policy "Members can read production steps" on public.production_steps
for select to authenticated using (public.is_love_strings_member());
create policy "Members can read production step tasks" on public.production_step_tasks
for select to authenticated using (public.is_love_strings_member());
create policy "Members can read production budget lines" on public.production_budget_lines
for select to authenticated using (public.is_love_strings_member());
create policy "Members can read roadmap phases" on public.roadmap_phases
for select to authenticated using (public.is_love_strings_member());
create policy "Members can read platforms" on public.platforms
for select to authenticated using (public.is_love_strings_member());
create policy "Members can read platform accounts" on public.platform_accounts
for select to authenticated using (public.is_love_strings_member());
create policy "Members can read content posts" on public.content_posts
for select to authenticated using (public.is_love_strings_member());
create policy "Members can read releases" on public.releases
for select to authenticated using (public.is_love_strings_member());
create policy "Members can read platform metric snapshots" on public.platform_metric_snapshots
for select to authenticated using (public.is_love_strings_member());

grant execute on function public.is_love_strings_member(uuid) to authenticated;
