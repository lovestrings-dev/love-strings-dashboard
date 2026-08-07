-- Platforms are a global reference catalog. Accounts and all workspace data
-- beneath them are independently owned and isolated.

alter table public.platform_accounts add column workspace_id uuid references public.app_workspaces(id) on delete cascade;
alter table public.content_posts add column workspace_id uuid references public.app_workspaces(id) on delete cascade;
alter table public.platform_metric_snapshots add column workspace_id uuid references public.app_workspaces(id) on delete cascade;
alter table public.songs add column workspace_id uuid references public.app_workspaces(id) on delete cascade;
alter table public.releases add column workspace_id uuid references public.app_workspaces(id) on delete cascade;
alter table public.import_logs add column workspace_id uuid references public.app_workspaces(id) on delete cascade;

update public.platform_accounts set workspace_id = '00000000-0000-0000-0000-000000000001';
update public.content_posts set workspace_id = '00000000-0000-0000-0000-000000000001';
update public.platform_metric_snapshots set workspace_id = '00000000-0000-0000-0000-000000000001';
update public.songs set workspace_id = '00000000-0000-0000-0000-000000000001';
update public.releases set workspace_id = '00000000-0000-0000-0000-000000000001';
update public.import_logs set workspace_id = '00000000-0000-0000-0000-000000000001';

alter table public.platform_accounts alter column workspace_id set not null;
alter table public.content_posts alter column workspace_id set not null;
alter table public.platform_metric_snapshots alter column workspace_id set not null;
alter table public.songs alter column workspace_id set not null;
alter table public.releases alter column workspace_id set not null;
alter table public.import_logs alter column workspace_id set not null;

alter table public.platform_accounts alter column workspace_id set default '00000000-0000-0000-0000-000000000001';
alter table public.content_posts alter column workspace_id set default '00000000-0000-0000-0000-000000000001';
alter table public.platform_metric_snapshots alter column workspace_id set default '00000000-0000-0000-0000-000000000001';
alter table public.songs alter column workspace_id set default '00000000-0000-0000-0000-000000000001';
alter table public.releases alter column workspace_id set default '00000000-0000-0000-0000-000000000001';
alter table public.import_logs alter column workspace_id set default '00000000-0000-0000-0000-000000000001';

alter table public.platform_accounts drop constraint platform_accounts_platform_id_account_name_key;
alter table public.platform_accounts add constraint platform_accounts_workspace_platform_name_key
  unique (workspace_id, platform_id, account_name);

drop index public.platform_metric_snapshots_unique_snapshot_idx;
create unique index platform_metric_snapshots_unique_snapshot_idx
on public.platform_metric_snapshots (
  workspace_id, snapshot_date, platform_id, platform_account_id,
  content_post_id, song_id, release_id, metric_name, source
) nulls not distinct;

alter table public.songs drop constraint songs_isrc_key;
alter table public.songs add constraint songs_workspace_isrc_key unique (workspace_id, isrc);
alter table public.releases drop constraint releases_upc_key;
alter table public.releases add constraint releases_workspace_upc_key unique (workspace_id, upc);

create index platform_accounts_workspace_id_idx on public.platform_accounts (workspace_id);
create index content_posts_workspace_id_idx on public.content_posts (workspace_id);
create index platform_metric_snapshots_workspace_date_idx
  on public.platform_metric_snapshots (workspace_id, snapshot_date desc);
create index songs_workspace_id_idx on public.songs (workspace_id);
create index releases_workspace_date_idx on public.releases (workspace_id, release_date desc);

drop policy if exists "Members can read platforms" on public.platforms;
create policy "Workspace members can read platforms" on public.platforms
for select to authenticated using (exists (
  select 1 from public.app_workspace_members membership
  where membership.user_id = auth.uid()
));
drop policy if exists "Members can read platform accounts" on public.platform_accounts;
create policy "Workspace members can read platform accounts" on public.platform_accounts
for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists "Members can read content posts" on public.content_posts;
create policy "Workspace members can read content posts" on public.content_posts
for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists "Members can read platform metric snapshots" on public.platform_metric_snapshots;
create policy "Workspace members can read platform metric snapshots"
on public.platform_metric_snapshots
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace members can read songs" on public.songs
for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists "Members can read releases" on public.releases;
create policy "Workspace members can read releases" on public.releases
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace members can read release songs" on public.release_songs
for select to authenticated using (exists (
  select 1 from public.releases release
  where release.id = release_id and public.is_workspace_member(release.workspace_id)
));
create policy "Workspace members can read import logs" on public.import_logs
for select to authenticated using (public.is_workspace_member(workspace_id));
