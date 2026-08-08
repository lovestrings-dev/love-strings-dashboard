-- The legacy Love Strings owner helper is no longer referenced by current
-- policies. Workspace administration now uses is_workspace_administrator,
-- which recognizes only the normalized admin membership role.

drop function if exists public.is_love_strings_owner(uuid);
