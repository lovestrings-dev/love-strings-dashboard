-- Marketing mutations now pass through protected server routes.

drop policy if exists "Allow prototype writes to marketing campaigns"
  on public.marketing_campaigns;
drop policy if exists "Allow prototype writes to marketing campaign days"
  on public.marketing_campaign_days;
drop policy if exists "Allow prototype writes to marketing campaign tasks"
  on public.marketing_campaign_tasks;
