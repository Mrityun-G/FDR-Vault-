"""Generate the FDR Vault validation test kit: specimen PDFs for the application wizard and every FDR
request, positive and negative cases, plus 00_TEST_GUIDE.pdf that says where to upload each file and
what result to expect.

Every document is a SPECIMEN for software testing (image watermark + footer). Text layout follows the
free reader in server/read-pdf.mjs: one "Label: value" per line, the lien line is the first line that
mentions a lien, and the first date line of a deposit advice is its date of deposit.

FDR numbers can be registered only once in the portal. After a test run, generate a fresh kit with a
new series:   python make_test_documents.py --series 59
Dates are computed from the day the kit is generated, so "expired", "matured" and "expiring" stay true.
"""
import argparse, io, random, shutil
from datetime import date, timedelta
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import pypdfium2 as pdfium
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import (KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle)

ap = argparse.ArgumentParser()
ap.add_argument("--series", type=int, default=58, help="two-digit series for fresh FDR numbers (10-99)")
ap.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "Validation_Test_Documents"))
args = ap.parse_args()
assert 10 <= args.series <= 99
OUT = Path(args.out)
T = date.today()

# ------------------------------------------------------------------ fonts (Segoe UI has the ₹ sign)
FONT_DIR = Path(r"C:\Windows\Fonts")
pdfmetrics.registerFont(TTFont("UI", str(FONT_DIR / "segoeui.ttf")))
pdfmetrics.registerFont(TTFont("UI-B", str(FONT_DIR / "segoeuib.ttf")))
pdfmetrics.registerFont(TTFont("UI-I", str(FONT_DIR / "segoeuii.ttf")))
from reportlab.pdfbase.pdfmetrics import registerFontFamily
registerFontFamily("UI", normal="UI", bold="UI-B", italic="UI-I", boldItalic="UI-B")

# ------------------------------------------------------------------ institution and bank data (match the live demo account)
INST = "Delhi Institute of Technology & Science"
INST_UP = INST.upper()
INST_X = INST.replace("&", "&amp;")   # for reportlab paragraph markup
PID = "1-10928371"
ADDR = "Revenue Village Alipur, North Delhi, Delhi - 110036"
LIEN_AICTE = "Regional Officer, Northern Regional Office, AICTE"
OTHER_INST = "Bangalore College of Engineering"
SBI = ("STATE BANK OF INDIA", "Institutional Area Branch, New Delhi", "SBIN0001234")
SBI2 = ("STATE BANK OF INDIA", "Model Town Branch, Delhi", "SBIN0005678")
HEAD = "Dr. R. K. Sharma"
REGISTRAR = "Ms. Anjali Mehta"


def fdr_no(n, year):
    return f"SBI-FDR-{args.series}{n:03d}-{year}"


def add_years(d, n):
    try:
        return d.replace(year=d.year + n)
    except ValueError:            # 29 Feb
        return d.replace(year=d.year + n, day=28)


def add_months(d, n):            # first day of the month n months away (used with month_end)
    m = d.month - 1 + n
    return date(d.year + m // 12, m % 12 + 1, 1)


def month_end(d):
    nxt = date(d.year + (d.month == 12), d.month % 12 + 1, 1)
    return nxt - timedelta(days=1)


dmy = lambda d: d.strftime("%d/%m/%Y")
long_ = lambda d: d.strftime("%d %B %Y").lstrip("0")
iso = lambda d: d.isoformat()


def rupees(n):
    s = str(int(n))
    head, tail = s[:-3], s[-3:]
    parts = []
    while len(head) > 2:
        parts.insert(0, head[-2:]); head = head[:-2]
    if head: parts.insert(0, head)
    return "Rs. " + ",".join(parts + [tail]) + ".00"


def words(n):
    return {10_000_000: "One Crore", 11_000_000: "One Crore Ten Lakh", 7_500_000: "Seventy-Five Lakh",
            5_000_000: "Fifty Lakh"}.get(n, "")


# ------------------------------------------------------------------ page drawing
W, H = A4
FOOTER = "SPECIMEN FOR SOFTWARE TESTING ONLY - NOT A VALID OR GENUINE DOCUMENT - SIH 2026 PROTOTYPE TEST DATA"


def watermark_png():
    # An image, not text: it never reaches the PDF text layer the reader parses.
    img = Image.new("RGBA", (1400, 1400), (0, 0, 0, 0))
    f = ImageFont.truetype(str(FONT_DIR / "segoeuib.ttf"), 230)
    d = ImageDraw.Draw(img)
    d.text((700, 700), "SPECIMEN", font=f, fill=(200, 40, 40, 34), anchor="mm")
    buf = io.BytesIO(); img.rotate(38, resample=Image.BICUBIC).save(buf, "PNG"); buf.seek(0)
    return ImageReader(buf)


WM = watermark_png()


class Doc:
    """One-page specimen document. Every line() is one line of text in the PDF text layer."""

    def __init__(self, path, accent=(0.05, 0.16, 0.36)):
        self.c = canvas.Canvas(str(path), pagesize=A4)
        self.c.setTitle(Path(path).stem.replace("_", " "))
        self.c.setAuthor("FDR Vault test kit (specimen)")
        self.c.setSubject("Specimen document for software testing only")
        self.y = H - 52
        self.accent = accent
        self.c.drawImage(WM, (W - 520) / 2, (H - 520) / 2, 520, 520, mask="auto")

    def letterhead(self, org, *sub):
        c = self.c
        c.setFillColorRGB(*self.accent); c.rect(0, H - 14, W, 14, stroke=0, fill=1)
        c.setFont("UI-B", 17); c.drawString(56, self.y, org); self.y -= 18
        c.setFillColorRGB(0.25, 0.28, 0.33)
        for s in sub:
            c.setFont("UI", 9.5); c.drawString(56, self.y, s); self.y -= 13
        c.setStrokeColorRGB(*self.accent); c.setLineWidth(1.4); c.line(56, self.y - 2, W - 56, self.y - 2)
        self.y -= 30
        c.setFillColorRGB(0.1, 0.12, 0.16)

    def title(self, t, sub=None):
        c = self.c
        c.setFont("UI-B", 13.5); c.drawCentredString(W / 2, self.y, t); self.y -= 16
        if sub:
            c.setFont("UI", 9.5); c.setFillColorRGB(0.35, 0.38, 0.43); c.drawCentredString(W / 2, self.y, sub)
            c.setFillColorRGB(0.1, 0.12, 0.16); self.y -= 14
        self.y -= 12

    def line(self, text, bold_label=True, size=10.5, gap=17):
        c = self.c
        if bold_label and ": " in text:
            lab, val = text.split(": ", 1)
            c.setFont("UI-B", size); c.drawString(64, self.y, lab + ":")
            c.setFont("UI", size); c.drawString(64 + pdfmetrics.stringWidth(lab + ": ", "UI-B", size), self.y, val)
        else:
            c.setFont("UI", size); c.drawString(64, self.y, text)
        self.y -= gap

    def para(self, text, size=10, gap=14.5):
        c = self.c
        c.setFont("UI", size)
        words_, cur = text.split(), ""
        for w in words_:
            t = (cur + " " + w).strip()
            if pdfmetrics.stringWidth(t, "UI", size) > W - 128:
                c.drawString(64, self.y, cur); self.y -= gap; cur = w
            else:
                cur = t
        if cur: c.drawString(64, self.y, cur); self.y -= gap
        self.y -= 4

    def table(self, rows, widths=(220, 150)):
        c = self.c
        x0 = 64
        for k, row in enumerate(rows):
            if k == 0:
                c.setFillColorRGB(*self.accent); c.rect(x0 - 4, self.y - 5, sum(widths) + 8, 17, stroke=0, fill=1)
                c.setFillColorRGB(1, 1, 1); c.setFont("UI-B", 10)
            else:
                c.setFillColorRGB(0.1, 0.12, 0.16); c.setFont("UI", 10)
            x = x0
            for cell, w in zip(row, widths):
                c.drawString(x, self.y, str(cell)); x += w
            self.y -= 17
        c.setFillColorRGB(0.1, 0.12, 0.16); self.y -= 6

    def space(self, n=10):
        self.y -= n

    def sign(self, *lines):
        self.y -= 18
        c = self.c
        for k, s in enumerate(lines):
            c.setFont("UI-B" if k == 0 else "UI", 10); c.drawString(W - 260, self.y, s); self.y -= 14

    def save(self):
        c = self.c
        c.setStrokeColorRGB(0.75, 0.2, 0.2); c.setLineWidth(0.8); c.line(56, 58, W - 56, 58)
        c.setFillColorRGB(0.7, 0.12, 0.12); c.setFont("UI-B", 7.6); c.drawCentredString(W / 2, 44, FOOTER)
        c.showPage(); c.save()


# ------------------------------------------------------------------ document templates

def fdr_advice(path, number, amount, issue, maturity, *, bank=SBI, depositor=INST, lien=LIEN_AICTE,
               title="FIXED DEPOSIT ADVICE", note=None, renewed_on=None, earlier=None):
    d = Doc(path)
    d.letterhead(bank[0], f"{bank[1]}    IFSC: {bank[2]}", "Core Banking Branch - Institutional Banking")
    d.title(title, "Customer copy")
    d.line(f"Name of the Depositor: {depositor}")
    d.line(f"FDR No.: {number}")
    d.line(f"Principal Amount: {rupees(amount)}")
    d.line(f"Amount in words: Rupees {words(amount)} only" if words(amount) else "Amount in words: as above")
    d.line(f"{'Original ' if renewed_on else ''}Date of Deposit: {dmy(issue)}")
    if renewed_on:
        d.line(f"Renewed on: {dmy(renewed_on)}")
    d.line(f"{'Revised ' if renewed_on else ''}Maturity Date: {dmy(maturity)}")
    if earlier:
        d.line(f"Earlier maturity: {dmy(earlier)}")
    start = earlier or issue                     # a renewal shows its renewed term
    months = (maturity.year - start.year) * 12 + maturity.month - start.month
    d.line(f"Period: {months} months{' (renewed term)' if earlier else ''}")
    d.line("Rate of Interest: 6.50% per annum, compounded quarterly")
    d.line(f"Lien marked in favour of: {lien}")
    d.space(6)
    d.para(note or "The deposit shall not be closed, pledged or paid out before maturity without the written "
                   "consent of the holder named above. Interest is credited to the principal on each quarter end.")
    d.sign(f"For {bank[0]}", "Branch Manager", "(seal and signature)")
    d.save()


def lien_letter(path, number, amount, issue, maturity, *, bank=SBI, lien=LIEN_AICTE, issued_on=None):
    d = Doc(path)
    d.letterhead(bank[0], f"{bank[1]}    IFSC: {bank[2]}", "Core Banking Branch - Institutional Banking")
    d.title("BANK CONFIRMATION LETTER", f"Ref: SBI/IAB/JC/{issue.year}/{number[-9:-5]}    Issued on {long_(issued_on or issue)}")
    d.line(f"To: {LIEN_AICTE}, New Delhi")
    d.line(f"Name of the Depositor: {INST}")
    d.line(f"FDR No.: {number}")
    d.line(f"Principal Amount: {rupees(amount)}")
    d.line(f"Date of Deposit: {dmy(issue)}")
    d.line(f"Maturity Date: {dmy(maturity)}")
    d.line(f"Lien marked in favour of: {lien}")
    d.space(6)
    d.para("We confirm that the above deposit is recorded in our Core Banking System with the charge noted above. "
           "The deposit will not be closed, pledged or paid out without the written consent of the holder of the charge.")
    d.sign(f"For {bank[0]}", "Branch Manager", "(seal and signature)")
    d.save()


def inst_head(d):
    d.letterhead(INST_UP, f"PID {PID}    {ADDR}", "Unaided - Private  |  www.dits-delhi.edu.in")


def land_title(path, purchaser=INST, purchaser_addr=ADDR):
    d = Doc(path, accent=(0.33, 0.22, 0.05))
    d.letterhead("OFFICE OF THE SUB-REGISTRAR, NORTH DELHI", "Registration Department (specimen office)",
                 "Revenue Village Alipur Circle")
    d.title("REGISTERED SALE DEED", f"Registration No. SR-ND/{T.year - 17}/4471   Book I, Volume 2381")
    d.line(f"Purchaser Name: {purchaser}")
    d.line(f"Address of Purchaser: {purchaser_addr}")
    d.line("Vendor: Sh. Mahesh Chand Yadav and others")
    d.line("Property: Agricultural land converted for institutional use")
    d.line("Khasra Nos.: 112/1, 112/2, 113, 114/1 in Revenue Village Alipur")
    d.line("Total Land Area: 10.50 Acres (42,492 sq. m), contiguous")
    d.line(f"Date of Execution: {dmy(date(T.year - 17, 3, 14))}")
    d.line("Land Use: Institutional (educational), as per Master Plan")
    d.space(6)
    d.para("The vendor has transferred full ownership of the land described above to the purchaser, free from all "
           "encumbrances. Mutation has been entered in the revenue records of the circle.")
    d.sign("Sub-Registrar, North Delhi", "(seal and signature)")
    d.save()


def certificate(path, org, sub, title, cert_no, valid_till, body, rows, signer, accent=(0.12, 0.35, 0.18)):
    d = Doc(path, accent=accent)
    d.letterhead(org, *sub)
    d.title(title, f"Certificate No. {cert_no}")
    d.line(f"Institution: {INST}")
    d.line(f"PID: {PID}")
    d.line(f"Premises: {ADDR}")
    for r in rows:
        d.line(r)
    d.line(f"Valid till: {dmy(valid_till)}")
    d.space(6)
    d.para(body)
    d.sign(*signer)
    d.save()


def building_cert(path, valid_till):
    certificate(path, "MUNICIPAL BUILDING DEPARTMENT", ("North Delhi Zone - Structural Safety Cell", "Civic Centre, North Delhi"),
                "BUILDING STABILITY AND COMPLETION CERTIFICATE", f"MBD/NDZ/STB/{T.year}/2207", valid_till,
                "Certified that the buildings of the institution were inspected and are structurally safe for academic use. "
                "The occupancy is permitted until the validity date shown, subject to periodic inspection.",
                ["Total Built-up Area: 14,850 sq. m (academic, administrative and library blocks)",
                 f"Date of Inspection: {dmy(T - timedelta(days=21))}", "Structural Engineer: Er. P. Nair (Reg. No. SE-2291)"],
                ("Executive Engineer (Buildings)", "Municipal Building Department", "(seal and signature)"))


def fire_noc(path, valid_till, cert_no=None):
    certificate(path, "STATE FIRE & EMERGENCY SERVICES", ("Delhi Division - Fire Prevention Wing", "Fire Headquarters, North Zone"),
                "FIRE SAFETY NO OBJECTION CERTIFICATE", cert_no or f"SFES/DL/NOC/{T.year}/8812", valid_till,
                "No objection is granted for the use of the premises as an educational institution. Fire detection, "
                "hydrant and evacuation systems were found working at inspection.",
                ["Occupancy: Educational (Group B)", "Number of Blocks: 4 (G+4)",
                 f"Date of Inspection: {dmy(T - timedelta(days=30))}"],
                ("Chief Fire Officer", "State Fire & Emergency Services", "(seal and signature)"), accent=(0.55, 0.1, 0.1))


def affiliation(path, valid_till):
    certificate(path, "DELHI TECHNICAL AFFILIATING UNIVERSITY", ("Specimen university - Office of the Registrar", "Sector 16, Delhi"),
                "LETTER OF AFFILIATION", f"DTAU/AFF/{T.year}/0937", valid_till,
                f"The institution is affiliated to the University for the programmes listed for the academic years "
                f"{T.year}-{str(T.year + 1)[2:]} and {T.year + 1}-{str(T.year + 2)[2:]}, subject to the conditions of affiliation.",
                ["Programmes: B.Tech (CSE, ECE, ME, CE), M.Tech (CSE), MBA", "Approved Intake: 600",
                 f"Academic Year: {T.year}-{str(T.year + 1)[2:]}"],
                ("Registrar", "Delhi Technical Affiliating University", "(seal and signature)"), accent=(0.27, 0.12, 0.45))


def state_noc(path):
    certificate(path, "DIRECTORATE OF TECHNICAL EDUCATION", ("State NOC Cell, Delhi", "Muni Maya Ram Marg, Delhi"),
                "NO OBJECTION CERTIFICATE (STATE GOVERNMENT)", f"DTE/NOC/{T.year}/1183", add_years(T, 1).replace(month=6, day=30),
                f"The State Government has no objection to the continuation of the programmes of the institution for the "
                f"academic year {T.year}-{str(T.year + 1)[2:]} with the approved intake.",
                ["Purpose: Extension of Approval / continuation of programmes", "Approved Intake: 600"],
                ("Director of Technical Education", "State NOC Cell", "(seal and signature)"), accent=(0.1, 0.3, 0.45))


def faculty_register(path, p, a, s):
    d = Doc(path)
    inst_head(d)
    d.title("CERTIFIED FACULTY CADRE REGISTER", f"Academic Year {T.year}-{str(T.year + 1)[2:]}   Total students: 2,400")
    d.line(f"Institution: {INST}")
    d.line(f"Professors: {p}")
    d.line(f"Associate Professors: {a}")
    d.line(f"Assistant Professors: {s}")
    d.line(f"Total Faculty: {p + a + s}")
    d.space(4)
    split = lambda n: [n // 4 + (1 if k < n % 4 else 0) for k in range(4)]
    rows = [("Department", "Prof.", "Assoc.", "Asst.")]
    for dep, pp, aa, ss in zip(("Computer Science & Engg.", "Electronics & Comm. Engg.", "Mechanical Engg.", "Civil Engg."),
                               split(p), split(a), split(s)):
        rows.append((dep, pp, aa, ss))
    d.table(rows, widths=(220, 70, 70, 70))
    d.para("Certified that the faculty listed above are on the regular rolls of the institution, appointed through duly "
           "constituted selection committees, with qualifications as per the AICTE norms.")
    d.sign(HEAD, "Principal / Head of Institution", "(seal and signature)")
    d.save()


def inst_letter(path, title, sub, lines_, body, signer=(HEAD, "Principal / Head of Institution", "(seal and signature)")):
    d = Doc(path)
    inst_head(d)
    d.title(title, sub)
    for l in lines_:
        d.line(l)
    d.space(4)
    for b in body:
        d.para(b)
    d.sign(*signer)
    d.save()


def wrong_doc(path, title, ref):
    """A real-looking document of another kind, with no deposit wording: tests the wrong-document check."""
    certificate(path, "STATE FIRE & EMERGENCY SERVICES", ("Delhi Division - Fire Prevention Wing", "Fire Headquarters, North Zone"),
                title, ref, add_years(T, 1),
                "The fire drill was conducted with all occupants. Evacuation was completed in 6 minutes 40 seconds. "
                "Hydrant pressure and alarm panels were tested and found working.",
                ["Occupancy: Educational (Group B)", f"Date of Inspection: {dmy(T - timedelta(days=12))}"],
                ("Station Fire Officer", "State Fire & Emergency Services", "(seal and signature)"), accent=(0.55, 0.1, 0.1))


def scan_of(src_pdf, out_pdf=None, out_jpg=None, seed=1):
    """Turn a text PDF into an image-only scan (JPEG pages) and/or a phone photo, for the OCR reader."""
    page = pdfium.PdfDocument(str(src_pdf))[0]
    img = page.render(scale=200 / 72).to_pil().convert("L")
    rnd = random.Random(seed)
    img = img.rotate(rnd.uniform(-0.8, 0.8), resample=Image.BICUBIC, expand=False, fillcolor=255)
    noise = Image.effect_noise(img.size, 18).convert("L")
    img = Image.blend(img, noise, 0.06).filter(ImageFilter.GaussianBlur(0.5))
    if out_pdf:
        img.save(out_pdf, "PDF", resolution=200, quality=82)
    if out_jpg:
        ph = img.convert("RGB").resize((int(img.width * 0.75), int(img.height * 0.75)))
        ph = Image.blend(ph, Image.new("RGB", ph.size, (238, 228, 210)), 0.12)   # warm paper tone of a phone photo
        ph.save(out_jpg, "JPEG", quality=85)


# ------------------------------------------------------------------ the kit
OUT.mkdir(parents=True, exist_ok=True)
for old in OUT.iterdir():                     # clear the previous kit, keep the folder (it may be open in Explorer)
    shutil.rmtree(old) if old.is_dir() else old.unlink()
F1, F2, F3, F4 = (OUT / n for n in ("1_Application_Valid_Set", "2_Application_Negative_Tests",
                                     "3_FDR_Requests_Valid", "4_FDR_Negative_Tests"))
for f in (F1, F2, F3, F4):
    f.mkdir()

CRORE = 10_000_000
k = {}   # values the guide prints

# FDR numbers (fresh series)
A_FDR = fdr_no(101, (T - timedelta(days=9)).year)
k["app_fdr"] = (A_FDR, CRORE, T - timedelta(days=9), add_years(T - timedelta(days=9), 10))
k["new"] = (fdr_no(102, (T - timedelta(days=8)).year), CRORE, T - timedelta(days=8), add_years(T - timedelta(days=8), 10))
ren_mat = T + timedelta(days=46); ren_iss = add_years(ren_mat, -10)
k["renew"] = (fdr_no(103, ren_iss.year), CRORE, ren_iss, ren_mat)
rep_mat = T + timedelta(days=82); rep_iss = add_years(rep_mat, -10)
k["replace_old"] = (fdr_no(104, rep_iss.year), CRORE, rep_iss, rep_mat)
k["replace_new"] = (fdr_no(105, (T - timedelta(days=5)).year), 11_000_000, T - timedelta(days=5), add_years(T - timedelta(days=5), 10))
rel_mat = T - timedelta(days=40); rel_iss = add_years(rel_mat, -10)
k["release"] = (fdr_no(106, rel_iss.year), CRORE, rel_iss, rel_mat)

valid = {"building": month_end(add_months(T, 29)), "fire": month_end(add_months(T, 14)),
         "affil": date(T.year + 2, 6, 30), "fire_expired": month_end(add_months(T, -7)),
         "building_soon": month_end(add_months(T, 4)), "fire_renewed": month_end(add_months(T, 36))}

# 1. application, valid set
land_title(F1 / "A01_Land_Title_Sale_Deed.pdf")
building_cert(F1 / "A02_Building_Stability_Completion_Certificate.pdf", valid["building"])
fire_noc(F1 / "A03_Fire_Safety_NOC.pdf", valid["fire"])
n, amt, iss, mat = k["app_fdr"]
fdr_advice(F1 / f"A04_FDR_Advice_{n}.pdf", n, amt, iss, mat)
affiliation(F1 / "A05_University_Affiliation_Letter.pdf", valid["affil"])
state_noc(F1 / "A06_State_DTE_NOC.pdf")
faculty_register(F1 / "A07_Faculty_Cadre_Register.pdf", 14, 28, 84)
lien_letter(F1 / f"A08_Bank_Confirmation_Letter_{n}.pdf", n, amt, iss, mat, issued_on=iss + timedelta(days=2))
inst_letter(F1 / "A09_Affidavit_Undertaking.pdf", "AFFIDAVIT CUM UNDERTAKING", f"Academic Year {T.year}-{str(T.year + 1)[2:]}",
            [f"Institution: {INST}", f"PID: {PID}", f"Signed on: {long_(T - timedelta(days=4))}"],
            [f"I, {HEAD}, Principal of the institution, solemnly declare that the information and documents submitted "
             "with this application are true and complete, and that the institution meets the norms it has declared.",
             "I undertake to inform the Council of any change in the information within 30 days."])

# 2. application, negative tests (each replaces one file of set 1)
fire_noc(F2 / "B01_Fire_Safety_NOC_EXPIRED.pdf", valid["fire_expired"], cert_no=f"SFES/DL/NOC/{T.year - 1}/6120")
building_cert(F2 / "B02_Building_Certificate_EXPIRING_SOON.pdf", valid["building_soon"])
land_title(F2 / "B03_Land_Title_OTHER_INSTITUTION.pdf", purchaser=OTHER_INST, purchaser_addr="Bangalore Urban, Karnataka - 560001")
wrong_doc(F2 / "B04_WRONG_DOCUMENT_for_FDR_slot.pdf", "FIRE DRILL INSPECTION REPORT", f"SFES/DL/DRL/{T.year}/0412")
fdr_advice(F2 / f"B05_FDR_Advice_AMOUNT_MISMATCH_{A_FDR}.pdf", A_FDR, 7_500_000, iss, mat)
b6 = (fdr_no(121, (T - timedelta(days=9)).year), CRORE, T - timedelta(days=9), add_years(T - timedelta(days=9), 5))
fdr_advice(F2 / f"B06_FDR_Advice_5_YEAR_TENURE_{b6[0]}.pdf", *b6)
b7 = (fdr_no(122, (T - timedelta(days=9)).year), 5_000_000, T - timedelta(days=9), add_years(T - timedelta(days=9), 10))
fdr_advice(F2 / f"B07_FDR_Advice_BELOW_CORPUS_{b7[0]}.pdf", *b7)
faculty_register(F2 / "B08_Faculty_Register_SFR_VIOLATION.pdf", 8, 16, 60)
k["b6"], k["b7"] = b6, b7

# 3. FDR requests, valid
n, amt, iss, mat = k["new"]
fdr_advice(F3 / f"C01_NEW_FDR_Deposit_Advice_{n}.pdf", n, amt, iss, mat)
lien_letter(F3 / f"C02_NEW_FDR_Bank_Confirmation_Letter_{n}.pdf", n, amt, iss, mat, issued_on=iss + timedelta(days=1))
inst_letter(F3 / "C03_NEW_FDR_Authorisation_of_Signatory.pdf", "AUTHORISATION OF SIGNATORY", "Extract of the Governing Body resolution",
            [f"Institution: {INST}", f"Name of the authorised person: {REGISTRAR}, Registrar",
             f"Resolution passed on: {long_(T - timedelta(days=20))}"],
            [f"Resolved that {REGISTRAR}, Registrar, is authorised to submit and sign the security deposit records of the "
             "institution on the AICTE portal on behalf of the Head of Institution.",
             "Signature of the Head / management: the Chairman and the Principal have signed this extract."])
n, amt, iss, mat = k["renew"]
fdr_advice(F3 / f"C04_RENEWAL_Step1_Original_Advice_{n}.pdf", n, amt, iss, mat)
fdr_advice(F3 / f"C05_RENEWAL_Step2_Renewed_Advice_{n}.pdf", n, amt, iss, add_years(mat, 10), title="FIXED DEPOSIT ADVICE - RENEWAL",
           renewed_on=T - timedelta(days=3), earlier=mat,
           note="The deposit has been renewed for a further term of 120 months on the same terms. The charge in favour of the "
                "holder named above continues on the renewed deposit.")
n, amt, iss, mat = k["replace_old"]
fdr_advice(F3 / f"C06_REPLACEMENT_Step1_Original_Advice_{n}.pdf", n, amt, iss, mat)
n2, amt2, iss2, mat2 = k["replace_new"]
fdr_advice(F3 / f"C07_REPLACEMENT_Step2_New_Deposit_Advice_{n2}.pdf", n2, amt2, iss2, mat2, bank=SBI2)
lien_letter(F3 / f"C08_REPLACEMENT_Step2_Bank_Confirmation_Letter_{n2}.pdf", n2, amt2, iss2, mat2, bank=SBI2, issued_on=iss2 + timedelta(days=1))
n, amt, iss, mat = k["release"]
fdr_advice(F3 / f"C09_RELEASE_Step1_Original_Advice_{n}.pdf", n, amt, iss, mat)
fdr_advice(F3 / f"C10_RELEASE_Step2_Matured_Deposit_Statement_{n}.pdf", n, amt, iss, mat, title="STATEMENT OF MATURED DEPOSIT",
           note="The deposit completed its term on the maturity date. The proceeds are held pending discharge of the charge "
                "noted above; they will be paid only after the holder of the charge releases it in writing.")
inst_letter(F3 / "C11_RELEASE_Step2_No_Dues_Undertaking.pdf", "UNDERTAKING OF NO OUTSTANDING LIABILITIES", f"Signed on {long_(T - timedelta(days=2))}",
            [f"Institution: {INST}", f"FDR No.: {n}"],
            [f"I, {HEAD}, Principal of {INST}, declare that no student, staff or regulatory dues are pending against the "
             "institution in respect of the programmes covered by the deposit named above.",
             "Statement of no dues: there are no outstanding fee refunds, salaries or statutory payments.",
             f"Signature of the Head of Institution: (signed) {HEAD}"])
n, amt, iss, mat = k["new"]
d = Doc(F3 / f"C12_CORRECTION_Bank_Correction_Letter_{n}.pdf")
d.letterhead(SBI[0], f"{SBI[1]}    IFSC: {SBI[2]}", "Core Banking Branch - Institutional Banking")
d.title("CORRECTION OF DEPOSIT PARTICULARS", f"Issued on {long_(T - timedelta(days=1))}")
d.line(f"Name of the Depositor: {INST}")
d.line(f"FDR No.: {n}")
d.line("Corrected detail: Branch name")
d.line(f"Recorded as: Institutional Branch, Delhi")
d.line(f"Correct value: {SBI[1]}")
d.space(6)
d.para("The branch name was recorded incorrectly on the portal. All other particulars of the deposit remain unchanged.")
d.sign(f"For {SBI[0]}", "Branch Manager", "Bank seal and signature")
d.save()
fire_noc(F3 / "C13_COMPLIANCE_Renewed_Fire_Safety_NOC.pdf", valid["fire_renewed"], cert_no=f"SFES/DL/NOC/{T.year}/9305")

# 4. FDR negative tests (Regulatory Assistant, New FDR unless the guide says otherwise)
neg = {}
def neg_fdr(code, label, num, **kw):
    issue = kw.pop("issue", T - timedelta(days=7)); maturity = kw.pop("maturity", add_years(issue, 10)); amount = kw.pop("amount", CRORE)
    fdr_advice(F4 / f"{code}_{label}_{num}.pdf", num, amount, issue, maturity, **kw)
    neg[code] = (num, amount, issue, maturity)

neg_fdr("N01", "LIEN_NOT_AICTE", fdr_no(110, T.year), lien="Chairman, DITS Education Society, Delhi")
neg_fdr("N02", "TENURE_5_YEARS", fdr_no(111, T.year), maturity=add_years(T - timedelta(days=7), 5))
neg_fdr("N03", "OTHER_INSTITUTION", fdr_no(112, T.year), depositor=OTHER_INST)
neg_fdr("N04", "BELOW_REQUIRED_CORPUS", fdr_no(113, T.year), amount=5_000_000)
fut = T + timedelta(days=16)
neg_fdr("N05", "ISSUE_DATE_IN_FUTURE", fdr_no(114, fut.year), issue=fut)
old_m = T - timedelta(days=90)
neg_fdr("N06", "ALREADY_MATURED", fdr_no(115, add_years(old_m, -10).year), issue=add_years(old_m, -10), maturity=old_m)
wrong_doc(F4 / "N07_WRONG_DOCUMENT_Fire_Report_in_FDR_slot.pdf", "FIRE SAFETY AUDIT REPORT", f"SFES/DL/AUD/{T.year}/0733")
n, amt, iss, mat = k["new"]
lien_letter(F4 / f"N08_BANK_LETTER_NOT_AICTE_{n}.pdf", n, amt, iss, mat, lien="Chairman, DITS Education Society, Delhi")
lien_letter(F4 / f"N09_BANK_LETTER_DIFFERENT_FDR_{fdr_no(109, T.year)}.pdf", fdr_no(109, T.year), amt, iss, mat)
n, amt, iss, mat = k["renew"]
wrongren = fdr_no(199, iss.year)
fdr_advice(F4 / f"N10_RENEWAL_ADVICE_OF_ANOTHER_FDR_{wrongren}.pdf", wrongren, amt, iss, add_years(mat, 10),
           title="FIXED DEPOSIT ADVICE - RENEWAL", renewed_on=T - timedelta(days=3), earlier=mat)
ocr_src = OUT / "_ocr_source.pdf"
k["ocr"] = (fdr_no(116, T.year), CRORE, T - timedelta(days=6), add_years(T - timedelta(days=6), 10))
fdr_advice(ocr_src, *k["ocr"])
scan_of(ocr_src, out_pdf=F4 / f"N11_OCR_SCANNED_FDR_Advice_{k['ocr'][0]}.pdf", seed=3)
k["photo"] = (fdr_no(117, T.year), CRORE, T - timedelta(days=6), add_years(T - timedelta(days=6), 10))
fdr_advice(ocr_src, *k["photo"])
scan_of(ocr_src, out_jpg=F4 / f"N12_OCR_PHOTO_FDR_Advice_{k['photo'][0]}.jpg", seed=5)
ocr_src.unlink()
k["neg"], k["valid"], k["wrongren"] = neg, valid, wrongren

# ------------------------------------------------------------------ the guide
S = lambda name, **kw: ParagraphStyle(name, fontName=kw.pop("font", "UI"), **kw)
st = {"h1": S("h1", font="UI-B", fontSize=20, leading=24, textColor=colors.HexColor("#0d2a5c"), spaceAfter=4),
      "h2": S("h2", font="UI-B", fontSize=13.5, leading=17, textColor=colors.HexColor("#0d2a5c"), spaceBefore=12, spaceAfter=5),
      "h3": S("h3", font="UI-B", fontSize=11, leading=14, textColor=colors.HexColor("#123b7a"), spaceBefore=8, spaceAfter=3),
      "p": S("p", fontSize=9.4, leading=13.2, spaceAfter=4),
      "small": S("small", fontSize=8.2, leading=11, textColor=colors.HexColor("#5b6575")),
      "cell": S("cell", fontSize=8.1, leading=10.4), "cellb": S("cellb", font="UI-B", fontSize=8.1, leading=10.4),
      "th": S("th", font="UI-B", fontSize=8.2, leading=10.4, textColor=colors.white)}
P = lambda t, s="p": Paragraph(t, st[s])
RES = {"G": '<font color="#1e7a33"><b>GREEN / pass</b></font>', "A": '<font color="#9a5b00"><b>AMBER / warning</b></font>',
       "R": '<font color="#b3172c"><b>RED / fail</b></font>'}


def table(head, rows, widths):
    data = [[P(h, "th") for h in head]] + [[P(c, "cellb" if j == 0 else "cell") for j, c in enumerate(r)] for r in rows]
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0d2a5c")),
                           ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#c9d3e0")),
                           ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f4f7fb")]),
                           ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5), ("LEFTPADDING", (0, 0), (-1, -1), 4.5), ("RIGHTPADDING", (0, 0), (-1, -1), 4.5)]))
    return t


fd = lambda d: d.strftime("%d-%m-%Y")
def fdr_fields(v, bank=SBI):
    n, amt, iss, mat = v
    return f"FDR no. <b>{n}</b> · bank State Bank of India · branch {bank[1]} · IFSC {bank[2]} · amount <b>{amt}</b> · issue {fd(iss)} · maturity {fd(mat)}"

story = []
story += [P("FDR Vault — Validation Test Document Kit", "h1"),
          P(f"Generated on {long_(T)} · FDR number series <b>{args.series}</b> · for the demo institution "
            f"<b>{INST_X}</b> (PID {PID}, Northern region, required corpus ₹100 lakh)", "small"), Spacer(1, 6),
          P("These specimen documents test every upload check in the FDR Vault portal: the <b>application wizard</b>, the "
            "<b>AI Regulatory Assistant</b> (new FDR, renewal, replacement, lien release, correction, compliance reply) and the "
            "plain <b>FDR forms</b>. Each file is watermarked SPECIMEN and is valid only as test data."),
          table(["Sign in", "Account (password <b>Sih@2026Demo</b> for all)"], [
              ["Institution app", "sih_demo.institution@example.com at https://fdr-vault.vercel.app"],
              ["Bank official (SBI)", "sih_demo.bank@example.com at https://fdr-vault-sbf7.vercel.app/officer"],
              ["Scrutiny officer", "sih_demo.officer@example.com at https://fdr-vault-sbf7.vercel.app/officer"],
              ["Administrator", "sih_demo.admin@example.com at https://fdr-vault-sbf7.vercel.app/admin"]], [110, 400]),
          P("Rules to know before you start", "h3"),
          P("• <b>Each FDR number can be registered only once</b> in the whole portal. After a test run, generate a fresh kit with "
            f"<font face='UI-B'>python make_test_documents.py --series {args.series + 1}</font> (in <i>FDR_DOC_Folder/source</i>)."),
          P("• Dates are relative to the day the kit was generated, so expired, expiring and matured documents stay correct. "
            "Regenerate the kit if you test much later."),
          P("• Where documents are <b>read and checked</b>: the application wizard (Documents step) and the AI Regulatory Assistant. "
            "The plain <i>FDRs → New FDR / Renew / Release</i> forms store the file as evidence without reading it."),
          P("• Without an AI key the server reads PDFs with fixed text rules and photos/scans with OCR (Tesseract). "
            "Validity dates of certificates are typed by you in the wizard; type the date printed on the certificate."),
          P("• Use a different file for each slot. Uploading the same file twice is itself a test (duplicate SHA-256)."),
          ]

story += [P("1 · Application wizard — valid set (folder 1_Application_Valid_Set)", "h2"),
          P("Institution app → Dashboard → <b>New Application</b> → <b>Extension of Approval (EoA)</b>. Enter these values:"),
          table(["Step", "Type exactly"], [
              ["Institution", f"Academic year {T.year}-{str(T.year + 1)[2:]} · address {ADDR}"],
              ["Programme", "Current intake 600 · proposed intake 600 · total students 2400 · Professors 14 · Associate Professors 28 · "
                            "Assistant Professors 84 · built-up area 14850 sq. m"],
              ["FDR", "Choose <b>New FDR</b>: " + fdr_fields(k["app_fdr"])],
              ["Documents", f"Upload A01–A07 in their slots (A08, A09 optional). Valid-till dates: Building {fd(valid['building'])} · "
                            f"Fire {fd(valid['fire'])} · Affiliation {fd(valid['affil'])}"]], [70, 440]),
          Spacer(1, 4),
          table(["File", "Upload in slot", "Expected"], [
              ["A01_Land_Title_Sale_Deed", "Land Title / Registered Sale Deed", RES["G"]],
              ["A02_Building_Stability_Completion_Certificate", f"Building Stability Certificate (valid till {fd(valid['building'])})", RES["G"]],
              ["A03_Fire_Safety_NOC", f"Fire Safety NOC (valid till {fd(valid['fire'])})", RES["G"]],
              [f"A04_FDR_Advice_{A_FDR}", "FDR Certificate", RES["G"] + " — details matched with the FDR form"],
              ["A05_University_Affiliation_Letter", f"University Affiliation Letter (valid till {fd(valid['affil'])})", RES["G"]],
              ["A06_State_DTE_NOC", "State Govt / DTE NOC", RES["G"]],
              ["A07_Faculty_Cadre_Register", "Certified Faculty Cadre Register (14 / 28 / 84)", RES["G"]],
              [f"A08_Bank_Confirmation_Letter_{A_FDR}", "Bank Lien Confirmation Letter (optional)", RES["G"]],
              ["A09_Affidavit_Undertaking", "Affidavit / Undertaking (optional)", RES["G"]]], [190, 210, 110]),
          P("<b>Expected rule findings:</b> Checklist PASSED · Certificate expiry PASSED · PID match PASSED · Duplicate hash PASSED · "
            "Faculty cadre PASSED (SFR 1:19.0) · Built-up area PASSED (needs 13,200 sq. m) · FDR corpus <b>WARNING</b> "
            "(meets corpus and tenure; lien awaiting bank endorsement). Submit → you get an application number. "
            "Then sign in as the bank official and confirm the lien on " + A_FDR + " (any CBS reference of 6+ characters).", "p")]

story += [P("2 · Application wizard — negative tests (folder 2_Application_Negative_Tests)", "h2"),
          P("Start from the valid set and replace <b>one</b> file or value at a time. Use <i>Validate</i> (dry run) to see the result "
            "without submitting."),
          table(["File", "How to use it", "Expected"], [
              ["B01_Fire_Safety_NOC_EXPIRED", f"Fire Safety NOC slot; type valid till {fd(valid['fire_expired'])}",
               RES["R"] + " · RULE-EXPIRY-02 <b>CRITICAL</b> (certificate expired)"],
              ["B02_Building_Certificate_EXPIRING_SOON", f"Building slot; type valid till {fd(valid['building_soon'])}",
               "RULE-EXPIRY-02 <b>WARNING</b> (less than 6 months left)"],
              ["B03_Land_Title_OTHER_INSTITUTION", "Land Title slot (deed names Bangalore College of Engineering)",
               RES["R"] + " · institution name mismatch · RULE-PID-03 <b>CRITICAL</b>"],
              ["B04_WRONG_DOCUMENT_for_FDR_slot", "FDR Certificate slot (a fire drill report)",
               RES["R"] + " · document is not a fixed deposit advice"],
              [f"B05_FDR_Advice_AMOUNT_MISMATCH_{A_FDR}", "FDR slot with the valid FDR form values (form says ₹1 crore, advice says ₹75 lakh)",
               RES["A"] + " · deposit amount differs from the form"],
              [f"B06_FDR_Advice_5_YEAR_TENURE_{k['b6'][0]}", "FDR slot; FDR form: " + fdr_fields(k["b6"]),
               "RULE-FDR-CORPUS-07 <b>CRITICAL</b> (tenure less than 10 years)"],
              [f"B07_FDR_Advice_BELOW_CORPUS_{k['b7'][0]}", "FDR slot; FDR form: " + fdr_fields(k["b7"]),
               "RULE-FDR-CORPUS-07 <b>CRITICAL</b> (₹50 lakh below the ₹100 lakh corpus)"],
              ["B08_Faculty_Register_SFR_VIOLATION", "Faculty slot; type Professors 8 · Associate 16 · Assistant 60",
               "RULE-CADRE-RATIO-05 <b>CRITICAL</b> (SFR 1:28.6, Professors below 13)"],
              ["(no file) duplicate", "Upload A01 in two slots", "RULE-DUPLICATE-HASH-04 <b>WARNING</b> (same file twice)"],
              ["(no file) missing", "Leave one mandatory slot empty", "RULE-CHECKLIST-01 <b>CRITICAL</b>"]], [175, 205, 130])]

rn, ra, ri, rm = k["renew"]; pn, pa, pi, pm = k["replace_old"]; qn, qa, qi, qm = k["replace_new"]; ln, la, li, lm = k["release"]
story += [PageBreak(), P("3 · FDR requests — valid (folder 3_FDR_Requests_Valid)", "h2"),
          P("<b>Step 1 for renewal, replacement and release:</b> first register the deposit that the request is about. "
            "Institution app → <b>FDRs → New FDR</b>, type the values below, attach the Step 1 advice and submit. Then sign in as the "
            "<b>bank official</b> → Verification Center → confirm the joint lien with a CBS reference (e.g. CBS-SBI-LIEN-" + str(args.series) + "01)."),
          table(["Deposit", "Type in FDRs → New FDR", "Attach"], [
              ["Renewal test", fdr_fields(k["renew"]), f"C04_RENEWAL_Step1_Original_Advice_{rn}"],
              ["Replacement test", fdr_fields(k["replace_old"]), f"C06_REPLACEMENT_Step1_Original_Advice_{pn}"],
              ["Release test", fdr_fields(k["release"]) + " (already matured: the form accepts it)", f"C09_RELEASE_Step1_Original_Advice_{ln}"]],
                [80, 290, 140]),
          P("<b>Step 2:</b> Dashboard → <b>AI Regulatory Assistant</b>, choose the request, answer its questions and upload:"),
          table(["Request", "Answers / upload", "Expected"], [
              ["New FDR", f"Bank State Bank of India · lien letter yes · signatory: someone authorised. Upload C01 (deposit advice), "
                          f"C02 (bank letter), C03 (authorisation). Form values: " + fdr_fields(k["new"]),
               RES["G"] + " for all three; submit → the FDR waits for the bank's lien confirmation"],
              ["Renewal", f"Choose {rn} · renewed yes · upload C05 (new maturity {fd(add_years(rm, 10))})",
               RES["G"] + "; admin approves → maturity extended by 10 years"],
              ["Replacement", f"Choose {pn} · bank State Bank of India · lien letter yes · upload C07 and C08 "
                              f"(new FDR {qn}, ₹1.10 crore, {SBI2[1]}, IFSC {SBI2[2]})",
               RES["G"] + "; admin approves → bank confirms the new lien"],
              ["Lien release", f"Choose {ln} (matured {fd(lm)}) · upload C10 (matured statement) and C11 (no-dues undertaking)",
               RES["G"] + "; admin approves with a release order no. → bank records the discharge"],
              ["Correction", f"Choose {k['new'][0]} · detail: Bank / branch / IFSC · upload C12", RES["G"] + "; sent as a helpdesk ticket"],
              ["Compliance reply", "Needs an application with a deficiency notice (officer: Request clarification, e.g. "
                                   "'fire NOC expired'). Choose it and upload C13 (renewed fire NOC)", RES["G"] + "; application returns to scrutiny"]],
                [70, 300, 140]),
          P("Also check: after Step 1 + bank confirmation, Admin → Settings → <b>Run now</b> creates a maturity alert for the renewal "
            f"deposit ({(rm - T).days} days left, Critical) and the replacement deposit ({(pm - T).days} days, Warning); "
            "Reports → <i>Approaching or past maturity</i> lists all three.", "p")]

ng = k["neg"]
story += [P("4 · FDR negative tests (folder 4_FDR_Negative_Tests)", "h2"),
          P("Use the AI Regulatory Assistant → <b>New FDR</b> and upload the file in the <i>FDR certificate / deposit advice</i> slot, "
            "unless the table says otherwise."),
          table(["File", "What is wrong", "Expected message"], [
              [f"N01_LIEN_NOT_AICTE_{ng['N01'][0]}", "Lien marked in favour of the education society", RES["R"] + " — lien / joint holder is not AICTE"],
              [f"N02_TENURE_5_YEARS_{ng['N02'][0]}", f"Runs {fd(ng['N02'][2])} to {fd(ng['N02'][3])}", RES["R"] + " — shorter than 10 years"],
              [f"N03_OTHER_INSTITUTION_{ng['N03'][0]}", "Depositor is Bangalore College of Engineering", RES["R"] + " — names another institution"],
              [f"N04_BELOW_REQUIRED_CORPUS_{ng['N04'][0]}", "₹50 lakh, required corpus ₹100 lakh", RES["A"] + " — below the required corpus"],
              [f"N05_ISSUE_DATE_IN_FUTURE_{ng['N05'][0]}", f"Issue date {fd(ng['N05'][2])}", RES["R"] + " — issue date is in the future"],
              [f"N06_ALREADY_MATURED_{ng['N06'][0]}", f"Matured on {fd(ng['N06'][3])}", RES["R"] + " — maturity date has already passed"],
              ["N07_WRONG_DOCUMENT_Fire_Report_in_FDR_slot", "A fire audit report, not a deposit advice", RES["R"] + " — not a fixed deposit advice"],
              [f"N08_BANK_LETTER_NOT_AICTE_{k['new'][0]}", "Upload in the <i>bank letter</i> slot (with C01 as the advice)", RES["R"] + " — lien not in favour of AICTE"],
              [f"N09_BANK_LETTER_DIFFERENT_FDR_{fdr_no(109, T.year)}", "Bank letter slot, with C01 as the advice", RES["R"] + " on the advice — FDR numbers differ"],
              [f"N10_RENEWAL_ADVICE_OF_ANOTHER_FDR_{k['wrongren']}", f"Assistant → <b>Renewal</b>, choose {rn}, upload this", RES["R"] + " — document is for another FDR"],
              [f"N11_OCR_SCANNED_FDR_Advice_{k['ocr'][0]}", "Image-only scan (no text layer)", RES["G"] + " or " + RES["A"] + " — read by OCR; takes a few seconds"],
              [f"N12_OCR_PHOTO_FDR_Advice_{k['photo'][0]}.jpg", "Phone-style photo (JPG)", RES["G"] + " or " + RES["A"] + " — read by OCR"],
              ["(no file) duplicate", "Upload C01 in two slots of one request", RES["R"] + " — same file uploaded twice"]], [190, 170, 150]),
          P("Bank-side checks (no file): a CBS reference shorter than 6 characters is refused; the SBI bank official cannot see or act "
            "on deposits of other banks; a lien can be discharged only after AICTE approved the release.", "p"),
          Spacer(1, 6),
          P("All documents are fictitious specimens made for testing the FDR Vault prototype (Smart India Hackathon 2026). They carry a "
            "SPECIMEN watermark and footer and must not be used as real records.", "small")]

def on_page(c, d):
    c.saveState(); c.setFont("UI", 7.5); c.setFillColor(colors.HexColor("#5b6575"))
    c.drawString(15 * mm, 9 * mm, "FDR Vault · Validation Test Document Kit · specimen test data")
    c.drawRightString(W - 15 * mm, 9 * mm, f"Page {d.page}"); c.restoreState()

SimpleDocTemplate(str(OUT / "00_TEST_GUIDE.pdf"), pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=14 * mm,
                  bottomMargin=16 * mm, title="FDR Vault Validation Test Document Kit", author="Team Prime Developers").build(
    story, onFirstPage=on_page, onLaterPages=on_page)

files = sorted(p.relative_to(OUT) for p in OUT.rglob("*") if p.is_file())
print(f"{len(files)} files in {OUT}")
for f in files:
    print("  ", f)
