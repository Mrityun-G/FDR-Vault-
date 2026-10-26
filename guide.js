/* Evaluator Guide — a floating help chat that explains the whole AI-IRVP prototype to SIH evaluators.
   Questions go to the evaluator-guide Edge Function, where Claude looks up the real implementation in the source.
   If that service is unreachable, a built-in knowledge base answers instead. Also offers a guided demo tour and
   "Take me there" buttons. Loaded by the institution app (index.html) and the staff portal (web-portal/public/guide.js —
   keep that copy in sync with `node scripts/sync-guide.mjs`). */
(() => {
  if (window.__aicteGuide) return;
  window.__aicteGuide = true;

  const SITE = /^\/(officer|admin)\b/.test(location.pathname) || document.getElementById('root') ? 'staff' : 'inst';
  const STAFF_PORTAL = /^\/admin\b/.test(location.pathname) ? 'admin' : 'officer';
  // On localhost (npm run serve on :8765, staff portal npm run dev on :5180) the tour links stay local.
  const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const LINKS = LOCAL ? {
    inst: 'http://localhost:8765',
    officer: 'http://localhost:5180/officer',
    admin: 'http://localhost:5180/admin',
  } : {
    inst: 'https://fdr-vault.vercel.app',
    officer: 'https://fdr-vault-sbf7.vercel.app/officer',
    admin: 'https://fdr-vault-sbf7.vercel.app/admin',
  };
  const PW = 'Sih@2026Demo';
  // The anon key is public by design (same as config.js); the function rate-limits callers.
  const CFG = window.AICTE_CONFIG || {};
  const SUPABASE_URL = CFG.SUPABASE_URL || 'https://csnindvgpfphcstjcsag.supabase.co';
  const ANON_KEY = CFG.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzbmluZHZncGZwaGNzdGpjc2FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2ODY1NzMsImV4cCI6MjEwODI2MjU3M30.QxLJF4SnD6k5gGt6aXYE3LF4Fll2m1T104HcT3DAsW8';
  const AI_URL = SUPABASE_URL + '/functions/v1/evaluator-guide';

  // Each entry: k = keywords (any form), t = title, a = answer (lines; **bold**, `code`), go = where "Take me there" leads,
  // next = follow-up suggestion ids.
  const KB = [
    { id: 'overview', k: 'what is this overview prototype idea project problem solution about explain summary platform irvp purpose',
      t: 'What this prototype is',
      a: ['**AICTE Intelligent Regulatory Validation Platform (AI-IRVP)** digitises how AICTE approves technical institutions and manages their **Security Deposit**, kept as a Fixed Deposit Receipt (**FDR**) under AICTE joint lien.',
        'It has **three connected portals** on one secure database (Supabase / Postgres):',
        '1. **Institution app** (mobile + web): colleges apply, upload documents and manage their FDR.',
        '2. **Officer portal**: AICTE scrutiny officers review applications; bank officials confirm the FDR lien.',
        '3. **Admin console**: AICTE administrators give final approval and decide FDR requests.',
        'Every document is checked automatically against **7 AICTE rules** (APH 2024-27) before a human ever looks at it, so scrutiny is faster and fraud is caught early.'],
      next: ['tour', 'portals', 'rules', 'innovation'] },
    { id: 'tour', k: 'tour demo start begin how to evaluate walkthrough steps judge evaluator marking where start first guide me teach',
      t: 'Start the 5-minute demo tour', tour: true },
    { id: 'portals', k: 'portals three sites links urls roles who uses which portal website app',
      t: 'The three portals and who uses them',
      a: ['• **Institution app** — ' + LINKS.inst + ' — the college (applicant).',
        '• **Officer portal** — ' + LINKS.officer + ' — AICTE scrutiny officer (REVIEWER) and bank official (BANK_OFFICIAL).',
        '• **Admin console** — ' + LINKS.admin + ' — AICTE administrator (ADMIN).',
        'All three share one database. Each portal admits only its own roles, and the **server** enforces what each role may do (row-level security), not just the screen.'],
      next: ['login', 'tour', 'security'] },
    { id: 'login', k: 'login sign in password account credentials demo user email cannot access google otp register',
      t: 'How to sign in (demo accounts)',
      a: ['Every login screen has **one-click demo buttons**. Password for all: `' + PW + '`',
        '• Institution: `sih_demo.institution@example.com` (DITS Delhi)',
        '• Scrutiny officer: `sih_demo.officer@example.com` (Officer portal)',
        '• Bank official: `sih_demo.bank@example.com` (Officer portal, SBI)',
        '• Administrator: `sih_demo.admin@example.com` (Admin console)',
        'You can also use **Continue with Google** — any Google account can register and is active at once.'],
      next: ['tour', 'portals'] },
    { id: 'apply', k: 'new application apply submit wizard form extension approval create course program intake steps',
      t: 'Submitting a new application (institution)',
      a: ['Home → **New Application** → pick the type (e.g. Extension of Approval, Increase in Intake). The wizard has 4 steps:',
        '1. **Institution** – details and faculty / student numbers',
        '2. **Program** – courses and intake',
        '3. **FDR** – security deposit details (amount, bank, dates)',
        '4. **Documents** – upload the 7 mandatory certificates',
        'Each step shows **live checks** against AICTE norms. Then **AI validation** runs, you review, e-sign, and submit. You get a server-confirmed reference number and a downloadable acknowledgement.'],
      go: { inst: 'apptype' }, next: ['rules', 'ai', 'upload'] },
    { id: 'rules', k: 'rules norms checks validation rule engine seven 7 aph handbook compliance criteria sfr faculty ratio area corpus expiry duplicate',
      t: 'The 7 automatic AICTE rule checks',
      a: ['Every submission is validated on the **server** against these rules (APH 2024-25 to 2026-27):',
        '1. **Checklist** – all 7 mandatory documents present and readable',
        '2. **Certificate expiry** – statutory certificates valid ≥ 6 months',
        '3. **PID / entity match** – names in documents match the institution’s PID',
        '4. **Duplicate SHA-256** – the same file reused by another institution is flagged',
        '5. **Faculty cadre** – SFR ≤ 1:20 and Professor : Associate : Assistant = 1:2:6',
        '6. **Built-up area** – 5.5 sq.m per student',
        '7. **FDR corpus** – deposit ≥ required corpus, 10-year lock-in, joint lien with AICTE',
        'Each finding is **Passed / Warning / Critical**. Critical findings block approval until fixed.'],
      go: { inst: 'compliance' }, next: ['duplicate', 'ai', 'fdr'] },
    { id: 'ai', k: 'ai artificial intelligence ocr claude extract read document analysis llm machine learning smart',
      t: 'How the AI document reading works',
      a: ['When a document is uploaded, an AI model (Claude, in a Supabase Edge Function) **reads it** and pulls out key fields — FDR number, amount, dates, bank, lien holder, institution name, faculty counts — and **cross-checks** them with what the form says.',
        'Mismatches (e.g. the FDR amount on paper differs from the form) are shown as anomalies with the exact source line.',
        'Important: AI output is **advisory only**. The legal decision always comes from the deterministic rules in Postgres plus a human officer — so the AI can never approve anything by itself.',
        'If the AI service is unavailable the app says so and shows an on-device preview; submission is never blocked.'],
      next: ['rules', 'duplicate', 'security'] },
    { id: 'duplicate', k: 'duplicate fraud hash sha sha-256 fingerprint forgery copy same document reused tamper',
      t: 'Fraud detection: duplicate documents',
      a: ['Every uploaded file gets a **SHA-256 fingerprint** on the device. The server compares it against **every institution’s** documents.',
        'If two colleges submit the byte-for-byte same certificate, rule **RULE-DUPLICATE-HASH-04** raises a Critical finding naming the other application.',
        'Only the server can do this check, because institutions can never see each other’s files.'],
      next: ['rules', 'audit', 'security'] },
    { id: 'upload', k: 'upload documents file pdf certificate attach evidence storage which documents mandatory',
      t: 'Uploading documents',
      a: ['In the wizard’s **Documents** step, upload each mandatory certificate. You see upload progress, page count and the SHA-256 fingerprint.',
        'Files go to a **private storage bucket** in the institution’s own folder. They cannot be edited or deleted afterwards (evidence is immutable) and are opened only through short-lived secure links.'],
      next: ['duplicate', 'ai'] },
    { id: 'fdr', k: 'fdr fixed deposit security deposit corpus lien bank joint maturity renewal amount money',
      t: 'Security Deposit (FDR) lifecycle',
      a: ['An institution keeps its Security Deposit as an **FDR under joint lien** with the AICTE Regional Officer, for **10 years**.',
        'In the institution app → **FDR** tab you can: register a new FDR with evidence, **renew / extend**, **replace / change bank**, or request **lien release**.',
        'These are **requests**: they stay PENDING until an AICTE admin decides, and a new deposit counts only after the **bank official endorses the lien** in CBS (core banking).',
        'Reminders go out automatically 180, 60 and 30 days before maturity.'],
      go: { inst: 'fdrs', staff: 'fdr_records' }, next: ['bank', 'renewal', 'release'] },
    { id: 'renewal', k: 'renewal renew extend extension replace replacement change bank maturing expiring',
      t: 'FDR renewal and replacement',
      a: ['Institution: **FDR** tab → open a deposit → **Renew / Replace**. This creates a request.',
        'Officer / Admin: sidebar → **Renewals & Replacements** shows pending requests and deposits maturing within 180 days with no renewal filed. The admin approves or rejects with a written reason.'],
      go: { inst: 'fdrs', staff: 'renewals' }, next: ['fdr', 'release'] },
    { id: 'release', k: 'release refund lien release discharge return money close',
      t: 'Lien release / refund',
      a: ['Institution: **FDR** tab → open a matured deposit → **Request lien release**.',
        'Admin: sidebar → **Release / Refund Requests** → approve or reject with a reason. Approved releases discharge the lien.'],
      go: { inst: 'fdrs', staff: 'release_requests' }, next: ['fdr'] },
    { id: 'bank', k: 'bank official sbi cbs endorse endorsement confirm lien verification bank portal',
      t: 'What the bank official does',
      a: ['Sign in to the **Officer portal** with `sih_demo.bank@example.com` / `' + PW + '`.',
        'The bank official sees only FDRs held at their bank. They open a pending deposit, enter the **CBS lien reference** and click **Endorse lien** — this confirms in core banking that AICTE holds a lien on the deposit.',
        'Only after this does the deposit count as valid security.'],
      go: { staff: 'fdr_records' }, next: ['fdr', 'officer'] },
    { id: 'officer', k: 'officer reviewer scrutiny review verification center deficiency clarification decision check application staff',
      t: 'Scrutiny officer workflow',
      a: ['Sign in to the **Officer portal** with `sih_demo.officer@example.com` / `' + PW + '`.',
        '1. **Dashboard** shows the pipeline and what needs attention.',
        '2. **Verification Center** → open a submitted application → **Start review**.',
        '3. See the 7 rule findings, AI extraction and documents side by side.',
        '4. Either **Request clarification** (issues an official **Deficiency Notice** to the college) or **Clear / Reject** with a written rationale.',
        'An officer can **override** a rule finding but must give a reason — it is recorded in the audit trail.'],
      go: { staff: 'verification_center' }, next: ['deficiency', 'admin', 'audit'] },
    { id: 'deficiency', k: 'deficiency notice clarification respond response compliance reply resubmit version',
      t: 'Deficiency notice and compliance response',
      a: ['When an officer requests clarification, the institution gets an alert and an **official Deficiency Notice** (printable / PDF).',
        'In the institution app: **My Applications** → the application → **Respond**. The response creates a **new version** of the application and it goes back to scrutiny.',
        'Status flow: SUBMITTED → UNDER_SCRUTINY → DEFICIENCIES_NOTED ⇄ UNDER_SCRUTINY → SCRUTINY_CLEARED → APPROVED (or REJECTED).'],
      go: { inst: 'apps' }, next: ['status', 'officer'] },
    { id: 'admin', k: 'admin administrator approve final approval console user management invite manage staff eoa letter',
      t: 'Administrator workflow',
      a: ['Sign in to the **Admin console** with `sih_demo.admin@example.com` / `' + PW + '`.',
        '• Gives **final approval** to applications the officer has cleared (only ADMIN can approve).',
        '• Decides FDR renewal, replacement and release requests.',
        '• **User Management**: invite officers, bank officials and other admins.',
        '• Sees Reports, Audit Trail and the rule matrix in Settings.'],
      go: { staff: 'dashboard' }, next: ['status', 'audit', 'reports'] },
    { id: 'status', k: 'status track timeline stage workflow state pending approved rejected where is my application progress',
      t: 'Tracking application status',
      a: ['Institution app → **My Applications** shows every application with filters and search. Open one to see a **timeline** of every step, the findings and the documents.',
        'Updates arrive **live** (realtime) — when an officer acts, the institution sees it without refreshing.'],
      go: { inst: 'apps' }, next: ['deficiency', 'alerts'] },
    { id: 'alerts', k: 'alerts notifications bell reminders message inbox',
      t: 'Alerts and reminders',
      a: ['The bell / **Alerts** tab lists notifications (deficiency raised, decision made, FDR maturing) with links to inspect them.',
        'A daily server job creates FDR expiry reminders automatically.'],
      go: { inst: 'alerts', staff: 'notifications' }, next: ['fdr'] },
    { id: 'audit', k: 'audit trail log history tamper hash chain accountability transparency who did what',
      t: 'Tamper-evident audit trail',
      a: ['Every action (submit, review, override, approval, lien endorsement) writes an **append-only audit event**.',
        'Events are **hash-chained** per institution (each record stores the previous record’s hash), so changing any past entry breaks the chain and is detectable.',
        'Staff can inspect it in the sidebar → **Audit Trail**.'],
      go: { staff: 'audit_trail', inst: 'activity' }, next: ['security'] },
    { id: 'security', k: 'security secure safe rls row level privacy data protection role permission hack attack server authoritative',
      t: 'How data is secured',
      a: ['• **Server is authoritative**: apps never write tables directly; every change goes through a checked server function.',
        '• **Row-level security**: an institution can only ever read its own rows.',
        '• **Role checks in SQL**: an institution cannot approve; only ADMIN gives final approval; decisions need a written reason.',
        '• **Private, immutable documents** with short-lived links.',
        '• **Idempotent submission**: a retry after a timeout cannot create duplicates.',
        '• **Hash-chained audit log**.'],
      next: ['audit', 'tech'] },
    { id: 'tech', k: 'tech stack technology built with architecture database backend frontend supabase postgres react vercel android',
      t: 'Technology used',
      a: ['• **Institution app**: HTML/CSS/JavaScript PWA (installable, works offline) + Android APK via Capacitor',
        '• **Staff portal**: React + TypeScript + Vite + Tailwind',
        '• **Backend**: Supabase — Postgres with row-level security, SQL workflow functions, private storage, realtime, scheduled jobs',
        '• **AI**: Claude in a Supabase Edge Function for document reading',
        '• **Hosting**: Vercel (auto-deploys from GitHub)',
        '• **Tests**: database tests on embedded Postgres + browser end-to-end tests'],
      next: ['security', 'innovation'] },
    { id: 'innovation', k: 'innovation unique novelty impact benefit why better usp feature highlight value advantage',
      t: 'What is new / impact',
      a: ['• **Rule-checked before human review** – 7 AICTE norms validated automatically, with handbook clause references.',
        '• **Cross-institution fraud detection** with SHA-256 fingerprints.',
        '• **AI that reads documents** and cross-checks them with the form (advisory, never decisive).',
        '• **Full FDR lifecycle** with the bank in the loop (CBS lien endorsement), not just paper records.',
        '• **Tamper-evident audit** and strict role separation.',
        '• **Mobile-first + Hindi**, installable, works on low bandwidth.'],
      next: ['tour', 'rules', 'ai'] },
    { id: 'hindi', k: 'hindi language translate english bilingual',
      t: 'Hindi / English',
      a: ['Tap **हिन्दी** at the top of the welcome or login screen (or Profile → Language). The whole interface switches; institution data and legal notice text stay as issued.'],
      next: ['mobile'] },
    { id: 'mobile', k: 'mobile android apk install pwa phone offline app download',
      t: 'Mobile app',
      a: ['The institution portal is a **Progressive Web App**: on a phone, open ' + LINKS.inst + ' and choose **Add to Home Screen**. It has an offline banner and caches the app shell.',
        'An **Android APK** build is also included in the project.'],
      next: ['hindi', 'tech'] },
    { id: 'reports', k: 'reports analytics csv export download statistics dashboard chart',
      t: 'Reports',
      a: ['Staff: sidebar → **Reports & Analytics** for pipeline and corpus statistics.',
        'Institution: Profile → **Reports** downloads CSVs of the FDR register, applications and activity.'],
      go: { staff: 'reports' }, next: ['audit'] },
    { id: 'simulated', k: 'simulated real fake mock aadhaar esign dsc limitation not real integration future',
      t: 'What is simulated in this prototype',
      a: ['Clearly labelled as simulated: **Aadhaar e-Sign / DSC** signing, and the **issuing-authority checks** (DTE, University, Fire, NBA, bank CBS gateways).',
        'Everything else — accounts, database, rules, uploads, workflow, audit — is real and running live.'],
      next: ['innovation'] },
  ];

  const TOUR = [
    { t: 'Step 1 · Sign in as the institution', a: ['Open the **Institution app**: ' + LINKS.inst, 'On the login screen tap **Login as Institution · DITS Delhi** (one click, no typing).'], open: LINKS.inst },
    { t: 'Step 2 · Look at the dashboard', a: ['You see live counts, quick actions, important alerts and the total **FDR corpus under joint lien**.', 'This is what a college principal sees every day.'], go: { inst: 'dashboard' } },
    { t: 'Step 3 · Submit an application', a: ['Tap **New Application** → choose a type → walk the 4 steps (Institution → Program → FDR → Documents).', 'Watch the **live checks** turn green/red as you type. Then run **AI validation**, review and submit.'], go: { inst: 'apptype' } },
    { t: 'Step 4 · See the rule findings', a: ['Open **My Applications** → any application. You see the timeline, the **7 rule findings** (Passed / Warning / Critical) and the documents.'], go: { inst: 'apps' } },
    { t: 'Step 5 · Review as the AICTE officer', a: ['Open the **Officer portal**: ' + LINKS.officer, 'Tap **Scrutiny Officer** (demo button) → **Verification Center** → open the application → **Start review** → request clarification or clear it.'], open: LINKS.officer },
    { t: 'Step 6 · Confirm the FDR as the bank', a: ['Sign out, then on the Officer portal tap **Bank Official (SBI)** → **FDR Records** → open a pending deposit → enter a CBS reference → **Endorse lien**.'], open: LINKS.officer },
    { t: 'Step 7 · Final approval as admin', a: ['Open the **Admin console**: ' + LINKS.admin, 'Tap **Administrator** → open the cleared application → **Approve** with a reason. Check the **Audit Trail** to see every step recorded.'], open: LINKS.admin },
    { t: 'Done!', a: ['You have seen the full journey: **apply → automatic rule + AI checks → officer scrutiny → bank lien → final approval → audit**.', 'Ask me anything else, e.g. “how is data secured?” or “what is new in this project?”'] },
  ];

  const STOP = new Set('a an the is are was be to of in on for and or how what why where when which who do does can i me my we you it this that with at by from please tell explain show about'.split(' '));
  const words = s => (s.toLowerCase().match(/[a-z0-9ऀ-ॿ-]+/g) || []).filter(w => !STOP.has(w));
  const stem = w => w.replace(/(ing|ed|es|s)$/, '');
  const INDEX = KB.map(e => ({ e, keys: new Set(words(e.k + ' ' + e.t).map(stem)), title: new Set(words(e.t).map(stem)) }));
  function match(q) {
    const ws = words(q).map(stem);
    if (!ws.length) return [];
    return INDEX.map(({ e, keys, title }) => {
      let s = 0;
      for (const w of ws) {
        if (keys.has(w)) s += title.has(w) ? 3 : 2;   // a word in the topic title is the strongest signal
        else if (w.length > 3) for (const k of keys) if (k.length > 3 && (k.startsWith(w) || w.startsWith(k))) { s += 1; break; }
      }
      return { e, s };
    }).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
  }

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/(https?:\/\/[^\s<)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  // Renders the AI's markdown: paragraphs, bullet / numbered lists and small headings.
  function mdBlock(text) {
    let html = '', list = null;
    const close = () => { if (list) { html += `</${list}>`; list = null; } };
    for (const raw of text.split('\n')) {
      const line = raw.trimEnd();
      let m;
      if (!line.trim()) { close(); continue; }
      if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) { if (list !== 'ul') { close(); html += '<ul>'; list = 'ul'; } html += `<li>${md(m[1])}</li>`; }
      else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { if (list !== 'ol') { close(); html += '<ol>'; list = 'ol'; } html += `<li>${md(m[1])}</li>`; }
      else if ((m = line.match(/^#{1,6}\s+(.*)$/))) { close(); html += `<h4>${md(m[1])}</h4>`; }
      else { close(); html += `<p>${md(line)}</p>`; }
    }
    close();
    return html;
  }

  // ---------- navigation inside the current site ----------
  function canGo(go) {
    if (!go) return false;
    if (SITE === 'inst') return !!go.inst && typeof goTab === 'function';
    return !!go.staff;
  }
  function doGo(go) {
    if (SITE === 'inst') {
      // me, go and goTab are app.js globals (top-level const/function in a classic script).
      const signedIn = typeof me === 'function' && me();
      if (!signedIn) return say(['First sign in: tap **Login as Institution · DITS Delhi** on the login screen, then press the button again.']);
      const tabs = ['dashboard', 'apps', 'fdrs', 'alerts', 'profile'];
      if (tabs.includes(go.inst)) goTab(go.inst); else { goTab('dashboard'); window.go(go.inst); }
    } else window.dispatchEvent(new CustomEvent('aicte-guide:navigate', { detail: go.staff }));
    if (innerWidth < 640) toggle(false);
  }

  // ---------- UI ----------
  const css = `
  .gd-fab{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:2147483000;display:flex;align-items:center;gap:8px;padding:12px 16px 12px 12px;border:0;border-radius:999px;background:#0B3A70;color:#fff;font:700 14px/1 system-ui,-apple-system,'Segoe UI',sans-serif;box-shadow:0 8px 24px rgba(11,58,112,.35);cursor:pointer}
  .gd-fab.inst{bottom:calc(80px + env(safe-area-inset-bottom,0px))}
  body:has(#sheet.open) .gd-fab{display:none!important}
  .gd-fab:hover{background:#0d4687}.gd-fab svg{flex:none}
  .gd-fab .gd-pulse{position:absolute;top:-3px;right:-3px;width:12px;height:12px;border-radius:50%;background:#F59E0B;border:2px solid #fff}
  .gd-panel{position:fixed;right:16px;bottom:16px;z-index:2147483001;width:min(400px,calc(100vw - 32px));height:min(620px,calc(100vh - 32px));display:none;flex-direction:column;background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(15,23,42,.3);overflow:hidden;font:14px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;color:#0F172A}
  .gd-panel.open{display:flex}
  @media (max-width:520px){.gd-panel{right:0;bottom:0;width:100vw;height:100dvh;border-radius:0}}
  .gd-head{display:flex;align-items:center;gap:10px;padding:12px 14px;background:#0B3A70;color:#fff}
  .gd-head img{width:34px;height:34px;background:#fff;border-radius:50%;padding:2px}
  .gd-head b{display:block;font-size:15px}.gd-head small{opacity:.8;font-size:12px}
  .gd-head button{margin-left:auto;background:rgba(255,255,255,.12);border:0;color:#fff;width:34px;height:34px;border-radius:8px;font-size:20px;cursor:pointer}
  .gd-log{flex:1;overflow-y:auto;padding:14px;background:#F8FAFC;display:flex;flex-direction:column;gap:10px}
  .gd-msg{max-width:92%;padding:10px 12px;border-radius:12px;background:#fff;border:1px solid #E2E8F0;overflow-wrap:anywhere}
  .gd-msg p{margin:0 0 6px}.gd-msg p:last-child{margin:0}
  .gd-msg h4{margin:0 0 6px;font-size:14px;color:#0B3A70}
  .gd-msg code{background:#F1F5F9;padding:1px 5px;border-radius:4px;font-size:12.5px}
  .gd-msg a{color:#1D4ED8}
  .gd-msg ul,.gd-msg ol{margin:4px 0 8px;padding-left:20px}.gd-msg li{margin:2px 0}
  .gd-src{margin-top:8px;font-size:11.5px;color:#64748B}.gd-src code{font-size:11px}
  .gd-note{font-size:11.5px;color:#92400E;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:4px 8px;margin-bottom:6px}
  .gd-wait{color:#475569;font-style:italic}.gd-wait i{display:inline-block;animation:gd-blink 1.2s infinite}.gd-wait i:nth-child(2){animation-delay:.2s}.gd-wait i:nth-child(3){animation-delay:.4s}
  @keyframes gd-blink{0%,80%,100%{opacity:.2}40%{opacity:1}}
  .gd-form input:disabled,.gd-form button:disabled{opacity:.6}
  .gd-me{align-self:flex-end;background:#0B3A70;color:#fff;border-color:#0B3A70}
  .gd-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
  .gd-acts button{border:1px solid #CBD5E1;background:#fff;color:#0B3A70;border-radius:999px;padding:6px 11px;font:600 12.5px system-ui,sans-serif;cursor:pointer}
  .gd-acts button.pri{background:#D97706;border-color:#D97706;color:#fff}
  .gd-acts button:hover{border-color:#0B3A70}
  .gd-form{display:flex;gap:8px;padding:10px;border-top:1px solid #E2E8F0;background:#fff}
  .gd-form input{flex:1;min-width:0;border:1px solid #CBD5E1;border-radius:10px;padding:10px 12px;font:15px system-ui,sans-serif;color:#0F172A;background:#fff}
  .gd-form button{border:0;background:#0B3A70;color:#fff;border-radius:10px;padding:0 14px;font-weight:700;cursor:pointer}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  const logo = SITE === 'staff' ? '/aicte-logo.png' : 'emblem.png';
  const fab = document.createElement('button');
  fab.className = 'gd-fab' + (SITE === 'inst' ? ' inst' : '');
  fab.setAttribute('aria-label', 'Open the Evaluator Guide');
  fab.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4"/><path d="M12 17h.01"/></svg><span>Evaluator Guide</span><i class="gd-pulse"></i>';
  const panel = document.createElement('section');
  panel.className = 'gd-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Evaluator Guide');
  panel.innerHTML = `<div class="gd-head"><img src="${logo}" alt=""><div><b>Evaluator Guide</b><small>AI assistant · reads the prototype's code</small></div><button type="button" aria-label="Close guide">×</button></div>
    <div class="gd-log" aria-live="polite"></div>
    <form class="gd-form"><input type="text" placeholder="e.g. How does the AI check documents?" aria-label="Your question" autocomplete="off"><button type="submit">Ask</button></form>`;
  const mount = () => { document.body.appendChild(fab); document.body.appendChild(panel); };
  document.body ? mount() : document.addEventListener('DOMContentLoaded', mount);

  const log = panel.querySelector('.gd-log'), input = panel.querySelector('input');
  let started = false, tourAt = -1, busy = false;
  const history = [];   // AI conversation, sent back with each question

  function bubble(html, me) {
    const d = document.createElement('div');
    d.className = 'gd-msg' + (me ? ' gd-me' : '');
    d.setAttribute('translate', 'no');
    d.innerHTML = html;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  function actions(d, list) {
    if (!list.length) return;
    const box = document.createElement('div'); box.className = 'gd-acts';
    for (const [label, fn, pri] of list) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (pri) b.className = 'pri'; b.onclick = fn; box.appendChild(b); }
    d.appendChild(box);
    log.scrollTop = log.scrollHeight;
  }
  function say(lines, title) { return bubble((title ? `<h4>${esc(title)}</h4>` : '') + lines.map(l => `<p>${md(l)}</p>`).join('')); }
  const chipsFor = ids => ids.map(id => KB.find(e => e.id === id)).filter(Boolean).map(e => [e.t, () => ask(e.tour ? e.t : `Explain: ${e.t}`, e)]);

  function answer(e) {
    if (e.tour) return startTour();
    const d = say(e.a, e.t);
    const acts = [];
    if (canGo(e.go)) acts.push(['Take me there →', () => doGo(e.go), true]);
    actions(d, acts.concat(chipsFor(e.next || [])));
  }
  function ask(text, entry) {
    if (busy) return;
    bubble(esc(text), true);
    if (entry && entry.tour) return startTour();
    askAI(text, entry);
  }
  function pageContext() {
    if (SITE === 'staff') return { site: 'staff', portal: STAFF_PORTAL, signedIn: !document.querySelector('form input[type=password]') };
    // UI and me are app.js globals.
    const screen = typeof UI !== 'undefined' && UI.stack && UI.stack.length ? UI.stack[UI.stack.length - 1].name : '';
    return { site: 'inst', screen, signedIn: !!(typeof me === 'function' && me()) };
  }
  function setBusy(on) {
    busy = on;
    panel.querySelector('.gd-form input').disabled = on;
    panel.querySelector('.gd-form button').disabled = on;
  }
  async function askAI(text, entry) {
    setBusy(true);
    const wait = bubble('<span class="gd-wait">Looking through the prototype’s code<i>.</i><i>.</i><i>.</i></span>');
    let data = null, problem = '';
    try {
      const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 120000);
      const res = await fetch(AI_URL, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY },
        body: JSON.stringify({ question: text, history: history.slice(-12), context: pageContext() }),
      });
      clearTimeout(timer);
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.answer) data = body; else problem = body.message || `The AI service answered ${res.status}.`;
    } catch (err) {
      problem = err && err.name === 'AbortError' ? 'The AI took too long to answer.' : 'The AI service could not be reached.';
    }
    wait.remove();
    setBusy(false);
    const best = match(text)[0];
    const local = entry || (best && best.s >= 2 ? best.e : null);
    if (data) {
      history.push({ role: 'user', text }, { role: 'assistant', text: data.answer });
      const d = bubble(mdBlock(data.answer));
      if (data.sources && data.sources.length) {
        const src = document.createElement('div'); src.className = 'gd-src';
        src.innerHTML = 'Looked at: ' + data.sources.slice(0, 6).map(s => `<code>${esc(s)}</code>`).join(', ');
        d.appendChild(src);
      }
      const acts = [];
      if (local && canGo(local.go)) acts.push(['Take me there →', () => doGo(local.go), true]);
      actions(d, acts.concat(local ? chipsFor(local.next || []) : []));
      return;
    }
    // Offline fallback: the built-in answers.
    bubble(`<div class="gd-note">${esc(problem)} Showing the built-in answer instead.</div>`);
    if (local && !local.tour) return answer(local);
    const hits = match(text);
    if (hits.length && hits[0].s >= 2) {
      answer(hits[0].e);
      const more = hits.slice(1, 3).filter(h => h.s >= 2).map(h => h.e.id);
      if (more.length) actions(say(['Related:']), chipsFor(more));
    } else {
      actions(say(['I’m not sure about that one. Here are the topics I can explain — pick one, or rephrase with a keyword like **FDR**, **rules**, **AI**, **officer** or **security**.']),
        chipsFor(['tour', 'overview', 'rules', 'ai', 'fdr', 'officer', 'admin', 'security', 'innovation']));
    }
  }

  function startTour() { tourAt = 0; showStep(); }
  function showStep() {
    const s = TOUR[tourAt];
    const d = say(s.a, s.t);
    const acts = [];
    if (s.open && !location.href.startsWith(s.open)) acts.push(['Open this portal ↗', () => window.open(s.open, '_blank', 'noopener')]);
    if (canGo(s.go)) acts.push(['Take me there →', () => doGo(s.go)]);
    if (tourAt < TOUR.length - 1) acts.push([`Next step (${tourAt + 2}/${TOUR.length})`, () => { tourAt++; showStep(); }, true]);
    else actions(d, chipsFor(['innovation', 'security', 'rules']));
    if (tourAt < TOUR.length - 1) actions(d, acts);
  }

  function greet() {
    started = true;
    const where = SITE === 'inst' ? 'the **Institution app** (used by colleges)' : STAFF_PORTAL === 'admin' ? 'the **Admin console** (AICTE administrators)' : 'the **Officer portal** (scrutiny officers and bank officials)';
    const d = say([`Namaste! 🙏 I’m your guide to the **AICTE AI-IRVP** prototype. You are on ${where}.`,
      'I can walk you through the whole system in about 5 minutes, or answer any question.']);
    actions(d, [['▶ Start the 5-minute tour', startTour, true]].concat(chipsFor(['overview', 'login', 'rules', 'ai', 'fdr', 'innovation'])));
  }
  function toggle(open) {
    const on = open ?? !panel.classList.contains('open');
    panel.classList.toggle('open', on);
    fab.style.display = on ? 'none' : '';
    if (on) { fab.querySelector('.gd-pulse')?.remove(); if (!started) greet(); setTimeout(() => input.focus(), 50); }
  }
  fab.onclick = () => toggle(true);
  panel.querySelector('.gd-head button').onclick = () => toggle(false);
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') toggle(false); });
  panel.querySelector('form').onsubmit = e => { e.preventDefault(); const q = input.value.trim(); if (!q) return; input.value = ''; ask(q); };
})();
