-- Production is authoritative while existing shared release dates are reconciled.

update public.marketing_campaigns as campaign
set release_date = song.release_date
from public.production_songs as song
where campaign.production_song_id = song.id
  and campaign.release_date is distinct from song.release_date;
