-- Individual song sharing replaces automatic defaults. Existing links stay intact.
begin;
drop trigger if exists apply_default_production_song_share on public.production_songs;
drop function if exists public.apply_default_production_song_share();
-- Keep the retired defaults table as inert historical data; no destructive cleanup.
create or replace function public.set_production_song_sharing(
  p_workspace_id uuid, p_actor uuid, p_destination uuid,
  p_song_id uuid default null, p_is_default boolean default false
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.app_workspace_members m
    join public.app_workspaces w on w.id = m.workspace_id
    where m.workspace_id = p_workspace_id and m.user_id = p_actor
      and m.role = 'admin' and w.access_state = 'active') then
    raise exception 'Only a source workspace Admin can manage song sharing.' using errcode = '42501';
  end if;
  if p_destination is not null and not public.production_share_destination_allowed(p_workspace_id, p_destination) then
    raise exception 'Choose an active destination with a member in common.' using errcode = '22023';
  end if;
  if p_is_default then
    raise exception 'Songs must be shared individually.' using errcode = '22023';
  end if;
    perform 1 from public.production_songs s
      where s.id = p_song_id and s.workspace_id = p_workspace_id for update;
    if not found then raise exception 'Source song not found.' using errcode = '42501'; end if;
    if p_destination is null then
      delete from public.production_song_shares where production_song_id = p_song_id and source_workspace_id = p_workspace_id;
    else
      insert into public.production_song_shares(production_song_id, source_workspace_id, destination_workspace_id)
        values (p_song_id, p_workspace_id, p_destination)
        on conflict (production_song_id) do update
          set destination_workspace_id = excluded.destination_workspace_id;
    end if;
end;
$$;

revoke all on function public.set_production_song_sharing(uuid, uuid, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_production_song_sharing(uuid, uuid, uuid, uuid, boolean) to service_role;
commit;
