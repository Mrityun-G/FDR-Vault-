// Free OCR (Tesseract, no AI key) for photos and scanned PDFs. The recognised lines go through the same
// rule-based parser as text PDFs (read-pdf.mjs). One worker, one document at a time, to stay small on a free server.
// Set OCR_ENABLED=false to switch it off.
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { createWorker } from 'tesseract.js';

const require = createRequire(import.meta.url);
// English language data shipped with @tesseract.js-data/eng: nothing is downloaded at run time.
const LANG_PATH = path.join(path.dirname(require.resolve('@tesseract.js-data/eng/package.json')), '4.0.0_best_int');
export const OCR_ENABLED = process.env.OCR_ENABLED !== 'false';
const PAGE_TIMEOUT_MS = 60_000, MAX_PAGES = 3;

let worker = null, idleTimer = null, queue = Promise.resolve();
async function getWorker() {
  clearTimeout(idleTimer);
  if (!worker) worker = await createWorker('eng', 1, { langPath: LANG_PATH, cachePath: os.tmpdir(), gzip: true, logger: () => {}, errorHandler: () => {} });
  // Free the memory after 5 idle minutes.
  idleTimer = setTimeout(() => { const w = worker; worker = null; w && w.terminate().catch(() => {}); }, 300_000);
  idleTimer.unref();
  return worker;
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('OCR timed out')), ms).unref())]);

/** Recognises one image (JPEG / PNG bytes): { lines: [{ text, confidence }], confidence } (0..100). Serialised. */
export function recognise(image) {
  const job = queue.then(async () => {
    const w = await getWorker();
    const { data } = await withTimeout(w.recognize(image), PAGE_TIMEOUT_MS);
    const lines = (data.lines || []).map(l => ({ text: l.text.replace(/\s+/g, ' ').trim(), confidence: l.confidence })).filter(l => l.text);
    return { lines, confidence: data.confidence || 0 };
  });
  queue = job.catch(() => {});
  return job;
}

/**
 * Page images of a scanned PDF. Scanners store each page as a JPEG (DCTDecode) image; those are taken out as-is.
 * Other encodings return nothing, and the document is left for the AI reader or a person.
 */
export function pdfPageJpegs(buffer, max = MAX_PAGES) {
  const src = buffer.toString('latin1'), out = [];
  const re = /\/Subtype\s*\/Image[\s\S]{0,600}?\/Filter\s*\[?\s*\/DCTDecode[\s\S]{0,400}?stream\r?\n/g;
  let m;
  while ((m = re.exec(src)) && out.length < max) {
    const start = m.index + m[0].length, end = src.indexOf('endstream', start);
    if (end < 0) break;
    const jpg = buffer.subarray(start, end);
    if (jpg[0] === 0xff && jpg[1] === 0xd8 && jpg.length > 1000) out.push(Buffer.from(jpg));
    re.lastIndex = end;
  }
  return out;
}

/** Lines with page numbers from images (one per page), plus the mean confidence. null if no text was found. */
export async function ocrPages(images) {
  const lines = [];
  let sum = 0, n = 0;
  for (let i = 0; i < Math.min(images.length, MAX_PAGES); i++) {
    const r = await recognise(images[i]);
    for (const l of r.lines) lines.push({ page: i + 1, text: l.text });
    sum += r.confidence; n++;
  }
  if (lines.map(l => l.text).join('').replace(/\s/g, '').length < 40) return null;
  return { lines, confidence: n ? sum / n : 0 };
}

export const stopOcr = async () => { clearTimeout(idleTimer); const w = worker; worker = null; if (w) await w.terminate().catch(() => {}); };
