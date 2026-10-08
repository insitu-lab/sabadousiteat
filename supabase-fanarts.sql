-- Pode rodar várias vezes sem erro. Só cria o que falta; o site atual NÃO é afetado.
create or replace function is_admin() returns boolean language sql security definer as
$$ select exists(select 1 from admins where user_id=auth.uid()) $$;

create table if not exists fanarts(id uuid primary key default gen_random_uuid(), user_id uuid default auth.uid(),
  handle text not null, path text not null, status text not null default 'pendente',
  votos int not null default 0, vencedora boolean not null default false, criado_em timestamptz default now());
create table if not exists votos(fanart_id uuid references fanarts on delete cascade, user_id uuid default auth.uid(), primary key(fanart_id,user_id));
create table if not exists placar(user_id uuid primary key default auth.uid(), handle text, clicks bigint default 0, milhao_em timestamptz);
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

create or replace function conta_voto() returns trigger language plpgsql security definer as
$$ begin update fanarts set votos=votos+1 where id=new.fanart_id; return new; end $$;
drop trigger if exists t_voto on votos;
create trigger t_voto after insert on votos for each row execute function conta_voto();

create or replace function marca_milhao() returns trigger language plpgsql as
$$ begin
  if new.clicks>=1000000 then new.milhao_em:=coalesce(old.milhao_em,now()); end if;
  if tg_op='UPDATE' then new.milhao_em:=coalesce(old.milhao_em,new.milhao_em); end if;
  return new; end $$;
drop trigger if exists t_milhao on placar;
create trigger t_milhao before insert or update on placar for each row execute function marca_milhao();

insert into storage.buckets(id,name,public) values('fanarts','fanarts',true) on conflict do nothing;
drop policy if exists s_up on storage.objects; drop policy if exists s_del on storage.objects;
create policy s_up on storage.objects for insert to authenticated with check (bucket_id='fanarts');
create policy s_del on storage.objects for delete using (bucket_id='fanarts' and is_admin());

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
-- o fã só pode ZERAR o próprio bônus (ao recebê-lo), nunca aumentar:
create or replace function trava_bonus() returns trigger language plpgsql as
$$ begin
  if not is_admin() and auth.uid() is not null and new.bonus>old.bonus then new.bonus:=old.bonus; end if;
  return new; end $$;
drop trigger if exists t_bonus on placar;
create trigger t_bonus before update on placar for each row execute function trava_bonus();
