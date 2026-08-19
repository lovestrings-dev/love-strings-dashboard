-- A standalone Instagram authorization token does not always contain the
-- stable authorization-user subject. Reconnects must therefore retain the
-- current App A logical connection instead of relying on a nullable subject
-- unique key, which otherwise permits duplicate connection rows.
create or replace function public.bind_creator_social_instagram(
  p_workspace_id uuid, p_connected_by uuid, p_authorization_user_external_id text,
  p_encrypted_token_payload text, p_token_type text, p_token_expires_at timestamptz,
  p_granted_scopes text[], p_external_id text, p_display_name text, p_username text
)
returns table (connection_id uuid, platform_account_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_connection_id uuid;
  v_platform_id uuid;
  v_account_id uuid;
  v_mapping_id uuid;
begin
  if p_external_id is null or btrim(p_external_id) = '' then
    raise exception 'Instagram identity is required.';
  end if;
  if p_encrypted_token_payload is null or btrim(p_encrypted_token_payload) = '' then
    raise exception 'Encrypted token is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('instagram:' || p_external_id, 0));

  if exists (
    select 1
    from public.app_meta_active_instagram_bindings binding
    join public.app_meta_connections connection on connection.id = binding.connection_id
    where binding.workspace_id = p_workspace_id
      and binding.external_id = p_external_id
      and connection.connection_kind = 'fstats_login_facebook_page'
  ) then
    raise exception using errcode = 'P2101', message = 'Instagram is already actively bound through App B.';
  end if;
  if exists (
    select 1 from public.app_meta_active_instagram_bindings binding
    where binding.external_id = p_external_id and binding.workspace_id <> p_workspace_id
  ) then
    raise exception using errcode = 'P2102', message = 'Instagram is already active in another workspace.';
  end if;

  select id into v_platform_id from public.platforms where slug = 'instagram';
  if v_platform_id is null then
    raise exception 'Instagram platform is unavailable.';
  end if;

  -- Create or update the canonical account before modifying the current
  -- connection. Any error before the final replacement leaves it untouched.
  insert into public.platform_accounts (workspace_id, platform_id, account_name, external_id, meta_external_id, url)
    values (
      p_workspace_id, v_platform_id, p_display_name, p_external_id, p_external_id,
      case when p_username is null or btrim(p_username) = '' then null else 'https://www.instagram.com/' || p_username end
    )
    on conflict (workspace_id, platform_id, meta_external_id) where meta_external_id is not null
    do update set account_name = excluded.account_name, external_id = excluded.external_id, url = excluded.url
    returning id into v_account_id;

  -- Prefer the currently active App A binding. If a prior disconnect removed
  -- that binding, reuse the latest App A connection rather than create another
  -- logical connection solely because the provider omitted its user subject.
  select connection.id into v_connection_id
    from public.app_meta_active_instagram_bindings binding
    join public.app_meta_connections connection on connection.id = binding.connection_id
    where binding.workspace_id = p_workspace_id
      and connection.connection_kind = 'creator_social_instagram'
    order by connection.updated_at desc, connection.created_at desc, connection.id desc
    limit 1
    for update of connection;
  if v_connection_id is null then
    select id into v_connection_id
      from public.app_meta_connections
      where workspace_id = p_workspace_id and connection_kind = 'creator_social_instagram'
      order by updated_at desc, created_at desc, id desc
      limit 1
      for update;
  end if;

  if v_connection_id is null then
    insert into public.app_meta_connections (
      workspace_id, app_kind, connection_kind, authorization_user_external_id,
      connected_by, encrypted_token_payload, token_type, token_expires_at,
      token_refreshed_at, granted_scopes, connection_state,
      reauthorization_required_at, last_error_code, last_error_summary
    ) values (
      p_workspace_id, 'creator_social', 'creator_social_instagram', p_authorization_user_external_id,
      p_connected_by, p_encrypted_token_payload, p_token_type, p_token_expires_at,
      now(), coalesce(p_granted_scopes, '{}'::text[]), 'connected', null, null, null
    ) returning id into v_connection_id;
  else
    update public.app_meta_connections
      set connected_by = p_connected_by,
          encrypted_token_payload = p_encrypted_token_payload,
          token_type = p_token_type,
          token_expires_at = p_token_expires_at,
          token_refreshed_at = now(),
          granted_scopes = coalesce(p_granted_scopes, '{}'::text[]),
          connection_state = 'connected',
          reauthorization_required_at = null,
          last_error_code = null,
          last_error_summary = null
      where id = v_connection_id;
  end if;

  -- Make the replacement mapping valid first. The old mapping is retired only
  -- after the target connection and canonical account are ready.
  update public.app_meta_connection_accounts
    set is_selected = false, asset_state = 'disabled'
    where workspace_id = p_workspace_id
      and connection_id = v_connection_id
      and account_type = 'instagram_professional'
      and platform_account_id <> v_account_id;
  insert into public.app_meta_connection_accounts (
    workspace_id, connection_id, platform_account_id, account_type, is_selected, asset_state
  ) values (
    p_workspace_id, v_connection_id, v_account_id, 'instagram_professional', true, 'selected'
  ) on conflict on constraint app_meta_connection_accounts_connection_id_platform_account_key
    do update set is_selected = true, asset_state = 'selected', last_error_code = null, last_error_summary = null
    returning id into v_mapping_id;

  delete from public.app_meta_active_instagram_bindings binding
    where binding.connection_id = v_connection_id and binding.external_id <> p_external_id;
  insert into public.app_meta_active_instagram_bindings (
    external_id, workspace_id, connection_id, mapping_id, parent_page_external_id
  ) values (p_external_id, p_workspace_id, v_connection_id, v_mapping_id, null)
    on conflict (external_id) do update
      set workspace_id = excluded.workspace_id,
          connection_id = excluded.connection_id,
          mapping_id = excluded.mapping_id,
          parent_page_external_id = null;

  -- Retire only superseded App A records, after the replacement is active.
  update public.app_meta_connection_accounts mapping
    set is_selected = false, asset_state = 'disabled'
    from public.app_meta_connections connection
    where mapping.connection_id = connection.id
      and mapping.workspace_id = p_workspace_id
      and connection.connection_kind = 'creator_social_instagram'
      and connection.id <> v_connection_id;
  update public.app_meta_connections
    set connection_state = 'no_data'
    where workspace_id = p_workspace_id
      and connection_kind = 'creator_social_instagram'
      and id <> v_connection_id;
  delete from public.app_meta_active_instagram_bindings binding
    using public.app_meta_connections connection
    where binding.connection_id = connection.id
      and binding.workspace_id = p_workspace_id
      and connection.connection_kind = 'creator_social_instagram'
      and connection.id <> v_connection_id;

  return query select v_connection_id, v_account_id;
end;
$$;
revoke all on function public.bind_creator_social_instagram(uuid, uuid, text, text, text, timestamptz, text[], text, text, text) from public, anon, authenticated;
grant execute on function public.bind_creator_social_instagram(uuid, uuid, text, text, text, timestamptz, text[], text, text, text) to service_role;
