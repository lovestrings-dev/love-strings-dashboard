with youtube_account as (
  select pa.id as platform_account_id, p.id as platform_id
  from public.platform_accounts pa
  join public.platforms p on p.id = pa.platform_id
  where p.slug = 'youtube'
    and pa.account_name = 'Love Strings YouTube Channel'
  limit 1
),
metric_seed as (
  select *
  from (
    values
      (date '2026-06-18', 13),
      (date '2026-06-19', 121),
      (date '2026-06-20', 183),
      (date '2026-06-21', 228),
      (date '2026-06-22', 255),
      (date '2026-06-23', 260),
      (date '2026-06-24', 274),
      (date '2026-06-25', 277),
      (date '2026-06-27', 281),
      (date '2026-06-28', 283),
      (date '2026-06-29', 284),
      (date '2026-06-30', 287),
      (date '2026-07-01', 287),
      (date '2026-07-03', 289),
      (date '2026-07-05', 1390),
      (date '2026-07-06', 1394),
      (date '2026-07-07', 1400),
      (date '2026-07-08', 1400),
      (date '2026-07-09', 1401),
      (date '2026-07-10', 1407),
      (date '2026-07-13', 1417),
      (date '2026-07-15', 1418),
      (date '2026-07-16', 1418)
  ) as v(snapshot_date, metric_value)
)
insert into public.platform_metric_snapshots (
  snapshot_date,
  platform_id,
  platform_account_id,
  metric_name,
  metric_value,
  metric_unit,
  source,
  notes
)
select
  metric_seed.snapshot_date,
  youtube_account.platform_id,
  youtube_account.platform_account_id,
  'total_channel_views',
  metric_seed.metric_value,
  'views',
  'manual-history',
  null
from metric_seed
cross join youtube_account
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
  notes = null,
  imported_at = now();
