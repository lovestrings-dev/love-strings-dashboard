-- Future first-admin workspaces only. Existing Production-song snapshots stay
-- immutable; their history is intentionally not rewritten.
do $$
declare
  definition text;
  target text := '(v_template_id, ''license-v1'', ''License'', 700, ''production_step'', ''standard'', true, 3, v_license_cost),';
  replacement text := '(v_template_id, ''license-v1'', ''License'', 700, ''production_step'', ''standard'', false, 3, 0),';
begin
  select pg_get_functiondef('public.create_workspace_production_template_v1(uuid)'::regprocedure)
  into definition;

  if position(target in definition) = 0 then
    raise exception 'Unexpected workspace Production template definition; refusing fresh-workspace License repair.';
  end if;

  execute replace(definition, target, replacement);
end;
$$;

-- Pending-workspace finalization owns the cadence profile. Keep its approved
-- 14/28 day window after removing the obsolete License step by assigning its
-- former duration to the still-canonical Cover Art step.
do $$
declare
  definition text;
  target text := $target$
    when 'master-v1' then case when production_window_days = 14 then 2 else 4 end
    when 'license-v1' then case when production_window_days = 14 then 2 else 3 end
    when 'cover-art-v1' then case when production_window_days = 14 then 1 else 3 end
    when 'distributor-v1' then 14
    else lead_time_days
  end,
  is_enabled = case when template_step.stable_key = 'distributor-v1' then distributor_enabled else template_step.is_enabled end,
  standard_cost_amount = case when template_step.stable_key = 'distributor-v1' then -10 else template_step.standard_cost_amount end
$target$;
  replacement text := $replacement$
    when 'master-v1' then case when production_window_days = 14 then 2 else 4 end
    when 'license-v1' then 0
    when 'cover-art-v1' then case when production_window_days = 14 then 3 else 6 end
    when 'distributor-v1' then 14
    else lead_time_days
  end,
  is_enabled = case
    when template_step.stable_key = 'license-v1' then false
    when template_step.stable_key = 'distributor-v1' then distributor_enabled
    else template_step.is_enabled
  end,
  standard_cost_amount = case
    when template_step.stable_key = 'license-v1' then 0
    when template_step.stable_key = 'distributor-v1' then -10
    else template_step.standard_cost_amount
  end
$replacement$;
begin
  select pg_get_functiondef('public.finalize_pending_workspace(uuid, uuid, text, text, text, text)'::regprocedure)
  into definition;

  if position(target in definition) = 0 then
    raise exception 'Unexpected pending-workspace finalization definition; refusing fresh-workspace License repair.';
  end if;

  execute replace(definition, target, replacement);
end;
$$;
