-- Satisfy Supabase's safe-update guard while retaining atomic full-list replacement.

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
