/**
 * Regulatory reports built from the records the signed-in user may read (row-level security already limits them:
 * a bank official sees only its bank's deposits). Pure functions, so tests/web/reports.test.mjs can run them directly.
 */

import type { FdrRecord, InstitutionApplication, LienConfirmation } from '../types';

export type Cell = string | number;
export interface Report {
  id: 'fdr-register' | 'pending-verification' | 'missing-documents' | 'maturity' | 'awaiting-action';
  title: string;
  description: string;
  headers: string[];
  rows: Cell[][];
}
export interface ReportFilter {
  /** Institution name or PID, case-insensitive. */
  search?: string;
  bank?: string;
}

/** Who confirmed a joint lien, in words. Only BANK_OFFICIAL is a confirmation by the bank itself. */
export const LIEN_CONFIRMATION_LABEL: Record<LienConfirmation, string> = {
  BANK_OFFICIAL: 'Confirmed by the bank',
  AICTE_RECORDED: 'Recorded by AICTE (not confirmed by the bank)',
  DEMO_SIMULATED: 'Simulated (demo data)',
  UNRECORDED: 'On record (confirming party not on file)',
  PENDING: 'Awaiting bank confirmation'
};
const CLOSED = ['DRAFT', 'APPROVED', 'REJECTED'];
const DAY = 864e5;
const isoDay = (d: Date) => new Date(d.getTime() + 5.5 * 36e5).toISOString().slice(0, 10);   // India date
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / DAY);

function releaseStage(f: FdrRecord): string {
  if (f.release?.dischargedAt) return `Lien discharged by bank (${f.release.dischargeRef})`;
  if (f.release) return `Released by AICTE (order ${f.release.orderNumber || '—'}), awaiting bank discharge`;
  if (f.pendingRequest?.kind === 'RELEASE') return 'Release requested';
  return '';
}

export function buildReports(apps: InstitutionApplication[], fdrs: FdrRecord[], filter: ReportFilter = {}, now = new Date()): Report[] {
  const today = isoDay(now);
  const q = (filter.search || '').trim().toLowerCase();
  const matchInst = (name: string, pid: string) => !q || name.toLowerCase().includes(q) || pid.toLowerCase().includes(q);
  const F = fdrs.filter(f => matchInst(f.institutionName, f.pid) && (!filter.bank || f.bankName === filter.bank));
  const A = filter.bank ? [] : apps.filter(a => matchInst(a.institutionName, a.pid));
  const toMaturity = (f: FdrRecord) => daysBetween(today, f.maturityDate);
  const waiting = (since?: string) => (since ? Math.max(0, daysBetween(since, today)) : '');

  const register: Report = {
    id: 'fdr-register',
    title: 'FDR register',
    description: 'Every security deposit with its status, who confirmed the joint lien, open requests and release stage.',
    headers: ['FDR Number', 'Institution', 'PID', 'Bank', 'Branch', 'IFSC', 'Amount (INR)', 'Issue Date', 'Maturity Date', 'Days to Maturity', 'Status',
      'Joint Lien', 'Lien Token', 'Pending Request', 'Release'],
    rows: F.map(f => [f.fdrNumber, f.institutionName, f.pid, f.bankName, f.branchName, f.ifscCode, Math.round(f.amountLakhs * 1e5), f.issueDate, f.maturityDate,
      toMaturity(f), f.status, LIEN_CONFIRMATION_LABEL[f.lienConfirmation], f.lienEndorsementToken || '', f.pendingRequest?.kind || '', releaseStage(f)])
  };

  const pendingRows: Cell[][] = [];
  F.filter(f => f.status !== 'RELEASED' && f.lienConfirmation !== 'BANK_OFFICIAL').forEach(f =>
    pendingRows.push(['FDR joint lien', f.fdrNumber, f.institutionName, f.pid, f.bankName, LIEN_CONFIRMATION_LABEL[f.lienConfirmation],
      f.lienConfirmation === 'PENDING' ? 'Bank official to confirm the lien' : 'Bank official to confirm the lien (not yet confirmed by the bank)', f.lienEndorsedAt?.slice(0, 10) || f.issueDate, waiting(f.lienEndorsedAt || f.issueDate)]));
  A.filter(a => a.status === 'SUBMITTED' || a.status === 'UNDER_SCRUTINY' || a.scrutinyRecommendation?.status === 'RESPONSE_SUBMITTED').forEach(a => {
    const what = a.scrutinyRecommendation?.status === 'RESPONSE_SUBMITTED' ? 'Compliance response to review' : a.status === 'SUBMITTED' ? 'Scrutiny not started' : 'Scrutiny in progress';
    pendingRows.push(['Application', a.applicationNumber, a.institutionName, a.pid, '', a.status.replace(/_/g, ' '), what, a.lastUpdatedAt.slice(0, 10), waiting(a.lastUpdatedAt)]);
  });
  const pending: Report = {
    id: 'pending-verification',
    title: 'Pending verification',
    description: 'Deposits whose joint lien the bank has not confirmed, and applications waiting for scrutiny or for review of a compliance response.',
    headers: ['Item', 'Reference', 'Institution', 'PID', 'Bank', 'Current Status', 'Next Step', 'Since', 'Days Waiting'],
    rows: pendingRows.sort((x, y) => Number(y[8]) - Number(x[8]))
  };

  // Server findings are authoritative: RULE-CHECKLIST-01 lists missing mandatory documents, RULE-EXPIRY-02 expired or undated certificates.
  const missingRows: Cell[][] = [];
  A.filter(a => !CLOSED.includes(a.status)).forEach(a => {
    const open = (code: string) => a.findings.find(f => f.ruleCode === code && (f.severity === 'CRITICAL' || f.severity === 'WARNING') && !f.isOverridden);
    const checklist = open('RULE-CHECKLIST-01'), expiry = open('RULE-EXPIRY-02');
    const flagged = a.documents.filter(d => d.status === 'FLAGGED' || d.status === 'MANUAL_REVIEW_REQUIRED');
    const row = (problem: string, detail: string) => missingRows.push([a.applicationNumber, a.institutionName, a.pid, a.type.replace(/_/g, ' '), a.status.replace(/_/g, ' '), problem, detail]);
    if (checklist) row('Mandatory documents missing', checklist.description);
    if (expiry) row('Certificate expired, expiring or undated', expiry.description);
    if (flagged.length) row('Document flagged for review', flagged.map(d => `${d.docType} (${d.fileName})`).join('; '));
    if (a.status === 'DEFICIENCIES_NOTED') row('Deficiency notice unanswered', (a.scrutinyRecommendation?.deficiencyPoints || []).join('; ') || 'See the deficiency notice');
  });
  const missing: Report = {
    id: 'missing-documents',
    title: 'Missing or incomplete documents',
    description: 'Open applications with missing mandatory documents, expired or undated certificates, flagged documents or an unanswered deficiency notice.',
    headers: ['Application', 'Institution', 'PID', 'Type', 'Status', 'Problem', 'Details'],
    rows: missingRows
  };

  const window = (d: number) => (d <= 0 ? 'Matured' : d <= 30 ? 'Within 30 days' : d <= 60 ? 'Within 60 days' : 'Within 180 days');
  const maturity: Report = {
    id: 'maturity',
    title: 'Approaching or past maturity',
    description: 'Deposits maturing within 180 days or already matured and not yet released, with the action filed so far.',
    headers: ['FDR Number', 'Institution', 'PID', 'Bank', 'Amount (INR)', 'Maturity Date', 'Days to Maturity', 'Window', 'Action Filed'],
    rows: F.filter(f => !f.release && f.status !== 'RELEASED' && toMaturity(f) <= 180)
      .sort((x, y) => x.maturityDate.localeCompare(y.maturityDate))
      .map(f => [f.fdrNumber, f.institutionName, f.pid, f.bankName, Math.round(f.amountLakhs * 1e5), f.maturityDate, toMaturity(f), window(toMaturity(f)),
        f.pendingRequest ? `${f.pendingRequest.kind} requested ${f.pendingRequest.requestedAt.slice(0, 10)}` : toMaturity(f) <= 0 ? 'None: eligible for release or renewal' : 'None: renewal due'])
  };

  const actionRows: Cell[][] = [];
  F.filter(f => f.pendingRequest).forEach(f => {
    const r = f.pendingRequest!;
    actionRows.push([r.kind, f.fdrNumber, f.institutionName, f.pid, f.bankName, 'AICTE administrator', r.requestedAt.slice(0, 10), waiting(r.requestedAt),
      r.kind === 'RELEASE' ? r.reason || '' : r.payload?.maturityDate ? `Proposed maturity ${r.payload.maturityDate}` : '']);
  });
  F.filter(f => f.release && !f.release.dischargedAt).forEach(f =>
    actionRows.push(['LIEN DISCHARGE', f.fdrNumber, f.institutionName, f.pid, f.bankName, `${f.bankName} (bank official)`, (f.release!.approvedAt || '').slice(0, 10),
      waiting(f.release!.approvedAt), `AICTE release order ${f.release!.orderNumber || '—'}`]));
  const awaiting: Report = {
    id: 'awaiting-action',
    title: 'Requests awaiting action',
    description: 'Renewal, replacement and release requests awaiting an AICTE decision, and approved releases awaiting the bank\'s lien discharge.',
    headers: ['Request', 'FDR Number', 'Institution', 'PID', 'Bank', 'Awaiting', 'Since', 'Days Waiting', 'Details'],
    rows: actionRows.sort((x, y) => Number(y[7]) - Number(x[7]))
  };

  return [register, pending, missing, maturity, awaiting];
}

/** RFC 4180 CSV: every cell quoted, quotes doubled; a leading = + - @ is neutralised so spreadsheets do not run it as a formula. */
export function toCsv(r: Report): string {
  const cell = (v: Cell) => {
    const s = String(v ?? '');
    return `"${(/^[=+\-@]/.test(s) && typeof v !== 'number' ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  return [r.headers, ...r.rows].map(row => row.map(cell).join(',')).join('\r\n');
}
