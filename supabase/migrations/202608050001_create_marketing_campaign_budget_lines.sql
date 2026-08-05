-- Store campaign-level marketing income and expenses in the shared database.

create table public.marketing_campaign_budget_lines (
  id text primary key,
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  description text not null default '',
  amount numeric(12, 2) not null default 0,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index marketing_campaign_budget_lines_campaign_position_idx
  on public.marketing_campaign_budget_lines (campaign_id, position);

create trigger marketing_campaign_budget_lines_set_updated_at
before update on public.marketing_campaign_budget_lines
for each row execute function public.set_updated_at();

alter table public.marketing_campaign_budget_lines enable row level security;

create policy "Allow public read of marketing campaign budget lines"
on public.marketing_campaign_budget_lines
for select
to anon
using (true);

create or replace function public.replace_marketing_campaign_budget_lines(
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
    select 1 from public.marketing_campaigns where id = p_campaign_id
  ) then
    raise exception 'Marketing campaign not found.';
  end if;

  delete from public.marketing_campaign_budget_lines
  where campaign_id = p_campaign_id;

  for line_record in select value from jsonb_array_elements(p_lines)
  loop
    insert into public.marketing_campaign_budget_lines (
      id, campaign_id, description, amount, position
    )
    values (
      line_record ->> 'id',
      p_campaign_id,
      coalesce(line_record ->> 'description', ''),
      (line_record ->> 'amount')::numeric,
      (line_record ->> 'position')::integer
    );
  end loop;
end;
$$;

revoke all on function public.replace_marketing_campaign_budget_lines(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_marketing_campaign_budget_lines(uuid, jsonb)
  to service_role;
