-- Shift campaign dates through a temporary range so adjacent dates never
-- collide with the campaign's existing unique (campaign_id, campaign_date) rows.

create or replace function public.sync_marketing_campaign_day_dates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.release_date is distinct from old.release_date then
    update public.marketing_campaign_days
    set campaign_date = campaign_date + interval '100 years'
    where campaign_id = new.id;

    update public.marketing_campaign_days
    set campaign_date = new.release_date + release_offset
    where campaign_id = new.id;
  end if;

  return new;
end;
$$;
