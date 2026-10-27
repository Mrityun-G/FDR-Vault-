// Free document reading without AI: the text layer of a PDF (pdf.js) parsed with fixed rules.
// Returns the same fields as the Claude reader (supabase/functions/analyze-document/extract.ts), so the same
// cross-checks and validation apply. Only what is written in the document is returned; anything not found is "".
// Scanned PDFs (no text layer) and images return null: they need the AI reader or a person.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { OCR_ENABLED, ocrPages, pdfPageJpegs } from './ocr.mjs';

export const RULES_MODEL = 'rules (PDF text)';
export const readerName = x => (x && x.method === 'ocr' ? 'OCR (Tesseract)' : RULES_MODEL);

/** Text lines per page: [{ page, text }]. null when the PDF cannot be opened (damaged or password-protected). */
export async function pdfLines(buffer, maxPages = 20) {
  let doc;
  try {
    doc = await getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 }).promise;
  } catch { return null; }
  const out = [];
  try {
    for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
      const { items } = await (await doc.getPage(p)).getTextContent();
      // Group text pieces into lines by their vertical position, then order each line left to right.
      const rows = [];
      for (const it of items) {
        if (!it.str || !it.str.trim()) continue;
        const y = it.transform[5], x = it.transform[4];
        let row = rows.find(r => Math.abs(r.y - y) < 3);
        if (!row) rows.push(row = { y, parts: [] });
        row.parts.push({ x, s: it.str });
      }
      rows.sort((a, b) => b.y - a.y);
      for (const r of rows) out.push({ page: p, text: r.parts.sort((a, b) => a.x - b.x).map(x => x.s).join(' ').replace(/\s+/g, ' ').trim() });
    }
  } finally { await doc.destroy(); }
  return out;
}

const BANKS = [['State Bank of India', /state bank of india|\bsbi\b/i], ['Punjab National Bank', /punjab national bank|\bpnb\b/i], ['Canara Bank', /canara bank/i],
  ['HDFC Bank Ltd', /hdfc bank/i], ['Bank of Baroda', /bank of baroda/i], ['ICICI Bank Ltd', /icici bank/i], ['Axis Bank Ltd', /axis bank/i],
  ['Union Bank of India', /union bank of india/i], ['UCO Bank', /\buco bank/i], ['Indian Bank', /\bindian bank\b/i], ['Bank of India', /\bbank of india\b/i]];
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const DATE = /(\d{4})-(\d{2})-(\d{2})|(\d{1,2})[./-](\d{1,2})[./-](\d{4})|(\d{1,2})[\s-]+([A-Za-z]{3,9})[,\s-]+(\d{4})/;

// Indian dates are day first (dd/mm/yyyy). Returns YYYY-MM-DD, or "" if not a real date.
export function toIsoDate(s) {
  const m = DATE.exec(String(s || ''));
  if (!m) return '';
  let y, mo, d;
  if (m[1]) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if (m[4]) [d, mo, y] = [+m[4], +m[5], +m[6]];
  else { d = +m[7]; mo = MONTHS[m[8].slice(0, 3).toLowerCase()]; y = +m[9]; }
  const t = new Date(Date.UTC(y, (mo || 0) - 1, d));
  return mo && t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d ? t.toISOString().slice(0, 10) : '';
}

// Rupee amount written in digits (with Indian commas), or as "N lakh" / "N crore".
export function toRupees(s) {
  const t = String(s || '').replace(/,/g, '');
  const w = /(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?)\b/i.exec(t);
  if (w) return String(Math.round(Number(w[1]) * (/cr/i.test(w[2]) ? 1e7 : 1e5)));
  const n = /(?:rs\.?|inr|₹)?\s*(\d{4,12})(?:\.\d{1,2})?/i.exec(t);
  return n ? n[1] : '';
}

const norm = s => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Reads deposit-advice fields from text lines. Each value is taken from the line that carries its label
 * (or the next line), and that line is kept as evidence. docType decides whether the text looks like the expected kind.
 */
export function parseLines(lines, docType, declared = {}) {
  const all = lines.map(l => l.text).join('\n');
  const keyFields = [];
  // First line whose label matches; the value is after the label on that line, or on the next line.
  const find = (label, pick, name) => {
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i], m = label.exec(L.text);
      if (!m) continue;
      const rest = L.text.slice(m.index + m[0].length).replace(/^[\s:.\-–]+/, '');
      const v = pick(rest) || (i + 1 < lines.length && lines[i + 1].page === L.page ? pick(lines[i + 1].text) : '');
      if (v) { keyFields.push({ label: name, value: v, page: L.page, sourceLine: rest && pick(rest) ? L.text : `${L.text} ${lines[i + 1].text}` }); return v; }
    }
    return '';
  };
  const word = rest => { const m = /([A-Z0-9][A-Z0-9/-]{5,})/i.exec(rest); return m && /\d/.test(m[1]) ? m[1].toUpperCase() : ''; };
  const fdrNumber = find(/\b(fdr|tdr|fd|term deposit|deposit|receipt|account)\s*(no\.?|number|#)/i, word, 'FDR number');
  const amountInr = find(/\b(principal|deposit amount|amount of deposit|amount|sum of)\b/i, toRupees, 'Deposit amount');
  const issueDate = find(/\b(date of (issue|deposit)|issue date|deposit date|value date|date of opening|dated?)\b/i, toIsoDate, 'Issue date');
  const maturityDate = find(/\b(maturity date|date of maturity|due date|matures? on|maturing on)\b/i, toIsoDate, 'Maturity date');
  const lienHolder = find(/\b(lien\s*(marked\s*)?(in favou?r of|holder)?|jointly with|joint(ly)? (holder|name)|in favou?r of)\b/i, rest => rest.length > 5 ? rest.slice(0, 160) : '', 'Lien / joint holder');
  const referenceNumber = find(/\b(cbs\s*(ref(erence)?|token)|ref(erence)?\s*no\.?|transaction\s*ref)\b/i, word, 'Reference number');
  // IFSC (bank code + 0 + branch code) and the branch named on the same line, e.g. "Institutional Area Branch, New Delhi  IFSC: SBIN0001234".
  let ifscCode = '', branchName = '';
  // After an "IFSC" label, OCR's letter O for the fifth character (always the digit 0) is corrected; elsewhere only an exact code counts.
  const ifscOf = text => { const m = /\b([A-Z]{4}0[A-Z0-9]{6})\b/.exec(text) || (/IFSC/i.test(text) && /IFSC\W*([A-Z]{4})[0O]([A-Z0-9]{6})\b/i.exec(text)); return m ? (m[2] ? `${m[1]}0${m[2]}` : m[1]).toUpperCase() : ''; };
  const ifscLine = lines.find(l => ifscOf(l.text));
  if (ifscLine) {
    ifscCode = ifscOf(ifscLine.text);
    keyFields.push({ label: 'IFSC', value: ifscCode, page: ifscLine.page, sourceLine: ifscLine.text });
  }
  const br = lines.map(l => ({ l, m: /([A-Z][A-Za-z.&() -]*\bBranch\b(?:,\s*[A-Z][A-Za-z .]+?)?)(?=\s{2,}|\s+IFSC|$)/.exec(l.text) })).find(x => x.m);
  if (br) { branchName = br.m[1].trim(); keyFields.push({ label: 'Branch', value: branchName, page: br.l.page, sourceLine: br.l.text }); }
  const bank = BANKS.find(([, re]) => re.test(all));
  const bankName = bank ? bank[0] : '';
  if (bankName) { const l = lines.find(x => bank[1].test(x.text)); keyFields.push({ label: 'Bank', value: bankName, page: l.page, sourceLine: l.text }); }
  let institutionNameInDocument = '';
  if (declared.institutionName) {
    const want = norm(declared.institutionName).split(' ').filter(w => w.length > 2);
    const l = lines.find(x => { const have = new Set(norm(x.text).split(' ')); return want.length && want.filter(w => have.has(w)).length / want.length >= 0.6; });
    if (l) { institutionNameInDocument = declared.institutionName; keyFields.push({ label: 'Depositor', value: declared.institutionName, page: l.page, sourceLine: l.text }); }
  }
  if (!institutionNameInDocument) institutionNameInDocument = find(/\b(name of (the )?depositor|depositor('s)? name|depositor|account holder|in the name of|name)\b\s*[:\-]/i,
    rest => rest.length > 4 && !/\d{4,}/.test(rest) ? rest.slice(0, 120) : '', 'Depositor');

  const kinds = { FDR_CORPUS: /fixed deposit|term deposit|\bfdr\b|\btdr\b|deposit (advice|receipt)/i, BANK_LETTER: /\blien\b|bank/i, AFFIDAVIT: /affidavit|undertaking|declare/i };
  const matchesExpectedType = !kinds[docType] || kinds[docType].test(all);
  return {
    documentKind: matchesExpectedType ? (docType === 'FDR_CORPUS' ? 'Fixed deposit advice' : docType === 'BANK_LETTER' ? 'Bank letter' : docType === 'AFFIDAVIT' ? 'Affidavit / undertaking' : 'Document')
      : (lines.find(l => l.text.length > 8) || { text: 'Unrecognised document' }).text.slice(0, 80),
    matchesExpectedType, legibility: 'clear', institutionNameInDocument, issuingAuthority: bankName, referenceNumber, issueDate, validTill: '', amountInr,
    fdrNumber, bankName, lienHolder, maturityDate, ifscCode, branchName, facultyProfessors: '', facultyAssociate: '', facultyAssistant: '', keyFields: keyFields.slice(0, 10), anomalies: [],
    summary: `Read from the PDF's text with fixed rules (no AI): ${keyFields.length} field(s) found.`, confidence: 0.7, method: 'rules',
  };
}

// OCR text is less certain: below 70% confidence the document counts as partly legible (AMBER), never silently GREEN.
async function readByOcr(images, docType, declared) {
  let r;
  try { r = await ocrPages(images); }
  catch { return { error: 'UNREADABLE', message: 'the image could not be read; it may be damaged. Upload it again or take a new photo' }; }
  if (!r) return { error: 'NO_TEXT', message: 'no readable text was recognised; upload a clearer, straight, well-lit scan' };
  const x = parseLines(r.lines, docType, declared);
  return { extraction: { ...x, method: 'ocr', confidence: Math.round(r.confidence) / 100, legibility: r.confidence < 70 ? 'partially_legible' : 'clear',
    summary: `Read from the image with OCR (Tesseract, no AI), ${Math.round(r.confidence)}% confidence: ${x.keyFields.length} field(s) found.` } };
}

/** Reads a stored document without AI. Returns { extraction } or { error, message } explaining why it could not be read. */
export async function readWithoutAi(buffer, mimeType, docType, declared) {
  if (mimeType === 'image/jpeg' || mimeType === 'image/png') {
    if (!OCR_ENABLED) return { error: 'NO_TEXT', message: 'photos and scans need the AI reader' };
    return readByOcr([buffer], docType, declared);
  }
  if (mimeType !== 'application/pdf') return { error: 'UNREADABLE', message: 'unsupported file type' };
  const lines = await pdfLines(buffer);
  if (!lines) return { error: 'UNREADABLE', message: 'the PDF could not be opened; it may be damaged or password-protected' };
  if (lines.map(l => l.text).join('').replace(/\s/g, '').length >= 40) return { extraction: parseLines(lines, docType, declared) };
  // A scan: read its page images with OCR.
  const pages = OCR_ENABLED ? pdfPageJpegs(buffer) : [];
  if (!pages.length) return { error: 'NO_TEXT', message: 'this PDF is a scan whose pages could not be extracted for OCR; scans like this need the AI reader' };
  return readByOcr(pages, docType, declared);
}
