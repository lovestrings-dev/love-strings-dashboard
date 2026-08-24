-- V1 release-date recalculation is snapshot-driven in the application domain.
-- The older trigger remains only for legacy-v0 songs and must not apply its
-- label-based, fixed-offset schedule to a template-v1 song during persistence.
create or replace function public.sync_production_steps_to_release_date()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.release_date is distinct from old.release_date then
    if new.scheduling_model = 'template-v1' then
      return new;
    end if;

    new.production_deadline := new.release_date - 14;

    update public.production_steps
    set step_deadline = new.release_date + case lower(label)
      when 'drums' then -33
      when 'guitars' then -30
      when 'bass' then -29
      when 'vocals' then -26
      when 'mix' then -18
      when 'master' then -17
      when 'license' then -16
      when 'cover art' then -15
      when 'distributor' then -14
      else 0
    end
    where production_song_id = new.id
      and lower(label) in (
        'drums', 'guitars', 'bass', 'vocals', 'mix', 'master', 'license',
        'cover art', 'distributor'
      );
  end if;

  return new;
end;
$$;
