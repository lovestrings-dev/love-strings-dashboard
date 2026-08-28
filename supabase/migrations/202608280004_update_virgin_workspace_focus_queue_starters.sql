-- Future first-admin finalization only. Existing workspaces are untouched.
do $$
declare
  definition text;
  target text := '(p_workspace_id, ''starter-user-artist-names-and-logos'', ''Set up your User & Artist Names & Logos'', '''', current_date, ''not-started'', ''onboarding''),
    (p_workspace_id, ''starter-create-production-song'', ''Create your new song in Production'', '''', current_date, ''not-started'', ''onboarding''),
    (p_workspace_id, ''starter-create-custom-task'', ''Create your own new task / modify this one'', '''', current_date, ''not-started'', ''onboarding'')';
  replacement text := '(p_workspace_id, ''starter-upload-user-artist-logos'', ''Upload your User and/or Artist Logos'', '''', current_date, ''not-started'', ''onboarding''),
    (p_workspace_id, ''starter-create-custom-task'', ''Create your own new task or modify this one'', '''', current_date, ''not-started'', ''onboarding''),
    (p_workspace_id, ''starter-upload-streaming-csv'', ''Upload your Spotify/Apple CSV to get more statistics'', '''', current_date, ''not-started'', ''onboarding'')';
begin
  select pg_get_functiondef('public.finalize_pending_workspace(uuid, uuid, text, text, text, text)'::regprocedure) into definition;
  if position(target in definition) = 0 then
    raise exception 'Refusing starter-task update: expected current seed block was not found.';
  end if;
  execute replace(definition, target, replacement);
end;
$$;
