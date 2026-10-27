
# AICTE Institution Portal — Mobile App (PWA) + Node.js / PostgreSQL backend
Government Application
This is the mobile version of the **Institution (Applicant) portal** of the
[AICTE Intelligent Regulatory Validation Platform](https://aicte-intelligent-regulatory-validation-platform.ai.studio/).
It is an installable Progressive Web App with two run modes:

| Mode | When | Data |
|---|---|---|
| **Server** | `config.js` has `API_URL` (the project's API server in [`server/`](server/)) | PostgreSQL with row-level security, server-side workflow functions, private document storage, live updates |
| **Demo** | `API_URL` is empty (the default) | Kept on the device and seeded from the web prototype. The same screens and rules run locally, so you can evaluate the app without a server |

---

## 0. Architecture & deployment

| Piece | What | Where |
|---|---|---|
| Institution app (mobile / PWA): institutions submit applications, documents and FDRs | Static files, built with `node scripts/build-www.mjs` into `www/` ([`vercel.json`](vercel.json)) | **Vercel** |
| Staff site: **Officer portal** at `/officer` (scrutiny officers, bank officials) and **Admin console** at `/admin` (administrators) | React + Vite, second project with Root Directory `web-portal` ([web-portal/README.md](web-portal/README.md)) | **Vercel** |
| **API server** ([`server/`](server/)): auth, workflow functions, document storage, live updates, AI reading, daily reminders | Node.js + Express, connects to PostgreSQL with `pg` | **Render** web service ([`render.yaml`](render.yaml)) or any Node 22.18+ host |
| **Database** | Standalone PostgreSQL 14+ (17 recommended): schema, row-level security, workflow functions, documents | Render PostgreSQL ([`render.yaml`](render.yaml)) or any PostgreSQL |

Browsers never connect to PostgreSQL. Both front ends talk only to the API server, which holds every secret
(database password, token signing key, Google client secret, SMTP and Anthropic keys) in environment variables
([`.env.example`](.env.example)). The front ends contain no keys.

**Live links** (front ends)

| Who | Link | Sign-in |
|---|---|---|
| Institution (user) | https://fdr-vault.vercel.app | Institution accounts (Google or email/password) |
| Officer portal | https://fdr-vault-sbf7.vercel.app/officer | Scrutiny officers (`REVIEWER`) and bank officials (`BANK_OFFICIAL`) |
| Admin console | https://fdr-vault-sbf7.vercel.app/admin | Administrators (`ADMIN`) |

### Deploy the backend (Render, ≈10 minutes)
1. Render → **New → Blueprint** → this repository. It creates the `fdr-vault-api` web service and the `fdr-vault-db`
   PostgreSQL database from [`render.yaml`](render.yaml), and generates `JWT_SECRET`.
2. In the service's **Environment** tab set `PUBLIC_URL` to the service address (e.g. `https://fdr-vault-api.onrender.com`),
   and optionally the Google, SMTP and Anthropic values (see below). `ALLOWED_ORIGINS` already lists both Vercel sites and the Android app.
3. Deploy. On start the service runs `node server/migrate.mjs --seed --reset-test-data`: it applies the schema and, on an
   **empty** database only, creates the 4 demo accounts and DITS Delhi (with no applications or FDRs). It never deletes data
   from a database that already has some.
4. Point the front ends at it and redeploy them on Vercel:
   - institution app project: environment variable `AICTE_API_URL` = the service address (the build writes it into `config.js`)
   - staff portal project: `VITE_API_URL` = the service address
5. Optional: for automatic migrations from GitHub, add the secret `DATABASE_URL` (the database's external connection string) —
   see [`.github/workflows/db-migrate.yml`](.github/workflows/db-migrate.yml). To change the database, add a **new** file in
   `supabase/migrations/`; never edit an applied one.

### Run the backend locally
```bash
cp .env.example .env         # set DATABASE_URL (a local PostgreSQL) and JWT_SECRET; leave ALLOWED_ORIGINS empty for localhost
npm install
npm run db:migrate -- --seed --reset-test-data   # schema + the 4 demo accounts (use only --seed for the full sample dataset)
npm run server               # API on http://localhost:8787
```
Then set `API_URL: 'http://localhost:8787'` in [`config.js`](config.js) and run `npm run serve` (the app on :8765), and/or
`cd web-portal && npm run dev` (staff portal on :5180, uses `http://localhost:8787` by default).

The database role in `DATABASE_URL` must own the database and be allowed to create roles once: the first migration creates the
`anon`, `authenticated` and `service_role` roles that row-level security uses, and the `pgcrypto` extension.

### Google sign-in
1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), open the OAuth client (*Web application*).
   - **Authorized redirect URI:** `<PUBLIC_URL>/auth/callback`, e.g. `https://fdr-vault-api.onrender.com/auth/callback`
     (and `http://localhost:8787/auth/callback` for local testing)
   - While the OAuth consent screen is in *Testing*, add the Google accounts that should sign in as test users.
2. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the API server.

A first Google sign-in asks for the registration details once (institution, or staff details on the staff portal); one Google
account can be used on every portal. A Google account whose email already has an account signs in to that account.

### Email (confirmation links, sign-in codes, password reset)
Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `MAIL_FROM` (e.g. Gmail with an app password). Then new
accounts confirm their email before signing in. Without SMTP, emails are written to the server log instead and new accounts
are confirmed at sign-up.

### Demo accounts (for evaluators)
The login screens show one-click demo buttons. All four accounts share the password `Sih@2026Demo`:

| Account | Signs in at | Role |
|---|---|---|
| `sih_demo.institution@example.com` | Institution app | INSTITUTION, DITS Delhi (`1-10928371`) |
| `sih_demo.officer@example.com` | `/officer` | REVIEWER |
| `sih_demo.bank@example.com` | `/officer` | BANK_OFFICIAL, State Bank of India |
| `sih_demo.admin@example.com` | `/admin` | ADMIN |

`npm run db:migrate -- --seed` creates them on an empty database (the Render start command does this automatically).
The institution app blocks password changes on the demo account so one evaluator cannot lock out the rest.

### Staff accounts (website)
Staff sign in to the staff portal with Google, or register with an email and password. To give someone a staff role,
approve their email (with `psql` against the database). If they have no account yet, it activates the first time they sign in:
```sql
select set_config('aicte.service', 'on', false);   -- run as the server, not as a signed-in user
select public.admin_invite_staff('officer@gmail.com', 'ADMIN', 'Full Name', 'Administrator');                 -- or 'REVIEWER'
select public.admin_invite_staff('bank.officer@gmail.com', 'BANK_OFFICIAL', 'Full Name', 'Branch Manager', 'State Bank of India');
```
After that, an administrator can invite more people from **User Management** on the website.

Google refuses OAuth inside app WebViews, so in the **Android app** the Google button asks the user to sign in with email and password or an OTP instead. Google sign-in works on the web and installed-PWA versions.

### AI document reading (optional)
The API server's `analyze-document` function reads each uploaded document with Claude (`claude-opus-5-5`) and
cross-checks it against the form: FDR number, amount, dates, bank, lien holder, institution name and faculty counts.
Set `ANTHROPIC_API_KEY` on the server to turn it on. The result is **advisory**; the statutory rules still run in PostgreSQL.
Server-side refusal fallback is enabled (`fallbacks: "default"`). Without a key the app says so and shows the on-device
preview instead; submission is never blocked.

### AI Regulatory Assistant (institution app)
Dashboard → **AI Regulatory Assistant** guides an institution through one FDR request: a new FDR, renewal, replacement,
lien release, a correction of FDR details, or a reply to a deficiency notice. It asks only what it needs (profile data is
reused), shows where the request goes in this portal, builds a document checklist with the **source** of each item, checks
every upload (GREEN / AMBER / RED, with how to fix each issue), fills the form from the documents with the page and line
each value came from, and submits through the portal's existing functions only after the user confirms. Requests the portal
cannot submit are packaged as **Ready for submission** and never marked submitted.

- Rules: [`assistant-rules.js`](assistant-rules.js) (shared by the server and demo mode). API: [`server/assistant.mjs`](server/assistant.mjs) (`/assistant/*`).
- Sources and requirements live in the database and are maintained in the staff portal (Admin → **Regulatory Sources**).
  Only *Verified* and *Portal rule* requirements can block a submission; *Unverified* ones are shown for human confirmation.
  The default catalog marks the AICTE handbook as **Unverified**: an administrator must add the section and excerpt to verify it.
- Document reading uses the same `ANTHROPIC_API_KEY` as above. Without it, uploads are AMBER (manual review) and the user types
  the values; nothing is guessed. Free-text requests are classified by keywords when AI is off.
- No new environment variables. The migration `20261027000000_regulatory_assistant.sql` is applied by `npm run db:migrate`
  (and by the Render start command on the next deploy).

### Moving from the previous Supabase project
The schema files in `supabase/migrations/` are unchanged and run as-is on standalone PostgreSQL, between
[`server/db/000_platform.sql`](server/db/000_platform.sql) (roles, `auth.users` + `auth.uid()`, document storage tables) and
[`server/db/900_postgres_compat.sql`](server/db/900_postgres_compat.sql) (server-job recognition and change notifications).
The `supabase/` folder name is kept for history only; nothing in it needs Supabase. Government SSO (SAML through Supabase) is
not available on the standalone server and stays hidden behind `SSO_DOMAIN: ''`, as it was before.

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
Set `AICTE_API_URL` (or `API_URL` in `config.js`) before building so the APK talks to your API server; the server's
`ALLOWED_ORIGINS` must include `https://localhost` (the Android app's origin).
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
- **The database decides permissions.** The API server runs each request in its own transaction as the PostgreSQL role
  `authenticated` with the caller's user id set (`auth.uid()`), so the schema's grants and row-level security policies apply
  to every read and write. Only functions granted to signed-in users can be called (read from the database catalog);
  all values are passed as query parameters.
- **Isolation between institutions (RLS):** an institution can read only its own rows; a URL or ID for another
  institution returns nothing. Staff-only notes live in a separate table that institutions cannot read.
- **Status transitions are enforced in SQL.** An institution cannot approve anything. Reviewers can clear or reject an
  application, and only `ADMIN` gives final approval. Decisions require a written rationale.
- **Documents:** they are stored privately in PostgreSQL under `<institution_id>/…`. Upload and read are allowed only in your
  own folder (storage RLS), with no update or delete (evidence is immutable). Files are viewed through short-lived signed links.
  Each file's SHA-256 is computed on the device, and the server checks it across **all** institutions to detect reused
  documents. The client cannot see other institutions' files, so only the server can do this check.
- **Validation:** deterministic rules (checklist, certificate expiry, duplicate hash, faculty cadre and SFR, built-up area,
  FDR corpus, tenure and lien) run on the server, versioned in `rule_config`. On-device AI or OCR output is stored as advisory only.
  If server validation is unavailable, the app blocks submission; it never treats a failed check as a pass.
- **Idempotent submission:** each application carries an idempotency key, so retrying after a timeout cannot create duplicates.
- **Audit:** the audit log is append-only and hash-chained per institution (`prev_hash → sha256_hash`), so tampering is detectable.
- **Sessions:** passwords are bcrypt-hashed; access tokens are short-lived (1 h) and refresh automatically with rotating
  refresh tokens (only their hashes are stored). Logout or a revoked session works immediately and returns the user to Login.
  Sign-in, OTP and email endpoints are rate-limited; email links and Google sign-in only return to the configured front ends.
  With *Remember me* off, the session is held in session storage. In server mode, no institution records are stored on the device.

### Workflow states

`SUBMITTED → UNDER_SCRUTINY → (DEFICIENCIES_NOTED ⇄ UNDER_SCRUTINY) → SCRUTINY_CLEARED → APPROVED`, with `REJECTED` possible from scrutiny.
FDR renewal, replacement and lien release are **requests** (`PENDING → APPROVED/REJECTED`). The deposit changes only after an
AICTE admin approves (`decide_fdr_request`) and, for a new deposit, after the bank endorses the lien (`bank_endorse_lien`).

### Server functions (RPC)

| Institution app | Staff (admin portal or SQL) |
|---|---|
| `get_portal_state`, `submit_application` (dry-run validation or submit), `save_draft`, `delete_draft`, `submit_compliance_response`, `submit_fdr`, `request_fdr_renewal`, `request_lien_release`, `mark_notifications_read`, `raise_ticket`, `update_institution_profile`, `update_contact_details`, `log_client_event` | `review_start`, `review_request_clarification`, `review_record_decision`, `bank_endorse_lien`, `decide_fdr_request`, `admin_link_user`, `generate_expiry_reminders` |

They are called through the API server at `POST /rpc/<name>`; the daily FDR expiry reminders run on the server at 01:30 UTC.

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
- AI document summaries in **demo mode**, and in server mode until `ANTHROPIC_API_KEY` is set on the API server.
  After that, documents are read by Claude.

These are clearly labelled in the app. AICTE Admin Portal screens are outside this app; its server functions are included.

---

## 5. Tests

```bash
npm install                  # includes dev tools: PGlite, embedded-postgres (a real PostgreSQL 17 for tests), puppeteer-core (uses your installed Edge)
npm run test:db              # 96 checks — all migrations + seed in embedded Postgres under RLS (incl. Google sign-in, staff portal roles)
npm run test:server          # 51 checks — real PostgreSQL + the API over HTTP: auth (password, confirmation, OTP, reset, refresh, logout, Google),
                             #   RPC permissions, RLS, storage, live updates, AI function, scheduled job
npm run test:assistant       # 59 checks — Regulatory Assistant: new FDR end to end, missing / conflicting documents, unverified
                             #   requirements, other institutions, no submission channel, renewal, compliance reply
npm run test:ai              # 17 checks — AI document reader with a fake Claude client (no cost)
npm run serve:demo           # (terminal 1) serves the app in demo mode (empty API_URL) for the browser tests, then:
npm run test:e2e:demo        # full institution walkthrough in demo mode
npm run test:e2e:assistant   # assistant in the browser (demo mode): chat, checklist, uploads, form, review, submit
npm run test:e2e:onboarding  # layout at 320–430 px widths, slideshow motion, skip/next, legal links, fallbacks
npm run e2e:server           # (terminal 2) real PostgreSQL + the real API server + the app on :8790 — TEST ONLY
npm run test:e2e:server      # app against that server: auth, RLS, uploads, AI reading, validation, idempotency, workflow, expiry
npm run web:test-server      # (terminal 3) staff portal on :3100 against that server, then (on a fresh e2e:server):
npm run test:e2e:staff       # staff portal: sign-in rules, scrutiny, deficiency notice, override, final approval, FDR request, invites, bank lien
node tests/e2e/hindi.e2e.cjs # Hindi coverage report + layout   (AI_DOWN=1 on e2e:server and the server test checks the AI-outage fallback)
```
Set `EDGE_PATH` if Microsoft Edge is installed elsewhere, and `BLOCK_WEBFONTS=1` if Google Fonts is unreachable from your network (the browser tests then skip web fonts). Screenshots are written to `tests/output/`.

## 6. Files

| Path | Contents |
|---|---|
| `index.html`, `styles.css` | App shell and mobile design system |
| `config.js` | **The API server address (`API_URL`) goes here** (or set `AICTE_API_URL` at build time) |
| `backend.js` | Backend layer: the API server (auth, RPC, storage, live updates) or the on-device demo store |
| `api-client.js` | Browser client for the API server (shared with the staff portal as `web-portal/src/lib/api-client.js`; `npm run sync:api-client`) |
| `app.js` | Screens, router, rule engine (client preview), forms and flows |
| `assistant.js`, `assistant-rules.js` | AI Regulatory Assistant screens and its shared rules (checklist, validation, form mapping) |
| `data.js` | Demo dataset (from the web prototype) |
| `i18n.js` | English / हिन्दी interface |
| `server/` | API server: `index.mjs` (start), `app.mjs`, `auth.mjs`, `api.mjs`, `assistant.mjs`, `db.mjs`, `migrate.mjs`, `db/*.sql` (platform layer) |
| `.env.example`, `render.yaml` | Server configuration template and Render deployment |
| `supabase/functions/analyze-document/extract.ts` | Claude document reading + cross-checks, used by the API server (with its unit test) |
| `android/`, `capacitor.config.json`, `scripts/build-www.mjs`, `dist/` | Android app project and the built APK |
| `supabase/migrations/…sql` | Schema, RLS, functions, storage policies (unchanged; run by `server/migrate.mjs`) |
| `supabase/seed.sql` | Demo data, generated by `npm run seed:generate` |
| `supabase/tests/`, `tests/` | Database, API server and browser test suites, plus the integration-test server |
| `sw.js`, `manifest.webmanifest`, icons, `delhi.webp`, `mumbai.webp`, `emblem.png` | PWA and assets |

The Android app is built with Capacitor 6 (`android/`). See *Android app (APK)* above.
