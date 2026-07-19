-- Support release-day defaults and the UI's non-applicable task state.

alter table public.marketing_campaign_tasks
  drop constraint if exists marketing_campaign_tasks_task_kind_check;

alter table public.marketing_campaign_tasks
  add constraint marketing_campaign_tasks_task_kind_check
  check (
    task_kind in (
      'production',
      'instagram_upload',
      'youtube_upload',
      'website_update',
      'facebook_post',
      'youtube_post',
      'extra'
    )
  );

alter table public.marketing_campaign_tasks
  drop constraint if exists marketing_campaign_tasks_status_check;

alter table public.marketing_campaign_tasks
  add constraint marketing_campaign_tasks_status_check
  check (status in ('not-started', 'in-progress', 'done', 'irrelevant'));
