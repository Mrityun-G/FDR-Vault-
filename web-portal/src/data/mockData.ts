/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * Mock Data Store & Demonstration Dataset
 */

import {
  User,
  InstitutionApplication,
  IssuingAuthorityStatus,
  AuditEvent,
  RegulatoryRuleConfig,
  DocumentEvidence,
  ValidationFinding
} from '../types';

export const DEMO_USERS: User[] = [
  {
    id: 'user-inst-1',
    name: 'Dr. Rajesh Sharma',
    email: 'principal@dits-delhi.edu.in',
    role: 'INSTITUTION',
    designation: 'Principal & Director',
    institutionId: 'inst-1',
    institutionName: 'Delhi Institute of Technology & Science',
    pid: '1-10928371',
    region: 'Northern',
    canApproveApplications: false
  },
  {
    id: 'user-inst-2',
    name: 'Prof. Ananya Rao',
    email: 'director@bce-bangalore.edu.in',
    role: 'INSTITUTION',
    designation: 'Director',
    institutionId: 'inst-2',
    institutionName: 'Bangalore College of Engineering',
    pid: '1-14829104',
    region: 'South-Western',
    canApproveApplications: false
  },
  {
    id: 'user-inst-3',
    name: 'Dr. Vikram Deshmukh',
    email: 'dean@pat-pune.ac.in',
    role: 'INSTITUTION',
    designation: 'Dean (Academics & Affiliations)',
    institutionId: 'inst-3',
    institutionName: 'Pune Academy of Technology',
    pid: '1-19827361',
    region: 'Western',
    canApproveApplications: false
  },
  {
    id: 'user-rev-1',
    name: 'Dr. Sunil K. Mehta',
    email: 'reviewer.mehta@aicte-india.org',
    role: 'REVIEWER',
    designation: 'Northern Region Scrutiny Officer',
    region: 'Northern',
    canApproveApplications: false
  },
  {
    id: 'user-rev-2',
    name: 'Dr. Priya Nair',
    email: 'reviewer.nair@aicte-india.org',
    role: 'REVIEWER',
    designation: 'Southern Region Joint Director',
    region: 'Southern',
    canApproveApplications: false
  },
  {
    id: 'user-adm-1',
    name: 'Shri R. C. Verma',
    email: 'admin.verma@aicte-india.org',
    role: 'ADMIN',
    designation: 'Chief Administrator & Advisor (Regulation Bureau)',
    canApproveApplications: true
  },
  {
    id: 'user-bank-1',
    name: 'Shri Amitesh Kumar',
    email: 'fdr.officer@sbi.co.in',
    role: 'BANK_OFFICIAL',
    designation: 'Chief Manager & Joint Lien Verification Officer',
    bankName: 'State Bank of India',
    bankBranch: 'Institutional Area Branch, New Delhi (IFSC: SBIN0001234)',
    canApproveApplications: false
  }
];

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

export const INITIAL_DOCUMENTS_APP_1: DocumentEvidence[] = [
  {
    id: 'doc-101',
    applicationId: 'app-1',
    docType: 'LAND_TITLE',
    fileName: 'Registered_Sale_Deed_Khasra_441.pdf',
    fileSizeKb: 4210,
    fileHash: '8f4c28bb9c1184a49cbe5012e847c20a91176b9708faee6e1a499a0ff3769c01',
    uploadedAt: '2026-10-18T10:20:00Z',
    version: 1,
    pageCount: 18,
    status: 'PROCESSED',
    extractedFields: [
      { label: 'Institution Name', value: 'Delhi Institute of Technology & Science', page: 1, sourceLine: 'Deed executed in favour of Delhi Institute of Technology & Science', isCoherent: true },
      { label: 'Land Area (Acres)', value: '10.5 Acres (Contiguous)', page: 2, sourceLine: 'Total contiguous land measuring 10.50 Acres in Revenue Village Alipur', isCoherent: true },
      { label: 'Khasra Numbers', value: 'Khasra No. 441/2, 442, 443/1', page: 2, sourceLine: 'Khasra Nos: 441/2, 442, 443/1 registered sub-district North Delhi', isCoherent: true },
      { label: 'Registration Date', value: '2012-04-18', page: 18, sourceLine: 'Registered before Sub-Registrar IV on 18th day of April 2012', isCoherent: true }
    ],
    forensics: {
      sha256Match: false,
      qrCodeValid: true,
      qrPayload: {
        issuingAuthority: 'Dept of Revenue, Govt of NCT Delhi',
        certId: 'DEL-REV-2012-88192',
        issueDate: '2012-04-18',
        validTill: 'PERPETUAL',
        signerName: 'Sub-Registrar IV, North Delhi'
      },
      dateChronologyValid: true,
      chronologyDetails: 'Sale deed (2012) precedes society formation (2010 resolution) and AICTE initial grant (2014).',
      remarks: ['High resolution scan', 'Sub-registrar digital stamp verified', 'No hash collisions detected']
    },
    geminiAnalysis: {
      status: 'COMPLETED',
      modelUsed: 'gemini-3.5-flash',
      timestamp: '2026-10-18T10:20:45Z',
      summary: 'Land ownership title deed in name of the applicant trust is confirmed with contiguous land parcel of 10.5 acres meeting AICTE rural/urban norms.',
      verifiedAttributes: {
        'Land Title Status': 'Clear & Unencumbered',
        'Contiguity': '100% Contiguous single parcel',
        'Zoning Classification': 'Institutional / Educational Use Permitted'
      },
      detectedAnomalies: [],
      disclaimer: 'AI interpretation based on extracted document text. Not a legal ownership decree.'
    },
    sourceTextPreview: 'This indenture of sale deed made on 18-04-2012 between the Vendor and Delhi Institute of Technology & Science, conveying 10.5 acres at Khasra 441/2...'
  },
  {
    id: 'doc-102',
    applicationId: 'app-1',
    docType: 'FIRE_SAFETY',
    fileName: 'Delhi_Fire_Service_NOC_2025.pdf',
    fileSizeKb: 1850,
    fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    uploadedAt: '2026-10-18T10:25:00Z',
    version: 1,
    pageCount: 4,
    status: 'FLAGGED',
    extractedFields: [
      { label: 'Certificate No', value: 'DFS/HQ/2023/11029', page: 1, sourceLine: 'Ref No: DFS/HQ/2023/11029 dated 04.11.2023', isCoherent: true },
      { label: 'Issue Date', value: '2023-11-04', page: 1, sourceLine: 'Certificate Issued On: 04/11/2023', isCoherent: true },
      { label: 'Expiry Date', value: '2026-11-03', page: 2, sourceLine: 'Valid for a period of 3 years subject to annual maintenance till 03.11.2026', isCoherent: false },
      { label: 'Occupancy Class', value: 'Educational Group B', page: 1, sourceLine: 'Premises approved for Educational Building (Group B) occupancy', isCoherent: true }
    ],
    forensics: {
      sha256Match: false,
      qrCodeValid: true,
      qrPayload: {
        issuingAuthority: 'Delhi Fire Service Headquarters',
        certId: 'DFS/HQ/2023/11029',
        issueDate: '2023-11-04',
        validTill: '2026-11-03',
        signerName: 'Chief Fire Officer, Delhi Fire Service'
      },
      dateChronologyValid: true,
      chronologyDetails: 'Certificate is valid currently, but expires within 12 days of statutory cut-off.',
      remarks: ['Expiry date falls in early November 2026 - Renewal certificate required for next academic term.']
    },
    geminiAnalysis: {
      status: 'COMPLETED',
      modelUsed: 'gemini-3.5-flash',
      timestamp: '2026-10-18T10:25:35Z',
      summary: 'Fire Safety Certificate is authentic from Delhi Fire Service, however expiry is on 03-Nov-2026 which requires submission of renewal undertaking before final EoA release.',
      verifiedAttributes: {
        'DFS Certificate Status': 'Valid but near expiry',
        'Building Height': '14.8 meters (Permitted < 15m)',
        'Fire Escape Staircases': '2 Adequate width staircases present'
      },
      detectedAnomalies: ['NOC renewal due within current calendar semester.'],
      disclaimer: 'AI interpretation. Official validity relies on physical firefighting equipment inspection.'
    },
    sourceTextPreview: 'GOVERNMENT OF NATIONAL CAPITAL TERRITORY OF DELHI, HEADQUARTERS: DELHI FIRE SERVICE: NEW DELHI. No. DFS/HQ/2023/11029. Dated: 04/11/2023. FIRE SAFETY CERTIFICATE...'
  },
  {
    id: 'doc-103',
    applicationId: 'app-1',
    docType: 'FDR_CORPUS',
    fileName: 'Joint_FDR_Corpus_SBI_Lien.pdf',
    fileSizeKb: 920,
    fileHash: '4a5e1e7f3d89b12a9c402123f1128e0892c9012399a0ff3769c018f4c28bb9c1',
    uploadedAt: '2026-10-18T10:30:00Z',
    version: 1,
    pageCount: 2,
    status: 'PROCESSED',
    extractedFields: [
      { label: 'Bank Name', value: 'State Bank of India', page: 1, sourceLine: 'State Bank of India, Institutional Area Branch, New Delhi', isCoherent: true },
      { label: 'FDR Number', value: 'SBI-FDR-99201-2024', page: 1, sourceLine: 'Term Deposit Receipt No: SBI-FDR-99201-2024', isCoherent: true },
      { label: 'Deposit Amount', value: '₹ 1,00,00,000.00 (One Crore)', page: 1, sourceLine: 'Amount: INR 1,00,00,000 (Rupees One Crore Only)', isCoherent: true },
      { label: 'Lien Holder', value: 'Regional Officer, Northern Regional Office, AICTE', page: 1, sourceLine: 'Under irrevocable joint lien with Regional Officer, AICTE, New Delhi', isCoherent: true },
      { label: 'Maturity Date', value: '2034-03-31', page: 1, sourceLine: 'Tenure 10 years, Maturity Date: 31-03-2034', isCoherent: true }
    ],
    forensics: {
      sha256Match: false,
      qrCodeValid: true,
      dateChronologyValid: true,
      remarks: ['Core Banking CBS signature matches SBI records', 'Irrevocable lien clause confirmed']
    },
    geminiAnalysis: {
      status: 'COMPLETED',
      modelUsed: 'gemini-3.5-flash',
      timestamp: '2026-10-18T10:30:20Z',
      summary: 'FDR for Rs 1 Crore is verified in joint name with AICTE Member Secretary with tenure up to 2034, satisfying Chapter VI financial security norms.',
      verifiedAttributes: {
        'Corpus Amount': 'Rs 100 Lakhs (Fully met)',
        'Lien Status': 'AICTE Joint Lien Recorded'
      },
      detectedAnomalies: [],
      disclaimer: 'AI verification. Core Banking system holds authoritative ledger balance.'
    },
    sourceTextPreview: 'STATE BANK OF INDIA - TERM DEPOSIT ADVICE / SPECIAL FIXED DEPOSIT RECEIPT. Depositor: Delhi Institute of Technology & Science and Regional Officer AICTE...'
  },
  {
    id: 'doc-104',
    applicationId: 'app-1',
    docType: 'FACULTY_CADRE',
    fileName: 'Certified_Faculty_Cadre_Register_AY26.pdf',
    fileSizeKb: 3100,
    fileHash: '7c89a0b12d34ef5678901234567890abcdef1234567890abcdef1234567890ab',
    uploadedAt: '2026-10-18T10:35:00Z',
    version: 1,
    pageCount: 12,
    status: 'PROCESSED',
    extractedFields: [
      { label: 'Total Faculty', value: '124 Regular Faculty', page: 1, sourceLine: 'Total Teaching Faculty on rolls: 124 (Full-time Regular)', isCoherent: true },
      { label: 'Professors', value: '14', page: 2, sourceLine: 'Cadre breakdown: Professors - 14', isCoherent: true },
      { label: 'Associate Professors', value: '28', page: 2, sourceLine: 'Associate Professors - 28', isCoherent: true },
      { label: 'Assistant Professors', value: '82', page: 2, sourceLine: 'Assistant Professors - 82', isCoherent: true },
      { label: 'Ph.D. Holders', value: '64 (51.6%)', page: 3, sourceLine: 'Faculty with Doctoral Degree (Ph.D.): 64', isCoherent: true }
    ],
    forensics: {
      sha256Match: false,
      qrCodeValid: true,
      dateChronologyValid: true,
      remarks: ['Aadhaar authenticated faculty records verified against duplicate faculty portal']
    },
    geminiAnalysis: {
      status: 'COMPLETED',
      modelUsed: 'gemini-3.5-flash',
      timestamp: '2026-10-18T10:35:40Z',
      summary: 'Faculty roster shows 124 full-time teaching staff. Cadre ratio is 14:28:82 which conforms to 1:2:6 ratio requirements for existing sanctioned intake of 2400 students.',
      verifiedAttributes: {
        'Student Faculty Ratio': '1:19.3 (Norm <= 1:20)',
        'Cadre Proportion': '1.0 : 2.0 : 5.8 (Compliant)'
      },
      detectedAnomalies: [],
      disclaimer: 'AI interpretation. Physical biometric presence subject to Surprise Scrutiny Committee visit.'
    },
    sourceTextPreview: 'FACULTY CADRE REGISTER FOR ACADEMIC YEAR 2026-2027. Certified by Principal Dr. Rajesh Sharma, Delhi Institute of Technology & Science...'
  }
];

export const INITIAL_FINDINGS_APP_1: ValidationFinding[] = [
  {
    id: 'find-101',
    ruleId: 'rule-2',
    ruleCode: 'RULE-EXPIRY-02',
    ruleName: 'Statutory Certificate Expiry Verification',
    severity: 'WARNING',
    description: 'Fire Safety Certificate No. DFS/HQ/2023/11029 expires on 2026-11-03, which is within the upcoming academic session. Renewal application or renewal receipt must be submitted.',
    documentId: 'doc-102',
    docType: 'FIRE_SAFETY',
    evidenceSnippet: 'Valid for a period of 3 years subject to annual maintenance till 03.11.2026 (Page 2, Line 8)',
    handbookClause: 'Clause 3.1.2 (Validity of Approvals)',
    isDeterministic: true
  },
  {
    id: 'find-102',
    ruleId: 'rule-1',
    ruleCode: 'RULE-CHECKLIST-01',
    ruleName: 'Mandatory Document Completeness',
    severity: 'PASSED',
    description: 'All 7 mandatory statutory categories have been provided with valid digital signatures and parseable source lines.',
    handbookClause: 'Clause 2.4.1 (Mandatory Submissions)',
    isDeterministic: true
  },
  {
    id: 'find-103',
    ruleId: 'rule-3',
    ruleCode: 'RULE-PID-03',
    ruleName: 'Permanent Institute ID (PID) Coherence',
    severity: 'PASSED',
    description: 'PID 1-10928371 matches Delhi Institute of Technology & Science in Council Master Registry without discrepancies.',
    handbookClause: 'Clause 1.2.3',
    isDeterministic: true
  },
  {
    id: 'find-104',
    ruleId: 'rule-4',
    ruleCode: 'RULE-DUPLICATE-HASH-04',
    ruleName: 'Cross-Application SHA-256 Duplicate Collision',
    severity: 'PASSED',
    description: 'Zero duplicate SHA-256 hash collisions found across 14,890 historical AICTE institutional filings.',
    handbookClause: 'Clause 4.8.1',
    isDeterministic: true
  },
  {
    id: 'find-105',
    ruleId: 'rule-5',
    ruleCode: 'RULE-CADRE-RATIO-05',
    ruleName: 'Faculty-Student & Cadre Ratio Compliance',
    severity: 'PASSED',
    description: 'Calculated SFR is 1:19.3 (norm <= 1:20). Cadre distribution 14 : 28 : 82 fulfills AICTE 1:2:6 ratio norm.',
    handbookClause: 'Appendix 7',
    isDeterministic: true
  }
];

export const INITIAL_APPLICATIONS: InstitutionApplication[] = [
  {
    id: 'app-1',
    applicationNumber: 'APP-2026-EOA-1082',
    institutionId: 'inst-1',
    institutionName: 'Delhi Institute of Technology & Science',
    pid: '1-10928371',
    region: 'Northern',
    state: 'Delhi',
    city: 'North Delhi',
    type: 'EOA',
    status: 'UNDER_SCRUTINY',
    academicYear: '2026-27',
    submittedAt: '2026-10-18T11:00:00Z',
    lastUpdatedAt: '2026-10-22T08:15:00Z',
    currentVersion: 1,
    intakeDetails: {
      currentTotalIntake: 600,
      proposedTotalIntake: 600,
      totalStudents: 2400,
      facultyCount: 124,
      studentFacultyRatio: '1:19.3',
      professors: 14,
      associateProfessors: 28,
      assistantProfessors: 82,
      cadreRatioRatioStr: '1 : 2 : 5.8',
      totalBuiltUpAreaSqM: 19850,
      requiredBuiltUpAreaSqM: 14200,
      fdrCorpusAmountLakhs: 100,
      requiredFdrAmountLakhs: 100
    },
    documents: INITIAL_DOCUMENTS_APP_1,
    findings: INITIAL_FINDINGS_APP_1,
    scrutinyRecommendation: {
      status: 'IN_PROGRESS',
      reviewerId: 'user-rev-1',
      reviewerName: 'Dr. Sunil K. Mehta',
      timestamp: '2026-10-21T14:30:00Z',
      rationale: 'Review ongoing. Fire safety certificate requires clarification regarding renewal scheduled for November 2026.',
      deficiencyPoints: [
        'Fire NOC valid till 03-Nov-2026: Provide written undertaking or renewal token issued by DFS.'
      ]
    }
  },
  {
    id: 'app-2',
    applicationNumber: 'APP-2026-INTAKE-4491',
    institutionId: 'inst-2',
    institutionName: 'Bangalore College of Engineering',
    pid: '1-14829104',
    region: 'South-Western',
    state: 'Karnataka',
    city: 'Bangalore Urban',
    type: 'INTAKE_VARIATION',
    status: 'DEFICIENCIES_NOTED',
    academicYear: '2026-27',
    submittedAt: '2026-10-15T09:40:00Z',
    lastUpdatedAt: '2026-10-21T16:20:00Z',
    currentVersion: 2,
    intakeDetails: {
      currentTotalIntake: 720,
      proposedTotalIntake: 840,
      totalStudents: 3120,
      facultyCount: 138,
      studentFacultyRatio: '1:22.6',
      professors: 8,
      associateProfessors: 22,
      assistantProfessors: 108,
      cadreRatioRatioStr: '1 : 2.75 : 13.5',
      totalBuiltUpAreaSqM: 21500,
      requiredBuiltUpAreaSqM: 18400,
      fdrCorpusAmountLakhs: 150,
      requiredFdrAmountLakhs: 150
    },
    documents: [
      {
        id: 'doc-201',
        applicationId: 'app-2',
        docType: 'FACULTY_CADRE',
        fileName: 'BCE_Faculty_Roster_Expanded_2026.pdf',
        fileSizeKb: 2840,
        fileHash: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b',
        uploadedAt: '2026-10-15T09:42:00Z',
        version: 1,
        pageCount: 16,
        status: 'FLAGGED',
        extractedFields: [
          { label: 'Total Faculty', value: '138 Faculty Members', page: 1, sourceLine: 'Total Full-time Faculty: 138', isCoherent: true },
          { label: 'Professors', value: '8 (Shortfall of 7)', page: 2, sourceLine: 'Professors: 8', isCoherent: false },
          { label: 'Associate Professors', value: '22', page: 2, sourceLine: 'Associate Professors: 22', isCoherent: true },
          { label: 'Assistant Professors', value: '108', page: 2, sourceLine: 'Assistant Professors: 108', isCoherent: true }
        ],
        forensics: {
          sha256Match: false,
          qrCodeValid: true,
          dateChronologyValid: true,
          remarks: ['Cadre imbalance: Severe deficit of senior professors to support additional 120 AI & DS intake.']
        },
        geminiAnalysis: {
          status: 'COMPLETED',
          modelUsed: 'gemini-3.5-flash',
          timestamp: '2026-10-15T09:45:00Z',
          summary: 'Institution proposes intake expansion of +120 seats in AI & Data Science. However, current SFR is 1:22.6 (above permitted 1:20) and senior professor cadre has a shortfall of 7 positions.',
          verifiedAttributes: {
            'Intake Increase Requested': '+120 Seats',
            'Cadre Balance': 'Non-compliant: 1:2.75:13.5'
          },
          detectedAnomalies: [
            'Student-to-Faculty Ratio exceeds statutory threshold of 1:20.',
            'Professor cadre deficit under Appendix 7 norms.'
          ],
          disclaimer: 'AI interpretation. Official calculation follows AICTE APH 2026 Table 7.1 formula.'
        }
      }
    ],
    findings: [
      {
        id: 'find-201',
        ruleId: 'rule-5',
        ruleCode: 'RULE-CADRE-RATIO-05',
        ruleName: 'Faculty-Student & Cadre Ratio Compliance',
        severity: 'CRITICAL',
        description: 'For requested intake of 840 (total 3,120 students), required faculty is 156 with 17 Professors. Institution currently employs only 138 faculty and 8 Professors (SFR 1:22.6).',
        handbookClause: 'Appendix 7 (Norms for Faculty Cadre Ratio 1:2:6)',
        isDeterministic: true
      }
    ],
    scrutinyRecommendation: {
      status: 'DEFICIENCIES_ISSUED',
      reviewerId: 'user-rev-2',
      reviewerName: 'Dr. Priya Nair',
      timestamp: '2026-10-20T11:15:00Z',
      rationale: 'Intake expansion of 120 seats cannot be recommended until the deficit of 18 faculty members (including 7 Professors) is recruited via statutory selection committee.',
      deficiencyPoints: [
        'Student Faculty Ratio is 1:22.6 (Exceeds 1:20 limit). Required 156 faculty.',
        'Professor cadre count is 8 against minimum required 17 as per Appendix 7.'
      ],
      officialNoticeNumber: 'AICTE/SWRO/DEF/2026/0491'
    }
  },
  {
    id: 'app-3',
    applicationNumber: 'APP-2026-NEW-9021',
    institutionId: 'inst-3',
    institutionName: 'Pune Academy of Technology',
    pid: '1-19827361',
    region: 'Western',
    state: 'Maharashtra',
    city: 'Pune',
    type: 'NEW_PROGRAMME',
    status: 'SCRUTINY_CLEARED',
    academicYear: '2026-27',
    submittedAt: '2026-10-12T14:10:00Z',
    lastUpdatedAt: '2026-10-21T18:00:00Z',
    currentVersion: 3,
    intakeDetails: {
      currentTotalIntake: 480,
      proposedTotalIntake: 510,
      totalStudents: 1980,
      facultyCount: 112,
      studentFacultyRatio: '1:17.6',
      professors: 16,
      associateProfessors: 32,
      assistantProfessors: 64,
      cadreRatioRatioStr: '1 : 2 : 4',
      totalBuiltUpAreaSqM: 18200,
      requiredBuiltUpAreaSqM: 13500,
      fdrCorpusAmountLakhs: 125,
      requiredFdrAmountLakhs: 100
    },
    documents: [],
    findings: [
      {
        id: 'find-301',
        ruleId: 'rule-1',
        ruleCode: 'RULE-CHECKLIST-01',
        ruleName: 'Mandatory Document Completeness',
        severity: 'PASSED',
        description: 'Complete verified documentation for New M.Tech Programme in Cyber-Physical Systems.',
        handbookClause: 'Clause 2.4.1',
        isDeterministic: true
      },
      {
        id: 'find-302',
        ruleId: 'rule-7',
        ruleCode: 'RULE-FDR-CORPUS-07',
        ruleName: 'Joint FDR Corpus Fund & Lien Status',
        severity: 'PASSED',
        description: 'Additional Security Deposit of ₹25 Lakhs created under joint lien with Member Secretary AICTE.',
        handbookClause: 'Clause 6.2',
        isDeterministic: true
      }
    ],
    scrutinyRecommendation: {
      status: 'RECOMMENDED_APPROVAL',
      reviewerId: 'user-rev-2',
      reviewerName: 'Dr. Priya Nair',
      timestamp: '2026-10-21T18:00:00Z',
      rationale: 'All infrastructure, faculty (SFR 1:17.6), specialized laboratory equipment, and affiliating university NOC are completely verified. Recommended for final Bureau approval.',
      deficiencyPoints: []
    }
  },
  {
    id: 'app-4',
    applicationNumber: 'APP-2026-INFRA-3312',
    institutionId: 'inst-1',
    institutionName: 'Delhi Institute of Technology & Science',
    pid: '1-10928371',
    region: 'Northern',
    state: 'Delhi',
    city: 'North Delhi',
    type: 'INFRASTRUCTURE_UPDATE',
    status: 'SUBMITTED',
    academicYear: '2026-27',
    submittedAt: '2026-10-22T06:30:00Z',
    lastUpdatedAt: '2026-10-22T06:30:00Z',
    currentVersion: 1,
    intakeDetails: {
      currentTotalIntake: 600,
      proposedTotalIntake: 600,
      totalStudents: 2400,
      facultyCount: 124,
      studentFacultyRatio: '1:19.3',
      professors: 14,
      associateProfessors: 28,
      assistantProfessors: 82,
      cadreRatioRatioStr: '1 : 2 : 5.8',
      totalBuiltUpAreaSqM: 24200,
      requiredBuiltUpAreaSqM: 14200,
      fdrCorpusAmountLakhs: 100,
      requiredFdrAmountLakhs: 100
    },
    documents: [],
    findings: []
  },
  {
    id: 'app-5',
    applicationNumber: 'APP-2026-EOA-5520',
    institutionId: 'inst-9',
    institutionName: 'Deccan Institute of Advanced Studies',
    pid: '1-18290122',
    region: 'Southern',
    state: 'Telangana',
    city: 'Hyderabad',
    type: 'EOA',
    status: 'UNDER_SCRUTINY',
    academicYear: '2026-27',
    submittedAt: '2026-10-20T14:15:00Z',
    lastUpdatedAt: '2026-10-21T10:00:00Z',
    currentVersion: 1,
    intakeDetails: {
      currentTotalIntake: 420,
      proposedTotalIntake: 420,
      totalStudents: 1680,
      facultyCount: 88,
      studentFacultyRatio: '1:19.0',
      professors: 10,
      associateProfessors: 20,
      assistantProfessors: 58,
      cadreRatioRatioStr: '1 : 2 : 5.8',
      totalBuiltUpAreaSqM: 14500,
      requiredBuiltUpAreaSqM: 11000,
      fdrCorpusAmountLakhs: 100,
      requiredFdrAmountLakhs: 100
    },
    documents: [
      {
        id: 'doc-501',
        applicationId: 'app-5',
        docType: 'LAND_TITLE',
        fileName: 'Registered_Sale_Deed_Khasra_441.pdf',
        fileSizeKb: 4210,
        fileHash: '8f4c28bb9c1184a49cbe5012e847c20a91176b9708faee6e1a499a0ff3769c01', // Exact duplicate of doc-101 from app-1!
        uploadedAt: '2026-10-20T14:18:00Z',
        version: 1,
        pageCount: 18,
        status: 'FLAGGED',
        extractedFields: [
          { label: 'Institution Name in Deed', value: 'Delhi Institute of Technology & Science', page: 1, sourceLine: 'Deed executed in favour of Delhi Institute of Technology & Science', isCoherent: false },
          { label: 'Filing Institution', value: 'Deccan Institute of Advanced Studies', page: 0, sourceLine: 'Portal application header: Deccan Institute (Hyderabad)', isCoherent: false }
        ],
        forensics: {
          sha256Match: true,
          duplicateApplicationId: 'APP-2026-EOA-1082',
          duplicateInstitutionName: 'Delhi Institute of Technology & Science',
          qrCodeValid: false,
          dateChronologyValid: false,
          remarks: [
            'CRITICAL FORENSIC ALERT: Exact SHA-256 binary duplicate of Land Title Deed registered by Delhi Institute of Technology & Science in 2012.',
            'Cross-trust document re-use detected by duplicate collision engine.'
          ]
        },
        geminiAnalysis: {
          status: 'COMPLETED',
          modelUsed: 'gemini-3.5-flash',
          timestamp: '2026-10-20T14:18:30Z',
          summary: 'CRITICAL MISMATCH: Document title deed explicitly names Delhi Institute of Technology & Science located in Delhi, but has been submitted by Deccan Institute of Advanced Studies (Hyderabad, Telangana). Probable fraudulent document reuse.',
          verifiedAttributes: {
            'Land Location': 'Alipur, Delhi (Mismatch with Hyderabad Telangana)',
            'Entity Named in Deed': 'Delhi Institute of Technology & Science'
          },
          detectedAnomalies: [
            'Binary hash match with an unrelated institution application.',
            'Geographic and institutional entity mismatch.'
          ],
          disclaimer: 'AI Forensics Flag. Formal statutory vigilance inquiry recommended.'
        }
      }
    ],
    findings: [
      {
        id: 'find-501',
        ruleId: 'rule-4',
        ruleCode: 'RULE-DUPLICATE-HASH-04',
        ruleName: 'Cross-Application SHA-256 Duplicate Collision',
        severity: 'CRITICAL',
        description: 'SHA-256 fingerprint collision detected: Uploaded Land Title Deed (8f4c28bb9c1184a49cbe5012e847c20a91176b9708faee6e1a499a0ff3769c01) is 100% byte-for-byte identical to document uploaded in APP-2026-EOA-1082 (Delhi Institute of Technology & Science).',
        documentId: 'doc-501',
        docType: 'LAND_TITLE',
        evidenceSnippet: 'Hash: 8f4c28bb... matches APP-2026-EOA-1082 (doc-101)',
        handbookClause: 'Clause 4.8.1 (Document Authenticity & Forensics)',
        isDeterministic: true
      },
      {
        id: 'find-502',
        ruleId: 'rule-3',
        ruleCode: 'RULE-PID-03',
        ruleName: 'Permanent Institute ID (PID) Coherence',
        severity: 'CRITICAL',
        description: 'Extracted text references "Delhi Institute of Technology & Science" while filing institution PID is 1-18290122 (Deccan Institute). Entity name mismatch.',
        documentId: 'doc-501',
        docType: 'LAND_TITLE',
        evidenceSnippet: 'Deed executed in favour of Delhi Institute of Technology & Science',
        handbookClause: 'Clause 1.2.3',
        isDeterministic: true
      }
    ]
  }
];

export const INITIAL_AUDIT_LOG: AuditEvent[] = [
  {
    id: 'aud-1',
    correlationId: 'req-4c901a8f-2026',
    timestamp: '2026-10-18T10:20:00Z',
    actorId: 'user-inst-1',
    actorName: 'Dr. Rajesh Sharma',
    actorRole: 'INSTITUTION',
    action: 'DOCUMENT_UPLOAD',
    targetType: 'DOCUMENT',
    targetId: 'doc-101',
    details: 'Uploaded Registered Sale Deed (18 pages, SHA-256: 8f4c28bb...). Extraction status: PROCESSED.',
    ipAddress: '14.139.60.22',
    sha256Hash: 'a71e892c9001b92c402123f1128e0892c9012399a0ff3769c018f4c28bb9c118'
  },
  {
    id: 'aud-2',
    correlationId: 'req-4c901a90-2026',
    timestamp: '2026-10-18T10:25:35Z',
    actorId: 'system',
    actorName: 'AICTE Rule Engine v2026.1',
    actorRole: 'ADMIN',
    action: 'DETERMINISTIC_EVALUATION',
    targetType: 'APPLICATION',
    targetId: 'app-1',
    details: 'Evaluated 7 core deterministic rules. Identified 1 warning: RULE-EXPIRY-02 on Fire NOC (DFS/HQ/2023/11029).',
    ipAddress: '127.0.0.1',
    sha256Hash: 'c402123f1128e0892c9012399a0ff3769c018f4c28bb9c118a71e892c9001b92'
  },
  {
    id: 'aud-3',
    correlationId: 'req-5a110b22-2026',
    timestamp: '2026-10-20T11:15:00Z',
    actorId: 'user-rev-2',
    actorName: 'Dr. Priya Nair',
    actorRole: 'REVIEWER',
    action: 'DEFICIENCY_NOTICE_ISSUED',
    targetType: 'APPLICATION',
    targetId: 'app-2',
    details: 'Issued official Scrutiny Deficiency Notice AICTE/SWRO/DEF/2026/0491 citing SFR 1:22.6 and deficit of 7 Professors.',
    ipAddress: '117.218.44.10',
    sha256Hash: '128e0892c9012399a0ff3769c018f4c28bb9c118a71e892c9001b92c402123f1'
  },
  {
    id: 'aud-4',
    correlationId: 'req-6d882f01-2026',
    timestamp: '2026-10-20T14:18:30Z',
    actorId: 'system',
    actorName: 'Forensics Duplicate Engine',
    actorRole: 'ADMIN',
    action: 'DUPLICATE_COLLISION_DETECTED',
    targetType: 'DOCUMENT',
    targetId: 'doc-501',
    details: 'ALERT: SHA-256 match 8f4c28bb... flagged between APP-2026-EOA-5520 (Deccan Institute) and APP-2026-EOA-1082 (DITS Delhi).',
    ipAddress: '127.0.0.1',
    sha256Hash: '012399a0ff3769c018f4c28bb9c118a71e892c9001b92c402123f1128e0892c9'
  },
  {
    id: 'aud-5',
    correlationId: 'req-7e991c44-2026',
    timestamp: '2026-10-21T18:00:00Z',
    actorId: 'user-rev-2',
    actorName: 'Dr. Priya Nair',
    actorRole: 'REVIEWER',
    action: 'SCRUTINY_RECOMMENDATION_CLEARED',
    targetType: 'APPLICATION',
    targetId: 'app-3',
    details: 'Application APP-2026-NEW-9021 recommended for Approval. Status updated to SCRUTINY_CLEARED.',
    ipAddress: '117.218.44.10',
    sha256Hash: 'ff3769c018f4c28bb9c118a71e892c9001b92c402123f1128e0892c9012399a0'
  }
];

export const INITIAL_FDR_RECORDS: import('../types').FdrRecord[] = [
  {
    id: 'fdr-1',
    fdrNumber: 'SBI-FDR-99201-2024',
    institutionId: 'inst-1',
    institutionName: 'Delhi Institute of Technology & Science',
    pid: '1-10928371',
    applicationNumber: 'APP-2026-EOA-1082',
    amountLakhs: 100,
    amountFormatted: '₹ 1,00,00,000 (1.00 Cr)',
    bankName: 'State Bank of India',
    branchName: 'Institutional Area Branch, New Delhi',
    ifscCode: 'SBIN0001234',
    issueDate: '2024-04-01',
    maturityDate: '2034-03-31',
    tenureYears: 10,
    status: 'ACTIVE',
    jointLienHolder: 'Regional Officer, Northern Regional Office, AICTE',
    isLienConfirmed: true,
    lienEndorsementToken: 'CBS-SBI-LIEN-AUTH-99201',
    lienEndorsedAt: '2024-04-05T10:00:00Z',
    renewalStatus: 'NOT_APPLICABLE'
  },
  {
    id: 'fdr-2',
    fdrNumber: 'SBI-FDR-44012-2025',
    institutionName: 'Bangalore College of Engineering',
    pid: '1-14829104',
    applicationNumber: 'APP-2026-INTAKE-4491',
    amountLakhs: 150,
    amountFormatted: '₹ 1,50,00,000 (1.50 Cr)',
    bankName: 'State Bank of India',
    branchName: 'MG Road Corporate Branch, Bangalore',
    ifscCode: 'SBIN0008892',
    issueDate: '2025-05-10',
    maturityDate: '2035-05-09',
    tenureYears: 10,
    status: 'ACTIVE',
    jointLienHolder: 'Regional Officer, South-Western Regional Office, AICTE',
    isLienConfirmed: true,
    lienEndorsementToken: 'CBS-SBI-LIEN-AUTH-44012',
    lienEndorsedAt: '2025-05-12T11:30:00Z',
    renewalStatus: 'NOT_APPLICABLE'
  },
  {
    id: 'fdr-3',
    fdrNumber: 'PNB-FDR-88192-2026',
    institutionName: 'Pune Academy of Technology',
    pid: '1-19827361',
    applicationNumber: 'APP-2026-NEW-9021',
    amountLakhs: 125,
    amountFormatted: '₹ 1,25,00,000 (1.25 Cr)',
    bankName: 'Punjab National Bank',
    branchName: 'Shivajinagar Branch, Pune',
    ifscCode: 'PUNB0124400',
    issueDate: '2026-02-15',
    maturityDate: '2036-02-14',
    tenureYears: 10,
    status: 'ACTIVE',
    jointLienHolder: 'Regional Officer, Western Regional Office, AICTE',
    isLienConfirmed: true,
    lienEndorsementToken: 'CBS-PNB-LIEN-AUTH-88192',
    lienEndorsedAt: '2026-02-18T14:15:00Z',
    renewalStatus: 'NOT_APPLICABLE'
  },
  {
    id: 'fdr-4',
    fdrNumber: 'CAN-FDR-11029-2016',
    institutionName: 'National Institute of Engineering & Applied Research',
    pid: '1-10029388',
    applicationNumber: 'APP-2026-EOA-7721',
    amountLakhs: 100,
    amountFormatted: '₹ 1,00,00,000 (1.00 Cr)',
    bankName: 'Canara Bank',
    branchName: 'Connaught Circus, New Delhi',
    ifscCode: 'CNRB0000109',
    issueDate: '2016-11-20',
    maturityDate: '2026-11-20', // Nov 2026 (Expiring in ~1 month)
    tenureYears: 10,
    status: 'EXPIRING_SOON',
    jointLienHolder: 'Regional Officer, Northern Regional Office, AICTE',
    isLienConfirmed: true,
    renewalStatus: 'UNDERTAKING_PENDING'
  },
  {
    id: 'fdr-5',
    fdrNumber: 'HDFC-FDR-66291-2016',
    institutionName: 'Aryabhatta College of Technical Sciences',
    pid: '1-12290481',
    applicationNumber: 'APP-2026-EOA-9922',
    amountLakhs: 75,
    amountFormatted: '₹ 75,00,000 (75 Lakhs)',
    bankName: 'HDFC Bank Ltd',
    branchName: 'Nehru Place, New Delhi',
    ifscCode: 'HDFC0000043',
    issueDate: '2016-11-28',
    maturityDate: '2026-11-28', // Nov 2026
    tenureYears: 10,
    status: 'EXPIRING_SOON',
    jointLienHolder: 'Regional Officer, Northern Regional Office, AICTE',
    isLienConfirmed: true,
    renewalStatus: 'RENEWAL_SUBMITTED'
  },
  {
    id: 'fdr-6',
    fdrNumber: 'BOB-FDR-33819-2016',
    institutionName: 'Karnataka Institute of Advanced Technology',
    pid: '1-15529100',
    applicationNumber: 'APP-2026-EOA-3381',
    amountLakhs: 100,
    amountFormatted: '₹ 1,00,00,000 (1.00 Cr)',
    bankName: 'Bank of Baroda',
    branchName: 'Jayanagar Branch, Bangalore',
    ifscCode: 'BARB0JAYANA',
    issueDate: '2016-12-15',
    maturityDate: '2026-12-15', // Dec 2026
    tenureYears: 10,
    status: 'EXPIRING_SOON',
    jointLienHolder: 'Regional Officer, South-Western Regional Office, AICTE',
    isLienConfirmed: true,
    renewalStatus: 'UNDERTAKING_PENDING'
  },
  {
    id: 'fdr-7',
    fdrNumber: 'SBI-FDR-55102-2017',
    institutionName: 'Apex Institute of Technology & Management',
    pid: '1-18829304',
    applicationNumber: 'APP-2026-EOA-5510',
    amountLakhs: 100,
    amountFormatted: '₹ 1,00,00,000 (1.00 Cr)',
    bankName: 'State Bank of India',
    branchName: 'Sector 62 Institutional, Noida',
    ifscCode: 'SBIN0005510',
    issueDate: '2017-01-10',
    maturityDate: '2027-01-10', // Jan 2027
    tenureYears: 10,
    status: 'EXPIRING_SOON',
    jointLienHolder: 'Regional Officer, Northern Regional Office, AICTE',
    isLienConfirmed: true,
    renewalStatus: 'NOT_APPLICABLE'
  },
  {
    id: 'fdr-8',
    fdrNumber: 'ICICI-FDR-90218-2017',
    institutionName: 'Sahyadri Polytechnic & Engineering College',
    pid: '1-13390214',
    applicationNumber: 'APP-2026-EOA-9021',
    amountLakhs: 85,
    amountFormatted: '₹ 85,00,000 (85 Lakhs)',
    bankName: 'ICICI Bank Ltd',
    branchName: 'Kothrud Branch, Pune',
    ifscCode: 'ICIC0000005',
    issueDate: '2017-02-28',
    maturityDate: '2027-02-28', // Feb 2027
    tenureYears: 10,
    status: 'EXPIRING_SOON',
    jointLienHolder: 'Regional Officer, Western Regional Office, AICTE',
    isLienConfirmed: true,
    renewalStatus: 'UNDERTAKING_PENDING'
  },
  {
    id: 'fdr-9',
    fdrNumber: 'SBI-FDR-77821-2017',
    institutionName: 'Telangana Institute of Technical Studies',
    pid: '1-14490122',
    applicationNumber: 'APP-2026-EOA-7782',
    amountLakhs: 100,
    amountFormatted: '₹ 1,00,00,000 (1.00 Cr)',
    bankName: 'State Bank of India',
    branchName: 'Hitech City Branch, Hyderabad',
    ifscCode: 'SBIN0011440',
    issueDate: '2017-03-31',
    maturityDate: '2027-03-31', // Mar 2027
    tenureYears: 10,
    status: 'EXPIRING_SOON',
    jointLienHolder: 'Regional Officer, Southern Regional Office, AICTE',
    isLienConfirmed: true,
    renewalStatus: 'NOT_APPLICABLE'
  },
  {
    id: 'fdr-10',
    fdrNumber: 'PNB-FDR-12093-2017',
    institutionName: 'Gujarat Technological Institute',
    pid: '1-16629108',
    applicationNumber: 'APP-2026-EOA-1209',
    amountLakhs: 100,
    amountFormatted: '₹ 1,00,00,000 (1.00 Cr)',
    bankName: 'Punjab National Bank',
    branchName: 'Navrangpura, Ahmedabad',
    ifscCode: 'PUNB0001200',
    issueDate: '2017-03-15',
    maturityDate: '2027-03-15', // Mar 2027
    tenureYears: 10,
    status: 'EXPIRING_SOON',
    jointLienHolder: 'Regional Officer, Central Regional Office, AICTE',
    isLienConfirmed: true,
    renewalStatus: 'NOT_APPLICABLE'
  },
  {
    id: 'fdr-11',
    fdrNumber: 'SBI-FDR-10928-2016',
    institutionName: 'Heritage Institute of Technology',
    pid: '1-17729104',
    applicationNumber: 'APP-2026-EOA-1092',
    amountLakhs: 100,
    amountFormatted: '₹ 1,00,00,000 (1.00 Cr)',
    bankName: 'State Bank of India',
    branchName: 'Salt Lake Sector V, Kolkata',
    ifscCode: 'SBIN0008899',
    issueDate: '2016-08-31',
    maturityDate: '2026-08-31', // Already Matured in Aug 2026
    tenureYears: 10,
    status: 'MATURED',
    jointLienHolder: 'Regional Officer, Eastern Regional Office, AICTE',
    isLienConfirmed: true,
    renewalStatus: 'UNDERTAKING_PENDING'
  },
  {
    id: 'fdr-12',
    fdrNumber: 'CAN-FDR-88201-2016',
    institutionName: 'Malnad Institute of Technology',
    pid: '1-19920188',
    applicationNumber: 'APP-2026-EOA-8820',
    amountLakhs: 80,
    amountFormatted: '₹ 80,00,000 (80 Lakhs)',
    bankName: 'Canara Bank',
    branchName: 'Hassan Main Branch, Karnataka',
    ifscCode: 'CNRB0000882',
    issueDate: '2016-09-15',
    maturityDate: '2026-09-15', // Already Matured in Sep 2026
    tenureYears: 10,
    status: 'MATURED',
    jointLienHolder: 'Regional Officer, South-Western Regional Office, AICTE',
    isLienConfirmed: true,
    renewalStatus: 'NOT_APPLICABLE'
  },
  {
    id: 'fdr-13',
    fdrNumber: 'SBI-FDR-90112-2026',
    institutionName: 'Surya College of Computer Sciences',
    pid: '1-21102983',
    applicationNumber: 'APP-2026-NEW-9011',
    amountLakhs: 100,
    amountFormatted: '₹ 1,00,00,000 (1.00 Cr)',
    bankName: 'State Bank of India',
    branchName: 'Anna Salai Branch, Chennai',
    ifscCode: 'SBIN0001928',
    issueDate: '2026-10-10',
    maturityDate: '2036-10-09',
    tenureYears: 10,
    status: 'UNDER_VERIFICATION',
    jointLienHolder: 'Regional Officer, Southern Regional Office, AICTE',
    isLienConfirmed: false,
    renewalStatus: 'NOT_APPLICABLE'
  },
  {
    id: 'fdr-14',
    fdrNumber: 'HDFC-FDR-33109-2026',
    institutionName: 'Vardhaman Institute of Applied Engineering',
    pid: '1-23309188',
    applicationNumber: 'APP-2026-NEW-3310',
    amountLakhs: 120,
    amountFormatted: '₹ 1,20,00,000 (1.20 Cr)',
    bankName: 'HDFC Bank Ltd',
    branchName: 'Gachibowli Branch, Hyderabad',
    ifscCode: 'HDFC0001209',
    issueDate: '2026-10-18',
    maturityDate: '2036-10-17',
    tenureYears: 10,
    status: 'UNDER_VERIFICATION',
    jointLienHolder: 'Regional Officer, Southern Regional Office, AICTE',
    isLienConfirmed: false,
    renewalStatus: 'NOT_APPLICABLE'
  },
  {
    id: 'fdr-15',
    fdrNumber: 'BOB-FDR-77102-2014',
    institutionName: 'Pioneer College of Management (Closed)',
    pid: '1-10088921',
    applicationNumber: 'APP-2024-CLOSURE-7710',
    amountLakhs: 50,
    amountFormatted: '₹ 50,00,000 (50 Lakhs)',
    bankName: 'Bank of Baroda',
    branchName: 'Indore Main Branch, Madhya Pradesh',
    ifscCode: 'BARB0INDORE',
    issueDate: '2014-06-20',
    maturityDate: '2024-06-19',
    tenureYears: 10,
    status: 'RELEASED',
    jointLienHolder: 'Regional Officer, Central Regional Office, AICTE',
    isLienConfirmed: true,
    renewalStatus: 'NOT_APPLICABLE',
    releaseRequest: {
      requestedAt: '2024-07-15T10:00:00Z',
      reason: 'Statutory 10-year term completed following formal institutional closure and zero student liabilities clearance.',
      status: 'APPROVED',
      approvedBy: 'Shri R. C. Verma (Advisor, Regulation Bureau)',
      approvedAt: '2024-08-01T15:00:00Z'
    }
  },
  {
    id: 'fdr-16',
    fdrNumber: 'SBI-FDR-22910-2020',
    institutionName: 'Greater Noida Institute of Technology',
    pid: '1-11223344',
    applicationNumber: 'APP-2026-EOA-2291',
    amountLakhs: 100,
    amountFormatted: '₹ 1,00,00,000 (1.00 Cr)',
    bankName: 'State Bank of India',
    branchName: 'Knowledge Park II, Greater Noida',
    ifscCode: 'SBIN0011220',
    issueDate: '2020-07-15',
    maturityDate: '2030-07-14',
    tenureYears: 10,
    status: 'ACTIVE',
    jointLienHolder: 'Regional Officer, Northern Regional Office, AICTE',
    isLienConfirmed: true,
    lienEndorsementToken: 'CBS-SBI-LIEN-AUTH-22910',
    lienEndorsedAt: '2020-07-18T10:00:00Z'
  },
  {
    id: 'fdr-17',
    fdrNumber: 'PNB-FDR-66710-2021',
    institutionName: 'Coimbatore Institute of Engineering & Technology',
    pid: '1-15566778',
    applicationNumber: 'APP-2026-EOA-6671',
    amountLakhs: 100,
    amountFormatted: '₹ 1,00,00,000 (1.00 Cr)',
    bankName: 'Punjab National Bank',
    branchName: 'Gandhipuram, Coimbatore',
    ifscCode: 'PUNB0006670',
    issueDate: '2021-08-20',
    maturityDate: '2031-08-19',
    tenureYears: 10,
    status: 'ACTIVE',
    jointLienHolder: 'Regional Officer, Southern Regional Office, AICTE',
    isLienConfirmed: true,
    lienEndorsementToken: 'CBS-PNB-LIEN-AUTH-66710',
    lienEndorsedAt: '2021-08-22T12:00:00Z'
  },
  {
    id: 'fdr-18',
    fdrNumber: 'CAN-FDR-99812-2022',
    institutionName: 'Jaipur Technical University College',
    pid: '1-18899812',
    applicationNumber: 'APP-2026-EOA-9981',
    amountLakhs: 100,
    amountFormatted: '₹ 1,00,00,000 (1.00 Cr)',
    bankName: 'Canara Bank',
    branchName: 'MI Road, Jaipur',
    ifscCode: 'CNRB0000998',
    issueDate: '2022-09-01',
    maturityDate: '2032-08-31',
    tenureYears: 10,
    status: 'ACTIVE',
    jointLienHolder: 'Regional Officer, North-Western Regional Office, AICTE',
    isLienConfirmed: true,
    lienEndorsementToken: 'CBS-CAN-LIEN-AUTH-99812',
    lienEndorsedAt: '2022-09-05T14:30:00Z'
  }
];

export const INITIAL_NOTIFICATIONS: import('../types').RegulatoryNotification[] = [
  {
    id: 'notif-1',
    title: 'Upcoming FDR Expiry Notice',
    message: 'FDR No. CAN-FDR-11029-2016 for National Institute of Engineering expires on 20-Nov-2026. Renewal token required.',
    type: 'CRITICAL',
    timestamp: '2026-10-22T06:00:00Z',
    isRead: false,
    linkTab: 'renewals',
    fdrNumber: 'CAN-FDR-11029-2016'
  },
  {
    id: 'notif-2',
    title: 'New FDR Lien Endorsement Pending',
    message: 'Surya College of Computer Sciences has submitted SBI-FDR-90112-2026 (₹1.00 Cr) awaiting Bank CBS joint lien confirmation.',
    type: 'WARNING',
    timestamp: '2026-10-21T14:20:00Z',
    isRead: false,
    linkTab: 'verification_center',
    fdrNumber: 'SBI-FDR-90112-2026'
  },
  {
    id: 'notif-3',
    title: 'Scrutiny Committee Approval Recommendation',
    message: 'Application APP-2026-NEW-9021 (Pune Academy of Technology) cleared scrutiny and recommended for final EoA decree.',
    type: 'SUCCESS',
    timestamp: '2026-10-21T18:00:00Z',
    isRead: false,
    linkTab: 'reports',
    applicationNumber: 'APP-2026-NEW-9021'
  },
  {
    id: 'notif-4',
    title: 'Duplicate SHA-256 Hash Collision Flagged',
    message: 'Forensic alert: Title Deed hash collision detected in application APP-2026-EOA-5520 (Deccan Institute).',
    type: 'CRITICAL',
    timestamp: '2026-10-20T14:18:30Z',
    isRead: true,
    linkTab: 'verification_center',
    applicationNumber: 'APP-2026-EOA-5520'
  }
];
