-- =====================================================================================
-- One account, any portal.
--   * profiles.roles holds every role an account has registered for (profiles.role stays
--     the first one). Opening a portal whose role the account lacks asks for that portal's
--     details once (REGISTRATION_REQUIRED -> complete_registration) and adds the role.
--   * Server checks use roles; _require_role / _require_institution return the profile
--     with role set to the role being exercised, so workflow rules and audit entries
--     record the right one.
--   Safe to run more than once.
-- =====================================================================================

alter table public.profiles add column if not exists roles text[] not null default '{}';
update public.profiles set roles = array[role] where status = 'ACTIVE' and roles = '{}';

-- Activation clears needs_registration and records the role in roles.
create or replace function public._profile_activated() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'ACTIVE' then
    new.needs_registration := false;
    if not (new.role = any(new.roles)) then new.roles := new.roles || new.role; end if;
  end if;
  return new;
end $$;
drop trigger if exists profile_activated on public.profiles;
create trigger profile_activated before insert or update of status, role, roles on public.profiles
  for each row execute function public._profile_activated();

-- ------------------------------------------------------------------ role checks

create or replace function public.my_institution_id() returns uuid
language sql stable security definer set search_path = public as $$
  select institution_id from public.profiles where id = auth.uid() and status = 'ACTIVE' and 'INSTITUTION' = any(roles)
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'ACTIVE' and roles && array['REVIEWER','ADMIN'])
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'ACTIVE' and 'ADMIN' = any(roles))
$$;

create or replace function public.my_bank() returns text
language sql stable security definer set search_path = public as $$
  select bank_name from public.profiles where id = auth.uid() and status = 'ACTIVE' and 'BANK_OFFICIAL' = any(roles)
$$;

create or replace function public._require_role(p_roles text[]) returns public.profiles
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid() and status = 'ACTIVE';
  if not found or not (p.roles && p_roles) then perform public._fail('FORBIDDEN', 'You are not authorised to perform this action.'); end if;
  select r into p.role from unnest(p_roles) with ordinality as x(r, n) where r = any(p.roles) order by n limit 1;
  return p;
end $$;

create or replace function public._require_institution() returns public.profiles
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles;
begin
  if auth.uid() is null then perform public._fail('NOT_AUTHENTICATED', 'Sign in to continue.'); end if;
  select * into p from public.profiles where id = auth.uid();
  if not found or p.needs_registration then perform public._fail('REGISTRATION_REQUIRED', 'Complete your registration details to continue.'); end if;
  if p.status = 'DISABLED' then perform public._fail('ACCOUNT_DISABLED', 'This account has been disabled. Contact the Regulation Bureau IT Cell.'); end if;
  if p.status = 'PENDING_VERIFICATION' then perform public._fail('ACCOUNT_PENDING', 'Your account is awaiting verification by the State DTE / AICTE.'); end if;
  if not ('INSTITUTION' = any(p.roles)) then perform public._fail('REGISTRATION_REQUIRED', 'Register your institution to use this portal.'); end if;
  p.role := 'INSTITUTION';
  return p;
end $$;

-- ------------------------------------------------------------------ registration adds a role

create or replace function public._register_profile(p_uid uuid, p_email text, r jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_role   text := upper(coalesce(nullif(trim(r->>'role'), ''), 'INSTITUTION'));
  v_name   text := trim(coalesce(r->>'head', r->>'fullName', ''));
  v_mobile text := nullif(trim(coalesce(r->>'mobile', '')), '');
  v_pid    text := nullif(upper(trim(coalesce(r->>'pid', ''))), '');
  v_bank   text := nullif(trim(coalesce(r->>'bankName', '')), '');
  v_desig  text := nullif(trim(coalesce(r->>'designation', '')), '');
  v_inst   public.institutions; v_no text;
begin
  if v_role not in ('INSTITUTION','REVIEWER','ADMIN','BANK_OFFICIAL') then
    perform public._fail('VALIDATION', 'Choose a valid role.', '{"role":"Choose a role"}'); end if;
  if length(v_name) < 3 then
    perform public._fail('VALIDATION', 'Enter your full name.', jsonb_build_object(case when v_role = 'INSTITUTION' then 'head' else 'fullName' end, 'Enter your full name')); end if;
  if v_mobile is not null and regexp_replace(v_mobile, '\D', '', 'g') !~ '^(91|0)?[6-9][0-9]{9}$' then
    perform public._fail('VALIDATION', 'Enter a valid 10-digit Indian mobile number.', '{"mobile":"Enter a valid 10-digit Indian mobile number"}'); end if;

  if v_role = 'INSTITUTION' then
    if length(trim(coalesce(r->>'name', ''))) < 3 then
      perform public._fail('VALIDATION', 'Enter the institution name.', '{"name":"Institution name is required"}'); end if;
    if length(trim(coalesce(r->>'district', ''))) < 2 then
      perform public._fail('VALIDATION', 'Enter the district / city.', '{"district":"District / City is required"}'); end if;
    if v_pid is not null then
      select * into v_inst from public.institutions where pid = v_pid;
      if v_inst.id is not null and exists (select 1 from public.profiles where institution_id = v_inst.id and status = 'ACTIVE' and id <> p_uid) then
        perform public._fail('VALIDATION', 'This PID is already registered to another account. Sign in with that account.', '{"pid":"This PID is already registered"}'); end if;
    end if;
    if v_inst.id is null then
      insert into public.institutions(pid, name, city, district, state, region, type)
      values (coalesce(v_pid, '1-' || nextval('public.institution_pid_seq')), trim(r->>'name'), trim(r->>'district'), trim(r->>'district'),
              nullif(trim(coalesce(r->>'state', '')), ''), public._region_for(trim(coalesce(r->>'state', ''))), nullif(trim(coalesce(r->>'type', '')), ''))
      returning * into v_inst;
    end if;
  elsif v_role = 'BANK_OFFICIAL' and coalesce(length(v_bank), 0) < 3 then
    perform public._fail('VALIDATION', 'Bank officials need a bank name.', '{"bankName":"Enter your bank name"}');
  end if;

  -- A new account takes these details; an existing one keeps its name and gains the role.
  insert into public.profiles(id, email, full_name, designation, mobile, role, roles, status, institution_id, bank_name, needs_registration)
  values (p_uid, p_email, v_name,
          coalesce(v_desig, case v_role when 'INSTITUTION' then 'Head of Institution' when 'REVIEWER' then 'Scrutiny Officer'
                                       when 'ADMIN' then 'Administrator' else 'Bank Official' end),
          v_mobile, v_role, array[v_role], 'ACTIVE', v_inst.id, case when v_role = 'BANK_OFFICIAL' then v_bank end, false)
  on conflict (id) do update set
     full_name      = case when profiles.needs_registration or profiles.full_name = '' then excluded.full_name else profiles.full_name end,
     designation    = case when profiles.needs_registration then excluded.designation else profiles.designation end,
     mobile         = coalesce(excluded.mobile, profiles.mobile),
     role           = case when profiles.needs_registration or profiles.status <> 'ACTIVE' then excluded.role else profiles.role end,
     roles          = case when profiles.needs_registration then excluded.roles
                           when v_role = any(profiles.roles) then profiles.roles else profiles.roles || v_role end,
     status         = 'ACTIVE',
     institution_id = coalesce(excluded.institution_id, profiles.institution_id),
     bank_name      = coalesce(excluded.bank_name, profiles.bank_name),
     needs_registration = false;

  update public.registration_requests set status = 'ACTIVATED', payload = r
   where id = (select id from public.registration_requests where user_id = p_uid and status = 'FORWARDED_TO_DTE' order by created_at desc limit 1)
  returning request_no into v_no;
  if v_no is null then
    v_no := format('REG-%s-%s', extract(year from now())::int, lpad(nextval('public.registration_seq')::text, 5, '0'));
    insert into public.registration_requests(request_no, user_id, payload, status) values (v_no, p_uid, r, 'ACTIVATED');
  end if;
  perform public._audit(v_inst.id, p_uid, v_name, v_role, 'USER_REGISTERED', 'USER', p_email,
    format('%s registered as %s%s.', v_name, v_role, case when v_inst.id is not null then ' for ' || v_inst.name || ' (PID ' || v_inst.pid || ')' else '' end));
  return v_no;
end $$;

create or replace function public.complete_registration(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_prof public.profiles; v_email text; v_role text := upper(coalesce(nullif(trim(p->>'role'), ''), 'INSTITUTION'));
begin
  if auth.uid() is null then perform public._fail('NOT_AUTHENTICATED', 'Sign in to continue.'); end if;
  select * into v_prof from public.profiles where id = auth.uid() for update;
  if found and v_prof.status = 'DISABLED' then
    perform public._fail('ACCOUNT_DISABLED', 'This account has been disabled. Contact the Regulation Bureau IT Cell.'); end if;
  if found and not v_prof.needs_registration and v_role = any(v_prof.roles) then
    perform public._fail('ALREADY_REGISTERED', 'This account is already registered for this portal. Sign in to continue.'); end if;
  select email into v_email from auth.users where id = auth.uid();
  return jsonb_build_object('requestNo', public._register_profile(auth.uid(), v_email, p));
end $$;

revoke execute on function public._register_profile(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.complete_registration(jsonb) from public, anon;
grant execute on function public.complete_registration(jsonb) to authenticated;
