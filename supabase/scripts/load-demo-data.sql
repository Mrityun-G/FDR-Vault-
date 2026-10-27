-- =====================================================================================
-- Full demo dataset for every portal, on top of supabase/seed.sql (run that first).
--   Institution app (sih_demo.institution → DITS Delhi): applications in every status
--     (submitted, under scrutiny, deficiency notice to answer, cleared, approved, rejected),
--     FDRs in every state (active, expiring, matured, awaiting lien, released), pending
--     renewal/release requests, compliance replies, tickets and notifications.
--   Officer portal (sih_demo.officer): 14 applications across 7 institutions to review.
--   Bank portal (sih_demo.bank, State Bank of India): 3 FDRs awaiting joint-lien endorsement.
--   Admin portal (sih_demo.admin): pending FDR renewal/replacement/release requests to decide,
--     staff invites and the audit trail.
-- Only adds: every row is skipped if it already exists, so it is safe to run more than once.
-- Usage: npm run db:demo-data   (or paste seed.sql, then this file, into a SQL console)
-- =====================================================================================

begin;

-- ------------------------------------------------------------------ helpers (dropped with the session)

create or replace function pg_temp.inst(p_pid text) returns uuid language sql stable as
  $$ select id from public.institutions where pid = p_pid $$;
create or replace function pg_temp.staff(p_email text) returns uuid language sql stable as
  $$ select id from public.profiles where lower(email) = lower(p_email) $$;

create or replace function pg_temp.fdr(p_pid text, p_no text, p_app text, p_lakhs numeric, p_bank text, p_branch text, p_ifsc text,
  p_issue date, p_maturity date, p_token text, p_endorsed timestamptz, p_renewal text default 'NOT_APPLICABLE', p_released boolean default false)
returns void language sql as $$
  insert into public.fdrs(institution_id, fdr_number, application_number, amount, bank_name, branch_name, ifsc_code, issue_date, maturity_date,
                          tenure_years, joint_lien_holder, is_lien_confirmed, lien_endorsement_token, lien_endorsed_at, renewal_status, released)
  select i.id, p_no, p_app, p_lakhs * 100000, p_bank, p_branch, p_ifsc, p_issue, p_maturity, round((p_maturity - p_issue) / 365.25)::int,
         format('Regional Officer, %s Regional Office, AICTE', i.region), p_token is not null, p_token, p_endorsed, p_renewal, p_released
    from public.institutions i where i.pid = p_pid
  on conflict (fdr_number) do nothing
$$;

-- One request per FDR and kind. A new pending request also marks the FDR as submitted, as request_fdr_renewal does.
create or replace function pg_temp.fdr_request(p_fdr text, p_kind text, p_status text, p_payload jsonb, p_reason text, p_at timestamptz,
  p_decided_by text default null, p_decided_at timestamptz default null, p_note text default null)
returns void language plpgsql as $$
declare f public.fdrs;
begin
  select * into f from public.fdrs where fdr_number = p_fdr;
  if not found or exists (select 1 from public.fdr_requests r where r.fdr_id = f.id and (r.kind = p_kind or r.status = 'PENDING')) then return; end if;
  insert into public.fdr_requests(fdr_id, institution_id, kind, status, payload, reason, requested_at, decided_by_name, decided_at, decision_note)
  values (f.id, f.institution_id, p_kind, p_status, coalesce(p_payload, '{}'), p_reason, p_at, p_decided_by, p_decided_at, p_note);
  if p_status = 'PENDING' and p_kind <> 'RELEASE' then
    update public.fdrs set renewal_status = p_kind || '_SUBMITTED', updated_at = p_at where id = f.id;
  end if;
end $$;

-- An application with its documents, findings, scrutiny, compliance replies, status history and staff notes.
-- Children are only added when the application itself is new.
--   docs:      [{type, file, kb, pages, status, validTill, summary, attrs, anomalies}]
--   findings:  [{code, name, severity, text, clause, evidence, doc}]
--   scrutiny:  {status, reviewer, reviewerEmail, rationale, points, notice, at}
--   history:   [{to, role, note, at}]       (from_status follows from the previous entry)
--   responses: [{version, at, points: [{point, response}], files: [{fileName}]}]
--   notes:     [{email, note, at}]
create or replace function pg_temp.app(p_pid text, p_no text, p_type text, p_status text, p_year text, p_programme jsonb, p_intake jsonb,
  p_fdr text, p_version int, p_docs jsonb, p_findings jsonb, p_scrutiny jsonb, p_history jsonb,
  p_responses jsonb default '[]', p_notes jsonb default '[]')
returns void language plpgsql as $$
declare
  v_inst uuid := pg_temp.inst(p_pid); v_app uuid; v_prev text; d jsonb; h jsonb;
  v_first timestamptz := (p_history->0->>'at')::timestamptz; v_last timestamptz := (p_history->-1->>'at')::timestamptz;
begin
  if v_inst is null then return; end if;
  insert into public.applications(application_number, institution_id, type, status, academic_year, programme, intake_details, fdr_id, fdr_number,
                                  current_version, rule_version, declaration, submitted_at, last_updated_at, institution_snapshot)
  select p_no, v_inst, p_type, p_status, p_year, coalesce(p_programme, '{}'), coalesce(p_intake, '{}'),
         (select id from public.fdrs where fdr_number = p_fdr), p_fdr, p_version, 'v2026.1', true, v_first, v_last,
         jsonb_build_object('name', i.name, 'pid', i.pid, 'region', i.region, 'state', i.state, 'city', i.city)
    from public.institutions i where i.id = v_inst
  on conflict (application_number) do nothing
  returning id into v_app;
  if v_app is null then return; end if;

  for d in select * from jsonb_array_elements(coalesce(p_docs, '[]')) loop
    insert into public.application_documents(application_id, institution_id, doc_type, file_name, file_size_bytes, mime_type, file_hash, page_count,
                                             valid_till, version, status, ai_analysis, uploaded_at)
    values (v_app, v_inst, d->>'type', d->>'file', (d->>'kb')::bigint * 1024, 'application/pdf',
            encode(sha256(convert_to(p_no || '/' || (d->>'file'), 'UTF8')), 'hex'), coalesce((d->>'pages')::int, 1),
            (d->>'validTill')::date, coalesce((d->>'version')::int, 1), coalesce(d->>'status', 'PROCESSED'),
            case when d ? 'summary' then jsonb_build_object('status', 'COMPLETED', 'modelUsed', 'claude-sonnet-5-5', 'timestamp', v_first,
              'summary', d->>'summary', 'verifiedAttributes', coalesce(d->'attrs', '{}'), 'detectedAnomalies', coalesce(d->'anomalies', '[]'),
              'disclaimer', 'AI interpretation of the uploaded document. The Scrutiny Committee verifies the original.') end,
            v_first);
  end loop;

  insert into public.findings(application_id, rule_code, rule_name, severity, description, handbook_clause, evidence_snippet, doc_type, rule_version, created_at)
  select v_app, f->>'code', f->>'name', f->>'severity', f->>'text', f->>'clause', f->>'evidence', f->>'doc', 'v2026.1', v_first
    from jsonb_array_elements(coalesce(p_findings, '[]')) f;

  if p_scrutiny is not null then
    insert into public.scrutiny(application_id, institution_id, status, reviewer_id, reviewer_name, rationale, deficiency_points, official_notice_number, updated_at)
    values (v_app, v_inst, p_scrutiny->>'status', pg_temp.staff(p_scrutiny->>'reviewerEmail'), p_scrutiny->>'reviewer', p_scrutiny->>'rationale',
            coalesce(array(select jsonb_array_elements_text(p_scrutiny->'points')), '{}'), p_scrutiny->>'notice', (p_scrutiny->>'at')::timestamptz);
  end if;

  for h in select * from jsonb_array_elements(p_history) loop
    insert into public.status_history(application_id, institution_id, from_status, to_status, actor_role, note, at)
    values (v_app, v_inst, v_prev, h->>'to', h->>'role', h->>'note', (h->>'at')::timestamptz);
    v_prev := h->>'to';
  end loop;

  insert into public.compliance_responses(application_id, institution_id, version, points, files, submitted_at)
  select v_app, v_inst, (r->>'version')::int, r->'points', coalesce(r->'files', '[]'), (r->>'at')::timestamptz
    from jsonb_array_elements(coalesce(p_responses, '[]')) r;

  insert into public.review_notes(application_id, author_id, note, created_at)
  select v_app, pg_temp.staff(n->>'email'), n->>'note', (n->>'at')::timestamptz from jsonb_array_elements(coalesce(p_notes, '[]')) n;
end $$;

-- route 'appDetail' links an application number, 'fdrDetail' an FDR number. The dedupe key keeps reruns from repeating it.
create or replace function pg_temp.notify(p_pid text, p_key text, p_title text, p_message text, p_type text, p_route text, p_ref text,
  p_at timestamptz, p_read boolean default false)
returns void language sql as $$
  insert into public.notifications(institution_id, title, message, type, link, is_read, dedupe_key, created_at)
  select pg_temp.inst(p_pid), p_title, p_message, p_type,
         jsonb_build_object('route', p_route, 'id', case p_route when 'appDetail' then (select id from public.applications where application_number = p_ref)
                                                                 else (select id from public.fdrs where fdr_number = p_ref) end),
         p_read, 'demo:' || p_key, p_at
   where pg_temp.inst(p_pid) is not null
  on conflict (institution_id, dedupe_key) where dedupe_key is not null do nothing
$$;

create or replace function pg_temp.ticket(p_no text, p_pid text, p_category text, p_ref text, p_subject text, p_desc text, p_status text,
  p_at timestamptz, p_updates jsonb default '[]')
returns void language sql as $$
  insert into public.tickets(ticket_no, institution_id, category, ref, subject, description, status, updates, created_at)
  select p_no, pg_temp.inst(p_pid), p_category, p_ref, p_subject, p_desc, p_status, p_updates, p_at where pg_temp.inst(p_pid) is not null
  on conflict (ticket_no) do nothing
$$;

-- ------------------------------------------------------------------ institutions (DITS Delhi, BCE Bangalore and PAT Pune come from seed.sql)

insert into public.institutions(pid, name, short_name, city, district, state, region, type, address, website, sanctioned_intake, total_students, required_fdr_lakhs) values
  ('1-15520463', 'Chennai Institute of Engineering & Technology', 'CIET Chennai', 'Chennai', 'Chennai', 'Tamil Nadu', 'Southern', 'Unaided - Private',
   'Old Mahabalipuram Road, Sholinganallur, Chennai, Tamil Nadu - 600119', 'www.ciet-chennai.edu.in', 720, 2860, 100),
  ('1-17730264', 'Kolkata School of Technology', 'KST Kolkata', 'Kolkata', 'Kolkata', 'West Bengal', 'Eastern', 'Unaided - Private',
   'Sector V, Salt Lake, Kolkata, West Bengal - 700091', 'www.kst-kolkata.ac.in', 420, 1610, 100),
  ('1-16204558', 'Bhopal Institute of Engineering', 'BIE Bhopal', 'Bhopal', 'Bhopal', 'Madhya Pradesh', 'Central', 'Government Aided',
   'Raisen Road, Bhopal, Madhya Pradesh - 462021', 'www.bie-bhopal.ac.in', 540, 2050, 100),
  ('1-18839012', 'Guwahati Technical College', 'GTC Guwahati', 'Guwahati', 'Kamrup Metropolitan', 'Assam', 'North-Eastern', 'Unaided - Private',
   'Jalukbari, Guwahati, Assam - 781014', 'www.gtc-guwahati.edu.in', 300, 1120, 50)
on conflict (pid) do nothing;

-- ------------------------------------------------------------------ FDRs
-- Status on screen follows the data: no lien token = awaiting bank endorsement; maturity within 180 days = expiring soon.

select pg_temp.fdr('1-10928371', 'SBI-FDR-51630-2026', 'APP-2026-INTAKE-5520', 30, 'State Bank of India', 'Institutional Area Branch, New Delhi', 'SBIN0001234',
  '2026-10-20', '2036-10-19', null, null);
select pg_temp.fdr('1-10928371', 'PNB-FDR-64410-2025', 'APP-2025-NEW-7710', 40, 'Punjab National Bank', 'Model Town Branch, Delhi', 'PUNB0301100',
  '2025-03-12', '2035-03-11', 'CBS-PNB-LIEN-AUTH-64410', '2025-03-15 11:30+05:30');
select pg_temp.fdr('1-10928371', 'SBI-FDR-20118-2011', 'APP-2011-NEW-2011', 25, 'State Bank of India', 'Institutional Area Branch, New Delhi', 'SBIN0001234',
  '2011-07-01', '2021-06-30', 'CBS-SBI-LIEN-AUTH-20118', '2011-07-06 12:00+05:30', 'NOT_APPLICABLE', true);
select pg_temp.fdr('1-14829104', 'SBI-FDR-62290-2026', 'APP-2026-NEW-3307', 50, 'State Bank of India', 'MG Road Corporate Branch, Bangalore', 'SBIN0008892',
  '2026-10-23', '2036-10-22', null, null);
select pg_temp.fdr('1-15520463', 'SBI-FDR-73315-2017', 'APP-2017-EOA-7331', 100, 'State Bank of India', 'Anna Salai Branch, Chennai', 'SBIN0000911',
  '2017-02-15', '2027-02-14', 'CBS-SBI-LIEN-AUTH-73315', '2017-02-20 10:45+05:30');
select pg_temp.fdr('1-17730264', 'BARB-FDR-27719-2024', 'APP-2024-NEW-2771', 100, 'Bank of Baroda', 'Salt Lake Sector V Branch, Kolkata', 'BARB0SALTLA',
  '2024-06-03', '2034-06-02', 'CBS-BOB-LIEN-AUTH-27719', '2024-06-07 15:10+05:30');
select pg_temp.fdr('1-17730264', 'SBI-FDR-80551-2026', 'APP-2026-NEW-4458', 25, 'State Bank of India', 'Salt Lake City Branch, Kolkata', 'SBIN0010173',
  '2026-10-25', '2036-10-24', null, null);
select pg_temp.fdr('1-16204558', 'SBI-FDR-15092-2016', 'APP-2016-EOA-1509', 100, 'State Bank of India', 'TT Nagar Branch, Bhopal', 'SBIN0001308',
  '2016-08-01', '2036-07-31', 'CBS-SBI-REN-15092-26', '2016-08-05 11:00+05:30', 'RENEWED');
select pg_temp.fdr('1-18839012', 'SBI-FDR-09934-2016', 'APP-2016-NEW-0993', 50, 'State Bank of India', 'Pan Bazar Branch, Guwahati', 'SBIN0000221',
  '2016-06-15', '2026-06-14', 'CBS-SBI-LIEN-AUTH-09934', '2016-06-20 13:20+05:30');
select pg_temp.fdr('1-18839012', 'UCBA-FDR-44120-2026', 'APP-2026-CLOSE-0915', 50, 'UCO Bank', 'Fancy Bazar Branch, Guwahati', 'UCBA0000456',
  '2026-07-01', '2036-06-30', 'CBS-UCO-LIEN-AUTH-44120', '2026-07-04 12:00+05:30');

-- ------------------------------------------------------------------ FDR requests (the admin decides the pending ones)

select pg_temp.fdr_request('SBI-FDR-41207-2016', 'RENEWAL', 'PENDING',
  '{"mode": "extension", "maturityDate": "2036-12-29", "token": "CBS-SBI-REN-41207-26"}', null, '2026-10-24 10:15+05:30');
select pg_temp.fdr_request('PNB-FDR-30115-2016', 'RELEASE', 'PENDING', null,
  'The 10-year lock-in ended on 29-Sep-2026. The corpus requirement for AY 2026-27 is met by SBI-FDR-99201-2024 (Rs 100 Lakhs, lien confirmed).',
  '2026-10-05 16:40+05:30');
select pg_temp.fdr_request('SBI-FDR-73315-2017', 'REPLACEMENT', 'PENDING',
  '{"mode": "replacement", "fdrNumber": "CNRB-FDR-11842-2026", "bankName": "Canara Bank", "branchName": "T. Nagar Branch, Chennai", "ifscCode": "CNRB0000846", "amount": 12000000, "maturityDate": "2036-10-31"}',
  null, '2026-10-21 12:30+05:30');
select pg_temp.fdr_request('SBI-FDR-20118-2011', 'RELEASE', 'APPROVED', null,
  'Lock-in completed on 30-Jun-2021; replaced by the institution''s current corpus FDR.', '2021-07-08 11:00+05:30',
  'Shri R. C. Verma (Advisor)', '2021-07-15 15:30+05:30', 'Lien discharge approved. Bank advised to release the deposit to the institution.');
select pg_temp.fdr_request('SBI-FDR-15092-2016', 'RENEWAL', 'APPROVED',
  '{"mode": "extension", "maturityDate": "2036-07-31", "token": "CBS-SBI-REN-15092-26"}', null, '2026-06-18 10:00+05:30',
  'Demo Administrator (Administrator)', '2026-06-30 17:05+05:30', 'Renewal for a further 10 years verified with SBI CBS.');
select pg_temp.fdr_request('SBI-FDR-09934-2016', 'RELEASE', 'REJECTED', null,
  'FDR matured on 14-Jun-2026; requesting release of the deposit.', '2026-07-22 09:30+05:30',
  'Demo Administrator (Administrator)', '2026-08-02 12:15+05:30',
  'Not released: closure application APP-2026-CLOSE-0915 is still under scrutiny and students remain enrolled.');

-- ------------------------------------------------------------------ applications: DITS Delhi (the demo institution login)

select pg_temp.app('1-10928371', 'APP-2025-NEW-7710', 'NEW_PROGRAMME', 'APPROVED', '2025-26',
  '{"level": "UG", "programme": "B.Tech Artificial Intelligence & Data Science", "programmeIntake": 60}',
  '{"currentTotalIntake": 540, "proposedTotalIntake": 600, "totalStudents": 2280, "facultyCount": 118, "professors": 13, "associateProfessors": 27, "assistantProfessors": 78, "totalBuiltUpAreaSqM": 19850, "fdrCorpusAmountLakhs": 40, "requiredFdrAmountLakhs": 40}',
  'PNB-FDR-64410-2025', 1,
  '[{"type": "LAND_TITLE", "file": "Registered_Sale_Deed_Khasra_441.pdf", "kb": 4210, "pages": 18, "summary": "Title deed in the name of the applicant trust; contiguous 10.5-acre parcel.", "attrs": {"Land Title Status": "Clear & Unencumbered"}},
    {"type": "AFFILIATION", "file": "GGSIPU_Affiliation_Consent_AIDS_2025.pdf", "kb": 860, "pages": 3, "validTill": "2028-06-30", "summary": "GGSIPU consent of affiliation for B.Tech AI & DS, 60 seats.", "attrs": {"University": "GGSIPU", "Seats": "60"}},
    {"type": "FDR_CORPUS", "file": "PNB_FDR_64410_Joint_Lien.pdf", "kb": 640, "pages": 2, "summary": "FDR for Rs 40 Lakhs in joint name with AICTE, lien endorsed.", "attrs": {"Corpus Amount": "Rs 40 Lakhs", "Lien Status": "Recorded"}},
    {"type": "FACULTY_CADRE", "file": "Faculty_Cadre_Register_AY25.pdf", "kb": 2950, "pages": 11, "summary": "118 full-time faculty; cadre 13 : 27 : 78.", "attrs": {"Student Faculty Ratio": "1:19.3"}}]',
  '[{"code": "RULE-CHECKLIST-01", "name": "Mandatory Document Completeness", "severity": "PASSED", "text": "All mandatory documents for a new UG programme are present.", "clause": "Clause 2.4.1"},
    {"code": "RULE-CADRE-RATIO-05", "name": "Faculty-Student & Cadre Ratio Compliance", "severity": "PASSED", "text": "SFR 1:19.3 (norm <= 1:20); cadre 13 : 27 : 78 meets 1:2:6.", "clause": "Appendix 7"},
    {"code": "RULE-FDR-CORPUS-07", "name": "Joint FDR Corpus Fund & Lien Status", "severity": "PASSED", "text": "Rs 40 Lakhs FDR under joint lien with AICTE.", "clause": "Clause 6.2"}]',
  '{"status": "RECOMMENDED_APPROVAL", "reviewer": "Dr. Sunil K. Mehta", "rationale": "Faculty, laboratories and affiliation for the B.Tech AI & DS programme are verified. Recommended for approval.", "points": [], "at": "2025-05-12 16:00+05:30"}',
  '[{"to": "SUBMITTED", "role": "INSTITUTION", "note": "Application submitted", "at": "2025-03-18 11:20+05:30"},
    {"to": "UNDER_SCRUTINY", "role": "REVIEWER", "note": "Review started", "at": "2025-03-25 10:00+05:30"},
    {"to": "SCRUTINY_CLEARED", "role": "REVIEWER", "note": "Recommended for approval", "at": "2025-05-12 16:00+05:30"},
    {"to": "APPROVED", "role": "ADMIN", "note": "EoA issued: F.No. AICTE/NRO/EOA/2025/1187", "at": "2025-05-30 15:00+05:30"}]');

select pg_temp.app('1-10928371', 'APP-2026-INTAKE-5520', 'INTAKE_VARIATION', 'DEFICIENCIES_NOTED', '2026-27',
  '{"programme": "B.Tech Computer Science & Engineering", "change": "Increase in intake", "programmeIntake": 60}',
  '{"currentTotalIntake": 600, "proposedTotalIntake": 660, "totalStudents": 2640, "facultyCount": 124, "professors": 14, "associateProfessors": 28, "assistantProfessors": 82, "totalBuiltUpAreaSqM": 24200, "fdrCorpusAmountLakhs": 30, "requiredFdrAmountLakhs": 30}',
  'SBI-FDR-51630-2026', 1,
  '[{"type": "FACULTY_CADRE", "file": "Faculty_Roster_CSE_Expansion_2026.pdf", "kb": 3120, "pages": 13, "status": "FLAGGED", "summary": "124 faculty on roll; 132 needed for 2,640 students at SFR 1:20.", "attrs": {"Student Faculty Ratio": "1:21.3"}, "anomalies": ["Shortfall of 8 Assistant Professors for the proposed intake."]},
    {"type": "BUILDING_NOC", "file": "MCD_Building_Completion_NOC_Block_C.pdf", "kb": 1480, "pages": 5, "validTill": "2029-08-31", "summary": "Building completion certificate for the new academic block C.", "attrs": {"Built-up Area": "24,200 sq.m"}},
    {"type": "FDR_CORPUS", "file": "SBI_FDR_51630_Receipt.pdf", "kb": 510, "pages": 1, "summary": "FDR receipt for Rs 30 Lakhs; joint lien endorsement not yet recorded.", "attrs": {"Corpus Amount": "Rs 30 Lakhs", "Lien Status": "Pending"}, "anomalies": ["Bank CBS lien endorsement missing."]}]',
  '[{"code": "RULE-CADRE-RATIO-05", "name": "Faculty-Student & Cadre Ratio Compliance", "severity": "WARNING", "text": "For 2,640 students after expansion, 132 faculty are needed at SFR 1:20; 124 are on roll (shortfall of 8 Assistant Professors).", "clause": "Appendix 7", "doc": "FACULTY_CADRE"},
    {"code": "RULE-FDR-CORPUS-07", "name": "Joint FDR Corpus Fund & Lien Status", "severity": "WARNING", "text": "Joint lien on SBI-FDR-51630-2026 is not yet endorsed by the bank.", "clause": "Clause 6.2", "doc": "FDR_CORPUS"},
    {"code": "RULE-CHECKLIST-01", "name": "Mandatory Document Completeness", "severity": "PASSED", "text": "All documents required for an intake variation are present.", "clause": "Clause 2.4.1"}]',
  '{"status": "DEFICIENCIES_ISSUED", "reviewer": "Demo Scrutiny Officer", "reviewerEmail": "sih_demo.officer@example.com", "notice": "AICTE/NRO/DEF/2026/0612", "at": "2026-10-25 15:40+05:30",
    "rationale": "The intake increase can be recommended once the faculty shortfall is met and the FDR lien is endorsed.",
    "points": ["Faculty shortfall: 8 Assistant Professors are required for the proposed intake of 660 (SFR norm 1:20). Submit appointment orders or a recruitment schedule.",
               "Joint lien on SBI-FDR-51630-2026 (Rs 30 Lakhs) is pending bank CBS endorsement. Submit the bank lien confirmation."]}',
  '[{"to": "SUBMITTED", "role": "INSTITUTION", "note": "Application submitted", "at": "2026-10-20 12:05+05:30"},
    {"to": "UNDER_SCRUTINY", "role": "REVIEWER", "note": "Review started", "at": "2026-10-22 10:30+05:30"},
    {"to": "DEFICIENCIES_NOTED", "role": "REVIEWER", "note": "Deficiency notice AICTE/NRO/DEF/2026/0612 issued", "at": "2026-10-25 15:40+05:30"}]',
  '[]',
  '[{"email": "sih_demo.officer@example.com", "note": "Cross-checked the faculty register with the AICTE faculty database: 3 of 124 IDs show dual affiliation. Verify in the response.", "at": "2026-10-24 17:10+05:30"}]');

select pg_temp.app('1-10928371', 'APP-2026-NEW-6204', 'NEW_PROGRAMME', 'SCRUTINY_CLEARED', '2026-27',
  '{"level": "PG", "programme": "M.Tech VLSI Design", "programmeIntake": 18}',
  '{"currentTotalIntake": 600, "proposedTotalIntake": 618, "totalStudents": 2400, "facultyCount": 126, "professors": 16, "associateProfessors": 28, "assistantProfessors": 82, "totalBuiltUpAreaSqM": 24200, "fdrCorpusAmountLakhs": 100, "requiredFdrAmountLakhs": 100}',
  'SBI-FDR-99201-2024', 2,
  '[{"type": "AFFILIATION", "file": "GGSIPU_Consent_MTech_VLSI.pdf", "kb": 720, "pages": 3, "validTill": "2029-06-30", "summary": "University consent for M.Tech VLSI Design, 18 seats.", "attrs": {"Seats": "18"}},
    {"type": "FACULTY_CADRE", "file": "Faculty_Cadre_VLSI_Revised.pdf", "kb": 1960, "pages": 8, "version": 2, "summary": "Two Professors with VLSI specialisation added in the revised register.", "attrs": {"Professors (VLSI)": "2"}},
    {"type": "OTHER", "file": "VLSI_Lab_Equipment_and_EDA_Licences.pdf", "kb": 2240, "pages": 9, "summary": "EDA tool licences for 25 seats and FPGA lab equipment list.", "attrs": {"EDA Seats": "25"}}]',
  '[{"code": "RULE-CHECKLIST-01", "name": "Mandatory Document Completeness", "severity": "PASSED", "text": "All documents required for a new PG programme are present.", "clause": "Clause 2.4.1"},
    {"code": "RULE-CADRE-RATIO-05", "name": "Faculty-Student & Cadre Ratio Compliance", "severity": "PASSED", "text": "Two specialised Professors on roll after the compliance response.", "clause": "Appendix 7"},
    {"code": "RULE-FDR-CORPUS-07", "name": "Joint FDR Corpus Fund & Lien Status", "severity": "PASSED", "text": "Corpus met by SBI-FDR-99201-2024 (Rs 100 Lakhs, lien confirmed).", "clause": "Clause 6.2"}]',
  '{"status": "RECOMMENDED_APPROVAL", "reviewer": "Demo Scrutiny Officer", "reviewerEmail": "sih_demo.officer@example.com", "at": "2026-10-10 17:30+05:30", "points": [],
    "rationale": "The compliance response closes both points: two VLSI Professors joined on 15-Sep-2026 and EDA licences cover 25 seats. Recommended for approval."}',
  '[{"to": "SUBMITTED", "role": "INSTITUTION", "note": "Application submitted", "at": "2026-09-02 10:00+05:30"},
    {"to": "UNDER_SCRUTINY", "role": "REVIEWER", "note": "Review started", "at": "2026-09-08 11:00+05:30"},
    {"to": "DEFICIENCIES_NOTED", "role": "REVIEWER", "note": "Deficiency notice AICTE/NRO/DEF/2026/0418 issued", "at": "2026-09-15 16:20+05:30"},
    {"to": "UNDER_SCRUTINY", "role": "INSTITUTION", "note": "Compliance response v2", "at": "2026-09-28 13:45+05:30"},
    {"to": "SCRUTINY_CLEARED", "role": "REVIEWER", "note": "Recommended for approval", "at": "2026-10-10 17:30+05:30"}]',
  '[{"version": 2, "at": "2026-09-28 13:45+05:30",
     "points": [{"point": "Two Professors with VLSI specialisation are required for the PG programme.", "response": "Dr. Meera Iyer (Professor, VLSI) and Dr. Arjun Bhatia (Professor, Embedded Systems) joined on 15-Sep-2026. Appointment orders and AICTE faculty IDs attached."},
                {"point": "Proof of EDA tool licences for 18 seats.", "response": "Academic licence agreement for 25 seats, valid till 31-Aug-2029, attached."}],
     "files": [{"fileName": "Appointment_Orders_VLSI_Professors.pdf"}, {"fileName": "EDA_Academic_Licence_2026.pdf"}]}]');

select pg_temp.app('1-10928371', 'APP-2025-CLOSE-2207', 'CLOSURE', 'REJECTED', '2025-26',
  '{"programme": "Diploma in Civil Engineering", "change": "Closure of programme", "programmeIntake": 60}', '{}', null, 1,
  '[{"type": "AFFIDAVIT", "file": "Closure_Affidavit_Diploma_Civil.pdf", "kb": 380, "pages": 2, "summary": "Notarised affidavit for closure of the Diploma in Civil Engineering.", "attrs": {"Programme": "Diploma Civil"}},
    {"type": "OTHER", "file": "Governing_Body_Resolution_Closure.pdf", "kb": 290, "pages": 2}]',
  '[{"code": "RULE-CLOSURE-08", "name": "Closure: Enrolled Students Teach-out", "severity": "CRITICAL", "text": "94 students of the 2023 and 2024 batches are enrolled; no teach-out plan is attached.", "clause": "Clause 5.3"}]',
  '{"status": "NOT_RECOMMENDED", "reviewer": "Dr. Priya Nair", "at": "2025-02-26 12:00+05:30", "points": [],
    "rationale": "Closure would leave 94 enrolled students without a teach-out plan. Re-apply with an approved teach-out plan."}',
  '[{"to": "SUBMITTED", "role": "INSTITUTION", "note": "Application submitted", "at": "2025-01-10 10:30+05:30"},
    {"to": "UNDER_SCRUTINY", "role": "REVIEWER", "note": "Review started", "at": "2025-01-17 11:00+05:30"},
    {"to": "REJECTED", "role": "ADMIN", "note": "Not approved: no teach-out plan for enrolled students", "at": "2025-03-04 16:30+05:30"}]');

-- ------------------------------------------------------------------ applications: other institutions (seen by the officer and admin)

select pg_temp.app('1-14829104', 'APP-2026-NEW-3307', 'NEW_PROGRAMME', 'SUBMITTED', '2026-27',
  '{"level": "UG", "programme": "B.Tech Robotics & Automation", "programmeIntake": 60}',
  '{"currentTotalIntake": 840, "proposedTotalIntake": 900, "totalStudents": 3120, "facultyCount": 138, "professors": 8, "associateProfessors": 22, "assistantProfessors": 108, "totalBuiltUpAreaSqM": 21500, "fdrCorpusAmountLakhs": 50, "requiredFdrAmountLakhs": 50}',
  'SBI-FDR-62290-2026', 1,
  '[{"type": "AFFILIATION", "file": "VTU_Consent_Robotics_2026.pdf", "kb": 640, "pages": 3, "validTill": "2029-07-31"},
    {"type": "FDR_CORPUS", "file": "SBI_FDR_62290_Receipt.pdf", "kb": 470, "pages": 1},
    {"type": "FACULTY_CADRE", "file": "BCE_Faculty_Roster_Oct_2026.pdf", "kb": 2810, "pages": 16, "status": "FLAGGED"}]',
  '[{"code": "RULE-CADRE-RATIO-05", "name": "Faculty-Student & Cadre Ratio Compliance", "severity": "CRITICAL", "text": "SFR is 1:22.6 (norm <= 1:20) and 9 Professor posts are short; a new programme adds to the deficit.", "clause": "Appendix 7", "doc": "FACULTY_CADRE"},
    {"code": "RULE-FDR-CORPUS-07", "name": "Joint FDR Corpus Fund & Lien Status", "severity": "WARNING", "text": "Joint lien on SBI-FDR-62290-2026 is awaiting bank endorsement.", "clause": "Clause 6.2"}]',
  null,
  '[{"to": "SUBMITTED", "role": "INSTITUTION", "note": "Application submitted", "at": "2026-10-23 14:30+05:30"}]');

select pg_temp.app('1-15520463', 'APP-2026-EOA-8830', 'EOA', 'UNDER_SCRUTINY', '2026-27', '{}',
  '{"currentTotalIntake": 720, "proposedTotalIntake": 720, "totalStudents": 2860, "facultyCount": 146, "professors": 16, "associateProfessors": 33, "assistantProfessors": 97, "totalBuiltUpAreaSqM": 26800, "fdrCorpusAmountLakhs": 100, "requiredFdrAmountLakhs": 100}',
  'SBI-FDR-73315-2017', 1,
  '[{"type": "FIRE_SAFETY", "file": "TNFRS_Fire_NOC_2025.pdf", "kb": 1210, "pages": 4, "validTill": "2028-03-31"},
    {"type": "FDR_CORPUS", "file": "SBI_FDR_73315_Lien_Letter.pdf", "kb": 520, "pages": 2},
    {"type": "FACULTY_CADRE", "file": "CIET_Faculty_Register_AY26.pdf", "kb": 3300, "pages": 14}]',
  '[{"code": "RULE-FDR-MATURITY-09", "name": "FDR Validity Through the Approval Year", "severity": "WARNING", "text": "SBI-FDR-73315-2017 matures on 14-Feb-2027, inside AY 2026-27. A replacement request is pending.", "clause": "Clause 6.3"},
    {"code": "RULE-CADRE-RATIO-05", "name": "Faculty-Student & Cadre Ratio Compliance", "severity": "PASSED", "text": "SFR 1:19.6 (norm <= 1:20).", "clause": "Appendix 7"},
    {"code": "RULE-CHECKLIST-01", "name": "Mandatory Document Completeness", "severity": "PASSED", "text": "All mandatory documents are present.", "clause": "Clause 2.4.1"}]',
  '{"status": "IN_PROGRESS", "reviewer": "Demo Scrutiny Officer", "reviewerEmail": "sih_demo.officer@example.com", "at": "2026-10-19 11:45+05:30", "points": [],
    "rationale": "Waiting for the FDR replacement (Canara Bank) to be approved before recommending EoA."}',
  '[{"to": "SUBMITTED", "role": "INSTITUTION", "note": "Application submitted", "at": "2026-10-14 09:50+05:30"},
    {"to": "UNDER_SCRUTINY", "role": "REVIEWER", "note": "Review started", "at": "2026-10-19 11:45+05:30"}]');

select pg_temp.app('1-17730264', 'APP-2026-NEW-4458', 'NEW_PROGRAMME', 'SUBMITTED', '2026-27',
  '{"level": "UG", "programme": "B.Tech Computer Science & Engineering (Cyber Security)", "programmeIntake": 60}',
  '{"currentTotalIntake": 420, "proposedTotalIntake": 480, "totalStudents": 1610, "facultyCount": 88, "professors": 10, "associateProfessors": 19, "assistantProfessors": 59, "totalBuiltUpAreaSqM": 15400, "fdrCorpusAmountLakhs": 25, "requiredFdrAmountLakhs": 25}',
  'SBI-FDR-80551-2026', 1,
  '[{"type": "AFFILIATION", "file": "MAKAUT_Consent_CSE_Cyber.pdf", "kb": 610, "pages": 3, "validTill": "2029-06-30"},
    {"type": "FDR_CORPUS", "file": "SBI_FDR_80551_Receipt.pdf", "kb": 455, "pages": 1}]',
  '[{"code": "RULE-FDR-CORPUS-07", "name": "Joint FDR Corpus Fund & Lien Status", "severity": "WARNING", "text": "Joint lien on SBI-FDR-80551-2026 is awaiting bank endorsement.", "clause": "Clause 6.2"},
    {"code": "RULE-CADRE-RATIO-05", "name": "Faculty-Student & Cadre Ratio Compliance", "severity": "PASSED", "text": "SFR 1:18.3 (norm <= 1:20).", "clause": "Appendix 7"}]',
  null,
  '[{"to": "SUBMITTED", "role": "INSTITUTION", "note": "Application submitted", "at": "2026-10-25 17:20+05:30"}]');

select pg_temp.app('1-17730264', 'APP-2026-INTAKE-1904', 'INTAKE_VARIATION', 'REJECTED', '2026-27',
  '{"programme": "B.Tech Electronics & Communication Engineering", "change": "Increase in intake", "programmeIntake": 120}',
  '{"currentTotalIntake": 420, "proposedTotalIntake": 540, "totalStudents": 1610, "facultyCount": 88, "professors": 10, "associateProfessors": 19, "assistantProfessors": 59, "totalBuiltUpAreaSqM": 15400, "fdrCorpusAmountLakhs": 100, "requiredFdrAmountLakhs": 100}',
  'BARB-FDR-27719-2024', 2,
  '[{"type": "BUILDING_NOC", "file": "KMDA_Building_Plan_Approval.pdf", "kb": 1890, "pages": 6, "validTill": "2030-01-31", "status": "FLAGGED", "summary": "Approved built-up area is 15,400 sq.m.", "attrs": {"Built-up Area": "15,400 sq.m"}, "anomalies": ["Below the 18,900 sq.m needed for 540 seats."]}]',
  '[{"code": "RULE-AREA-10", "name": "Built-up Area for Sanctioned Intake", "severity": "CRITICAL", "text": "540 seats need 18,900 sq.m of built-up area; 15,400 sq.m is approved (shortfall 3,500 sq.m).", "clause": "Appendix 4", "doc": "BUILDING_NOC"}]',
  '{"status": "NOT_RECOMMENDED", "reviewer": "Demo Scrutiny Officer", "reviewerEmail": "sih_demo.officer@example.com", "at": "2026-10-08 15:00+05:30", "points": [],
    "rationale": "The response offers a construction schedule but no completed built-up area. The shortfall of 3,500 sq.m remains."}',
  '[{"to": "SUBMITTED", "role": "INSTITUTION", "note": "Application submitted", "at": "2026-08-11 10:10+05:30"},
    {"to": "UNDER_SCRUTINY", "role": "REVIEWER", "note": "Review started", "at": "2026-08-18 12:00+05:30"},
    {"to": "DEFICIENCIES_NOTED", "role": "REVIEWER", "note": "Deficiency notice AICTE/ERO/DEF/2026/0377 issued", "at": "2026-08-29 16:45+05:30"},
    {"to": "UNDER_SCRUTINY", "role": "INSTITUTION", "note": "Compliance response v2", "at": "2026-09-12 11:30+05:30"},
    {"to": "REJECTED", "role": "REVIEWER", "note": "Not approved: built-up area shortfall", "at": "2026-10-08 15:00+05:30"}]',
  '[{"version": 2, "at": "2026-09-12 11:30+05:30",
     "points": [{"point": "Built-up area shortfall of 3,500 sq.m for the proposed intake.", "response": "Block D (4,000 sq.m) is under construction and will be completed by March 2027. Construction schedule attached."}],
     "files": [{"fileName": "Block_D_Construction_Schedule.pdf"}]}]');

select pg_temp.app('1-16204558', 'APP-2026-EOA-6612', 'EOA', 'APPROVED', '2026-27', '{}',
  '{"currentTotalIntake": 540, "proposedTotalIntake": 540, "totalStudents": 2050, "facultyCount": 109, "professors": 12, "associateProfessors": 25, "assistantProfessors": 72, "totalBuiltUpAreaSqM": 20100, "fdrCorpusAmountLakhs": 100, "requiredFdrAmountLakhs": 100}',
  'SBI-FDR-15092-2016', 1,
  '[{"type": "FIRE_SAFETY", "file": "MP_Fire_NOC_2026.pdf", "kb": 980, "pages": 3, "validTill": "2029-04-30"},
    {"type": "FDR_CORPUS", "file": "SBI_FDR_15092_Renewal_Lien.pdf", "kb": 530, "pages": 2}]',
  '[{"code": "RULE-CHECKLIST-01", "name": "Mandatory Document Completeness", "severity": "PASSED", "text": "All mandatory documents are present.", "clause": "Clause 2.4.1"},
    {"code": "RULE-FDR-CORPUS-07", "name": "Joint FDR Corpus Fund & Lien Status", "severity": "PASSED", "text": "Renewed FDR SBI-FDR-15092-2016 under joint lien till 2036.", "clause": "Clause 6.2"}]',
  '{"status": "RECOMMENDED_APPROVAL", "reviewer": "Dr. Priya Nair", "at": "2026-05-28 14:00+05:30", "points": [], "rationale": "All norms met. Recommended for Extension of Approval."}',
  '[{"to": "SUBMITTED", "role": "INSTITUTION", "note": "Application submitted", "at": "2026-04-06 11:00+05:30"},
    {"to": "UNDER_SCRUTINY", "role": "REVIEWER", "note": "Review started", "at": "2026-04-15 10:00+05:30"},
    {"to": "SCRUTINY_CLEARED", "role": "REVIEWER", "note": "Recommended for approval", "at": "2026-05-28 14:00+05:30"},
    {"to": "APPROVED", "role": "ADMIN", "note": "EoA issued: F.No. AICTE/CRO/EOA/2026/0904", "at": "2026-06-12 12:00+05:30"}]');

select pg_temp.app('1-18839012', 'APP-2026-CLOSE-0915', 'CLOSURE', 'UNDER_SCRUTINY', '2026-27',
  '{"programme": "Diploma in Mechanical Engineering", "change": "Closure of programme", "programmeIntake": 30}', '{}',
  'UCBA-FDR-44120-2026', 1,
  '[{"type": "AFFIDAVIT", "file": "GTC_Closure_Affidavit.pdf", "kb": 350, "pages": 2},
    {"type": "OTHER", "file": "Teach_Out_Plan_Diploma_Mech.pdf", "kb": 820, "pages": 6}]',
  '[{"code": "RULE-CLOSURE-08", "name": "Closure: Enrolled Students Teach-out", "severity": "PASSED", "text": "Teach-out plan covers the 41 enrolled students until May 2028.", "clause": "Clause 5.3"}]',
  '{"status": "IN_PROGRESS", "reviewer": "Dr. Sunil K. Mehta", "at": "2026-08-02 12:00+05:30", "points": [], "rationale": "Verifying the teach-out plan with the State Board."}',
  '[{"to": "SUBMITTED", "role": "INSTITUTION", "note": "Application submitted", "at": "2026-07-20 15:15+05:30"},
    {"to": "UNDER_SCRUTINY", "role": "REVIEWER", "note": "Review started", "at": "2026-08-02 12:00+05:30"}]');

-- ------------------------------------------------------------------ notifications (institution app)

select pg_temp.notify('1-10928371', 'def-5520', 'Deficiency notice issued', 'Notice AICTE/NRO/DEF/2026/0612 on APP-2026-INTAKE-5520: 8 Assistant Professors short and the SBI lien is pending. Respond within 7 working days.', 'CRITICAL', 'appDetail', 'APP-2026-INTAKE-5520', '2026-10-25 15:40+05:30');
select pg_temp.notify('1-10928371', 'clear-6204', 'Scrutiny cleared', 'APP-2026-NEW-6204 (M.Tech VLSI Design) is recommended for approval.', 'SUCCESS', 'appDetail', 'APP-2026-NEW-6204', '2026-10-10 17:30+05:30', true);
select pg_temp.notify('1-10928371', 'lien-51630', 'FDR awaiting bank lien endorsement', 'SBI-FDR-51630-2026 (Rs 30 Lakhs) is with State Bank of India for CBS joint-lien endorsement.', 'INFO', 'fdrDetail', 'SBI-FDR-51630-2026', '2026-10-20 12:10+05:30');
select pg_temp.notify('1-10928371', 'ren-41207', 'FDR renewal submitted', 'Renewal request for SBI-FDR-41207-2016 is awaiting AICTE approval.', 'INFO', 'fdrDetail', 'SBI-FDR-41207-2016', '2026-10-24 10:15+05:30');
select pg_temp.notify('1-10928371', 'rel-30115', 'Release request submitted', 'Release request for PNB-FDR-30115-2016 is placed before the Regulation Bureau.', 'INFO', 'fdrDetail', 'PNB-FDR-30115-2016', '2026-10-05 16:40+05:30', true);
select pg_temp.notify('1-10928371', 'eoa-7710', 'Application approved', 'APP-2025-NEW-7710 (B.Tech AI & DS) approved. EoA F.No. AICTE/NRO/EOA/2025/1187.', 'SUCCESS', 'appDetail', 'APP-2025-NEW-7710', '2025-05-30 15:00+05:30', true);
select pg_temp.notify('1-10928371', 'rej-2207', 'Application not approved', 'APP-2025-CLOSE-2207: closure not approved without a teach-out plan for enrolled students.', 'CRITICAL', 'appDetail', 'APP-2025-CLOSE-2207', '2025-03-04 16:30+05:30', true);
select pg_temp.notify('1-15520463', 'rep-73315', 'FDR replacement submitted', 'Replacement of SBI-FDR-73315-2017 with Canara Bank FDR CNRB-FDR-11842-2026 is awaiting approval.', 'INFO', 'fdrDetail', 'SBI-FDR-73315-2017', '2026-10-21 12:30+05:30');
select pg_temp.notify('1-17730264', 'rej-1904', 'Application not approved', 'APP-2026-INTAKE-1904: built-up area shortfall of 3,500 sq.m.', 'CRITICAL', 'appDetail', 'APP-2026-INTAKE-1904', '2026-10-08 15:00+05:30');
select pg_temp.notify('1-16204558', 'eoa-6612', 'Application approved', 'APP-2026-EOA-6612 approved. EoA F.No. AICTE/CRO/EOA/2026/0904.', 'SUCCESS', 'appDetail', 'APP-2026-EOA-6612', '2026-06-12 12:00+05:30', true);
select pg_temp.notify('1-18839012', 'rel-09934', 'FDR release request rejected', 'SBI-FDR-09934-2016: not released while closure APP-2026-CLOSE-0915 is under scrutiny.', 'WARNING', 'fdrDetail', 'SBI-FDR-09934-2016', '2026-08-02 12:15+05:30');

-- ------------------------------------------------------------------ helpdesk tickets (institution app)

select pg_temp.ticket('TKT-2026-90001', '1-10928371', 'FDR / Security Deposit', 'SBI-FDR-51630-2026', 'Lien endorsement pending at SBI',
  'The FDR was deposited on 20-Oct-2026 but the joint lien is not yet showing as endorsed.', 'Open', '2026-10-24 09:40+05:30',
  '[{"by": "AICTE Helpdesk", "at": "2026-10-25T11:00:00+05:30", "text": "Forwarded to the SBI nodal officer for CBS endorsement."}]');
select pg_temp.ticket('TKT-2026-90002', '1-10928371', 'Technical Issue', 'APP-2026-INFRA-3312', 'Revised building plan larger than 10 MB',
  'The scanned building plan is 14 MB and the upload is refused.', 'Resolved', '2026-10-21 14:05+05:30',
  '[{"by": "AICTE Helpdesk", "at": "2026-10-21T16:30:00+05:30", "text": "Please split the plan into two PDFs of up to 10 MB each, or scan at 200 dpi."},
    {"by": "Dr. R. K. Sharma (Demo)", "at": "2026-10-22T09:15:00+05:30", "text": "Uploaded as two files. Thank you."}]');
select pg_temp.ticket('TKT-2026-90003', '1-10928371', 'Deficiency Notice', 'APP-2026-INTAKE-5520', 'Extension of time to answer the deficiency notice',
  'Recruitment interviews for 8 Assistant Professors are scheduled on 5-Nov-2026. Requesting 10 more days.', 'Open', '2026-10-26 18:20+05:30');
select pg_temp.ticket('TKT-2026-90004', '1-14829104', 'Login / Credentials', null, 'Add a second nodal officer',
  'Please add the Registrar as a second nodal officer for the portal.', 'Open', '2026-10-23 15:00+05:30');

-- ------------------------------------------------------------------ admin: staff invites not yet signed in

insert into public.user_invites(email, pid, role, full_name, designation, bank_name) values
  ('demo.reviewer2@example.com', null, 'REVIEWER', 'Dr. Kavita Joshi', 'Scrutiny Officer', null),
  ('demo.pnb.official@example.com', null, 'BANK_OFFICIAL', 'Shri Harpreet Singh', 'Branch Manager', 'Punjab National Bank'),
  ('demo.principal.ciet@example.com', '1-15520463', 'INSTITUTION', 'Dr. S. Venkatesan', 'Principal', null)
on conflict (email) do nothing;

-- ------------------------------------------------------------------ audit trail (once)

do $$
begin
  if exists (select 1 from public.audit_events where action = 'DEMO_DATA_LOADED' and target_id = 'full-demo') then return; end if;
  perform public._audit(pg_temp.inst('1-10928371'), null, 'AICTE Rule Engine v2026.1', 'SYSTEM', 'DETERMINISTIC_EVALUATION', 'APPLICATION', 'APP-2026-INTAKE-5520', 'Evaluated 3 deterministic rules: 1 passed, 2 warning(s), 0 critical.');
  perform public._audit(pg_temp.inst('1-10928371'), pg_temp.staff('sih_demo.officer@example.com'), 'Demo Scrutiny Officer', 'REVIEWER', 'DEFICIENCY_NOTICE_ISSUED', 'APPLICATION', 'APP-2026-INTAKE-5520', 'Issued notice AICTE/NRO/DEF/2026/0612: faculty shortfall and pending FDR lien.');
  perform public._audit(pg_temp.inst('1-10928371'), pg_temp.staff('sih_demo.officer@example.com'), 'Demo Scrutiny Officer', 'REVIEWER', 'SCRUTINY_RECOMMENDATION_CLEARED', 'APPLICATION', 'APP-2026-NEW-6204', 'Recommended for approval after compliance response v2.');
  perform public._audit(pg_temp.inst('1-10928371'), null, 'Dr. R. K. Sharma (Demo)', 'INSTITUTION', 'FDR_RENEWAL_REQUESTED', 'FDR', 'SBI-FDR-41207-2016', 'Extension requested for SBI-FDR-41207-2016; proposed maturity 2036-12-29.');
  perform public._audit(pg_temp.inst('1-10928371'), null, 'Dr. R. K. Sharma (Demo)', 'INSTITUTION', 'FDR_LIEN_RELEASE_REQUESTED', 'FDR', 'PNB-FDR-30115-2016', 'Lien discharge requested for PNB-FDR-30115-2016.');
  perform public._audit(pg_temp.inst('1-15520463'), null, 'CIET Chennai', 'INSTITUTION', 'FDR_REPLACEMENT_REQUESTED', 'FDR', 'SBI-FDR-73315-2017', 'Replacement with Canara Bank CNRB-FDR-11842-2026 (Rs 1.2 Crore) requested.');
  perform public._audit(pg_temp.inst('1-17730264'), pg_temp.staff('sih_demo.officer@example.com'), 'Demo Scrutiny Officer', 'REVIEWER', 'APPLICATION_REJECTED', 'APPLICATION', 'APP-2026-INTAKE-1904', 'Not recommended: built-up area shortfall of 3,500 sq.m.');
  perform public._audit(pg_temp.inst('1-16204558'), pg_temp.staff('sih_demo.admin@example.com'), 'Demo Administrator', 'ADMIN', 'FDR_RENEWAL_APPROVED', 'FDR', 'SBI-FDR-15092-2016', 'Renewal for a further 10 years verified with SBI CBS.');
  perform public._audit(pg_temp.inst('1-18839012'), pg_temp.staff('sih_demo.admin@example.com'), 'Demo Administrator', 'ADMIN', 'FDR_RELEASE_REJECTED', 'FDR', 'SBI-FDR-09934-2016', 'Not released while closure APP-2026-CLOSE-0915 is under scrutiny.');
  perform public._audit(null, null, 'Seed loader', 'SYSTEM', 'DEMO_DATA_LOADED', 'DATASET', 'full-demo', 'Full demo dataset loaded: 7 institutions, 14 applications, 15 FDRs.');
end $$;

commit;

-- Check: institutions 7, applications 14, fdrs 15, pending FDR requests 3, FDRs awaiting lien 3 (all SBI).
select (select count(*) from public.institutions) as institutions, (select count(*) from public.applications) as applications,
       (select count(*) from public.fdrs) as fdrs, (select count(*) from public.fdr_requests where status = 'PENDING') as pending_fdr_requests,
       (select count(*) from public.fdrs where not is_lien_confirmed) as fdrs_awaiting_lien;
