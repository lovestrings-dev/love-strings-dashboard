-- Marketing Defaults V1: timing only. Existing campaigns keep their own saved
-- offsets and are deliberately not rewritten by this migration.
alter table public.app_workspace_settings
  add column if not exists marketing_song_campaign_length_days integer not null default 14,
  add column if not exists marketing_song_campaign_advance_days integer not null default 3,
  add column if not exists marketing_general_campaign_length_days integer not null default 14;

alter table public.app_workspace_settings
  drop constraint if exists app_workspace_settings_marketing_timing_defaults_check;
alter table public.app_workspace_settings
  add constraint app_workspace_settings_marketing_timing_defaults_check check (
    marketing_song_campaign_length_days > 0
    and marketing_general_campaign_length_days > 0
    and marketing_song_campaign_advance_days >= 0
    and marketing_song_campaign_advance_days < marketing_song_campaign_length_days
  );

alter table public.marketing_campaigns
  add column if not exists marketing_song_campaign_length_days integer,
  add column if not exists marketing_song_campaign_advance_days integer;

alter table public.marketing_campaigns
  drop constraint if exists marketing_campaigns_song_timing_snapshot_check;
alter table public.marketing_campaigns
  add constraint marketing_campaigns_song_timing_snapshot_check check (
    (marketing_song_campaign_length_days is null and marketing_song_campaign_advance_days is null)
    or (
      marketing_song_campaign_length_days > 0
      and marketing_song_campaign_advance_days >= 0
      and marketing_song_campaign_advance_days < marketing_song_campaign_length_days
    )
  );
