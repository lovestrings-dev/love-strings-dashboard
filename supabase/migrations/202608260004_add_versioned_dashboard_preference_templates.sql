-- Platform-owned, versioned defaults for newly created personal dashboard preferences.
-- Existing preference rows deliberately remain unchanged and nullable metadata
-- distinguishes legacy dynamic-default rows from persisted snapshots.
create table public.platform_dashboard_preference_templates (
  template_key text not null,
  version integer not null check (version > 0),
  visible_cards jsonb not null check (jsonb_typeof(visible_cards) = 'array'),
  card_order jsonb not null check (jsonb_typeof(card_order) = 'array'),
  theme text not null check (theme in ('light', 'dark')),
  effective_at timestamptz not null default now(),
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (template_key, version),
  check (retired_at is null or retired_at >= effective_at)
);

create unique index platform_dashboard_preference_templates_one_active_key
  on public.platform_dashboard_preference_templates (template_key)
  where retired_at is null;

alter table public.dashboard_preferences
  add column if not exists seeded_template_key text,
  add column if not exists seeded_template_version integer,
  add column if not exists seeded_at timestamptz;

alter table public.dashboard_preferences
  drop constraint if exists dashboard_preferences_seeded_template_reference;

alter table public.dashboard_preferences
  add constraint dashboard_preferences_seeded_template_reference
  foreign key (seeded_template_key, seeded_template_version)
  references public.platform_dashboard_preference_templates (template_key, version);

insert into public.platform_dashboard_preference_templates (
  template_key, version, visible_cards, card_order, theme
) values (
  'new-member-dashboard',
  1,
  '["events","focus","production","production.current-song","marketing","marketing.current-song","platforms","platforms.audience","platforms.instagram-creator","platforms.youtube","platforms.youtube-topic","platforms.spotify","budget","roadmap","qr-codes"]'::jsonb,
  '["events","focus","production","production.current-song","production.benchmark","production.next-song","marketing","marketing.current-song","marketing.benchmark-song","marketing.next-song","marketing.benchmark-general","marketing.current-general","marketing.next-general","platforms","platforms.audience","platforms.instagram-creator","platforms.youtube","platforms.youtube-topic","platforms.spotify","platforms.apple-music","platforms.instagram","platforms.facebook","platforms.threads","platforms.website","platforms.deezer","platforms.amazon","platforms.youtube-music","budget","roadmap","qr-codes"]'::jsonb,
  'light'
)
on conflict (template_key, version) do nothing;

create or replace function public.seed_dashboard_preferences_from_active_default(
  p_workspace_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template public.platform_dashboard_preference_templates%rowtype;
begin
  select * into v_template
  from public.platform_dashboard_preference_templates as template
  where template.template_key = 'new-member-dashboard'
    and template.retired_at is null
  order by template.version desc
  limit 1;

  if found then
    insert into public.dashboard_preferences (
      workspace_id, user_id, visible_cards, card_order, theme,
      seeded_template_key, seeded_template_version, seeded_at
    ) values (
      p_workspace_id, p_user_id, v_template.visible_cards, v_template.card_order, v_template.theme,
      v_template.template_key, v_template.version, now()
    )
    on conflict on constraint dashboard_preferences_pkey do nothing;
  else
    -- Safe exceptional fallback: preserve the established code-default behavior.
    insert into public.dashboard_preferences (workspace_id, user_id)
    values (p_workspace_id, p_user_id)
    on conflict on constraint dashboard_preferences_pkey do nothing;
  end if;
end;
$$;

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
  update public.platform_dashboard_preference_templates
  set retired_at = now()
  where template_key = 'new-member-dashboard'
    and retired_at is null;

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

create or replace function public.enrol_love_strings_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
begin
  requested_role := lower(coalesce(new.raw_user_meta_data ->> 'workspace_role', 'viewer'));
  if requested_role not in ('admin', 'member', 'viewer') then requested_role := 'viewer'; end if;

  insert into public.app_profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), ''))
  on conflict (id) do nothing;
  insert into public.app_workspace_members (workspace_id, user_id, role)
  values ('00000000-0000-0000-0000-000000000001', new.id, requested_role)
  on conflict (workspace_id, user_id) do nothing;
  perform public.seed_dashboard_preferences_from_active_default('00000000-0000-0000-0000-000000000001', new.id);
  return new;
end;
$$;

create or replace function public.accept_workspace_invitation(
  p_token_hash text,
  p_user_id uuid,
  p_email text
)
returns table (workspace_id uuid, workspace_role text, outcome text)
language plpgsql security definer set search_path = public as $$
declare invitation public.app_workspace_invitations%rowtype;
begin
  select * into invitation from public.app_workspace_invitations where token_hash = p_token_hash for update;
  if not found or invitation.email <> lower(p_email) then return query select null::uuid, null::text, 'invalid'; return; end if;
  if invitation.revoked_at is not null then return query select null::uuid, null::text, 'revoked'; return; end if;
  if invitation.expires_at <= now() then return query select null::uuid, null::text, 'expired'; return; end if;
  if invitation.accepted_by is not null and invitation.accepted_by <> p_user_id then return query select null::uuid, null::text, 'already_accepted'; return; end if;

  insert into public.app_workspace_members (workspace_id, user_id, role)
  values (invitation.workspace_id, p_user_id, invitation.role)
  on conflict on constraint app_workspace_members_pkey do nothing;
  perform public.seed_dashboard_preferences_from_active_default(invitation.workspace_id, p_user_id);

  if invitation.accepted_at is null then
    update public.app_workspace_invitations set accepted_at = now(), accepted_by = p_user_id where id = invitation.id;
  end if;
  return query select invitation.workspace_id, invitation.role, 'accepted';
end;
$$;

create or replace function public.provision_workspace(
  p_name text,
  p_slug text,
  p_initial_admin_id uuid
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare new_workspace_id uuid;
begin
  insert into public.app_workspaces (name, slug) values (p_name, p_slug) returning id into new_workspace_id;
  insert into public.app_workspace_settings (workspace_id) values (new_workspace_id);
  insert into public.app_workspace_members (workspace_id, user_id, role) values (new_workspace_id, p_initial_admin_id, 'admin');
  perform public.seed_dashboard_preferences_from_active_default(new_workspace_id, p_initial_admin_id);
  return new_workspace_id;
end;
$$;

revoke all on table public.platform_dashboard_preference_templates from anon, authenticated;
revoke all on function public.seed_dashboard_preferences_from_active_default(uuid, uuid) from public, anon, authenticated;
revoke all on function public.activate_platform_dashboard_preference_template(jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.seed_dashboard_preferences_from_active_default(uuid, uuid) to service_role;
grant execute on function public.activate_platform_dashboard_preference_template(jsonb, jsonb, text) to service_role;
