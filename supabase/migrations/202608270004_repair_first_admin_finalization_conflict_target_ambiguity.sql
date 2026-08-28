-- `workspace_id` is a RETURNS TABLE output variable of
-- finalize_pending_workspace. PL/pgSQL can therefore treat the unqualified
-- ON CONFLICT index element as ambiguous. Reference the already-existing
-- workspace-scoped uniqueness constraint instead; this preserves the exact
-- same conflict behavior without changing finalization business logic.
do $$
declare
  definition text;
  ambiguous text := 'on conflict (workspace_id, stable_key) do nothing;';
  repaired text := 'on conflict on constraint focus_other_tasks_workspace_stable_key_key do nothing;';
begin
  select pg_get_functiondef(
    'public.finalize_pending_workspace(uuid, uuid, text, text, text, text)'::regprocedure
  ) into definition;

  if position(repaired in definition) > 0 then
    return;
  end if;
  if position('where app_workspace_settings.workspace_id = p_workspace_id;' in definition) = 0
    or position(ambiguous in definition) = 0 then
    raise exception 'Unexpected finalize_pending_workspace definition; refusing conflict-target ambiguity repair.';
  end if;

  execute replace(definition, ambiguous, repaired);
end;
$$;
