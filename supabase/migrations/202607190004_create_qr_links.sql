-- Shared QR list used on Dashboard and Platforms.

create table public.qr_links (
  id uuid primary key default gen_random_uuid(),
  stable_key text not null unique,
  name text not null default '',
  qr_image_url text not null default '',
  target_url text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index qr_links_position_idx on public.qr_links (position);

create trigger qr_links_set_updated_at
before update on public.qr_links
for each row execute function public.set_updated_at();

alter table public.qr_links enable row level security;

create or replace function public.replace_qr_links(p_links jsonb)
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

  delete from public.qr_links where stable_key is not null;

  for link_record in select value from jsonb_array_elements(p_links)
  loop
    insert into public.qr_links (
      stable_key,
      name,
      qr_image_url,
      target_url,
      position
    )
    values (
      link_record ->> 'stable_key',
      coalesce(link_record ->> 'name', ''),
      coalesce(link_record ->> 'qr_image_url', ''),
      coalesce(link_record ->> 'target_url', ''),
      (link_record ->> 'position')::integer
    );
  end loop;
end;
$$;

revoke all on function public.replace_qr_links(jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_qr_links(jsonb) to service_role;
