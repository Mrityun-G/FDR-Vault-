-- =====================================================================================
-- Platform layer for standalone PostgreSQL. Runs BEFORE supabase/migrations/*.sql.
-- Provides what those migrations expect from the hosting platform, so they run unchanged:
--   * roles anon / authenticated / service_role (the API server switches to them per request)
--   * auth.users + auth.uid()   (identity of the signed-in caller, set by the API server)
--   * storage.buckets / storage.objects (private documents, stored in PostgreSQL)
-- Plus the server's own auth tables (sessions, one-time tokens, Google identities).
-- Idempotent: safe to run again.
-- =====================================================================================

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

-- The API server's login role must be able to SET ROLE to these for each request.
do $$
begin
  execute format('grant anon, authenticated, service_role to %I', current_user);
end $$;

grant usage on schema public to anon, authenticated, service_role;

-- ------------------------------------------------------------------ auth

create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null,
  encrypted_password text,                       -- bcrypt (pgcrypto crypt / gen_salt('bf'))
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data  jsonb not null default '{}'::jsonb,
  last_sign_in_at    timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index if not exists users_email_key on auth.users (lower(email));

-- External sign-in identities (Google). One account per verified email.
create table if not exists auth.identities (
  provider    text not null,
  provider_id text not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  email       text,
  created_at  timestamptz not null default now(),
  primary key (provider, provider_id)
);

-- Refresh-token sessions. Access tokens carry the session id; a revoked session stops working at once.
create table if not exists auth.sessions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  refresh_token_hash text not null unique,
  created_at         timestamptz not null default now(),
  refreshed_at       timestamptz not null default now(),
  expires_at         timestamptz not null,
  revoked_at         timestamptz
);
create index if not exists sessions_user_idx on auth.sessions(user_id);

-- Single-use, hashed tokens: email confirmation, password recovery, email OTP, redirect sign-in codes.
create table if not exists auth.one_time_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('confirmation', 'recovery', 'email_otp', 'auth_code')),
  token_hash  text not null,
  redirect_to text,
  attempts    int not null default 0,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists one_time_tokens_lookup on auth.one_time_tokens(kind, token_hash);
create index if not exists one_time_tokens_user on auth.one_time_tokens(user_id, kind);

-- Identity of the caller for this transaction (set by the API server with set_config(..., true)).
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- Clients never touch the auth tables directly; only auth.uid() is exposed.
revoke all on all tables in schema auth from public, anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- ------------------------------------------------------------------ storage

create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text not null references storage.buckets(id),
  name       text not null,                     -- "<institution_id>/<uuid>/<file name>"
  owner      uuid default auth.uid(),
  mime_type  text,
  size_bytes bigint,
  content    bytea,
  created_at timestamptz not null default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

grant usage on schema storage to authenticated, service_role;
grant select, insert on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
grant execute on function storage.foldername(text) to authenticated;
