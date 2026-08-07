revoke all on function public.provision_workspace(text, text, uuid) from public;
revoke all on function public.provision_workspace(text, text, uuid) from anon;
revoke all on function public.provision_workspace(text, text, uuid) from authenticated;
grant execute on function public.provision_workspace(text, text, uuid) to service_role;
