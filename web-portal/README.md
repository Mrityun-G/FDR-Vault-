# AICTE Staff Portal (web)

The website for **AICTE scrutiny officers, AICTE administrators and bank officials**. Institutions do not sign in here:
they submit applications, documents and FDRs in the **mobile app** (the repository root). Both use the same Supabase
project, so an upload on the phone appears here immediately, and a decision made here shows up in the app.

| Role | What they do here |
|---|---|
| Scrutiny officer (`REVIEWER`) | Review applications and uploaded documents, override a rule finding with a reason, issue deficiency notices, recommend approval or rejection |
| Administrator (`ADMIN`) | Everything a reviewer does, plus final approval (EoA), decisions on FDR renewal / replacement / lien-release requests, inviting staff and approving institution emails |
| Bank official (`BANK_OFFICIAL`) | See only the FDRs held with their bank and endorse the AICTE joint lien with the CBS reference |

Every change goes through an audited server function (see `../supabase/migrations/`), and row-level security decides
what each role can read.

## Three addresses

| Who | Address | Who can sign in |
|---|---|---|
| Institutions | the mobile app (repository root), e.g. `https://fdr-vault.vercel.app` | Institution accounts |
| Officers | `https://<staff-site>/officer` | Scrutiny officers (`REVIEWER`) and bank officials (`BANK_OFFICIAL`) |
| Administrators | `https://<staff-site>/admin` | Administrators (`ADMIN`) |

The site root (`https://<staff-site>/`) shows a chooser with all three. Each portal keeps its own sign-in session and
refuses accounts that belong to the other one, with a link to the right address. To give the Officer portal and the Admin
console their own domains instead, deploy this folder twice and set `VITE_PORTAL=officer` or `VITE_PORTAL=admin`.

## Run locally

```bash
npm install
npm run dev            # http://localhost:5180/officer and http://localhost:5180/admin (live Supabase project)
```

To point at another project, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (for example in `.env.local`).

## Deploy (Vercel)

Import the GitHub repository as a **second** Vercel project and set **Root Directory = `web-portal`**. The settings come from
[`vercel.json`](vercel.json). Then add the site's address in Supabase under Authentication → URL Configuration → Redirect URLs
(`https://<your-site>/**`), and in Google Cloud under the OAuth client's Authorized JavaScript origins.

## Tests

From the repository root, with the local Supabase stand-in:

```bash
npm run mock:supabase        # terminal 1
npm run web:test-server      # terminal 2 (this portal on :3100, pointed at the stand-in)
npm run test:e2e:staff       # sign-in rules, scrutiny, deficiency notice, override, final approval, FDR request, invites, bank lien
```
