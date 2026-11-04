-- =============================================================================
-- SOMENTE PARA TESTES LOCAIS. NUNCA rode isto no seu projeto Supabase real.
-- Simula o mínimo do Supabase (roles, schema auth, storage e auth.uid()) num
-- Postgres comum e vazio, para exercitar as migrações e as políticas RLS.
-- =============================================================================
\set ON_ERROR_STOP on

do $$
begin
  if exists (select 1 from pg_namespace where nspname in ('auth', 'storage')) then
    raise exception 'Schemas auth/storage já existem: isto parece um Supabase real. Abortando.';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon')          then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role')  then create role service_role nologin bypassrls; end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;
-- Supabase concede tudo por padrão nas tabelas novas do schema public; reproduzimos isso.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema storage;
grant usage on schema storage to anon, authenticated, service_role;

create table storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text,
  owner      uuid,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to authenticated, service_role;

create function storage.foldername(name text) returns text[]
language plpgsql immutable
as $$
declare _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end $$;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;

-- Utilitário de asserções usado pelos testes
create schema test;
grant usage on schema test to anon, authenticated;
create function test.assert(cond boolean, msg text) returns void
language plpgsql
as $$
begin
  if cond is not true then
    raise exception 'FALHOU: %', msg using errcode = 'XX999';
  end if;
  raise notice 'ok  - %', msg;
end $$;
grant execute on function test.assert(boolean, text) to anon, authenticated;

-- Troca de identidade nos testes: test.login(<uuid>) vira "authenticated" com esse auth.uid()
create function test.login(u uuid) returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', u::text, true);
  execute 'set local role authenticated';
end $$;

create function test.anon() returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
end $$;

create function test.logout() returns void
language plpgsql
as $$
begin
  execute 'reset role';
end $$;

-- Espera que `q` falhe com o SQLSTATE indicado
create function test.throws(q text, expected_state text, msg text) returns void
language plpgsql
as $$
declare got text;
begin
  begin
    execute q;
    got := 'sem erro';
  exception when others then
    got := sqlstate;
  end;
  perform test.assert(got = expected_state, msg || ' [esperado ' || expected_state || ', obtido ' || got || ']');
end $$;

grant execute on function test.login(uuid), test.anon(), test.logout(), test.throws(text, text, text) to anon, authenticated;
