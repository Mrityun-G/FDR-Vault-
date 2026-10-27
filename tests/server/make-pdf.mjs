// TEST ONLY: builds a small, valid text PDF (Helvetica) from pages of lines, for the PDF reading tests.
export function makePdf(pages) {
  const objs = [];
  const add = s => { objs.push(s); return objs.length; };
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const pagesId = objs.length + 1 + pages.length * 2;
  const kids = [];
  for (const lines of pages) {
    const esc = s => s.replace(/[\\()]/g, c => '\\' + c);
    const stream = `BT /F1 11 Tf 14 TL 50 790 Td ${lines.map(l => `(${esc(l)}) Tj T*`).join(' ')} ET`;
    const content = add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  add(`<< /Type /Pages /Kids [${kids.map(k => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`);
  const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let out = '%PDF-1.4\n';
  const offsets = objs.map((o, i) => { const at = Buffer.byteLength(out, 'latin1'); out += `${i + 1} 0 obj\n${o}\nendobj\n`; return at; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

// A typical bank deposit advice for an institution, used across the tests.
export const adviceLines = ({ institution = 'Delhi Institute of Technology & Science', fdr = 'SBI-FDR-66001-2026', amount = 'Rs. 1,00,00,000.00',
  issue = '01/10/2026', maturity = '01/10/2036', lien = 'Regional Officer, Northern Regional Office, AICTE' } = {}) => [
  'STATE BANK OF INDIA', 'Institutional Area Branch, New Delhi  IFSC: SBIN0001234', 'FIXED DEPOSIT ADVICE',
  `Name of the Depositor: ${institution}`, `FDR No.: ${fdr}`, `Principal Amount: ${amount}`, `Date of Deposit: ${issue}`, `Maturity Date: ${maturity}`,
  'Period: 120 months', `Lien marked in favour of: ${lien}`, 'This advice is computer generated.',
];
