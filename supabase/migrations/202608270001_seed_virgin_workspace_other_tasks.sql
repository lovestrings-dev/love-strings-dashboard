-- Seed only the three first-use Focus tasks while a newly provisioned
-- workspace is finalized. Existing active workspaces never enter this RPC.
do $$
declare
  definition text;
  target text := '  -- This is deliberately the final state-changing write: any failed seeding
  -- aborts the transaction and leaves the workspace pending setup.
  update public.app_workspaces';
  replacement text := '  -- Seed starter tasks only as part of first-admin finalization. The
  -- workspace remains pending until this transaction completes, and the scoped
  -- conflict key makes a retry idempotent.
  insert into public.focus_other_tasks (
    workspace_id, stable_key, title, notes, due_date, status, source
  ) values
    (p_workspace_id, ''starter-user-artist-names-and-logos'', ''Set up your User & Artist Names & Logos'', '''', current_date, ''not-started'', ''onboarding''),
    (p_workspace_id, ''starter-create-production-song'', ''Create your new song in Production'', '''', current_date, ''not-started'', ''onboarding''),
    (p_workspace_id, ''starter-create-custom-task'', ''Create your own new task / modify this one'', '''', current_date, ''not-started'', ''onboarding'')
  on conflict (workspace_id, stable_key) do nothing;

  -- This is deliberately the final state-changing write: any failed seeding
  -- aborts the transaction and leaves the workspace pending setup.
  update public.app_workspaces';
begin
  select pg_get_functiondef(
    'public.finalize_pending_workspace(uuid, uuid, text, text, text, text)'::regprocedure
  ) into definition;

  if position(target in definition) = 0 then
    raise exception 'Could not locate the pending-workspace finalization write.';
  end if;

  execute replace(definition, target, replacement);
end;
$$;
