-- Separate release campaigns from general social-media campaigns.

alter table public.marketing_campaigns
  add column campaign_kind text not null default 'song',
  add column start_date date;

alter table public.marketing_campaigns
  add constraint marketing_campaigns_campaign_kind_check
  check (campaign_kind in ('song', 'general'));

update public.marketing_campaigns as campaign
set start_date = coalesce(
  (
    select min(campaign_day.campaign_date)
    from public.marketing_campaign_days as campaign_day
    where campaign_day.campaign_id = campaign.id
  ),
  campaign.release_date - 4
)
where campaign.start_date is null;

alter table public.marketing_campaigns
  alter column start_date set not null;

create index marketing_campaigns_kind_date_idx
  on public.marketing_campaigns (campaign_kind, release_date desc);
