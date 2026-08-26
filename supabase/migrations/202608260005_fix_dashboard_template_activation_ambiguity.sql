-- Qualify the active-template update because the RPC returns template_key.
create or replace function public.activate_platform_dashboard_preference_template(
  p_card_order jsonb,
  p_visible_cards jsonb,
  p_theme text
)
returns table (template_key text, version integer, effective_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version integer;
begin
  if jsonb_typeof(p_card_order) <> 'array' or jsonb_typeof(p_visible_cards) <> 'array' then
    raise exception 'Dashboard template cards must be arrays.';
  end if;
  if p_theme not in ('light', 'dark') then
    raise exception 'Dashboard template theme is invalid.';
  end if;

  perform pg_advisory_xact_lock(hashtext('new-member-dashboard-template'));
  update public.platform_dashboard_preference_templates as template
  set retired_at = now()
  where template.template_key = 'new-member-dashboard'
    and template.retired_at is null;

  select coalesce(max(template.version), 0) + 1 into v_version
  from public.platform_dashboard_preference_templates as template
  where template.template_key = 'new-member-dashboard';

  insert into public.platform_dashboard_preference_templates (
    template_key, version, visible_cards, card_order, theme
  ) values (
    'new-member-dashboard', v_version, p_visible_cards, p_card_order, p_theme
  );

  return query select 'new-member-dashboard'::text, v_version, now();
end;
$$;

revoke all on function public.activate_platform_dashboard_preference_template(jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.activate_platform_dashboard_preference_template(jsonb, jsonb, text) to service_role;
