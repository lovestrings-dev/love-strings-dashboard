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
      (date '2026-05-22', 250),
      (date '2026-06-04', 450),
      (date '2026-06-11', 590),
      (date '2026-06-14', 780),
      (date '2026-07-16', 1400)
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
  'Invented historical seed for YouTube total channel views graph'
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
  notes = excluded.notes,
  imported_at = now();
