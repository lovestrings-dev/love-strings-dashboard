delete from public.platform_metric_snapshots pms
using public.platforms p
where pms.platform_id = p.id
  and p.slug = 'youtube'
  and pms.metric_name = 'total_channel_views'
  and pms.source = 'manual-history'
  and pms.snapshot_date < date '2026-06-18';
