-- Preserve the V1 anchor guard while allowing configurable template rows to
-- be deleted. Returning NEW from a BEFORE DELETE trigger cancels the delete.
create or replace function public.protect_production_template_anchor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.step_kind in ('idea_anchor', 'release_anchor')
       and pg_trigger_depth() = 1 then
      raise exception 'Production template lifecycle anchors cannot be deleted.';
    end if;
    return old;
  end if;

  if old.step_kind in ('idea_anchor', 'release_anchor')
     and new.step_kind is distinct from old.step_kind then
    raise exception 'Production template lifecycle anchor kind cannot change.';
  end if;

  return new;
end;
$$;
