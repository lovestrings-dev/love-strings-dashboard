-- Roadmap phase IDs are text keys, not UUIDs. Keep the V1 save function
-- compatible with the existing Production/Roadmap relationship.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.save_production_v1_song_atomically(uuid, jsonb)'::regprocedure
  ) into v_definition;
  v_definition := replace(
    v_definition,
    'nullif(p_song ->> ''roadmapPhaseId'', '''')::uuid',
    'nullif(p_song ->> ''roadmapPhaseId'', '''')'
  );
  execute v_definition;
end;
$$;
