# FDR_DOC_Folder

Project documentation and validation test documents for FDR Vault (AICTE Intelligent Regulatory Validation Platform, SIH 2026, team Prime Developers).

| Path | What it is |
|---|---|
| `FDR_Vault_Project_Documentation.pdf` | Complete project documentation (22 pages): problem, solution, roles, architecture, workflows, rules, security, database, API, deployment, tests, demo guide, limitations |
| `Validation_Test_Documents/00_TEST_GUIDE.pdf` | Where to upload each test document, what to type in the form, and the expected GREEN / AMBER / RED result |
| `Validation_Test_Documents/1_Application_Valid_Set/` | A complete application (A01–A09) that passes every check |
| `Validation_Test_Documents/2_Application_Negative_Tests/` | One fault per file (B01–B08): expired or expiring certificate, other institution, wrong document, amount mismatch, short tenure, low corpus, faculty ratio |
| `Validation_Test_Documents/3_FDR_Requests_Valid/` | New FDR, renewal, replacement, lien release, correction and compliance reply (C01–C13) |
| `Validation_Test_Documents/4_FDR_Negative_Tests/` | Documents the AI Regulatory Assistant must flag (N01–N12), including an OCR scan and a photo |
| `source/` | HTML source of the documentation, its images, and the two generators |

All test documents are fictitious **specimens** for the demo institution DITS Delhi (PID 1-10928371). Each carries a SPECIMEN watermark and footer and is not a valid record.

## Regenerate

Both scripts run on Windows (they use the Segoe UI fonts and Google Chrome) and need Python 3 with `reportlab`, `pypdf`, `pypdfium2` and `Pillow`.

```bash
# Documentation PDF: renders the HTML with headless Chrome and fills the contents page numbers
python source/build_pdf.py

# Test kit: each FDR number can be registered only once in the portal, so use a new series for every test run
python source/make_test_documents.py --series 59
```

The test kit's dates are computed from the day it is generated, so expired, expiring and matured documents stay correct.
