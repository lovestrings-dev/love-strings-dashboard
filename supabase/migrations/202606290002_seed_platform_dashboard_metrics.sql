insert into public.platforms (slug, name, category)
values
  ('amazon-music', 'Amazon Music', 'streaming'),
  ('deezer', 'Deezer', 'streaming'),
  ('youtube-music', 'YouTube Music', 'streaming')
on conflict (slug) do update
set
  name = excluded.name,
  category = excluded.category;

insert into public.releases (title, release_type, status)
values ('Flowers', 'single', 'released')
on conflict do nothing;

with platform_seed as (
  select p.id as platform_id, v.account_name, v.url
  from (
    values
      ('instagram', 'Love Strings Instagram', null),
      ('youtube', 'Love Strings YouTube Channel', null),
      ('youtube-music', 'Love Strings YouTube Music', null),
      ('spotify', 'Love Strings Spotify', null),
      ('apple-music', 'Love Strings Apple Music', null),
      ('amazon-music', 'Love Strings Amazon Music', null),
      ('deezer', 'Love Strings Deezer', null)
  ) as v(platform_slug, account_name, url)
  join public.platforms p on p.slug = v.platform_slug
)
insert into public.platform_accounts (platform_id, account_name, url)
select platform_id, account_name, url
from platform_seed
on conflict (platform_id, account_name) do update
set url = excluded.url;

with content_seed as (
  select
    pa.id as platform_account_id,
    v.title,
    v.content_type,
    v.external_id
  from (
    values
      (
        'Love Strings Instagram',
        'Our version of Flowers is officially out!',
        'reel',
        'manual-instagram-flowers-out'
      ),
      (
        'Love Strings YouTube Channel',
        'A Rooftop Sunset in Vienna | Wonderful Life (Acoustic Cover)',
        'video',
        'manual-youtube-wonderful-life'
      ),
      (
        'Love Strings YouTube Channel',
        'Learning English Through Music',
        'short',
        'manual-youtube-learning-english'
      )
  ) as v(account_name, title, content_type, external_id)
  join public.platform_accounts pa on pa.account_name = v.account_name
)
insert into public.content_posts (
  platform_account_id,
  title,
  content_type,
  external_id,
  related_release_id
)
select
  content_seed.platform_account_id,
  content_seed.title,
  content_seed.content_type,
  content_seed.external_id,
  case
    when content_seed.title = 'Our version of Flowers is officially out!'
      then (select id from public.releases where title = 'Flowers' limit 1)
    else null
  end
from content_seed
on conflict (platform_account_id, external_id) do update
set
  title = excluded.title,
  content_type = excluded.content_type,
  related_release_id = excluded.related_release_id;

with metric_seed as (
  select *
  from (
    values
      ('instagram', 'Love Strings Instagram', null, null, 'followers', 184, 'count', null),
      ('instagram', 'Love Strings Instagram', null, null, 'accounts_reached_30d', 3500, 'count', null),
      (
        'instagram',
        'Love Strings Instagram',
        'manual-instagram-flowers-out',
        null,
        'latest_reel_post_views',
        2100,
        'views',
        'Our version of Flowers is officially out!'
      ),
      ('youtube', 'Love Strings YouTube Channel', null, null, 'subscribers', 39, 'count', null),
      (
        'youtube',
        'Love Strings YouTube Channel',
        'manual-youtube-wonderful-life',
        null,
        'latest_video_views',
        39,
        'views',
        'A Rooftop Sunset in Vienna | Wonderful Life (Acoustic Cover)'
      ),
      (
        'youtube',
        'Love Strings YouTube Channel',
        'manual-youtube-learning-english',
        null,
        'latest_short_views',
        19,
        'views',
        'Learning English Through Music'
      ),
      ('youtube-music', 'Love Strings YouTube Music', null, null, 'subscribers', 11, 'count', null),
      ('youtube-music', 'Love Strings YouTube Music', null, null, 'total_plays', 75, 'plays', null),
      ('youtube-music', 'Love Strings YouTube Music', null, 'Flowers', 'current_release_plays', 15, 'plays', 'Flowers'),
      ('spotify', 'Love Strings Spotify', null, null, 'followers', 10, 'count', null),
      ('spotify', 'Love Strings Spotify', null, null, 'total_streams', 19, 'streams', null),
      ('spotify', 'Love Strings Spotify', null, 'Flowers', 'current_release_streams', 4, 'streams', 'Flowers'),
      ('apple-music', 'Love Strings Apple Music', null, null, 'listeners', 5, 'count', null),
      ('apple-music', 'Love Strings Apple Music', null, null, 'total_plays', 3, 'plays', null),
      ('apple-music', 'Love Strings Apple Music', null, 'Flowers', 'current_release_plays', 1, 'plays', 'Flowers'),
      ('amazon-music', 'Love Strings Amazon Music', null, null, 'listeners', 3, 'count', null),
      ('amazon-music', 'Love Strings Amazon Music', null, null, 'total_streams', 4, 'streams', null),
      ('amazon-music', 'Love Strings Amazon Music', null, 'Flowers', 'current_release_streams', 2, 'streams', 'Flowers'),
      ('deezer', 'Love Strings Deezer', null, null, 'fans', 2, 'count', null),
      ('deezer', 'Love Strings Deezer', null, null, 'total_streams', 4, 'streams', null),
      ('deezer', 'Love Strings Deezer', null, 'Flowers', 'current_release_streams', 2, 'streams', 'Flowers')
  ) as v(
    platform_slug,
    account_name,
    content_external_id,
    release_title,
    metric_name,
    metric_value,
    metric_unit,
    notes
  )
),
resolved_metric_seed as (
  select
    date '2026-06-29' as snapshot_date,
    p.id as platform_id,
    pa.id as platform_account_id,
    cp.id as content_post_id,
    r.id as release_id,
    metric_seed.metric_name,
    metric_seed.metric_value,
    metric_seed.metric_unit,
    metric_seed.notes
  from metric_seed
  join public.platforms p on p.slug = metric_seed.platform_slug
  join public.platform_accounts pa
    on pa.platform_id = p.id
    and pa.account_name = metric_seed.account_name
  left join public.content_posts cp
    on cp.platform_account_id = pa.id
    and cp.external_id = metric_seed.content_external_id
  left join public.releases r on r.title = metric_seed.release_title
)
insert into public.platform_metric_snapshots (
  snapshot_date,
  platform_id,
  platform_account_id,
  content_post_id,
  release_id,
  metric_name,
  metric_value,
  metric_unit,
  source,
  notes
)
select
  snapshot_date,
  platform_id,
  platform_account_id,
  content_post_id,
  release_id,
  metric_name,
  metric_value,
  metric_unit,
  'manual-dashboard-seed',
  notes
from resolved_metric_seed
on conflict (
  snapshot_date,
  platform_id,
  platform_account_id,
  content_post_id,
  song_id,
  release_id,
  metric_name,
  source
)
do update
set
  metric_value = excluded.metric_value,
  metric_unit = excluded.metric_unit,
  notes = excluded.notes,
  imported_at = now();

create policy "Allow public read of platforms"
on public.platforms
for select
to anon
using (true);

create policy "Allow public read of platform accounts"
on public.platform_accounts
for select
to anon
using (true);

create policy "Allow public read of content posts"
on public.content_posts
for select
to anon
using (true);

create policy "Allow public read of releases"
on public.releases
for select
to anon
using (true);

create policy "Allow public read of platform metric snapshots"
on public.platform_metric_snapshots
for select
to anon
using (true);
