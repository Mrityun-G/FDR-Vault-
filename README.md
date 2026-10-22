# AICTE Institution Portal — Mobile App (PWA) + Supabase backend

This is the mobile version of the **Institution (Applicant) portal** of the
[AICTE Intelligent Regulatory Validation Platform](https://aicte-intelligent-regulatory-validation-platform.ai.studio/).
It is an installable Progressive Web App with two run modes:

| Mode | When | Data |
|---|---|---|
| **Supabase** | `config.js` has `SUPABASE_URL` and `SUPABASE_ANON_KEY` | Postgres with row-level security, server-side workflow functions, private document storage, realtime updates |
| **Demo** | The keys are empty (the default) | Kept on the device and seeded from the web prototype. The same screens and rules run locally, so you can evaluate the app without a server |

---

## 0. Deployment (live prototype)

| Piece | Where | Updates automatically when you push to `main` |
|---|---|---|
| Web app (frontend) | **Vercel**: builds with `node scripts/build-www.mjs` and serves `www/` ([`vercel.json`](vercel.json)) | Yes (Vercel Git integration) |
| Database, auth, storage, functions (backend) | **Supabase** project `csnindvgpfphcstjcsag` (Mumbai) | Yes, for changes under `supabase/` ([GitHub Action](.github/workflows/supabase-deploy.yml)) |

[`config.js`](config.js) already points at the Supabase project, so the deployed app runs in **Supabase mode**. The anon key is public by design; row-level security and the server functions protect the data.

**One-time setup for the backend auto-deploy.** In GitHub → *Settings → Secrets and variables → Actions*, add:
`SUPABASE_ACCESS_TOKEN` (from supabase.com/dashboard/account/tokens), `SUPABASE_DB_PASSWORD` (Project Settings → Database) and
`SUPABASE_PROJECT_ID` = `csnindvgpfphcstjcsag`. To change the database, add a **new** file in `supabase/migrations/`; never edit an applied one.

### Google sign-in
1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), go to *Create credentials → OAuth client ID → Web application*.
   - **Authorized JavaScript origins:** your Vercel URL (and `http://localhost:8765` for local testing)
   - **Authorized redirect URI:** `https://csnindvgpfphcstjcsag.supabase.co/auth/v1/callback`
   - Set up the OAuth consent screen (External). While it is in *Testing*, add the Google accounts that should sign in as test users.
2. In Supabase, go to *Authentication → Sign In / Providers → Google*. Turn it on and paste the Client ID and Client Secret.
3. In Supabase, go to *Authentication → URL Configuration*. Set **Site URL** to the Vercel URL, and add the Vercel URL and `http://localhost:8765` to **Redirect URLs**.
4. Approve who may sign in. Any Google account can sign in, but it stays *pending verification* until approved. To approve an account, run this in the SQL Editor:
   ```sql
   select public.admin_invite_user('someone@gmail.com', '1-10928371');   -- institution PID; activates now or on first sign-in
   ```
   `msg2gmanikandan@gmail.com` is already approved for DITS Delhi (`1-10928371`).

Google refuses OAuth inside app WebViews, so in the **Android app** the Google button asks the user to sign in with email and password or an OTP instead. Google sign-in works on the web and installed-PWA versions.

## 1. Connect Supabase (≈10 minutes)

> Already done for the deployed prototype (schema, demo data, storage bucket, daily FDR reminders). The `analyze-document`
> function deploys through the GitHub Action once its secrets are set (step 7 covers the API key).
> These steps are for setting up a fresh project.

1. Create a project at [supabase.com](https://supabase.com) (region: Mumbai `ap-south-1`).
2. **Create the schema.** Open SQL Editor → New query, paste
   [`supabase/migrations/20261022000000_institution_portal.sql`](supabase/migrations/20261022000000_institution_portal.sql) and click **Run**.
   This creates the tables, row-level security, workflow functions, the private `institution-documents` storage
   bucket and its policies, the realtime publication, and (if `pg_cron` is enabled) the daily FDR expiry-reminder job.
   With the Supabase CLI, `supabase db push` does the same.
3. **(Optional) Load the demo data:** run [`supabase/seed.sql`](supabase/seed.sql) in the SQL Editor. It contains the three
   prototype institutions, their applications, FDRs and notifications.
4. **Create users:** go to Authentication → Users → *Add user* (email + password, tick *Auto confirm*). Then link each user
   to an institution in the SQL Editor:
   ```sql
   select public.admin_link_user('principal@dits-delhi.edu.in', '1-10928371');                -- institution user
   select public.admin_link_user('reviewer.mehta@aicte-india.org', null, 'REVIEWER');          -- staff (admin portal / SQL)
   select public.admin_link_user('admin.verma@aicte-india.org',  null, 'ADMIN');
   ```
   Institutions that self-register in the app are created as `PENDING_VERIFICATION`. Activate them the same way,
   using `admin_link_user(email, pid)`.
5. **Auth settings:** go to Authentication → URL Configuration and set *Site URL* to where you host the app (for local testing,
   `http://localhost:8765`). For **Sign in with OTP**, edit the *Magic Link* email template so it includes `{{ .Token }}`.
   For **Government SSO**, configure SAML SSO and put its domain in `SSO_DOMAIN`.
6. **Add the keys:** go to Project Settings → API and copy the *Project URL* and the **anon public** key into [`config.js`](config.js):
   ```js
   SUPABASE_URL: 'https://xxxx.supabase.co',
   SUPABASE_ANON_KEY: 'eyJhbGciOi...',
   ```
   Never put the `service_role` key in the app.
7. **(Optional) Turn on AI document reading.** It runs as a Supabase Edge Function that reads each uploaded document with
   Claude (`claude-opus-5-5`) and cross-checks it against the form: FDR number, amount, dates, bank, lien holder,
   institution name and faculty counts. You need an Anthropic API key:
   ```bash
   supabase functions deploy analyze-document
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```
   The result is **advisory**; the statutory rules still run in Postgres. Server-side refusal fallback is enabled
   (`fallbacks: "default"`). If the function isn't deployed or has no key, the app says so and shows the on-device
   preview instead; submission is never blocked.
8. Reload the app. The demo badge disappears, and sign-in, data, uploads and notifications now come from Supabase.

## 2. Run the app

```bash
npm run serve          # = python -m http.server 8765   → http://localhost:8765
```
To test on a phone, open `http://<your-PC-IP>:8765` on the same Wi-Fi and use **Add to Home Screen** to install it.
Installing and offline mode need HTTPS or `localhost`. You can host it on any static host (Vercel, Netlify, GitHub Pages);
there is no build step.

### Android app (APK)
A ready debug build is at **`dist/AICTE-Institution-Portal-debug.apk`**. Install it on a phone (allow "install unknown
apps") or drag it onto an emulator. To rebuild after changing the web files or `config.js`:
```bash
npm run android:apk        # copies the web app into www/, syncs Capacitor, runs Gradle
# output: android/app/build/outputs/apk/debug/app-debug.apk
```
On Android, downloads (acknowledgement, FDR advice, CSV reports, deficiency notice) are saved and opened in the
system share sheet, and documents open in the system viewer. For the Play Store, create a release build signed with
your own keystore (Android Studio → Build → Generate Signed Bundle).

### Language
Switch between **English and हिन्दी** from the welcome screen, the login screen, or Profile → Language. The whole
interface is translated. Institution data (names, numbers, documents) and the English rule-engine and notice text are
kept as issued.

Demo-mode logins: `principal@dits-delhi.edu.in / Dits@2026`, `director@bce-bangalore.edu.in / Bce@2026`,
`dean@pat-pune.ac.in / Pat@2026`.

---

## 3. How it is secured

- **The server is authoritative.** Clients never write tables. Every change goes through a `SECURITY DEFINER` function that
  checks the caller's identity, role, institution and the allowed status transition, then writes an audit event.
- **Isolation between institutions (RLS):** an institution can read only its own rows; a URL or ID for another
  institution returns nothing. Staff-only notes live in a separate table that institutions cannot read.
- **Status transitions are enforced in SQL.** An institution cannot approve anything. Reviewers can clear or reject an
  application, and only `ADMIN` gives final approval. Decisions require a written rationale.
- **Documents:** they are stored in a private bucket under `<institution_id>/…`. Upload and read are allowed only in your
  own folder, with no update or delete (evidence is immutable). Files are viewed through short-lived signed links.
  Each file's SHA-256 is computed on the device, and the server checks it across **all** institutions to detect reused
  documents. The client cannot see other institutions' files, so only the server can do this check.
- **Validation:** deterministic rules (checklist, certificate expiry, duplicate hash, faculty cadre and SFR, built-up area,
  FDR corpus, tenure and lien) run on the server, versioned in `rule_config`. On-device AI or OCR output is stored as advisory only.
  If server validation is unavailable, the app blocks submission; it never treats a failed check as a pass.
- **Idempotent submission:** each application carries an idempotency key, so retrying after a timeout cannot create duplicates.
- **Audit:** the audit log is append-only and hash-chained per institution (`prev_hash → sha256_hash`), so tampering is detectable.
- **Sessions:** Supabase Auth tokens refresh automatically. An expired or revoked session returns the user to Login.
  With *Remember me* off, the session is held in session storage. In Supabase mode, no institution records are stored on the device.

### Workflow states

`SUBMITTED → UNDER_SCRUTINY → (DEFICIENCIES_NOTED ⇄ UNDER_SCRUTINY) → SCRUTINY_CLEARED → APPROVED`, with `REJECTED` possible from scrutiny.
FDR renewal, replacement and lien release are **requests** (`PENDING → APPROVED/REJECTED`). The deposit changes only after an
AICTE admin approves (`decide_fdr_request`) and, for a new deposit, after the bank endorses the lien (`bank_endorse_lien`).

### Server functions (RPC)

| Institution app | Staff (admin portal or SQL) |
|---|---|
| `get_portal_state`, `submit_application` (dry-run validation or submit), `save_draft`, `delete_draft`, `submit_compliance_response`, `submit_fdr`, `request_fdr_renewal`, `request_lien_release`, `mark_notifications_read`, `raise_ticket`, `update_institution_profile`, `update_contact_details`, `log_client_event` | `review_start`, `review_request_clarification`, `review_record_decision`, `bank_endorse_lien`, `decide_fdr_request`, `admin_link_user`, `generate_expiry_reminders` |

---

## 4. App features

- **Onboarding:**
  - three swipeable slides with Skip, Next, and Get Started on the last slide
  - a slideshow of the **AICTE New Delhi and Mumbai** office photos, gliding in one after another left to right in a loop (it stays still if the phone's reduced-motion setting is on)
  - Privacy Policy, Help & Support and Terms links
  - completion is remembered, so later launches open Login directly (Login → *Introduction* replays it)
  - image-failure fallbacks
- **Login and registration:**
  - email and password, Remember me, Sign in with OTP, Government SSO and password reset
  - self-registration that creates a pending account
  - role check: AICTE, reviewer and bank accounts are refused here
- **Dashboard:** live counts, quick actions, alerts, total FDR corpus under joint lien, recent activity.
- **New application wizard:**
  - Institution → Program → FDR → Documents, with live checks against AICTE norms
  - real uploads with progress, SHA-256 and page count
  - server validation, review, e-sign
  - submit with a server-confirmed reference number and a downloadable acknowledgement
- **My Applications:**
  - filters, search and drafts (saved on the server)
  - a status timeline, findings, documents opened through secure links
  - the official deficiency notice (print or PDF), and a compliance response that creates a new version
- **FDR:** register, new FDR with evidence, renewal or extension, replacement or bank change, and lien-release requests, with pending states shown.
- **Alerts:** notifications that refresh live from the server, with Inspect links and mark one or all as read.
- **Profile:**
  - editable institution details (name and PID are locked), contact and nodal officer, change password
  - Compliance & Verification (rule matrix and simulated issuing-authority checks)
  - activity log, grievance tickets, CSV reports (FDR register, applications, activity), Help, About, Logout
- **Across the app:**
  - loading spinners on buttons, protection against double taps
  - an offline banner
  - field-level server errors, retry flows and accessible labels

### Simulated, by design (as in the web prototype)
- Aadhaar e-Sign and DSC token signing, until an eSign Service Provider (ESP) is integrated
- the issuing-authority checks (DTE, University, Fire, NBA, bank CBS)
- AI document summaries in **demo mode**, and in Supabase mode until the `analyze-document` function is deployed with an
  API key. After that, documents are read by Claude.

These are clearly labelled in the app. AICTE Admin Portal screens are outside this app; its server functions are included.

---

## 5. Tests

```bash
npm install                  # dev tools only: PGlite, supabase-js, puppeteer-core (uses your installed Edge)
npm run test:db              # 59 checks — runs all migrations + seed in embedded Postgres under RLS (incl. Google sign-in approval)
npm run test:ai              # 17 checks — AI document reader with a fake Claude client (no cost)
npm run serve:demo           # (terminal 1) serves the app in demo mode (empty keys) for the browser tests, then:
npm run test:e2e:demo        # full institution walkthrough in demo mode
npm run test:e2e:onboarding  # layout at 320–430 px widths, slideshow motion, skip/next, legal links, fallbacks
npm run mock:supabase        # (terminal 2) local Supabase stand-in running the real SQL — TEST ONLY
npm run test:e2e:supabase    # app + supabase-js against that stand-in: auth, RLS, uploads, AI reading, validation, idempotency, workflow, expiry
node tests/e2e/hindi.e2e.cjs # Hindi coverage report + layout   (AI_DOWN=1 on the mock and the supabase test checks the AI-outage fallback)
```
Set `EDGE_PATH` if Microsoft Edge is installed elsewhere. Screenshots are written to `tests/output/`.

## 6. Files

| Path | Contents |
|---|---|
| `index.html`, `styles.css` | App shell and mobile design system |
| `config.js` | **Your Supabase URL and anon key go here** |
| `backend.js` | Backend layer: Supabase (auth, RPC, storage, realtime) or the on-device demo store |
| `app.js` | Screens, router, rule engine (client preview), forms and flows |
| `data.js` | Demo dataset (from the web prototype) |
| `i18n.js` | English / हिन्दी interface |
| `supabase/functions/analyze-document/` | Edge Function: Claude document reading + cross-checks (`extract.ts` holds the logic and its unit test) |
| `android/`, `capacitor.config.json`, `scripts/build-www.mjs`, `dist/` | Android app project and the built APK |
| `supabase/migrations/…sql` | Schema, RLS, functions, storage policies |
| `supabase/seed.sql` | Demo data, generated by `npm run seed:generate` |
| `supabase/tests/`, `tests/` | Database and browser test suites, plus the local Supabase stand-in |
| `sw.js`, `manifest.webmanifest`, icons, `delhi.webp`, `mumbai.webp`, `emblem.png` | PWA and assets |

The Android app is built with Capacitor 6 (`android/`). See *Android app (APK)* above.
