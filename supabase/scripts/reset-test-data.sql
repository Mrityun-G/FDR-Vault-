-- =====================================================================================
-- Reset the live database to an empty portal for manual testing.
--   Deletes: every application, document record, finding, FDR, FDR request, notification,
--            ticket, draft, audit entry, registration request and invite, every login account
--            except the ones listed in keep, and every institution no kept account uses.
--   Keeps:   the 4 demo login accounts (and the demo institution DITS Delhi, now with no
--            applications or FDRs), the schema, rule_config (v2026.1), the storage bucket and
--            the daily FDR reminder job.
--   Uploaded files (storage.objects) are not touched here; to remove them as well, run
--   delete from storage.objects where bucket_id = 'institution-documents';
-- Run with psql against the database (npm run db:migrate -- --seed --reset-test-data runs it on a NEW
-- database only). One block, so it runs all-or-nothing. It cannot be undone.
-- =====================================================================================

do $$
declare
  keep text[] := array[
    'sih_demo.institution@example.com', 'sih_demo.officer@example.com',
    'sih_demo.bank@example.com', 'sih_demo.admin@example.com'
    -- , 'fmonikt@gmail.com'   -- remove the -- at the start of this line to keep your own administrator too
  ];
begin
  truncate public.application_drafts, public.tickets, public.audit_events, public.notifications,
           public.review_notes, public.status_history, public.compliance_responses, public.scrutiny,
           public.findings, public.application_documents, public.applications, public.fdr_requests,
           public.fdrs, public.registration_requests, public.user_invites;

  -- Profiles cascade from auth.users.
  delete from auth.users u where lower(u.email) <> all (select lower(e) from unnest(keep) e);

  delete from public.institutions i where not exists (select 1 from public.profiles p where p.institution_id = i.id);

  -- Numbering starts again from the beginning (applications, notices, REG- numbers, new PIDs).
  alter sequence public.application_seq restart;
  alter sequence public.registration_seq restart;
  alter sequence if exists public.institution_pid_seq restart;
end $$;

-- Check: data counts should be 0; institutions 1 (DITS Delhi); accounts 4 plus any you added.
select (select count(*) from public.institutions) as institutions, (select count(*) from public.applications) as applications,
       (select count(*) from public.fdrs) as fdrs, (select count(*) from public.notifications) as notifications,
       (select count(*) from public.audit_events) as audit_events, (select count(*) from auth.users) as accounts;
