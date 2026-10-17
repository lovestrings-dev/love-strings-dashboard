-- Linked Production-only sharing. Canonical song/step RLS remains unchanged.
begin;

create unique index if not exists production_songs_id_workspace_sharing_key
  on public.production_songs (id, workspace_id);

create table public.production_song_sharing_defaults (
  workspace_id uuid primary key references public.app_workspaces(id) on delete cascade,
  destination_workspace_id uuid references public.app_workspaces(id) on delete set null,
  check (workspace_id <> destination_workspace_id)
);
create table public.production_song_shares (
  id uuid primary key default gen_random_uuid(),
  production_song_id uuid not null unique,
  source_workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  destination_workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  created_at timestamptz not null default now(),
  foreign key (production_song_id, source_workspace_id)
    references public.production_songs(id, workspace_id) on delete cascade,
  check (source_workspace_id <> destination_workspace_id)
);
create index production_song_shares_destination_idx
  on public.production_song_shares(destination_workspace_id);
alter table public.production_song_shares enable row level security;
alter table public.production_song_sharing_defaults enable row level security;
revoke all on public.production_song_shares, public.production_song_sharing_defaults from anon, authenticated;
grant all on public.production_song_shares, public.production_song_sharing_defaults to service_role;

create function public.production_share_destination_allowed(p_source uuid, p_destination uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_source <> p_destination and exists (
    select 1 from public.app_workspace_members s
    join public.app_workspace_members d on d.user_id = s.user_id
    join public.app_workspaces sw on sw.id = s.workspace_id
    join public.app_workspaces dw on dw.id = d.workspace_id
    where s.workspace_id = p_source and d.workspace_id = p_destination
      and sw.access_state = 'active' and dw.access_state = 'active'
  );
$$;

create function public.set_production_song_sharing(
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
    insert into public.production_song_sharing_defaults(workspace_id, destination_workspace_id)
      values (p_workspace_id, p_destination)
      on conflict (workspace_id) do update set destination_workspace_id = excluded.destination_workspace_id;
  else
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
  end if;
end;
$$;

create function public.remove_received_production_song_share(p_workspace_id uuid, p_actor uuid, p_share_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.app_workspace_members m
    join public.app_workspaces w on w.id = m.workspace_id
    where m.workspace_id = p_workspace_id and m.user_id = p_actor and w.access_state = 'active') then
    raise exception 'Destination workspace access denied.' using errcode = '42501';
  end if;
  delete from public.production_song_shares
    where id = p_share_id and destination_workspace_id = p_workspace_id;
  if not found then raise exception 'Received song share not found.' using errcode = '42501'; end if;
end;
$$;

create function public.apply_default_production_song_share()
returns trigger language plpgsql security definer set search_path = public as $$
declare destination uuid;
begin
  select d.destination_workspace_id into destination
    from public.production_song_sharing_defaults d where d.workspace_id = new.workspace_id;
  if destination is not null and public.production_share_destination_allowed(new.workspace_id, destination) then
    insert into public.production_song_shares(production_song_id, source_workspace_id, destination_workspace_id)
      values (new.id, new.workspace_id, destination);
  end if;
  return new;
end;
$$;
create trigger apply_default_production_song_share after insert on public.production_songs
for each row execute function public.apply_default_production_song_share();

revoke all on function public.production_share_destination_allowed(uuid, uuid) from public, anon, authenticated;
revoke all on function public.set_production_song_sharing(uuid, uuid, uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.remove_received_production_song_share(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.apply_default_production_song_share() from public, anon, authenticated;
grant execute on function public.production_share_destination_allowed(uuid, uuid) to service_role;
grant execute on function public.set_production_song_sharing(uuid, uuid, uuid, uuid, boolean) to service_role;
grant execute on function public.remove_received_production_song_share(uuid, uuid, uuid) to service_role;
commit;
