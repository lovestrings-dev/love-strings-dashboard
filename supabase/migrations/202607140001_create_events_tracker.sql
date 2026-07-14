-- Events tracker schema.
-- Stores event records, reusable location/address-book records, and
-- event-linked budget rows. No browser-facing RLS policies are added here;
-- app access goes through server routes using the Supabase service role.

create table public.event_locations (
  id uuid primary key default gen_random_uuid(),
  stable_key text not null unique,
  location_name text not null,
  location_url text not null default '',
  address text not null default '',
  address_url text not null default '',
  contact_name text not null default '',
  contact_phone text not null default '',
  contact_notes text not null default '',
  source text not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  stable_key text not null unique,
  event_date date not null,
  event_name text not null,
  event_url text not null default '',
  location_id uuid references public.event_locations(id) on delete set null,
  location_name text not null default '',
  location_url text not null default '',
  address text not null default '',
  address_url text not null default '',
  source text not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_budget_lines (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  description text not null default '',
  amount numeric(12, 2) not null default 0,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index event_locations_name_idx
  on public.event_locations (location_name);

create index events_date_idx
  on public.events (event_date desc);

create index events_location_idx
  on public.events (location_id);

create index event_budget_lines_event_position_idx
  on public.event_budget_lines (event_id, position);

create trigger event_locations_set_updated_at
before update on public.event_locations
for each row execute function public.set_updated_at();

create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create trigger event_budget_lines_set_updated_at
before update on public.event_budget_lines
for each row execute function public.set_updated_at();

alter table public.event_locations enable row level security;
alter table public.events enable row level security;
alter table public.event_budget_lines enable row level security;
