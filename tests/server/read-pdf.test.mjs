// Rule-based PDF reading (no AI): text extraction, field parsing, and honest failure for scans and damaged files.
// Usage: npm run test:read-pdf
import { readWithoutAi, toIsoDate, toRupees } from '../../server/read-pdf.mjs';
import { makePdf, adviceLines } from './make-pdf.mjs';

let passed = 0, failed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('  ✓', m); } else { failed++; console.log('  ✗', m); } };
const declared = { institutionName: 'Delhi Institute of Technology & Science', pid: '1-10928371' };

console.log('Dates and amounts');
ok(toIsoDate('01/10/2026') === '2026-10-01' && toIsoDate('1-10-2026') === '2026-10-01' && toIsoDate('01.10.2026') === '2026-10-01', 'day-first dates (dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy)');
ok(toIsoDate('29 Dec 2036') === '2036-12-29' && toIsoDate('2036-12-29') === '2036-12-29' && toIsoDate('5 September, 2026') === '2026-09-05', 'named months and ISO dates');
ok(toIsoDate('31/02/2026') === '' && toIsoDate('no date') === '', 'impossible dates are not invented');
ok(toRupees('Rs. 1,00,00,000.00') === '10000000' && toRupees('₹ 25,00,000') === '2500000' && toRupees('INR 5000000') === '5000000', 'rupee amounts with Indian commas');
ok(toRupees('Rs 50 Lakhs') === '5000000' && toRupees('1.2 crore') === '12000000', 'amounts in lakh / crore');

console.log('\nDeposit advice');
const r = await readWithoutAi(makePdf([adviceLines()]), 'application/pdf', 'FDR_CORPUS', declared);
const x = r.extraction;
ok(x && x.method === 'rules' && x.matchesExpectedType, 'text PDF read with rules and recognised as a deposit advice');
ok(x.fdrNumber === 'SBI-FDR-66001-2026' && x.amountInr === '10000000' && x.issueDate === '2026-10-01' && x.maturityDate === '2036-10-01', `FDR number, amount and dates (${x.fdrNumber}, ${x.amountInr}, ${x.issueDate} → ${x.maturityDate})`);
ok(x.ifscCode === 'SBIN0001234' && x.branchName === 'Institutional Area Branch, New Delhi', `IFSC and branch (${x.ifscCode}, ${x.branchName})`);
ok(x.bankName === 'State Bank of India' && /AICTE/.test(x.lienHolder) && x.institutionNameInDocument === declared.institutionName, 'bank, lien holder and depositor');
const ev = x.keyFields.find(k => k.label === 'FDR number');
ok(ev && ev.page === 1 && /FDR No\.: SBI-FDR-66001-2026/.test(ev.sourceLine), 'each value keeps its page and source line');
const two = await readWithoutAi(makePdf([['STATE BANK OF INDIA', 'FIXED DEPOSIT ADVICE'], ['Maturity Date', '29 Dec 2036']]), 'application/pdf', 'FDR_CORPUS', declared);
ok(two.extraction.maturityDate === '2036-12-29' && two.extraction.keyFields.find(k => k.label === 'Maturity date').page === 2, 'value on the line after its label, on page 2');

console.log('\nWhat the rules do not guess');
const other = await readWithoutAi(makePdf([['Oracle Certified Professional', 'This certifies that Mrityunjai has completed the Java SE 17 Developer exam.', 'Certificate ID: OCP-2026-118822']]), 'application/pdf', 'FDR_CORPUS', declared);
ok(other.extraction && !other.extraction.matchesExpectedType && !other.extraction.amountInr && !other.extraction.maturityDate, 'a certificate is not taken for a deposit advice; no amount or dates invented');
const foreign = (await readWithoutAi(makePdf([adviceLines({ institution: 'Sunrise College of Pharmacy' })]), 'application/pdf', 'FDR_CORPUS', declared)).extraction;
ok(foreign.institutionNameInDocument === 'Sunrise College of Pharmacy', 'another depositor name is reported as written');
const scan = await readWithoutAi(makePdf([[]]), 'application/pdf', 'FDR_CORPUS', declared);
ok(!scan.extraction && scan.error === 'NO_TEXT', 'scanned PDF (no text layer): not read, says why');
ok((await readWithoutAi(Buffer.from('%PDF-1.4 broken'), 'application/pdf', 'FDR_CORPUS', declared)).error === 'UNREADABLE', 'damaged PDF: not read, says why');
ok((await readWithoutAi(Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg', 'FDR_CORPUS', declared)).error === 'NO_TEXT', 'photo: left for the AI reader or a person');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
