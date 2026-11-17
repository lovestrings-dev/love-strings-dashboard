-- Additive, private workspace composition. Existing selection writes preserve these fields.
alter table public.studio_workspace_selection_drafts
  add column overlay_composition jsonb,
  add column overlay_revision integer not null default 0 check (overlay_revision >= 0),
  add constraint studio_overlay_composition_object check (overlay_composition is null or (jsonb_typeof(overlay_composition) = 'object' and overlay_composition->>'schemaVersion' = '2'));
-- Existing RLS allows workspace members to read. No new browser write grants.
