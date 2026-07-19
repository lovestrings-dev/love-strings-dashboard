-- Replace a campaign plan inside one database transaction. Any invalid day or
-- task rolls the entire replacement back, preserving the previous plan.

create or replace function public.replace_marketing_campaign_days(
  p_campaign_id uuid,
  p_days jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  day_record jsonb;
  task_record jsonb;
  saved_day_id uuid;
begin
  if jsonb_typeof(p_days) <> 'array' then
    raise exception 'Campaign days must be a JSON array.';
  end if;

  if not exists (
    select 1 from public.marketing_campaigns where id = p_campaign_id
  ) then
    raise exception 'Marketing campaign not found.';
  end if;

  delete from public.marketing_campaign_days
  where campaign_id = p_campaign_id;

  for day_record in select value from jsonb_array_elements(p_days)
  loop
    insert into public.marketing_campaign_days (
      campaign_id,
      day_number,
      campaign_date,
      release_offset,
      clip_name,
      is_default_day
    )
    values (
      p_campaign_id,
      (day_record ->> 'day_number')::integer,
      (day_record ->> 'campaign_date')::date,
      (day_record ->> 'release_offset')::integer,
      coalesce(day_record ->> 'clip_name', ''),
      coalesce((day_record ->> 'is_default_day')::boolean, true)
    )
    returning id into saved_day_id;

    for task_record in
      select value
      from jsonb_array_elements(coalesce(day_record -> 'tasks', '[]'::jsonb))
    loop
      insert into public.marketing_campaign_tasks (
        campaign_day_id,
        task_kind,
        title,
        status,
        position,
        is_standard_task
      )
      values (
        saved_day_id,
        task_record ->> 'task_kind',
        coalesce(task_record ->> 'title', ''),
        task_record ->> 'status',
        (task_record ->> 'position')::integer,
        coalesce((task_record ->> 'is_standard_task')::boolean, false)
      );
    end loop;
  end loop;
end;
$$;

revoke all on function public.replace_marketing_campaign_days(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_marketing_campaign_days(uuid, jsonb)
  to service_role;
