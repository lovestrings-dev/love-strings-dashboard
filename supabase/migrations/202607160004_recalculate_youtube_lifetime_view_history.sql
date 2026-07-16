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
      (date '2026-06-18', 16361),
      (date '2026-06-19', 16469),
      (date '2026-06-20', 16531),
      (date '2026-06-21', 16576),
      (date '2026-06-22', 16603),
      (date '2026-06-23', 16608),
      (date '2026-06-24', 16622),
      (date '2026-06-25', 16625),
      (date '2026-06-27', 16629),
      (date '2026-06-28', 16631),
      (date '2026-06-29', 16632),
      (date '2026-06-30', 16635),
      (date '2026-07-01', 16635),
      (date '2026-07-03', 16637),
      (date '2026-07-05', 17738),
      (date '2026-07-06', 17742),
      (date '2026-07-07', 17748),
      (date '2026-07-08', 17748),
      (date '2026-07-09', 17749),
      (date '2026-07-10', 17755),
      (date '2026-07-13', 17765),
      (date '2026-07-15', 17766),
      (date '2026-07-16', 17766)
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
