-- Shared Roadmap foundation for production songs.

create table public.roadmap_phases (
  id text primary key,
  phase_number integer not null unique,
  title text not null,
  start_month date not null,
  end_month date not null,
  description text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_trunc('month', start_month) = start_month),
  check (date_trunc('month', end_month) = end_month),
  check (end_month >= start_month)
);

insert into public.roadmap_phases (
  id, phase_number, title, start_month, end_month, description, position
) values
  ('phase-1', 1, 'English Covers / Brand Formation', '2026-04-01', '2027-07-01', 'Launch Love Strings, build the first English cover catalog, and make the release process repeatable.', 1),
  ('phase-2', 2, 'Ukrainian and Russian Covers / Audience expanse', '2027-08-01', '2027-12-01', 'Expand the cover catalog for Ukrainian- and Russian-speaking audiences.', 2),
  ('phase-3', 3, 'Original Songs / Monetisation via royalties', '2028-01-01', '2028-12-01', 'Start original Love Strings material and build long-term owned music assets.', 3)
on conflict (id) do nothing;

alter table public.production_songs
  add column release_date date,
  add column roadmap_phase_id text references public.roadmap_phases(id) on delete set null;

update public.production_songs as song
set release_date = coalesce(
  (
    select campaign.release_date
    from public.marketing_campaigns as campaign
    where campaign.slug = song.slug
       or lower(campaign.title) = lower(song.title)
    order by campaign.release_date desc
    limit 1
  ),
  song.production_deadline + 14
);

alter table public.production_songs
  alter column release_date set not null;

with ordered_songs as (
  select id, row_number() over (order by release_date, created_at, id) as song_number
  from public.production_songs
)
update public.production_songs as song
set roadmap_phase_id = case
  when ordered_songs.song_number <= 20 then 'phase-1'
  when ordered_songs.song_number <= 30 then 'phase-2'
  else 'phase-3'
end
from ordered_songs
where ordered_songs.id = song.id;

create index production_songs_release_date_idx
  on public.production_songs (release_date);

create index production_songs_roadmap_phase_idx
  on public.production_songs (roadmap_phase_id, release_date);

create trigger roadmap_phases_set_updated_at
before update on public.roadmap_phases
for each row execute function public.set_updated_at();

alter table public.roadmap_phases enable row level security;

create policy "Allow public read of roadmap phases"
on public.roadmap_phases
for select
to anon
using (true);
