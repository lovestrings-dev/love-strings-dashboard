-- Correct seeded source buckets for existing historical Budget rows.
-- These rows predate the bucket selector, so stable keys are more reliable than
-- description-based inference.

update public.budget_entries
set budget_bucket = 'events'
where stable_key in (
  'blooming-planet-earned',
  'blooming-planet-spent',
  'hrc-gig',
  'pickwicks-april',
  'pickwicks-may-earned',
  'pickwicks-may-spent',
  'rhg-lebenszeit',
  'wedding'
);

update public.budget_entries
set budget_bucket = 'marketing'
where stable_key in (
  'canva-12m',
  'photoshoot'
);

update public.budget_entries
set budget_bucket = 'production'
where stable_key in (
  'cla-plugins',
  'flowers-license',
  'flowers-release',
  'intro-release',
  'landr',
  'rock-and-roll-license',
  'rock-and-roll-release',
  'suno',
  'wl-licence',
  'wl-release'
);
