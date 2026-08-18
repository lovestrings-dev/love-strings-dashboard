-- The RPC return column `platform_account_id` is also a PL/pgSQL output
-- variable. Referencing that name in an inferred ON CONFLICT column list is
-- ambiguous, so use the existing unique constraint explicitly.

create or replace function public.select_meta_facebook_page(p_workspace_id uuid, p_connection_id uuid, p_external_id text)
returns table (mapping_id uuid, platform_account_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_candidate public.app_meta_discovered_assets%rowtype;
  v_platform_id uuid;
  v_account_id uuid;
  v_mapping_id uuid;
begin
  select * into v_candidate from public.app_meta_discovered_assets
  where workspace_id = p_workspace_id and connection_id = p_connection_id
    and account_type = 'facebook_page' and external_id = p_external_id and asset_state = 'available'
  for update;
  if not found then raise exception 'Selected Meta Page candidate is unavailable.'; end if;
  perform 1 from public.app_meta_connections where id = p_connection_id and workspace_id = p_workspace_id for update;
  if not found then raise exception 'Meta connection is unavailable in this workspace.'; end if;
  select id into v_platform_id from public.platforms where slug = 'facebook';
  if v_platform_id is null then raise exception 'Facebook platform is unavailable.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_external_id, 0));
  if exists (select 1 from public.app_meta_active_page_bindings b where b.external_id = p_external_id and b.workspace_id <> p_workspace_id) then
    raise exception 'This Facebook Page is already selected in another workspace.';
  end if;
  delete from public.app_meta_active_page_bindings where workspace_id = p_workspace_id and connection_id = p_connection_id and external_id <> p_external_id;
  update public.app_meta_connection_accounts set is_selected = false, asset_state = 'discovered'
  where workspace_id = p_workspace_id and connection_id = p_connection_id and account_type = 'facebook_page' and is_selected;
  insert into public.platform_accounts (workspace_id, platform_id, account_name, external_id, meta_external_id)
  values (p_workspace_id, v_platform_id, v_candidate.display_name, p_external_id, p_external_id)
  on conflict (workspace_id, platform_id, meta_external_id) where meta_external_id is not null
  do update set account_name = excluded.account_name, external_id = excluded.external_id
  returning id into v_account_id;
  insert into public.app_meta_connection_accounts (workspace_id, connection_id, platform_account_id, account_type, is_selected, asset_state)
  values (p_workspace_id, p_connection_id, v_account_id, 'facebook_page', true, 'selected')
  on conflict on constraint app_meta_connection_accounts_connection_id_platform_account_key
  do update set is_selected = true, asset_state = 'selected'
  returning id into v_mapping_id;
  insert into public.app_meta_active_page_bindings (external_id, workspace_id, connection_id, mapping_id)
  values (p_external_id, p_workspace_id, p_connection_id, v_mapping_id)
  on conflict (external_id) do update set workspace_id = excluded.workspace_id, connection_id = excluded.connection_id, mapping_id = excluded.mapping_id;
  update public.app_meta_connections set connection_state = 'connected', last_error_code = null, last_error_summary = null
  where id = p_connection_id and workspace_id = p_workspace_id;
  return query select v_mapping_id, v_account_id;
end;
$$;
