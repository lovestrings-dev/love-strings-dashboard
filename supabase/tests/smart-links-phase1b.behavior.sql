-- Execute only against a freshly reset, isolated local Supabase database after
-- all repository migrations have been applied. This entire suite rolls back.
\set ON_ERROR_STOP on

begin;

create function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$
begin
  if condition is distinct from true then
    raise exception 'Assertion failed: %', message;
  end if;
end;
$$;

create function pg_temp.assert_fails(statement text, expected_state text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_state then return; end if;
    raise;
  end;
  raise exception 'Expected statement to fail: %', statement;
end;
$$;

set local role service_role;

-- Auth users are temporary fixtures solely to satisfy membership foreign keys.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000000', '41000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'sl-admin@example.test', '$2a$10$fixture', now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '41000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'sl-member@example.test', '$2a$10$fixture', now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '41000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'sl-viewer@example.test', '$2a$10$fixture', now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '41000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'sl-non-member@example.test', '$2a$10$fixture', now(), '{}'::jsonb, '{}'::jsonb);

insert into public.app_workspaces (id, name, slug) values
  ('61000000-0000-4000-8000-000000000001', 'Smart Links Runtime One', 'smart-links-runtime-one'),
  ('61000000-0000-4000-8000-000000000002', 'Smart Links Runtime Two', 'smart-links-runtime-two');

insert into public.app_workspace_members (workspace_id, user_id, role) values
  ('61000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 'admin'),
  ('61000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000002', 'member'),
  ('61000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000003', 'viewer'),
  ('61000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000001', 'member');

do $$
declare
  v_workspace_one uuid := '61000000-0000-4000-8000-000000000001';
  v_workspace_two uuid := '61000000-0000-4000-8000-000000000002';
  v_admin uuid := '41000000-0000-4000-8000-000000000001';
  v_member uuid := '41000000-0000-4000-8000-000000000002';
  v_viewer uuid := '41000000-0000-4000-8000-000000000003';
  v_non_member uuid := '41000000-0000-4000-8000-000000000004';
  v_created jsonb;
  v_updated jsonb;
  v_duplicate jsonb;
  v_link_id uuid;
  v_destination_id uuid;
  v_revision timestamptz;
  v_second_revision timestamptz;
  v_song_id uuid := '71000000-0000-4000-8000-000000000001';
  v_song_link jsonb;
  v_song_link_id uuid;
  v_song_link_revision timestamptz;
begin
  v_created := public.smart_link_management_mutate(
    v_workspace_one, v_admin, 'create', null, null,
    jsonb_build_object(
      'slug', 'phase1b-runtime',
      'titleOverride', 'Runtime Link',
      'destinations', jsonb_build_array(jsonb_build_object(
        'platformKey', 'spotify', 'buttonLabel', 'Spotify',
        'targetUrl', 'https://open.spotify.com/track/runtime', 'position', 0, 'isEnabled', true
      ))
    )
  );
  v_link_id := (v_created -> 'link' ->> 'id')::uuid;
  v_destination_id := (v_created -> 'destinations' -> 0 ->> 'id')::uuid;
  v_revision := (v_created -> 'link' ->> 'updated_at')::timestamptz;
  perform pg_temp.assert_true(v_link_id is not null and v_destination_id is not null, 'admin can atomically create a link and destination');

  -- A failed destination insert rolls back the enclosing function transaction.
  begin
    perform public.smart_link_management_mutate(
      v_workspace_one, v_admin, 'create', null, null,
      jsonb_build_object('slug', 'phase1b-rollback', 'destinations', jsonb_build_array(jsonb_build_object(
        'platformKey', 'apple_music', 'targetUrl', 'http://not-https.example.test', 'position', 0
      )))
    );
    raise exception 'Expected invalid destination creation to fail.';
  exception when check_violation then null;
  end;
  perform pg_temp.assert_true(not exists (select 1 from public.smart_links where public_slug = 'phase1b-rollback'), 'failed creation leaves no partial Smart Link');

  begin
    perform public.smart_link_management_mutate(v_workspace_one, v_viewer, 'update', v_link_id, v_revision, jsonb_build_object('titleOverride', 'Denied'));
    raise exception 'Expected Viewer mutation to fail.';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.smart_link_management_mutate(v_workspace_one, v_non_member, 'update', v_link_id, v_revision, jsonb_build_object('titleOverride', 'Denied'));
    raise exception 'Expected non-member mutation to fail.';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.smart_link_management_mutate(v_workspace_two, v_admin, 'update', v_link_id, v_revision, jsonb_build_object('titleOverride', 'Cross workspace'));
    raise exception 'Expected cross-workspace mutation to fail.';
  exception when no_data_found then null;
  end;

  v_updated := public.smart_link_management_mutate(v_workspace_one, v_member, 'update', v_link_id, v_revision, jsonb_build_object('titleOverride', 'Member changed this'));
  v_second_revision := (v_updated -> 'link' ->> 'updated_at')::timestamptz;
  perform pg_temp.assert_true((v_updated -> 'link' ->> 'title_override') = 'Member changed this', 'Member can update a Smart Link');
  begin
    perform public.smart_link_management_mutate(v_workspace_one, v_admin, 'update', v_link_id, v_revision, jsonb_build_object('titleOverride', 'Stale overwrite'));
    raise exception 'Expected stale mutation to fail.';
  exception when serialization_failure then null;
  end;

  begin
    perform public.smart_link_management_mutate(v_workspace_one, v_admin, 'create', null, null, jsonb_build_object('slug', 'phase1b-runtime', 'destinations', '[]'::jsonb));
    raise exception 'Expected duplicate slug to fail.';
  exception when unique_violation then null;
  end;
  begin
    perform public.smart_link_management_mutate(v_workspace_one, v_admin, 'create', null, null, jsonb_build_object('slug', 'artistdeck', 'destinations', '[]'::jsonb));
    raise exception 'Expected reserved slug to fail.';
  exception when raise_exception then null;
  end;

  v_updated := public.smart_link_management_mutate(v_workspace_one, v_admin, 'transition', v_link_id, v_second_revision, jsonb_build_object('status', 'published'));
  v_second_revision := (v_updated -> 'link' ->> 'updated_at')::timestamptz;
  begin
    perform public.smart_link_management_mutate(v_workspace_one, v_admin, 'update', v_link_id, v_second_revision, jsonb_build_object('slug', 'published-slug-change'));
    raise exception 'Expected published slug change to fail.';
  exception when raise_exception then null;
  end;
  begin
    perform public.smart_link_management_mutate(v_workspace_one, v_admin, 'transition', v_link_id, v_second_revision, jsonb_build_object('status', 'draft'));
    raise exception 'Expected published to draft transition to fail.';
  exception when raise_exception then null;
  end;

  v_updated := public.smart_link_management_mutate(v_workspace_one, v_admin, 'transition', v_link_id, v_second_revision, jsonb_build_object('status', 'disabled'));
  v_second_revision := (v_updated -> 'link' ->> 'updated_at')::timestamptz;
  v_updated := public.smart_link_management_mutate(v_workspace_one, v_admin, 'transition', v_link_id, v_second_revision, jsonb_build_object('status', 'archived'));
  v_second_revision := (v_updated -> 'link' ->> 'updated_at')::timestamptz;
  v_updated := public.smart_link_management_mutate(v_workspace_one, v_admin, 'transition', v_link_id, v_second_revision, jsonb_build_object('status', 'disabled'));
  v_second_revision := (v_updated -> 'link' ->> 'updated_at')::timestamptz;
  v_updated := public.smart_link_management_mutate(v_workspace_one, v_admin, 'transition', v_link_id, v_second_revision, jsonb_build_object('status', 'published'));
  v_second_revision := (v_updated -> 'link' ->> 'updated_at')::timestamptz;
  perform pg_temp.assert_true((v_updated -> 'link' ->> 'status') = 'published', 'valid disabled/archive/restore lifecycle transitions succeed');

  v_updated := public.smart_link_management_mutate(v_workspace_one, v_admin, 'update', v_link_id, v_second_revision, jsonb_build_object('destinations', jsonb_build_array(jsonb_build_object(
    'id', v_destination_id, 'platformKey', 'spotify', 'buttonLabel', 'Spotify updated',
    'targetUrl', 'https://open.spotify.com/track/replaced', 'position', 0, 'isEnabled', false, 'retire', true
  ))));
  perform pg_temp.assert_true((v_updated -> 'destinations' -> 0 ->> 'id')::uuid = v_destination_id, 'destination edits preserve the stable identifier');

  insert into public.smart_link_destination_daily_metrics (destination_id, metric_date, metric_timezone, click_count)
  values (v_destination_id, current_date, 'Europe/Vienna', 1);
  begin
    delete from public.smart_link_destinations where id = v_destination_id;
    raise exception 'Expected metric-bearing destination deletion to fail.';
  exception when raise_exception then null;
  end;

  insert into public.production_songs (
    id, workspace_id, slug, title, production_deadline, release_date,
    roadmap_general_position, album_art_url, source, scheduling_model
  ) values (
    v_song_id, v_workspace_one, 'phase1b-runtime-song', 'Deleted Source Song', '2031-01-01', '2031-01-15',
    999991, 'https://example.test/runtime-art.jpg', 'test', 'legacy-v0'
  );
  v_song_link := public.smart_link_management_mutate(v_workspace_one, v_admin, 'create', null, null, jsonb_build_object(
    'slug', 'phase1b-source-snapshot', 'productionSongId', v_song_id,
    'destinations', jsonb_build_array(jsonb_build_object('platformKey', 'custom', 'targetUrl', 'https://example.test/listen', 'position', 0))
  ));
  v_song_link_id := (v_song_link -> 'link' ->> 'id')::uuid;
  delete from public.production_songs where id = v_song_id;
  select updated_at into v_song_link_revision from public.smart_links where id = v_song_link_id;
  v_duplicate := public.smart_link_management_mutate(v_workspace_one, v_admin, 'duplicate', v_song_link_id, v_song_link_revision, jsonb_build_object('slug', 'phase1b-source-snapshot-copy'));
  perform pg_temp.assert_true(
    (v_duplicate -> 'link' ->> 'production_song_id') is null
    and (v_duplicate -> 'link' ->> 'source_song_title') = 'Deleted Source Song'
    and (v_duplicate -> 'link' ->> 'source_artwork_url') = 'https://example.test/runtime-art.jpg',
    'duplicate preserves fallback snapshots after source-song deletion'
  );
end;
$$;

reset role;
set local role authenticated;
select pg_temp.assert_fails(
  $$select public.smart_link_management_mutate('61000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 'create', null, null, '{}'::jsonb)$$,
  '42501'
);
select pg_temp.assert_fails(
  $$select public.smart_link_update_workspace_pixel_settings('61000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', null, '123456789')$$,
  '42501'
);
reset role;

rollback;
