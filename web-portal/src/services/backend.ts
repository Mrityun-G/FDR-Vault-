/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * Staff portal data layer: reads the shared PostgreSQL database through the API server (row-level security decides what each
 * role can see) and performs every change through audited server functions (RPCs).
 */

import { api, DOCUMENTS_BUCKET } from '../lib/api';
import {
  User,
  UserRole,
  InstitutionApplication,
  DocumentEvidence,
  ValidationFinding,
  FdrRecord,
  FdrRequest,
  FdrStatus,
  AuditEvent,
  DirectoryUser,
  RegistrationRequest,
  UserInvite,
  RegulatoryNotification
} from '../types';

export const STAFF_ROLES: UserRole[] = ['REVIEWER', 'ADMIN', 'BANK_OFFICIAL'];

/** Details a staff member registers with (stored by the server's _register_profile; the account is active at once). */
export interface StaffRegistration {
  role: UserRole;
  fullName: string;
  designation: string;
  mobile: string;
  bankName?: string;
}
const EXPIRING_SOON_DAYS = 180;
const MIN_SQM_PER_STUDENT = 5.5;

/** Error raised by the server (`CODE: message`) or the network, with a message fit for display. */
export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export function toApiError(e: any): ApiError {
  if (e instanceof ApiError) return e;
  const msg = String(e?.message || e?.error_description || e?.msg || 'Unexpected error');
  const m = /^([A-Z_]+): ([\s\S]*)$/.exec(msg);
  if (m) return new ApiError(m[1], m[2]);
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return new ApiError('NETWORK', 'The server could not be reached. Check your connection and retry.');
  if (/JWT|token is expired|refresh token/i.test(msg)) return new ApiError('SESSION_EXPIRED', 'Your session has expired. Please sign in again.');
  if (/Invalid login credentials/i.test(msg)) return new ApiError('INVALID_CREDENTIALS', 'Invalid email or password. Check your credentials and try again.');
  if (/Email not confirmed/i.test(msg)) return new ApiError('EMAIL_NOT_CONFIRMED', 'Confirm your email address first (check your inbox).');
  return new ApiError('ERROR', msg);
}

async function rpc<T = any>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await api.rpc(fn, args);
  if (error) throw toApiError(error);
  return data as T;
}

function must<T>(res: { data: T | null; error: any }): T {
  if (res.error) throw toApiError(res.error);
  return (res.data ?? ([] as unknown)) as T;
}

/* ------------------------------------------------------------------ formatting helpers */

const daysUntil = (date: string) => Math.ceil((new Date(date + 'T00:00:00').getTime() - Date.now()) / 86400000);

export function formatRupees(amount: number): string {
  const rupees = `₹ ${Math.round(amount).toLocaleString('en-IN')}`;
  if (amount >= 1e7) return `${rupees} (${(amount / 1e7).toFixed(2)} Crore)`;
  if (amount >= 1e5) return `${rupees} (${(amount / 1e5).toFixed(2)} Lakh)`;
  return rupees;
}

const ratio = (n: number, d: number) => (d > 0 ? (n / d).toFixed(1).replace(/\.0$/, '') : '—');

/* ------------------------------------------------------------------ session / profile */

/**
 * Loads the signed-in account as one of `allowed` (the roles of the portal being opened). An account can hold
 * several roles; one that holds none of them is asked to register for this portal (REGISTRATION_REQUIRED).
 */
export async function loadProfile(allowed: UserRole[] = STAFF_ROLES): Promise<User> {
  const { data: auth } = await api.auth.getUser();
  if (!auth.user) throw new ApiError('NOT_AUTHENTICATED', 'Sign in to continue.');
  const p = must(await api.data('me')) as any;
  if (!p || p.needs_registration) throw new ApiError('REGISTRATION_REQUIRED', 'Complete your registration details to continue.');
  if (p.status === 'DISABLED') throw new ApiError('ACCOUNT_DISABLED', 'This account has been disabled. Contact the Regulation Bureau IT Cell.');
  if (p.status === 'PENDING_VERIFICATION') throw new ApiError('ACCOUNT_PENDING', 'Your account is awaiting verification.');
  const roles: UserRole[] = p.roles?.length ? p.roles : [p.role];
  const role = allowed.find(r => roles.includes(r));
  if (!role) throw new ApiError('REGISTRATION_REQUIRED', 'Register your details to use this portal.');
  return {
    id: p.id,
    name: p.full_name || p.email,
    email: p.email,
    role,
    designation: p.designation || '',
    bankName: p.bank_name || undefined,
    canApproveApplications: role === 'ADMIN'
  };
}

/* ------------------------------------------------------------------ applications */

function mapDocument(d: any): DocumentEvidence {
  const forensics = d.forensics || {};
  return {
    id: d.id,
    applicationId: d.application_id,
    docType: d.doc_type,
    fileName: d.file_name,
    fileSizeKb: Math.max(1, Math.round(Number(d.file_size_bytes) / 1024)),
    fileHash: d.file_hash,
    uploadedAt: d.uploaded_at,
    version: d.version,
    pageCount: d.page_count,
    status: d.status,
    extractedFields: Array.isArray(d.extracted_fields) ? d.extracted_fields : [],
    forensics: {
      sha256Match: !!forensics.sha256Match,
      duplicateApplicationId: forensics.duplicateApplicationId,
      duplicateInstitutionName: forensics.duplicateInstitutionName,
      qrCodeValid: !!forensics.qrCodeValid,
      qrPayload: forensics.qrPayload,
      dateChronologyValid: forensics.dateChronologyValid !== false,
      chronologyDetails: forensics.chronologyDetails,
      remarks: Array.isArray(forensics.remarks) ? forensics.remarks : []
    },
    geminiAnalysis: d.ai_analysis || undefined,
    storagePath: d.storage_path || undefined,
    mimeType: d.mime_type,
    validTill: d.valid_till || undefined
  };
}

function mapFinding(f: any): ValidationFinding {
  return {
    id: f.id,
    ruleId: f.rule_code,
    ruleCode: f.rule_code,
    ruleName: f.rule_name,
    severity: f.severity,
    description: f.description,
    docType: f.doc_type || undefined,
    evidenceSnippet: f.evidence_snippet || undefined,
    handbookClause: f.handbook_clause || '',
    isDeterministic: f.is_deterministic !== false,
    isOverridden: !!f.override,
    overrideDetails: f.override
      ? { overriddenBy: f.override.by, overriddenAt: f.override.at, rationale: f.override.rationale, statutoryCitation: f.override.citation }
      : undefined
  };
}

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2, PASSED: 3 };

function mapApplication(a: any): InstitutionApplication {
  const inst = a.institutions || {};
  const i = a.intake_details || {};
  const P = +i.professors || 0, A = +i.associateProfessors || 0, S = +i.assistantProfessors || 0;
  const faculty = +i.facultyCount || P + A + S;
  const students = +i.totalStudents || 0;
  const history = [...(a.status_history || [])].sort((x: any, y: any) => x.id - y.id);
  const sc = a.scrutiny ? (Array.isArray(a.scrutiny) ? a.scrutiny[0] : a.scrutiny) : null;
  const approvedAt = [...history].reverse().find((h: any) => h.to_status === 'APPROVED')?.at;
  const aiFindings: ValidationFinding[] = (Array.isArray(a.ai_findings) ? a.ai_findings : []).map((f: any, k: number) => ({
    id: `ai-${a.id}-${k}`,
    ruleId: f.ruleCode || 'AI-ADVISORY',
    ruleCode: f.ruleCode || 'AI-ADVISORY',
    ruleName: f.ruleName || 'AI advisory reading',
    severity: f.severity === 'CRITICAL' || f.severity === 'PASSED' ? f.severity : 'WARNING',
    description: f.description || '',
    handbookClause: f.handbookClause || 'Advisory only',
    evidenceSnippet: f.evidenceSnippet,
    docType: f.docType,
    isDeterministic: false
  }));
  return {
    id: a.id,
    applicationNumber: a.application_number,
    institutionId: a.institution_id,
    institutionName: inst.name || '—',
    pid: inst.pid || '—',
    region: inst.region,
    state: inst.state || '',
    city: inst.city || '',
    type: a.type,
    status: a.status,
    academicYear: a.academic_year,
    submittedAt: a.submitted_at,
    lastUpdatedAt: a.last_updated_at,
    currentVersion: a.current_version,
    intakeDetails: {
      currentTotalIntake: +i.currentTotalIntake || 0,
      proposedTotalIntake: +i.proposedTotalIntake || 0,
      totalStudents: students,
      facultyCount: faculty,
      studentFacultyRatio: faculty > 0 ? `1:${(students / faculty).toFixed(1)}` : '1:0',
      professors: P,
      associateProfessors: A,
      assistantProfessors: S,
      cadreRatioRatioStr: P > 0 ? `1 : ${ratio(A, P)} : ${ratio(S, P)}` : '—',
      totalBuiltUpAreaSqM: +i.totalBuiltUpAreaSqM || 0,
      requiredBuiltUpAreaSqM: Math.round(students * MIN_SQM_PER_STUDENT),
      fdrCorpusAmountLakhs: +i.fdrCorpusAmountLakhs || 0,
      requiredFdrAmountLakhs: +i.requiredFdrAmountLakhs || +inst.required_fdr_lakhs || 0
    },
    documents: (a.application_documents || [])
      .map(mapDocument)
      .sort((x: DocumentEvidence, y: DocumentEvidence) => x.uploadedAt.localeCompare(y.uploadedAt)),
    findings: [...(a.findings || []).map(mapFinding), ...aiFindings].sort(
      (x, y) => (SEVERITY_ORDER[x.severity] ?? 9) - (SEVERITY_ORDER[y.severity] ?? 9)
    ),
    scrutinyRecommendation: sc
      ? {
          status: sc.status === 'NOT_RECOMMENDED' ? 'REJECTED' : sc.status,
          reviewerId: sc.reviewer_id || '',
          reviewerName: sc.reviewer_name || '—',
          timestamp: sc.updated_at,
          rationale: sc.rationale || '',
          deficiencyPoints: sc.deficiency_points || [],
          officialNoticeNumber: sc.official_notice_number || undefined
        }
      : undefined,
    approvalDetails:
      a.status === 'APPROVED'
        ? {
            approvedBy: sc?.reviewer_name || 'AICTE Administrator',
            approvedAt: approvedAt || a.last_updated_at,
            eoaLetterNumber: `F.No. ${inst.region || 'AICTE'}/${inst.pid || ''}/${String(a.academic_year).slice(0, 4)}/EOA/${a.application_number}`,
            digitalSignFingerprint: 'Server-recorded decision — see the hash-chained Audit Trail'
          }
        : undefined,
    responses: (a.compliance_responses || [])
      .sort((x: any, y: any) => x.version - y.version)
      .map((r: any) => ({ version: r.version, submittedAt: r.submitted_at, points: r.points || [], files: r.files || [] })),
    history: history.map((h: any) => ({ from: h.from_status, to: h.to_status, at: h.at, actorRole: h.actor_role, note: h.note || '' }))
  };
}

export async function loadApplications(): Promise<InstitutionApplication[]> {
  // Each application with its institution, documents, findings, scrutiny, responses and history (newest first).
  const rows = must(await api.data('applications')) as any[];
  return rows.map(mapApplication);
}

/* ------------------------------------------------------------------ FDRs */

function mapRequest(r: any): FdrRequest {
  return {
    id: r.id,
    fdrId: r.fdr_id,
    kind: r.kind,
    status: r.status,
    payload: r.payload || {},
    reason: r.reason || undefined,
    requestedAt: r.requested_at,
    decidedBy: r.decided_by_name || undefined,
    decidedAt: r.decided_at || undefined,
    decisionNote: r.decision_note || undefined
  };
}

function fdrStatus(f: any): FdrStatus {
  if (f.released) return 'RELEASED';
  if (!f.is_lien_confirmed) return 'UNDER_VERIFICATION';
  const days = daysUntil(f.maturity_date);
  if (days <= 0) return 'MATURED';
  if (days <= EXPIRING_SOON_DAYS) return 'EXPIRING_SOON';
  return 'ACTIVE';
}

function mapFdr(f: any): FdrRecord {
  const inst = f.institutions || {};
  const requests = (f.fdr_requests || []).map(mapRequest).sort((x: FdrRequest, y: FdrRequest) => y.requestedAt.localeCompare(x.requestedAt));
  const release = requests.find((r: FdrRequest) => r.kind === 'RELEASE' && r.status !== 'REJECTED');
  const amount = Number(f.amount);
  return {
    id: f.id,
    fdrNumber: f.fdr_number,
    institutionId: f.institution_id,
    institutionName: inst.name || '—',
    pid: inst.pid || '—',
    applicationNumber: f.application_number || '—',
    amountLakhs: amount / 1e5,
    amountFormatted: formatRupees(amount),
    bankName: f.bank_name,
    branchName: f.branch_name,
    ifscCode: f.ifsc_code,
    issueDate: f.issue_date,
    maturityDate: f.maturity_date,
    tenureYears: f.tenure_years,
    status: fdrStatus(f),
    jointLienHolder: f.joint_lien_holder,
    isLienConfirmed: f.is_lien_confirmed,
    lienEndorsementToken: f.lien_endorsement_token || undefined,
    lienEndorsedAt: f.lien_endorsed_at || undefined,
    renewalStatus: f.renewal_status,
    releaseRequest: release
      ? {
          id: release.id,
          requestedAt: release.requestedAt,
          reason: release.reason || '',
          status: release.status,
          approvedBy: release.decidedBy,
          approvedAt: release.decidedAt
        }
      : undefined,
    requests,
    pendingRequest: requests.find((r: FdrRequest) => r.status === 'PENDING'),
    replacedFdr: f.replaced_fdr || undefined
  };
}

export async function loadFdrs(): Promise<FdrRecord[]> {
  // Each FDR with its institution and requests (earliest maturity first).
  const rows = must(await api.data('fdrs')) as any[];
  return rows.map(mapFdr);
}

/* ------------------------------------------------------------------ audit trail */

export async function loadAudit(): Promise<AuditEvent[]> {
  const rows = must(await api.data('audit_events')) as any[];   // latest 500
  return rows.map(e => ({
    id: String(e.id),
    correlationId: e.correlation_id,
    timestamp: e.created_at,
    actorId: e.actor_id || '',
    actorName: e.actor_name || 'System',
    actorRole: e.actor_role,
    action: e.action,
    targetType: e.target_type,
    targetId: e.target_id || '',
    details: e.details || '',
    ipAddress: e.ip_address || '—',
    sha256Hash: e.sha256_hash
  }));
}

/* ------------------------------------------------------------------ user directory (AICTE staff) */

export async function loadDirectory(isAdmin: boolean): Promise<{ users: DirectoryUser[]; registrations: RegistrationRequest[]; invites: UserInvite[] }> {
  const [profiles, regs, invites] = await Promise.all([
    api.data('profiles'),
    api.data('registration_requests'),
    isAdmin ? api.data('user_invites') : Promise.resolve({ data: [], error: null })
  ]);
  return {
    users: (must(profiles) as any[]).map(p => ({
      id: p.id,
      name: p.full_name || p.email,
      email: p.email,
      role: p.role,
      status: p.status,
      designation: p.designation || '',
      institutionName: p.institutions?.name,
      pid: p.institutions?.pid,
      bankName: p.bank_name || undefined,
      createdAt: p.created_at
    })),
    registrations: (must(regs) as any[]).map(r => ({
      requestNo: r.request_no,
      userId: r.user_id || undefined,
      status: r.status,
      createdAt: r.created_at,
      payload: r.payload || {}
    })),
    invites: (must(invites as any) as any[]).map(v => ({
      email: v.email,
      role: v.role,
      pid: v.pid || undefined,
      fullName: v.full_name || undefined,
      bankName: v.bank_name || undefined,
      createdAt: v.created_at
    }))
  };
}

export async function loadInstitutionList(): Promise<{ name: string; pid: string }[]> {
  const rows = must(await api.data('institutions')) as any[];
  return rows.map(r => ({ name: r.name, pid: r.pid }));
}

/* ------------------------------------------------------------------ work-queue notifications (derived) */

export function buildNotifications(user: User, apps: InstitutionApplication[], fdrs: FdrRecord[]): RegulatoryNotification[] {
  const out: RegulatoryNotification[] = [];
  const push = (n: Omit<RegulatoryNotification, 'isRead'>) => out.push({ ...n, isRead: false });
  if (user.role === 'BANK_OFFICIAL') {
    fdrs.filter(f => !f.isLienConfirmed && f.status !== 'RELEASED').forEach(f =>
      push({ id: `lien-${f.id}`, title: 'Joint lien endorsement pending', message: `${f.fdrNumber} (${f.institutionName}, ${f.amountFormatted}) awaits CBS lien endorsement.`, type: 'WARNING', timestamp: f.issueDate + 'T00:00:00Z', linkTab: 'verification_center', fdrNumber: f.fdrNumber })
    );
    return out.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }
  apps.filter(a => a.status === 'SUBMITTED').forEach(a =>
    push({ id: `new-${a.id}`, title: 'New application received', message: `${a.applicationNumber} from ${a.institutionName} is waiting for scrutiny.`, type: 'INFO', timestamp: a.submittedAt, linkTab: 'verification_center', applicationNumber: a.applicationNumber })
  );
  apps.filter(a => a.scrutinyRecommendation?.status === 'RESPONSE_SUBMITTED').forEach(a =>
    push({ id: `resp-${a.id}-${a.currentVersion}`, title: 'Compliance response received', message: `${a.institutionName} answered the deficiency notice on ${a.applicationNumber} (v${a.currentVersion}).`, type: 'WARNING', timestamp: a.lastUpdatedAt, linkTab: 'verification_center', applicationNumber: a.applicationNumber })
  );
  if (user.role === 'ADMIN') {
    apps.filter(a => a.status === 'SCRUTINY_CLEARED').forEach(a =>
      push({ id: `final-${a.id}`, title: 'Awaiting final approval', message: `${a.applicationNumber} (${a.institutionName}) was cleared by scrutiny and needs an administrator decision.`, type: 'SUCCESS', timestamp: a.lastUpdatedAt, linkTab: 'verification_center', applicationNumber: a.applicationNumber })
    );
    fdrs.filter(f => f.pendingRequest).forEach(f => {
      const r = f.pendingRequest!;
      push({ id: `req-${r.id}`, title: `FDR ${r.kind.toLowerCase()} request`, message: `${f.institutionName} requested ${r.kind.toLowerCase()} of ${f.fdrNumber}.`, type: 'WARNING', timestamp: r.requestedAt, linkTab: r.kind === 'RELEASE' ? 'release_requests' : 'renewals', fdrNumber: f.fdrNumber });
    });
  }
  fdrs.filter(f => f.status === 'EXPIRING_SOON' && daysUntil(f.maturityDate) <= 60 && !f.pendingRequest).forEach(f =>
    push({ id: `exp-${f.id}-${f.maturityDate}`, title: 'FDR maturing within 60 days', message: `${f.fdrNumber} (${f.institutionName}) matures on ${f.maturityDate}; no renewal filed yet.`, type: 'CRITICAL', timestamp: new Date().toISOString().slice(0, 10) + 'T00:00:00Z', linkTab: 'renewals', fdrNumber: f.fdrNumber })
  );
  return out.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/* ------------------------------------------------------------------ actions (all audited server-side) */

export const actions = {
  /** Scrutiny recommendation. Picks up a SUBMITTED application first where the server requires it. */
  async scrutinyDecision(app: InstitutionApplication, decision: 'RECOMMENDED_APPROVAL' | 'DEFICIENCIES_ISSUED' | 'REJECTED', rationale: string, points: string[]) {
    if (decision === 'DEFICIENCIES_ISSUED') {
      await rpc('review_request_clarification', { p_application_id: app.id, p_points: points, p_rationale: rationale });
      return;
    }
    if (app.status === 'SUBMITTED') await rpc('review_start', { p_application_id: app.id });
    await rpc('review_record_decision', {
      p_application_id: app.id,
      p_decision: decision === 'RECOMMENDED_APPROVAL' ? 'SCRUTINY_CLEARED' : 'REJECTED',
      p_rationale: rationale
    });
  },
  startScrutiny: (appId: string) => rpc('review_start', { p_application_id: appId }),
  finalDecision: (appId: string, approve: boolean, rationale: string) =>
    rpc('review_record_decision', { p_application_id: appId, p_decision: approve ? 'APPROVED' : 'REJECTED', p_rationale: rationale }),
  overrideFinding: (findingId: string, rationale: string, citation: string) =>
    rpc('review_override_finding', { p_finding_id: findingId, p_rationale: rationale, p_citation: citation }),
  endorseLien: (fdrId: string, token: string) => rpc('bank_endorse_lien', { p_fdr_id: fdrId, p_token: token }),
  decideFdrRequest: (requestId: string, approve: boolean, note: string) =>
    rpc('decide_fdr_request', { p_request_id: requestId, p_approve: approve, p_note: note }),
  completeRegistration: (details: StaffRegistration) => rpc('complete_registration', { p: details }),
  inviteStaff: (email: string, role: UserRole, fullName: string, designation: string, bankName: string) =>
    rpc('admin_invite_staff', { p_email: email, p_role: role, p_full_name: fullName, p_designation: designation, p_bank_name: bankName || null }),
  inviteInstitution: (email: string, pid: string) => rpc('admin_invite_user', { p_email: email, p_pid: pid, p_role: 'INSTITUTION' }),
  setUserStatus: (userId: string, status: 'ACTIVE' | 'DISABLED') => rpc('admin_set_user_status', { p_user_id: userId, p_status: status }),
  rejectRegistration: (requestNo: string, reason: string) => rpc('admin_reject_registration', { p_request_no: requestNo, p_reason: reason }),

  /** Short-lived signed link to an uploaded original (storage policies limit this to AICTE staff). */
  async documentUrl(storagePath: string): Promise<string> {
    const { data, error } = await api.storage.from(DOCUMENTS_BUCKET).createSignedUrl(storagePath, 300);
    if (error) throw toApiError(error);
    return data.signedUrl;
  }
};
