/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * Type Definitions
 */

export type UserRole = 'INSTITUTION' | 'REVIEWER' | 'ADMIN' | 'BANK_OFFICIAL';

export type LoginPortalRole = 'AICTE_OFFICIAL' | 'INSTITUTION' | 'BANK_OFFICIAL';

export interface LoginCredentials {
  emailOrUserId: string;
  password: string;
  role: LoginPortalRole;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  designation: string;
  institutionId?: string;
  institutionName?: string;
  bankName?: string;
  bankBranch?: string;
  pid?: string;
  region?: string;
  canApproveApplications?: boolean;
}

export type ApplicationType =
  | 'EOA' // Extension of Approval
  | 'NEW_PROGRAMME' // Introduction of New Programme / Course
  | 'INTAKE_VARIATION' // Increase / Variation in Intake
  | 'INFRASTRUCTURE_UPDATE' // Campus / Carpet Area Expansion
  | 'CLOSURE'; // Closure of programme / institution

export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_SCRUTINY'
  | 'DEFICIENCIES_NOTED'
  | 'SCRUTINY_CLEARED'
  | 'APPROVED'
  | 'REJECTED';

export type DocumentType =
  | 'LAND_TITLE'
  | 'BUILDING_NOC'
  | 'FIRE_SAFETY'
  | 'FDR_CORPUS'
  | 'AFFILIATION_NOC'
  | 'STATE_DTE_NOC'
  | 'FACULTY_CADRE'
  | 'NBA_ACCREDITATION'
  // Codes used by the institution mobile app / server rule engine
  | 'AFFILIATION'
  | 'STATE_NOC'
  | 'BANK_LETTER'
  | 'AFFIDAVIT'
  | 'OTHER';

export interface ExtractedField {
  label: string;
  value: string;
  page: number;
  sourceLine: string;
  confidence?: number;
  isCoherent?: boolean;
}

export interface ForensicsData {
  sha256Match: boolean;
  duplicateApplicationId?: string;
  duplicateInstitutionName?: string;
  qrCodeValid: boolean;
  qrPayload?: {
    issuingAuthority: string;
    certId: string;
    issueDate: string;
    validTill: string;
    signerName: string;
  };
  dateChronologyValid: boolean;
  chronologyDetails?: string;
  remarks: string[];
}

export interface GeminiAnalysis {
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  modelUsed: string;
  timestamp: string;
  summary: string;
  verifiedAttributes: Record<string, string>;
  detectedAnomalies: string[];
  disclaimer: string;
}

export interface DocumentEvidence {
  id: string;
  applicationId: string;
  docType: DocumentType;
  fileName: string;
  fileSizeKb: number;
  fileHash: string; // SHA-256
  uploadedAt: string;
  version: number;
  pageCount: number;
  status: 'PROCESSED' | 'PENDING' | 'FLAGGED' | 'MANUAL_REVIEW_REQUIRED';
  extractedFields: ExtractedField[];
  forensics: ForensicsData;
  geminiAnalysis?: GeminiAnalysis;
  sourceTextPreview?: string;
  /** Path of the original file in the private document storage (opened through a short-lived signed link). */
  storagePath?: string;
  mimeType?: string;
  validTill?: string;
}

export type FindingSeverity = 'CRITICAL' | 'WARNING' | 'INFO' | 'PASSED';

export interface ValidationFinding {
  id: string;
  ruleId: string;
  ruleCode: string;
  ruleName: string;
  severity: FindingSeverity;
  description: string;
  documentId?: string;
  docType?: DocumentType;
  evidenceSnippet?: string;
  handbookClause: string;
  isDeterministic: boolean;
  isOverridden?: boolean;
  overrideDetails?: {
    overriddenBy: string;
    overriddenAt: string;
    rationale: string;
    statutoryCitation: string;
  };
}

export interface ScrutinyRecommendation {
  status: 'RECOMMENDED_APPROVAL' | 'DEFICIENCIES_ISSUED' | 'REJECTED' | 'IN_PROGRESS' | 'RESPONSE_SUBMITTED';
  reviewerId: string;
  reviewerName: string;
  timestamp: string;
  rationale: string;
  deficiencyPoints: string[];
  officialNoticeNumber?: string;
}

export interface IntakeDetails {
  currentTotalIntake: number;
  proposedTotalIntake: number;
  totalStudents: number;
  facultyCount: number;
  studentFacultyRatio: string;
  professors: number;
  associateProfessors: number;
  assistantProfessors: number;
  cadreRatioRatioStr: string;
  totalBuiltUpAreaSqM: number;
  requiredBuiltUpAreaSqM: number;
  fdrCorpusAmountLakhs: number;
  requiredFdrAmountLakhs: number;
}

export interface InstitutionApplication {
  id: string;
  applicationNumber: string;
  institutionId: string;
  institutionName: string;
  pid: string;
  region: 'Northern' | 'Southern' | 'Western' | 'Eastern' | 'Central' | 'North-Western' | 'South-Western';
  state: string;
  city: string;
  type: ApplicationType;
  status: ApplicationStatus;
  academicYear: string;
  submittedAt: string;
  lastUpdatedAt: string;
  currentVersion: number;
  intakeDetails: IntakeDetails;
  documents: DocumentEvidence[];
  findings: ValidationFinding[];
  scrutinyRecommendation?: ScrutinyRecommendation;
  approvalDetails?: {
    approvedBy: string;
    approvedAt: string;
    eoaLetterNumber: string;
    digitalSignFingerprint: string;
  };
  /** Compliance responses the institution filed against deficiency notices (newest last). */
  responses?: ComplianceResponse[];
  /** Status changes recorded by the server. */
  history?: { from: string | null; to: string; at: string; actorRole: string; note: string }[];
}

export interface ComplianceResponse {
  version: number;
  submittedAt: string;
  points: { point?: string; response: string }[];
  files: { fileName: string; storagePath?: string; docType?: string }[];
}

export interface IssuingAuthorityStatus {
  id: string;
  name: string;
  authorityType: 'STATE_DTE' | 'AFFILIATING_UNIVERSITY' | 'FIRE_SERVICES' | 'NBA_BOARD' | 'CORE_BANKING_CBS';
  status: 'CONNECTED' | 'VERIFIED' | 'DISCREPANCY_FOUND' | 'SERVICE_UNAVAILABLE';
  latencyMs: number;
  lastPingAt: string;
  referenceNumber: string;
  verifiedAttributes: Record<string, string>;
  isSimulated: boolean;
  simulationDisclaimer: string;
}

export interface AuditEvent {
  id: string;
  correlationId: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  targetType: 'APPLICATION' | 'DOCUMENT' | 'RULE' | 'AUTHORITY_ADAPTER' | 'RECOMMENDATION';
  targetId: string;
  details: string;
  ipAddress: string;
  sha256Hash: string;
}

export interface RegulatoryRuleConfig {
  id: string;
  code: string;
  name: string;
  handbookClause: string;
  category: 'CHECKLIST' | 'EXPIRY' | 'IDENTITY' | 'FORENSICS' | 'CADRE' | 'INFRASTRUCTURE' | 'FINANCE';
  severity: FindingSeverity;
  enabled: boolean;
  isDeterministic: boolean;
  description: string;
  thresholds: Record<string, number | string | boolean>;
}

export type FdrStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'MATURED' | 'UNDER_VERIFICATION' | 'RELEASED';

export interface FdrRecord {
  id: string;
  fdrNumber: string;
  institutionId?: string;
  institutionName: string;
  pid: string;
  applicationNumber: string;
  amountLakhs: number;
  amountFormatted: string;
  bankName: string;
  branchName: string;
  ifscCode: string;
  issueDate: string; // YYYY-MM-DD
  maturityDate: string; // YYYY-MM-DD
  tenureYears: number;
  status: FdrStatus;
  jointLienHolder: string;
  isLienConfirmed: boolean;
  lienEndorsementToken?: string;
  lienEndorsedAt?: string;
  renewalStatus?: 'NOT_APPLICABLE' | 'RENEWAL_SUBMITTED' | 'UNDERTAKING_PENDING' | 'RENEWED';
  releaseRequest?: {
    id?: string;
    requestedAt: string;
    reason: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    approvedBy?: string;
    approvedAt?: string;
  };
  /** Renewal / replacement / release requests filed by the institution (newest first). */
  requests?: FdrRequest[];
  /** The request currently awaiting an AICTE decision, if any. */
  pendingRequest?: FdrRequest;
  replacedFdr?: string;
}

export interface FdrRequest {
  id: string;
  fdrId: string;
  kind: 'RENEWAL' | 'REPLACEMENT' | 'RELEASE';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  payload: Record<string, any>;
  reason?: string;
  requestedAt: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
}

/** A portal account as stored in public.profiles (visible to AICTE staff). */
export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'PENDING_VERIFICATION' | 'ACTIVE' | 'DISABLED';
  designation: string;
  institutionName?: string;
  pid?: string;
  bankName?: string;
  createdAt: string;
}

export interface RegistrationRequest {
  requestNo: string;
  userId?: string;
  status: 'FORWARDED_TO_DTE' | 'ACTIVATED' | 'REJECTED';
  createdAt: string;
  payload: Record<string, any>;
}

export interface UserInvite {
  email: string;
  role: UserRole;
  pid?: string;
  fullName?: string;
  bankName?: string;
  createdAt: string;
}

export interface RegulatoryNotification {
  id: string;
  title: string;
  message: string;
  type: 'CRITICAL' | 'WARNING' | 'INFO' | 'SUCCESS';
  timestamp: string;
  isRead: boolean;
  linkTab?: string;
  fdrNumber?: string;
  applicationNumber?: string;
}

export type SidebarTab =
  | 'dashboard'
  | 'institutions'
  | 'fdr_records'
  | 'verification_center'
  | 'renewals'
  | 'release_requests'
  | 'reports'
  | 'notifications'
  | 'audit_trail'
  | 'user_management'
  | 'settings';
