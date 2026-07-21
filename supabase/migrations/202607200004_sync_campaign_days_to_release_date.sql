-- Keep every campaign day aligned when the shared release date changes.

create or replace function public.sync_marketing_campaign_day_dates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.release_date is distinct from old.release_date then
    update public.marketing_campaign_days
    set campaign_date = new.release_date + release_offset
    where campaign_id = new.id;
  end if;

  return new;
end;
$$;

create trigger marketing_campaigns_sync_day_dates
after update of release_date on public.marketing_campaigns
for each row execute function public.sync_marketing_campaign_day_dates();

update public.marketing_campaign_days as campaign_day
set campaign_date = campaign.release_date + campaign_day.release_offset
from public.marketing_campaigns as campaign
where campaign.id = campaign_day.campaign_id
  and campaign_day.campaign_date is distinct from campaign.release_date + campaign_day.release_offset;
