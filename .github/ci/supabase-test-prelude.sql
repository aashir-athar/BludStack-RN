-- CI-only Supabase compatibility shims.
-- supabase_schema.sql targets a Supabase database, which ships an `auth` schema,
-- an `auth.uid()` function, the anon/authenticated/service_role roles, and the
-- `supabase_realtime` publication out of the box. A vanilla Postgres service has
-- none of those, so we create the minimum surface the schema references before
-- applying it. This proves the DDL, RLS policies, grants, triggers, and indexes
-- all apply cleanly — it is not a runtime auth emulation.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- auth schema + the slice of auth.users our trigger reads (id, email).
create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at         timestamptz default now()
);

-- auth.uid() — the only auth.* function the policies call. Resolves from a JWT
-- claim GUC when present, else null (no rows visible), matching Supabase.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- Roles referenced by GRANT and `to <role>` policy clauses.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

-- The realtime block in the schema ALTERs this publication to add tables, so it
-- must already exist (Supabase pre-creates it).
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
