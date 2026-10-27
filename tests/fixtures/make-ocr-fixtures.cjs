// TEST ONLY: renders a bank deposit advice as a photo (JPEG / PNG) and a scanned PDF (the JPEG as its page image),
// for the OCR tests. Uses the installed Edge. Run: node tests/fixtures/make-ocr-fixtures.cjs
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const DIR = __dirname;
const HTML = `<html><body style="margin:0;background:#fff;font:22px Arial,sans-serif;color:#111">
<div style="width:900px;padding:50px 60px">
<div style="font-size:30px;font-weight:bold">STATE BANK OF INDIA</div>
<div>Institutional Area Branch, New Delhi &nbsp;&nbsp; IFSC: SBIN0001234</div>
<div style="font-size:26px;font-weight:bold;margin:24px 0 18px">FIXED DEPOSIT ADVICE</div>
<div>Name of the Depositor: Delhi Institute of Technology &amp; Science</div>
<div>FDR No.: SBI-FDR-71234-2026</div>
<div>Principal Amount: Rs. 1,00,00,000.00</div>
<div>Date of Deposit: 01/10/2026</div>
<div>Maturity Date: 01/10/2036</div>
<div>Period: 120 months</div>
<div>Lien marked in favour of: Regional Officer, Northern Regional Office, AICTE</div>
<div style="margin-top:28px;font-size:18px">This advice is computer generated.</div></div></body></html>`;

(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new' });
  const p = await b.newPage(); await p.setViewport({ width: 1020, height: 640 });
  await p.setContent(HTML);
  await p.screenshot({ path: path.join(DIR, 'fdr-advice-photo.png') });
  await p.screenshot({ path: path.join(DIR, 'fdr-advice-photo.jpg'), type: 'jpeg', quality: 85 });
  await b.close();
  // Scanned PDF: one page whose only content is the JPEG (DCTDecode), like a scanner's output.
  const jpg = fs.readFileSync(path.join(DIR, 'fdr-advice-photo.jpg'));
  const W = 1020, H = 640, parts = [], offsets = [];
  const obj = s => { parts.push(s); };
  obj('<< /Type /Catalog /Pages 2 0 R >>');
  obj('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W * 0.75} ${H * 0.75}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>`);
  obj(null);
  const draw = `q ${W * 0.75} 0 0 ${H * 0.75} 0 0 cm /Im1 Do Q`;
  obj(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
  let out = Buffer.from('%PDF-1.4\n', 'latin1');
  parts.forEach((s, i) => {
    offsets.push(out.length);
    const head = Buffer.from(`${i + 1} 0 obj\n`, 'latin1');
    const body = s === null
      ? Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`, 'latin1'), jpg, Buffer.from('\nendstream', 'latin1')])
      : Buffer.from(s, 'latin1');
    out = Buffer.concat([out, head, body, Buffer.from('\nendobj\n', 'latin1')]);
  });
  const xref = out.length;
  out = Buffer.concat([out, Buffer.from(`xref\n0 ${parts.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${parts.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`, 'latin1')]);
  fs.writeFileSync(path.join(DIR, 'fdr-advice-scan.pdf'), out);
  console.log('fixtures written');
})();
