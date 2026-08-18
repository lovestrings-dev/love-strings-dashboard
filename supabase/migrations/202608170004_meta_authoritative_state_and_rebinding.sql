-- Authoritative App B state transitions. All functions are service-role-only,
-- validate the sole workspace connection, and keep Page/Instagram rebinding
-- atomic. Provider calls remain outside transactions; start/success/failure are
-- persisted explicitly so the reader never infers completion from absence.

drop function if exists public.select_meta_facebook_page(uuid, uuid, text);
create function public.select_meta_facebook_page(p_workspace_id uuid, p_connection_id uuid, p_external_id text)
returns table (mapping_id uuid, platform_account_id uuid, page_changed boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_candidate public.app_meta_discovered_assets%rowtype;
  v_platform_id uuid;
  v_account_id uuid;
  v_mapping_id uuid;
  v_old_external_id text;
  v_connection_count integer;
begin
  select count(*) into v_connection_count from public.app_meta_connections
    where workspace_id = p_workspace_id and connection_kind = 'fstats_login_facebook_page';
  if v_connection_count <> 1 then raise exception 'Exactly one Meta App B connection is required.'; end if;
  perform 1 from public.app_meta_connections
    where id = p_connection_id and workspace_id = p_workspace_id
      and connection_kind = 'fstats_login_facebook_page'
      and connection_state not in ('reauthorization_required')
      and granted_scopes @> array['business_management', 'pages_show_list', 'pages_read_engagement',
        'read_insights', 'instagram_basic', 'instagram_manage_insights']::text[]
      and (token_expires_at is null or token_expires_at > now())
    for update;
  if not found then raise exception 'Meta connection is unavailable or requires authorization.'; end if;
  select * into v_candidate from public.app_meta_discovered_assets
    where workspace_id = p_workspace_id and connection_id = p_connection_id
      and account_type = 'facebook_page' and external_id = p_external_id and asset_state = 'available'
    for update;
  if not found then raise exception 'Selected Meta Page candidate is unavailable.'; end if;
  select pa.meta_external_id into v_old_external_id
    from public.app_meta_connection_accounts ca join public.platform_accounts pa on pa.id = ca.platform_account_id
    where ca.workspace_id = p_workspace_id and ca.connection_id = p_connection_id
      and ca.account_type = 'facebook_page' and ca.is_selected for update of ca;
  select id into v_platform_id from public.platforms where slug = 'facebook';
  if v_platform_id is null then raise exception 'Facebook platform is unavailable.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('facebook:' || p_external_id, 0));
  if exists (select 1 from public.app_meta_active_page_bindings
    where external_id = p_external_id and workspace_id <> p_workspace_id) then
    raise exception using errcode = 'P2001', message = 'This Facebook Page is already selected in another workspace.';
  end if;

  if v_old_external_id is distinct from p_external_id then
    delete from public.app_meta_active_instagram_bindings
      where workspace_id = p_workspace_id and connection_id = p_connection_id;
    update public.app_meta_connection_accounts set
      is_selected = false, asset_state = 'disabled', last_error_code = null, last_error_summary = null
      where workspace_id = p_workspace_id and connection_id = p_connection_id
        and account_type = 'instagram_professional';
    update public.app_meta_discovered_assets set asset_state = 'missing'
      where workspace_id = p_workspace_id and connection_id = p_connection_id
        and account_type = 'instagram_professional' and asset_state <> 'missing';
  end if;
  delete from public.app_meta_active_page_bindings
    where workspace_id = p_workspace_id and connection_id = p_connection_id and external_id <> p_external_id;
  update public.app_meta_connection_accounts set is_selected = false, asset_state = 'discovered'
    where workspace_id = p_workspace_id and connection_id = p_connection_id
      and account_type = 'facebook_page' and is_selected;
  insert into public.platform_accounts (workspace_id, platform_id, account_name, external_id, meta_external_id)
    values (p_workspace_id, v_platform_id, v_candidate.display_name, p_external_id, p_external_id)
    on conflict (workspace_id, platform_id, meta_external_id) where meta_external_id is not null
    do update set account_name = excluded.account_name, external_id = excluded.external_id
    returning id into v_account_id;
  insert into public.app_meta_connection_accounts
    (workspace_id, connection_id, platform_account_id, account_type, is_selected, asset_state,
     last_successful_sync_at, last_error_code, last_error_summary)
    values (p_workspace_id, p_connection_id, v_account_id, 'facebook_page', true, 'selected', null, null, null)
    on conflict on constraint app_meta_connection_accounts_connection_id_platform_account_key
    do update set is_selected = true, asset_state = 'selected', last_successful_sync_at = null,
      last_error_code = null, last_error_summary = null
    returning id into v_mapping_id;
  insert into public.app_meta_active_page_bindings (external_id, workspace_id, connection_id, mapping_id)
    values (p_external_id, p_workspace_id, p_connection_id, v_mapping_id)
    on conflict (external_id) do update set workspace_id = excluded.workspace_id,
      connection_id = excluded.connection_id, mapping_id = excluded.mapping_id;
  update public.app_meta_connections set connection_state = 'connected', last_error_code = null, last_error_summary = null
    where id = p_connection_id and workspace_id = p_workspace_id;
  return query select v_mapping_id, v_account_id, v_old_external_id is distinct from p_external_id;
end;
$$;

create or replace function public.start_meta_linked_instagram_discovery(
  p_workspace_id uuid, p_connection_id uuid, p_page_external_id text)
returns table (started boolean)
language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  select count(*) into v_count from public.app_meta_connections
    where workspace_id = p_workspace_id and connection_kind = 'fstats_login_facebook_page';
  if v_count <> 1 then raise exception 'Exactly one Meta App B connection is required.'; end if;
  update public.app_meta_connection_accounts ca set last_successful_sync_at = null,
    last_error_code = null, last_error_summary = null
    from public.platform_accounts pa where ca.platform_account_id = pa.id
      and ca.workspace_id = p_workspace_id and ca.connection_id = p_connection_id
      and ca.account_type = 'facebook_page' and ca.is_selected
      and pa.meta_external_id = p_page_external_id;
  if not found then raise exception 'Selected Facebook Page does not match authoritative state.'; end if;
  return query select true;
end;
$$;

create or replace function public.reconcile_meta_linked_instagram_discovery(
  p_workspace_id uuid, p_connection_id uuid, p_page_external_id text,
  p_instagram_external_id text, p_instagram_display_name text)
returns table (linked_instagram_external_id text)
language plpgsql security definer set search_path = public as $$
declare
  v_page_mapping_id uuid;
  v_selected_instagram_external_id text;
  v_old_candidate_state text;
begin
  select ca.id into v_page_mapping_id from public.app_meta_connection_accounts ca
    join public.platform_accounts pa on pa.id = ca.platform_account_id
    where ca.workspace_id = p_workspace_id and ca.connection_id = p_connection_id
      and ca.account_type = 'facebook_page' and ca.is_selected and pa.meta_external_id = p_page_external_id
    for update of ca;
  if v_page_mapping_id is null then raise exception 'Selected Facebook Page does not match authoritative state.'; end if;
  select pa.meta_external_id into v_selected_instagram_external_id
    from public.app_meta_connection_accounts ca join public.platform_accounts pa on pa.id = ca.platform_account_id
    where ca.workspace_id = p_workspace_id and ca.connection_id = p_connection_id
      and ca.account_type = 'instagram_professional' and ca.is_selected;
  update public.app_meta_discovered_assets set asset_state = 'missing'
    where workspace_id = p_workspace_id and connection_id = p_connection_id
      and account_type = 'instagram_professional'
      and (parent_external_id <> p_page_external_id or p_instagram_external_id is null or external_id <> p_instagram_external_id)
      and asset_state <> 'missing';
  if p_instagram_external_id is not null then
    if p_instagram_display_name is null or btrim(p_instagram_display_name) = '' then
      raise exception 'Linked Instagram display name is required.';
    end if;
    select asset_state into v_old_candidate_state from public.app_meta_discovered_assets
      where workspace_id = p_workspace_id and connection_id = p_connection_id
        and account_type = 'instagram_professional' and external_id = p_instagram_external_id
        and parent_external_id = p_page_external_id for update;
    insert into public.app_meta_discovered_assets
      (workspace_id, connection_id, account_type, external_id, display_name, parent_external_id, asset_state)
      values (p_workspace_id, p_connection_id, 'instagram_professional', p_instagram_external_id,
        p_instagram_display_name, p_page_external_id, case when v_old_candidate_state = 'skipped' then 'skipped' else 'available' end)
      on conflict (connection_id, account_type, external_id) do update set
        display_name = excluded.display_name, parent_external_id = excluded.parent_external_id,
        asset_state = case
          when public.app_meta_discovered_assets.asset_state = 'skipped'
            and public.app_meta_discovered_assets.parent_external_id = excluded.parent_external_id then 'skipped'
          else 'available' end;
  end if;
  if v_selected_instagram_external_id is not null
    and v_selected_instagram_external_id is distinct from p_instagram_external_id then
    delete from public.app_meta_active_instagram_bindings
      where workspace_id = p_workspace_id and connection_id = p_connection_id
        and external_id = v_selected_instagram_external_id;
    update public.app_meta_connection_accounts ca set is_selected = false, asset_state = 'disabled',
      last_error_code = 'selected_linked_instagram_missing',
      last_error_summary = 'The account is no longer linked to the selected Facebook Page.'
      from public.platform_accounts pa where ca.platform_account_id = pa.id
        and ca.workspace_id = p_workspace_id and ca.connection_id = p_connection_id
        and ca.account_type = 'instagram_professional' and pa.meta_external_id = v_selected_instagram_external_id;
    update public.app_meta_connection_accounts set asset_state = 'degraded',
      last_error_code = 'selected_linked_instagram_missing',
      last_error_summary = 'The selected linked Instagram account is no longer available from the selected Facebook Page.'
      where id = v_page_mapping_id;
  else
    update public.app_meta_connection_accounts set last_successful_sync_at = now(),
      last_error_code = null, last_error_summary = null where id = v_page_mapping_id;
  end if;
  return query select p_instagram_external_id;
end;
$$;

create or replace function public.record_meta_linked_instagram_discovery_failure(
  p_workspace_id uuid, p_connection_id uuid, p_page_external_id text,
  p_error_code text, p_error_summary text)
returns table (recorded boolean)
language plpgsql security definer set search_path = public as $$
begin
  update public.app_meta_connection_accounts ca set last_successful_sync_at = null,
    last_error_code = left(coalesce(nullif(p_error_code, ''), 'instagram_discovery_failed'), 100),
    last_error_summary = left(coalesce(nullif(p_error_summary, ''), 'The linked Instagram check failed.'), 500)
    from public.platform_accounts pa where ca.platform_account_id = pa.id
      and ca.workspace_id = p_workspace_id and ca.connection_id = p_connection_id
      and ca.account_type = 'facebook_page' and ca.is_selected and pa.meta_external_id = p_page_external_id;
  if not found then raise exception 'Selected Facebook Page does not match authoritative state.'; end if;
  return query select true;
end;
$$;

create or replace function public.skip_meta_linked_instagram(
  p_workspace_id uuid, p_connection_id uuid, p_page_external_id text, p_instagram_external_id text)
returns table (skipped boolean)
language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.app_meta_connection_accounts ca join public.platform_accounts pa on pa.id = ca.platform_account_id
    where ca.workspace_id = p_workspace_id and ca.connection_id = p_connection_id
      and ca.account_type = 'facebook_page' and ca.is_selected and pa.meta_external_id = p_page_external_id;
  if not found then raise exception 'Selected Facebook Page does not match authoritative state.'; end if;
  update public.app_meta_discovered_assets set asset_state = 'skipped'
    where workspace_id = p_workspace_id and connection_id = p_connection_id
      and account_type = 'instagram_professional' and external_id = p_instagram_external_id
      and parent_external_id = p_page_external_id and asset_state in ('available', 'skipped');
  if not found then raise exception 'Linked Instagram candidate is unavailable.'; end if;
  return query select true;
end;
$$;

create or replace function public.select_meta_linked_instagram(
  p_workspace_id uuid, p_connection_id uuid, p_page_external_id text, p_instagram_external_id text)
returns table (mapping_id uuid, platform_account_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_candidate public.app_meta_discovered_assets%rowtype;
  v_platform_id uuid; v_page_account_id uuid; v_account_id uuid; v_mapping_id uuid; v_count integer;
begin
  select count(*) into v_count from public.app_meta_connections
    where workspace_id = p_workspace_id and connection_kind = 'fstats_login_facebook_page';
  if v_count <> 1 then raise exception 'Exactly one Meta App B connection is required.'; end if;
  select * into v_candidate from public.app_meta_discovered_assets
    where workspace_id = p_workspace_id and connection_id = p_connection_id
      and account_type = 'instagram_professional' and external_id = p_instagram_external_id
      and parent_external_id = p_page_external_id and asset_state in ('available', 'skipped') for update;
  if not found then raise exception 'Selected linked Instagram candidate is unavailable.'; end if;
  select ca.platform_account_id into v_page_account_id from public.app_meta_connection_accounts ca
    join public.platform_accounts pa on pa.id = ca.platform_account_id
    where ca.workspace_id = p_workspace_id and ca.connection_id = p_connection_id
      and ca.account_type = 'facebook_page' and ca.is_selected and pa.meta_external_id = p_page_external_id for update of ca;
  if v_page_account_id is null then raise exception 'Selected Facebook Page does not match authoritative state.'; end if;
  select id into v_platform_id from public.platforms where slug = 'instagram';
  if v_platform_id is null then raise exception 'Instagram platform is unavailable.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('instagram:' || p_instagram_external_id, 0));
  if exists (select 1 from public.app_meta_active_instagram_bindings
    where external_id = p_instagram_external_id and workspace_id <> p_workspace_id) then
    raise exception using errcode = 'P2002', message = 'This linked Instagram account is already selected in another workspace.';
  end if;
  delete from public.app_meta_active_instagram_bindings
    where workspace_id = p_workspace_id and connection_id = p_connection_id and external_id <> p_instagram_external_id;
  update public.app_meta_connection_accounts set is_selected = false, asset_state = 'discovered'
    where workspace_id = p_workspace_id and connection_id = p_connection_id
      and account_type = 'instagram_professional' and is_selected;
  insert into public.platform_accounts (workspace_id, platform_id, account_name, external_id, meta_external_id)
    values (p_workspace_id, v_platform_id, v_candidate.display_name, p_instagram_external_id, p_instagram_external_id)
    on conflict (workspace_id, platform_id, meta_external_id) where meta_external_id is not null
    do update set account_name = excluded.account_name, external_id = excluded.external_id returning id into v_account_id;
  insert into public.app_meta_connection_accounts
    (workspace_id, connection_id, platform_account_id, account_type, parent_platform_account_id, is_selected, asset_state)
    values (p_workspace_id, p_connection_id, v_account_id, 'instagram_professional', v_page_account_id, true, 'selected')
    on conflict on constraint app_meta_connection_accounts_connection_id_platform_account_key
    do update set parent_platform_account_id = excluded.parent_platform_account_id,
      is_selected = true, asset_state = 'selected', last_error_code = null, last_error_summary = null
    returning id into v_mapping_id;
  insert into public.app_meta_active_instagram_bindings
    (external_id, workspace_id, connection_id, mapping_id, parent_page_external_id)
    values (p_instagram_external_id, p_workspace_id, p_connection_id, v_mapping_id, p_page_external_id)
    on conflict (external_id) do update set workspace_id = excluded.workspace_id,
      connection_id = excluded.connection_id, mapping_id = excluded.mapping_id,
      parent_page_external_id = excluded.parent_page_external_id;
  update public.app_meta_discovered_assets set asset_state = 'available'
    where id = v_candidate.id;
  return query select v_mapping_id, v_account_id;
end;
$$;

revoke all on function public.select_meta_facebook_page(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.start_meta_linked_instagram_discovery(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.reconcile_meta_linked_instagram_discovery(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.record_meta_linked_instagram_discovery_failure(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.skip_meta_linked_instagram(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.select_meta_linked_instagram(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.select_meta_facebook_page(uuid, uuid, text) to service_role;
grant execute on function public.start_meta_linked_instagram_discovery(uuid, uuid, text) to service_role;
grant execute on function public.reconcile_meta_linked_instagram_discovery(uuid, uuid, text, text, text) to service_role;
grant execute on function public.record_meta_linked_instagram_discovery_failure(uuid, uuid, text, text, text) to service_role;
grant execute on function public.skip_meta_linked_instagram(uuid, uuid, text, text) to service_role;
grant execute on function public.select_meta_linked_instagram(uuid, uuid, text, text) to service_role;
