-- =====================================================================================
-- FDR lifecycle: reminder job, bank confirmation source, lien release to discharge.
--   * Daily reminders: run_daily_reminders() runs generate_expiry_reminders() at most once per
--     India date (from 07:00 IST), under an advisory lock so only one server runs it, and logs
--     every run in job_runs. Servers call it at start-up and every few minutes, so a missed
--     01:30 UTC timer (restart, sleeping free instance) catches up on the next call.
--   * Bank confirmation: fdrs records who confirmed the joint lien. Only a bank official of the
--     FDR's bank gives BANK_OFFICIAL; an AICTE admin entry is AICTE_RECORDED; seeded demo rows
--     are DEMO_SIMULATED; older rows with no endorsement on file are UNRECORDED.
--   * Release: an approval needs a reasoned note and the AICTE release order number, and is
--     recorded on the FDR (released_at, release_request_id). The bank then confirms the lien
--     discharge in its own system and records the reference (bank_discharge_lien). The portal
--     never moves money: the bank pays the deposit out under its own process.
-- Safe to run more than once.
-- =====================================================================================

-- ------------------------------------------------------------------ columns

alter table public.fdrs add column if not exists lien_confirmation_source text
  check (lien_confirmation_source in ('BANK_OFFICIAL', 'AICTE_RECORDED', 'DEMO_SIMULATED', 'UNRECORDED'));
alter table public.fdrs add column if not exists lien_confirmed_by uuid;
alter table public.fdrs add column if not exists lien_confirmed_by_name text;
alter table public.fdrs add column if not exists released_at timestamptz;
alter table public.fdrs add column if not exists release_request_id uuid references public.fdr_requests(id);
alter table public.fdrs add column if not exists lien_discharged_at timestamptz;
alter table public.fdrs add column if not exists lien_discharge_ref text;
alter table public.fdrs add column if not exists lien_discharged_by uuid;
alter table public.fdrs add column if not exists lien_discharged_by_name text;
alter table public.fdr_requests add column if not exists decision_evidence jsonb;
alter table public.notifications add column if not exists emailed_at timestamptz;

-- Existing confirmations: a signed-in bank official's endorsement on the audit trail, else demo or unrecorded.
update public.fdrs f set lien_confirmation_source = coalesce(
    (select case a.actor_role when 'BANK_OFFICIAL' then 'BANK_OFFICIAL' when 'ADMIN' then 'AICTE_RECORDED' end
       from public.audit_events a
      where a.action = 'FDR_LIEN_ENDORSEMENT' and a.target_id = f.fdr_number and a.actor_id is not null
        and exists (select 1 from public.profiles p where p.id = a.actor_id)
      order by a.id desc limit 1),
    case when f.demo then 'DEMO_SIMULATED' else 'UNRECORDED' end)
 where f.is_lien_confirmed and f.lien_confirmation_source is null;

update public.fdrs f set released_at = r.decided_at, release_request_id = r.id
  from public.fdr_requests r
 where f.released and f.released_at is null and r.fdr_id = f.id and r.kind = 'RELEASE' and r.status = 'APPROVED';

-- ------------------------------------------------------------------ daily reminder job

create table if not exists public.job_runs (
  id          bigserial primary key,
  job         text not null,
  run_date    date not null,                 -- India date the run counts for
  trigger     text not null,                 -- SCHEDULE | SERVER_FORCED | ADMIN
  started_at  timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  checked     integer,                       -- FDRs inside a reminder window
  created     integer,                       -- new notifications (repeats are suppressed)
  error       text
);
create index if not exists job_runs_job_idx on public.job_runs(job, started_at desc);
alter table public.job_runs enable row level security;

create or replace function public.run_daily_reminders(p_force boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ist timestamp := now() at time zone 'Asia/Kolkata'; v_trigger text; v_before int; v_checked int; v_created int;
begin
  if public._is_service() then v_trigger := case when p_force then 'SERVER_FORCED' else 'SCHEDULE' end;
  else perform public._require_role(array['ADMIN']); v_trigger := 'ADMIN'; p_force := true; end if;
  if not pg_try_advisory_xact_lock(hashtext('job:fdr-expiry-reminders')) then
    return jsonb_build_object('ran', false, 'reason', 'Another server is running the job.'); end if;
  if not p_force then
    if v_ist::time < time '07:00' then return jsonb_build_object('ran', false, 'reason', 'Runs from 07:00 IST.'); end if;
    if exists (select 1 from public.job_runs where job = 'fdr-expiry-reminders' and run_date = v_ist::date and error is null) then
      return jsonb_build_object('ran', false, 'reason', 'Already ran today.'); end if;
  end if;
  select count(*) into v_before from public.notifications where dedupe_key like 'fdr-expiry-%';
  v_checked := public.generate_expiry_reminders();
  select count(*) - v_before into v_created from public.notifications where dedupe_key like 'fdr-expiry-%';
  insert into public.job_runs(job, run_date, trigger, finished_at, checked, created)
  values ('fdr-expiry-reminders', v_ist::date, v_trigger, clock_timestamp(), v_checked, v_created);
  return jsonb_build_object('ran', true, 'runDate', v_ist::date, 'checked', v_checked, 'created', v_created);
end $$;

create or replace function public.reminder_job_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  perform public._require_role(array['ADMIN']);
  return jsonb_build_object(
    'today', v_today,
    'ranToday', exists (select 1 from public.job_runs where job = 'fdr-expiry-reminders' and run_date = v_today and error is null),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('runDate', j.run_date, 'trigger', j.trigger, 'startedAt', j.started_at, 'finishedAt', j.finished_at,
        'checked', j.checked, 'created', j.created, 'error', j.error) order by j.started_at desc)
      from (select * from public.job_runs where job = 'fdr-expiry-reminders' order by started_at desc limit 10) j), '[]'::jsonb));
end $$;

-- ------------------------------------------------------------------ bank confirmation of the joint lien

create or replace function public.bank_endorse_lien(p_fdr_id uuid, p_token text) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public._require_role(array['BANK_OFFICIAL','ADMIN']); f public.fdrs;
begin
  select * into f from public.fdrs where id = p_fdr_id for update;
  if not found or f.released then perform public._fail('NOT_FOUND', 'FDR not found.'); end if;
  if me.role = 'BANK_OFFICIAL' and me.bank_name is distinct from f.bank_name then perform public._fail('FORBIDDEN', 'This FDR is held with another bank.'); end if;
  if length(trim(coalesce(p_token, ''))) < 6 then perform public._fail('VALIDATION', 'CBS endorsement token is required.'); end if;
  update public.fdrs set is_lien_confirmed = true, lien_endorsement_token = trim(p_token), lien_endorsed_at = now(),
         lien_confirmation_source = case when me.role = 'BANK_OFFICIAL' then 'BANK_OFFICIAL' else 'AICTE_RECORDED' end,
         lien_confirmed_by = me.id, lien_confirmed_by_name = format('%s (%s)', me.full_name, coalesce(me.bank_name, 'AICTE')), updated_at = now()
   where id = f.id;
  if me.role = 'BANK_OFFICIAL' then
    perform public._audit(f.institution_id, me.id, me.full_name, me.role, 'FDR_LIEN_ENDORSEMENT', 'FDR', f.fdr_number,
      format('%s confirmed the irrevocable joint lien. Token: %s', f.bank_name, trim(p_token)));
    perform public._notify(f.institution_id, 'Joint lien confirmed by the bank', format('%s confirmed the joint lien on %s.', f.bank_name, f.fdr_number), 'SUCCESS',
      jsonb_build_object('route', 'fdrDetail', 'id', f.id));
  else
    perform public._audit(f.institution_id, me.id, me.full_name, me.role, 'FDR_LIEN_ENDORSEMENT', 'FDR', f.fdr_number,
      format('AICTE recorded the joint lien from bank token %s (entered by AICTE, not confirmed by a bank official).', trim(p_token)));
    perform public._notify(f.institution_id, 'Joint lien recorded by AICTE', format('AICTE recorded the joint lien on %s. The bank has not confirmed it on the portal.', f.fdr_number), 'INFO',
      jsonb_build_object('route', 'fdrDetail', 'id', f.id));
  end if;
end $$;

-- ------------------------------------------------------------------ AICTE decision on renewal / replacement / release

drop function if exists public.decide_fdr_request(uuid, boolean, text);
create or replace function public.decide_fdr_request(p_request_id uuid, p_approve boolean, p_note text, p_evidence jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public._require_role(array['ADMIN']); r public.fdr_requests; f public.fdrs; v_order text := trim(coalesce(p_evidence->>'orderNumber', ''));
begin
  select * into r from public.fdr_requests where id = p_request_id and status = 'PENDING' for update;
  if not found then perform public._fail('NOT_FOUND', 'No pending request with this id.'); end if;
  select * into f from public.fdrs where id = r.fdr_id for update;
  if length(trim(coalesce(p_note, ''))) < 10 then perform public._fail('VALIDATION', 'A reasoned decision note (at least 10 characters) is mandatory.'); end if;
  if p_approve and r.kind = 'RELEASE' then
    if f.released then perform public._fail('INVALID_STATE', 'This FDR is already released.'); end if;
    if f.maturity_date > current_date or not f.is_lien_confirmed then perform public._fail('INVALID_STATE', 'Only a matured FDR with a recorded joint lien can be released.'); end if;
    if length(v_order) < 4 then perform public._fail('VALIDATION', 'Enter the AICTE release order number.', '{"orderNumber":"Release order number is required"}'); end if;
  end if;
  update public.fdr_requests set status = case when p_approve then 'APPROVED' else 'REJECTED' end, decided_by = me.id,
         decided_by_name = format('%s (%s)', me.full_name, me.designation), decided_at = now(), decision_note = trim(p_note),
         decision_evidence = case when v_order <> '' then jsonb_build_object('orderNumber', v_order, 'orderDate', coalesce(nullif(p_evidence->>'orderDate', ''), current_date::text)) end
   where id = r.id;
  if p_approve then
    if r.kind = 'RENEWAL' then
      update public.fdrs set maturity_date = (r.payload->>'maturityDate')::date, tenure_years = tenure_years + 10, renewal_status = 'RENEWED',
             lien_endorsement_token = coalesce(nullif(r.payload->>'token', ''), lien_endorsement_token), updated_at = now() where id = f.id;
    elsif r.kind = 'REPLACEMENT' then
      update public.fdrs set replaced_fdr = fdr_number, fdr_number = upper(r.payload->>'fdrNumber'), bank_name = r.payload->>'bankName', branch_name = r.payload->>'branchName',
             ifsc_code = upper(r.payload->>'ifscCode'), amount = (r.payload->>'amount')::numeric, issue_date = current_date, maturity_date = (r.payload->>'maturityDate')::date,
             is_lien_confirmed = false, lien_endorsement_token = null, lien_endorsed_at = null, lien_confirmation_source = null, lien_confirmed_by = null,
             lien_confirmed_by_name = null, renewal_status = 'REPLACED', updated_at = now() where id = f.id;
    else
      update public.fdrs set released = true, released_at = now(), release_request_id = r.id, updated_at = now() where id = f.id;
    end if;
  else
    update public.fdrs set renewal_status = case when r.kind = 'RELEASE' then renewal_status else 'REQUEST_REJECTED' end, updated_at = now() where id = f.id;
  end if;
  perform public._audit(f.institution_id, me.id, me.full_name, me.role, format('FDR_%s_%s', r.kind, case when p_approve then 'APPROVED' else 'REJECTED' end), 'FDR', f.fdr_number,
    trim(p_note) || case when v_order <> '' and p_approve and r.kind = 'RELEASE' then format(' Release order %s.', v_order) else '' end);
  perform public._notify(f.institution_id, format('FDR %s request %s', lower(r.kind), case when p_approve then 'approved' else 'rejected' end),
    format('%s: %s', f.fdr_number, trim(p_note)) || case when p_approve and r.kind = 'RELEASE'
      then format(' AICTE release order %s. %s will now discharge the lien in its records; the deposit is paid out by the bank, not through this portal.', v_order, f.bank_name) else '' end,
    case when p_approve then 'SUCCESS' else 'WARNING' end, jsonb_build_object('route', 'fdrDetail', 'id', f.id));
end $$;

-- ------------------------------------------------------------------ bank confirms the lien discharge

create or replace function public.bank_discharge_lien(p_fdr_id uuid, p_reference text) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public._require_role(array['BANK_OFFICIAL']); f public.fdrs;
begin
  select * into f from public.fdrs where id = p_fdr_id for update;
  if not found then perform public._fail('NOT_FOUND', 'FDR not found.'); end if;
  if me.bank_name is distinct from f.bank_name then perform public._fail('FORBIDDEN', 'This FDR is held with another bank.'); end if;
  if not f.released then perform public._fail('INVALID_STATE', 'AICTE has not approved the release of this lien.'); end if;
  if f.lien_discharged_at is not null then perform public._fail('INVALID_STATE', 'The lien discharge is already recorded.'); end if;
  if length(trim(coalesce(p_reference, ''))) < 6 then perform public._fail('VALIDATION', 'Enter the CBS lien discharge reference.'); end if;
  update public.fdrs set lien_discharged_at = now(), lien_discharge_ref = trim(p_reference), lien_discharged_by = me.id,
         lien_discharged_by_name = format('%s (%s)', me.full_name, me.bank_name), updated_at = now() where id = f.id;
  perform public._audit(f.institution_id, me.id, me.full_name, me.role, 'FDR_LIEN_DISCHARGED', 'FDR', f.fdr_number,
    format('%s discharged the AICTE joint lien in CBS. Reference: %s', f.bank_name, trim(p_reference)));
  perform public._notify(f.institution_id, 'Joint lien discharged by the bank',
    format('%s discharged the AICTE lien on %s (reference %s). Contact your branch for payment of the deposit.', f.bank_name, f.fdr_number, trim(p_reference)), 'SUCCESS',
    jsonb_build_object('route', 'fdrDetail', 'id', f.id));
end $$;

-- Bank officials read the requests on their own bank's FDRs (they need the AICTE release order to discharge a lien).
drop policy if exists fdr_requests_read_bank on public.fdr_requests;
create policy fdr_requests_read_bank on public.fdr_requests for select to authenticated
  using (exists (select 1 from public.fdrs f where f.id = fdr_id and f.bank_name = public.my_bank()));

-- ------------------------------------------------------------------ institution app: lifecycle fields on each FDR

do $$
begin
  if to_regprocedure('public._portal_state_base()') is null then
    alter function public.get_portal_state() rename to _portal_state_base;
  end if;
end $$;

create or replace function public.get_portal_state() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s jsonb := public._portal_state_base();
begin
  return jsonb_set(s, '{fdrs}', coalesce((select jsonb_agg(e || jsonb_build_object(
      'bankConfirmation', jsonb_build_object(
        'source', case when not f.is_lien_confirmed then 'PENDING'
                       else coalesce(f.lien_confirmation_source, case when f.demo then 'DEMO_SIMULATED' else 'UNRECORDED' end) end,
        'by', f.lien_confirmed_by_name, 'at', f.lien_endorsed_at),
      'release', case when f.released then jsonb_build_object('approvedAt', f.released_at, 'approvedBy', r.decided_by_name, 'note', r.decision_note,
        'orderNumber', r.decision_evidence->>'orderNumber', 'orderDate', r.decision_evidence->>'orderDate',
        'dischargedAt', f.lien_discharged_at, 'dischargeRef', f.lien_discharge_ref, 'dischargedBy', f.lien_discharged_by_name) end)
    order by x.o)
    from jsonb_array_elements(s->'fdrs') with ordinality x(e, o)
    join public.fdrs f on f.id = (x.e->>'id')::uuid
    left join public.fdr_requests r on r.id = f.release_request_id), '[]'::jsonb));
end $$;

-- ------------------------------------------------------------------ grants

revoke execute on function public._portal_state_base(), public.run_daily_reminders(boolean), public.reminder_job_status(),
  public.decide_fdr_request(uuid, boolean, text, jsonb), public.bank_discharge_lien(uuid, text), public.get_portal_state() from public, anon, authenticated;
grant execute on function public.run_daily_reminders(boolean), public.reminder_job_status(), public.decide_fdr_request(uuid, boolean, text, jsonb),
  public.bank_discharge_lien(uuid, text), public.get_portal_state() to authenticated;
