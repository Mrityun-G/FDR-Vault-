-- =====================================================================================
-- Standalone-PostgreSQL adaptations. Runs AFTER supabase/migrations/*.sql.
-- =====================================================================================

-- Server jobs (daily reminders, demo-account setup) run without a signed-in user. On Supabase they were recognised
-- by the role name; here the API server marks its own service transactions with the aicte.service setting
-- (set_config(..., true), never reachable from a client request).
create or replace function public._is_service() returns boolean
language sql stable set search_path = public as $$
  select auth.uid() is null
     and (current_user in ('postgres', 'service_role') or current_setting('aicte.service', true) = 'on')
$$;

-- Live updates (replaces Supabase Realtime): every change to these tables sends a pg_notify the API server relays
-- to signed-in clients. The payload carries only the table and institution, never row data.
create or replace function public._emit_change() returns trigger
language plpgsql as $$
begin
  perform pg_notify('aicte_changes', json_build_object(
    'table', tg_table_name,
    'institution_id', case when tg_op = 'DELETE' then old.institution_id else new.institution_id end)::text);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['notifications', 'applications', 'fdrs', 'scrutiny', 'fdr_requests'] loop
    execute format('drop trigger if exists emit_change on public.%I', t);
    execute format('create trigger emit_change after insert or update or delete on public.%I for each row execute function public._emit_change()', t);
  end loop;
end $$;
