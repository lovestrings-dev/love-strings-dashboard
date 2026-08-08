alter table public.app_google_connections
  add column if not exists youtube_topic_channel_id text,
  add column if not exists youtube_topic_channel_title text;
