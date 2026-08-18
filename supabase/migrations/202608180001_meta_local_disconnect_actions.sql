-- Workspace-local Meta onboarding disconnects. These operations never revoke
-- provider authorization: they only clear the active workspace bindings and
-- dependent selected mappings needed by the onboarding UI.

create function public.disconnect_meta_linked_instagram(
  p_workspace_id uuid,
  p_connection_id uuid,
  p_page_external_id text,
  p_instagram_external_id text
)
returns table (disconnected boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_mapping_id uuid;
  v_connection_count integer;
begin
  select count(*) into v_connection_count from public.app_meta_connections
    where workspace_id = p_workspace_id and connection_kind = 'fstats_login_facebook_page';
  if v_connection_count <> 1 then raise exception 'Exactly one Meta App B connection is required.'; end if;

  perform 1 from public.app_meta_connection_accounts ca
    join public.platform_accounts pa on pa.id = ca.platform_account_id
    where ca.workspace_id = p_workspace_id and ca.connection_id = p_connection_id
      and ca.account_type = 'facebook_page' and ca.is_selected
      and pa.meta_external_id = p_page_external_id
    for update of ca;
  if not found then raise exception 'Selected Facebook Page does not match authoritative state.'; end if;

  select ca.id into v_mapping_id from public.app_meta_connection_accounts ca
    join public.platform_accounts pa on pa.id = ca.platform_account_id
    where ca.workspace_id = p_workspace_id and ca.connection_id = p_connection_id
      and ca.account_type = 'instagram_professional' and ca.is_selected
      and pa.meta_external_id = p_instagram_external_id
    for update of ca;
  if v_mapping_id is null then raise exception 'Selected Instagram account does not match authoritative state.'; end if;

  delete from public.app_meta_active_instagram_bindings
    where workspace_id = p_workspace_id and connection_id = p_connection_id
      and mapping_id = v_mapping_id and external_id = p_instagram_external_id;
  update public.app_meta_connection_accounts set
    is_selected = false, asset_state = 'disabled', last_error_code = null, last_error_summary = null
    where id = v_mapping_id and workspace_id = p_workspace_id and connection_id = p_connection_id;
  update public.app_meta_discovered_assets set asset_state = 'available'
    where workspace_id = p_workspace_id and connection_id = p_connection_id
      and account_type = 'instagram_professional' and external_id = p_instagram_external_id
      and parent_external_id = p_page_external_id and asset_state <> 'missing';
  return query select true;
end;
$$;

create function public.disconnect_meta_facebook_page(
  p_workspace_id uuid,
  p_connection_id uuid,
  p_page_external_id text
)
returns table (disconnected boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_connection_count integer;
begin
  select count(*) into v_connection_count from public.app_meta_connections
    where workspace_id = p_workspace_id and connection_kind = 'fstats_login_facebook_page';
  if v_connection_count <> 1 then raise exception 'Exactly one Meta App B connection is required.'; end if;

  perform 1 from public.app_meta_connection_accounts ca
    join public.platform_accounts pa on pa.id = ca.platform_account_id
    where ca.workspace_id = p_workspace_id and ca.connection_id = p_connection_id
      and ca.account_type = 'facebook_page' and ca.is_selected
      and pa.meta_external_id = p_page_external_id
    for update of ca;
  if not found then raise exception 'Selected Facebook Page does not match authoritative state.'; end if;

  delete from public.app_meta_active_instagram_bindings
    where workspace_id = p_workspace_id and connection_id = p_connection_id;
  update public.app_meta_connection_accounts set
    is_selected = false, asset_state = 'disabled', last_error_code = null, last_error_summary = null
    where workspace_id = p_workspace_id and connection_id = p_connection_id
      and account_type = 'instagram_professional';
  update public.app_meta_discovered_assets set asset_state = 'missing'
    where workspace_id = p_workspace_id and connection_id = p_connection_id
      and account_type = 'instagram_professional' and asset_state <> 'missing';

  delete from public.app_meta_active_page_bindings
    where workspace_id = p_workspace_id and connection_id = p_connection_id
      and external_id = p_page_external_id;
  update public.app_meta_connection_accounts set
    is_selected = false, asset_state = 'disabled', last_successful_sync_at = null,
    last_error_code = null, last_error_summary = null
    where workspace_id = p_workspace_id and connection_id = p_connection_id
      and account_type = 'facebook_page';
  update public.app_meta_connections set
    connection_state = 'awaiting_selection', last_error_code = null, last_error_summary = null
    where id = p_connection_id and workspace_id = p_workspace_id
      and connection_kind = 'fstats_login_facebook_page';
  return query select true;
end;
$$;

revoke all on function public.disconnect_meta_linked_instagram(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.disconnect_meta_facebook_page(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.disconnect_meta_linked_instagram(uuid, uuid, text, text) to service_role;
grant execute on function public.disconnect_meta_facebook_page(uuid, uuid, text) to service_role;
