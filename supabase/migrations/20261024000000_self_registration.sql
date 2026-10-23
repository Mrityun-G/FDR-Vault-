-- =====================================================================================
-- Self-registration without administrator approval.
--   * Institutions, scrutiny officers, administrators and bank officials register with
--     their details (email + password, or Google) and are ACTIVE immediately.
--   * A Google sign-in with no details yet gets needs_registration = true; the app asks for
--     the details once (complete_registration) and never again on later logins.
--   * Institutions are linked to their PID if it exists and is unclaimed, otherwise a new
--     institution record is created.
--   * Administrator invites (user_invites) still work and take precedence.
--   Safe to run more than once.
-- =====================================================================================

alter table public.profiles add column if not exists needs_registration boolean not null default false;

create sequence if not exists public.institution_pid_seq start 20000001;

-- An account an administrator activates (admin_link_user, admin_invite_staff, admin_set_user_status) is registered.
create or replace function public._profile_activated() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'ACTIVE' then new.needs_registration := false; end if;
  return new;
end $$;
drop trigger if exists profile_activated on public.profiles;
create trigger profile_activated before insert or update of status on public.profiles for each row execute function public._profile_activated();

-- AICTE regional office for a state / union territory.
create or replace function public._region_for(p_state text) returns text
language sql immutable set search_path = public as $$
  select case
    when p_state in ('Madhya Pradesh','Chhattisgarh','Gujarat') then 'Central'
    when p_state in ('West Bengal','Odisha','Jharkhand','Bihar','Assam','Arunachal Pradesh','Manipur','Meghalaya','Mizoram',
                     'Nagaland','Sikkim','Tripura','Andaman and Nicobar Islands') then 'Eastern'
    when p_state in ('Uttar Pradesh','Uttarakhand') then 'North-Central'
    when p_state in ('Punjab','Haryana','Himachal Pradesh','Jammu and Kashmir','Ladakh','Chandigarh') then 'North-Western'
    when p_state in ('Andhra Pradesh','Telangana') then 'South-Central'
    when p_state in ('Tamil Nadu','Puducherry') then 'Southern'
    when p_state in ('Karnataka','Kerala','Lakshadweep') then 'South-Western'
    when p_state in ('Maharashtra','Goa','Dadra and Nagar Haveli and Daman and Diu') then 'Western'
    else 'Northern' end
$$;

-- Creates or completes the caller's profile from registration details and activates it. Returns the request number.
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

  insert into public.profiles(id, email, full_name, designation, mobile, role, status, institution_id, bank_name, needs_registration)
  values (p_uid, p_email, v_name,
          coalesce(v_desig, case v_role when 'INSTITUTION' then 'Head of Institution' when 'REVIEWER' then 'Scrutiny Officer'
                                       when 'ADMIN' then 'Administrator' else 'Bank Official' end),
          v_mobile, v_role, 'ACTIVE', v_inst.id, case when v_role = 'BANK_OFFICIAL' then v_bank end, false)
  on conflict (id) do update set full_name = excluded.full_name, designation = excluded.designation, mobile = excluded.mobile,
     role = excluded.role, status = 'ACTIVE', institution_id = excluded.institution_id, bank_name = excluded.bank_name, needs_registration = false;

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

-- Sign-up hook: invited emails get their invite; sign-ups with details are activated; bare Google sign-ins complete their details later.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_reg jsonb := new.raw_user_meta_data -> 'registration';
  v_inv public.user_invites; v_inst uuid;
begin
  select * into v_inv from public.user_invites where email = lower(new.email);
  if v_inv.email is not null then
    if v_inv.pid is not null then select id into v_inst from public.institutions where pid = v_inv.pid; end if;
    if v_inv.role <> 'INSTITUTION' or v_inst is not null then
      insert into public.profiles(id, email, full_name, designation, mobile, role, status, institution_id, bank_name)
      values (new.id, new.email,
              coalesce(v_inv.full_name, v_reg->>'head', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
              coalesce(v_inv.designation, case v_inv.role when 'INSTITUTION' then 'Head of Institution'
                                             when 'REVIEWER' then 'Scrutiny Officer' when 'ADMIN' then 'Administrator' else 'Bank Official' end),
              v_reg->>'mobile', v_inv.role, 'ACTIVE', v_inst, v_inv.bank_name)
      on conflict (id) do nothing;
      return new;
    end if;
  end if;
  if v_reg is not null then
    begin
      perform public._register_profile(new.id, new.email, v_reg);
      return new;
    exception when others then null;   -- invalid details: the user is asked for them again after signing in
    end;
  end if;
  insert into public.profiles(id, email, full_name, role, status, needs_registration)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), 'INSTITUTION', 'PENDING_VERIFICATION', true)
  on conflict (id) do nothing;
  return new;
end $$;

-- Called once by a signed-in user (typically after Google sign-in) to supply their registration details.
create or replace function public.complete_registration(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_prof public.profiles; v_email text;
begin
  if auth.uid() is null then perform public._fail('NOT_AUTHENTICATED', 'Sign in to continue.'); end if;
  select * into v_prof from public.profiles where id = auth.uid() for update;
  if found and not v_prof.needs_registration then
    perform public._fail('ALREADY_REGISTERED', 'This account is already registered. Sign in to continue.'); end if;
  select email into v_email from auth.users where id = auth.uid();
  return jsonb_build_object('requestNo', public._register_profile(auth.uid(), v_email, p));
end $$;

-- Institution RPCs: ask for registration details before anything else.
create or replace function public._require_institution() returns public.profiles
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles;
begin
  if auth.uid() is null then perform public._fail('NOT_AUTHENTICATED', 'Sign in to continue.'); end if;
  select * into p from public.profiles where id = auth.uid();
  if not found or p.needs_registration then perform public._fail('REGISTRATION_REQUIRED', 'Complete your registration details to continue.'); end if;
  if p.status = 'PENDING_VERIFICATION' then perform public._fail('ACCOUNT_PENDING', 'Your account is awaiting verification by the State DTE / AICTE.'); end if;
  if p.status = 'DISABLED' then perform public._fail('ACCOUNT_DISABLED', 'This account has been disabled. Contact the Regulation Bureau IT Cell.'); end if;
  if p.role <> 'INSTITUTION' then
    perform public._fail('ROLE_MISMATCH', format('This account (%s) is registered as %s. Sign in on the AICTE staff portal instead.', p.full_name, replace(p.role, '_', ' ')));
  end if;
  return p;
end $$;

-- Accounts left waiting for approval: activate those that sent details, ask the rest for them on next login.
update public.profiles set needs_registration = true where status = 'PENDING_VERIFICATION' and not needs_registration;
do $$
declare r record;
begin
  for r in select distinct on (rr.user_id) rr.user_id, rr.payload, u.email
             from public.registration_requests rr
             join auth.users u on u.id = rr.user_id
             join public.profiles p on p.id = rr.user_id
            where rr.status = 'FORWARDED_TO_DTE' and p.needs_registration
            order by rr.user_id, rr.created_at desc loop
    begin
      perform public._register_profile(r.user_id, r.email, r.payload);
    exception when others then null;
    end;
  end loop;
end $$;

revoke execute on function public._register_profile(uuid, text, jsonb), public._region_for(text) from public, anon, authenticated;
revoke execute on function public.complete_registration(jsonb) from public, anon;
grant execute on function public.complete_registration(jsonb) to authenticated;
