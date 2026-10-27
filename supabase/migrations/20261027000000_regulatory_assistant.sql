-- =====================================================================================
-- AICTE Regulatory Assistant (institution app): regulatory sources, document requirements,
-- and the assistant's application sessions with their uploaded documents.
--   * Sources and requirements are data an administrator maintains (admin_save_source /
--     admin_save_requirement). Defaults match assistant-rules.js.
--   * Sessions and documents are written only by the API server (server/assistant.mjs), which
--     runs the validation rules and the submission. Institutions may read their own rows.
-- Adds tables and functions only; nothing existing is changed.
-- =====================================================================================

create table if not exists public.regulatory_sources (
  id                text primary key,
  title             text not null,
  issuing_authority text not null,
  url               text,
  section           text,
  effective_date    date,
  -- VERIFIED: checked by an administrator against the official document. PORTAL_RULE: enforced by this portal,
  -- AICTE basis not confirmed. UNVERIFIED / OUTDATED: shown for human confirmation, never blocking.
  status            text not null check (status in ('VERIFIED','PORTAL_RULE','UNVERIFIED','OUTDATED')),
  excerpt           text,
  notes             text,
  verified_by_name  text,
  verified_at       timestamptz,
  updated_at        timestamptz not null default now()
);

create table if not exists public.document_requirements (
  id               uuid primary key default gen_random_uuid(),
  workflow         text not null check (workflow in ('NEW_FDR','RENEW_FDR','REPLACE_FDR','RELEASE_FDR','CORRECT_FDR','RESPOND_DEFICIENCY','OTHER')),
  doc_key          text not null check (doc_key ~ '^[A-Z][A-Z0-9_]{2,40}$'),
  doc_type         text not null check (doc_type in ('FDR_CORPUS','BANK_LETTER','AFFIDAVIT','OTHER')),
  name             text not null,
  purpose          text not null,
  required_fields  text[] not null default '{}',
  formats          text[] not null default '{PDF,JPG,PNG}',
  applicability    text not null check (applicability in ('MANDATORY','CONDITIONAL')),
  condition        text check (condition is null or condition ~ '^(always|[a-zA-Z]+=[a-zA-Z0-9_]+)$'),
  condition_label  text,
  source_id        text not null references public.regulatory_sources(id),
  version          text not null,
  effective_from   date,
  effective_to     date,
  active           boolean not null default true,
  updated_at       timestamptz not null default now(),
  unique (workflow, doc_key, version)
);

create table if not exists public.assistant_sessions (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references public.institutions(id),
  user_id         uuid not null,
  workflow        text,
  answers         jsonb not null default '{}'::jsonb,
  user_values     jsonb not null default '{}'::jsonb,
  messages        jsonb not null default '[]'::jsonb,
  review_opened   boolean not null default false,
  packaged_at     timestamptz,
  submission      jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists assistant_sessions_institution_idx on public.assistant_sessions(institution_id, updated_at desc);

create table if not exists public.assistant_documents (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null references public.assistant_sessions(id) on delete cascade,
  institution_id     uuid not null references public.institutions(id),
  doc_key            text not null,
  file_name          text not null,
  file_size_bytes    bigint not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  mime_type          text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
  file_hash          text not null check (file_hash ~ '^[0-9a-f]{64}$'),
  storage_path       text not null,
  page_count         integer not null default 1,
  extraction         jsonb,
  extraction_error   text,
  extraction_message text,
  uploaded_at        timestamptz not null default now(),
  unique (session_id, doc_key)
);

alter table public.regulatory_sources    enable row level security;
alter table public.document_requirements enable row level security;
alter table public.assistant_sessions    enable row level security;
alter table public.assistant_documents   enable row level security;

drop policy if exists sources_read on public.regulatory_sources;
create policy sources_read on public.regulatory_sources for select to authenticated using (true);
drop policy if exists requirements_read on public.document_requirements;
create policy requirements_read on public.document_requirements for select to authenticated using (true);
drop policy if exists assistant_sessions_own on public.assistant_sessions;
create policy assistant_sessions_own on public.assistant_sessions for select to authenticated using (institution_id = public.my_institution_id());
drop policy if exists assistant_documents_own on public.assistant_documents;
create policy assistant_documents_own on public.assistant_documents for select to authenticated using (institution_id = public.my_institution_id());
grant select on public.regulatory_sources, public.document_requirements, public.assistant_sessions, public.assistant_documents to authenticated;

-- ------------------------------------------------------------------ default catalog (same as assistant-rules.js)

insert into public.regulatory_sources(id, title, issuing_authority, url, section, effective_date, status, excerpt, notes) values
  ('SRC-PORTAL-2026-1', 'FDR Vault portal rules v2026.1', 'FDR Vault (this portal’s configured rules)', null,
   'Portal configuration v2026.1 (submit_fdr, request_fdr_renewal, request_lien_release)', '2026-10-22', 'PORTAL_RULE',
   'New FDRs need the deposit advice, a 10-year tenure and a valid IFSC; renewals need a later maturity date; a lien can be released only after maturity and bank endorsement.',
   'Enforced by this portal. The AICTE regulation behind each rule has not been verified by an administrator.'),
  ('SRC-APH-2024-27', 'AICTE Approval Process Handbook 2024-25 to 2026-27', 'All India Council for Technical Education', 'https://www.aicte-india.org',
   null, null, 'UNVERIFIED', null,
   'The security-deposit provisions must be checked by an administrator against the published handbook. No clause is verified in this portal yet.')
on conflict (id) do nothing;

insert into public.document_requirements(workflow, doc_key, doc_type, name, purpose, required_fields, applicability, condition, condition_label, source_id, version, effective_from) values
  ('NEW_FDR', 'FDR_ADVICE', 'FDR_CORPUS', 'FDR certificate / deposit advice', 'The portal records the deposit from this receipt, and the bank official checks it before endorsing the joint lien.',
   '{"FDR number","Bank and branch","Deposit amount","Issue date","Maturity date","Depositor (institution) name","Lien / joint holder (AICTE)"}', 'MANDATORY', null, null, 'SRC-PORTAL-2026-1', '2026.1', '2026-10-27'),
  ('NEW_FDR', 'BANK_LIEN_LETTER', 'BANK_LETTER', 'Bank letter confirming the lien', 'Shows that the bank has already marked the lien in favour of AICTE.',
   '{"FDR number","Lien holder","Bank seal and signature"}', 'CONDITIONAL', 'lienMarked=yes', 'if your bank has already issued a lien letter', 'SRC-APH-2024-27', '2026.1', '2026-10-27'),
  ('NEW_FDR', 'AUTHORITY_LETTER', 'OTHER', 'Authorisation of the signatory', 'Shows that the person submitting may act for the institution.',
   '{"Name of the authorised person","Signature of the Head / management"}', 'CONDITIONAL', 'signatory=delegated', 'if someone other than the Head of Institution submits', 'SRC-APH-2024-27', '2026.1', '2026-10-27'),
  ('RENEW_FDR', 'RENEWAL_ADVICE', 'FDR_CORPUS', 'Renewed FDR advice from the bank', 'Confirms the new maturity date of the same deposit.',
   '{"FDR number","New maturity date","Deposit amount","Lien / joint holder (AICTE)"}', 'MANDATORY', null, null, 'SRC-PORTAL-2026-1', '2026.1', '2026-10-27'),
  ('REPLACE_FDR', 'NEW_FDR_ADVICE', 'FDR_CORPUS', 'Deposit advice of the replacement FDR', 'The replacement deposit is recorded from this receipt.',
   '{"FDR number","Bank and branch","Deposit amount","Issue date","Maturity date","Depositor (institution) name","Lien / joint holder (AICTE)"}', 'MANDATORY', null, null, 'SRC-PORTAL-2026-1', '2026.1', '2026-10-27'),
  ('REPLACE_FDR', 'BANK_LIEN_LETTER', 'BANK_LETTER', 'New bank’s lien letter', 'Shows that the new bank has marked the lien in favour of AICTE.',
   '{"FDR number","Lien holder","Bank seal and signature"}', 'CONDITIONAL', 'lienMarked=yes', 'if the new bank has already issued a lien letter', 'SRC-APH-2024-27', '2026.1', '2026-10-27'),
  ('RELEASE_FDR', 'MATURED_FDR_ADVICE', 'FDR_CORPUS', 'Copy of the matured FDR advice', 'Identifies the deposit to be released and shows that it has matured.',
   '{"FDR number","Maturity date","Deposit amount"}', 'MANDATORY', null, null, 'SRC-PORTAL-2026-1', '2026.1', '2026-10-27'),
  ('RELEASE_FDR', 'NO_DUES_UNDERTAKING', 'AFFIDAVIT', 'Undertaking of no outstanding liabilities', 'States that no student, staff or regulatory dues are pending.',
   '{"Statement of no dues","Signature of the Head of Institution"}', 'CONDITIONAL', 'always', 'requirement not confirmed from an official source', 'SRC-APH-2024-27', '2026.1', '2026-10-27'),
  ('CORRECT_FDR', 'BANK_CORRECTION_LETTER', 'BANK_LETTER', 'Bank letter with the correct details', 'Evidence for the corrected value, issued by the bank.',
   '{"FDR number","Corrected detail","Bank seal and signature"}', 'MANDATORY', null, null, 'SRC-PORTAL-2026-1', '2026.1', '2026-10-27')
on conflict (workflow, doc_key, version) do nothing;

-- ------------------------------------------------------------------ administrator maintenance of the catalog

create or replace function public.admin_regulatory_catalog() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me public.profiles := public._require_role(array['ADMIN','REVIEWER']);
begin
  return jsonb_build_object(
    'sources', coalesce((select jsonb_agg(to_jsonb(s.*) order by s.id) from public.regulatory_sources s), '[]'::jsonb),
    'requirements', coalesce((select jsonb_agg(to_jsonb(r.*) order by r.workflow, r.doc_key, r.version) from public.document_requirements r), '[]'::jsonb));
end $$;

-- Create or update a source. Marking it VERIFIED records who verified it and requires a section and an excerpt.
create or replace function public.admin_save_source(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public._require_role(array['ADMIN']); v_status text := coalesce(p->>'status', 'UNVERIFIED'); v_id text := upper(trim(coalesce(p->>'id', '')));
begin
  if v_id !~ '^[A-Z0-9][A-Z0-9-]{2,40}$' then perform public._fail('VALIDATION', 'Source id: capital letters, digits and -, e.g. SRC-CIRCULAR-2026-14.'); end if;
  if length(trim(coalesce(p->>'title', ''))) < 5 or length(trim(coalesce(p->>'issuingAuthority', ''))) < 3 then perform public._fail('VALIDATION', 'Title and issuing authority are required.'); end if;
  if v_status not in ('VERIFIED','PORTAL_RULE','UNVERIFIED','OUTDATED') then perform public._fail('VALIDATION', 'Unknown status.'); end if;
  if v_status = 'VERIFIED' and (length(trim(coalesce(p->>'section', ''))) < 2 or length(trim(coalesce(p->>'excerpt', ''))) < 10) then
    perform public._fail('VALIDATION', 'A verified source needs the section / page and the relevant excerpt.'); end if;
  if coalesce(p->>'url', '') <> '' and p->>'url' !~ '^https://' then perform public._fail('VALIDATION', 'Use an https:// link to the official document.'); end if;
  insert into public.regulatory_sources(id, title, issuing_authority, url, section, effective_date, status, excerpt, notes, verified_by_name, verified_at, updated_at)
  values (v_id, trim(p->>'title'), trim(p->>'issuingAuthority'), nullif(trim(coalesce(p->>'url', '')), ''), nullif(trim(coalesce(p->>'section', '')), ''),
          nullif(p->>'effectiveDate', '')::date, v_status, nullif(trim(coalesce(p->>'excerpt', '')), ''), nullif(trim(coalesce(p->>'notes', '')), ''),
          case when v_status = 'VERIFIED' then me.full_name end, case when v_status = 'VERIFIED' then now() end, now())
  on conflict (id) do update set title = excluded.title, issuing_authority = excluded.issuing_authority, url = excluded.url, section = excluded.section,
     effective_date = excluded.effective_date, status = excluded.status, excerpt = excluded.excerpt, notes = excluded.notes,
     verified_by_name = case when excluded.status = 'VERIFIED' then coalesce(case when regulatory_sources.status = 'VERIFIED' then regulatory_sources.verified_by_name end, excluded.verified_by_name) end,
     verified_at = case when excluded.status = 'VERIFIED' then coalesce(case when regulatory_sources.status = 'VERIFIED' then regulatory_sources.verified_at end, excluded.verified_at) end,
     updated_at = now();
  perform public._audit(null, me.id, me.full_name, me.role, 'REGULATORY_SOURCE_SAVED', 'SOURCE', v_id, format('%s — %s', trim(p->>'title'), v_status));
end $$;

-- Create or update a requirement (by workflow, document key and version), or switch it on / off.
create or replace function public.admin_save_requirement(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public._require_role(array['ADMIN']);
begin
  if not exists (select 1 from public.regulatory_sources where id = p->>'sourceId') then perform public._fail('VALIDATION', 'Choose an existing source.'); end if;
  if length(trim(coalesce(p->>'name', ''))) < 3 or length(trim(coalesce(p->>'purpose', ''))) < 5 then perform public._fail('VALIDATION', 'Name and purpose are required.'); end if;
  if coalesce(p->>'version', '') !~ '^[0-9][0-9A-Za-z.\-]{0,15}$' then perform public._fail('VALIDATION', 'Version is required, e.g. 2026.2.'); end if;
  insert into public.document_requirements(workflow, doc_key, doc_type, name, purpose, required_fields, applicability, condition, condition_label, source_id, version,
                                           effective_from, effective_to, active, updated_at)
  values (p->>'workflow', upper(p->>'docKey'), coalesce(p->>'docType', 'OTHER'), trim(p->>'name'), trim(p->>'purpose'),
          coalesce(array(select jsonb_array_elements_text(p->'requiredFields')), '{}'), coalesce(p->>'applicability', 'CONDITIONAL'),
          nullif(p->>'condition', ''), nullif(p->>'conditionLabel', ''), p->>'sourceId', p->>'version',
          nullif(p->>'effectiveFrom', '')::date, nullif(p->>'effectiveTo', '')::date, coalesce((p->>'active')::boolean, true), now())
  on conflict (workflow, doc_key, version) do update set doc_type = excluded.doc_type, name = excluded.name, purpose = excluded.purpose,
     required_fields = excluded.required_fields, applicability = excluded.applicability, condition = excluded.condition, condition_label = excluded.condition_label,
     source_id = excluded.source_id, effective_from = excluded.effective_from, effective_to = excluded.effective_to, active = excluded.active, updated_at = now();
  perform public._audit(null, me.id, me.full_name, me.role, 'DOCUMENT_REQUIREMENT_SAVED', 'REQUIREMENT', format('%s/%s v%s', p->>'workflow', upper(p->>'docKey'), p->>'version'),
    format('%s (%s, %s)', trim(p->>'name'), coalesce(p->>'applicability', 'CONDITIONAL'), case when coalesce((p->>'active')::boolean, true) then 'active' else 'inactive' end));
end $$;

revoke execute on function public.admin_regulatory_catalog(), public.admin_save_source(jsonb), public.admin_save_requirement(jsonb) from public, anon;
grant execute on function public.admin_regulatory_catalog(), public.admin_save_source(jsonb), public.admin_save_requirement(jsonb) to authenticated;
