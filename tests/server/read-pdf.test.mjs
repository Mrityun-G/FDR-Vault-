// Reading without AI: PDF text with rules, OCR (Tesseract) for photos and scanned PDFs, and honest failure otherwise.
// Usage: npm run test:read-pdf
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { readWithoutAi, parseLines, toIsoDate, toRupees } from '../../server/read-pdf.mjs';
import { stopOcr } from '../../server/ocr.mjs';
import { makePdf, adviceLines } from './make-pdf.mjs';

let passed = 0, failed = 0;
// A plain white PNG (no text), built in memory.
function whitePng(w, h) {
  const crc = b => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
  const raw = Buffer.alloc((w + 1) * h, 255); for (let y = 0; y < h; y++) raw[y * (w + 1)] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
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

console.log('\nOCR (Tesseract, no AI): photos and scanned PDFs');
const fx = f => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', f));
for (const [f, mime] of [['fdr-advice-photo.jpg', 'image/jpeg'], ['fdr-advice-photo.png', 'image/png'], ['fdr-advice-scan.pdf', 'application/pdf']]) {
  const t0 = Date.now(), o = (await readWithoutAi(fx(f), mime, 'FDR_CORPUS', declared)).extraction;
  ok(o && o.method === 'ocr' && o.matchesExpectedType && o.fdrNumber === 'SBI-FDR-71234-2026' && o.amountInr === '10000000' && o.issueDate === '2026-10-01'
    && o.maturityDate === '2036-10-01' && o.bankName === 'State Bank of India' && /AICTE/.test(o.lienHolder) && o.institutionNameInDocument === declared.institutionName,
    `${f}: read by OCR (${o && Math.round(o.confidence * 100)}% confidence, ${Date.now() - t0} ms)`);
}
ok((await readWithoutAi(fx('fdr-advice-photo.png'), 'image/png', 'FDR_CORPUS', declared)).extraction.ifscCode === 'SBIN0001234', 'IFSC read from the photo');
ok(parseLines([{ page: 1, text: 'BANK CORPORATION LIMITED IFSC: SBINO001234' }], 'FDR_CORPUS').ifscCode === 'SBIN0001234'
  && parseLines([{ page: 1, text: 'BANK CORPORATION LIMITED' }], 'FDR_CORPUS').ifscCode === '', 'OCR letter O in an IFSC corrected only after an "IFSC" label');
const blank = await readWithoutAi(whitePng(400, 200), 'image/png', 'FDR_CORPUS', declared);
ok(!blank.extraction && blank.error === 'NO_TEXT' && /clearer/.test(blank.message), 'image without text: not read, asks for a clearer scan');
const broken = await readWithoutAi(Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg', 'FDR_CORPUS', declared);
ok(!broken.extraction && broken.error === 'UNREADABLE', 'damaged image: not read, says why (no crash)');
await stopOcr();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
