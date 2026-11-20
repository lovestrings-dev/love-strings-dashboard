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

create function pg_temp.assert_fails(statement text, expected_message text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlerrm like expected_message then return; end if;
    raise;
  end;
  raise exception 'Expected statement to fail: %', statement;
end;
$$;

-- Test fixtures use the existing development workspace. They are rolled back.
set local role service_role;

insert into public.production_songs (
  id, workspace_id, slug, title, production_deadline, release_date,
  roadmap_general_position, album_art_url, source, scheduling_model
) values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'smart-links-phase1a-test-song', 'Smart Links Test Song', '2030-01-01', '2030-01-15',
  999999, 'https://example.test/cover-a.jpg', 'test', 'legacy-v0'
);

insert into public.smart_links (
  id, workspace_id, production_song_id, public_slug, title_override
) values (
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001', 'smart-links-phase1a-test', 'Smart Links Test'
);

insert into public.app_workspaces (id, name, slug)
values ('50000000-0000-0000-0000-000000000001', 'Isolation Test', 'smart-links-phase1a-isolation');
insert into public.production_songs (
  id, workspace_id, slug, title, production_deadline, release_date,
  roadmap_general_position, album_art_url, source, scheduling_model
) values (
  '10000000-0000-0000-0000-000000000002',
  '50000000-0000-0000-0000-000000000001',
  'smart-links-phase1a-isolation-song', 'Isolation Song', '2030-01-02', '2030-01-16',
  999998, 'https://example.test/isolation-cover.jpg', 'test', 'legacy-v0'
);
insert into public.smart_links (
  id, workspace_id, production_song_id, public_slug
) values (
  '20000000-0000-0000-0000-000000000003',
  '50000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002', 'smart-links-phase1a-isolation-link'
);
select pg_temp.assert_fails(
  $$insert into public.smart_links (workspace_id, production_song_id, public_slug) values ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'cross-workspace-song')$$,
  '%not found in the Smart Link workspace%'
);

select pg_temp.assert_fails(
  $$insert into public.smart_links (workspace_id, public_slug) values ('00000000-0000-0000-0000-000000000001', 'artistdeck')$$,
  '%reserved%'
);
select pg_temp.assert_fails(
  $$insert into public.smart_links (workspace_id, public_slug) values ('00000000-0000-0000-0000-000000000001', 'smart-links-phase1a-test')$$,
  '%duplicate key%'
);

insert into public.smart_link_destinations (id, smart_link_id, platform_key, button_label, target_url, position)
values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'spotify', 'Spotify', 'https://open.spotify.com/test', 0);
insert into public.smart_link_destinations (smart_link_id, platform_key, button_label, target_url, position) values
  ('20000000-0000-0000-0000-000000000001', 'apple_music', 'Apple Music', 'https://music.apple.com/test', 1),
  ('20000000-0000-0000-0000-000000000001', 'youtube_music', 'YouTube Music', 'https://music.youtube.com/test', 2),
  ('20000000-0000-0000-0000-000000000001', 'amazon_music', 'Amazon Music', 'https://music.amazon.com/test', 3),
  ('20000000-0000-0000-0000-000000000001', 'deezer', 'Deezer', 'https://deezer.com/test', 4),
  ('20000000-0000-0000-0000-000000000001', 'custom', 'Website', 'https://example.test', 5);
select pg_temp.assert_fails(
  $$insert into public.smart_link_destinations (smart_link_id, platform_key, button_label, target_url, position) values ('20000000-0000-0000-0000-000000000001', 'spotify', 'Duplicate', 'https://example.test/duplicate', 6)$$,
  '%duplicate key%'
);
set constraints smart_link_destinations_position_key deferred;
update public.smart_link_destinations set position = 2 where smart_link_id = '20000000-0000-0000-0000-000000000001' and platform_key = 'apple_music';
update public.smart_link_destinations set position = 1 where smart_link_id = '20000000-0000-0000-0000-000000000001' and platform_key = 'youtube_music';
set constraints smart_link_destinations_position_key immediate;

update public.smart_links set status = 'published' where id = '20000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((select published_at is not null from public.smart_links where id = '20000000-0000-0000-0000-000000000001'), 'first publication sets published_at');
select pg_temp.assert_fails(
  $$update public.smart_links set public_slug = 'cannot-change' where id = '20000000-0000-0000-0000-000000000001'$$,
  '%immutable%'
);

update public.smart_links set status = 'disabled' where id = '20000000-0000-0000-0000-000000000001';
update public.smart_links set status = 'published' where id = '20000000-0000-0000-0000-000000000001';
update public.smart_links set status = 'archived' where id = '20000000-0000-0000-0000-000000000001';
update public.smart_links set status = 'disabled' where id = '20000000-0000-0000-0000-000000000001';
update public.smart_links set status = 'published' where id = '20000000-0000-0000-0000-000000000001';

insert into public.smart_links (id, workspace_id, public_slug, title_override)
values ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'smart-links-phase1a-archived', 'Archived Draft');
update public.smart_links set status = 'archived' where id = '20000000-0000-0000-0000-000000000002';
update public.smart_links set status = 'disabled' where id = '20000000-0000-0000-0000-000000000002';
insert into public.smart_link_destinations (smart_link_id, platform_key, button_label, target_url, position)
values ('20000000-0000-0000-0000-000000000002', 'custom', 'Listen', 'https://example.test/listen', 0);
update public.smart_links set status = 'published' where id = '20000000-0000-0000-0000-000000000002';
select pg_temp.assert_true((select published_at is not null from public.smart_links where id = '20000000-0000-0000-0000-000000000002'), 'archived unpublished draft can first publish through disabled');

select public.increment_smart_link_page_view('smart-links-phase1a-test');
select public.increment_smart_link_page_view('smart-links-phase1a-test');
select pg_temp.assert_true((select page_view_count = 2 from public.smart_link_daily_metrics where smart_link_id = '20000000-0000-0000-0000-000000000001'), 'daily page-view upsert increments atomically in one transaction');
select public.increment_smart_link_destination_click('smart-links-phase1a-test', '30000000-0000-0000-0000-000000000001');
update public.smart_link_destinations set target_url = 'https://open.spotify.com/replaced', is_enabled = false, retired_at = now() where id = '30000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((select click_count = 1 from public.smart_link_destination_daily_metrics where destination_id = '30000000-0000-0000-0000-000000000001'), 'URL replacement, disable, and retirement retain click totals');
select pg_temp.assert_fails(
  $$delete from public.smart_link_destinations where id = '30000000-0000-0000-0000-000000000001'$$,
  '%historical metrics cannot be deleted%'
);

update public.smart_links
set title_override = 'Manual Smart Link Title', artwork_url_override = 'https://example.test/manual-cover.jpg'
where id = '20000000-0000-0000-0000-000000000001';
create temp table pg_temp.smart_link_sync_marker as
select updated_at, ctid as row_ctid
from public.smart_links
where id = '20000000-0000-0000-0000-000000000001';
update public.production_songs
set title = title, album_art_url = album_art_url
where id = '10000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((
  select link.updated_at = marker.updated_at and link.ctid = marker.row_ctid
  from public.smart_links link
  cross join pg_temp.smart_link_sync_marker marker
  where link.id = '20000000-0000-0000-0000-000000000001'
), 'no-op source-song updates do not update the linked Smart Link row');
update public.production_songs
set title = 'Snapshot Updated'
where id = '10000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((
  select source_song_title = 'Snapshot Updated'
    and title_override = 'Manual Smart Link Title'
    and artwork_url_override = 'https://example.test/manual-cover.jpg'
  from public.smart_links
  where id = '20000000-0000-0000-0000-000000000001'
), 'genuine title updates refresh the source title and preserve manual overrides');
update public.production_songs
set album_art_url = 'https://example.test/cover-b.jpg'
where id = '10000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((
  select source_artwork_url = 'https://example.test/cover-b.jpg'
    and title_override = 'Manual Smart Link Title'
    and artwork_url_override = 'https://example.test/manual-cover.jpg'
  from public.smart_links
  where id = '20000000-0000-0000-0000-000000000001'
), 'genuine artwork updates refresh the source artwork and preserve manual overrides');
select pg_temp.assert_true((
  select source_song_title = 'Isolation Song'
    and source_artwork_url = 'https://example.test/isolation-cover.jpg'
  from public.smart_links
  where id = '20000000-0000-0000-0000-000000000003'
), 'song synchronization remains workspace-isolated');
delete from public.production_songs where id = '10000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((
  select production_song_id is null
    and source_song_title = 'Snapshot Updated'
    and source_artwork_url = 'https://example.test/cover-b.jpg'
    and title_override = 'Manual Smart Link Title'
    and artwork_url_override = 'https://example.test/manual-cover.jpg'
  from public.smart_links
  where id = '20000000-0000-0000-0000-000000000001'
), 'song deletion keeps usable fallback snapshots and manual overrides');

update public.app_workspace_settings set timezone = 'Invalid/Timezone' where workspace_id = '00000000-0000-0000-0000-000000000001';
select pg_temp.assert_fails(
  $$select public.increment_smart_link_page_view('smart-links-phase1a-test')$$,
  '%time zone%'
);
update public.app_workspace_settings set timezone = 'Europe/Vienna' where workspace_id = '00000000-0000-0000-0000-000000000001';

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select pg_temp.assert_fails(
  $$insert into public.smart_links (workspace_id, public_slug) values ('00000000-0000-0000-0000-000000000001', 'browser-write-denied')$$,
  '%permission denied%'
);
select pg_temp.assert_fails(
  $$select public.increment_smart_link_page_view('smart-links-phase1a-test')$$,
  '%permission denied%'
);
reset role;
set local role anon;
select pg_temp.assert_fails(
  $$insert into public.workspace_meta_pixel_settings (workspace_id, default_pixel_id) values ('00000000-0000-0000-0000-000000000001', '123')$$,
  '%permission denied%'
);
reset role;

rollback;
