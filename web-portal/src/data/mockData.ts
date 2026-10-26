/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * Rule catalogue and issuing-authority adapter status shown in the staff portal.
 */

import { IssuingAuthorityStatus, RegulatoryRuleConfig } from '../types';

export const INITIAL_RULES: RegulatoryRuleConfig[] = [
  {
    id: 'rule-1',
    code: 'RULE-CHECKLIST-01',
    name: 'Mandatory Document Completeness',
    category: 'CHECKLIST',
    handbookClause: 'Clause 2.4.1 (Mandatory Submissions)',
    severity: 'CRITICAL',
    enabled: true,
    isDeterministic: true,
    description: 'Verifies that all 7 mandatory documents (Land Title, Building NOC, Fire Safety NOC, FDR, Affiliation, State NOC, Faculty Register) are uploaded with non-zero byte size.',
    thresholds: { mandatoryCount: 7 }
  },
  {
    id: 'rule-2',
    code: 'RULE-EXPIRY-02',
    name: 'Statutory Certificate Expiry Verification',
    category: 'EXPIRY',
    handbookClause: 'Clause 3.1.2 (Validity of Approvals)',
    severity: 'CRITICAL',
    enabled: true,
    isDeterministic: true,
    description: 'Ensures Fire Safety NOC, University Affiliation, and Building Stability certificates have not expired and are valid through the academic session 2026-27.',
    thresholds: { minMonthsRemaining: 6 }
  },
  {
    id: 'rule-3',
    code: 'RULE-PID-03',
    name: 'Permanent Institute ID (PID) Coherence',
    category: 'IDENTITY',
    handbookClause: 'Clause 1.2.3 (Institutional Identification)',
    severity: 'CRITICAL',
    enabled: true,
    isDeterministic: true,
    description: 'Cross-checks extracted institution names and Permanent Institute ID (PID) across all submitted certificates against the AICTE master registry.',
    thresholds: { matchThresholdPercent: 100 }
  },
  {
    id: 'rule-4',
    code: 'RULE-DUPLICATE-HASH-04',
    name: 'Cross-Application SHA-256 Duplicate Collision',
    category: 'FORENSICS',
    handbookClause: 'Clause 4.8.1 (Document Authenticity & Forensics)',
    severity: 'CRITICAL',
    enabled: true,
    isDeterministic: true,
    description: 'Detects if any uploaded document binary produces an identical SHA-256 fingerprint already submitted by a distinct institution or application.',
    thresholds: { exactHashMatchBlocked: true }
  },
  {
    id: 'rule-5',
    code: 'RULE-CADRE-RATIO-05',
    name: 'Faculty-Student & Cadre Ratio Compliance',
    category: 'CADRE',
    handbookClause: 'Appendix 7 (Norms for Faculty Cadre Ratio 1:2:6)',
    severity: 'WARNING',
    enabled: true,
    isDeterministic: true,
    description: 'Validates that Student-to-Faculty Ratio (SFR) does not exceed 1:20 (B.Tech) and Cadre distribution strictly satisfies 1 Professor : 2 Associate Professors : 6 Assistant Professors.',
    thresholds: { maxSfr: 20, cadreRatio: '1:2:6' }
  },
  {
    id: 'rule-6',
    code: 'RULE-BUILTUP-AREA-06',
    name: 'Instructional & Administrative Area Norms',
    category: 'INFRASTRUCTURE',
    handbookClause: 'Appendix 4 (Norms for Land and Built-Up Area)',
    severity: 'WARNING',
    enabled: true,
    isDeterministic: true,
    description: 'Validates that total instructional, administrative, and amenity carpet area matches or exceeds AICTE norms based on total student intake.',
    thresholds: { minSqMPerStudent: 5.5 }
  },
  {
    id: 'rule-7',
    code: 'RULE-FDR-CORPUS-07',
    name: 'Joint FDR Corpus Fund & Lien Status',
    category: 'FINANCE',
    handbookClause: 'Clause 6.2 (Security Deposit & Corpus Fund)',
    severity: 'CRITICAL',
    enabled: true,
    isDeterministic: true,
    description: 'Verifies Fixed Deposit Receipt (FDR) maturity date, minimum required corpus (₹100 Lakhs), and mandatory joint lien status in the name of the Regional Officer, AICTE.',
    thresholds: { minCorpusLakhs: 100 }
  }
];

export const INITIAL_AUTHORITY_ADAPTERS: IssuingAuthorityStatus[] = [
  {
    id: 'auth-1',
    name: 'State Directorate of Technical Education (DTE)',
    authorityType: 'STATE_DTE',
    status: 'CONNECTED',
    latencyMs: 142,
    lastPingAt: '2026-10-22T08:45:10Z',
    referenceNumber: 'DTE/NCR/2026/VALID-8812',
    verifiedAttributes: {
      'State NOC Status': 'Valid for AY 2026-27',
      'Govt Resolution No': 'ED-192-TEC-2025',
      'Quota Approval': '100% Sanctioned'
    },
    isSimulated: true,
    simulationDisclaimer: 'SIMULATED ADAPTER — Integration demonstrates API verification pattern without connecting to live state government portals.'
  },
  {
    id: 'auth-2',
    name: 'Affiliating University Examination & Affiliation Registry',
    authorityType: 'AFFILIATING_UNIVERSITY',
    status: 'VERIFIED',
    latencyMs: 185,
    lastPingAt: '2026-10-22T08:50:33Z',
    referenceNumber: 'UNIV/AFFIL/CON-2026-901',
    verifiedAttributes: {
      'Affiliation Order': 'Autonomous Status Granted',
      'Valid Up To': '2028-06-30',
      'Sanctioned Courses': '14 Undergraduate, 6 Postgraduate'
    },
    isSimulated: true,
    simulationDisclaimer: 'SIMULATED ADAPTER — Demonstrates automated academic affiliation cross-checks.'
  },
  {
    id: 'auth-3',
    name: 'State Fire & Emergency Services Bureau',
    authorityType: 'FIRE_SERVICES',
    status: 'DISCREPANCY_FOUND',
    latencyMs: 220,
    lastPingAt: '2026-10-22T09:02:15Z',
    referenceNumber: 'DFS/NOC/2025/11029',
    verifiedAttributes: {
      'Issued Date': '2023-11-04',
      'Renewal Due': '2026-11-03',
      'Hydrant Test Status': 'Pending Biannual Inspection'
    },
    isSimulated: true,
    simulationDisclaimer: 'SIMULATED ADAPTER — Fire Safety Bureau NOC registry sandbox integration.'
  },
  {
    id: 'auth-4',
    name: 'National Board of Accreditation (NBA) Central Data Vault',
    authorityType: 'NBA_BOARD',
    status: 'VERIFIED',
    latencyMs: 160,
    lastPingAt: '2026-10-22T08:40:00Z',
    referenceNumber: 'NBA/TIER-1/2024/771',
    verifiedAttributes: {
      'Accredited Programmes': 'Computer Engg, Mechanical, ECE',
      'Validity Period': '2024 - 2027 (3 Years Tier-1)',
      'Accreditation Score': '742 / 1000'
    },
    isSimulated: true,
    simulationDisclaimer: 'SIMULATED ADAPTER — NBA Tier-1 accreditation record verification.'
  },
  {
    id: 'auth-5',
    name: 'Core Banking Solution (CBS) - AICTE Member Secretary Joint Lien',
    authorityType: 'CORE_BANKING_CBS',
    status: 'VERIFIED',
    latencyMs: 310,
    lastPingAt: '2026-10-22T09:10:00Z',
    referenceNumber: 'SBI-FDR-AICTE-LIEN-99201',
    verifiedAttributes: {
      'Bank': 'State Bank of India',
      'FDR Amount': '₹ 1,00,00,000 (1.00 Crore)',
      'Maturity Date': '2034-03-31',
      'Joint Lien': 'Member Secretary, AICTE New Delhi'
    },
    isSimulated: true,
    simulationDisclaimer: 'SIMULATED ADAPTER — Demonstrates digital API lien verification with scheduled commercial banks.'
  }
];
