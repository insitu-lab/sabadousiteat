-- Pode rodar várias vezes sem erro. Só cria o que falta; o site atual NÃO é afetado.
create or replace function is_admin() returns boolean language sql security definer as
$$ select exists(select 1 from admins where user_id=auth.uid()) $$;

-- Registra cada conta uma vez; guarda somente o @ e a data de cadastro, nunca a senha.
create table if not exists public.contas(
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text not null,
  criado_em timestamptz not null default now()
);
alter table public.contas enable row level security;
drop policy if exists c_sel on public.contas;
create policy c_sel on public.contas for select to authenticated using (is_admin());
revoke all on public.contas from anon, authenticated;
grant select on public.contas to authenticated;

create or replace function public.registra_conta_nova() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if nullif(btrim(new.raw_user_meta_data->>'handle'),'') is null then return new; end if;
  insert into public.contas(user_id,handle,criado_em)
  values(new.id,btrim(new.raw_user_meta_data->>'handle'),new.created_at)
  on conflict(user_id) do nothing;
  return new;
end $$;
revoke all on function public.registra_conta_nova() from public, anon, authenticated;
drop trigger if exists t_registra_conta on auth.users;
create trigger t_registra_conta after insert on auth.users
for each row execute function public.registra_conta_nova();

-- Inclui as contas que já existiam antes da criação deste registro.
insert into public.contas(user_id,handle,criado_em)
select id,btrim(raw_user_meta_data->>'handle'),created_at
from auth.users where nullif(btrim(raw_user_meta_data->>'handle'),'') is not null
on conflict(user_id) do nothing;

create table if not exists fanarts(id uuid primary key default gen_random_uuid(), user_id uuid default auth.uid(),
  handle text not null, path text not null, status text not null default 'pendente',
  votos int not null default 0, vencedora boolean not null default false, criado_em timestamptz default now());
alter table public.fanarts add column if not exists notificacao_vista boolean;
update public.fanarts set notificacao_vista=true where notificacao_vista is null and status in ('aprovada','recusada');
update public.fanarts set notificacao_vista=false where notificacao_vista is null;
alter table public.fanarts alter column notificacao_vista set default false;
alter table public.fanarts alter column notificacao_vista set not null;
create table if not exists votos(fanart_id uuid references fanarts on delete cascade, user_id uuid default auth.uid(), primary key(fanart_id,user_id));
create table if not exists placar(user_id uuid primary key default auth.uid(), handle text, clicks bigint default 0, milhao_em timestamptz);
alter table public.placar add column if not exists bilhao_em timestamptz;
alter table fanarts enable row level security; alter table votos enable row level security; alter table placar enable row level security;

drop policy if exists f_sel on fanarts; drop policy if exists f_ins on fanarts; drop policy if exists f_upd on fanarts; drop policy if exists f_del on fanarts;
drop policy if exists v_sel on votos; drop policy if exists v_ins on votos;
drop policy if exists p_sel on placar; drop policy if exists p_ins on placar; drop policy if exists p_upd on placar;
create policy f_sel on fanarts for select using (status='aprovada' or is_admin() or user_id=auth.uid());
create policy f_ins on fanarts for insert with check (user_id=auth.uid() and status='pendente' and not vencedora);
create policy f_upd on fanarts for update using (is_admin());
create policy f_del on fanarts for delete using (is_admin());
create policy v_sel on votos for select using (user_id=auth.uid());
create policy v_ins on votos for insert with check (user_id=auth.uid());
create policy p_sel on placar for select using (true);
create policy p_ins on placar for insert with check (user_id=auth.uid());
create policy p_upd on placar for update using (user_id=auth.uid());

-- Uma fanart por semana por conta; o admin pode conceder um reenvio extra.
create table if not exists public.fanart_reenvios(
  user_id uuid not null references auth.users(id) on delete cascade,
  semana date not null,
  restantes integer not null default 1 check (restantes between 0 and 1),
  primary key(user_id,semana)
);
alter table public.fanart_reenvios enable row level security;
revoke all on public.fanart_reenvios from anon, authenticated;

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
revoke all on function public.pode_enviar_fanart() from public, anon;
grant execute on function public.pode_enviar_fanart() to authenticated;

create or replace function public.limita_fanart_semanal() returns trigger
language plpgsql security definer set search_path=public as $$
declare inicio date:=date_trunc('week',now() at time zone 'America/Sao_Paulo')::date;
begin
  if is_admin() then return new; end if;
  if new.user_id is null or new.user_id<>auth.uid() then raise exception 'conta_invalida'; end if;
  perform pg_advisory_xact_lock(hashtext(new.user_id::text));
  if exists(select 1 from public.fanarts where user_id=new.user_id and date_trunc('week',criado_em at time zone 'America/Sao_Paulo')::date=inicio) then
    update public.fanart_reenvios set restantes=0 where user_id=new.user_id and semana=inicio and restantes>0;
    if not found then raise exception 'limite_semanal_fanart'; end if;
    update public.fanarts set status='substituida',notificacao_vista=true
    where user_id=new.user_id and status='pendente' and date_trunc('week',criado_em at time zone 'America/Sao_Paulo')::date=inicio;
  end if;
  return new;
end $$;
drop trigger if exists t_limita_fanart_semanal on public.fanarts;
create trigger t_limita_fanart_semanal before insert on public.fanarts
for each row execute function public.limita_fanart_semanal();

create or replace function public.liberar_reenvio_fanart(p_user_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare inicio date:=date_trunc('week',now() at time zone 'America/Sao_Paulo')::date;
begin
  if not is_admin() then raise exception 'sem permissao'; end if;
  insert into public.fanart_reenvios(user_id,semana,restantes) values(p_user_id,inicio,1)
  on conflict(user_id,semana) do update set restantes=1;
end $$;
revoke all on function public.liberar_reenvio_fanart(uuid) from public, anon;
grant execute on function public.liberar_reenvio_fanart(uuid) to authenticated;

create or replace function public.marcar_fanart_notificacao_vista(p_fanart_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  update public.fanarts set notificacao_vista=true
  where id=p_fanart_id and user_id=auth.uid() and status in ('aprovada','recusada');
end $$;
revoke all on function public.marcar_fanart_notificacao_vista(uuid) from public, anon;
grant execute on function public.marcar_fanart_notificacao_vista(uuid) to authenticated;

create or replace function conta_voto() returns trigger language plpgsql security definer as
$$ begin update fanarts set votos=votos+1 where id=new.fanart_id; return new; end $$;
drop trigger if exists t_voto on votos;
create trigger t_voto after insert on votos for each row execute function conta_voto();

create or replace function marca_milhao() returns trigger language plpgsql as
$$ begin
  if tg_op='INSERT' then
    if new.clicks>=1000000 then new.milhao_em:=coalesce(new.milhao_em,now()); end if;
    if new.clicks>=1000000000 then new.bilhao_em:=coalesce(new.bilhao_em,now()); end if;
  elsif tg_op='UPDATE' then
    if is_admin() and new.clicks<1000000 then new.milhao_em:=null;
    elsif new.clicks>=1000000 then new.milhao_em:=coalesce(old.milhao_em,new.milhao_em,now());
    else new.milhao_em:=coalesce(old.milhao_em,new.milhao_em); end if;
    if is_admin() and new.clicks<1000000000 then new.bilhao_em:=null;
    elsif new.clicks>=1000000000 then new.bilhao_em:=coalesce(old.bilhao_em,new.bilhao_em,now());
    else new.bilhao_em:=coalesce(old.bilhao_em,new.bilhao_em); end if;
  end if;
  return new; end $$;
drop trigger if exists t_milhao on placar;
create trigger t_milhao before insert or update on placar for each row execute function marca_milhao();

insert into storage.buckets(id,name,public) values('fanarts','fanarts',true) on conflict do nothing;
drop policy if exists s_up on storage.objects; drop policy if exists s_del on storage.objects; drop policy if exists s_del_orphan on storage.objects;
create policy s_up on storage.objects for insert to authenticated with check (bucket_id='fanarts');
create policy s_del on storage.objects for delete using (bucket_id='fanarts' and is_admin());
create policy s_del_orphan on storage.objects for delete to authenticated using (
  bucket_id='fanarts' and owner_id::text=auth.uid()::text
  and not exists(select 1 from public.fanarts f where f.path=name)
);

-- ===== poderes de admin: dar cliques para um fã =====
alter table placar add column if not exists bonus bigint not null default 0;
create or replace function dar_clicks(p_handle text, p_qtd bigint) returns boolean
language plpgsql security definer as
$$ begin
  if not is_admin() then raise exception 'sem permissão'; end if;
  if p_qtd<1 or p_qtd>1000000000 then raise exception 'quantidade inválida'; end if;
  update placar set bonus=bonus+p_qtd where lower(handle)=lower(p_handle);
  return found; end $$;
revoke all on function dar_clicks(text,bigint) from public, anon;
grant execute on function dar_clicks(text,bigint) to authenticated;

-- O admin também pode corrigir uma entrega de cliques feita por engano.
create or replace function remover_clicks(p_user_id uuid, p_qtd bigint) returns boolean
language plpgsql security definer as
$$ begin
  if not is_admin() then raise exception 'sem permissão'; end if;
  if p_qtd<1 or p_qtd>1000000000 then raise exception 'quantidade inválida'; end if;
  update placar set clicks=greatest(0,clicks-p_qtd),bonus=bonus-p_qtd where user_id=p_user_id;
  return found; end $$;
revoke all on function remover_clicks(uuid,bigint) from public, anon;
grant execute on function remover_clicks(uuid,bigint) to authenticated;
-- o fã só pode ZERAR o próprio bônus (ao recebê-lo), nunca aumentar:
create or replace function trava_bonus() returns trigger language plpgsql as
$$ begin
  if not is_admin() and auth.uid() is not null and new.bonus>old.bonus then new.bonus:=old.bonus; end if;
  return new; end $$;
drop trigger if exists t_bonus on placar;
create trigger t_bonus before update on placar for each row execute function trava_bonus();


-- Atualização: registro e lista de contas ativas.
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
