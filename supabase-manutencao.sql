-- Execute uma vez no SQL Editor do Supabase.
create table if not exists public.site_settings (
  id smallint primary key check (id = 1),
  maintenance boolean not null default false
);

insert into public.site_settings (id, maintenance)
values (1, false)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;
revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;

drop policy if exists site_settings_read on public.site_settings;
create policy site_settings_read on public.site_settings
  for select to anon, authenticated using (true);

create or replace function public.set_site_maintenance(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'sem permissao';
  end if;

  update public.site_settings
  set maintenance = p_enabled
  where id = 1;
end;
$$;

revoke all on function public.set_site_maintenance(boolean) from public, anon;
grant execute on function public.set_site_maintenance(boolean) to authenticated;
