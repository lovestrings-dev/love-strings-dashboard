-- Restore the exact pre-smoke-test live records for the controlled
-- BIOGLYCERIN Sleepless Night V1 release-date validation. The UI save route
-- currently replaces step rows, so this repair restores their original IDs,
-- custom deadline values, and Distributor budget row after the reversible test.
do $$
declare
  v_song_id constant uuid := '31d25a58-a691-4658-bfda-0b4211afab2c';
  v_workspace_id constant uuid := 'ef4a53ed-d88c-404a-b1ed-7086a2242e78';
begin
  if not exists (
    select 1 from public.production_songs
    where id = v_song_id
      and workspace_id = v_workspace_id
      and scheduling_model = 'template-v1'
      and release_date = '2026-09-17'
      and production_deadline = '2026-09-03'
  ) or (select count(*) from public.production_steps where production_song_id = v_song_id) <> 9 then
    raise exception 'Sleepless Night smoke-test restore preflight failed.';
  end if;

  update public.production_steps
  set stable_key = 'smoke-test-replaced-' || id::text
  where production_song_id = v_song_id;

  insert into public.production_steps (
    id, production_song_id, stable_key, label, step_deadline, status, notes,
    position, is_default_step, template_step_id, template_step_stable_key,
    template_step_kind, template_step_lead_time_days,
    template_step_standard_cost_amount
  ) values
    ('ff8570a7-a07f-4508-9d0f-d230382dbb04', v_song_id, 'demo-1', 'Demo', '2025-08-18', 'in-progress', 'make new demo with drums for overdubbing', 0, true, 'f2f78f91-9d6a-41bd-8325-766a500904b2', 'anchor-idea-v1', 'idea_anchor', 0, 0),
    ('1af16128-937b-4bf6-a068-484f3e3aa7fc', v_song_id, 'drums-2', 'Drums', '2026-08-15', 'done', '', 100, true, 'f923ea6d-7880-41ef-8e2c-dd0857619f68', 'drums-v1', 'production_step', 2, 0),
    ('868d588d-ce42-4c5e-9d0a-e6efad4792d2', v_song_id, 'guitars-3', 'Guitars', '2026-08-18', 'not-started', 're-write', 200, true, '9a557eb7-26c1-4a52-95f9-c5df96c8517a', 'guitars-v1', 'production_step', 2, 0),
    ('f7ae1d92-a1bc-40a9-8f1d-503cade6a32b', v_song_id, 'bass-4', 'Bass', '2026-08-19', 'not-started', 'record', 300, true, 'd8a61a04-8bea-421a-a02b-81555648424f', 'bass-v1', 'production_step', 2, 0),
    ('5f685103-6012-4520-9b76-92271a080466', v_song_id, 'vocals-5', 'Vocals', '2026-08-22', 'not-started', 'at home', 400, true, '2ca80785-21e4-4e78-aabb-f1f83a5f82eb', 'vocals-v1', 'production_step', 3, 0),
    ('e894e6ee-33f1-42de-9e1d-0e6c4981ae7a', v_song_id, 'mix-6', 'Mix', '2026-08-30', 'not-started', 'Kourosh ?', 500, true, 'beefbb39-2ba2-4574-8748-593f88bd48eb', 'mix-v1', 'production_step', 7, 0),
    ('f96d000f-7ce6-41b6-8d8c-831a8adbfad0', v_song_id, 'master-7', 'Master', '2026-08-31', 'not-started', 'LANDR ?', 600, true, '51afa068-0cd7-4363-bc62-ef9dce1b42e0', 'master-v1', 'production_step', 3, 0),
    ('4bfcb882-7857-41a7-96a9-6a28ca059bd0', v_song_id, 'cover-art-9', 'Cover Art', '2026-09-02', 'not-started', 'AI vs Human', 700, true, '6abc801b-46e5-41c6-af55-470c0d874240', 'cover-art-v1', 'production_step', 3, 0),
    ('b5a5cfb3-6c93-411e-9282-7ba6242ebf5f', v_song_id, 'distributor-10', 'Distributor', '2026-09-03', 'not-started', '', 800, true, 'a3b2731f-a9bd-4751-ba2c-c67b22d1df47', 'distributor-v1', 'production_step', 14, -10);

  insert into public.production_budget_lines (
    id, production_step_id, description, amount, budget_bucket, position
  ) values (
    'da17a3e0-47fc-4b49-bda5-604bfbdfa870',
    'b5a5cfb3-6c93-411e-9282-7ba6242ebf5f',
    'Distributor', -10, 'production', 1
  );

  delete from public.production_steps
  where production_song_id = v_song_id
    and stable_key like 'smoke-test-replaced-%';
end;
$$;
