-- Execute no SQL Editor do Supabase depois de supabase-fanarts.sql.
-- Pode executar novamente. Não apaga contas nem altera cliques existentes.
begin;

-- Repara o registro de contas que ainda existem na autenticação.
insert into public.contas(user_id,handle,criado_em)
select u.id,btrim(u.raw_user_meta_data->>'handle'),u.created_at
from auth.users u
where nullif(btrim(u.raw_user_meta_data->>'handle'),'') is not null
on conflict(user_id) do update set handle=excluded.handle;

-- Uma conta ativa pode aparecer na lista antes do primeiro clique.
insert into public.placar(user_id,handle,clicks)
select c.user_id,c.handle,0
from public.contas c join auth.users u on u.id=c.user_id
where not exists(select 1 from public.admins a where a.user_id=c.user_id)
on conflict(user_id) do nothing;

create or replace function public.registrar_conta_atual() returns void
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); nome text; cadastro timestamptz;
begin
  if uid is null then raise exception 'login necessario'; end if;
  if public.is_admin() then return; end if;
  select nullif(btrim(u.raw_user_meta_data->>'handle'),''),u.created_at
    into nome,cadastro from auth.users u where u.id=uid;
  if nome is null then return; end if;
  insert into public.contas(user_id,handle,criado_em) values(uid,nome,cadastro)
    on conflict(user_id) do update set handle=excluded.handle;
  insert into public.placar(user_id,handle,clicks) values(uid,nome,0)
    on conflict(user_id) do nothing;
end $$;
revoke all on function public.registrar_conta_atual() from public,anon;
grant execute on function public.registrar_conta_atual() to authenticated;

-- Apenas administradores podem consultar. A autenticação é a fonte da lista:
-- registros faltando em contas não escondem usuários; usuários excluídos não voltam.
create or replace function public.listar_contas_ativas()
returns table(user_id uuid,handle text,criado_em timestamptz,clicks bigint)
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'sem permissao'; end if;
  return query
  select u.id,
    coalesce(nullif(btrim(u.raw_user_meta_data->>'handle'),''),nullif(c.handle,''),nullif(p.handle,'')),
    u.created_at,coalesce(p.clicks,0::bigint)
  from auth.users u
  left join public.contas c on c.user_id=u.id
  left join public.placar p on p.user_id=u.id
  where not exists(select 1 from public.admins a where a.user_id=u.id)
    and coalesce(nullif(btrim(u.raw_user_meta_data->>'handle'),''),nullif(c.handle,''),nullif(p.handle,'')) is not null
  order by u.created_at desc;
end $$;
revoke all on function public.listar_contas_ativas() from public,anon;
grant execute on function public.listar_contas_ativas() to authenticated;

-- Admin/teste não tem limite semanal de fanart. O gatilho de inserção já
-- permite esse acesso; esta função aplica a mesma regra à verificação do envio.
create or replace function public.pode_enviar_fanart() returns boolean
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); inicio date:=date_trunc('week',now() at time zone 'America/Sao_Paulo')::date;
begin
  if uid is null then return false; end if;
  if public.is_admin() then return true; end if;
  if exists(select 1 from public.fanarts where user_id=uid and date_trunc('week',criado_em at time zone 'America/Sao_Paulo')::date=inicio) then
    return exists(select 1 from public.fanart_reenvios where user_id=uid and semana=inicio and restantes>0);
  end if;
  return true;
end $$;
revoke all on function public.pode_enviar_fanart() from public,anon;
grant execute on function public.pode_enviar_fanart() to authenticated;

commit;
