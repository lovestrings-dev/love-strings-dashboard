-- Marketing campaign planner schema and seed data.
-- Stores release campaigns, daily campaign plan rows, and their tasks.

create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  release_id uuid references public.releases(id) on delete set null,
  title text not null,
  release_date date not null,
  album_art_url text not null default '',
  status text not null default 'planned',
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketing_campaign_days (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  day_number integer not null check (day_number > 0),
  campaign_date date not null,
  release_offset integer not null,
  clip_name text not null default '',
  is_default_day boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, day_number),
  unique (campaign_id, campaign_date)
);

create table public.marketing_campaign_tasks (
  id uuid primary key default gen_random_uuid(),
  campaign_day_id uuid not null references public.marketing_campaign_days(id) on delete cascade,
  task_kind text not null,
  title text not null,
  status text not null default 'not-started',
  position integer not null default 0,
  is_standard_task boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (task_kind in ('production', 'instagram_upload', 'youtube_upload', 'extra')),
  check (status in ('not-started', 'in-progress', 'done'))
);

create unique index marketing_campaign_tasks_standard_unique_idx
  on public.marketing_campaign_tasks (campaign_day_id, task_kind)
  where is_standard_task = true;

create index marketing_campaigns_release_date_idx
  on public.marketing_campaigns (release_date desc);

create index marketing_campaign_days_campaign_date_idx
  on public.marketing_campaign_days (campaign_id, campaign_date);

create index marketing_campaign_tasks_day_position_idx
  on public.marketing_campaign_tasks (campaign_day_id, position);

create trigger marketing_campaigns_set_updated_at
before update on public.marketing_campaigns
for each row execute function public.set_updated_at();

create trigger marketing_campaign_days_set_updated_at
before update on public.marketing_campaign_days
for each row execute function public.set_updated_at();

create trigger marketing_campaign_tasks_set_updated_at
before update on public.marketing_campaign_tasks
for each row execute function public.set_updated_at();

alter table public.marketing_campaigns enable row level security;
alter table public.marketing_campaign_days enable row level security;
alter table public.marketing_campaign_tasks enable row level security;

create policy "Allow public read of marketing campaigns"
on public.marketing_campaigns
for select
to anon
using (true);

create policy "Allow public read of marketing campaign days"
on public.marketing_campaign_days
for select
to anon
using (true);

create policy "Allow public read of marketing campaign tasks"
on public.marketing_campaign_tasks
for select
to anon
using (true);

-- Temporary prototype write access. Replace with authenticated policies before public launch.
create policy "Allow prototype writes to marketing campaigns"
on public.marketing_campaigns
for all
to anon
using (true)
with check (true);

create policy "Allow prototype writes to marketing campaign days"
on public.marketing_campaign_days
for all
to anon
using (true)
with check (true);

create policy "Allow prototype writes to marketing campaign tasks"
on public.marketing_campaign_tasks
for all
to anon
using (true)
with check (true);

insert into public.releases (title, release_type, release_date, status)
values
  ('Rock and Roll', 'single', date '2026-07-10', 'planned'),
  ('Jukebox', 'single', date '2026-05-16', 'released'),
  ('Wonderful Life', 'single', date '2026-05-15', 'released'),
  ('Intro', 'single', date '2026-04-21', 'released')
on conflict do nothing;

update public.releases
set release_date = date '2026-06-19',
    status = 'released'
where title = 'Flowers';

with campaign_seed as (
  select *
  from (
    values
      (
        'rock-and-roll',
        'Rock and Roll',
        date '2026-07-10',
        'https://res.cloudinary.com/zg6yhttv/image/upload/v1782829034/Rock_and_Roll_-_Love_Strings_-_Cover_Art_web_avazio.jpg',
        'planned'
      ),
      ('flowers', 'Flowers', date '2026-06-19', '', 'released'),
      ('jukebox', 'Jukebox', date '2026-05-16', '', 'released'),
      ('wonderful-life', 'Wonderful Life', date '2026-05-15', '', 'released'),
      ('intro', 'Intro', date '2026-04-21', '', 'released')
  ) as v(slug, title, release_date, album_art_url, status)
)
insert into public.marketing_campaigns (
  slug,
  release_id,
  title,
  release_date,
  album_art_url,
  status,
  source
)
select
  campaign_seed.slug,
  releases.id,
  campaign_seed.title,
  campaign_seed.release_date,
  campaign_seed.album_art_url,
  campaign_seed.status,
  'manual-seed'
from campaign_seed
left join public.releases on releases.title = campaign_seed.title
on conflict (slug) do update
set
  release_id = excluded.release_id,
  title = excluded.title,
  release_date = excluded.release_date,
  album_art_url = excluded.album_art_url,
  status = excluded.status,
  source = excluded.source;

with generated_days as (
  select
    marketing_campaigns.id as campaign_id,
    marketing_campaigns.slug as campaign_slug,
    campaign_days.day_number,
    marketing_campaigns.release_date + (campaign_days.day_number - 5) as campaign_date,
    campaign_days.day_number - 5 as release_offset
  from public.marketing_campaigns
  cross join pg_catalog.generate_series(1, 14) as campaign_days(day_number)
  where marketing_campaigns.slug in (
    'rock-and-roll',
    'flowers',
    'jukebox',
    'wonderful-life',
    'intro'
  )
),
day_seed as (
  select *
  from (
    values
      ('flowers', date '2026-06-15', 'Рилс про фотосессию! Вечером! / Music lovers', true, true),
      ('flowers', date '2026-06-16', 'Скоро релиз нового сингла! Есть идеи что записали для вас? / Feed a man', true, true),
      ('flowers', date '2026-06-17', 'Возможно так? / Flowers teaser 1', true, true),
      ('flowers', date '2026-06-18', 'Уже завтра - FLOWERS / Flowers teaser 2', true, true),
      ('flowers', date '2026-06-19', 'Release FLOWERS (обложка сингла) / Flowers release', true, true),
      ('flowers', date '2026-06-20', 'Рилс с вопросом, где найти цветы', true, false),
      ('flowers', date '2026-06-21', 'Сторисы', true, false),
      ('flowers', date '2026-06-22', 'Рилс: Димын ДР', true, false),
      ('flowers', date '2026-06-23', 'Рилс: дети / FL English lesson', true, true),
      ('flowers', date '2026-06-24', 'Рилс с ютуб мьюзиком', true, false),
      ('flowers', date '2026-06-25', 'Рилс: развешиваю вещи и пою Flowers', true, false),
      ('flowers', date '2026-06-26', 'Рилс: Юлин ДР', true, false),
      ('flowers', date '2026-06-27', 'Фото МАРГО', true, false),
      ('flowers', date '2026-06-28', 'Рилс из дома', true, false),
      ('wonderful-life', date '2026-05-15', 'Wonderful Life release', false, false),
      ('wonderful-life', date '2026-05-19', 'WL vertical, JB short 1 (evening) / WL mood', true, true),
      ('wonderful-life', date '2026-05-21', 'WL mood 1', false, true),
      ('wonderful-life', date '2026-05-24', 'WL mood 2', false, true),
      ('wonderful-life', date '2026-05-26', 'WL mood 3', false, true),
      ('wonderful-life', date '2026-05-28', 'WL mood 4', false, true),
      ('jukebox', date '2026-05-16', 'JB full reel / JB video', true, true),
      ('jukebox', date '2026-05-17', 'post+stories / JB short 1', true, true),
      ('jukebox', date '2026-05-18', 'Post carousel / JB short 2', true, true),
      ('jukebox', date '2026-05-20', 'JB short 3', false, true),
      ('jukebox', date '2026-05-22', 'JB short 4', false, true),
      ('jukebox', date '2026-05-23', 'JB short 5', false, true),
      ('jukebox', date '2026-05-25', 'JB short 6', false, true),
      ('jukebox', date '2026-05-27', 'JB short 7', false, true),
      ('jukebox', date '2026-05-29', 'JB short 8', false, true),
      ('intro', date '2026-04-21', 'Intro release', false, false)
  ) as v(campaign_slug, campaign_date, clip_name, instagram_done, youtube_done)
),
prepared_days as (
  select
    generated_days.campaign_id,
    generated_days.day_number,
    generated_days.campaign_date,
    generated_days.release_offset,
    coalesce(
      day_seed.clip_name,
      case
        when generated_days.release_offset = 0 then 'Release day: vertical performance clip'
        when generated_days.release_offset < 0 then 'Countdown ' || abs(generated_days.release_offset) || ': vertical performance clip'
        else 'Post-release ' || generated_days.release_offset || ': vertical performance clip'
      end
    ) as clip_name
  from generated_days
  left join day_seed
    on day_seed.campaign_slug = generated_days.campaign_slug
    and day_seed.campaign_date = generated_days.campaign_date
)
insert into public.marketing_campaign_days (
  campaign_id,
  day_number,
  campaign_date,
  release_offset,
  clip_name,
  is_default_day
)
select
  campaign_id,
  day_number,
  campaign_date,
  release_offset,
  clip_name,
  true
from prepared_days
on conflict (campaign_id, day_number) do update
set
  campaign_date = excluded.campaign_date,
  release_offset = excluded.release_offset,
  clip_name = excluded.clip_name,
  is_default_day = excluded.is_default_day;

with task_seed as (
  select
    marketing_campaign_days.id as campaign_day_id,
    marketing_campaigns.slug as campaign_slug,
    marketing_campaign_days.campaign_date,
    marketing_campaign_days.day_number,
    standard_tasks.task_kind,
    standard_tasks.title,
    standard_tasks.position
  from public.marketing_campaign_days
  join public.marketing_campaigns
    on marketing_campaigns.id = marketing_campaign_days.campaign_id
  cross join (
    values
      ('production', 'Make video / post', 1),
      ('instagram_upload', 'IG Upload', 2),
      ('youtube_upload', 'YT upload', 3)
  ) as standard_tasks(task_kind, title, position)
  where marketing_campaigns.slug in (
    'rock-and-roll',
    'flowers',
    'jukebox',
    'wonderful-life',
    'intro'
  )
),
day_seed as (
  select *
  from (
    values
      ('flowers', date '2026-06-15', true, true),
      ('flowers', date '2026-06-16', true, true),
      ('flowers', date '2026-06-17', true, true),
      ('flowers', date '2026-06-18', true, true),
      ('flowers', date '2026-06-19', true, true),
      ('flowers', date '2026-06-20', true, false),
      ('flowers', date '2026-06-21', true, false),
      ('flowers', date '2026-06-22', true, false),
      ('flowers', date '2026-06-23', true, true),
      ('flowers', date '2026-06-24', true, false),
      ('flowers', date '2026-06-25', true, false),
      ('flowers', date '2026-06-26', true, false),
      ('flowers', date '2026-06-27', true, false),
      ('flowers', date '2026-06-28', true, false),
      ('wonderful-life', date '2026-05-19', true, true),
      ('wonderful-life', date '2026-05-21', false, true),
      ('wonderful-life', date '2026-05-24', false, true),
      ('wonderful-life', date '2026-05-26', false, true),
      ('wonderful-life', date '2026-05-28', false, true),
      ('jukebox', date '2026-05-16', true, true),
      ('jukebox', date '2026-05-17', true, true),
      ('jukebox', date '2026-05-18', true, true),
      ('jukebox', date '2026-05-20', false, true),
      ('jukebox', date '2026-05-22', false, true),
      ('jukebox', date '2026-05-23', false, true),
      ('jukebox', date '2026-05-25', false, true),
      ('jukebox', date '2026-05-27', false, true),
      ('jukebox', date '2026-05-29', false, true)
  ) as v(campaign_slug, campaign_date, instagram_done, youtube_done)
),
prepared_tasks as (
  select
    task_seed.campaign_day_id,
    task_seed.task_kind,
    task_seed.title,
    case
      when task_seed.task_kind = 'production'
        and (coalesce(day_seed.instagram_done, false) or coalesce(day_seed.youtube_done, false))
        then 'done'
      when task_seed.task_kind = 'instagram_upload' and coalesce(day_seed.instagram_done, false)
        then 'done'
      when task_seed.task_kind = 'youtube_upload' and coalesce(day_seed.youtube_done, false)
        then 'done'
      else 'not-started'
    end as status,
    task_seed.position
  from task_seed
  left join day_seed
    on day_seed.campaign_slug = task_seed.campaign_slug
    and day_seed.campaign_date = task_seed.campaign_date
)
insert into public.marketing_campaign_tasks (
  campaign_day_id,
  task_kind,
  title,
  status,
  position,
  is_standard_task
)
select
  campaign_day_id,
  task_kind,
  title,
  status,
  position,
  true
from prepared_tasks
on conflict (campaign_day_id, task_kind)
where is_standard_task = true
do update
set
  title = excluded.title,
  status = excluded.status,
  position = excluded.position;

with extra_task_seed as (
  select *
  from (
    values
      (3, 'Prepare alternate hook', 'in-progress', 4),
      (14, 'Reply to comments and pin best one', 'not-started', 4)
  ) as v(day_number, title, status, position)
),
campaign_days as (
  select marketing_campaign_days.id as campaign_day_id, marketing_campaign_days.day_number
  from public.marketing_campaign_days
  join public.marketing_campaigns
    on marketing_campaigns.id = marketing_campaign_days.campaign_id
  where marketing_campaigns.slug = 'rock-and-roll'
)
insert into public.marketing_campaign_tasks (
  campaign_day_id,
  task_kind,
  title,
  status,
  position,
  is_standard_task
)
select
  campaign_days.campaign_day_id,
  'extra',
  extra_task_seed.title,
  extra_task_seed.status,
  extra_task_seed.position,
  false
from campaign_days
join extra_task_seed on extra_task_seed.day_number = campaign_days.day_number;
