-- =====================================================================================
-- AICTE Intelligent Regulatory Validation Platform — Institution Portal backend
-- Supabase (Postgres 15+) schema, row-level security, server-side workflow functions.
--
-- Design rules
--   * Clients never write tables directly. Every write goes through a SECURITY DEFINER
--     function that checks the caller's identity, role, institution and the allowed
--     status transition, and writes an audit event.
--   * Clients can only SELECT rows of their own institution (RLS), or all rows if staff.
--   * Deterministic rule evaluation and cross-institution duplicate-document detection
--     run on the server; AI/OCR output from the device is stored as advisory only.
--   * Money is numeric(14,2) rupees. Submissions are idempotent (idempotency_key).
-- =====================================================================================

-- ------------------------------------------------------------------ tables

create table if not exists public.institutions (
  id                 uuid primary key default gen_random_uuid(),
  pid                text not null unique,
  name               text not null,
  short_name         text,
  city               text,
  district           text,
  state              text,
  region             text not null,
  type               text,
  address            text,
  website            text,
  sanctioned_intake  integer check (sanctioned_intake >= 0),
  total_students     integer check (total_students >= 0),
  required_fdr_lakhs numeric(10,2) not null default 100 check (required_fdr_lakhs > 0),
  nodal              jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text not null,
  full_name      text not null default '',
  designation    text not null default '',
  mobile         text,
  role           text not null default 'INSTITUTION' check (role in ('INSTITUTION','REVIEWER','ADMIN','BANK_OFFICIAL')),
  status         text not null default 'PENDING_VERIFICATION' check (status in ('PENDING_VERIFICATION','ACTIVE','DISABLED')),
  institution_id uuid references public.institutions(id),
  bank_name      text,
  created_at     timestamptz not null default now(),
  constraint institution_role_needs_institution check (role <> 'INSTITUTION' or status <> 'ACTIVE' or institution_id is not null)
);
create index if not exists profiles_institution_idx on public.profiles(institution_id);

create sequence if not exists public.registration_seq;
create table if not exists public.registration_requests (
  id          uuid primary key default gen_random_uuid(),
  request_no  text not null unique,
  user_id     uuid references auth.users(id) on delete set null,
  payload     jsonb not null,
  status      text not null default 'FORWARDED_TO_DTE' check (status in ('FORWARDED_TO_DTE','ACTIVATED','REJECTED')),
  created_at  timestamptz not null default now()
);

-- Versioned rule parameters. Findings record the version they were evaluated with.
create table if not exists public.rule_config (
  version        text primary key,
  effective_from timestamptz not null default now(),
  params         jsonb not null,
  created_at     timestamptz not null default now()
);

create table if not exists public.fdrs (
  id                    uuid primary key default gen_random_uuid(),
  institution_id        uuid not null references public.institutions(id),
  fdr_number            text not null unique,
  application_number    text,
  amount                numeric(14,2) not null check (amount > 0),
  bank_name             text not null,
  branch_name           text not null,
  ifsc_code             text not null check (ifsc_code ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  issue_date            date not null,
  maturity_date         date not null,
  tenure_years          integer not null default 10,
  joint_lien_holder     text not null,
  is_lien_confirmed     boolean not null default false,
  lien_endorsement_token text,
  lien_endorsed_at      timestamptz,
  renewal_status        text not null default 'NOT_APPLICABLE',
  released              boolean not null default false,
  replaced_fdr          text,
  evidence              jsonb,
  demo                  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint fdr_dates check (maturity_date > issue_date)
);
create index if not exists fdrs_institution_idx on public.fdrs(institution_id);

create table if not exists public.fdr_requests (
  id             uuid primary key default gen_random_uuid(),
  fdr_id         uuid not null references public.fdrs(id),
  institution_id uuid not null references public.institutions(id),
  kind           text not null check (kind in ('RENEWAL','REPLACEMENT','RELEASE')),
  status         text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  payload        jsonb not null default '{}'::jsonb,
  reason         text,
  requested_by   uuid,
  requested_at   timestamptz not null default now(),
  decided_by     uuid,
  decided_by_name text,
  decided_at     timestamptz,
  decision_note  text
);
create unique index if not exists fdr_requests_one_pending on public.fdr_requests(fdr_id) where status = 'PENDING';
create index if not exists fdr_requests_institution_idx on public.fdr_requests(institution_id);

create sequence if not exists public.application_seq;
create table if not exists public.applications (
  id                   uuid primary key default gen_random_uuid(),
  application_number   text not null unique,
  institution_id       uuid not null references public.institutions(id),
  type                 text not null check (type in ('NEW_PROGRAMME','EOA','INFRASTRUCTURE_UPDATE','INTAKE_VARIATION','CLOSURE')),
  status               text not null check (status in ('SUBMITTED','UNDER_SCRUTINY','DEFICIENCIES_NOTED','SCRUTINY_CLEARED','APPROVED','REJECTED')),
  academic_year        text not null check (academic_year ~ '^\d{4}-\d{2}$'),
  programme            jsonb not null default '{}'::jsonb,
  institution_snapshot jsonb not null default '{}'::jsonb,
  intake_details       jsonb not null default '{}'::jsonb,
  fdr_id               uuid references public.fdrs(id),
  fdr_number           text,
  ai_summary           text,
  ai_findings          jsonb not null default '[]'::jsonb,
  cross_checks         jsonb not null default '[]'::jsonb,
  esign                jsonb,
  declaration          boolean not null default false,
  current_version      integer not null default 1,
  rule_version         text references public.rule_config(version),
  idempotency_key      uuid unique,
  submitted_by         uuid,
  submitted_at         timestamptz not null default now(),
  last_updated_at      timestamptz not null default now()
);
create index if not exists applications_institution_idx on public.applications(institution_id);
create index if not exists applications_status_idx on public.applications(status);

create table if not exists public.application_documents (
  id               uuid primary key default gen_random_uuid(),
  application_id   uuid not null references public.applications(id) on delete cascade,
  institution_id   uuid not null references public.institutions(id),
  doc_type         text not null,
  file_name        text not null,
  file_size_bytes  bigint not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  mime_type        text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
  file_hash        text not null check (file_hash ~ '^[0-9a-f]{64}$'),
  storage_path     text,
  page_count       integer not null default 1 check (page_count >= 1),
  valid_till       date,
  version          integer not null default 1,
  status           text not null default 'PROCESSED' check (status in ('PROCESSED','FLAGGED')),
  extracted_fields jsonb not null default '[]'::jsonb,
  forensics        jsonb not null default '{}'::jsonb,
  ai_analysis      jsonb,
  uploaded_by      uuid,
  uploaded_at      timestamptz not null default now()
);
create index if not exists application_documents_app_idx on public.application_documents(application_id);
create index if not exists application_documents_hash_idx on public.application_documents(file_hash);

create table if not exists public.findings (
  id               uuid primary key default gen_random_uuid(),
  application_id   uuid not null references public.applications(id) on delete cascade,
  rule_code        text not null,
  rule_name        text not null,
  severity         text not null check (severity in ('CRITICAL','WARNING','PASSED')),
  description      text not null,
  handbook_clause  text,
  evidence_snippet text,
  doc_type         text,
  rule_version     text,
  is_deterministic boolean not null default true,
  created_at       timestamptz not null default now()
);
create index if not exists findings_app_idx on public.findings(application_id);

create table if not exists public.scrutiny (
  application_id         uuid primary key references public.applications(id) on delete cascade,
  institution_id         uuid not null references public.institutions(id),
  status                 text not null check (status in ('IN_PROGRESS','DEFICIENCIES_ISSUED','RESPONSE_SUBMITTED','RECOMMENDED_APPROVAL','NOT_RECOMMENDED')),
  reviewer_id            uuid,
  reviewer_name          text,
  rationale              text,
  deficiency_points      text[] not null default '{}',
  official_notice_number text,
  updated_at             timestamptz not null default now()
);

create table if not exists public.compliance_responses (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  institution_id uuid not null references public.institutions(id),
  version        integer not null,
  points         jsonb not null,
  files          jsonb not null default '[]'::jsonb,
  submitted_by   uuid,
  submitted_at   timestamptz not null default now()
);

create table if not exists public.status_history (
  id             bigserial primary key,
  application_id uuid not null references public.applications(id) on delete cascade,
  institution_id uuid not null references public.institutions(id),
  from_status    text,
  to_status      text not null,
  actor_id       uuid,
  actor_role     text,
  note           text,
  at             timestamptz not null default now()
);

-- Staff-only notes; never visible to institutions.
create table if not exists public.review_notes (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  author_id      uuid,
  note           text not null,
  created_at     timestamptz not null default now()
);

create table if not exists public.notifications (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  title          text not null,
  message        text not null,
  type           text not null check (type in ('CRITICAL','WARNING','SUCCESS','INFO')),
  link           jsonb,
  is_read        boolean not null default false,
  dedupe_key     text,
  created_at     timestamptz not null default now()
);
create index if not exists notifications_institution_idx on public.notifications(institution_id, created_at desc);
create unique index if not exists notifications_dedupe on public.notifications(institution_id, dedupe_key) where dedupe_key is not null;

-- Append-only, hash-chained per institution (tamper-evident).
create table if not exists public.audit_events (
  id             bigserial primary key,
  institution_id uuid references public.institutions(id),
  correlation_id text not null,
  actor_id       uuid,
  actor_name     text,
  actor_role     text,
  action         text not null,
  target_type    text,
  target_id      text,
  details        text,
  ip_address     text,
  prev_hash      text,
  sha256_hash    text not null,
  created_at     timestamptz not null default now()
);
create index if not exists audit_events_institution_idx on public.audit_events(institution_id, id desc);

create sequence if not exists public.ticket_seq;
create table if not exists public.tickets (
  id             uuid primary key default gen_random_uuid(),
  ticket_no      text not null unique,
  institution_id uuid not null references public.institutions(id),
  created_by     uuid,
  category       text not null,
  ref            text,
  subject        text not null,
  description    text not null,
  status         text not null default 'Open',
  updates        jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now()
);

create table if not exists public.application_drafts (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  user_id        uuid not null,
  type           text not null,
  payload        jsonb not null,
  updated_at     timestamptz not null default now()
);

-- ------------------------------------------------------------------ rule configuration (v2026.1)

insert into public.rule_config(version, params) values ('v2026.1', '{
  "mandatory_docs": ["LAND_TITLE","BUILDING_NOC","FIRE_SAFETY","FDR_CORPUS","AFFILIATION","STATE_NOC","FACULTY_CADRE"],
  "expiry_docs": ["BUILDING_NOC","FIRE_SAFETY","AFFILIATION"],
  "allowed_docs": ["LAND_TITLE","BUILDING_NOC","FIRE_SAFETY","FDR_CORPUS","AFFILIATION","STATE_NOC","FACULTY_CADRE","BANK_LETTER","AFFIDAVIT","OTHER"],
  "min_cert_days": 183,
  "max_sfr": 20,
  "prof_divisor": 9,
  "min_sqm_per_student": 5.5,
  "fdr_tenure_years": 10,
  "expiring_soon_days": 180,
  "max_file_bytes": 10485760
}'::jsonb) on conflict (version) do nothing;

-- ------------------------------------------------------------------ helpers (not callable by clients)

create or replace function public._me() returns public.profiles
language sql stable security definer set search_path = public as $$
  select * from public.profiles where id = auth.uid()
$$;

create or replace function public.my_institution_id() returns uuid
language sql stable security definer set search_path = public as $$
  select institution_id from public.profiles where id = auth.uid() and status = 'ACTIVE' and role = 'INSTITUTION'
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'ACTIVE' and role in ('REVIEWER','ADMIN'))
$$;

create or replace function public._is_service() returns boolean
language sql stable as $$
  select auth.uid() is null and current_user in ('postgres','service_role','supabase_admin')
$$;

-- Raise a typed error the client maps to a message. detail carries JSON for validation errors.
create or replace function public._fail(p_code text, p_message text, p_detail jsonb default null) returns void
language plpgsql as $$
begin
  raise exception using message = p_code || ': ' || p_message, detail = coalesce(p_detail::text, ''), errcode = 'P0001';
end $$;

create or replace function public._require_institution() returns public.profiles
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles;
begin
  if auth.uid() is null then perform public._fail('NOT_AUTHENTICATED', 'Sign in to continue.'); end if;
  select * into p from public.profiles where id = auth.uid();
  if not found then perform public._fail('NO_PROFILE', 'No portal profile is linked to this account.'); end if;
  if p.status = 'PENDING_VERIFICATION' then perform public._fail('ACCOUNT_PENDING', 'Your account is awaiting verification by the State DTE / AICTE.'); end if;
  if p.status = 'DISABLED' then perform public._fail('ACCOUNT_DISABLED', 'This account has been disabled. Contact the Regulation Bureau IT Cell.'); end if;
  if p.role <> 'INSTITUTION' then
    perform public._fail('ROLE_MISMATCH', format('Access Denied: This account (%s) is registered as %s and is not authorized for the INSTITUTION portal.', p.full_name, replace(p.role, '_', ' ')));
  end if;
  return p;
end $$;

create or replace function public._require_role(p_roles text[]) returns public.profiles
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid() and status = 'ACTIVE';
  if not found or not (p.role = any(p_roles)) then perform public._fail('FORBIDDEN', 'You are not authorised to perform this action.'); end if;
  return p;
end $$;

create or replace function public._cfg() returns jsonb
language sql stable security definer set search_path = public as $$
  select params from public.rule_config where effective_from <= now() order by effective_from desc limit 1
$$;
create or replace function public._cfg_version() returns text
language sql stable security definer set search_path = public as $$
  select version from public.rule_config where effective_from <= now() order by effective_from desc limit 1
$$;

create or replace function public._audit(p_inst uuid, p_actor uuid, p_actor_name text, p_actor_role text,
  p_action text, p_target_type text, p_target_id text, p_details text) returns void
language plpgsql security definer set search_path = public as $$
declare v_prev text; v_corr text := 'req-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8) || '-' || extract(year from now())::int;
        v_now timestamptz := clock_timestamp();
begin
  perform pg_advisory_xact_lock(hashtext(coalesce(p_inst::text, 'global')));
  select sha256_hash into v_prev from public.audit_events
   where institution_id is not distinct from p_inst order by id desc limit 1;
  insert into public.audit_events(institution_id, correlation_id, actor_id, actor_name, actor_role, action, target_type, target_id, details, ip_address, prev_hash, sha256_hash, created_at)
  values (p_inst, v_corr, p_actor, p_actor_name, p_actor_role, p_action, p_target_type, p_target_id, p_details,
          coalesce(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for', 'server'),
          v_prev,
          encode(sha256(convert_to(concat_ws('|', v_prev, p_action, p_target_type, p_target_id, p_details, p_actor::text, v_now::text), 'UTF8')), 'hex'),
          v_now);
end $$;

create or replace function public._notify(p_inst uuid, p_title text, p_message text, p_type text, p_link jsonb, p_dedupe text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications(institution_id, title, message, type, link, dedupe_key)
  values (p_inst, p_title, p_message, p_type, p_link, p_dedupe)
  on conflict (institution_id, dedupe_key) where dedupe_key is not null do nothing;
end $$;

-- Allowed application status transitions, by actor role.
create or replace function public._transition(p_app uuid, p_to text, p_actor public.profiles, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare v_from text; v_inst uuid; v_ok boolean;
begin
  select status, institution_id into v_from, v_inst from public.applications where id = p_app for update;
  if not found then perform public._fail('NOT_FOUND', 'Application not found.'); end if;
  v_ok := case
    when p_actor.role = 'INSTITUTION' then (v_from, p_to) in (('DEFICIENCIES_NOTED','UNDER_SCRUTINY'), ('UNDER_SCRUTINY','UNDER_SCRUTINY'))
    when p_actor.role = 'REVIEWER' then (v_from, p_to) in (('SUBMITTED','UNDER_SCRUTINY'), ('SUBMITTED','DEFICIENCIES_NOTED'), ('UNDER_SCRUTINY','DEFICIENCIES_NOTED'),
                                                            ('UNDER_SCRUTINY','SCRUTINY_CLEARED'), ('UNDER_SCRUTINY','REJECTED'))
    when p_actor.role = 'ADMIN' then (v_from, p_to) in (('SUBMITTED','UNDER_SCRUTINY'), ('SUBMITTED','DEFICIENCIES_NOTED'), ('UNDER_SCRUTINY','DEFICIENCIES_NOTED'),
                                                         ('UNDER_SCRUTINY','SCRUTINY_CLEARED'), ('UNDER_SCRUTINY','REJECTED'),
                                                         ('SCRUTINY_CLEARED','APPROVED'), ('SCRUTINY_CLEARED','REJECTED'))
    else false end;
  if not v_ok then perform public._fail('INVALID_TRANSITION', format('Status change %s → %s is not permitted for %s.', v_from, p_to, p_actor.role)); end if;
  update public.applications set status = p_to, last_updated_at = now() where id = p_app;
  insert into public.status_history(application_id, institution_id, from_status, to_status, actor_id, actor_role, note)
  values (p_app, v_inst, v_from, p_to, p_actor.id, p_actor.role, p_note);
end $$;

create or replace function public._valid_file(f jsonb, p_inst uuid, p_cfg jsonb) returns text
language plpgsql stable security definer set search_path = public as $$
declare v_path text := f->>'storagePath'; v_exists boolean;
begin
  if coalesce(f->>'fileName', '') = '' then return 'File name missing'; end if;
  if coalesce(f->>'fileHash', '') !~ '^[0-9a-f]{64}$' then return 'Invalid SHA-256 fingerprint'; end if;
  if coalesce((f->>'fileSizeBytes')::bigint, 0) <= 0 then return 'Empty file'; end if;
  if (f->>'fileSizeBytes')::bigint > (p_cfg->>'max_file_bytes')::bigint then return 'File exceeds 10 MB'; end if;
  if coalesce(f->>'mimeType', '') not in ('application/pdf','image/jpeg','image/png') then return 'Only PDF, JPG or PNG files are accepted'; end if;
  if coalesce(v_path, '') = '' or split_part(v_path, '/', 1) <> p_inst::text then return 'File is not stored in your institution''s document folder'; end if;
  if to_regclass('storage.objects') is not null then
    execute 'select exists(select 1 from storage.objects where bucket_id = $1 and name = $2)' into v_exists using 'institution-documents', v_path;
    if not v_exists then return 'Upload incomplete — file not found in storage'; end if;
  end if;
  return null;
end $$;

-- ------------------------------------------------------------------ deterministic rule engine

create or replace function public._evaluate(p_inst public.institutions, p_intake jsonb, p_fdr jsonb, p_docs jsonb, p_exclude_app uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cfg jsonb := public._cfg(); ver text := public._cfg_version();
  out jsonb := '[]'::jsonb;
  v_missing text[]; v_doc jsonb; v_left int; v_exp text[] := '{}'; v_soon text[] := '{}'; v_undated text[] := '{}'; v_has_expiry boolean := false;
  v_hit record; v_hits text[] := '{}'; v_internal text[] := '{}'; v_filings bigint;
  st int; p int; a int; s int; fac int; area numeric; req_fac int; req_p int; req_a int; req_area int; sfr numeric;
  req_lakhs numeric := p_inst.required_fdr_lakhs; amt_lakhs numeric; issues text[] := '{}';
  function_rule text;
begin
  -- RULE-CHECKLIST-01
  if p_docs is not null then
    select array_agg(m) into v_missing from jsonb_array_elements_text(cfg->'mandatory_docs') m
     where not exists (select 1 from jsonb_array_elements(p_docs) d where d->>'docType' = m and coalesce((d->>'fileSizeBytes')::bigint, 0) > 0);
    out := out || jsonb_build_object('ruleCode','RULE-CHECKLIST-01','ruleName','Mandatory Document Completeness','handbookClause','Clause 2.4.1 (Mandatory Submissions)',
      'severity', case when v_missing is null then 'PASSED' else 'CRITICAL' end,
      'description', case when v_missing is null then 'All 7 mandatory statutory categories have been provided with non-zero byte size.'
                          else format('%s of 7 mandatory documents provided. Missing: %s.', 7 - cardinality(v_missing), array_to_string(v_missing, ', ')) end);

    -- RULE-EXPIRY-02
    for v_doc in select * from jsonb_array_elements(p_docs) loop
      if (cfg->'expiry_docs') ? (v_doc->>'docType') then
        v_has_expiry := true;
        if coalesce(v_doc->>'validTill', '') = '' then v_undated := v_undated || (v_doc->>'docType');
        else
          v_left := (v_doc->>'validTill')::date - current_date;
          if v_left < 0 then v_exp := v_exp || format('%s expired on %s', v_doc->>'docType', v_doc->>'validTill');
          elsif v_left < (cfg->>'min_cert_days')::int then v_soon := v_soon || format('%s expires on %s', v_doc->>'docType', v_doc->>'validTill'); end if;
        end if;
      end if;
    end loop;
    if v_has_expiry then
      out := out || jsonb_build_object('ruleCode','RULE-EXPIRY-02','ruleName','Statutory Certificate Expiry Verification','handbookClause','Clause 3.1.2 (Validity of Approvals)',
        'severity', case when cardinality(v_exp) > 0 then 'CRITICAL' when cardinality(v_soon) + cardinality(v_undated) > 0 then 'WARNING' else 'PASSED' end,
        'description', case when cardinality(v_exp) > 0 then array_to_string(v_exp, '; ') || '. A valid certificate is mandatory for the academic session.'
                            when cardinality(v_soon) + cardinality(v_undated) > 0 then trim(
                              case when cardinality(v_soon) > 0 then array_to_string(v_soon, '; ') || ', within 6 months — renewal application or receipt must be submitted. ' else '' end ||
                              case when cardinality(v_undated) > 0 then 'Validity date not declared for: ' || array_to_string(v_undated, ', ') || '.' else '' end)
                            else 'All statutory certificates remain valid for at least 6 months.' end);
    end if;

    -- RULE-DUPLICATE-HASH-04 (authoritative: sees every institution's filings)
    for v_hit in
      select d->>'docType' as doc_type, d->>'fileHash' as h, ap.application_number, i.name as inst_name
        from jsonb_array_elements(p_docs) d
        join public.application_documents ad on ad.file_hash = d->>'fileHash'
        join public.applications ap on ap.id = ad.application_id
        join public.institutions i on i.id = ap.institution_id
       where ap.institution_id <> p_inst.id and (p_exclude_app is null or ap.id <> p_exclude_app)
    loop
      v_hits := v_hits || format('%s (%s…) is byte-for-byte identical to a document filed in %s (%s)', v_hit.doc_type, left(v_hit.h, 8), v_hit.application_number, v_hit.inst_name);
    end loop;
    select array_agg(distinct d->>'docType') into v_internal from jsonb_array_elements(p_docs) d
     where (select count(*) from jsonb_array_elements(p_docs) d2 where d2->>'fileHash' = d->>'fileHash') > 1;
    select count(*) into v_filings from public.application_documents;
    out := out || jsonb_build_object('ruleCode','RULE-DUPLICATE-HASH-04','ruleName','Cross-Application SHA-256 Duplicate Collision','handbookClause','Clause 4.8.1 (Document Authenticity & Forensics)',
      'severity', case when cardinality(v_hits) > 0 then 'CRITICAL' when v_internal is not null then 'WARNING' else 'PASSED' end,
      'description', case when cardinality(v_hits) > 0 then 'SHA-256 fingerprint collision detected: ' || array_to_string(v_hits, '; ') || '.'
                          when v_internal is not null then 'The same file was uploaded under multiple categories: ' || array_to_string(v_internal, ', ') || '.'
                          else format('Zero duplicate SHA-256 hash collisions found across %s institutional filings on record.', v_filings) end,
      'evidenceSnippet', case when cardinality(v_hits) > 0 then v_hits[1] end);
  end if;

  -- RULE-CADRE-RATIO-05 / RULE-BUILTUP-AREA-06
  st := coalesce((p_intake->>'totalStudents')::int, 0);
  p := coalesce((p_intake->>'professors')::int, 0); a := coalesce((p_intake->>'associateProfessors')::int, 0); s := coalesce((p_intake->>'assistantProfessors')::int, 0);
  fac := p + a + s; area := coalesce((p_intake->>'totalBuiltUpAreaSqM')::numeric, 0);
  if fac > 0 and st > 0 then
    req_fac := ceil(st / (cfg->>'max_sfr')::numeric); req_p := floor(req_fac / (cfg->>'prof_divisor')::numeric); req_a := floor(req_fac * 2 / (cfg->>'prof_divisor')::numeric);
    sfr := round(st::numeric / fac, 1);
    out := out || jsonb_build_object('ruleCode','RULE-CADRE-RATIO-05','ruleName','Faculty-Student & Cadre Ratio Compliance','handbookClause','Appendix 7 (Norms for Faculty Cadre Ratio 1:2:6)',
      'severity', case when st::numeric / fac > (cfg->>'max_sfr')::numeric or p < req_p then 'CRITICAL' when a < req_a then 'WARNING' else 'PASSED' end,
      'description', case when st::numeric / fac > (cfg->>'max_sfr')::numeric or p < req_p
                            then format('For %s students, required faculty is %s with %s Professors. Institution declares %s faculty and %s Professors (SFR 1:%s).', st, req_fac, req_p, fac, p, sfr)
                          when a < req_a then format('SFR 1:%s is within norm, but Associate Professor count %s is below the required %s for the 1:2:6 cadre ratio.', sfr, a, req_a)
                          else format('Calculated SFR is 1:%s (norm <= 1:20). Cadre distribution %s : %s : %s fulfills AICTE 1:2:6 ratio norm.', sfr, p, a, s) end);
    if area > 0 then
      req_area := ceil(st * (cfg->>'min_sqm_per_student')::numeric);
      out := out || jsonb_build_object('ruleCode','RULE-BUILTUP-AREA-06','ruleName','Instructional & Administrative Area Norms','handbookClause','Appendix 4 (Norms for Land and Built-Up Area)',
        'severity', case when area >= req_area then 'PASSED' else 'WARNING' end,
        'description', format('Built-up carpet area %s sq.m %s the required %s sq.m (%s sq.m per student).', area, case when area >= req_area then 'meets' else 'is short of' end, req_area, cfg->>'min_sqm_per_student'));
    end if;
  end if;

  -- RULE-FDR-CORPUS-07
  if p_fdr is not null then
    amt_lakhs := (p_fdr->>'amount')::numeric / 100000;
    if amt_lakhs < req_lakhs then issues := issues || format('deposit ₹%s Lakhs is below required corpus ₹%s Lakhs', amt_lakhs, req_lakhs); end if;
    if (p_fdr->>'maturityDate')::date < ((p_fdr->>'issueDate')::date + make_interval(years => (cfg->>'fdr_tenure_years')::int) - interval '1 day')::date then
      issues := issues || 'tenure is less than the mandatory 10-year lock-in'::text; end if;
    if (p_fdr->>'maturityDate')::date <= current_date then issues := issues || format('FDR matured on %s', p_fdr->>'maturityDate'); end if;
    if coalesce(p_fdr->>'jointLienHolder', '') !~* 'AICTE' then issues := issues || 'joint lien is not in favour of Regional Officer, AICTE'::text; end if;
    out := out || jsonb_build_object('ruleCode','RULE-FDR-CORPUS-07','ruleName','Joint FDR Corpus Fund & Lien Status','handbookClause','Clause 6.2 (Security Deposit & Corpus Fund)',
      'severity', case when cardinality(issues) > 0 then 'CRITICAL' when not coalesce((p_fdr->>'isLienConfirmed')::boolean, false) then 'WARNING' else 'PASSED' end,
      'description', case when cardinality(issues) > 0 then format('FDR %s: %s.', p_fdr->>'fdrNumber', array_to_string(issues, '; '))
                          when not coalesce((p_fdr->>'isLienConfirmed')::boolean, false) then format('FDR %s meets corpus and tenure norms; joint lien awaiting bank CBS endorsement.', p_fdr->>'fdrNumber')
                          else format('FDR %s is under joint lien with %s, maturing %s.', p_fdr->>'fdrNumber', p_fdr->>'jointLienHolder', p_fdr->>'maturityDate') end);
  end if;

  return (select coalesce(jsonb_agg(f || jsonb_build_object('ruleVersion', ver, 'isDeterministic', true)), '[]'::jsonb) from jsonb_array_elements(out) f);
end $$;

-- Validate the deposit block of a submission. Returns the normalised FDR json (existing or new) and appends field errors.
create or replace function public._check_fdr(p_inst public.institutions, p jsonb, inout errs jsonb, out fdr jsonb)
language plpgsql stable security definer set search_path = public as $$
declare r public.fdrs;
begin
  if coalesce(p->>'mode', 'existing') = 'existing' then
    select * into r from public.fdrs where id = nullif(p->>'existingId', '')::uuid and institution_id = p_inst.id and not released;
    if not found then errs := errs || jsonb_build_object('fdr.existingId', 'Select an active FDR of your institution'); return; end if;
    fdr := jsonb_build_object('id', r.id, 'fdrNumber', r.fdr_number, 'amount', r.amount, 'issueDate', r.issue_date, 'maturityDate', r.maturity_date,
                              'jointLienHolder', r.joint_lien_holder, 'isLienConfirmed', r.is_lien_confirmed);
    return;
  end if;
  if coalesce(p->>'fdrNumber', '') !~* '^[A-Z0-9][A-Z0-9/-]{5,}$' then errs := errs || '{"fdr.fdrNumber":"Enter a valid FDR / TDR number"}';
  elsif exists (select 1 from public.fdrs where fdr_number = upper(p->>'fdrNumber')) then errs := errs || '{"fdr.fdrNumber":"This FDR number is already registered"}'; end if;
  if coalesce(trim(p->>'bankName'), '') = '' then errs := errs || '{"fdr.bankName":"Bank is required"}'; end if;
  if coalesce(trim(p->>'branchName'), '') = '' then errs := errs || '{"fdr.branchName":"Branch name is required"}'; end if;
  if upper(coalesce(p->>'ifscCode', '')) !~ '^[A-Z]{4}0[A-Z0-9]{6}$' then errs := errs || '{"fdr.ifscCode":"IFSC must be 11 characters, e.g. SBIN0001234"}'; end if;
  if coalesce((p->>'amount')::numeric, 0) <= 0 then errs := errs || '{"fdr.amountRs":"Enter the deposit amount"}'; end if;
  if coalesce(p->>'issueDate', '') = '' then errs := errs || '{"fdr.issueDate":"Issue date is required"}';
  elsif (p->>'issueDate')::date > current_date then errs := errs || '{"fdr.issueDate":"Issue date cannot be in the future"}'; end if;
  if coalesce(p->>'maturityDate', '') = '' then errs := errs || '{"fdr.maturityDate":"Maturity date is required"}';
  elsif coalesce(p->>'issueDate', '') <> '' and (p->>'maturityDate')::date <= (p->>'issueDate')::date then errs := errs || '{"fdr.maturityDate":"Maturity must be after issue date"}'; end if;
  fdr := jsonb_build_object('fdrNumber', upper(p->>'fdrNumber'), 'amount', (p->>'amount')::numeric, 'issueDate', p->>'issueDate', 'maturityDate', p->>'maturityDate',
                            'bankName', p->>'bankName', 'branchName', p->>'branchName', 'ifscCode', upper(p->>'ifscCode'),
                            'jointLienHolder', format('Regional Officer, %s Regional Office, AICTE', p_inst.region), 'isLienConfirmed', false);
exception when invalid_datetime_format or datetime_field_overflow or invalid_text_representation then
  errs := errs || '{"fdr":"Invalid date or amount format"}';
end $$;

-- ------------------------------------------------------------------ institution RPCs

-- Validate (dry run) or submit an application. Idempotent on p_idempotency_key.
create or replace function public.submit_application(p_payload jsonb, p_idempotency_key uuid, p_dry_run boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me public.profiles := public._require_institution();
  inst public.institutions; cfg jsonb := public._cfg(); errs jsonb := '{}'::jsonb; v_fdr jsonb; v_fdr_id uuid;
  v_type text := p_payload->>'type'; v_prog jsonb := coalesce(p_payload->'prog', '{}'::jsonb); v_intake jsonb;
  v_docs jsonb := coalesce(p_payload->'docs', '[]'::jsonb); v_doc jsonb; v_err text; v_findings jsonb; v_app public.applications;
  v_prefix text; v_no text; v_id uuid; v_crit int; v_warn int; v_server_dup jsonb;
begin
  select * into inst from public.institutions where id = me.institution_id;
  if not p_dry_run then
    if p_idempotency_key is null then perform public._fail('VALIDATION', 'Missing idempotency key.'); end if;
    select * into v_app from public.applications where idempotency_key = p_idempotency_key;
    if found then
      if v_app.institution_id <> inst.id then perform public._fail('FORBIDDEN', 'Idempotency key belongs to another institution.'); end if;
      return jsonb_build_object('applicationId', v_app.id, 'applicationNumber', v_app.application_number, 'status', v_app.status, 'replayed', true);
    end if;
  end if;

  -- field validation (mirrors the client, but authoritative)
  if v_type is null or v_type not in ('NEW_PROGRAMME','EOA','INFRASTRUCTURE_UPDATE','INTAKE_VARIATION','CLOSURE') then errs := errs || '{"type":"Unknown application type"}'; end if;
  if coalesce(p_payload->'inst'->>'academicYear', '') !~ '^\d{4}-\d{2}$' then errs := errs || '{"inst.academicYear":"Invalid academic year"}'; end if;
  if coalesce(trim(p_payload->'inst'->>'address'), '') = '' then errs := errs || '{"inst.address":"Address is required"}'; end if;
  begin
    v_intake := jsonb_build_object(
      'currentTotalIntake', (v_prog->>'currentTotalIntake')::int, 'proposedTotalIntake', (v_prog->>'proposedTotalIntake')::int,
      'totalStudents', (v_prog->>'totalStudents')::int, 'professors', (v_prog->>'professors')::int,
      'associateProfessors', (v_prog->>'associateProfessors')::int, 'assistantProfessors', (v_prog->>'assistantProfessors')::int,
      'totalBuiltUpAreaSqM', (v_prog->>'totalBuiltUpAreaSqM')::numeric);
  exception when others then errs := errs || '{"prog":"Intake, faculty and area must be whole numbers"}'; v_intake := '{}'::jsonb;
  end;
  if exists (select 1 from jsonb_each_text(v_intake) e where e.value is null or e.value::numeric < 0) then errs := errs || '{"prog":"Intake, faculty and area are required and cannot be negative"}'; end if;
  if coalesce((v_intake->>'professors')::int, 0) + coalesce((v_intake->>'associateProfessors')::int, 0) + coalesce((v_intake->>'assistantProfessors')::int, 0) = 0 then
    errs := errs || '{"prog.assistantProfessors":"Total faculty cannot be zero"}'; end if;
  if v_type in ('NEW_PROGRAMME','INTAKE_VARIATION') and coalesce(trim(v_prog->>'programme'), '') = '' then errs := errs || '{"prog.programme":"Programme name is required"}'; end if;
  if v_type = 'INFRASTRUCTURE_UPDATE' and coalesce(trim(v_prog->>'changeDetails'), '') = '' then errs := errs || '{"prog.changeDetails":"Describe the requested change"}'; end if;
  if v_type = 'CLOSURE' and (coalesce(trim(v_prog->>'closureReason'), '') = '' or coalesce((v_prog->>'liabilitiesCleared')::boolean, false) = false) then
    errs := errs || '{"prog.closureReason":"Closure reason and liabilities confirmation are mandatory"}'; end if;

  select c.errs, c.fdr into errs, v_fdr from public._check_fdr(inst, coalesce(p_payload->'fdr', '{}'::jsonb), errs) c;

  if jsonb_typeof(v_docs) <> 'array' then errs := errs || '{"docs":"Documents must be a list"}'; v_docs := '[]'::jsonb; end if;
  for v_doc in select * from jsonb_array_elements(v_docs) loop
    if not ((cfg->'allowed_docs') ? (v_doc->>'docType')) then errs := errs || jsonb_build_object('docs.' || coalesce(v_doc->>'docType', '?'), 'Unknown document category'); continue; end if;
    v_err := public._valid_file(v_doc, inst.id, cfg);
    if v_err is not null then errs := errs || jsonb_build_object('docs.' || (v_doc->>'docType'), v_err); end if;
  end loop;
  if (select count(*) from jsonb_array_elements(v_docs)) <> (select count(distinct d->>'docType') from jsonb_array_elements(v_docs) d) then
    errs := errs || '{"docs":"Each document category can be uploaded once"}'; end if;

  if not p_dry_run then
    if coalesce((p_payload->>'declared')::boolean, false) = false then errs := errs || '{"declared":"The declaration must be accepted"}'; end if;
    if coalesce(p_payload->'esign'->>'ref', '') = '' then errs := errs || '{"esign":"e-Sign is required before submission"}'; end if;
  end if;

  if errs <> '{}'::jsonb then perform public._fail('VALIDATION', 'Please correct the highlighted fields.', errs); end if;

  v_findings := public._evaluate(inst, v_intake, v_fdr, v_docs);
  if p_dry_run then return jsonb_build_object('findings', v_findings, 'ruleVersion', public._cfg_version()); end if;

  -- persist
  if p_payload->'fdr'->>'mode' = 'new' then
    insert into public.fdrs(institution_id, fdr_number, amount, bank_name, branch_name, ifsc_code, issue_date, maturity_date, joint_lien_holder)
    values (inst.id, v_fdr->>'fdrNumber', (v_fdr->>'amount')::numeric, v_fdr->>'bankName', v_fdr->>'branchName', v_fdr->>'ifscCode',
            (v_fdr->>'issueDate')::date, (v_fdr->>'maturityDate')::date, v_fdr->>'jointLienHolder')
    returning id into v_fdr_id;
  else v_fdr_id := (v_fdr->>'id')::uuid; end if;

  v_prefix := case v_type when 'NEW_PROGRAMME' then 'NEW' when 'EOA' then 'EOA' when 'INFRASTRUCTURE_UPDATE' then 'INFRA' when 'INTAKE_VARIATION' then 'INTAKE' else 'CLOSURE' end;
  v_no := format('APP-%s-%s-%s', extract(year from now())::int, v_prefix, lpad(nextval('public.application_seq')::text, 5, '0'));
  v_intake := v_intake || jsonb_build_object('facultyCount', (v_intake->>'professors')::int + (v_intake->>'associateProfessors')::int + (v_intake->>'assistantProfessors')::int,
                                             'fdrCorpusAmountLakhs', (v_fdr->>'amount')::numeric / 100000, 'requiredFdrAmountLakhs', inst.required_fdr_lakhs);

  insert into public.applications(application_number, institution_id, type, status, academic_year, programme, institution_snapshot, intake_details,
         fdr_id, fdr_number, ai_summary, ai_findings, cross_checks, esign, declaration, rule_version, idempotency_key, submitted_by)
  values (v_no, inst.id, v_type, 'SUBMITTED', p_payload->'inst'->>'academicYear', v_prog, coalesce(p_payload->'inst', '{}'::jsonb), v_intake,
         v_fdr_id, v_fdr->>'fdrNumber', left(p_payload->>'aiSummary', 4000), coalesce(p_payload->'aiFindings', '[]'::jsonb),
         coalesce(p_payload->'crossChecks', '[]'::jsonb), p_payload->'esign', true, public._cfg_version(), p_idempotency_key, me.id)
  returning id into v_id;
  update public.fdrs set application_number = coalesce(application_number, v_no) where id = v_fdr_id;

  v_server_dup := (select f from jsonb_array_elements(v_findings) f where f->>'ruleCode' = 'RULE-DUPLICATE-HASH-04');
  insert into public.application_documents(application_id, institution_id, doc_type, file_name, file_size_bytes, mime_type, file_hash, storage_path, page_count,
         valid_till, status, extracted_fields, forensics, ai_analysis, uploaded_by)
  select v_id, inst.id, d->>'docType', d->>'fileName', (d->>'fileSizeBytes')::bigint, d->>'mimeType', d->>'fileHash', d->>'storagePath',
         greatest(coalesce((d->>'pageCount')::int, 1), 1), nullif(d->>'validTill', '')::date,
         case when exists (select 1 from public.application_documents ad join public.applications ap on ap.id = ad.application_id
                            where ad.file_hash = d->>'fileHash' and ap.institution_id <> inst.id)
                or coalesce(d->>'clientStatus', 'ok') <> 'ok' then 'FLAGGED' else 'PROCESSED' end,
         coalesce(d->'extractedFields', '[]'::jsonb),
         coalesce(d->'forensics', '{}'::jsonb) || jsonb_build_object('serverDuplicateCheck', v_server_dup->>'severity'),
         d->'aiAnalysis', me.id
    from jsonb_array_elements(v_docs) d;

  insert into public.findings(application_id, rule_code, rule_name, severity, description, handbook_clause, evidence_snippet, rule_version, is_deterministic)
  select v_id, f->>'ruleCode', f->>'ruleName', f->>'severity', f->>'description', f->>'handbookClause', f->>'evidenceSnippet', f->>'ruleVersion', true
    from jsonb_array_elements(v_findings) f;

  insert into public.status_history(application_id, institution_id, from_status, to_status, actor_id, actor_role, note)
  values (v_id, inst.id, null, 'SUBMITTED', me.id, 'INSTITUTION', 'Submitted with e-Sign ' || (p_payload->'esign'->>'ref'));

  if nullif(p_payload->>'draftId', '') is not null then
    delete from public.application_drafts where id = (p_payload->>'draftId')::uuid and institution_id = inst.id;
  end if;

  select count(*) filter (where f->>'severity' = 'CRITICAL'), count(*) filter (where f->>'severity' = 'WARNING')
    into v_crit, v_warn from jsonb_array_elements(v_findings) f;

  if p_payload->'fdr'->>'mode' = 'new' then
    perform public._audit(inst.id, me.id, me.full_name, 'INSTITUTION', 'FDR_SUBMITTED', 'FDR', v_fdr->>'fdrNumber',
      format('New FDR %s (₹%s) submitted with %s; awaiting bank CBS joint lien endorsement.', v_fdr->>'fdrNumber', v_fdr->>'amount', v_no));
  end if;
  perform public._audit(inst.id, me.id, me.full_name, 'INSTITUTION', 'ESIGN_COMPLETED', 'APPLICATION', v_no, 'Declaration e-signed. Ref ' || (p_payload->'esign'->>'ref'));
  perform public._audit(inst.id, me.id, me.full_name, 'INSTITUTION', 'DOCUMENT_UPLOAD', 'APPLICATION', v_no,
    format('Uploaded %s document(s): %s.', jsonb_array_length(v_docs), (select string_agg(format('%s (SHA-256 %s...)', d->>'docType', left(d->>'fileHash', 8)), ', ') from jsonb_array_elements(v_docs) d)));
  perform public._audit(inst.id, null, 'AICTE Rule Engine ' || public._cfg_version(), 'SYSTEM', 'DETERMINISTIC_EVALUATION', 'APPLICATION', v_no,
    format('Evaluated %s deterministic rules: %s passed, %s warning(s), %s critical.', jsonb_array_length(v_findings), jsonb_array_length(v_findings) - v_crit - v_warn, v_warn, v_crit));
  perform public._audit(inst.id, me.id, me.full_name, 'INSTITUTION', 'APPLICATION_SUBMITTED', 'APPLICATION', v_no, format('Submitted %s for AY %s.', v_type, p_payload->'inst'->>'academicYear'));
  perform public._notify(inst.id, 'Application Submitted Successfully', format('%s has been submitted to AICTE and queued for Regional Scrutiny.', v_no), 'SUCCESS',
    jsonb_build_object('route', 'appDetail', 'id', v_id));
  if v_crit > 0 then
    perform public._notify(inst.id, 'Rule engine flagged critical findings', format('%s critical finding(s) on %s will be reviewed by the Scrutiny Committee.', v_crit, v_no), 'WARNING',
      jsonb_build_object('route', 'appDetail', 'id', v_id));
  end if;

  return jsonb_build_object('applicationId', v_id, 'applicationNumber', v_no, 'status', 'SUBMITTED', 'findings', v_findings, 'replayed', false);
exception when unique_violation then
  -- concurrent retry with the same idempotency key
  select * into v_app from public.applications where idempotency_key = p_idempotency_key and institution_id = inst.id;
  if found then return jsonb_build_object('applicationId', v_app.id, 'applicationNumber', v_app.application_number, 'status', v_app.status, 'replayed', true); end if;
  raise;
end $$;

create or replace function public.save_draft(p_id uuid, p_type text, p_payload jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public._require_institution(); v_id uuid;
begin
  if p_type not in ('NEW_PROGRAMME','EOA','INFRASTRUCTURE_UPDATE','INTAKE_VARIATION','CLOSURE') then perform public._fail('VALIDATION', 'Unknown application type.'); end if;
  if pg_column_size(p_payload) > 512000 then perform public._fail('VALIDATION', 'Draft is too large.'); end if;
  if p_id is not null then
    update public.application_drafts set payload = p_payload, type = p_type, updated_at = now()
     where id = p_id and institution_id = me.institution_id returning id into v_id;
  end if;
  if v_id is null then
    insert into public.application_drafts(id, institution_id, user_id, type, payload)
    values (coalesce(p_id, gen_random_uuid()), me.institution_id, me.id, p_type, p_payload) returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.delete_draft(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public._require_institution();
begin
  delete from public.application_drafts where id = p_id and institution_id = me.institution_id;
end $$;

create or replace function public.submit_compliance_response(p_application_id uuid, p_responses jsonb, p_files jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public._require_institution(); a public.applications; sc public.scrutiny; f jsonb; v_err text; v_ver int;
begin
  select * into a from public.applications where id = p_application_id and institution_id = me.institution_id for update;
  if not found then perform public._fail('NOT_FOUND', 'Application not found.'); end if;
  select * into sc from public.scrutiny where application_id = a.id;
  if not found or cardinality(sc.deficiency_points) = 0 then perform public._fail('INVALID_STATE', 'There is no open query on this application.'); end if;
  if sc.status = 'RESPONSE_SUBMITTED' then perform public._fail('INVALID_STATE', 'A response has already been submitted and is under review.'); end if;
  if jsonb_typeof(p_responses) <> 'array' or jsonb_array_length(p_responses) <> cardinality(sc.deficiency_points)
     or exists (select 1 from jsonb_array_elements(p_responses) r where length(trim(coalesce(r->>'response', ''))) < 5) then
    perform public._fail('VALIDATION', 'Respond to every point (at least a short sentence each).');
  end if;
  for f in select * from jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) loop
    v_err := public._valid_file(f, me.institution_id, public._cfg());
    if v_err is not null then perform public._fail('VALIDATION', format('%s: %s', f->>'fileName', v_err)); end if;
  end loop;
  v_ver := a.current_version + 1;
  perform public._transition(a.id, 'UNDER_SCRUTINY', me, format('Compliance response v%s', v_ver));
  update public.applications set current_version = v_ver, last_updated_at = now() where id = a.id;
  update public.scrutiny set status = 'RESPONSE_SUBMITTED', updated_at = now() where application_id = a.id;
  insert into public.compliance_responses(application_id, institution_id, version, points, files, submitted_by)
  values (a.id, me.institution_id, v_ver, p_responses, coalesce(p_files, '[]'::jsonb), me.id);
  perform public._audit(me.institution_id, me.id, me.full_name, 'INSTITUTION', 'COMPLIANCE_RESPONSE_SUBMITTED', 'APPLICATION', a.application_number,
    format('Compliance response v%s submitted for %s point(s) with %s attachment(s).', v_ver, jsonb_array_length(p_responses), jsonb_array_length(coalesce(p_files, '[]'::jsonb))));
  perform public._notify(me.institution_id, 'Compliance response submitted', format('%s v%s is back with the Regional Scrutiny Committee.', a.application_number, v_ver), 'SUCCESS',
    jsonb_build_object('route', 'appDetail', 'id', a.id));
  return jsonb_build_object('applicationId', a.id, 'version', v_ver);
end $$;

create or replace function public.submit_fdr(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public._require_institution(); inst public.institutions; errs jsonb := '{}'::jsonb; v_fdr jsonb; v_err text; v_id uuid; cfg jsonb := public._cfg();
begin
  select * into inst from public.institutions where id = me.institution_id;
  select c.errs, c.fdr into errs, v_fdr from public._check_fdr(inst, p || '{"mode":"new"}'::jsonb, errs) c;
  if errs = '{}'::jsonb and (v_fdr->>'maturityDate')::date < ((v_fdr->>'issueDate')::date + make_interval(years => (cfg->>'fdr_tenure_years')::int) - interval '1 day')::date then
    errs := errs || '{"fdr.maturityDate":"Tenure must be 10 years"}'; end if;
  v_err := public._valid_file(coalesce(p->'evidence', '{}'::jsonb), inst.id, cfg);
  if v_err is not null then errs := errs || jsonb_build_object('file', 'FDR advice: ' || v_err); end if;
  if errs <> '{}'::jsonb then perform public._fail('VALIDATION', 'Please correct the highlighted fields.', errs); end if;
  insert into public.fdrs(institution_id, fdr_number, application_number, amount, bank_name, branch_name, ifsc_code, issue_date, maturity_date, joint_lien_holder, evidence)
  values (inst.id, v_fdr->>'fdrNumber', nullif(p->>'applicationNumber', ''), (v_fdr->>'amount')::numeric, v_fdr->>'bankName', v_fdr->>'branchName', v_fdr->>'ifscCode',
          (v_fdr->>'issueDate')::date, (v_fdr->>'maturityDate')::date, v_fdr->>'jointLienHolder', p->'evidence')
  returning id into v_id;
  perform public._audit(inst.id, me.id, me.full_name, 'INSTITUTION', 'FDR_SUBMITTED', 'FDR', v_fdr->>'fdrNumber',
    format('Uploaded FDR evidence %s (SHA-256 %s...) for ₹%s; awaiting bank CBS joint lien endorsement.', p->'evidence'->>'fileName', left(p->'evidence'->>'fileHash', 8), v_fdr->>'amount'));
  perform public._notify(inst.id, 'New FDR submitted', format('%s is awaiting %s CBS joint lien confirmation.', v_fdr->>'fdrNumber', v_fdr->>'bankName'), 'INFO',
    jsonb_build_object('route', 'fdrDetail', 'id', v_id));
  return jsonb_build_object('fdrId', v_id);
end $$;

create or replace function public.request_fdr_renewal(p_fdr_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public._require_institution(); f public.fdrs; v_mode text := coalesce(p->>'mode', 'extension'); errs jsonb := '{}'::jsonb; v_req uuid;
begin
  select * into f from public.fdrs where id = p_fdr_id and institution_id = me.institution_id for update;
  if not found or f.released then perform public._fail('NOT_FOUND', 'FDR not found or already released.'); end if;
  if exists (select 1 from public.fdr_requests where fdr_id = f.id and status = 'PENDING') then perform public._fail('INVALID_STATE', 'A request for this FDR is already pending.'); end if;
  if coalesce(p->>'maturityDate', '') = '' then errs := errs || '{"maturityDate":"Maturity date is required"}';
  elsif f.maturity_date > current_date and (p->>'maturityDate')::date <= f.maturity_date then errs := errs || '{"maturityDate":"Must be later than the current maturity date"}'; end if;
  if v_mode = 'replacement' then
    if coalesce(p->>'fdrNumber', '') !~* '^[A-Z0-9][A-Z0-9/-]{5,}$' then errs := errs || '{"fdrNumber":"Enter a valid FDR number"}';
    elsif exists (select 1 from public.fdrs where fdr_number = upper(p->>'fdrNumber')) then errs := errs || '{"fdrNumber":"This FDR number is already registered"}'; end if;
    if coalesce(trim(p->>'branchName'), '') = '' then errs := errs || '{"branchName":"Branch is required"}'; end if;
    if upper(coalesce(p->>'ifscCode', '')) !~ '^[A-Z]{4}0[A-Z0-9]{6}$' then errs := errs || '{"ifscCode":"Invalid IFSC"}'; end if;
    if coalesce((p->>'amount')::numeric, 0) < f.amount then errs := errs || jsonb_build_object('amountRs', format('Must be at least ₹%s', f.amount)); end if;
  elsif v_mode <> 'extension' then errs := errs || '{"mode":"Unknown request type"}'; end if;
  if errs <> '{}'::jsonb then perform public._fail('VALIDATION', 'Please correct the highlighted fields.', errs); end if;
  insert into public.fdr_requests(fdr_id, institution_id, kind, payload, requested_by)
  values (f.id, me.institution_id, case when v_mode = 'replacement' then 'REPLACEMENT' else 'RENEWAL' end, p, me.id) returning id into v_req;
  update public.fdrs set renewal_status = case when v_mode = 'replacement' then 'REPLACEMENT_SUBMITTED' else 'RENEWAL_SUBMITTED' end, updated_at = now() where id = f.id;
  perform public._audit(me.institution_id, me.id, me.full_name, 'INSTITUTION', case when v_mode = 'replacement' then 'FDR_REPLACEMENT_REQUESTED' else 'FDR_RENEWAL_REQUESTED' end,
    'FDR', f.fdr_number, format('%s requested for %s; proposed maturity %s.', initcap(v_mode), f.fdr_number, p->>'maturityDate'));
  perform public._notify(me.institution_id, case when v_mode = 'replacement' then 'FDR replacement submitted' else 'FDR renewal submitted' end,
    format('%s request for %s is awaiting bank CBS endorsement and AICTE approval.', initcap(v_mode), f.fdr_number), 'INFO', jsonb_build_object('route', 'fdrDetail', 'id', f.id));
  return jsonb_build_object('requestId', v_req);
end $$;

create or replace function public.request_lien_release(p_fdr_id uuid, p_reason text, p_certified boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public._require_institution(); f public.fdrs; v_req uuid;
begin
  select * into f from public.fdrs where id = p_fdr_id and institution_id = me.institution_id for update;
  if not found or f.released then perform public._fail('NOT_FOUND', 'FDR not found or already released.'); end if;
  if f.maturity_date > current_date then perform public._fail('INVALID_STATE', 'Lien release is only possible after the 10-year lock-in matures.'); end if;
  if not f.is_lien_confirmed then perform public._fail('INVALID_STATE', 'The joint lien was never endorsed by the bank.'); end if;
  if exists (select 1 from public.fdr_requests where fdr_id = f.id and status = 'PENDING') then perform public._fail('INVALID_STATE', 'A request for this FDR is already pending.'); end if;
  if length(trim(coalesce(p_reason, ''))) < 10 then perform public._fail('VALIDATION', 'State the statutory grounds for release.', '{"reason":"State the statutory grounds"}'); end if;
  if not coalesce(p_certified, false) then perform public._fail('VALIDATION', 'Certification is required.', '{"certify":"Certification is required"}'); end if;
  insert into public.fdr_requests(fdr_id, institution_id, kind, reason, requested_by) values (f.id, me.institution_id, 'RELEASE', trim(p_reason), me.id) returning id into v_req;
  perform public._audit(me.institution_id, me.id, me.full_name, 'INSTITUTION', 'FDR_LIEN_RELEASE_REQUESTED', 'FDR', f.fdr_number, format('Lien discharge requested for %s.', f.fdr_number));
  perform public._notify(me.institution_id, 'Release request submitted', format('Release request submitted for %s. Placed before Regulation Bureau.', f.fdr_number), 'INFO',
    jsonb_build_object('route', 'fdrDetail', 'id', f.id));
  return jsonb_build_object('requestId', v_req);
end $$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null) returns integer
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public._require_institution(); n int;
begin
  update public.notifications set is_read = true
   where institution_id = me.institution_id and not is_read and (p_ids is null or id = any(p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.raise_ticket(p_category text, p_ref text, p_subject text, p_description text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public._require_institution(); inst public.institutions; v_no text;
begin
  select * into inst from public.institutions where id = me.institution_id;
  if length(trim(coalesce(p_subject, ''))) = 0 then perform public._fail('VALIDATION', 'Subject is required.', '{"subject":"Subject is required"}'); end if;
  if length(trim(coalesce(p_description, ''))) < 10 then perform public._fail('VALIDATION', 'Describe the issue.', '{"desc":"Describe the issue (min 10 characters)"}'); end if;
  v_no := format('TKT-%s-%s', extract(year from now())::int, lpad(nextval('public.ticket_seq')::text, 5, '0'));
  insert into public.tickets(ticket_no, institution_id, created_by, category, ref, subject, description, updates)
  values (v_no, inst.id, me.id, left(p_category, 80), nullif(p_ref, ''), left(trim(p_subject), 200), left(trim(p_description), 4000),
          jsonb_build_array(jsonb_build_object('at', now(), 'by', 'AICTE Helpdesk', 'text', format('Ticket registered and assigned to the %s Regional Office.', inst.region))));
  perform public._audit(inst.id, me.id, me.full_name, 'INSTITUTION', 'GRIEVANCE_RAISED', 'TICKET', v_no, format('%s: %s', p_category, trim(p_subject)));
  return jsonb_build_object('ticketNo', v_no);
end $$;

-- Only non-identity fields are editable by the institution. Name / PID changes need an application.
create or replace function public.update_institution_profile(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public._require_institution();
begin
  if coalesce(trim(p->>'address'), '') = '' or coalesce(trim(p->>'district'), '') = '' then
    perform public._fail('VALIDATION', 'Address and district are required.', '{"address":"Address is required"}'); end if;
  update public.institutions set address = trim(p->>'address'), district = trim(p->>'district'), city = trim(p->>'district'),
         state = coalesce(nullif(p->>'state', ''), state), type = coalesce(nullif(p->>'type', ''), type), website = nullif(trim(p->>'website'), ''), updated_at = now()
   where id = me.institution_id;
  perform public._audit(me.institution_id, me.id, me.full_name, 'INSTITUTION', 'INSTITUTION_PROFILE_UPDATED', 'INSTITUTION', (select pid from public.institutions where id = me.institution_id),
    'Updated institution contact profile (address / type / website).');
end $$;

create or replace function public.update_contact_details(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public._require_institution();
begin
  if coalesce(trim(p->>'name'), '') = '' or coalesce(trim(p->>'designation'), '') = '' then perform public._fail('VALIDATION', 'Name and designation are required.'); end if;
  if coalesce(p->>'mobile', '') !~ '^(\+91[ -]?)?[6-9][0-9]{4}[ -]?[0-9]{5}$' then perform public._fail('VALIDATION', 'Enter a valid Indian mobile number.', '{"mobile":"Enter a valid Indian mobile number"}'); end if;
  update public.profiles set full_name = trim(p->>'name'), designation = trim(p->>'designation'), mobile = trim(p->>'mobile') where id = me.id;
  update public.institutions set nodal = jsonb_build_object('name', coalesce(p->>'nodalName', ''), 'email', coalesce(p->>'nodalEmail', ''), 'mobile', coalesce(p->>'nodalMobile', '')), updated_at = now()
   where id = me.institution_id;
  perform public._audit(me.institution_id, me.id, trim(p->>'name'), 'INSTITUTION', 'CONTACT_DETAILS_UPDATED', 'USER', me.id::text, 'Updated Head of Institution and nodal officer contact details.');
end $$;

-- Client-side security events that have no other server action (login, logout, password change).
create or replace function public.log_client_event(p_action text, p_details text) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public._require_institution();
begin
  if p_action not in ('USER_LOGIN_SUCCESS','USER_LOGOUT','PASSWORD_CHANGED') then perform public._fail('FORBIDDEN', 'Event type not allowed.'); end if;
  perform public._audit(me.institution_id, me.id, me.full_name, 'INSTITUTION', p_action, 'USER', me.id::text, left(p_details, 500));
end $$;

-- Everything the institution app needs, in the shape the client renders. Hides staff-only data.
create or replace function public.get_portal_state() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me public.profiles := public._require_institution(); inst public.institutions;
begin
  select * into inst from public.institutions where id = me.institution_id;
  return jsonb_build_object(
    'serverTime', now(),
    'ruleVersion', public._cfg_version(),
    'me', jsonb_build_object('id', me.id, 'name', me.full_name, 'email', me.email, 'role', me.role, 'designation', me.designation,
                             'institutionId', inst.id, 'pid', inst.pid, 'region', inst.region, 'mobile', me.mobile),
    'institution', jsonb_build_object('id', inst.id, 'name', inst.name, 'short', coalesce(inst.short_name, inst.name), 'pid', inst.pid, 'city', inst.city,
                             'district', inst.district, 'state', inst.state, 'region', inst.region, 'type', inst.type, 'address', inst.address, 'website', inst.website,
                             'sanctionedIntake', inst.sanctioned_intake, 'totalStudents', inst.total_students,
                             'sfr', (select case when (a.intake_details->>'facultyCount')::numeric > 0 then '1:' || round((a.intake_details->>'totalStudents')::numeric / (a.intake_details->>'facultyCount')::numeric, 1) end
                                       from public.applications a where a.institution_id = inst.id order by submitted_at desc limit 1),
                             'requiredFdrLakhs', inst.required_fdr_lakhs, 'nodal', inst.nodal),
    'apps', coalesce((select jsonb_agg(jsonb_build_object(
        'id', a.id, 'applicationNumber', a.application_number, 'institutionId', a.institution_id, 'type', a.type, 'status', a.status,
        'academicYear', a.academic_year, 'submittedAt', a.submitted_at, 'lastUpdatedAt', a.last_updated_at, 'currentVersion', a.current_version,
        'fdrNumber', a.fdr_number, 'programme', a.programme, 'institutionSnapshot', a.institution_snapshot, 'intakeDetails', a.intake_details,
        'aiSummary', a.ai_summary, 'crossChecks', a.cross_checks, 'esign', a.esign, 'ruleVersion', a.rule_version,
        'documents', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'docType', d.doc_type, 'fileName', d.file_name,
              'fileSizeKb', greatest(1, round(d.file_size_bytes / 1024.0)), 'fileHash', d.file_hash, 'storagePath', d.storage_path, 'uploadedAt', d.uploaded_at,
              'version', d.version, 'pageCount', d.page_count, 'status', d.status, 'validTill', d.valid_till, 'extractedFields', d.extracted_fields,
              'forensics', d.forensics, 'geminiAnalysis', d.ai_analysis) order by d.uploaded_at) from public.application_documents d where d.application_id = a.id), '[]'::jsonb),
        'findings', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'ruleCode', f.rule_code, 'ruleName', f.rule_name, 'severity', f.severity,
              'description', f.description, 'handbookClause', f.handbook_clause, 'evidenceSnippet', f.evidence_snippet, 'docType', f.doc_type,
              'isDeterministic', f.is_deterministic, 'ruleVersion', f.rule_version)) from public.findings f where f.application_id = a.id), '[]'::jsonb)
              || coalesce(a.ai_findings, '[]'::jsonb),
        'scrutinyRecommendation', (select jsonb_build_object('status', s.status, 'reviewerName', s.reviewer_name, 'timestamp', s.updated_at, 'rationale', s.rationale,
              'deficiencyPoints', to_jsonb(s.deficiency_points), 'officialNoticeNumber', s.official_notice_number) from public.scrutiny s where s.application_id = a.id),
        'responses', coalesce((select jsonb_agg(jsonb_build_object('at', r.submitted_at, 'version', r.version, 'points', r.points, 'files', r.files) order by r.version)
              from public.compliance_responses r where r.application_id = a.id), '[]'::jsonb),
        'history', coalesce((select jsonb_agg(jsonb_build_object('from', h.from_status, 'to', h.to_status, 'at', h.at, 'actorRole', h.actor_role, 'note', h.note) order by h.id)
              from public.status_history h where h.application_id = a.id), '[]'::jsonb)
      ) order by a.last_updated_at desc) from public.applications a where a.institution_id = inst.id), '[]'::jsonb)
      || coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'applicationNumber', null, 'institutionId', d.institution_id, 'type', d.type, 'status', 'DRAFT',
              'lastUpdatedAt', d.updated_at, 'submittedAt', null, 'currentVersion', 0, 'intakeDetails', '{}'::jsonb, 'documents', '[]'::jsonb, 'findings', '[]'::jsonb,
              'responses', '[]'::jsonb, 'draft', d.payload || jsonb_build_object('draftId', d.id)))
            from public.application_drafts d where d.institution_id = inst.id), '[]'::jsonb),
    'fdrs', coalesce((select jsonb_agg(jsonb_build_object(
        'id', f.id, 'fdrNumber', f.fdr_number, 'institutionId', f.institution_id, 'applicationNumber', coalesce(f.application_number, '—'),
        'amountLakhs', f.amount / 100000, 'bankName', f.bank_name, 'branchName', f.branch_name, 'ifscCode', f.ifsc_code,
        'issueDate', f.issue_date, 'maturityDate', f.maturity_date, 'tenureYears', f.tenure_years, 'status', case when f.released then 'RELEASED' else 'ACTIVE' end,
        'jointLienHolder', f.joint_lien_holder, 'isLienConfirmed', f.is_lien_confirmed, 'lienEndorsementToken', f.lien_endorsement_token,
        'lienEndorsedAt', f.lien_endorsed_at, 'renewalStatus', f.renewal_status, 'replacedFdr', f.replaced_fdr, 'demo', f.demo,
        'releaseRequest', (select jsonb_build_object('requestedAt', r.requested_at, 'reason', r.reason, 'status', r.status, 'approvedBy', r.decided_by_name, 'approvedAt', r.decided_at)
              from public.fdr_requests r where r.fdr_id = f.id and r.kind = 'RELEASE' and r.status <> 'REJECTED' order by r.requested_at desc limit 1),
        'pendingRequest', (select jsonb_build_object('kind', r.kind, 'requestedAt', r.requested_at, 'payload', r.payload)
              from public.fdr_requests r where r.fdr_id = f.id and r.status = 'PENDING' and r.kind <> 'RELEASE' limit 1)
      ) order by f.maturity_date) from public.fdrs f where f.institution_id = inst.id), '[]'::jsonb),
    'notifs', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'institutionId', n.institution_id, 'title', n.title, 'message', n.message, 'type', n.type,
        'timestamp', n.created_at, 'isRead', n.is_read, 'link', n.link) order by n.created_at desc)
        from (select * from public.notifications where institution_id = inst.id order by created_at desc limit 200) n), '[]'::jsonb),
    'audit', coalesce((select jsonb_agg(jsonb_build_object('id', e.id::text, 'institutionId', e.institution_id, 'correlationId', e.correlation_id, 'timestamp', e.created_at,
        'actorName', e.actor_name, 'actorRole', e.actor_role, 'action', e.action, 'targetType', e.target_type, 'targetId', e.target_id, 'details', e.details,
        'ipAddress', e.ip_address, 'sha256Hash', e.sha256_hash, 'prevHash', e.prev_hash) order by e.id desc)
        from (select * from public.audit_events where institution_id = inst.id order by id desc limit 200) e), '[]'::jsonb),
    'tickets', coalesce((select jsonb_agg(jsonb_build_object('id', t.ticket_no, 'institutionId', t.institution_id, 'category', t.category, 'ref', t.ref, 'subject', t.subject,
        'desc', t.description, 'status', t.status, 'createdAt', t.created_at, 'updates', t.updates) order by t.created_at desc)
        from public.tickets t where t.institution_id = inst.id), '[]'::jsonb)
  );
end $$;

-- ------------------------------------------------------------------ staff RPCs (AICTE reviewers / admins / bank officials)
-- Used by the AICTE admin portal or the SQL editor. Institution accounts are refused.

create or replace function public.review_start(p_application_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public._require_role(array['REVIEWER','ADMIN']); a public.applications;
begin
  select * into a from public.applications where id = p_application_id;
  perform public._transition(p_application_id, 'UNDER_SCRUTINY', me, 'Picked up for scrutiny');
  insert into public.scrutiny(application_id, institution_id, status, reviewer_id, reviewer_name, rationale)
  values (a.id, a.institution_id, 'IN_PROGRESS', me.id, me.full_name, 'Review in progress.')
  on conflict (application_id) do update set status = 'IN_PROGRESS', reviewer_id = me.id, reviewer_name = me.full_name, updated_at = now();
  perform public._audit(a.institution_id, me.id, me.full_name, me.role, 'SCRUTINY_STARTED', 'APPLICATION', a.application_number, 'Application allocated to ' || me.full_name);
end $$;

create or replace function public.review_request_clarification(p_application_id uuid, p_points text[], p_rationale text) returns text
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public._require_role(array['REVIEWER','ADMIN']); a public.applications; inst public.institutions; v_notice text;
begin
  if coalesce(cardinality(p_points), 0) = 0 or length(trim(coalesce(p_rationale, ''))) < 10 then
    perform public._fail('VALIDATION', 'At least one deficiency point and a rationale are required.'); end if;
  select * into a from public.applications where id = p_application_id;
  if not found then perform public._fail('NOT_FOUND', 'Application not found.'); end if;
  select * into inst from public.institutions where id = a.institution_id;
  perform public._transition(a.id, 'DEFICIENCIES_NOTED', me, 'Deficiencies issued');
  v_notice := format('AICTE/%sRO/DEF/%s/%s', upper(left(regexp_replace(inst.region, '[^A-Za-z]', '', 'g'), 2)), extract(year from now())::int, lpad(nextval('public.application_seq')::text, 4, '0'));
  insert into public.scrutiny(application_id, institution_id, status, reviewer_id, reviewer_name, rationale, deficiency_points, official_notice_number)
  values (a.id, a.institution_id, 'DEFICIENCIES_ISSUED', me.id, me.full_name, p_rationale, p_points, v_notice)
  on conflict (application_id) do update set status = 'DEFICIENCIES_ISSUED', reviewer_id = me.id, reviewer_name = me.full_name, rationale = p_rationale,
     deficiency_points = p_points, official_notice_number = v_notice, updated_at = now();
  perform public._audit(a.institution_id, me.id, me.full_name, me.role, 'DEFICIENCY_NOTICE_ISSUED', 'APPLICATION', a.application_number,
    format('Issued Scrutiny Deficiency Notice %s with %s point(s).', v_notice, cardinality(p_points)));
  perform public._notify(a.institution_id, 'Scrutiny Deficiency Notice issued',
    format('Notice %s issued for %s. Respond within 7 working days.', v_notice, a.application_number), 'CRITICAL', jsonb_build_object('route', 'appDetail', 'id', a.id));
  return v_notice;
end $$;

create or replace function public.review_record_decision(p_application_id uuid, p_decision text, p_rationale text) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public._require_role(array['REVIEWER','ADMIN']); a public.applications;
begin
  if p_decision not in ('SCRUTINY_CLEARED','APPROVED','REJECTED') then perform public._fail('VALIDATION', 'Unknown decision.'); end if;
  if length(trim(coalesce(p_rationale, ''))) < 10 then perform public._fail('VALIDATION', 'A reasoned decision (rationale) is mandatory.'); end if;
  select * into a from public.applications where id = p_application_id;
  if not found then perform public._fail('NOT_FOUND', 'Application not found.'); end if;
  perform public._transition(a.id, p_decision, me, p_rationale);
  insert into public.scrutiny(application_id, institution_id, status, reviewer_id, reviewer_name, rationale)
  values (a.id, a.institution_id, case when p_decision = 'REJECTED' then 'NOT_RECOMMENDED' else 'RECOMMENDED_APPROVAL' end, me.id, me.full_name, p_rationale)
  on conflict (application_id) do update set status = excluded.status, reviewer_id = me.id, reviewer_name = me.full_name, rationale = p_rationale, updated_at = now();
  perform public._audit(a.institution_id, me.id, me.full_name, me.role, 'DECISION_' || p_decision, 'APPLICATION', a.application_number, p_rationale);
  perform public._notify(a.institution_id,
    case p_decision when 'APPROVED' then 'Application approved' when 'REJECTED' then 'Application not approved' else 'Scrutiny cleared — recommended for approval' end,
    format('%s: %s', a.application_number, p_rationale), case when p_decision = 'REJECTED' then 'CRITICAL' else 'SUCCESS' end, jsonb_build_object('route', 'appDetail', 'id', a.id));
end $$;

create or replace function public.bank_endorse_lien(p_fdr_id uuid, p_token text) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public._require_role(array['BANK_OFFICIAL','ADMIN']); f public.fdrs;
begin
  select * into f from public.fdrs where id = p_fdr_id for update;
  if not found or f.released then perform public._fail('NOT_FOUND', 'FDR not found.'); end if;
  if me.role = 'BANK_OFFICIAL' and me.bank_name is distinct from f.bank_name then perform public._fail('FORBIDDEN', 'This FDR is held with another bank.'); end if;
  if length(trim(coalesce(p_token, ''))) < 6 then perform public._fail('VALIDATION', 'CBS endorsement token is required.'); end if;
  update public.fdrs set is_lien_confirmed = true, lien_endorsement_token = trim(p_token), lien_endorsed_at = now(), updated_at = now() where id = f.id;
  perform public._audit(f.institution_id, me.id, me.full_name, me.role, 'FDR_LIEN_ENDORSEMENT', 'FDR', f.fdr_number, format('Endorsed irrevocable joint lien. Token: %s', trim(p_token)));
  perform public._notify(f.institution_id, 'CBS Joint Lien Confirmed', format('%s endorsed the joint lien on %s.', f.bank_name, f.fdr_number), 'SUCCESS',
    jsonb_build_object('route', 'fdrDetail', 'id', f.id));
end $$;

create or replace function public.decide_fdr_request(p_request_id uuid, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public._require_role(array['ADMIN']); r public.fdr_requests; f public.fdrs;
begin
  select * into r from public.fdr_requests where id = p_request_id and status = 'PENDING' for update;
  if not found then perform public._fail('NOT_FOUND', 'No pending request with this id.'); end if;
  select * into f from public.fdrs where id = r.fdr_id for update;
  update public.fdr_requests set status = case when p_approve then 'APPROVED' else 'REJECTED' end, decided_by = me.id,
         decided_by_name = format('%s (%s)', me.full_name, me.designation), decided_at = now(), decision_note = p_note where id = r.id;
  if p_approve then
    if r.kind = 'RENEWAL' then
      update public.fdrs set maturity_date = (r.payload->>'maturityDate')::date, tenure_years = tenure_years + 10, renewal_status = 'RENEWED',
             lien_endorsement_token = coalesce(nullif(r.payload->>'token', ''), lien_endorsement_token), updated_at = now() where id = f.id;
    elsif r.kind = 'REPLACEMENT' then
      update public.fdrs set replaced_fdr = fdr_number, fdr_number = upper(r.payload->>'fdrNumber'), bank_name = r.payload->>'bankName', branch_name = r.payload->>'branchName',
             ifsc_code = upper(r.payload->>'ifscCode'), amount = (r.payload->>'amount')::numeric, issue_date = current_date, maturity_date = (r.payload->>'maturityDate')::date,
             is_lien_confirmed = false, lien_endorsement_token = null, lien_endorsed_at = null, renewal_status = 'REPLACED', updated_at = now() where id = f.id;
    else
      update public.fdrs set released = true, updated_at = now() where id = f.id;
    end if;
  else
    update public.fdrs set renewal_status = case when r.kind = 'RELEASE' then renewal_status else 'REQUEST_REJECTED' end, updated_at = now() where id = f.id;
  end if;
  perform public._audit(f.institution_id, me.id, me.full_name, me.role, format('FDR_%s_%s', r.kind, case when p_approve then 'APPROVED' else 'REJECTED' end), 'FDR', f.fdr_number, coalesce(p_note, ''));
  perform public._notify(f.institution_id, format('FDR %s request %s', lower(r.kind), case when p_approve then 'approved' else 'rejected' end),
    format('%s: %s', f.fdr_number, coalesce(p_note, '')), case when p_approve then 'SUCCESS' else 'WARNING' end, jsonb_build_object('route', 'fdrDetail', 'id', f.id));
end $$;

-- Activate a registered user and link them to an institution (AICTE admin or SQL editor / service role).
create or replace function public.admin_link_user(p_email text, p_pid text, p_role text default 'INSTITUTION') returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_inst uuid;
begin
  if not public._is_service() then perform public._require_role(array['ADMIN']); end if;
  select id into v_uid from auth.users where lower(email) = lower(p_email);
  if v_uid is null then perform public._fail('NOT_FOUND', 'No auth user with that email. Create the user first.'); end if;
  if p_pid is not null then select id into v_inst from public.institutions where pid = p_pid; end if;
  if p_role = 'INSTITUTION' and v_inst is null then perform public._fail('NOT_FOUND', 'Unknown institution PID.'); end if;
  insert into public.profiles(id, email, role, status, institution_id)
  values (v_uid, p_email, p_role, 'ACTIVE', v_inst)
  on conflict (id) do update set role = p_role, status = 'ACTIVE', institution_id = v_inst;
  update public.registration_requests set status = 'ACTIVATED' where user_id = v_uid;
end $$;

-- Daily job: FDR maturity reminders (180 / 60 / 30 days) and matured-FDR notices. Deduplicated.
create or replace function public.generate_expiry_reminders() returns integer
language plpgsql security definer set search_path = public as $$
declare f record; n int := 0; v_days int; v_bucket int;
begin
  if not public._is_service() then perform public._require_role(array['ADMIN']); end if;
  for f in select * from public.fdrs where not released and is_lien_confirmed loop
    v_days := f.maturity_date - current_date;
    v_bucket := case when v_days <= 0 then 0 when v_days <= 30 then 30 when v_days <= 60 then 60 when v_days <= 180 then 180 else null end;
    continue when v_bucket is null;
    perform public._notify(f.institution_id,
      case when v_bucket = 0 then 'FDR matured — eligible for lien release' else 'Upcoming FDR Expiry Notice' end,
      case when v_bucket = 0 then format('%s completed its lock-in on %s. You may apply for joint lien discharge (APH Clause 6.4).', f.fdr_number, f.maturity_date)
           else format('FDR No. %s matures on %s (%s days). Renewal receipt must be submitted 60 days prior to maturity.', f.fdr_number, f.maturity_date, v_days) end,
      case when v_bucket <= 60 then 'CRITICAL' else 'WARNING' end, jsonb_build_object('route', 'fdrDetail', 'id', f.id),
      format('fdr-expiry-%s-%s-%s', f.id, f.maturity_date, v_bucket));
    n := n + 1;
  end loop;
  return n;
end $$;

-- ------------------------------------------------------------------ sign-up hook

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_reg jsonb := new.raw_user_meta_data -> 'registration'; v_no text;
begin
  insert into public.profiles(id, email, full_name, designation, mobile, role, status)
  values (new.id, new.email, coalesce(v_reg->>'head', new.raw_user_meta_data->>'full_name', ''), 'Head of Institution', v_reg->>'mobile', 'INSTITUTION', 'PENDING_VERIFICATION')
  on conflict (id) do nothing;
  if v_reg is not null then
    v_no := format('REG-%s-%s', extract(year from now())::int, lpad(nextval('public.registration_seq')::text, 5, '0'));
    insert into public.registration_requests(request_no, user_id, payload) values (v_no, new.id, v_reg);
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------ row-level security

alter table public.institutions          enable row level security;
alter table public.profiles              enable row level security;
alter table public.registration_requests enable row level security;
alter table public.rule_config           enable row level security;
alter table public.fdrs                  enable row level security;
alter table public.fdr_requests          enable row level security;
alter table public.applications          enable row level security;
alter table public.application_documents enable row level security;
alter table public.findings              enable row level security;
alter table public.scrutiny              enable row level security;
alter table public.compliance_responses  enable row level security;
alter table public.status_history        enable row level security;
alter table public.review_notes          enable row level security;
alter table public.notifications         enable row level security;
alter table public.audit_events          enable row level security;
alter table public.tickets               enable row level security;
alter table public.application_drafts    enable row level security;

-- read-only, own institution (staff read everything). No client INSERT/UPDATE/DELETE policies exist.
create policy institutions_read on public.institutions for select to authenticated using (id = public.my_institution_id() or public.is_staff());
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());
create policy rule_config_read on public.rule_config for select to authenticated using (true);
create policy fdrs_read on public.fdrs for select to authenticated using (institution_id = public.my_institution_id() or public.is_staff());
create policy fdr_requests_read on public.fdr_requests for select to authenticated using (institution_id = public.my_institution_id() or public.is_staff());
create policy applications_read on public.applications for select to authenticated using (institution_id = public.my_institution_id() or public.is_staff());
create policy documents_read on public.application_documents for select to authenticated using (institution_id = public.my_institution_id() or public.is_staff());
create policy findings_read on public.findings for select to authenticated
  using (exists (select 1 from public.applications a where a.id = application_id and (a.institution_id = public.my_institution_id() or public.is_staff())));
create policy scrutiny_read on public.scrutiny for select to authenticated using (institution_id = public.my_institution_id() or public.is_staff());
create policy responses_read on public.compliance_responses for select to authenticated using (institution_id = public.my_institution_id() or public.is_staff());
create policy history_read on public.status_history for select to authenticated using (institution_id = public.my_institution_id() or public.is_staff());
create policy review_notes_staff on public.review_notes for select to authenticated using (public.is_staff());
create policy notifications_read on public.notifications for select to authenticated using (institution_id = public.my_institution_id() or public.is_staff());
create policy audit_read on public.audit_events for select to authenticated using (institution_id = public.my_institution_id() or public.is_staff());
create policy tickets_read on public.tickets for select to authenticated using (institution_id = public.my_institution_id() or public.is_staff());
create policy drafts_read on public.application_drafts for select to authenticated using (institution_id = public.my_institution_id());

-- ------------------------------------------------------------------ privileges

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on public.institutions, public.profiles, public.rule_config, public.fdrs, public.fdr_requests, public.applications,
                public.application_documents, public.findings, public.scrutiny, public.compliance_responses, public.status_history,
                public.review_notes, public.notifications, public.audit_events, public.tickets, public.application_drafts to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.my_institution_id(), public.is_staff(),
  public.submit_application(jsonb, uuid, boolean), public.save_draft(uuid, text, jsonb), public.delete_draft(uuid),
  public.submit_compliance_response(uuid, jsonb, jsonb), public.submit_fdr(jsonb), public.request_fdr_renewal(uuid, jsonb),
  public.request_lien_release(uuid, text, boolean), public.mark_notifications_read(uuid[]), public.raise_ticket(text, text, text, text),
  public.update_institution_profile(jsonb), public.update_contact_details(jsonb), public.log_client_event(text, text), public.get_portal_state(),
  public.review_start(uuid), public.review_request_clarification(uuid, text[], text), public.review_record_decision(uuid, text, text),
  public.bank_endorse_lien(uuid, text), public.decide_fdr_request(uuid, boolean, text), public.admin_link_user(text, text, text),
  public.generate_expiry_reminders()
to authenticated;

-- ------------------------------------------------------------------ storage (private documents bucket)

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('institution-documents', 'institution-documents', false, 10485760, array['application/pdf','image/jpeg','image/png'])
    on conflict (id) do nothing;

    -- Objects live under "<institution_id>/...". Upload and read only within your own folder; no update/delete (evidence is immutable).
    execute $p$ create policy "institution docs: read own" on storage.objects for select to authenticated
      using (bucket_id = 'institution-documents' and ((storage.foldername(name))[1] = public.my_institution_id()::text or public.is_staff())) $p$;
    execute $p$ create policy "institution docs: upload own" on storage.objects for insert to authenticated
      with check (bucket_id = 'institution-documents' and (storage.foldername(name))[1] = public.my_institution_id()::text) $p$;
  end if;
end $$;

-- ------------------------------------------------------------------ realtime + scheduled reminders (when available)

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications, public.applications, public.fdrs, public.scrutiny, public.fdr_requests;
  end if;
exception when duplicate_object then null;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('aicte-fdr-expiry-reminders', '30 1 * * *', 'select public.generate_expiry_reminders()');
  end if;
end $$;
