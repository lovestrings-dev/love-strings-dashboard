-- Opt-in Instagram Reel publishing. This deliberately does not change the
-- existing FStats authorization or its analytics scope contract.
create table public.app_meta_connection_capabilities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  connection_id uuid not null references public.app_meta_connections(id) on delete cascade,
  capability text not null check (capability = 'instagram_reel_publish'),
  authorization_user_external_id text,
  encrypted_token_payload text not null,
  token_type text not null,
  token_expires_at timestamptz,
  granted_scopes text[] not null default '{}'::text[],
  bound_page_external_id text not null,
  bound_instagram_external_id text not null,
  state text not null default 'connected' check (state in ('connected','reauthorization_required','degraded')),
  last_error_code text,
  last_error_summary text check (last_error_summary is null or char_length(last_error_summary) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (connection_id, capability)
);
create trigger app_meta_connection_capabilities_set_updated_at before update on public.app_meta_connection_capabilities for each row execute function public.set_updated_at();
alter table public.app_meta_connection_capabilities enable row level security;
revoke all on public.app_meta_connection_capabilities from anon, authenticated;

create table public.studio_publish_artifacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  render_job_id uuid not null references public.studio_render_jobs(id) on delete restrict,
  rendered_asset_id uuid not null references public.studio_rendered_assets(id) on delete restrict,
  object_path text not null, mime_type text not null default 'video/mp4', byte_size bigint,
  retained_until timestamptz, created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, render_job_id), unique (workspace_id, object_path)
);
alter table public.studio_publish_artifacts enable row level security;
create policy "Workspace members can read Studio publish artifacts" on public.studio_publish_artifacts for select to authenticated using (public.is_workspace_member(workspace_id));

create table public.instagram_reel_publications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade,
  publish_artifact_id uuid not null references public.studio_publish_artifacts(id) on delete restrict,
  base_connection_id uuid not null references public.app_meta_connections(id) on delete restrict,
  publishing_capability_id uuid references public.app_meta_connection_capabilities(id) on delete restrict,
  target_page_external_id text not null, target_instagram_external_id text not null,
  caption_draft text not null default '', caption_used text,
  publishing_mode text not null default 'normal' check (publishing_mode in ('normal','trial')),
  trial_graduation_strategy text check (trial_graduation_strategy in ('manual','ss_performance')),
  scheduled_for timestamptz, scheduled_timezone text not null,
  status text not null default 'draft' check (status in ('draft','scheduled','publishing','published','failed','cancelled')),
  execution_stage text not null default 'queued' check (execution_stage in ('queued','creating_container','processing_container','publishing','reconciling','complete')),
  meta_container_id text, meta_media_id text, meta_permalink text, signed_source_expires_at timestamptz,
  lease_token uuid, lease_expires_at timestamptz, next_attempt_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0), error_code text, error_summary text check (error_summary is null or char_length(error_summary) <= 500),
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz, cancelled_at timestamptz,
  check ((publishing_mode = 'normal' and trial_graduation_strategy is null) or (publishing_mode = 'trial' and trial_graduation_strategy is not null))
);
create index instagram_reel_publications_due_idx on public.instagram_reel_publications (scheduled_for) where status = 'scheduled';
create trigger instagram_reel_publications_set_updated_at before update on public.instagram_reel_publications for each row execute function public.set_updated_at();
alter table public.instagram_reel_publications enable row level security;
create policy "Workspace members can read Instagram Reel publications" on public.instagram_reel_publications for select to authenticated using (public.is_workspace_member(workspace_id));

create table public.instagram_reel_publish_attempts (
  id uuid primary key default gen_random_uuid(), publication_id uuid not null references public.instagram_reel_publications(id) on delete cascade,
  workspace_id uuid not null references public.app_workspaces(id) on delete cascade, attempt_number integer not null,
  stage text not null, outcome text not null check (outcome in ('started','succeeded','retryable_failure','terminal_failure','reconciled')),
  provider_code text, summary text check (summary is null or char_length(summary) <= 500), created_at timestamptz not null default now()
);
alter table public.instagram_reel_publish_attempts enable row level security;
create policy "Workspace members can read Instagram Reel attempts" on public.instagram_reel_publish_attempts for select to authenticated using (public.is_workspace_member(workspace_id));
create function public.prevent_instagram_reel_publish_attempt_mutation()
returns trigger language plpgsql set search_path = public as $$ begin
  raise exception 'Instagram Reel publish attempts are append-only';
end; $$;
create trigger instagram_reel_publish_attempts_append_only before update or delete on public.instagram_reel_publish_attempts for each row execute function public.prevent_instagram_reel_publish_attempt_mutation();

-- A single service-role caller atomically leases one due publication. Leases
-- prevent two manual/scheduled dispatchers from posting the same container.
create function public.claim_due_instagram_reel_publication(p_workspace_id uuid, p_now timestamptz, p_max_lateness interval, p_lease_seconds integer default 120)
returns setof public.instagram_reel_publications language plpgsql security definer set search_path = public as $$
declare v_row public.instagram_reel_publications%rowtype; v_token uuid := gen_random_uuid();
begin
  select * into v_row from public.instagram_reel_publications
  where workspace_id = p_workspace_id and status = 'scheduled' and scheduled_for <= p_now
    and (execution_stage <> 'queued' or scheduled_for >= p_now - p_max_lateness)
    and (next_attempt_at is null or next_attempt_at <= p_now) and (lease_expires_at is null or lease_expires_at < p_now)
  order by scheduled_for for update skip locked limit 1;
  if not found then return; end if;
  update public.instagram_reel_publications set status='publishing', lease_token=v_token, lease_expires_at=p_now + make_interval(secs => p_lease_seconds), attempts=attempts+1 where id=v_row.id returning * into v_row;
  return next v_row;
end; $$;
revoke all on function public.claim_due_instagram_reel_publication(uuid, timestamptz, interval, integer) from public, anon, authenticated;
grant execute on function public.claim_due_instagram_reel_publication(uuid, timestamptz, interval, integer) to service_role;
