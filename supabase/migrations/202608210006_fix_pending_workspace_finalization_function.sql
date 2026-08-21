create or replace function public.finalize_pending_workspace(p_workspace_id uuid, p_user_id uuid, p_display_name text, p_workspace_name text)
returns table (workspace_id uuid, workspace_name text, workspace_slug text, outcome text)
language plpgsql security definer set search_path = public as $$
declare
  normalized_display_name text := trim(p_display_name); normalized_workspace_name text := trim(p_workspace_name);
  slug_base text; candidate_slug text; suffix integer := 2; workspace_record public.app_workspaces%rowtype;
begin
  if length(normalized_display_name) < 1 or length(normalized_display_name) > 120 then raise exception 'Enter a valid User Name.'; end if;
  if length(normalized_workspace_name) < 2 or length(normalized_workspace_name) > 120 then raise exception 'Enter a valid Artist or Band Name.'; end if;
  select * into workspace_record from public.app_workspaces where id = p_workspace_id for update;
  if not found then raise exception 'Workspace was not found.'; end if;
  if not exists (select 1 from public.app_workspace_members where app_workspace_members.workspace_id = p_workspace_id and app_workspace_members.user_id = p_user_id and app_workspace_members.role = 'admin') then raise exception 'Only a workspace Admin can finish setup.'; end if;
  if workspace_record.setup_state = 'active' then return query select workspace_record.id, workspace_record.name, workspace_record.slug, 'already_active'; return; end if;
  if workspace_record.setup_state <> 'pending_setup' then raise exception 'Workspace setup is not available.'; end if;
  slug_base := trim(both '-' from regexp_replace(lower(normalized_workspace_name), '[^a-z0-9]+', '-', 'g'));
  if slug_base = '' then slug_base := 'workspace'; end if; slug_base := left(slug_base, 80);
  perform pg_advisory_xact_lock(hashtext(slug_base)); candidate_slug := slug_base;
  while exists (select 1 from public.app_workspaces where app_workspaces.slug = candidate_slug and app_workspaces.id <> p_workspace_id) loop
    candidate_slug := left(slug_base, 80 - length(suffix::text) - 1) || '-' || suffix::text; suffix := suffix + 1;
  end loop;
  update public.app_profiles set display_name = normalized_display_name where id = p_user_id;
  update public.app_workspaces set name = normalized_workspace_name, slug = candidate_slug, setup_state = 'active' where id = p_workspace_id;
  return query select p_workspace_id, normalized_workspace_name, candidate_slug, 'finalized';
end;
$$;
