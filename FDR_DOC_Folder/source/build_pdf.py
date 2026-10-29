"""Render the FDR Vault documentation HTML to PDF with headless Chrome, then fill the
table of contents with the real page numbers and render again."""
import re, subprocess, sys
from pathlib import Path
from pypdf import PdfReader

HERE = Path(__file__).resolve().parent
SRC = HERE / "FDR_Vault_Project_Documentation.html"
OUT = HERE.parent / "FDR_Vault_Project_Documentation.pdf"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
TMP = Path(sys.argv[1]) if len(sys.argv) > 1 else SRC.with_name("_build.html")


def render(html_path: Path, pdf_path: Path):
    r = subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                        "--generate-pdf-document-outline", "--virtual-time-budget=8000",
                        f"--print-to-pdf={pdf_path}", html_path.resolve().as_uri()],
                       capture_output=True, text=True, timeout=180)
    if not pdf_path.exists():
        raise SystemExit(f"Chrome failed: {r.stderr[-2000:]}")


def norm(s: str) -> str:
    return re.sub(r"\s+", "", s).lower()


html = SRC.read_text(encoding="utf-8")
# section id -> (number, title) from the headings themselves
heads = re.findall(r'<h2 class="sec[^"]*" id="(s\w+)"><span class="n">(\w+)</span>([^<]+)</h2>', html)
assert len(heads) == 24, len(heads)

TMP.write_text(html, encoding="utf-8")
render(TMP, OUT)
pages = [norm(p.extract_text() or "") for p in PdfReader(str(OUT)).pages]

found = {}
for sid, num, title in heads:
    key = norm(num + title.replace("&amp;", "&"))
    hit = next((i + 1 for i, t in enumerate(pages) if i >= 2 and key in t), None)
    if hit is None:
        raise SystemExit(f"Heading not found in PDF: {num} {title}")
    found[sid] = hit

filled = re.sub(r'<span class="pg" data-sec="(s\w+)">\d+</span>',
                lambda m: f'<span class="pg" data-sec="{m.group(1)}">{found[m.group(1)]}</span>', html)
TMP.write_text(filled, encoding="utf-8")
render(TMP, OUT)
SRC.write_text(filled, encoding="utf-8")   # keep the numbers in the source for the next edit
TMP.unlink()

from pypdf import PdfWriter
writer = PdfWriter(clone_from=str(OUT))
writer.add_metadata({"/Title": "FDR Vault — Complete Project Documentation",
                     "/Author": "Team Prime Developers",
                     "/Subject": "AICTE Intelligent Regulatory Validation Platform (AI-IRVP) · Smart India Hackathon 2026",
                     "/Keywords": "FDR Vault, AICTE, security deposit, FDR, joint lien, SIH 2026"})
with open(OUT, "wb") as fh:
    writer.write(fh)

reader = PdfReader(str(OUT))
print("pages:", len(reader.pages), "size:", OUT.stat().st_size // 1024, "KB", "outline entries:", len(reader.outline))
print("meta:", reader.metadata.title, "|", reader.metadata.author)
print({sid: found[sid] for sid, _, _ in heads})
