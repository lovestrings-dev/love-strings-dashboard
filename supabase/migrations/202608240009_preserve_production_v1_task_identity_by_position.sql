-- Keep a task's database identity when the browser has not yet adopted a
-- database task ID. Parent step plus position is the safe fallback.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.save_production_v1_song_atomically(uuid, jsonb)'::regprocedure
  ) into v_definition;
  v_definition := regexp_replace(
    v_definition,
    $pattern$where task\.id = case when coalesce\(v_task ->> 'id', ''\) ~\* '[^']+' then \(v_task ->> 'id'\)::uuid else null end
        and task\.production_step_id = v_step_id$pattern$,
    $replacement$where task.production_step_id = v_step_id
        and (
          task.id = case when coalesce(v_task ->> 'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (v_task ->> 'id')::uuid else null end
          or task.position = coalesce((v_task ->> 'position')::integer, 0)
        )$replacement$
  );
  execute v_definition;
end;
$$;
