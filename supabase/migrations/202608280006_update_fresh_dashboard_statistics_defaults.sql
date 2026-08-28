-- A new default snapshot for future workspace members only. Existing personal
-- Dashboard rows keep their seeded version and any later user edits intact.
do $$
declare
  active_template public.platform_dashboard_preference_templates%rowtype;
begin
  select * into strict active_template
  from public.platform_dashboard_preference_templates as template
  where template.template_key = 'new-member-dashboard'
    and template.retired_at is null;

  if active_template.version <> 5 then
    raise exception 'Unexpected active new-member-dashboard template version; refusing to replace fresh defaults.';
  end if;

  update public.platform_dashboard_preference_templates as template
  set retired_at = now()
  where template.template_key = 'new-member-dashboard'
    and template.version = active_template.version
    and template.retired_at is null;

  insert into public.platform_dashboard_preference_templates (
    template_key, version, visible_cards, card_order, theme
  ) values (
    'new-member-dashboard',
    6,
    '["events","focus","production","production.current-song","marketing","marketing.current-song","platforms","platforms.audience","platforms.youtube","platforms.instagram-creator","budget","roadmap","qr-codes"]'::jsonb,
    active_template.card_order,
    active_template.theme
  );
end;
$$;
