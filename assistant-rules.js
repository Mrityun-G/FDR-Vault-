/* AICTE Regulatory Assistant — deterministic rules shared by the API server (server/assistant.mjs, loaded with vm)
   and the institution app in demo mode. No network, no AI: the AI only reads documents and classifies free text;
   every compliance decision here is a plain rule the user can read.

   Regulatory honesty: a requirement is only as strong as its source. Sources marked VERIFIED were checked by an
   administrator against an official document; PORTAL_RULE means this portal enforces it but no AICTE clause is
   confirmed; UNVERIFIED / OUTDATED requirements are shown for human confirmation and never block a submission. */
(function (root) {
  'use strict';

  // ------------------------------------------------------------------ catalog defaults (the server reads its copy from the database)

  const SOURCES = [
    { id: 'SRC-PORTAL-2026-1', title: 'FDR Vault portal rules v2026.1', issuingAuthority: 'FDR Vault (this portal’s configured rules)',
      url: null, section: 'Portal configuration v2026.1 (submit_fdr, request_fdr_renewal, request_lien_release)', effectiveDate: '2026-10-22',
      status: 'PORTAL_RULE', excerpt: 'New FDRs need the deposit advice, a 10-year tenure and a valid IFSC; renewals need a later maturity date; a lien can be released only after maturity and bank endorsement.',
      notes: 'Enforced by this portal. The AICTE regulation behind each rule has not been verified by an administrator.' },
    { id: 'SRC-APH-2024-27', title: 'AICTE Approval Process Handbook 2024-25 to 2026-27', issuingAuthority: 'All India Council for Technical Education',
      url: 'https://www.aicte-india.org', section: null, effectiveDate: null, status: 'UNVERIFIED', excerpt: null,
      notes: 'The security-deposit provisions must be checked by an administrator against the published handbook. No clause is verified in this portal yet.' },
  ];

  const ROUTE_NOTE = 'Routing verified for this portal’s workflow. The AICTE office outside the portal has not been verified.';
  const WORKFLOWS = [
    { code: 'NEW_FDR', name: 'Submit a new security deposit / FDR', short: 'New FDR', integration: 'submit_fdr',
      destination: { role: 'Issuing bank’s official in FDR Vault, then AICTE officers', verified: 'PORTAL_WORKFLOW', note: ROUTE_NOTE,
        why: 'In this portal a new FDR goes to the official of the bank that issued it, who endorses the joint lien in the bank’s Core Banking System. AICTE scrutiny officers and administrators then see it in the staff portal.' } },
    { code: 'RENEW_FDR', name: 'Renew an existing FDR', short: 'Renewal', integration: 'request_fdr_renewal',
      destination: { role: 'AICTE administrator (FDR Vault Admin portal)', verified: 'PORTAL_WORKFLOW', note: ROUTE_NOTE,
        why: 'Renewal requests in this portal are decided by an administrator, who updates the maturity date once approved.' } },
    { code: 'REPLACE_FDR', name: 'Replace an expired or expiring FDR', short: 'Replacement', integration: 'request_fdr_renewal',
      destination: { role: 'AICTE administrator, then the new bank’s official', verified: 'PORTAL_WORKFLOW', note: ROUTE_NOTE,
        why: 'An administrator approves the replacement; the new FDR then needs a fresh joint-lien endorsement by its bank.' } },
    { code: 'RELEASE_FDR', name: 'Request release / refund of a security deposit', short: 'Lien release', integration: 'request_lien_release',
      destination: { role: 'AICTE administrator (FDR Vault Admin portal)', verified: 'PORTAL_WORKFLOW', note: ROUTE_NOTE,
        why: 'Release of the joint lien is decided by an administrator after the deposit has matured.' } },
    { code: 'CORRECT_FDR', name: 'Correct or update existing FDR details', short: 'Correction', integration: 'raise_ticket',
      destination: { role: 'FDR Vault helpdesk (AICTE staff)', verified: 'PORTAL_WORKFLOW', note: 'This portal has no direct correction service; the request is sent as a helpdesk ticket for AICTE staff to process by hand.',
        why: 'FDR details cannot be edited by the institution, so a correction is raised as a ticket with the bank’s letter.' } },
    { code: 'RESPOND_DEFICIENCY', name: 'Respond to an AICTE clarification or deficiency', short: 'Compliance reply', integration: 'submit_compliance_response',
      destination: { role: 'Scrutiny officer reviewing your application', verified: 'PORTAL_WORKFLOW', note: ROUTE_NOTE,
        why: 'A compliance reply goes back to the scrutiny officer who issued the deficiency notice on that application.' } },
    { code: 'OTHER', name: 'Other regulatory requirement', short: 'Other', integration: null,
      destination: { role: 'Not determined', verified: 'NEEDS_CONFIRMATION', note: 'The correct authority could not be established. Confirm it with AICTE before sending anything.',
        why: 'This request does not match a workflow the portal can submit.' } },
  ];

  const R = (workflow, docKey, docType, name, purpose, fields, applicability, sourceId, condition = null, conditionLabel = null) => ({
    workflow, docKey, docType, name, purpose, requiredFields: fields, formats: ['PDF', 'JPG', 'PNG'], applicability, condition, conditionLabel,
    sourceId, version: '2026.1', effectiveFrom: '2026-10-27', effectiveTo: null, active: true,
  });
  const FDR_FIELDS = ['FDR number', 'Bank and branch', 'Deposit amount', 'Issue date', 'Maturity date', 'Depositor (institution) name', 'Lien / joint holder (AICTE)'];
  const REQUIREMENTS = [
    R('NEW_FDR', 'FDR_ADVICE', 'FDR_CORPUS', 'FDR certificate / deposit advice', 'The portal records the deposit from this receipt, and the bank official checks it before endorsing the joint lien.', FDR_FIELDS, 'MANDATORY', 'SRC-PORTAL-2026-1'),
    R('NEW_FDR', 'BANK_LIEN_LETTER', 'BANK_LETTER', 'Bank letter confirming the lien', 'Shows that the bank has already marked the lien in favour of AICTE.', ['FDR number', 'Lien holder', 'Bank seal and signature'], 'CONDITIONAL', 'SRC-APH-2024-27', 'lienMarked=yes', 'if your bank has already issued a lien letter'),
    R('NEW_FDR', 'AUTHORITY_LETTER', 'OTHER', 'Authorisation of the signatory', 'Shows that the person submitting may act for the institution.', ['Name of the authorised person', 'Signature of the Head / management'], 'CONDITIONAL', 'SRC-APH-2024-27', 'signatory=delegated', 'if someone other than the Head of Institution submits'),
    R('RENEW_FDR', 'RENEWAL_ADVICE', 'FDR_CORPUS', 'Renewed FDR advice from the bank', 'Confirms the new maturity date of the same deposit.', ['FDR number', 'New maturity date', 'Deposit amount', 'Lien / joint holder (AICTE)'], 'MANDATORY', 'SRC-PORTAL-2026-1'),
    R('REPLACE_FDR', 'NEW_FDR_ADVICE', 'FDR_CORPUS', 'Deposit advice of the replacement FDR', 'The replacement deposit is recorded from this receipt.', FDR_FIELDS, 'MANDATORY', 'SRC-PORTAL-2026-1'),
    R('REPLACE_FDR', 'BANK_LIEN_LETTER', 'BANK_LETTER', 'New bank’s lien letter', 'Shows that the new bank has marked the lien in favour of AICTE.', ['FDR number', 'Lien holder', 'Bank seal and signature'], 'CONDITIONAL', 'SRC-APH-2024-27', 'lienMarked=yes', 'if the new bank has already issued a lien letter'),
    R('RELEASE_FDR', 'MATURED_FDR_ADVICE', 'FDR_CORPUS', 'Copy of the matured FDR advice', 'Identifies the deposit to be released and shows that it has matured.', ['FDR number', 'Maturity date', 'Deposit amount'], 'MANDATORY', 'SRC-PORTAL-2026-1'),
    R('RELEASE_FDR', 'NO_DUES_UNDERTAKING', 'AFFIDAVIT', 'Undertaking of no outstanding liabilities', 'States that no student, staff or regulatory dues are pending.', ['Statement of no dues', 'Signature of the Head of Institution'], 'CONDITIONAL', 'SRC-APH-2024-27', 'always', 'requirement not confirmed from an official source'),
    R('CORRECT_FDR', 'BANK_CORRECTION_LETTER', 'BANK_LETTER', 'Bank letter with the correct details', 'Evidence for the corrected value, issued by the bank.', ['FDR number', 'Corrected detail', 'Bank seal and signature'], 'MANDATORY', 'SRC-PORTAL-2026-1'),
  ];

  // ------------------------------------------------------------------ questions (one at a time; profile data is never asked)

  const BANK_NAMES = ['State Bank of India', 'Punjab National Bank', 'Canara Bank', 'HDFC Bank Ltd', 'Bank of Baroda', 'ICICI Bank Ltd', 'Axis Bank Ltd', 'Union Bank of India'];
  const BANK_PREFIX = { 'State Bank of India': 'SBIN', 'Punjab National Bank': 'PUNB', 'Canara Bank': 'CNRB', 'HDFC Bank Ltd': 'HDFC', 'Bank of Baroda': 'BARB', 'ICICI Bank Ltd': 'ICIC', 'Axis Bank Ltd': 'UTIB', 'Union Bank of India': 'UBIN' };
  const YES_NO = [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']];
  // kind: choice | text | fdr (pick one of the institution's FDRs) | app (pick an application). filter narrows the fdr/app list.
  const QUESTIONS = {
    NEW_FDR: [
      { key: 'purpose', ask: 'Which application is this deposit for?', kind: 'app', filter: 'open', optional: true, none: 'Not linked to an application (general security deposit)' },
      { key: 'bankName', ask: 'Which bank issued the FDR?', kind: 'choice', options: BANK_NAMES.map(b => [b, b]) },
      { key: 'lienMarked', ask: 'Has the bank already given you a letter marking the lien in favour of AICTE?', kind: 'choice', options: YES_NO },
      { key: 'signatory', ask: 'Who is submitting this deposit?', kind: 'choice', options: [['head', 'The Head of Institution (me)'], ['delegated', 'Someone authorised by the Head / management']] },
    ],
    RENEW_FDR: [
      { key: 'fdrId', ask: 'Which FDR do you want to renew?', kind: 'fdr', filter: 'renewable' },
      { key: 'renewalDone', ask: 'Has the bank already renewed the deposit and given you the renewed advice?', kind: 'choice', options: YES_NO },
    ],
    REPLACE_FDR: [
      { key: 'fdrId', ask: 'Which FDR are you replacing?', kind: 'fdr', filter: 'renewable' },
      { key: 'bankName', ask: 'Which bank issued the replacement FDR?', kind: 'choice', options: BANK_NAMES.map(b => [b, b]) },
      { key: 'lienMarked', ask: 'Has the new bank given you a letter marking the lien in favour of AICTE?', kind: 'choice', options: YES_NO },
    ],
    RELEASE_FDR: [
      { key: 'fdrId', ask: 'Which matured FDR should be released?', kind: 'fdr', filter: 'releasable' },
    ],
    CORRECT_FDR: [
      { key: 'fdrId', ask: 'Which FDR has wrong details?', kind: 'fdr', filter: 'any' },
      { key: 'field', ask: 'Which detail is wrong?', kind: 'choice', options: [['fdrNumber', 'FDR number'], ['amount', 'Amount'], ['issueDate', 'Issue date'], ['maturityDate', 'Maturity date'], ['bank', 'Bank / branch / IFSC'], ['other', 'Something else']] },
    ],
    RESPOND_DEFICIENCY: [
      { key: 'applicationId', ask: 'Which application’s deficiency notice are you answering?', kind: 'app', filter: 'deficient' },
    ],
    OTHER: [
      { key: 'details', ask: 'Please describe what you need in a sentence or two.', kind: 'text' },
    ],
  };

  // ------------------------------------------------------------------ free-text classification (fallback when AI is not available)

  const KEYWORDS = {
    NEW_FDR: ['new fdr', 'new deposit', 'fresh', 'submit fdr', 'submit a new', 'first fdr', 'create', 'add fdr', 'security deposit', 'deposit receipt'],
    RENEW_FDR: ['renew', 'renewal', 'extend', 'extension', 'expiring', 'about to mature', 'roll over', 'rollover'],
    REPLACE_FDR: ['replace', 'replacement', 'expired', 'change bank', 'another bank', 'different bank', 'switch bank', 'new bank'],
    RELEASE_FDR: ['release', 'refund', 'discharge', 'return my deposit', 'get back', 'withdraw deposit', 'matured', 'lien release'],
    CORRECT_FDR: ['correct', 'correction', 'wrong', 'mistake', 'incorrect', 'typo', 'update details', 'fix the', 'error in'],
    RESPOND_DEFICIENCY: ['deficiency', 'clarification', 'notice', 'respond', 'reply', 'compliance', 'query from aicte', 'shortfall'],
  };
  function classify(text) {
    const t = ' ' + String(text || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
    const scores = Object.entries(KEYWORDS).map(([code, words]) => [code, words.filter(w => t.includes(w)).length]).sort((a, b) => b[1] - a[1]);
    const [best, second] = scores;
    if (!best[1]) return { workflow: 'OTHER', confidence: 0.2, method: 'rules', reason: 'No known request type was recognised.' };
    const confidence = best[1] === second[1] ? 0.4 : Math.min(0.9, 0.55 + 0.15 * best[1]);
    return { workflow: best[0], confidence, method: 'rules', reason: `Matched words for “${workflowOf(best[0]).short}”.` };
  }

  // ------------------------------------------------------------------ helpers

  const workflowOf = code => WORKFLOWS.find(w => w.code === code) || WORKFLOWS[WORKFLOWS.length - 1];
  const digits = s => String(s || '').replace(/[^0-9]/g, '');
  const norm = s => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  function addYears(iso, n) { const [y, m, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y + n, m - 1, d)); t.setUTCDate(t.getUTCDate() - 1); return t.toISOString().slice(0, 10); }
  function nameSimilarity(a, b) {
    const A = new Set(norm(a).split(' ').filter(w => w.length > 2)), B = new Set(norm(b).split(' ').filter(w => w.length > 2));
    if (!A.size || !B.size) return 0;
    let hit = 0; A.forEach(w => { if (B.has(w)) hit++; });
    return hit / Math.max(A.size, B.size);
  }
  const fmtRs = n => '₹' + Number(n).toLocaleString('en-IN');

  function nextQuestion(workflow, answers) {
    return (QUESTIONS[workflow] || []).find(q => !(q.key in (answers || {}))) || null;
  }
  function questionsDone(workflow, answers) { return !!workflow && !nextQuestion(workflow, answers); }

  function conditionHolds(req, answers) {
    if (!req.condition || req.condition === 'always') return true;
    const [k, v] = req.condition.split('=');
    return String((answers || {})[k]) === v;
  }

  // Checklist for a workflow: requirements in force today whose condition applies, with their source.
  function checklist(ctx) {
    const { workflow, answers = {}, today, record = {} } = ctx;
    let catalog = ctx.catalog || { sources: SOURCES, requirements: REQUIREMENTS };
    const src = id => catalog.sources.find(s => s.id === id) || { id, title: 'Unknown source', status: 'UNVERIFIED' };
    let reqs = catalog.requirements.filter(r => r.workflow === workflow && r.active !== false
      && (!r.effectiveFrom || r.effectiveFrom <= today) && (!r.effectiveTo || r.effectiveTo >= today));
    // A deficiency notice is itself the source of what must be answered: one evidence slot per point.
    if (workflow === 'RESPOND_DEFICIENCY' && record.app) {
      const notice = { id: `NOTICE-${record.app.applicationNumber}`, title: `Deficiency notice ${record.app.noticeNumber || ''} on ${record.app.applicationNumber}`.replace('  ', ' '),
        issuingAuthority: 'AICTE scrutiny officer (recorded in this portal)', status: 'VERIFIED', section: null, url: null,
        effectiveDate: (record.app.noticeAt || '').slice(0, 10) || null, excerpt: (record.app.points || []).join(' | ') };
      catalog = { ...catalog, sources: [...catalog.sources, notice] };
      reqs = (record.app.points || []).map((p, k) => R('RESPOND_DEFICIENCY', `POINT_${k + 1}`, 'OTHER', `Evidence for point ${k + 1}`, p, ['Proof that the point is resolved'], 'CONDITIONAL', notice.id, null, 'if the point needs a document'));
    }
    return reqs.map(r => {
      const s = src(r.sourceId), applies = conditionHolds(r, answers);
      const verified = s.status === 'VERIFIED' || s.status === 'PORTAL_RULE';
      return { ...r, applies, source: s, needsHumanReview: !verified, blocking: applies && r.applicability === 'MANDATORY' && verified };
    });
  }

  // ------------------------------------------------------------------ document validation (GREEN / AMBER / RED)

  // doc: { docKey, fileName, mimeType, fileHash, extraction?, extractionError? }   ctx: workflow, answers, institution, record, today, form
  function validateDocument(req, doc, ctx) {
    const { workflow, answers = {}, institution = {}, record = {}, today, otherDocs = [], knownHashes = {} } = ctx;
    const issues = [], checks = [];
    const add = (level, message, fix) => issues.push({ level, message, fix });
    checks.push('File type and size');
    if (!/^(application\/pdf|image\/jpeg|image\/png)$/.test(doc.mimeType || '')) add('RED', 'This file type is not accepted.', 'Upload a PDF, JPG or PNG file.');
    checks.push('Duplicate file check');
    const twin = otherDocs.find(o => o.fileHash === doc.fileHash && o.docKey !== doc.docKey);
    if (twin) add('RED', `The same file is also uploaded as “${twin.name || twin.docKey}”.`, 'Upload the correct, separate document for each item.');
    else if (knownHashes[doc.fileHash]) add('AMBER', `This exact file was already submitted earlier (${knownHashes[doc.fileHash]}).`, 'Check that this is the current document, not an old one.');

    const x = doc.extraction;
    if (!x) {
      checks.push('Automatic reading');
      add('AMBER', doc.extractionError === 'AI_NOT_CONFIGURED'
        ? 'Automatic document reading is not available here, so the contents could not be checked.'
        : `The document could not be read automatically${doc.extractionMessage ? ` (${doc.extractionMessage})` : ''}.`,
      'Enter the values in the form yourself. The bank official or AICTE officer will check the document by hand.');
      return finish(issues, checks);
    }
    checks.push('Document type', 'Readability');
    if (x.matchesExpectedType === false) add('RED', `This looks like “${x.documentKind}”, not a ${req.name.toLowerCase()}.`, `Upload the ${req.name.toLowerCase()}.`);
    if (x.legibility === 'illegible') add('RED', 'The document is not readable.', 'Upload a clearer scan (at least 200 dpi, all pages, no glare).');
    else if (x.legibility === 'partially_legible') add('AMBER', 'Parts of the document are hard to read, so some values may be wrong.', 'Upload a clearer scan if you have one, and check the values in the form.');
    if (x.institutionNameInDocument && institution.name) {
      checks.push('Institution name');
      if (nameSimilarity(x.institutionNameInDocument, institution.name) < 0.6)
        add('RED', `The document names “${x.institutionNameInDocument}”, not your institution (${institution.name}).`, 'Upload the document issued in your institution’s name, or ask the bank to correct it.');
    }
    if (req.docType === 'FDR_CORPUS') validateFdrAdvice(x, add, checks, { workflow, answers, institution, record, today });
    if (req.docType === 'BANK_LETTER' && x.lienHolder && !/aicte|all india council/i.test(x.lienHolder) && workflow !== 'CORRECT_FDR')
      add('RED', `The lien is marked in favour of “${x.lienHolder}”, not AICTE.`, 'Ask the bank for a letter marking the lien in favour of the Regional Officer, AICTE.');
    for (const a of x.anomalies || []) add('AMBER', `Possible problem noticed in the document: ${a}`, 'Check the original. If it is correct, leave a note for the reviewer; otherwise upload a corrected copy.');
    checks.push('Cross-document consistency');
    for (const o of otherDocs) {
      const y = o.extraction;
      if (!y || o.docKey === doc.docKey) continue;
      if (x.fdrNumber && y.fdrNumber && digits(x.fdrNumber) !== digits(y.fdrNumber) && req.docType === 'FDR_CORPUS' && o.docType !== 'FDR_CORPUS' && workflow !== 'CORRECT_FDR')
        add('RED', `FDR number ${x.fdrNumber} here differs from ${y.fdrNumber} in “${o.name || o.docKey}”.`, 'Make sure both documents are about the same deposit.');
    }
    return finish(issues, checks);
  }

  function validateFdrAdvice(x, add, checks, { workflow, answers, institution, record, today }) {
    const fdr = record.fdr;
    checks.push('FDR number', 'Amount', 'Dates', 'Beneficiary / lien wording', 'Bank');
    if (!x.fdrNumber) add('AMBER', 'The FDR number could not be found in the document.', 'Upload a clearer copy, or type the FDR number in the form.');
    else if (fdr && ['RENEW_FDR', 'RELEASE_FDR'].includes(workflow) && digits(x.fdrNumber) !== digits(fdr.fdrNumber))
      add('RED', `The document is for FDR ${x.fdrNumber}, but you chose ${fdr.fdrNumber}.`, 'Upload the advice of the FDR you selected.');
    const amount = Number(digits(x.amountInr));
    if (!amount) add('AMBER', 'The deposit amount could not be found in the document.', 'Upload a clearer copy, or type the amount in the form.');
    else if (workflow === 'REPLACE_FDR' && fdr && amount < fdr.amount) add('RED', `The replacement amount ${fmtRs(amount)} is less than the current deposit of ${fmtRs(fdr.amount)}.`, 'The replacement must be for at least the current amount.');
    else if (workflow === 'NEW_FDR' && institution.requiredFdrLakhs && amount < institution.requiredFdrLakhs * 1e5)
      add('AMBER', `The amount ${fmtRs(amount)} is below your institution’s required corpus of ${fmtRs(institution.requiredFdrLakhs * 1e5)}.`, 'The portal accepts it, but an application linked to it will be flagged. Add another FDR or explain the shortfall.');
    if (isDate(x.issueDate) && x.issueDate > today) add('RED', `The issue date ${x.issueDate} is in the future.`, 'Check the date on the advice.');
    if (!isDate(x.maturityDate)) add('AMBER', 'The maturity date could not be found in the document.', 'Upload a clearer copy, or type the maturity date in the form.');
    else if (workflow === 'RELEASE_FDR') { if (x.maturityDate > today) add('RED', `The deposit matures on ${x.maturityDate}; it can be released only after it matures.`, 'Apply for release after the maturity date.'); }
    else {
      if (x.maturityDate <= today) add('RED', `The maturity date ${x.maturityDate} has already passed.`, 'Upload the advice of a current deposit.');
      if (['NEW_FDR', 'REPLACE_FDR'].includes(workflow) && isDate(x.issueDate) && x.maturityDate < addYears(x.issueDate, 10))
        add('RED', `The deposit runs from ${x.issueDate} to ${x.maturityDate}, which is shorter than 10 years.`, 'The portal requires a 10-year deposit. Ask the bank for a 10-year FDR.');
      if (workflow === 'RENEW_FDR' && fdr && x.maturityDate <= fdr.maturityDate)
        add('RED', `The new maturity date ${x.maturityDate} is not later than the current one (${fdr.maturityDate}).`, 'Upload the renewed advice showing the extended maturity date.');
    }
    if (!x.lienHolder) add('AMBER', 'The FDR number and amount were read, but the beneficiary / lien details could not be verified.', 'Upload a clearer copy, or add the bank’s lien letter.');
    else if (!/aicte|all india council/i.test(x.lienHolder)) add('RED', `The lien / joint holder is “${x.lienHolder}”, not AICTE.`, 'The deposit must be under joint lien with the Regional Officer, AICTE. Ask the bank to correct it.');
    const bank = answers.bankName || (record.fdr && workflow !== 'REPLACE_FDR' ? record.fdr.bankName : null);
    if (bank && x.bankName && nameSimilarity(x.bankName, bank) < 0.5) add('AMBER', `The document is from “${x.bankName}”, but you said ${bank}.`, 'Check the bank name and correct your answer or the document.');
  }

  function finish(issues, checks) {
    const status = issues.some(i => i.level === 'RED') ? 'RED' : issues.some(i => i.level === 'AMBER') ? 'AMBER' : 'GREEN';
    return { status, issues, checks,
      note: status === 'GREEN' ? 'Passed the checks that could be performed. This does not confirm that the document is genuine; the bank confirms the deposit in its Core Banking System.' : null };
  }

  // ------------------------------------------------------------------ form mapping

  // Each field: where its value may come from. ext = extraction key; rec = record key; prof = institution key; ans = answer key.
  const FORMS = {
    NEW_FDR: [
      { key: 'institution', label: 'Institution', prof: 'nameWithPid', readOnly: true },
      { key: 'fdrNumber', label: 'FDR number', ext: 'fdrNumber', required: true },
      { key: 'bankName', label: 'Bank', ans: 'bankName', ext: 'bankName', required: true, kind: 'bank' },
      { key: 'branchName', label: 'Branch', required: true },
      { key: 'ifscCode', label: 'IFSC code', required: true },
      { key: 'amountRs', label: 'Amount (₹)', ext: 'amountInr', required: true, kind: 'amount' },
      { key: 'issueDate', label: 'Issue date', ext: 'issueDate', required: true, kind: 'date' },
      { key: 'maturityDate', label: 'Maturity date', ext: 'maturityDate', required: true, kind: 'date' },
      { key: 'jointLienHolder', label: 'Joint lien holder', prof: 'lienHolder', readOnly: true },
      { key: 'applicationNumber', label: 'Linked application', ans: 'purposeNumber', readOnly: true },
    ],
    RENEW_FDR: [
      { key: 'fdrNumber', label: 'FDR number', rec: 'fdrNumber', readOnly: true },
      { key: 'currentMaturity', label: 'Current maturity date', rec: 'maturityDate', readOnly: true },
      { key: 'maturityDate', label: 'New maturity date', ext: 'maturityDate', required: true, kind: 'date' },
      { key: 'token', label: 'Bank renewal reference (optional)', ext: 'referenceNumber' },
    ],
    REPLACE_FDR: [
      { key: 'currentFdr', label: 'FDR being replaced', rec: 'fdrNumber', readOnly: true },
      { key: 'fdrNumber', label: 'New FDR number', ext: 'fdrNumber', required: true },
      { key: 'bankName', label: 'Bank', ans: 'bankName', ext: 'bankName', required: true, kind: 'bank' },
      { key: 'branchName', label: 'Branch', required: true },
      { key: 'ifscCode', label: 'IFSC code', required: true },
      { key: 'amountRs', label: 'Amount (₹)', ext: 'amountInr', required: true, kind: 'amount' },
      { key: 'maturityDate', label: 'Maturity date', ext: 'maturityDate', required: true, kind: 'date' },
    ],
    RELEASE_FDR: [
      { key: 'fdrNumber', label: 'FDR number', rec: 'fdrNumber', readOnly: true },
      { key: 'maturityDate', label: 'Matured on', rec: 'maturityDate', readOnly: true },
      { key: 'reason', label: 'Grounds for release', required: true, kind: 'textarea', min: 10 },
    ],
    CORRECT_FDR: [
      { key: 'fdrNumber', label: 'FDR number', rec: 'fdrNumber', readOnly: true },
      { key: 'field', label: 'Detail to correct', ans: 'fieldLabel', readOnly: true },
      { key: 'currentValue', label: 'Value on record', rec: 'fieldValue', readOnly: true },
      { key: 'correctValue', label: 'Correct value', required: true },
      { key: 'explanation', label: 'Explanation', required: true, kind: 'textarea', min: 10 },
    ],
    RESPOND_DEFICIENCY: [],   // one response field per deficiency point, added in formSchema()
    OTHER: [{ key: 'details', label: 'Your request', ans: 'details', required: true, kind: 'textarea' }],
  };
  function formSchema(workflow, record) {
    if (workflow === 'RESPOND_DEFICIENCY') return [{ key: 'applicationNumber', label: 'Application', rec: 'applicationNumber', readOnly: true },
      ...((record.app && record.app.points) || []).map((p, k) => ({ key: `r${k}`, label: `Response to point ${k + 1}`, hint: p, required: true, kind: 'textarea', min: 5 }))];
    return FORMS[workflow] || [];
  }

  // Builds every field with its value, source, confidence and status. userValues = the user's corrections.
  function buildForm(ctx) {
    const { workflow, answers = {}, institution = {}, record = {}, docs = [], userValues = {} } = ctx;
    const prof = { ...institution, nameWithPid: institution.name ? `${institution.name} (PID ${institution.pid})` : '', lienHolder: institution.region ? `Regional Officer, ${institution.region} Regional Office, AICTE` : '' };
    const rec = { ...(record.fdr || {}), ...(record.app || {}), fieldValue: record.fieldValue };
    const ans = { ...answers, purposeNumber: answers.purposeNumber || '', fieldLabel: answers.fieldLabel || answers.field };
    return formSchema(workflow, record).map(f => {
      const cands = [];
      if (f.ext) for (const d of docs) {
        const v = d.extraction && d.extraction[f.ext];
        if (!v || (d.docType !== 'FDR_CORPUS' && f.ext !== 'bankName')) continue;
        const key = (d.extraction.keyFields || []).find(k => digits(k.value) && digits(k.value) === digits(v) || norm(k.value) === norm(v));
        cands.push({ value: f.kind === 'amount' ? digits(v) : String(v), source: { kind: 'document', docKey: d.docKey, label: d.name || d.docKey, fileName: d.fileName, page: key ? key.page : null, line: key ? key.sourceLine : null }, confidence: d.extraction.confidence ?? null });
      }
      const base = f.rec && rec[f.rec] != null ? { value: String(rec[f.rec]), source: { kind: 'record', label: 'Portal record' }, confidence: 1 }
        : f.prof && prof[f.prof] ? { value: String(prof[f.prof]), source: { kind: 'profile', label: 'Your institution profile' }, confidence: 1 }
        : f.ans && ans[f.ans] ? { value: String(ans[f.ans]), source: { kind: 'answer', label: 'Your answer' }, confidence: 1 } : null;
      const distinct = [...new Set(cands.map(c => f.kind === 'amount' ? digits(c.value) : norm(c.value)))];
      const out = { ...f, value: '', source: null, confidence: null, status: 'MISSING', note: null, conflicts: [] };
      if (base && !cands.length) Object.assign(out, base, { status: base.source.kind === 'answer' ? 'USER' : 'VERIFIED' });
      else if (cands.length) {
        Object.assign(out, cands[0], { status: distinct.length > 1 ? 'CONFLICT' : 'EXTRACTED' });
        if (distinct.length > 1) { out.conflicts = cands; out.note = 'The documents give different values. Choose the correct one.'; }
        if (base && base.source.kind === 'answer' && norm(base.value) !== norm(cands[0].value) && f.kind !== 'amount')
          Object.assign(out, { status: 'CONFLICT', conflicts: [...cands, base], note: `Your answer (${base.value}) differs from the document (${cands[0].value}).` });
      }
      if (!f.readOnly && userValues[f.key] != null && String(userValues[f.key]).trim() !== '') {
        const v = String(userValues[f.key]).trim(), docVal = cands[0] && cands[0].value;
        const differs = docVal && (f.kind === 'amount' ? digits(v) !== digits(docVal) : norm(v) !== norm(docVal));
        Object.assign(out, { value: v, source: { kind: 'user', label: 'Entered by you' }, confidence: null, userCorrected: true,
          status: differs ? 'USER_DIFFERS' : 'USER', note: differs ? `You entered ${v}; the document shows ${docVal}. The reviewer will see both.` : null, conflicts: [] });
      }
      if (out.status !== 'MISSING') out.problem = fieldProblem(out, ctx);
      if (!out.value && f.required) out.status = 'MISSING';
      return out;
    });
  }

  // Format rules the portal itself applies when the request is submitted.
  function fieldProblem(f, ctx) {
    const v = String(f.value || '').trim();
    if (f.key === 'fdrNumber' && !f.readOnly && !/^[A-Z0-9][A-Z0-9/-]{5,}$/i.test(v)) return 'FDR number: letters, digits, - or /, at least 6 characters.';
    if (f.key === 'ifscCode') {
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.toUpperCase())) return 'IFSC must be 11 characters, e.g. SBIN0001234.';
      const bank = (ctx.userValues && ctx.userValues.bankName) || (ctx.answers && ctx.answers.bankName);
      if (bank && BANK_PREFIX[bank] && !v.toUpperCase().startsWith(BANK_PREFIX[bank])) return `IFSC of ${bank} starts with ${BANK_PREFIX[bank]}.`;
    }
    if (f.kind === 'amount' && !(Number(digits(v)) > 0)) return 'Enter the amount in rupees.';
    if (f.kind === 'date' && !isDate(v)) return 'Enter the date as YYYY-MM-DD.';
    if (f.min && v.length < f.min) return `Write at least ${f.min} characters.`;
    return null;
  }

  // ------------------------------------------------------------------ overall evaluation, gates and state

  function evaluate(ctx) {
    const items = checklist(ctx);
    const docs = (ctx.docs || []).map(d => ({ ...d, name: (items.find(i => i.docKey === d.docKey) || {}).name, docType: (items.find(i => i.docKey === d.docKey) || {}).docType }));
    const results = {};
    for (const d of docs) {
      const req = items.find(i => i.docKey === d.docKey);
      if (req) results[d.docKey] = validateDocument(req, d, { ...ctx, otherDocs: docs });
    }
    const form = buildForm({ ...ctx, docs });
    const checklistOut = items.map(i => {
      const d = docs.find(x => x.docKey === i.docKey), v = results[i.docKey];
      return { ...i, uploaded: !!d, file: d ? { fileName: d.fileName, fileHash: d.fileHash, storagePath: d.storagePath } : null, validation: v || null };
    });
    const blockers = [], warnings = [];
    for (const i of checklistOut) {
      if (!i.applies) continue;
      if (i.blocking && !i.uploaded) blockers.push(`Missing: ${i.name}.`);
      if (i.validation && i.validation.status === 'RED') blockers.push(`${i.name}: ${i.validation.issues.filter(x => x.level === 'RED').map(x => x.message).join(' ')}`);
      if (i.validation && i.validation.status === 'AMBER') warnings.push(`${i.name} needs manual review.`);
      if (i.needsHumanReview) warnings.push(`“${i.name}” is not confirmed by an official source; ask AICTE whether it is needed.`);
    }
    for (const f of form) {
      if (f.status === 'MISSING' && f.required) blockers.push(`Form: ${f.label} is missing.`);
      else if (f.status === 'CONFLICT') blockers.push(`Form: ${f.label} — ${f.note}`);
      else if (f.problem) blockers.push(`Form: ${f.problem}`);
      else if (f.status === 'USER_DIFFERS') warnings.push(`Form: ${f.label} differs from the document.`);
    }
    const required = checklistOut.filter(i => i.applies && i.blocking);
    const satisfied = required.filter(i => i.validation && i.validation.status === 'GREEN').length;
    const pendingManual = required.filter(i => i.validation && i.validation.status === 'AMBER').length;
    return { checklist: checklistOut, form, blockers: [...new Set(blockers)], warnings: [...new Set(warnings)], counts: { required: required.length, satisfied, pendingManual } };
  }

  // Application state. Stored flags (reviewOpened, packaged, submission) move it forward only when that action happened.
  function state(s, ev) {
    if (s.submission) return s.submission.derived || 'SUBMITTED';
    if (!s.workflow) return 'DRAFT';
    if (!questionsDone(s.workflow, s.answers)) return 'QUESTIONS_IN_PROGRESS';
    const applicable = ev.checklist.filter(i => i.applies);
    if (applicable.some(i => i.blocking && !i.uploaded)) return 'DOCUMENTS_REQUIRED';
    if (applicable.some(i => i.validation && i.validation.status === 'RED') || ev.form.some(f => f.status === 'CONFLICT' || f.problem)) return 'NEEDS_CORRECTION';
    if (ev.form.some(f => f.required && f.status === 'MISSING')) return 'FORM_GENERATED';   // generated; waiting for the user's input
    if (s.packaged) return 'READY_FOR_SUBMISSION';
    if (s.reviewOpened) return 'AWAITING_USER_CONFIRMATION';
    if (ev.warnings.some(w => /manual review/.test(w))) return 'MANUAL_REVIEW';
    return 'FORM_GENERATED';
  }
  const STATE_LABELS = {
    DRAFT: 'Draft', QUESTIONS_IN_PROGRESS: 'Questions in progress', DOCUMENTS_REQUIRED: 'Documents required', DOCUMENTS_UPLOADED: 'Documents uploaded',
    VALIDATION_IN_PROGRESS: 'Validation in progress', NEEDS_CORRECTION: 'Needs correction', MANUAL_REVIEW: 'Manual review needed', FORM_GENERATED: 'Form generated',
    AWAITING_USER_CONFIRMATION: 'Awaiting your confirmation', READY_FOR_SUBMISSION: 'Ready for submission', SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under review',
    APPROVED: 'Approved', REJECTED: 'Rejected', CLARIFICATION_REQUIRED: 'Clarification required',
  };

  // The payload for the portal's existing submission function. Values come only from the evaluated form.
  function submissionPayload(workflow, form, record, evidence) {
    const v = Object.fromEntries(form.map(f => [f.key, f.value]));
    if (workflow === 'NEW_FDR') return { fn: 'submit_fdr', args: { p: { fdrNumber: v.fdrNumber.toUpperCase(), bankName: v.bankName, branchName: v.branchName, ifscCode: v.ifscCode.toUpperCase(),
      amount: Number(digits(v.amountRs)), amountRs: digits(v.amountRs), issueDate: v.issueDate, maturityDate: v.maturityDate, applicationNumber: v.applicationNumber || '', evidence } } };
    if (workflow === 'RENEW_FDR') return { fn: 'request_fdr_renewal', args: { p_fdr_id: record.fdr.id, p: { mode: 'extension', maturityDate: v.maturityDate, token: v.token || '' } } };
    if (workflow === 'REPLACE_FDR') return { fn: 'request_fdr_renewal', args: { p_fdr_id: record.fdr.id, p: { mode: 'replacement', fdrNumber: v.fdrNumber.toUpperCase(), bankName: v.bankName,
      branchName: v.branchName, ifscCode: v.ifscCode.toUpperCase(), amount: Number(digits(v.amountRs)), maturityDate: v.maturityDate, token: '' } } };
    if (workflow === 'RELEASE_FDR') return { fn: 'request_lien_release', args: { p_fdr_id: record.fdr.id, p_reason: v.reason, p_certified: true } };
    if (workflow === 'CORRECT_FDR') return { fn: 'raise_ticket', args: { p_category: 'FDR / Security Deposit', p_ref: v.fdrNumber,
      p_subject: `Correction of ${String(v.field).toLowerCase()} on ${v.fdrNumber}`.slice(0, 120),
      p_description: `Detail: ${v.field}\nOn record: ${v.currentValue || '-'}\nCorrect value: ${v.correctValue}\n\n${v.explanation}\n\nBank letter uploaded through the Regulatory Assistant: ${evidence ? `${evidence.fileName} (SHA-256 ${evidence.fileHash.slice(0, 12)}...)` : 'none'}.` } };
    if (workflow === 'RESPOND_DEFICIENCY') return { fn: 'submit_compliance_response', args: { p_application_id: record.app.id,
      p_responses: (record.app.points || []).map((p, k) => ({ point: p, response: v[`r${k}`] })), p_files: evidence || [] } };
    return null;
  }

  const api = { SOURCES, WORKFLOWS, REQUIREMENTS, QUESTIONS, BANK_NAMES, BANK_PREFIX, STATE_LABELS, classify, workflowOf, nextQuestion, questionsDone,
    checklist, validateDocument, buildForm, formSchema, evaluate, state, submissionPayload, addYears };
  root.AssistantRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
