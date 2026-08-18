-- A linked Instagram professional account is a Page-scoped asset of the
-- Facebook Login connection, never a separate creator-social authorization.

alter table public.app_meta_discovered_assets
  add column parent_external_id text;
alter table public.app_meta_discovered_assets
  drop constraint app_meta_discovered_assets_account_type_check;
alter table public.app_meta_discovered_assets
  add constraint app_meta_discovered_assets_account_type_check
    check (account_type in ('facebook_page', 'instagram_professional'));
alter table public.app_meta_discovered_assets
  drop constraint app_meta_discovered_assets_asset_state_check;
alter table public.app_meta_discovered_assets
  add constraint app_meta_discovered_assets_asset_state_check
    check (asset_state in ('available', 'missing', 'conflict', 'skipped'));
create index app_meta_discovered_assets_parent_idx
  on public.app_meta_discovered_assets (connection_id, account_type, parent_external_id);

create table public.app_meta_active_instagram_bindings (
  external_id text primary key check (char_length(external_id) > 0),
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  connection_id uuid not null references public.app_meta_connections(id) on delete cascade,
  mapping_id uuid not null references public.app_meta_connection_accounts(id) on delete cascade,
  parent_page_external_id text not null check (char_length(parent_page_external_id) > 0),
  created_at timestamptz not null default now(),
  unique (mapping_id)
);
alter table public.app_meta_active_instagram_bindings enable row level security;
revoke all on table public.app_meta_active_instagram_bindings from public, anon, authenticated;

create function public.select_meta_linked_instagram(
  p_workspace_id uuid,
  p_connection_id uuid,
  p_page_external_id text,
  p_instagram_external_id text
)
returns table (mapping_id uuid, platform_account_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_candidate public.app_meta_discovered_assets%rowtype;
  v_platform_id uuid;
  v_page_account_id uuid;
  v_account_id uuid;
  v_mapping_id uuid;
begin
  select * into v_candidate from public.app_meta_discovered_assets
  where workspace_id = p_workspace_id and connection_id = p_connection_id
    and account_type = 'instagram_professional' and external_id = p_instagram_external_id
    and parent_external_id = p_page_external_id and asset_state = 'available'
  for update;
  if not found then raise exception 'Selected linked Instagram candidate is unavailable.'; end if;
  select platform_account_id into v_page_account_id from public.app_meta_connection_accounts
  where workspace_id = p_workspace_id and connection_id = p_connection_id
    and account_type = 'facebook_page' and is_selected
  for update;
  if v_page_account_id is null then raise exception 'Select the linked Facebook Page first.'; end if;
  select id into v_platform_id from public.platforms where slug = 'instagram';
  if v_platform_id is null then raise exception 'Instagram platform is unavailable.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_instagram_external_id, 0));
  if exists (select 1 from public.app_meta_active_instagram_bindings b
    where b.external_id = p_instagram_external_id and b.workspace_id <> p_workspace_id) then
    raise exception 'This linked Instagram account is already selected in another workspace.';
  end if;
  delete from public.app_meta_active_instagram_bindings
    where workspace_id = p_workspace_id and connection_id = p_connection_id
      and external_id <> p_instagram_external_id;
  update public.app_meta_connection_accounts set is_selected = false, asset_state = 'discovered'
    where workspace_id = p_workspace_id and connection_id = p_connection_id
      and account_type = 'instagram_professional' and is_selected;
  insert into public.platform_accounts (workspace_id, platform_id, account_name, external_id, meta_external_id)
  values (p_workspace_id, v_platform_id, v_candidate.display_name, p_instagram_external_id, p_instagram_external_id)
  on conflict (workspace_id, platform_id, meta_external_id) where meta_external_id is not null
  do update set account_name = excluded.account_name, external_id = excluded.external_id
  returning id into v_account_id;
  insert into public.app_meta_connection_accounts
    (workspace_id, connection_id, platform_account_id, account_type, parent_platform_account_id, is_selected, asset_state)
  values (p_workspace_id, p_connection_id, v_account_id, 'instagram_professional', v_page_account_id, true, 'selected')
  on conflict (connection_id, platform_account_id)
  do update set parent_platform_account_id = excluded.parent_platform_account_id, is_selected = true, asset_state = 'selected'
  returning id into v_mapping_id;
  insert into public.app_meta_active_instagram_bindings
    (external_id, workspace_id, connection_id, mapping_id, parent_page_external_id)
  values (p_instagram_external_id, p_workspace_id, p_connection_id, v_mapping_id, p_page_external_id)
  on conflict (external_id) do update set workspace_id = excluded.workspace_id,
    connection_id = excluded.connection_id, mapping_id = excluded.mapping_id,
    parent_page_external_id = excluded.parent_page_external_id;
  return query select v_mapping_id, v_account_id;
end;
$$;
revoke all on function public.select_meta_linked_instagram(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.select_meta_linked_instagram(uuid, uuid, text, text) to service_role;
