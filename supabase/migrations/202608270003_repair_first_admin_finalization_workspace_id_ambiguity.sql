-- `workspace_id` is a RETURNS TABLE output variable of this PL/pgSQL function.
-- In the workspace-settings update it must be qualified as a table column.
-- The earlier dynamic repair was recorded as applied remotely, but live
-- finalization still exposes the unresolved body. Repair it fail-closed rather
-- than silently accepting an unexpected function definition.
do $$
declare
  definition text;
  unresolved text := 'where workspace_id = p_workspace_id;';
  resolved text := 'where app_workspace_settings.workspace_id = p_workspace_id;';
begin
  select pg_get_functiondef(
    'public.finalize_pending_workspace(uuid, uuid, text, text, text, text)'::regprocedure
  ) into definition;

  if position(resolved in definition) > 0 then
    return;
  end if;
  if position(unresolved in definition) = 0 then
    raise exception 'Unexpected finalize_pending_workspace definition; refusing ambiguous workspace_id repair.';
  end if;

  execute replace(definition, unresolved, resolved);
end;
$$;
