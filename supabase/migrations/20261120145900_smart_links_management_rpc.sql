-- ArtistDeck Smart Links Phase 1B management RPCs.
-- LOCAL ONLY: do not apply this migration to a hosted project without a
-- separately approved deployment batch. Browser roles never receive EXECUTE.

begin;

create or replace function public.smart_link_management_mutate(
  p_workspace_id uuid,
  p_actor_id uuid,
  p_action text,
  p_link_id uuid default null,
  p_expected_updated_at timestamptz default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_role text;
  v_link public.smart_links%rowtype;
  v_created public.smart_links%rowtype;
  v_destination jsonb;
  v_destination_id uuid;
  v_now timestamptz := now();
  v_result jsonb;
begin
  select member.role into v_role
  from public.app_workspace_members member
  join public.app_workspaces workspace on workspace.id = member.workspace_id
  where member.workspace_id = p_workspace_id
    and member.user_id = p_actor_id
    and workspace.access_state <> 'frozen';

  if v_role is null or v_role not in ('admin', 'member') then
    raise exception 'Smart Link management requires an Admin or Member role.' using errcode = '42501';
  end if;

  if p_action = 'create' then
    insert into public.smart_links (
      workspace_id, production_song_id, public_slug,
      title_override, artist_name_override, artwork_url_override,
      background_mode, background_color, social_links,
      pixel_mode, pixel_override_id, created_by, updated_by
    ) values (
      p_workspace_id,
      nullif(p_payload ->> 'productionSongId', '')::uuid,
      p_payload ->> 'slug',
      nullif(p_payload ->> 'titleOverride', ''),
      nullif(p_payload ->> 'artistNameOverride', ''),
      nullif(p_payload ->> 'artworkUrlOverride', ''),
      coalesce(p_payload ->> 'backgroundMode', 'blurred-artwork'),
      nullif(p_payload ->> 'backgroundColor', ''),
      coalesce(p_payload -> 'socialLinks', '[]'::jsonb),
      coalesce(p_payload ->> 'pixelMode', 'inherit'),
      nullif(p_payload ->> 'pixelOverrideId', ''),
      p_actor_id, p_actor_id
    ) returning * into v_created;

    for v_destination in select value from jsonb_array_elements(coalesce(p_payload -> 'destinations', '[]'::jsonb)) loop
      insert into public.smart_link_destinations (
        smart_link_id, platform_key, button_label, target_url,
        source_kind, source_metadata, position, is_enabled
      ) values (
        v_created.id,
        v_destination ->> 'platformKey',
        coalesce(v_destination ->> 'buttonLabel', ''),
        v_destination ->> 'targetUrl',
        coalesce(v_destination ->> 'sourceKind', 'manual'),
        coalesce(v_destination -> 'sourceMetadata', '{}'::jsonb),
        (v_destination ->> 'position')::integer,
        coalesce((v_destination ->> 'isEnabled')::boolean, true)
      );
    end loop;
    v_link := v_created;

  elsif p_action in ('update', 'transition', 'duplicate') then
    if p_link_id is null or p_expected_updated_at is null then
      raise exception 'Smart Link id and expected revision are required.' using errcode = '22023';
    end if;
    select * into v_link
    from public.smart_links link
    where link.id = p_link_id and link.workspace_id = p_workspace_id
    for update;
    if not found then
      raise exception 'Smart Link was not found.' using errcode = 'P0002';
    end if;
    if v_link.updated_at <> p_expected_updated_at then
      raise exception 'Smart Link has changed. Refresh before saving.' using errcode = '40001';
    end if;

    if p_action = 'update' then
      update public.smart_links link
      set
        production_song_id = case when p_payload ? 'productionSongId' then nullif(p_payload ->> 'productionSongId', '')::uuid else link.production_song_id end,
        public_slug = case when p_payload ? 'slug' then p_payload ->> 'slug' else link.public_slug end,
        title_override = case when p_payload ? 'titleOverride' then nullif(p_payload ->> 'titleOverride', '') else link.title_override end,
        artist_name_override = case when p_payload ? 'artistNameOverride' then nullif(p_payload ->> 'artistNameOverride', '') else link.artist_name_override end,
        artwork_url_override = case when p_payload ? 'artworkUrlOverride' then nullif(p_payload ->> 'artworkUrlOverride', '') else link.artwork_url_override end,
        background_mode = case when p_payload ? 'backgroundMode' then p_payload ->> 'backgroundMode' else link.background_mode end,
        background_color = case when p_payload ? 'backgroundColor' then nullif(p_payload ->> 'backgroundColor', '') else link.background_color end,
        social_links = case when p_payload ? 'socialLinks' then p_payload -> 'socialLinks' else link.social_links end,
        pixel_mode = case when p_payload ? 'pixelMode' then p_payload ->> 'pixelMode' else link.pixel_mode end,
        pixel_override_id = case when p_payload ? 'pixelOverrideId' then nullif(p_payload ->> 'pixelOverrideId', '') else link.pixel_override_id end,
        updated_by = p_actor_id
      where link.id = v_link.id
      returning * into v_link;

      if p_payload ? 'destinations' then
        set constraints smart_link_destinations_position_key deferred;
        for v_destination in select value from jsonb_array_elements(p_payload -> 'destinations') loop
          if nullif(v_destination ->> 'id', '') is null then
            insert into public.smart_link_destinations (
              smart_link_id, platform_key, button_label, target_url,
              source_kind, source_metadata, position, is_enabled
            ) values (
              v_link.id,
              v_destination ->> 'platformKey',
              coalesce(v_destination ->> 'buttonLabel', ''),
              v_destination ->> 'targetUrl',
              coalesce(v_destination ->> 'sourceKind', 'manual'),
              coalesce(v_destination -> 'sourceMetadata', '{}'::jsonb),
              (v_destination ->> 'position')::integer,
              coalesce((v_destination ->> 'isEnabled')::boolean, true)
            );
          else
            v_destination_id := (v_destination ->> 'id')::uuid;
            update public.smart_link_destinations destination
            set
              button_label = coalesce(v_destination ->> 'buttonLabel', destination.button_label),
              target_url = coalesce(v_destination ->> 'targetUrl', destination.target_url),
              source_kind = coalesce(v_destination ->> 'sourceKind', destination.source_kind),
              source_metadata = coalesce(v_destination -> 'sourceMetadata', destination.source_metadata),
              position = coalesce((v_destination ->> 'position')::integer, destination.position),
              is_enabled = coalesce((v_destination ->> 'isEnabled')::boolean, destination.is_enabled),
              retired_at = case when coalesce((v_destination ->> 'retire')::boolean, false) then v_now else destination.retired_at end
            where destination.id = v_destination_id
              and destination.smart_link_id = v_link.id;
            if not found then
              raise exception 'Smart Link destination was not found.' using errcode = 'P0002';
            end if;
          end if;
        end loop;
      end if;
      -- Destination mutations must also advance the link revision.
      update public.smart_links link
      set updated_by = p_actor_id
      where link.id = v_link.id
      returning * into v_link;

    elsif p_action = 'transition' then
      update public.smart_links link
      set status = p_payload ->> 'status', updated_by = p_actor_id
      where link.id = v_link.id
      returning * into v_link;

    else
      insert into public.smart_links (
        workspace_id, production_song_id, public_slug,
        source_song_title, source_artist_name, source_artwork_url,
        title_override, artist_name_override, artwork_url_override,
        background_mode, background_color, social_links,
        pixel_mode, pixel_override_id, created_by, updated_by
      ) values (
        p_workspace_id, v_link.production_song_id, p_payload ->> 'slug',
        v_link.source_song_title, v_link.source_artist_name, v_link.source_artwork_url,
        v_link.title_override, v_link.artist_name_override, v_link.artwork_url_override,
        v_link.background_mode, v_link.background_color, v_link.social_links,
        v_link.pixel_mode, v_link.pixel_override_id, p_actor_id, p_actor_id
      ) returning * into v_link;
      insert into public.smart_link_destinations (
        smart_link_id, platform_key, button_label, target_url,
        source_kind, source_metadata, position, is_enabled
      )
      select
        v_link.id, destination.platform_key, destination.button_label, destination.target_url,
        destination.source_kind, destination.source_metadata, destination.position, destination.is_enabled
      from public.smart_link_destinations destination
      where destination.smart_link_id = p_link_id;
    end if;
  else
    raise exception 'Unsupported Smart Link management action.' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'link', to_jsonb(link),
    'destinations', coalesce((
      select jsonb_agg(to_jsonb(destination) order by destination.position, destination.created_at)
      from public.smart_link_destinations destination
      where destination.smart_link_id = link.id
    ), '[]'::jsonb)
  ) into v_result
  from public.smart_links link
  where link.id = v_link.id;
  return v_result;
end;
$$;

create or replace function public.smart_link_update_workspace_pixel_settings(
  p_workspace_id uuid,
  p_actor_id uuid,
  p_expected_updated_at timestamptz default null,
  p_default_pixel_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_role text;
  v_settings public.workspace_meta_pixel_settings%rowtype;
begin
  select member.role into v_role
  from public.app_workspace_members member
  join public.app_workspaces workspace on workspace.id = member.workspace_id
  where member.workspace_id = p_workspace_id
    and member.user_id = p_actor_id
    and workspace.access_state <> 'frozen';
  if v_role is null or v_role not in ('admin', 'member') then
    raise exception 'Meta Pixel settings require an Admin or Member role.' using errcode = '42501';
  end if;

  select * into v_settings from public.workspace_meta_pixel_settings settings
  where settings.workspace_id = p_workspace_id for update;
  if found then
    if p_expected_updated_at is null or v_settings.updated_at <> p_expected_updated_at then
      raise exception 'Meta Pixel settings have changed. Refresh before saving.' using errcode = '40001';
    end if;
    update public.workspace_meta_pixel_settings settings
    set default_pixel_id = nullif(btrim(p_default_pixel_id), '')
    where settings.workspace_id = p_workspace_id
    returning * into v_settings;
  else
    if p_expected_updated_at is not null then
      raise exception 'Meta Pixel settings have changed. Refresh before saving.' using errcode = '40001';
    end if;
    insert into public.workspace_meta_pixel_settings (workspace_id, default_pixel_id)
    values (p_workspace_id, nullif(btrim(p_default_pixel_id), ''))
    returning * into v_settings;
  end if;
  return to_jsonb(v_settings);
end;
$$;

revoke all on function public.smart_link_management_mutate(uuid, uuid, text, uuid, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.smart_link_update_workspace_pixel_settings(uuid, uuid, timestamptz, text) from public, anon, authenticated;
grant execute on function public.smart_link_management_mutate(uuid, uuid, text, uuid, timestamptz, jsonb) to service_role;
grant execute on function public.smart_link_update_workspace_pixel_settings(uuid, uuid, timestamptz, text) to service_role;

commit;
