-- Atomic App A Threads binding. Threads deliberately has its own connection
-- kind and platform identity; this function never reads or changes Instagram
-- or App B Page-linked records.
create function public.bind_creator_social_threads(
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
begin
  if p_external_id is null or btrim(p_external_id) = '' then
    raise exception 'Threads identity is required.';
  end if;
  if p_encrypted_token_payload is null or btrim(p_encrypted_token_payload) = '' then
    raise exception 'Encrypted token is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('threads:' || p_workspace_id::text, 0));

  select id into v_platform_id from public.platforms where slug = 'threads';
  if v_platform_id is null then
    raise exception 'Threads platform is unavailable.';
  end if;

  insert into public.platform_accounts (workspace_id, platform_id, account_name, external_id, meta_external_id, url)
    values (
      p_workspace_id, v_platform_id, p_display_name, p_external_id, p_external_id,
      case when p_username is null or btrim(p_username) = '' then null else 'https://www.threads.com/@' || p_username end
    )
    on conflict (workspace_id, platform_id, meta_external_id) where meta_external_id is not null
    do update set account_name = excluded.account_name, external_id = excluded.external_id, url = excluded.url
    returning id into v_account_id;

  -- Reuse a prior disconnected connection when available. This retains its
  -- durable provider history and makes same-account reconnect deterministic.
  select id into v_connection_id
    from public.app_meta_connections
    where workspace_id = p_workspace_id
      and connection_kind = 'creator_social_threads'
    order by updated_at desc, created_at desc, id desc
    limit 1
    for update;

  if v_connection_id is null then
    insert into public.app_meta_connections (
      workspace_id, app_kind, connection_kind, authorization_user_external_id,
      connected_by, encrypted_token_payload, token_type, token_expires_at,
      token_refreshed_at, granted_scopes, connection_state,
      reauthorization_required_at, last_error_code, last_error_summary
    ) values (
      p_workspace_id, 'creator_social', 'creator_social_threads', p_authorization_user_external_id,
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

  update public.app_meta_connection_accounts as mapping
    set is_selected = false, asset_state = 'disabled'
    where mapping.workspace_id = p_workspace_id
      and mapping.connection_id = v_connection_id
      and mapping.account_type = 'threads_profile'
      and mapping.platform_account_id <> v_account_id;
  insert into public.app_meta_connection_accounts (
    workspace_id, connection_id, platform_account_id, account_type, is_selected, asset_state
  ) values (
    p_workspace_id, v_connection_id, v_account_id, 'threads_profile', true, 'selected'
  ) on conflict on constraint app_meta_connection_accounts_connection_id_platform_account_key
    do update set is_selected = true, asset_state = 'selected', last_error_code = null, last_error_summary = null;

  -- Defensive cleanup for pre-existing anomalous Threads rows only. App A
  -- Instagram and App B records cannot match this connection kind.
  update public.app_meta_connection_accounts mapping
    set is_selected = false, asset_state = 'disabled'
    from public.app_meta_connections connection
    where mapping.connection_id = connection.id
      and mapping.workspace_id = p_workspace_id
      and connection.connection_kind = 'creator_social_threads'
      and connection.id <> v_connection_id;
  update public.app_meta_connections
    set connection_state = 'no_data'
    where workspace_id = p_workspace_id
      and connection_kind = 'creator_social_threads'
      and id <> v_connection_id;

  return query select v_connection_id, v_account_id;
end;
$$;

create function public.disconnect_creator_social_threads(p_workspace_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('threads:' || p_workspace_id::text, 0));

  update public.app_meta_connection_accounts mapping
    set is_selected = false, asset_state = 'disabled'
    from public.app_meta_connections connection
    where mapping.connection_id = connection.id
      and mapping.workspace_id = p_workspace_id
      and connection.workspace_id = p_workspace_id
      and connection.connection_kind = 'creator_social_threads';
  update public.app_meta_connections
    set connection_state = 'no_data', last_error_code = null, last_error_summary = null
    where workspace_id = p_workspace_id
      and connection_kind = 'creator_social_threads';
end;
$$;

revoke all on function public.bind_creator_social_threads(uuid, uuid, text, text, text, timestamptz, text[], text, text, text) from public, anon, authenticated;
grant execute on function public.bind_creator_social_threads(uuid, uuid, text, text, text, timestamptz, text[], text, text, text) to service_role;
revoke all on function public.disconnect_creator_social_threads(uuid) from public, anon, authenticated;
grant execute on function public.disconnect_creator_social_threads(uuid) to service_role;
