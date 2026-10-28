// Staff-portal reports (web-portal/src/services/reports.ts) on hand-made records: what each report includes,
// the filters, and the CSV export. Node runs the TypeScript module directly (type stripping).
// Usage: npm run test:reports
import { buildReports, toCsv } from '../../web-portal/src/services/reports.ts';

let passed = 0, failed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('  ✓', m); } else { failed++; console.log('  ✗', m); } };

const NOW = new Date('2026-10-28T06:00:00Z');
const day = n => new Date(NOW.getTime() + n * 864e5).toISOString().slice(0, 10);
const fdr = (n, o = {}) => ({ id: n, fdrNumber: n, institutionName: 'Delhi Institute of Technology', pid: '1-10928371', bankName: 'State Bank of India', branchName: 'B', ifscCode: 'SBIN0001234',
  amountLakhs: 100, issueDate: day(-3600), maturityDate: day(400), tenureYears: 10, status: 'ACTIVE', isLienConfirmed: true, lienConfirmation: 'BANK_OFFICIAL', ...o });
const app = (n, o = {}) => ({ id: n, applicationNumber: n, institutionName: 'Pune Academy of Technology', pid: '1-19827361', type: 'EXTENSION_OF_APPROVAL', status: 'UNDER_SCRUTINY',
  lastUpdatedAt: `${day(-4)}T10:00:00Z`, submittedAt: `${day(-6)}T10:00:00Z`, documents: [], findings: [], ...o });

const fdrs = [
  fdr('F-OK'),
  fdr('F-PENDING', { isLienConfirmed: false, lienConfirmation: 'PENDING', status: 'UNDER_VERIFICATION' }),
  fdr('F-AICTE', { lienConfirmation: 'AICTE_RECORDED', lienEndorsedAt: `${day(-10)}T09:00:00Z` }),
  fdr('F-30', { maturityDate: day(25), status: 'EXPIRING_SOON' }),
  fdr('F-180', { maturityDate: day(170), status: 'EXPIRING_SOON', pendingRequest: { kind: 'RENEWAL', requestedAt: `${day(-2)}T08:00:00Z`, payload: { maturityDate: day(3800) } } }),
  fdr('F-MAT', { maturityDate: day(-5), status: 'MATURED', bankName: 'Punjab National Bank', pendingRequest: { kind: 'RELEASE', requestedAt: `${day(-3)}T08:00:00Z`, reason: 'Lock-in completed', payload: {} } }),
  fdr('F-REL', { maturityDate: day(-40), status: 'RELEASED', release: { approvedAt: `${day(-8)}T08:00:00Z`, orderNumber: 'AICTE/NRO/LR/2026/014' } }),
  fdr('F-DIS', { maturityDate: day(-90), status: 'RELEASED', release: { approvedAt: `${day(-60)}T08:00:00Z`, orderNumber: 'AICTE/NRO/LR/2026/002', dischargedAt: `${day(-50)}T08:00:00Z`, dischargeRef: 'CBS-DIS-1' } }),
];
const apps = [
  app('A-SUB', { status: 'SUBMITTED' }),
  app('A-MISS', { findings: [{ ruleCode: 'RULE-CHECKLIST-01', severity: 'CRITICAL', description: '5 of 7 mandatory documents provided. Missing: FIRE_SAFETY, STATE_NOC.' },
    { ruleCode: 'RULE-EXPIRY-02', severity: 'WARNING', description: 'FIRE_SAFETY expires on 2026-12-01' }] }),
  app('A-DEF', { status: 'DEFICIENCIES_NOTED', scrutinyRecommendation: { status: 'DEFICIENCIES_ISSUED', deficiencyPoints: ['Upload land documents'] } }),
  app('A-RESP', { status: 'UNDER_SCRUTINY', scrutinyRecommendation: { status: 'RESPONSE_SUBMITTED' } }),
  app('A-OK', { status: 'APPROVED', findings: [{ ruleCode: 'RULE-CHECKLIST-01', severity: 'CRITICAL', description: 'old' }] }),
  app('A-OVR', { findings: [{ ruleCode: 'RULE-CHECKLIST-01', severity: 'CRITICAL', description: 'x', isOverridden: true }] }),
];

const R = Object.fromEntries(buildReports(apps, fdrs, {}, NOW).map(r => [r.id, r]));
const col = (r, name) => r.rows.map(x => x[r.headers.indexOf(name)]);

console.log('\nReports');
ok(R['fdr-register'].rows.length === fdrs.length, 'FDR register lists every deposit');
ok(col(R['fdr-register'], 'Joint Lien').includes('Recorded by AICTE (not confirmed by the bank)'), 'register says who confirmed the lien');
ok(col(R['fdr-register'], 'Release').some(v => /awaiting bank discharge/.test(v)) && col(R['fdr-register'], 'Release').some(v => /discharged by bank/.test(v)), 'register shows the release stage');

const pv = R['pending-verification'];
ok(col(pv, 'Reference').includes('F-PENDING') && col(pv, 'Reference').includes('F-AICTE') && !col(pv, 'Reference').includes('F-OK'), 'pending verification: unconfirmed and AICTE-recorded liens, not bank-confirmed ones');
ok(['A-SUB', 'A-RESP', 'A-MISS'].every(n => col(pv, 'Reference').includes(n)) && !col(pv, 'Reference').includes('A-OK'), 'pending verification: applications awaiting scrutiny or response review');
ok(!col(pv, 'Reference').includes('F-REL'), 'released deposits are not pending verification');

const md = R['missing-documents'];
ok(md.rows.some(r => r[0] === 'A-MISS' && r[5] === 'Mandatory documents missing' && /FIRE_SAFETY, STATE_NOC/.test(r[6])), 'missing documents: names the missing mandatory documents');
ok(md.rows.some(r => r[0] === 'A-MISS' && /expired, expiring or undated/.test(r[5])), 'missing documents: certificate expiring or undated');
ok(md.rows.some(r => r[0] === 'A-DEF' && /unanswered/.test(r[5]) && /land documents/.test(r[6])), 'missing documents: unanswered deficiency notice with its points');
ok(!md.rows.some(r => r[0] === 'A-OK' || r[0] === 'A-OVR'), 'closed applications and overridden findings are left out');

const mt = R['maturity'];
ok(JSON.stringify(col(mt, 'FDR Number')) === JSON.stringify(['F-MAT', 'F-30', 'F-180']), 'maturity: within 180 days or matured, earliest first; released and far-off excluded');
ok(JSON.stringify(col(mt, 'Window')) === JSON.stringify(['Matured', 'Within 30 days', 'Within 180 days']), 'maturity windows');
ok(/RENEWAL requested/.test(col(mt, 'Action Filed')[2]) && /renewal due/.test(col(mt, 'Action Filed')[1]), 'maturity: shows whether a renewal was filed');

const aw = R['awaiting-action'];
ok(aw.rows.some(r => r[0] === 'RELEASE' && r[1] === 'F-MAT' && r[5] === 'AICTE administrator') && aw.rows.some(r => r[0] === 'RENEWAL' && r[1] === 'F-180'), 'awaiting action: release and renewal requests awaiting AICTE');
ok(aw.rows.some(r => r[0] === 'LIEN DISCHARGE' && r[1] === 'F-REL' && /State Bank of India/.test(r[5]) && /LR\/2026\/014/.test(r[8])) && !aw.rows.some(r => r[1] === 'F-DIS'),
  'awaiting action: approved release awaiting the bank\'s discharge; discharged ones are done');

const pnb = Object.fromEntries(buildReports(apps, fdrs, { bank: 'Punjab National Bank' }, NOW).map(r => [r.id, r]));
ok(pnb['fdr-register'].rows.length === 1 && pnb['missing-documents'].rows.length === 0, 'bank filter keeps that bank\'s deposits only');
const pune = Object.fromEntries(buildReports(apps, fdrs, { search: '1-19827361' }, NOW).map(r => [r.id, r]));
ok(pune['fdr-register'].rows.length === 0 && pune['missing-documents'].rows.length > 0, 'institution filter by PID');

const csv = toCsv({ headers: ['A', 'B'], rows: [['x, "y"', '=HYPERLINK("evil")'], [5, '-3']] });
ok(csv === '"A","B"\r\n"x, ""y""","\'=HYPERLINK(""evil"")"\r\n"5","\'-3"', 'CSV quotes every cell, doubles quotes and neutralises formulas');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
