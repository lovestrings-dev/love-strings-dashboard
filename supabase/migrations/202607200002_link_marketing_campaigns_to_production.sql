-- Give each Marketing campaign a durable link to its Production song.

alter table public.marketing_campaigns
  add column production_song_id uuid references public.production_songs(id) on delete set null;

update public.marketing_campaigns as campaign
set production_song_id = song.id
from public.production_songs as song
where campaign.slug like song.slug || '-%'
   or lower(campaign.title) = lower(song.title);

create index marketing_campaigns_production_song_idx
  on public.marketing_campaigns (production_song_id);
