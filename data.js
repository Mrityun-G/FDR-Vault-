/* Seed data for the Institution portal.
   Sourced from the AICTE Intelligent Regulatory Validation Platform web prototype
   (users, applications, documents, findings, FDR ledger, rules, authority adapters, audit ledger),
   filtered to the INSTITUTION role. Records marked `demo: true` are supplementary so that the
   renewal and lien-release flows can be exercised from an institution account. */
'use strict';

const USERS = [
  { id: 'user-inst-1', name: 'Dr. Rajesh Sharma', email: 'principal@dits-delhi.edu.in', role: 'INSTITUTION', designation: 'Principal & Director', institutionId: 'inst-1', pid: '1-10928371', region: 'Northern', mobile: '+91 90000 10001', demoPassword: 'Dits@2026' },
  { id: 'user-inst-2', name: 'Prof. Ananya Rao', email: 'director@bce-bangalore.edu.in', role: 'INSTITUTION', designation: 'Director', institutionId: 'inst-2', pid: '1-14829104', region: 'South-Western', mobile: '+91 90000 10002', demoPassword: 'Bce@2026' },
  { id: 'user-inst-3', name: 'Dr. Vikram Deshmukh', email: 'dean@pat-pune.ac.in', role: 'INSTITUTION', designation: 'Dean (Academics & Affiliations)', institutionId: 'inst-3', pid: '1-19827361', region: 'Western', mobile: '+91 90000 10003', demoPassword: 'Pat@2026' },
  // Non-institution accounts exist only so the portal can refuse them (role-based access control).
  { id: 'user-rev-1', name: 'Dr. Sunil K. Mehta', email: 'reviewer.mehta@aicte-india.org', role: 'REVIEWER' },
  { id: 'user-rev-2', name: 'Dr. Priya Nair', email: 'reviewer.nair@aicte-india.org', role: 'REVIEWER' },
  { id: 'user-adm-1', name: 'Shri R. C. Verma', email: 'admin.verma@aicte-india.org', role: 'ADMIN' },
  { id: 'user-bank-1', name: 'Shri Amitesh Kumar', email: 'fdr.officer@sbi.co.in', role: 'BANK_OFFICIAL' },
];

const INSTITUTIONS = [
  { id: 'inst-1', name: 'Delhi Institute of Technology & Science', short: 'DITS Delhi', pid: '1-10928371', city: 'North Delhi', district: 'North Delhi', state: 'Delhi', region: 'Northern', type: 'Unaided - Private', address: 'Revenue Village Alipur, North Delhi, Delhi - 110036', website: 'www.dits-delhi.edu.in', sanctionedIntake: 600, totalStudents: 2400, sfr: '1:19.3', requiredFdrLakhs: 100 },
  { id: 'inst-2', name: 'Bangalore College of Engineering', short: 'BCE Bangalore', pid: '1-14829104', city: 'Bangalore Urban', district: 'Bangalore Urban', state: 'Karnataka', region: 'South-Western', type: 'Unaided - Private', address: 'Bangalore Urban, Karnataka - 560001', website: 'www.bce-bangalore.edu.in', sanctionedIntake: 840, totalStudents: 3120, sfr: '1:22.6', requiredFdrLakhs: 150 },
  { id: 'inst-3', name: 'Pune Academy of Technology', short: 'PAT Pune', pid: '1-19827361', city: 'Pune', district: 'Pune', state: 'Maharashtra', region: 'Western', type: 'Autonomous Institute', address: 'Shivajinagar, Pune, Maharashtra - 411005', website: 'www.pat-pune.ac.in', sanctionedIntake: 510, totalStudents: 1980, sfr: '1:17.6', requiredFdrLakhs: 100 },
];

const RULES = [
  { code: 'RULE-CHECKLIST-01', name: 'Mandatory Document Completeness', category: 'CHECKLIST', handbookClause: 'Clause 2.4.1 (Mandatory Submissions)', severity: 'CRITICAL', description: 'Verifies that all 7 mandatory documents (Land Title, Building NOC, Fire Safety NOC, FDR, Affiliation, State NOC, Faculty Register) are uploaded with non-zero byte size.' },
  { code: 'RULE-EXPIRY-02', name: 'Statutory Certificate Expiry Verification', category: 'EXPIRY', handbookClause: 'Clause 3.1.2 (Validity of Approvals)', severity: 'CRITICAL', description: 'Ensures Fire Safety NOC, University Affiliation, and Building Stability certificates have not expired and are valid through the academic session 2026-27 (minimum 6 months remaining).' },
  { code: 'RULE-PID-03', name: 'Permanent Institute ID (PID) Coherence', category: 'IDENTITY', handbookClause: 'Clause 1.2.3 (Institutional Identification)', severity: 'CRITICAL', description: 'Cross-checks extracted institution names and Permanent Institute ID (PID) across all submitted certificates against the AICTE master registry.' },
  { code: 'RULE-DUPLICATE-HASH-04', name: 'Cross-Application SHA-256 Duplicate Collision', category: 'FORENSICS', handbookClause: 'Clause 4.8.1 (Document Authenticity & Forensics)', severity: 'CRITICAL', description: 'Detects if any uploaded document binary produces an identical SHA-256 fingerprint already submitted by a distinct institution or application.' },
  { code: 'RULE-CADRE-RATIO-05', name: 'Faculty-Student & Cadre Ratio Compliance', category: 'CADRE', handbookClause: 'Appendix 7 (Norms for Faculty Cadre Ratio 1:2:6)', severity: 'WARNING', description: 'Validates that Student-to-Faculty Ratio (SFR) does not exceed 1:20 (B.Tech) and Cadre distribution satisfies 1 Professor : 2 Associate Professors : 6 Assistant Professors.' },
  { code: 'RULE-BUILTUP-AREA-06', name: 'Instructional & Administrative Area Norms', category: 'INFRASTRUCTURE', handbookClause: 'Appendix 4 (Norms for Land and Built-Up Area)', severity: 'WARNING', description: 'Validates that total instructional, administrative, and amenity carpet area matches or exceeds AICTE norms (5.5 sq.m per student).' },
  { code: 'RULE-FDR-CORPUS-07', name: 'Joint FDR Corpus Fund & Lien Status', category: 'FINANCE', handbookClause: 'Clause 6.2 (Security Deposit & Corpus Fund)', severity: 'CRITICAL', description: 'Verifies Fixed Deposit Receipt (FDR) maturity date, minimum required corpus (₹100 Lakhs), and mandatory joint lien status in the name of the Regional Officer, AICTE.' },
];

const APPS = [
  {
    id: 'app-1', applicationNumber: 'APP-2026-EOA-1082', institutionId: 'inst-1', type: 'EOA', status: 'UNDER_SCRUTINY', academicYear: '2026-27',
    submittedAt: '2026-10-18T11:00:00Z', lastUpdatedAt: '2026-10-22T08:15:00Z', currentVersion: 1, fdrNumber: 'SBI-FDR-99201-2024',
    intakeDetails: { currentTotalIntake: 600, proposedTotalIntake: 600, totalStudents: 2400, facultyCount: 124, professors: 14, associateProfessors: 28, assistantProfessors: 82, totalBuiltUpAreaSqM: 19850, fdrCorpusAmountLakhs: 100, requiredFdrAmountLakhs: 100 },
    documents: [
      { id: 'doc-101', docType: 'LAND_TITLE', fileName: 'Registered_Sale_Deed_Khasra_441.pdf', fileSizeKb: 4210, fileHash: '8f4c28bb9c1184a49cbe5012e847c20a91176b9708faee6e1a499a0ff3769c01', uploadedAt: '2026-10-18T10:20:00Z', version: 1, pageCount: 18, status: 'PROCESSED',
        extractedFields: [
          { label: 'Institution Name', value: 'Delhi Institute of Technology & Science', page: 1, sourceLine: 'Deed executed in favour of Delhi Institute of Technology & Science', isCoherent: true },
          { label: 'Land Area (Acres)', value: '10.5 Acres (Contiguous)', page: 2, sourceLine: 'Total contiguous land measuring 10.50 Acres in Revenue Village Alipur', isCoherent: true },
          { label: 'Khasra Numbers', value: 'Khasra No. 441/2, 442, 443/1', page: 2, sourceLine: 'Khasra Nos: 441/2, 442, 443/1 registered sub-district North Delhi', isCoherent: true },
          { label: 'Registration Date', value: '2012-04-18', page: 18, sourceLine: 'Registered before Sub-Registrar IV on 18th day of April 2012', isCoherent: true } ],
        forensics: { sha256Match: false, qrCodeValid: true, qrPayload: { issuingAuthority: 'Dept of Revenue, Govt of NCT Delhi', certId: 'DEL-REV-2012-88192', issueDate: '2012-04-18', validTill: 'PERPETUAL', signerName: 'Sub-Registrar IV, North Delhi' }, dateChronologyValid: true, chronologyDetails: 'Sale deed (2012) precedes society formation (2010 resolution) and AICTE initial grant (2014).', remarks: ['High resolution scan', 'Sub-registrar digital stamp verified', 'No hash collisions detected'] },
        geminiAnalysis: { status: 'COMPLETED', modelUsed: 'gemini-3.5-flash', timestamp: '2026-10-18T10:20:45Z', summary: 'Land ownership title deed in name of the applicant trust is confirmed with contiguous land parcel of 10.5 acres meeting AICTE rural/urban norms.', verifiedAttributes: { 'Land Title Status': 'Clear & Unencumbered', 'Contiguity': '100% Contiguous single parcel', 'Zoning Classification': 'Institutional / Educational Use Permitted' }, detectedAnomalies: [], disclaimer: 'AI interpretation based on extracted document text. Not a legal ownership decree.' },
        sourceTextPreview: 'This indenture of sale deed made on 18-04-2012 between the Vendor and Delhi Institute of Technology & Science, conveying 10.5 acres at Khasra 441/2...' },
      { id: 'doc-102', docType: 'FIRE_SAFETY', fileName: 'Delhi_Fire_Service_NOC_2025.pdf', fileSizeKb: 1850, fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', uploadedAt: '2026-10-18T10:25:00Z', version: 1, pageCount: 4, status: 'FLAGGED', validTill: '2026-11-03',
        extractedFields: [
          { label: 'Certificate No', value: 'DFS/HQ/2023/11029', page: 1, sourceLine: 'Ref No: DFS/HQ/2023/11029 dated 04.11.2023', isCoherent: true },
          { label: 'Issue Date', value: '2023-11-04', page: 1, sourceLine: 'Certificate Issued On: 04/11/2023', isCoherent: true },
          { label: 'Expiry Date', value: '2026-11-03', page: 2, sourceLine: 'Valid for a period of 3 years subject to annual maintenance till 03.11.2026', isCoherent: false },
          { label: 'Occupancy Class', value: 'Educational Group B', page: 1, sourceLine: 'Premises approved for Educational Building (Group B) occupancy', isCoherent: true } ],
        forensics: { sha256Match: false, qrCodeValid: true, qrPayload: { issuingAuthority: 'Delhi Fire Service Headquarters', certId: 'DFS/HQ/2023/11029', issueDate: '2023-11-04', validTill: '2026-11-03', signerName: 'Chief Fire Officer, Delhi Fire Service' }, dateChronologyValid: true, chronologyDetails: 'Certificate is valid currently, but expires within 12 days of statutory cut-off.', remarks: ['Expiry date falls in early November 2026 - Renewal certificate required for next academic term.'] },
        geminiAnalysis: { status: 'COMPLETED', modelUsed: 'gemini-3.5-flash', timestamp: '2026-10-18T10:25:35Z', summary: 'Fire Safety Certificate is authentic from Delhi Fire Service, however expiry is on 03-Nov-2026 which requires submission of renewal undertaking before final EoA release.', verifiedAttributes: { 'DFS Certificate Status': 'Valid but near expiry', 'Building Height': '14.8 meters (Permitted < 15m)', 'Fire Escape Staircases': '2 Adequate width staircases present' }, detectedAnomalies: ['NOC renewal due within current calendar semester.'], disclaimer: 'AI interpretation. Official validity relies on physical firefighting equipment inspection.' },
        sourceTextPreview: 'GOVERNMENT OF NATIONAL CAPITAL TERRITORY OF DELHI, HEADQUARTERS: DELHI FIRE SERVICE: NEW DELHI. No. DFS/HQ/2023/11029. Dated: 04/11/2023. FIRE SAFETY CERTIFICATE...' },
      { id: 'doc-103', docType: 'FDR_CORPUS', fileName: 'Joint_FDR_Corpus_SBI_Lien.pdf', fileSizeKb: 920, fileHash: '4a5e1e7f3d89b12a9c402123f1128e0892c9012399a0ff3769c018f4c28bb9c1', uploadedAt: '2026-10-18T10:30:00Z', version: 1, pageCount: 2, status: 'PROCESSED',
        extractedFields: [
          { label: 'Bank Name', value: 'State Bank of India', page: 1, sourceLine: 'State Bank of India, Institutional Area Branch, New Delhi', isCoherent: true },
          { label: 'FDR Number', value: 'SBI-FDR-99201-2024', page: 1, sourceLine: 'Term Deposit Receipt No: SBI-FDR-99201-2024', isCoherent: true },
          { label: 'Deposit Amount', value: '₹ 1,00,00,000.00 (One Crore)', page: 1, sourceLine: 'Amount: INR 1,00,00,000 (Rupees One Crore Only)', isCoherent: true },
          { label: 'Lien Holder', value: 'Regional Officer, Northern Regional Office, AICTE', page: 1, sourceLine: 'Under irrevocable joint lien with Regional Officer, AICTE, New Delhi', isCoherent: true },
          { label: 'Maturity Date', value: '2034-03-31', page: 1, sourceLine: 'Tenure 10 years, Maturity Date: 31-03-2034', isCoherent: true } ],
        forensics: { sha256Match: false, qrCodeValid: true, dateChronologyValid: true, remarks: ['Core Banking CBS signature matches SBI records', 'Irrevocable lien clause confirmed'] },
        geminiAnalysis: { status: 'COMPLETED', modelUsed: 'gemini-3.5-flash', timestamp: '2026-10-18T10:30:20Z', summary: 'FDR for Rs 1 Crore is verified in joint name with AICTE Member Secretary with tenure up to 2034, satisfying Chapter VI financial security norms.', verifiedAttributes: { 'Corpus Amount': 'Rs 100 Lakhs (Fully met)', 'Lien Status': 'AICTE Joint Lien Recorded' }, detectedAnomalies: [], disclaimer: 'AI verification. Core Banking system holds authoritative ledger balance.' },
        sourceTextPreview: 'STATE BANK OF INDIA - TERM DEPOSIT ADVICE / SPECIAL FIXED DEPOSIT RECEIPT. Depositor: Delhi Institute of Technology & Science and Regional Officer AICTE...' },
      { id: 'doc-104', docType: 'FACULTY_CADRE', fileName: 'Certified_Faculty_Cadre_Register_AY26.pdf', fileSizeKb: 3100, fileHash: '7c89a0b12d34ef5678901234567890abcdef1234567890abcdef1234567890ab', uploadedAt: '2026-10-18T10:35:00Z', version: 1, pageCount: 12, status: 'PROCESSED',
        extractedFields: [
          { label: 'Total Faculty', value: '124 Regular Faculty', page: 1, sourceLine: 'Total Teaching Faculty on rolls: 124 (Full-time Regular)', isCoherent: true },
          { label: 'Professors', value: '14', page: 2, sourceLine: 'Cadre breakdown: Professors - 14', isCoherent: true },
          { label: 'Associate Professors', value: '28', page: 2, sourceLine: 'Associate Professors - 28', isCoherent: true },
          { label: 'Assistant Professors', value: '82', page: 2, sourceLine: 'Assistant Professors - 82', isCoherent: true },
          { label: 'Ph.D. Holders', value: '64 (51.6%)', page: 3, sourceLine: 'Faculty with Doctoral Degree (Ph.D.): 64', isCoherent: true } ],
        forensics: { sha256Match: false, qrCodeValid: true, dateChronologyValid: true, remarks: ['Aadhaar authenticated faculty records verified against duplicate faculty portal'] },
        geminiAnalysis: { status: 'COMPLETED', modelUsed: 'gemini-3.5-flash', timestamp: '2026-10-18T10:35:40Z', summary: 'Faculty roster shows 124 full-time teaching staff. Cadre ratio is 14:28:82 which conforms to 1:2:6 ratio requirements for existing sanctioned intake of 2400 students.', verifiedAttributes: { 'Student Faculty Ratio': '1:19.3 (Norm <= 1:20)', 'Cadre Proportion': '1.0 : 2.0 : 5.8 (Compliant)' }, detectedAnomalies: [], disclaimer: 'AI interpretation. Physical biometric presence subject to Surprise Scrutiny Committee visit.' },
        sourceTextPreview: 'FACULTY CADRE REGISTER FOR ACADEMIC YEAR 2026-2027. Certified by Principal Dr. Rajesh Sharma, Delhi Institute of Technology & Science...' },
    ],
    findings: [
      { id: 'find-101', ruleCode: 'RULE-EXPIRY-02', ruleName: 'Statutory Certificate Expiry Verification', severity: 'WARNING', description: 'Fire Safety Certificate No. DFS/HQ/2023/11029 expires on 2026-11-03, which is within the upcoming academic session. Renewal application or renewal receipt must be submitted.', docType: 'FIRE_SAFETY', evidenceSnippet: 'Valid for a period of 3 years subject to annual maintenance till 03.11.2026 (Page 2, Line 8)', handbookClause: 'Clause 3.1.2 (Validity of Approvals)', isDeterministic: true },
      { id: 'find-102', ruleCode: 'RULE-CHECKLIST-01', ruleName: 'Mandatory Document Completeness', severity: 'PASSED', description: 'All 7 mandatory statutory categories have been provided with valid digital signatures and parseable source lines.', handbookClause: 'Clause 2.4.1 (Mandatory Submissions)', isDeterministic: true },
      { id: 'find-103', ruleCode: 'RULE-PID-03', ruleName: 'Permanent Institute ID (PID) Coherence', severity: 'PASSED', description: 'PID 1-10928371 matches Delhi Institute of Technology & Science in Council Master Registry without discrepancies.', handbookClause: 'Clause 1.2.3', isDeterministic: true },
      { id: 'find-104', ruleCode: 'RULE-DUPLICATE-HASH-04', ruleName: 'Cross-Application SHA-256 Duplicate Collision', severity: 'PASSED', description: 'Zero duplicate SHA-256 hash collisions found across 14,890 historical AICTE institutional filings.', handbookClause: 'Clause 4.8.1', isDeterministic: true },
      { id: 'find-105', ruleCode: 'RULE-CADRE-RATIO-05', ruleName: 'Faculty-Student & Cadre Ratio Compliance', severity: 'PASSED', description: 'Calculated SFR is 1:19.3 (norm <= 1:20). Cadre distribution 14 : 28 : 82 fulfills AICTE 1:2:6 ratio norm.', handbookClause: 'Appendix 7', isDeterministic: true },
    ],
    scrutinyRecommendation: { status: 'IN_PROGRESS', reviewerName: 'Dr. Sunil K. Mehta', timestamp: '2026-10-21T14:30:00Z', rationale: 'Review ongoing. Fire safety certificate requires clarification regarding renewal scheduled for November 2026.', deficiencyPoints: ['Fire NOC valid till 03-Nov-2026: Provide written undertaking or renewal token issued by DFS.'] },
    responses: [],
  },
  {
    id: 'app-2', applicationNumber: 'APP-2026-INTAKE-4491', institutionId: 'inst-2', type: 'INTAKE_VARIATION', status: 'DEFICIENCIES_NOTED', academicYear: '2026-27',
    submittedAt: '2026-10-15T09:40:00Z', lastUpdatedAt: '2026-10-21T16:20:00Z', currentVersion: 2, fdrNumber: 'SBI-FDR-44012-2025',
    programme: { programme: 'B.Tech Artificial Intelligence & Data Science', change: 'Increase in intake', programmeIntake: 120 },
    intakeDetails: { currentTotalIntake: 720, proposedTotalIntake: 840, totalStudents: 3120, facultyCount: 138, professors: 8, associateProfessors: 22, assistantProfessors: 108, totalBuiltUpAreaSqM: 21500, fdrCorpusAmountLakhs: 150, requiredFdrAmountLakhs: 150 },
    documents: [
      { id: 'doc-201', docType: 'FACULTY_CADRE', fileName: 'BCE_Faculty_Roster_Expanded_2026.pdf', fileSizeKb: 2840, fileHash: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b', uploadedAt: '2026-10-15T09:42:00Z', version: 1, pageCount: 16, status: 'FLAGGED',
        extractedFields: [
          { label: 'Total Faculty', value: '138 Faculty Members', page: 1, sourceLine: 'Total Full-time Faculty: 138', isCoherent: true },
          { label: 'Professors', value: '8 (Shortfall of 7)', page: 2, sourceLine: 'Professors: 8', isCoherent: false },
          { label: 'Associate Professors', value: '22', page: 2, sourceLine: 'Associate Professors: 22', isCoherent: true },
          { label: 'Assistant Professors', value: '108', page: 2, sourceLine: 'Assistant Professors: 108', isCoherent: true } ],
        forensics: { sha256Match: false, qrCodeValid: true, dateChronologyValid: true, remarks: ['Cadre imbalance: Severe deficit of senior professors to support additional 120 AI & DS intake.'] },
        geminiAnalysis: { status: 'COMPLETED', modelUsed: 'gemini-3.5-flash', timestamp: '2026-10-15T09:45:00Z', summary: 'Institution proposes intake expansion of +120 seats in AI & Data Science. However, current SFR is 1:22.6 (above permitted 1:20) and senior professor cadre has a shortfall of 7 positions.', verifiedAttributes: { 'Intake Increase Requested': '+120 Seats', 'Cadre Balance': 'Non-compliant: 1:2.75:13.5' }, detectedAnomalies: ['Student-to-Faculty Ratio exceeds statutory threshold of 1:20.', 'Professor cadre deficit under Appendix 7 norms.'], disclaimer: 'AI interpretation. Official calculation follows AICTE APH 2026 Table 7.1 formula.' } },
    ],
    findings: [
      { id: 'find-201', ruleCode: 'RULE-CADRE-RATIO-05', ruleName: 'Faculty-Student & Cadre Ratio Compliance', severity: 'CRITICAL', description: 'For requested intake of 840 (total 3,120 students), required faculty is 156 with 17 Professors. Institution currently employs only 138 faculty and 8 Professors (SFR 1:22.6).', handbookClause: 'Appendix 7 (Norms for Faculty Cadre Ratio 1:2:6)', isDeterministic: true },
    ],
    scrutinyRecommendation: { status: 'DEFICIENCIES_ISSUED', reviewerName: 'Dr. Priya Nair', timestamp: '2026-10-20T11:15:00Z', rationale: 'Intake expansion of 120 seats cannot be recommended until the deficit of 18 faculty members (including 7 Professors) is recruited via statutory selection committee.', deficiencyPoints: ['Student Faculty Ratio is 1:22.6 (Exceeds 1:20 limit). Required 156 faculty.', 'Professor cadre count is 8 against minimum required 17 as per Appendix 7.'], officialNoticeNumber: 'AICTE/SWRO/DEF/2026/0491' },
    responses: [],
  },
  {
    id: 'app-3', applicationNumber: 'APP-2026-NEW-9021', institutionId: 'inst-3', type: 'NEW_PROGRAMME', status: 'SCRUTINY_CLEARED', academicYear: '2026-27',
    submittedAt: '2026-10-12T14:10:00Z', lastUpdatedAt: '2026-10-21T18:00:00Z', currentVersion: 3, fdrNumber: 'PNB-FDR-88192-2026',
    programme: { level: 'PG', programme: 'M.Tech Cyber-Physical Systems', programmeIntake: 30 },
    intakeDetails: { currentTotalIntake: 480, proposedTotalIntake: 510, totalStudents: 1980, facultyCount: 112, professors: 16, associateProfessors: 32, assistantProfessors: 64, totalBuiltUpAreaSqM: 18200, fdrCorpusAmountLakhs: 125, requiredFdrAmountLakhs: 100 },
    documents: [],
    findings: [
      { id: 'find-301', ruleCode: 'RULE-CHECKLIST-01', ruleName: 'Mandatory Document Completeness', severity: 'PASSED', description: 'Complete verified documentation for New M.Tech Programme in Cyber-Physical Systems.', handbookClause: 'Clause 2.4.1', isDeterministic: true },
      { id: 'find-302', ruleCode: 'RULE-FDR-CORPUS-07', ruleName: 'Joint FDR Corpus Fund & Lien Status', severity: 'PASSED', description: 'Additional Security Deposit of ₹25 Lakhs created under joint lien with Member Secretary AICTE.', handbookClause: 'Clause 6.2', isDeterministic: true },
    ],
    scrutinyRecommendation: { status: 'RECOMMENDED_APPROVAL', reviewerName: 'Dr. Priya Nair', timestamp: '2026-10-21T18:00:00Z', rationale: 'All infrastructure, faculty (SFR 1:17.6), specialized laboratory equipment, and affiliating university NOC are completely verified. Recommended for final Bureau approval.', deficiencyPoints: [] },
    responses: [],
  },
  {
    id: 'app-4', applicationNumber: 'APP-2026-INFRA-3312', institutionId: 'inst-1', type: 'INFRASTRUCTURE_UPDATE', status: 'SUBMITTED', academicYear: '2026-27',
    submittedAt: '2026-10-22T06:30:00Z', lastUpdatedAt: '2026-10-22T06:30:00Z', currentVersion: 1, fdrNumber: 'SBI-FDR-99201-2024',
    programme: { changeCategory: 'Built-up Area Update', changeDetails: 'Addition of new academic block; total built-up area increased from 19,850 to 24,200 sq.m.' },
    intakeDetails: { currentTotalIntake: 600, proposedTotalIntake: 600, totalStudents: 2400, facultyCount: 124, professors: 14, associateProfessors: 28, assistantProfessors: 82, totalBuiltUpAreaSqM: 24200, fdrCorpusAmountLakhs: 100, requiredFdrAmountLakhs: 100 },
    documents: [], findings: [], responses: [],
  },
];

const FDRS = [
  { id: 'fdr-1', fdrNumber: 'SBI-FDR-99201-2024', institutionId: 'inst-1', applicationNumber: 'APP-2026-EOA-1082', amountLakhs: 100, bankName: 'State Bank of India', branchName: 'Institutional Area Branch, New Delhi', ifscCode: 'SBIN0001234', issueDate: '2024-04-01', maturityDate: '2034-03-31', tenureYears: 10, status: 'ACTIVE', jointLienHolder: 'Regional Officer, Northern Regional Office, AICTE', isLienConfirmed: true, lienEndorsementToken: 'CBS-SBI-LIEN-AUTH-99201', lienEndorsedAt: '2024-04-05T10:00:00Z', renewalStatus: 'NOT_APPLICABLE' },
  { id: 'fdr-d1', demo: true, fdrNumber: 'SBI-FDR-41207-2016', institutionId: 'inst-1', applicationNumber: 'APP-2016-NEW-4120', amountLakhs: 50, bankName: 'State Bank of India', branchName: 'Institutional Area Branch, New Delhi', ifscCode: 'SBIN0001234', issueDate: '2016-12-30', maturityDate: '2026-12-29', tenureYears: 10, status: 'EXPIRING_SOON', jointLienHolder: 'Regional Officer, Northern Regional Office, AICTE', isLienConfirmed: true, lienEndorsementToken: 'CBS-SBI-LIEN-AUTH-41207', lienEndorsedAt: '2017-01-04T10:00:00Z', renewalStatus: 'UNDERTAKING_PENDING' },
  { id: 'fdr-d2', demo: true, fdrNumber: 'PNB-FDR-30115-2016', institutionId: 'inst-1', applicationNumber: 'APP-2016-INTAKE-3011', amountLakhs: 25, bankName: 'Punjab National Bank', branchName: 'Model Town Branch, Delhi', ifscCode: 'PUNB0301100', issueDate: '2016-09-30', maturityDate: '2026-09-29', tenureYears: 10, status: 'MATURED', jointLienHolder: 'Regional Officer, Northern Regional Office, AICTE', isLienConfirmed: true, lienEndorsementToken: 'CBS-PNB-LIEN-AUTH-30115', lienEndorsedAt: '2016-10-03T11:00:00Z', renewalStatus: 'NOT_APPLICABLE' },
  { id: 'fdr-2', fdrNumber: 'SBI-FDR-44012-2025', institutionId: 'inst-2', applicationNumber: 'APP-2026-INTAKE-4491', amountLakhs: 150, bankName: 'State Bank of India', branchName: 'MG Road Corporate Branch, Bangalore', ifscCode: 'SBIN0008892', issueDate: '2025-05-10', maturityDate: '2035-05-09', tenureYears: 10, status: 'ACTIVE', jointLienHolder: 'Regional Officer, South-Western Regional Office, AICTE', isLienConfirmed: true, lienEndorsementToken: 'CBS-SBI-LIEN-AUTH-44012', lienEndorsedAt: '2025-05-12T11:30:00Z', renewalStatus: 'NOT_APPLICABLE' },
  { id: 'fdr-3', fdrNumber: 'PNB-FDR-88192-2026', institutionId: 'inst-3', applicationNumber: 'APP-2026-NEW-9021', amountLakhs: 125, bankName: 'Punjab National Bank', branchName: 'Shivajinagar Branch, Pune', ifscCode: 'PUNB0124400', issueDate: '2026-02-15', maturityDate: '2036-02-14', tenureYears: 10, status: 'ACTIVE', jointLienHolder: 'Regional Officer, Western Regional Office, AICTE', isLienConfirmed: true, lienEndorsementToken: 'CBS-PNB-LIEN-AUTH-88192', lienEndorsedAt: '2026-02-18T14:15:00Z', renewalStatus: 'NOT_APPLICABLE' },
];

const NOTIFS = [
  { id: 'n-11', institutionId: 'inst-1', title: 'Fire Safety NOC nearing expiry', message: 'Fire Safety Certificate DFS/HQ/2023/11029 expires on 03-Nov-2026 (RULE-EXPIRY-02). Submit renewal undertaking or DFS renewal token before final EoA release.', type: 'WARNING', timestamp: '2026-10-21T14:30:00Z', isRead: false, link: { route: 'appDetail', id: 'app-1' } },
  { id: 'n-12', institutionId: 'inst-1', title: 'Upcoming FDR Expiry Notice', message: 'FDR No. SBI-FDR-41207-2016 (₹50 Lakhs) matures on 29-Dec-2026. Renewal receipt must be submitted 60 days prior to maturity.', type: 'CRITICAL', timestamp: '2026-10-22T06:00:00Z', isRead: false, link: { route: 'fdrDetail', id: 'fdr-d1' } },
  { id: 'n-13', institutionId: 'inst-1', title: 'Application received', message: 'APP-2026-INFRA-3312 (Change in Institution Details) has been received and queued for Regional Scrutiny.', type: 'SUCCESS', timestamp: '2026-10-22T06:30:00Z', isRead: false, link: { route: 'appDetail', id: 'app-4' } },
  { id: 'n-14', institutionId: 'inst-1', title: 'FDR matured — eligible for lien release', message: 'PNB-FDR-30115-2016 completed its 10-year lock-in on 29-Sep-2026. You may apply for joint lien discharge (APH Clause 6.4).', type: 'INFO', timestamp: '2026-09-30T09:00:00Z', isRead: true, link: { route: 'fdrDetail', id: 'fdr-d2' } },
  { id: 'n-15', institutionId: 'inst-1', title: 'CBS Joint Lien Confirmed', message: 'State Bank of India endorsed the irrevocable joint lien on SBI-FDR-99201-2024. Token: CBS-SBI-LIEN-AUTH-99201.', type: 'SUCCESS', timestamp: '2024-04-05T10:00:00Z', isRead: true, link: { route: 'fdrDetail', id: 'fdr-1' } },
  { id: 'n-21', institutionId: 'inst-2', title: 'Scrutiny Deficiency Notice issued', message: 'Notice AICTE/SWRO/DEF/2026/0491 issued for APP-2026-INTAKE-4491 citing SFR 1:22.6 and deficit of 7 Professors. Respond within 7 working days.', type: 'CRITICAL', timestamp: '2026-10-20T11:15:00Z', isRead: false, link: { route: 'appDetail', id: 'app-2' } },
  { id: 'n-31', institutionId: 'inst-3', title: 'Scrutiny Committee Approval Recommendation', message: 'Application APP-2026-NEW-9021 cleared scrutiny and recommended for final EoA decree.', type: 'SUCCESS', timestamp: '2026-10-21T18:00:00Z', isRead: false, link: { route: 'appDetail', id: 'app-3' } },
];

const AUDIT = [
  { id: 'aud-0', institutionId: 'inst-1', correlationId: 'req-1b02c4d1-2024', timestamp: '2024-04-05T10:00:00Z', actorName: 'Shri Amitesh Kumar', actorRole: 'BANK_OFFICIAL', action: 'FDR_LIEN_ENDORSEMENT', targetType: 'FDR', targetId: 'SBI-FDR-99201-2024', details: 'Endorsed irrevocable joint lien for SBI-FDR-99201-2024 (₹ 1,00,00,000). Token: CBS-SBI-LIEN-AUTH-99201', ipAddress: '10.24.8.17', sha256Hash: '9c118a71e892c9001b92c402123f1128e0892c9012399a0ff3769c018f4c28bb' },
  { id: 'aud-1', institutionId: 'inst-1', correlationId: 'req-4c901a8f-2026', timestamp: '2026-10-18T10:20:00Z', actorName: 'Dr. Rajesh Sharma', actorRole: 'INSTITUTION', action: 'DOCUMENT_UPLOAD', targetType: 'DOCUMENT', targetId: 'doc-101', details: 'Uploaded Registered Sale Deed (18 pages, SHA-256: 8f4c28bb...). Extraction status: PROCESSED.', ipAddress: '14.139.60.22', sha256Hash: 'a71e892c9001b92c402123f1128e0892c9012399a0ff3769c018f4c28bb9c118' },
  { id: 'aud-2', institutionId: 'inst-1', correlationId: 'req-4c901a90-2026', timestamp: '2026-10-18T10:25:35Z', actorName: 'AICTE Rule Engine v2026.1', actorRole: 'SYSTEM', action: 'DETERMINISTIC_EVALUATION', targetType: 'APPLICATION', targetId: 'APP-2026-EOA-1082', details: 'Evaluated 7 core deterministic rules. Identified 1 warning: RULE-EXPIRY-02 on Fire NOC (DFS/HQ/2023/11029).', ipAddress: '127.0.0.1', sha256Hash: 'c402123f1128e0892c9012399a0ff3769c018f4c28bb9c118a71e892c9001b92' },
  { id: 'aud-2b', institutionId: 'inst-1', correlationId: 'req-4c901a95-2026', timestamp: '2026-10-22T06:30:00Z', actorName: 'Dr. Rajesh Sharma', actorRole: 'INSTITUTION', action: 'APPLICATION_SUBMITTED', targetType: 'APPLICATION', targetId: 'APP-2026-INFRA-3312', details: 'Submitted Change in Institution Details (Built-up Area Update) for AY 2026-27.', ipAddress: '14.139.60.22', sha256Hash: '0892c9012399a0ff3769c018f4c28bb9c118a71e892c9001b92c402123f1128e' },
  { id: 'aud-3', institutionId: 'inst-2', correlationId: 'req-5a110b22-2026', timestamp: '2026-10-20T11:15:00Z', actorName: 'Dr. Priya Nair', actorRole: 'REVIEWER', action: 'DEFICIENCY_NOTICE_ISSUED', targetType: 'APPLICATION', targetId: 'APP-2026-INTAKE-4491', details: 'Issued official Scrutiny Deficiency Notice AICTE/SWRO/DEF/2026/0491 citing SFR 1:22.6 and deficit of 7 Professors.', ipAddress: '117.218.44.10', sha256Hash: '128e0892c9012399a0ff3769c018f4c28bb9c118a71e892c9001b92c402123f1' },
  { id: 'aud-5', institutionId: 'inst-3', correlationId: 'req-7e991c44-2026', timestamp: '2026-10-21T18:00:00Z', actorName: 'Dr. Priya Nair', actorRole: 'REVIEWER', action: 'SCRUTINY_RECOMMENDATION_CLEARED', targetType: 'APPLICATION', targetId: 'APP-2026-NEW-9021', details: 'Application APP-2026-NEW-9021 recommended for Approval. Status updated to SCRUTINY_CLEARED.', ipAddress: '117.218.44.10', sha256Hash: 'ff3769c018f4c28bb9c118a71e892c9001b92c402123f1128e0892c9012399a0' },
];

// Issuing-authority cross-verification gateways (all simulated, as in the web prototype).
function seedAdapters(inst, fdr) {
  const delhi = inst.id === 'inst-1';
  return [
    { id: 'auth-1', name: 'State Directorate of Technical Education (DTE)', status: 'CONNECTED', latencyMs: 142, lastPingAt: '2026-10-22T08:45:10Z', referenceNumber: delhi ? 'DTE/NCR/2026/VALID-8812' : `DTE/${inst.state.slice(0, 3).toUpperCase()}/2026/VALID-${inst.pid.slice(-4)}`, verifiedAttributes: { 'State NOC Status': 'Valid for AY 2026-27', 'Govt Resolution No': 'ED-192-TEC-2025', 'Quota Approval': '100% Sanctioned' }, disclaimer: 'SIMULATED ADAPTER — Integration demonstrates API verification pattern without connecting to live state government portals.' },
    { id: 'auth-2', name: 'Affiliating University Examination & Affiliation Registry', status: 'VERIFIED', latencyMs: 185, lastPingAt: '2026-10-22T08:50:33Z', referenceNumber: 'UNIV/AFFIL/CON-2026-901', verifiedAttributes: { 'Affiliation Order': 'Autonomous Status Granted', 'Valid Up To': '2028-06-30', 'Sanctioned Courses': '14 Undergraduate, 6 Postgraduate' }, disclaimer: 'SIMULATED ADAPTER — Demonstrates automated academic affiliation cross-checks.' },
    { id: 'auth-3', name: 'State Fire & Emergency Services Bureau', status: delhi ? 'DISCREPANCY_FOUND' : 'VERIFIED', latencyMs: 220, lastPingAt: '2026-10-22T09:02:15Z', referenceNumber: delhi ? 'DFS/NOC/2025/11029' : `FIRE/NOC/2025/${inst.pid.slice(-5)}`, verifiedAttributes: delhi ? { 'Issued Date': '2023-11-04', 'Renewal Due': '2026-11-03', 'Hydrant Test Status': 'Pending Biannual Inspection' } : { 'Issued Date': '2025-01-10', 'Renewal Due': '2028-01-09', 'Hydrant Test Status': 'Completed' }, disclaimer: 'SIMULATED ADAPTER — Fire Safety Bureau NOC registry sandbox integration.' },
    { id: 'auth-4', name: 'National Board of Accreditation (NBA) Central Data Vault', status: 'VERIFIED', latencyMs: 160, lastPingAt: '2026-10-22T08:40:00Z', referenceNumber: 'NBA/TIER-1/2024/771', verifiedAttributes: { 'Accredited Programmes': 'Computer Engg, Mechanical, ECE', 'Validity Period': '2024 - 2027 (3 Years Tier-1)', 'Accreditation Score': '742 / 1000' }, disclaimer: 'SIMULATED ADAPTER — NBA Tier-1 accreditation record verification.' },
    { id: 'auth-5', name: 'Core Banking Solution (CBS) - AICTE Joint Lien', status: 'VERIFIED', latencyMs: 310, lastPingAt: '2026-10-22T09:10:00Z', referenceNumber: fdr ? fdr.lienEndorsementToken : '—', verifiedAttributes: fdr ? { 'Bank': fdr.bankName, 'FDR Amount': `₹ ${(fdr.amountLakhs * 1e5).toLocaleString('en-IN')}`, 'Maturity Date': fdr.maturityDate, 'Joint Lien': fdr.jointLienHolder } : {}, disclaimer: 'SIMULATED ADAPTER — Demonstrates digital API lien verification with scheduled commercial banks.' },
  ];
}
