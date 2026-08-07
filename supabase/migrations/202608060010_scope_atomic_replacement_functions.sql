-- Phase 3: atomic replacement functions must prove that their target belongs
-- to the validated workspace before deleting or inserting child records.

alter table public.qr_links drop constraint qr_links_stable_key_key;
alter table public.qr_links
  add constraint qr_links_workspace_stable_key_key unique (workspace_id, stable_key);

alter table public.budget_entries drop constraint budget_entries_stable_key_key;
alter table public.budget_entries
  add constraint budget_entries_workspace_stable_key_key unique (workspace_id, stable_key);
alter table public.budget_hidden_generated_entries
  drop constraint budget_hidden_generated_entries_generated_entry_id_key;
alter table public.budget_hidden_generated_entries
  add constraint budget_hidden_workspace_generated_key
  unique (workspace_id, generated_entry_id);

alter table public.event_locations drop constraint event_locations_stable_key_key;
alter table public.event_locations
  add constraint event_locations_workspace_stable_key_key unique (workspace_id, stable_key);
alter table public.events drop constraint events_stable_key_key;
alter table public.events
  add constraint events_workspace_stable_key_key unique (workspace_id, stable_key);

alter table public.marketing_campaign_budget_lines
  drop constraint marketing_campaign_budget_lines_pkey;
alter table public.marketing_campaign_budget_lines
  add constraint marketing_campaign_budget_lines_pkey primary key (campaign_id, id);

drop function public.replace_marketing_campaign_days(uuid, jsonb);
create function public.replace_marketing_campaign_days(
  p_workspace_id uuid,
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
    select 1 from public.marketing_campaigns
    where id = p_campaign_id and workspace_id = p_workspace_id
  ) then
    raise exception 'Marketing campaign not found in workspace.';
  end if;

  delete from public.marketing_campaign_days where campaign_id = p_campaign_id;
  for day_record in select value from jsonb_array_elements(p_days)
  loop
    insert into public.marketing_campaign_days (
      campaign_id, day_number, campaign_date, release_offset, clip_name, is_default_day
    ) values (
      p_campaign_id,
      (day_record ->> 'day_number')::integer,
      (day_record ->> 'campaign_date')::date,
      (day_record ->> 'release_offset')::integer,
      coalesce(day_record ->> 'clip_name', ''),
      coalesce((day_record ->> 'is_default_day')::boolean, true)
    ) returning id into saved_day_id;

    for task_record in
      select value from jsonb_array_elements(coalesce(day_record -> 'tasks', '[]'::jsonb))
    loop
      insert into public.marketing_campaign_tasks (
        campaign_day_id, task_kind, title, status, position, is_standard_task
      ) values (
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
revoke all on function public.replace_marketing_campaign_days(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_marketing_campaign_days(uuid, uuid, jsonb)
  to service_role;

drop function public.replace_marketing_campaign_budget_lines(uuid, jsonb);
create function public.replace_marketing_campaign_budget_lines(
  p_workspace_id uuid,
  p_campaign_id uuid,
  p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  line_record jsonb;
begin
  if jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Campaign budget lines must be a JSON array.';
  end if;
  if not exists (
    select 1 from public.marketing_campaigns
    where id = p_campaign_id and workspace_id = p_workspace_id
  ) then
    raise exception 'Marketing campaign not found in workspace.';
  end if;

  delete from public.marketing_campaign_budget_lines where campaign_id = p_campaign_id;
  for line_record in select value from jsonb_array_elements(p_lines)
  loop
    insert into public.marketing_campaign_budget_lines (
      id, campaign_id, description, amount, position
    ) values (
      line_record ->> 'id',
      p_campaign_id,
      coalesce(line_record ->> 'description', ''),
      (line_record ->> 'amount')::numeric,
      (line_record ->> 'position')::integer
    );
  end loop;
end;
$$;
revoke all on function public.replace_marketing_campaign_budget_lines(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_marketing_campaign_budget_lines(uuid, uuid, jsonb)
  to service_role;

drop function public.replace_qr_links(jsonb);
create function public.replace_qr_links(p_workspace_id uuid, p_links jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  link_record jsonb;
begin
  if jsonb_typeof(p_links) <> 'array' then
    raise exception 'QR links must be a JSON array.';
  end if;

  delete from public.qr_links where workspace_id = p_workspace_id;
  for link_record in select value from jsonb_array_elements(p_links)
  loop
    insert into public.qr_links (
      workspace_id, stable_key, name, qr_image_url, target_url, position
    ) values (
      p_workspace_id,
      link_record ->> 'stable_key',
      coalesce(link_record ->> 'name', ''),
      coalesce(link_record ->> 'qr_image_url', ''),
      coalesce(link_record ->> 'target_url', ''),
      (link_record ->> 'position')::integer
    );
  end loop;
end;
$$;
revoke all on function public.replace_qr_links(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_qr_links(uuid, jsonb) to service_role;
