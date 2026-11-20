-- ArtistDeck Smart Links Phase 1A foundation.
-- This migration is additive only. Public delivery and management routes are
-- intentionally deferred to later approved phases.

begin;

create table public.smart_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  production_song_id uuid,
  public_slug text not null,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'disabled', 'archived')),
  source_song_title text not null default '',
  source_artist_name text not null default '',
  source_artwork_url text not null default '',
  title_override text,
  artist_name_override text,
  artwork_url_override text,
  background_mode text not null default 'blurred-artwork'
    check (background_mode in ('blurred-artwork', 'solid-color')),
  background_color text,
  social_links jsonb not null default '[]'::jsonb,
  pixel_mode text not null default 'inherit'
    check (pixel_mode in ('inherit', 'override', 'disabled')),
  pixel_override_id text,
  published_at timestamptz,
  disabled_at timestamptz,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint smart_links_slug_format_check check (
    public_slug = lower(public_slug)
    and char_length(public_slug) between 2 and 80
    and public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint smart_links_background_color_check check (
    background_color is null or background_color ~ '^#[0-9a-fA-F]{6}$'
  ),
  constraint smart_links_pixel_override_check check (
    (pixel_mode = 'override' and nullif(btrim(pixel_override_id), '') is not null)
    or (pixel_mode <> 'override' and pixel_override_id is null)
  ),
  constraint smart_links_workspace_song_fk
    foreign key (production_song_id, workspace_id)
    references public.production_songs(id, workspace_id)
    on delete set null (production_song_id)
);

create unique index smart_links_public_slug_key on public.smart_links(public_slug);
create index smart_links_workspace_status_updated_idx
  on public.smart_links(workspace_id, status, updated_at desc);
create index smart_links_workspace_song_idx
  on public.smart_links(workspace_id, production_song_id)
  where production_song_id is not null;

create table public.smart_link_destinations (
  id uuid primary key default gen_random_uuid(),
  smart_link_id uuid not null references public.smart_links(id) on delete cascade,
  platform_key text not null check (
    platform_key in (
      'spotify', 'apple_music', 'youtube_music',
      'amazon_music', 'deezer', 'custom'
    )
  ),
  button_label text not null default '',
  target_url text not null check (target_url ~ '^https://'),
  source_kind text not null default 'manual'
    check (source_kind in ('manual', 'catalog')),
  source_metadata jsonb not null default '{}'::jsonb,
  position integer not null check (position >= 0),
  is_enabled boolean not null default true,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint smart_link_destinations_platform_key_key unique (smart_link_id, platform_key),
  constraint smart_link_destinations_position_key
    unique (smart_link_id, position) deferrable initially immediate
);

create index smart_link_destinations_link_enabled_position_idx
  on public.smart_link_destinations(smart_link_id, is_enabled, position);

create table public.smart_link_daily_metrics (
  smart_link_id uuid not null references public.smart_links(id) on delete cascade,
  metric_date date not null,
  metric_timezone text not null,
  page_view_count bigint not null default 0 check (page_view_count >= 0),
  primary key (smart_link_id, metric_date, metric_timezone)
);

create index smart_link_daily_metrics_date_idx
  on public.smart_link_daily_metrics(metric_date desc);

create table public.smart_link_destination_daily_metrics (
  destination_id uuid not null
    references public.smart_link_destinations(id) on delete cascade,
  metric_date date not null,
  metric_timezone text not null,
  click_count bigint not null default 0 check (click_count >= 0),
  primary key (destination_id, metric_date, metric_timezone)
);

create index smart_link_destination_daily_metrics_date_idx
  on public.smart_link_destination_daily_metrics(metric_date desc);

create table public.workspace_meta_pixel_settings (
  workspace_id uuid primary key references public.app_workspaces(id) on delete cascade,
  default_pixel_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_meta_pixel_settings_pixel_id_check
    check (default_pixel_id is null or nullif(btrim(default_pixel_id), '') is not null)
);

create or replace function public.smart_link_slug_is_reserved(p_slug text)
returns boolean
language sql
immutable
set search_path = pg_catalog, public, pg_temp
as $$
  select p_slug in (
    'api', '_next', 'artistdeck', 'budget', 'dashboard', 'events',
    'favicon.ico', 'forgot-password', 'login', 'marketing', 'no-workspace',
    'platform', 'platforms', 'privacy', 'production', 'roadmap', 'robots.txt',
    'set-password', 'sitemap.xml', 'studio', 'terms', 'workspace-unavailable'
  );
$$;

create or replace function public.smart_link_social_links_are_valid(p_links jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog, public, pg_temp
as $$
  select jsonb_typeof(p_links) = 'array'
    and jsonb_array_length(p_links) <= 12
    and not exists (
      select 1
      from jsonb_array_elements(p_links) with ordinality as entry(value, ordinal)
      where jsonb_typeof(entry.value) <> 'object'
        or coalesce(entry.value ->> 'platform', '') not in (
          'instagram', 'facebook', 'youtube', 'tiktok', 'threads', 'website', 'custom'
        )
        or coalesce(entry.value ->> 'url', '') !~ '^https://'
        or char_length(coalesce(entry.value ->> 'url', '')) > 2000
        or char_length(coalesce(entry.value ->> 'label', '')) > 80
        or coalesce(entry.value ->> 'position', '') !~ '^[0-9]+$'
        or (entry.value ? 'isEnabled' and jsonb_typeof(entry.value -> 'isEnabled') <> 'boolean')
    );
$$;

alter table public.smart_links
  add constraint smart_links_social_links_check
  check (public.smart_link_social_links_are_valid(social_links));

create or replace function public.prepare_smart_link_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_workspace_name text;
  v_song_title text;
  v_song_artwork_url text;
begin
  select workspace.name into v_workspace_name
  from public.app_workspaces workspace
  where workspace.id = new.workspace_id;
  if not found then
    raise exception 'Smart Link workspace was not found.';
  end if;

  new.source_artist_name := v_workspace_name;

  if new.production_song_id is not null then
    select song.title, song.album_art_url
    into v_song_title, v_song_artwork_url
    from public.production_songs song
    where song.id = new.production_song_id
      and song.workspace_id = new.workspace_id;
    if not found then
      raise exception 'Production song was not found in the Smart Link workspace.';
    end if;
    new.source_song_title := v_song_title;
    new.source_artwork_url := v_song_artwork_url;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_smart_link_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_has_enabled_destination boolean;
begin
  if public.smart_link_slug_is_reserved(new.public_slug) then
    raise exception 'This Smart Link slug is reserved.';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'Smart Links must be created as Drafts.';
    end if;
    if new.published_at is not null or new.disabled_at is not null or new.archived_at is not null then
      raise exception 'Smart Link lifecycle timestamps are system-managed.';
    end if;
    return new;
  end if;

  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'Smart Link workspace ownership is immutable.';
  end if;
  if old.published_at is not null and new.public_slug is distinct from old.public_slug then
    raise exception 'Published Smart Link slugs are immutable.';
  end if;
  if old.status <> 'draft' and new.public_slug is distinct from old.public_slug then
    raise exception 'Only Draft Smart Link slugs may be edited.';
  end if;
  if old.published_at is not null and new.published_at is distinct from old.published_at then
    raise exception 'Smart Link publication timestamp is immutable.';
  end if;
  if old.published_at is null and new.published_at is not null then
    raise exception 'Smart Link publication timestamp is system-managed.';
  end if;

  if not (
    (old.status = 'draft' and new.status in ('draft', 'published', 'archived'))
    or (old.status = 'published' and new.status in ('published', 'disabled', 'archived'))
    or (old.status = 'disabled' and new.status in ('disabled', 'published', 'archived'))
    or (old.status = 'archived' and new.status in ('archived', 'disabled'))
  ) then
    raise exception 'Invalid Smart Link lifecycle transition from % to %.', old.status, new.status;
  end if;

  if new.status = 'published' and old.status <> 'published' then
    if coalesce(nullif(btrim(coalesce(new.title_override, new.source_song_title)), ''), '') = ''
      or coalesce(nullif(btrim(coalesce(new.artist_name_override, new.source_artist_name)), ''), '') = '' then
      raise exception 'Published Smart Links require a title and artist.';
    end if;
    select exists (
      select 1 from public.smart_link_destinations destination
      where destination.smart_link_id = old.id and destination.is_enabled
    ) into v_has_enabled_destination;
    if not v_has_enabled_destination then
      raise exception 'Published Smart Links require an enabled destination.';
    end if;
    if old.published_at is null then
      new.published_at := now();
    end if;
  end if;

  if new.status = 'disabled' and old.status <> 'disabled' then
    new.disabled_at := now();
  else
    new.disabled_at := old.disabled_at;
  end if;
  if new.status = 'archived' and old.status <> 'archived' then
    new.archived_at := now();
  else
    new.archived_at := old.archived_at;
  end if;

  return new;
end;
$$;

create or replace function public.sync_smart_link_song_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  update public.smart_links link
  set
    source_song_title = new.title,
    source_artwork_url = new.album_art_url
  where link.workspace_id = new.workspace_id
    and link.production_song_id = new.id;
  return new;
end;
$$;

create trigger smart_links_00_prepare_song_snapshot
before insert or update of production_song_id on public.smart_links
for each row execute function public.prepare_smart_link_insert();

create trigger smart_links_10_enforce_lifecycle
before insert or update on public.smart_links
for each row execute function public.enforce_smart_link_lifecycle();

create or replace function public.enforce_smart_link_destination_history()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.smart_link_id is distinct from old.smart_link_id then
    raise exception 'A Smart Link destination cannot be moved to another Smart Link.';
  end if;
  if new.platform_key is distinct from old.platform_key then
    raise exception 'A Smart Link destination platform cannot be changed.';
  end if;
  return new;
end;
$$;

create trigger smart_link_destinations_preserve_history
before update on public.smart_link_destinations
for each row execute function public.enforce_smart_link_destination_history();

create or replace function public.prevent_smart_link_destination_metric_deletion()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.smart_link_destination_daily_metrics metric
    where metric.destination_id = old.id
  ) then
    raise exception 'A Smart Link destination with historical metrics cannot be deleted; retire or disable it instead.';
  end if;
  return old;
end;
$$;

create trigger smart_link_destinations_prevent_metric_deletion
before delete on public.smart_link_destinations
for each row execute function public.prevent_smart_link_destination_metric_deletion();

create trigger smart_links_set_updated_at
before update on public.smart_links
for each row execute function public.set_updated_at();

create trigger smart_link_destinations_set_updated_at
before update on public.smart_link_destinations
for each row execute function public.set_updated_at();

create trigger workspace_meta_pixel_settings_set_updated_at
before update on public.workspace_meta_pixel_settings
for each row execute function public.set_updated_at();

create trigger production_songs_sync_smart_link_snapshot
after update of title, album_art_url on public.production_songs
for each row when (
  old.title is distinct from new.title
  or old.album_art_url is distinct from new.album_art_url
)
execute function public.sync_smart_link_song_snapshot();

alter table public.smart_links enable row level security;
alter table public.smart_link_destinations enable row level security;
alter table public.smart_link_daily_metrics enable row level security;
alter table public.smart_link_destination_daily_metrics enable row level security;
alter table public.workspace_meta_pixel_settings enable row level security;

create policy "Workspace members can read Smart Links"
on public.smart_links for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace members can read Smart Link destinations"
on public.smart_link_destinations for select to authenticated
using (exists (
  select 1 from public.smart_links link
  where link.id = smart_link_id and public.is_workspace_member(link.workspace_id)
));

create policy "Workspace members can read Smart Link metrics"
on public.smart_link_daily_metrics for select to authenticated
using (exists (
  select 1 from public.smart_links link
  where link.id = smart_link_id and public.is_workspace_member(link.workspace_id)
));

create policy "Workspace members can read Smart Link destination metrics"
on public.smart_link_destination_daily_metrics for select to authenticated
using (exists (
  select 1
  from public.smart_link_destinations destination
  join public.smart_links link on link.id = destination.smart_link_id
  where destination.id = destination_id
    and public.is_workspace_member(link.workspace_id)
));

create policy "Workspace members can read Meta Pixel settings"
on public.workspace_meta_pixel_settings for select to authenticated
using (public.is_workspace_member(workspace_id));

create or replace function public.smart_link_metric_clock(p_smart_link_id uuid)
returns table (metric_date date, metric_timezone text)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_timezone text;
begin
  select settings.timezone into v_timezone
  from public.smart_links link
  join public.app_workspace_settings settings on settings.workspace_id = link.workspace_id
  where link.id = p_smart_link_id;
  if not found or v_timezone is null or btrim(v_timezone) = '' then
    raise exception 'Smart Link workspace timezone is unavailable.';
  end if;

  metric_timezone := v_timezone;
  metric_date := timezone(v_timezone, now())::date;
  return next;
end;
$$;

create or replace function public.increment_smart_link_page_view(p_public_slug text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_link_id uuid;
  v_metric_date date;
  v_metric_timezone text;
begin
  select link.id into v_link_id
  from public.smart_links link
  where link.public_slug = p_public_slug and link.status = 'published'
  for update;
  if not found then
    raise exception 'Published Smart Link was not found.';
  end if;

  select clock.metric_date, clock.metric_timezone into v_metric_date, v_metric_timezone
  from public.smart_link_metric_clock(v_link_id) clock;

  insert into public.smart_link_daily_metrics (
    smart_link_id, metric_date, metric_timezone, page_view_count
  ) values (v_link_id, v_metric_date, v_metric_timezone, 1)
  on conflict (smart_link_id, metric_date, metric_timezone) do update
  set page_view_count = public.smart_link_daily_metrics.page_view_count + 1;
end;
$$;

create or replace function public.increment_smart_link_destination_click(
  p_public_slug text,
  p_destination_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_link_id uuid;
  v_metric_date date;
  v_metric_timezone text;
begin
  select link.id into v_link_id
  from public.smart_links link
  where link.public_slug = p_public_slug and link.status = 'published'
  for update;
  if not found then
    raise exception 'Published Smart Link was not found.';
  end if;

  if not exists (
    select 1 from public.smart_link_destinations destination
    where destination.id = p_destination_id
      and destination.smart_link_id = v_link_id
      and destination.is_enabled
  ) then
    raise exception 'Enabled Smart Link destination was not found.';
  end if;

  select clock.metric_date, clock.metric_timezone into v_metric_date, v_metric_timezone
  from public.smart_link_metric_clock(v_link_id) clock;

  insert into public.smart_link_destination_daily_metrics (
    destination_id, metric_date, metric_timezone, click_count
  ) values (p_destination_id, v_metric_date, v_metric_timezone, 1)
  on conflict (destination_id, metric_date, metric_timezone) do update
  set click_count = public.smart_link_destination_daily_metrics.click_count + 1;
end;
$$;

revoke all on function public.smart_link_slug_is_reserved(text) from public, anon, authenticated;
revoke all on function public.smart_link_social_links_are_valid(jsonb) from public, anon, authenticated;
revoke all on function public.prepare_smart_link_insert() from public, anon, authenticated;
revoke all on function public.enforce_smart_link_lifecycle() from public, anon, authenticated;
revoke all on function public.sync_smart_link_song_snapshot() from public, anon, authenticated;
revoke all on function public.enforce_smart_link_destination_history() from public, anon, authenticated;
revoke all on function public.prevent_smart_link_destination_metric_deletion() from public, anon, authenticated;
revoke all on function public.smart_link_metric_clock(uuid) from public, anon, authenticated;
revoke all on function public.increment_smart_link_page_view(text) from public, anon, authenticated;
revoke all on function public.increment_smart_link_destination_click(text, uuid) from public, anon, authenticated;
grant execute on function public.increment_smart_link_page_view(text) to service_role;
grant execute on function public.increment_smart_link_destination_click(text, uuid) to service_role;

revoke all on table
  public.smart_links,
  public.smart_link_destinations,
  public.smart_link_daily_metrics,
  public.smart_link_destination_daily_metrics,
  public.workspace_meta_pixel_settings
from public, anon;

revoke insert, update, delete, truncate, references, trigger on table
  public.smart_links,
  public.smart_link_destinations,
  public.smart_link_daily_metrics,
  public.smart_link_destination_daily_metrics,
  public.workspace_meta_pixel_settings
from authenticated;

grant select on table
  public.smart_links,
  public.smart_link_destinations,
  public.smart_link_daily_metrics,
  public.smart_link_destination_daily_metrics,
  public.workspace_meta_pixel_settings
to authenticated;

grant select, insert, update, delete on table
  public.smart_links,
  public.smart_link_destinations,
  public.smart_link_daily_metrics,
  public.smart_link_destination_daily_metrics,
  public.workspace_meta_pixel_settings
to service_role;

commit;
