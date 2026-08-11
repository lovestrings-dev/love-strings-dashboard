alter table public.app_workspace_settings
  add column if not exists production_step_cost_defaults jsonb not null
  default '{"license": -20, "distributor": -10}'::jsonb;
