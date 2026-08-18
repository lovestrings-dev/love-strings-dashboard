-- A Meta developer application can host multiple distinct user-facing consent
-- flows. Preserve the old app kind for provider routing while making the
-- connection kind durable and scope-specific.

alter table public.app_meta_connections
  add column connection_kind text;

-- Existing Batch 1 rows predate distinct App A flows. They are safely retained
-- as the conservative Instagram kind; no OAuth/discovery rows were created by
-- Batch 1, so no live Threads authorization is relabelled.
update public.app_meta_connections
set connection_kind = case app_kind
  when 'fstats_login' then 'fstats_login_facebook_page'
  when 'creator_social' then 'creator_social_instagram'
end
where connection_kind is null;

alter table public.app_meta_connections
  alter column connection_kind set not null,
  add constraint app_meta_connections_connection_kind_check
    check (connection_kind in (
      'fstats_login_facebook_page',
      'creator_social_instagram',
      'creator_social_threads'
    )),
  add constraint app_meta_connections_connection_kind_app_kind_check
    check (
      (connection_kind = 'fstats_login_facebook_page' and app_kind = 'fstats_login')
      or (connection_kind in ('creator_social_instagram', 'creator_social_threads') and app_kind = 'creator_social')
    );

alter table public.app_meta_connections
  drop constraint app_meta_connections_workspace_app_subject_key;

alter table public.app_meta_connections
  add constraint app_meta_connections_workspace_kind_subject_key
  unique (workspace_id, connection_kind, authorization_user_external_id);
