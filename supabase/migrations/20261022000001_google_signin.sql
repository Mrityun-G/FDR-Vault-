-- =====================================================================================
-- Google sign-in (Supabase Auth OAuth provider).
--   * Any Google account can sign in, but lands as PENDING_VERIFICATION unless its email
--     was pre-approved with admin_invite_user(email, pid, role).
--   * Pre-approved emails are activated and linked to their institution on first sign-in.
--   * Inviting an email that already has an account activates it immediately.
-- =====================================================================================

create table if not exists public.user_invites (
  email      text primary key check (email = lower(email)),
  pid        text,
  role       text not null default 'INSTITUTION' check (role in ('INSTITUTION','REVIEWER','ADMIN','BANK_OFFICIAL')),
  created_at timestamptz not null default now()
);
alter table public.user_invites enable row level security;   -- no policies: server functions only
revoke all on public.user_invites from anon, authenticated;

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
  insert into public.profiles(id, email, full_name, designation, mobile, role, status, institution_id)
  values (new.id, new.email,
          coalesce(v_reg->>'head', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
          'Head of Institution', v_reg->>'mobile', coalesce(v_inv.role, 'INSTITUTION'),
          case when v_active then 'ACTIVE' else 'PENDING_VERIFICATION' end, case when v_active then v_inst end)
  on conflict (id) do nothing;
  if v_reg is not null then
    v_no := format('REG-%s-%s', extract(year from now())::int, lpad(nextval('public.registration_seq')::text, 5, '0'));
    insert into public.registration_requests(request_no, user_id, payload) values (v_no, new.id, v_reg);
  end if;
  return new;
end $$;

create or replace trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Pre-approve an email (Google or password account) for an institution or a staff role.
create or replace function public.admin_invite_user(p_email text, p_pid text, p_role text default 'INSTITUTION') returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public._is_service() then perform public._require_role(array['ADMIN']); end if;
  if p_role = 'INSTITUTION' and not exists (select 1 from public.institutions where pid = p_pid) then
    perform public._fail('NOT_FOUND', 'Unknown institution PID.'); end if;
  insert into public.user_invites(email, pid, role) values (lower(trim(p_email)), p_pid, p_role)
  on conflict (email) do update set pid = excluded.pid, role = excluded.role;
  if exists (select 1 from auth.users where lower(email) = lower(trim(p_email))) then
    perform public.admin_link_user(lower(trim(p_email)), p_pid, p_role);
  end if;
end $$;

revoke execute on function public.admin_invite_user(text, text, text) from public, anon;
grant execute on function public.admin_invite_user(text, text, text) to authenticated;

-- Hardening flagged by the Supabase security advisor.
alter function public._is_service() set search_path = public;
alter function public._fail(text, text, jsonb) set search_path = public;
