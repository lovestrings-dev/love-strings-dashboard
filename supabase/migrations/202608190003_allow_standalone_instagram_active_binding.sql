-- App A standalone Instagram accounts have no Facebook Page parent. App B
-- bindings remain Page-scoped and continue to supply this value.
alter table public.app_meta_active_instagram_bindings
  alter column parent_page_external_id drop not null;
