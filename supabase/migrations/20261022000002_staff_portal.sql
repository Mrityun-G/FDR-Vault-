-- =====================================================================================
-- Staff web portal (AICTE scrutiny officers, administrators, bank officials).
--   * Bank officials can read FDRs held with their own bank, and the owning institutions.
--   * Reviewers can record a finding override (reason and handbook citation, audited).
--   * Administrators can see pending registrations, invite staff, and enable or disable accounts.
--   Safe to run more than once (policies are dropped and re-created).
-- =====================================================================================

-- ------------------------------------------------------------------ bank officials

create or replace function public.my_bank() returns text
language sql stable security definer set search_path = public as $$
  select bank_name from public.profiles where id = auth.uid() and status = 'ACTIVE' and role = 'BANK_OFFICIAL'
$$;

drop policy if exists fdrs_read_bank on public.fdrs;
create policy fdrs_read_bank on public.fdrs for select to authenticated using (bank_name = public.my_bank());
drop policy if exists institutions_read_bank on public.institutions;
create policy institutions_read_bank on public.institutions for select to authenticated
  using (exists (select 1 from public.fdrs f where f.institution_id = institutions.id and f.bank_name = public.my_bank()));

-- ------------------------------------------------------------------ registrations and invites

drop policy if exists registrations_read_staff on public.registration_requests;
create policy registrations_read_staff on public.registration_requests for select to authenticated using (public.is_staff());
grant select on public.registration_requests to authenticated;

alter table public.user_invites add column if not exists full_name text;
alter table public.user_invites add column if not exists designation text;
alter table public.user_invites add column if not exists bank_name text;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'ACTIVE' and role = 'ADMIN')
$$;

drop policy if exists invites_read_admin on public.user_invites;
create policy invites_read_admin on public.user_invites for select to authenticated using (public.is_admin());
grant select on public.user_invites to authenticated;

-- Sign-up hook: pre-approved emails get their role, institution, name, designation and bank on first sign-in.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_reg jsonb := new.raw_user_meta_data -> 'registration'; v_no text;
  v_inv public.user_invites; v_inst uuid; v_active boolean := false;
begin
  select * into v_inv from public.user_invites where email = lower(new.email);
  if v_inv.email is not null then
    if v_inv.pid is not null then select id into v_inst from public.institutions where pid = v_inv.pid; end if;
    v_active := v_inv.role <> 'INSTITUTION' or v_inst is not null;
  end if;
  insert into public.profiles(id, email, full_name, designation, mobile, role, status, institution_id, bank_name)
  values (new.id, new.email,
          coalesce(v_inv.full_name, v_reg->>'head', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
          coalesce(v_inv.designation, case coalesce(v_inv.role, 'INSTITUTION') when 'INSTITUTION' then 'Head of Institution'
                                         when 'REVIEWER' then 'Scrutiny Officer' when 'ADMIN' then 'Administrator' else 'Bank Official' end),
          v_reg->>'mobile', coalesce(v_inv.role, 'INSTITUTION'),
          case when v_active then 'ACTIVE' else 'PENDING_VERIFICATION' end, case when v_active then v_inst end, v_inv.bank_name)
  on conflict (id) do nothing;
  if v_reg is not null then
    v_no := format('REG-%s-%s', extract(year from now())::int, lpad(nextval('public.registration_seq')::text, 5, '0'));
    insert into public.registration_requests(request_no, user_id, payload) values (v_no, new.id, v_reg);
  end if;
  return new;
end $$;

-- Invite (or immediately activate) an AICTE reviewer / administrator or a bank official.
create or replace function public.admin_invite_staff(p_email text, p_role text, p_full_name text, p_designation text default null, p_bank_name text default null)
returns void language plpgsql security definer set search_path = public as $$
declare me public.profiles; v_email text := lower(trim(coalesce(p_email, ''))); v_uid uuid;
begin
  if public._is_service() then me := null; else me := public._require_role(array['ADMIN']); end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then perform public._fail('VALIDATION', 'Enter a valid email address.'); end if;
  if p_role not in ('REVIEWER','ADMIN','BANK_OFFICIAL') then perform public._fail('VALIDATION', 'Choose a staff role.'); end if;
  if length(trim(coalesce(p_full_name, ''))) < 3 then perform public._fail('VALIDATION', 'Enter the full name.'); end if;
  if p_role = 'BANK_OFFICIAL' and length(trim(coalesce(p_bank_name, ''))) < 3 then perform public._fail('VALIDATION', 'Bank officials need a bank name.'); end if;
  insert into public.user_invites(email, pid, role, full_name, designation, bank_name)
  values (v_email, null, p_role, trim(p_full_name), nullif(trim(coalesce(p_designation, '')), ''), case when p_role = 'BANK_OFFICIAL' then trim(p_bank_name) end)
  on conflict (email) do update set pid = null, role = excluded.role, full_name = excluded.full_name,
     designation = excluded.designation, bank_name = excluded.bank_name;
  select id into v_uid from auth.users where lower(email) = v_email;
  if v_uid is not null then
    update public.profiles set role = p_role, status = 'ACTIVE', institution_id = null, full_name = trim(p_full_name),
           designation = coalesce(nullif(trim(coalesce(p_designation, '')), ''), designation),
           bank_name = case when p_role = 'BANK_OFFICIAL' then trim(p_bank_name) end
     where id = v_uid;
  end if;
  perform public._audit(null, me.id, coalesce(me.full_name, 'SQL editor'), coalesce(me.role, 'SYSTEM'), 'STAFF_INVITED', 'USER', v_email,
    format('%s invited as %s%s.', trim(p_full_name), p_role, case when p_role = 'BANK_OFFICIAL' then ' (' || trim(p_bank_name) || ')' else '' end));
end $$;

create or replace function public.admin_set_user_status(p_user_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public._require_role(array['ADMIN']); p public.profiles;
begin
  if p_status not in ('ACTIVE','DISABLED') then perform public._fail('VALIDATION', 'Unknown status.'); end if;
  if p_user_id = me.id then perform public._fail('FORBIDDEN', 'You cannot change your own account status.'); end if;
  select * into p from public.profiles where id = p_user_id for update;
  if not found then perform public._fail('NOT_FOUND', 'User not found.'); end if;
  if p_status = 'ACTIVE' and p.role = 'INSTITUTION' and p.institution_id is null then
    perform public._fail('VALIDATION', 'Link this account to an institution (approve its email with a PID) before activating it.'); end if;
  update public.profiles set status = p_status where id = p_user_id;
  perform public._audit(p.institution_id, me.id, me.full_name, me.role, 'USER_' || p_status, 'USER', p.email,
    format('%s set %s (%s) to %s.', me.full_name, p.email, p.role, p_status));
end $$;

create or replace function public.admin_reject_registration(p_request_no text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public._require_role(array['ADMIN']); r public.registration_requests;
begin
  if length(trim(coalesce(p_reason, ''))) < 10 then perform public._fail('VALIDATION', 'Give a reason (at least 10 characters).'); end if;
  select * into r from public.registration_requests where request_no = p_request_no and status = 'FORWARDED_TO_DTE' for update;
  if not found then perform public._fail('NOT_FOUND', 'No pending registration with this number.'); end if;
  update public.registration_requests set status = 'REJECTED', payload = payload || jsonb_build_object('rejectionReason', trim(p_reason)) where id = r.id;
  if r.user_id is not null then update public.profiles set status = 'DISABLED' where id = r.user_id; end if;
  perform public._audit(null, me.id, me.full_name, me.role, 'REGISTRATION_REJECTED', 'REGISTRATION', r.request_no, trim(p_reason));
end $$;

-- ------------------------------------------------------------------ reviewer override of a finding

alter table public.findings add column if not exists override jsonb;

create or replace function public.review_override_finding(p_finding_id uuid, p_rationale text, p_citation text) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public._require_role(array['REVIEWER','ADMIN']); f public.findings; a public.applications;
begin
  if length(trim(coalesce(p_rationale, ''))) < 10 then perform public._fail('VALIDATION', 'A reasoned justification (at least 10 characters) is mandatory.'); end if;
  if length(trim(coalesce(p_citation, ''))) < 3 then perform public._fail('VALIDATION', 'A handbook citation is mandatory.'); end if;
  select * into f from public.findings where id = p_finding_id for update;
  if not found then perform public._fail('NOT_FOUND', 'Finding not found.'); end if;
  if f.severity = 'PASSED' then perform public._fail('VALIDATION', 'Passed checks cannot be overridden.'); end if;
  if f.override is not null then perform public._fail('VALIDATION', 'This finding has already been overridden.'); end if;
  select * into a from public.applications where id = f.application_id;
  if a.status in ('APPROVED','REJECTED') then perform public._fail('VALIDATION', 'The application is already decided.'); end if;
  update public.findings set override = jsonb_build_object('byId', me.id, 'by', format('%s (%s)', me.full_name, me.designation),
         'at', now(), 'rationale', trim(p_rationale), 'citation', trim(p_citation)) where id = f.id;
  perform public._audit(a.institution_id, me.id, me.full_name, me.role, 'FINDING_OVERRIDE', 'APPLICATION', a.application_number,
    format('%s overridden. Citation: %s. Rationale: %s', f.rule_code, trim(p_citation), trim(p_rationale)));
end $$;

-- ------------------------------------------------------------------ privileges

revoke execute on function public.my_bank(), public.is_admin(), public.admin_invite_staff(text, text, text, text, text),
  public.admin_set_user_status(uuid, text), public.admin_reject_registration(text, text),
  public.review_override_finding(uuid, text, text) from public, anon;
grant execute on function public.my_bank(), public.is_admin(), public.admin_invite_staff(text, text, text, text, text),
  public.admin_set_user_status(uuid, text), public.admin_reject_registration(text, text),
  public.review_override_finding(uuid, text, text) to authenticated;
