-- Qualify the workspace-settings update inside the onboarding finalization RPC.
-- `workspace_id` is also a RETURNS TABLE output variable, so the unqualified
-- predicate is ambiguous in PL/pgSQL.
do $$
declare
  definition text;
begin
  select pg_get_functiondef(
    'public.finalize_pending_workspace(uuid, uuid, text, text, text, text)'::regprocedure
  ) into definition;

  definition := replace(
    definition,
    'where workspace_id = p_workspace_id;',
    'where app_workspace_settings.workspace_id = p_workspace_id;'
  );

  execute definition;
end;
$$;
