-- Editing is part of Mix, so remove the obsolete standalone Edit step and
-- keep release-date recalculation aligned with the current workflow.

delete from public.production_steps
where lower(trim(label)) = 'edit';

create or replace function public.sync_production_steps_to_release_date()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.release_date is distinct from old.release_date then
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
      when 'release' then 0
      else 0
    end
    where production_song_id = new.id
      and lower(label) in (
        'drums',
        'guitars',
        'bass',
        'vocals',
        'mix',
        'master',
        'license',
        'cover art',
        'distributor',
        'release'
      );
  end if;

  return new;
end;
$$;
