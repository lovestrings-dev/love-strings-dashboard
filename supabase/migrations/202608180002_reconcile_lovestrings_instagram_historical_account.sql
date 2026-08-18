-- Rebind the selected App B Instagram asset to the established Love Strings
-- analytics account without moving its historical metric or content rows.
do $$
declare
  v_workspace_id uuid := '00000000-0000-0000-0000-000000000001';
  v_historical_account_id uuid := 'e529c347-7306-49ed-b500-532fd259e5a2';
  v_duplicate_account_id uuid := '8040094c-c1ac-45d7-a53c-5f2f98af2d52';
  v_connection_id uuid := '626338a3-8f40-4edd-859f-06cd3578d1ca';
  v_mapping_id uuid := '054c4b67-cf1e-42c6-9987-6fc121ccf099';
  v_parent_page_account_id uuid := '04631a8a-e582-42ab-a6fb-8dd663953f01';
  v_legacy_external_id text := '36756415517336243';
  v_meta_external_id text := '17841480743173848';
  v_platform_id uuid;
  v_snapshot_count integer;
  v_content_count integer;
begin
  select id into v_platform_id from public.platforms where slug = 'instagram';
  if v_platform_id is null then raise exception 'Instagram platform is unavailable.'; end if;

  perform pg_advisory_xact_lock(hashtextextended('instagram:' || v_meta_external_id, 0));

  perform 1 from public.platform_accounts
    where id = v_historical_account_id and workspace_id = v_workspace_id
      and platform_id = v_platform_id and account_name = 'Love Strings Instagram'
      and external_id = v_legacy_external_id and meta_external_id is null
    for update;
  if not found then raise exception 'Historical Love Strings Instagram account does not match the expected state.'; end if;

  perform 1 from public.platform_accounts
    where id = v_duplicate_account_id and workspace_id = v_workspace_id
      and platform_id = v_platform_id and account_name = 'lovestringsband'
      and external_id = v_meta_external_id and meta_external_id = v_meta_external_id
    for update;
  if not found then raise exception 'Selected App B Instagram account does not match the expected duplicate state.'; end if;

  select count(*) into v_snapshot_count from public.platform_metric_snapshots
    where platform_account_id = v_historical_account_id;
  if v_snapshot_count <> 182 then raise exception 'Historical Instagram snapshot count changed; reconciliation is refused.'; end if;
  select count(*) into v_content_count from public.content_posts
    where platform_account_id = v_historical_account_id;
  if v_content_count <> 23 then raise exception 'Historical Instagram content-post count changed; reconciliation is refused.'; end if;
  if exists (select 1 from public.platform_metric_snapshots where platform_account_id = v_duplicate_account_id)
    or exists (select 1 from public.content_posts where platform_account_id = v_duplicate_account_id) then
    raise exception 'App B duplicate account has historical dependents and cannot be removed safely.';
  end if;

  perform 1 from public.app_meta_connection_accounts
    where id = v_mapping_id and workspace_id = v_workspace_id and connection_id = v_connection_id
      and platform_account_id = v_duplicate_account_id and parent_platform_account_id = v_parent_page_account_id
      and account_type = 'instagram_professional' and is_selected and asset_state = 'selected'
    for update;
  if not found then raise exception 'Selected App B Instagram mapping does not match the expected state.'; end if;
  if (select count(*) from public.app_meta_connection_accounts where platform_account_id = v_duplicate_account_id) <> 1
    or exists (select 1 from public.app_meta_connection_accounts where parent_platform_account_id = v_duplicate_account_id) then
    raise exception 'App B duplicate account has unexpected Meta mapping dependents.';
  end if;
  perform 1 from public.app_meta_active_instagram_bindings
    where external_id = v_meta_external_id and workspace_id = v_workspace_id
      and connection_id = v_connection_id and mapping_id = v_mapping_id
      and parent_page_external_id = '1024037014125778'
    for update;
  if not found then raise exception 'Active App B Instagram binding does not match the selected mapping.'; end if;
  if exists (select 1 from public.platform_accounts
    where workspace_id = v_workspace_id and platform_id = v_platform_id
      and meta_external_id = v_meta_external_id and id <> v_duplicate_account_id) then
    raise exception 'Meta Instagram identity is already owned by a different platform account.';
  end if;

  -- The partial unique index requires clearing the empty duplicate before the
  -- historical account can receive the authoritative Meta identity.
  update public.platform_accounts set meta_external_id = null where id = v_duplicate_account_id;
  update public.platform_accounts set meta_external_id = v_meta_external_id where id = v_historical_account_id;
  update public.app_meta_connection_accounts set platform_account_id = v_historical_account_id
    where id = v_mapping_id and platform_account_id = v_duplicate_account_id;

  if exists (select 1 from public.app_meta_connection_accounts where platform_account_id = v_duplicate_account_id)
    or exists (select 1 from public.app_meta_connection_accounts where parent_platform_account_id = v_duplicate_account_id)
    or exists (select 1 from public.platform_metric_snapshots where platform_account_id = v_duplicate_account_id)
    or exists (select 1 from public.content_posts where platform_account_id = v_duplicate_account_id) then
    raise exception 'App B duplicate account still has dependents after rebind.';
  end if;
  delete from public.platform_accounts where id = v_duplicate_account_id;

  if (select count(*) from public.platform_metric_snapshots where platform_account_id = v_historical_account_id) <> 182
    or (select count(*) from public.content_posts where platform_account_id = v_historical_account_id) <> 23 then
    raise exception 'Historical Instagram data changed during reconciliation.';
  end if;
  if not exists (select 1 from public.app_meta_connection_accounts
    where id = v_mapping_id and platform_account_id = v_historical_account_id and is_selected) then
    raise exception 'Selected App B Instagram mapping was not rebound to history.';
  end if;
end;
$$;

-- App B identity is meta_external_id. Preserve a pre-existing legacy
-- external_id whenever selection finds an already reconciled account.
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
    do update set
      account_name = public.platform_accounts.account_name,
      external_id = case when public.platform_accounts.external_id is null or btrim(public.platform_accounts.external_id) = ''
        then excluded.external_id else public.platform_accounts.external_id end
    returning id into v_account_id;
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
  update public.app_meta_discovered_assets set asset_state = 'available' where id = v_candidate.id;
  return query select v_mapping_id, v_account_id;
end;
$$;

revoke all on function public.select_meta_linked_instagram(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.select_meta_linked_instagram(uuid, uuid, text, text) to service_role;
