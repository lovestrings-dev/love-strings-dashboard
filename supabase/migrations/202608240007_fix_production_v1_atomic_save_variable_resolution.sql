-- The first deployed function body returned a column named `id`, which made
-- its unqualified `where id = ...` expressions ambiguous in PL/pgSQL. Rebuild
-- that function from PostgreSQL's canonical definition with table-qualified
-- references. This remains safe when 006 already contains the corrected body.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.save_production_v1_song_atomically(uuid, jsonb)'::regprocedure
  ) into v_definition;

  v_definition := replace(v_definition, 'where id = v_song_id;', 'where production_songs.id = v_song_id;');
  v_definition := replace(v_definition, 'where id = v_step_id;', 'where production_steps.id = v_step_id;');
  v_definition := replace(v_definition, ') returning id into v_step_id;', ') returning production_steps.id into v_step_id;');
  v_definition := replace(v_definition, 'where id = v_task_id;', 'where production_step_tasks.id = v_task_id;');
  v_definition := replace(v_definition, ') returning id into v_task_id;', ') returning production_step_tasks.id into v_task_id;');
  v_definition := replace(v_definition, 'where id = v_line_id;', 'where production_budget_lines.id = v_line_id;');
  v_definition := replace(v_definition, ') returning id into v_line_id;', ') returning production_budget_lines.id into v_line_id;');

  execute v_definition;
end;
$$;
