/* FDR Vault Guide — a help chat inside the institution app that explains the whole AI-IRVP prototype.
   Free and self-contained: a curated knowledge base, keyword matching, a guided demo tour and "Take me there"
   buttons. No AI service and no API key; it works offline. Mounted inside #app so it fits the phone screen. */
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

  // Each entry: k = keywords (any form), t = title, a = answer (lines; **bold**, `code`), go = where "Take me there" leads,
  // next = follow-up suggestion ids.
  const KB = [
    { id: 'overview', k: 'what is this overview prototype idea project problem solution about explain summary platform irvp purpose',
      t: 'What this prototype is',
      a: ['**AICTE Intelligent Regulatory Validation Platform (AI-IRVP)** digitises how AICTE approves technical institutions and manages their **Security Deposit**, kept as a Fixed Deposit Receipt (**FDR**) under AICTE joint lien.',
        'It has **three connected portals** on one secure PostgreSQL database behind the project’s own API server:',
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
        'Each step shows **live checks** against AICTE norms. Then **server validation** runs, you review, e-sign, and submit. You get a server-confirmed reference number and a downloadable acknowledgement.'],
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
      t: 'How documents are checked',
      a: ['Every uploaded document is checked by the **7 deterministic AICTE rules** on the server (checklist, expiry, PID match, duplicate fingerprint, faculty, area, FDR corpus) — these give the legal result.',
        'The app also shows an **on-device preview** of each document: the fields it expects (FDR number, amount, dates, bank, institution name, faculty counts) cross-checked with what the form says.',
        'An optional **AI reader** can be switched on later by adding an AI key on the server; until then the app says so and uses the preview. Submission is never blocked, and AI output is only ever advisory — a human officer decides.'],
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
        'Files are stored **privately on the server** in the institution’s own folder. They cannot be edited or deleted afterwards (evidence is immutable) and are opened only through short-lived secure links.'],
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
      t: 'Lien release',
      a: ['Institution: **FDR** tab → open a matured deposit → **Request lien release**.',
        'Admin: sidebar → **Lien Release Requests** → approve with a reason and the AICTE release order number, or reject with a reason.',
        'Bank official: **Lien Discharges** → record the CBS discharge reference once the bank has removed the lien. The bank pays out the deposit itself; no money moves through the portal.'],
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
        'Updates arrive **live** — when an officer acts, the institution sees it within seconds. You can also tap the **Refresh** icon at the top of the screen.'],
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
    { id: 'tech', k: 'tech stack technology built with architecture database backend frontend server node express postgres postgresql react vercel render android',
      t: 'Technology used',
      a: ['• **Institution app**: HTML/CSS/JavaScript PWA (installable, works offline) + Android APK via Capacitor',
        '• **Staff portal**: React + TypeScript + Vite + Tailwind',
        '• **Backend**: Node.js + Express API server with a standalone **PostgreSQL** database — row-level security, SQL workflow functions, private document storage, live updates, scheduled reminders',
        '• **Hosting**: API and database on Render; apps on Vercel',
                '• **Tests**: database, API-server and browser end-to-end tests on real PostgreSQL'],
      next: ['security', 'innovation'] },
    { id: 'innovation', k: 'innovation unique novelty impact benefit why better usp feature highlight value advantage',
      t: 'What is new / impact',
      a: ['• **Rule-checked before human review** – 7 AICTE norms validated automatically, with handbook clause references.',
        '• **Cross-institution fraud detection** with SHA-256 fingerprints.',
        '• **Document cross-checks** against the form, with an optional AI reader (advisory, never decisive).',
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
        'Bank confirmation of a joint lien is shown separately: **Confirmed by the bank** only when a bank official of that bank confirmed it in the bank portal. An entry by AICTE, demo data, form checks or AI review never count as bank confirmation.',
        'Everything else — accounts, database, rules, uploads, workflow, audit — is real and running live.'],
      next: ['innovation'] },
  ];

  const TOUR = [
    { t: 'Step 1 · Sign in as the institution', a: ['Open the **Institution app**: ' + LINKS.inst, 'On the login screen tap **Login as Institution · DITS Delhi** (one click, no typing).'], open: LINKS.inst },
    { t: 'Step 2 · Look at the dashboard', a: ['You see live counts, quick actions, important alerts and the total **FDR corpus under joint lien**.', 'This is what a college principal sees every day.'], go: { inst: 'dashboard' } },
    { t: 'Step 3 · Submit an application', a: ['Tap **New Application** → choose a type → walk the 4 steps (Institution → Program → FDR → Documents).', 'Watch the **live checks** turn green/red as you type. Then run **validation**, review and submit.'], go: { inst: 'apptype' } },
    { t: 'Step 4 · See the rule findings', a: ['Open **My Applications** → any application. You see the timeline, the **7 rule findings** (Passed / Warning / Critical) and the documents.'], go: { inst: 'apps' } },
    { t: 'Step 5 · Review as the AICTE officer', a: ['Open the **Officer portal**: ' + LINKS.officer, 'Tap **Scrutiny Officer** (demo button) → **Verification Center** → open the application → **Start review** → request clarification or clear it.'], open: LINKS.officer },
    { t: 'Step 6 · Confirm the FDR as the bank', a: ['Sign out, then on the Officer portal tap **Bank Official (SBI)** → **FDR Records** → open a pending deposit → enter a CBS reference → **Endorse lien**.'], open: LINKS.officer },
    { t: 'Step 7 · Final approval as admin', a: ['Open the **Admin console**: ' + LINKS.admin, 'Tap **Administrator** → open the cleared application → **Approve** with a reason. Check the **Audit Trail** to see every step recorded.'], open: LINKS.admin },
    { t: 'Done!', a: ['You have seen the full journey: **apply → automatic rule checks → officer scrutiny → bank lien → final approval → audit**.', 'Ask me anything else, e.g. “how is data secured?” or “what is new in this project?”'] },
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
    .replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

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
    toggle(false);
  }

  // ---------- UI (FDR Vault design: navy, golden yellow, Public Sans) ----------
  const css = `
  .gd-fab{position:absolute;right:14px;bottom:calc(78px + env(safe-area-inset-bottom,0px));z-index:40;width:52px;height:52px;display:flex;align-items:center;justify-content:center;border:0;border-radius:50%;background:#F5B82E;color:#082449;box-shadow:0 8px 20px rgba(8,36,73,.28);cursor:pointer;animation:gdPop .45s cubic-bezier(.34,1.56,.64,1) .3s both;transition:transform .15s ease,background-color .2s ease}
  .gd-fab:hover{background:#E9A814}.gd-fab:active{transform:scale(.94)}
  .gd-fab:focus-visible{outline:3px solid #0B2F5B;outline-offset:3px}
  .gd-fab .gd-pulse{position:absolute;top:1px;right:1px;width:12px;height:12px;border-radius:50%;background:#0B2F5B;border:2px solid #fff}
  .gd-fab .gd-pulse::after{content:"";position:absolute;inset:-2px;border-radius:50%;border:2px solid #F5B82E;animation:gdRing 1.8s ease-out infinite}
  #app:has(.footer-bar) .gd-fab{bottom:calc(84px + env(safe-area-inset-bottom,0px))}
  #app:has(#sheet.open) .gd-fab{display:none}
  .gd-panel{position:absolute;inset:0;z-index:45;display:none;flex-direction:column;background:#F3F6FA;font-family:'Public Sans',system-ui,sans-serif;color:#14243A}
  .gd-panel.open{display:flex;animation:gdUp .35s cubic-bezier(.16,1,.3,1) both}
  .gd-head{display:flex;align-items:center;gap:10px;padding:calc(10px + env(safe-area-inset-top,0px)) 10px 10px 14px;background:#0B2F5B;color:#fff;border-bottom:4px solid #D6A62E}
  .gd-head .gd-av{width:38px;height:38px;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;flex:none}
  .gd-head .gd-av img{height:32px;width:auto}
  .gd-head b{display:block;font-size:15px}.gd-head small{color:#C9D4E5;font-size:11.5px}
  .gd-head button{margin-left:auto;background:transparent;border:0;color:#fff;width:44px;height:44px;border-radius:12px;font-size:24px;cursor:pointer}
  .gd-head button:hover{background:rgba(255,255,255,.12)}
  .gd-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}
  .gd-msg{max-width:90%;padding:11px 13px;border-radius:14px 14px 14px 4px;background:#fff;border:1px solid #DCE3EC;overflow-wrap:anywhere;font-size:13.5px;line-height:1.5;animation:gdIn .35s cubic-bezier(.16,1,.3,1) both}
  .gd-msg p{margin:0 0 6px}.gd-msg p:last-child{margin:0}
  .gd-msg h4{margin:0 0 6px;font-size:14px;color:#0B2F5B}
  .gd-msg code{background:#EEF2F7;padding:1px 5px;border-radius:4px;font-size:12.5px}
  .gd-msg a{color:#7A5300;font-weight:600}
  .gd-me{align-self:flex-end;background:#0B2F5B;color:#fff;border-color:#0B2F5B;border-radius:14px 14px 4px 14px;animation-name:gdInMe}
  .gd-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
  .gd-acts button{min-height:36px;border:1px solid #C6D0DC;background:#fff;color:#0B2F5B;border-radius:999px;padding:6px 12px;font:600 12.5px 'Public Sans',system-ui,sans-serif;cursor:pointer;animation:gdIn .3s cubic-bezier(.16,1,.3,1) both;transition:background-color .2s,border-color .2s,transform .15s}
  .gd-acts button:nth-child(2){animation-delay:.04s}.gd-acts button:nth-child(3){animation-delay:.08s}.gd-acts button:nth-child(4){animation-delay:.12s}.gd-acts button:nth-child(n+5){animation-delay:.16s}
  .gd-acts button:hover{border-color:#D6A62E;background:#FEF6E2}.gd-acts button:active{transform:scale(.96)}
  .gd-acts button.pri{background:#F5B82E;border-color:#F5B82E;color:#082449;font-weight:700}
  .gd-acts button:focus-visible,.gd-form button:focus-visible{outline:3px solid #F5B82E;outline-offset:2px}
  .gd-form{display:flex;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));border-top:1px solid #DCE3EC;background:#fff}
  .gd-form input{flex:1;min-width:0;min-height:46px;border:1px solid #C6D0DC;border-radius:12px;padding:10px 12px;font:15px 'Public Sans',system-ui,sans-serif;color:#14243A;background:#fff;outline:0}
  .gd-form input:focus{border-color:#0B2F5B;box-shadow:0 0 0 1px #0B2F5B}
  .gd-form button{min-width:64px;border:0;background:#F5B82E;color:#082449;border-radius:12px;padding:0 14px;font:700 14px 'Public Sans',system-ui,sans-serif;cursor:pointer;transition:background-color .2s,transform .15s}
  .gd-form button:hover{background:#E9A814}.gd-form button:active{transform:scale(.96)}
  @keyframes gdIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  @keyframes gdInMe{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:none}}
  @keyframes gdUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
  @keyframes gdPop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:none}}
  @keyframes gdRing{from{transform:scale(1);opacity:.9}to{transform:scale(2.2);opacity:0}}
  @media (prefers-reduced-motion:reduce){.gd-fab,.gd-panel.open,.gd-msg,.gd-acts button,.gd-fab .gd-pulse::after{animation:none!important}}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'gd-fab';
  fab.setAttribute('aria-label', 'Open the FDR Vault Guide');
  fab.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6M12 15h.01"/></svg><span class="gd-pulse"></span>';
  const panel = document.createElement('section');
  panel.className = 'gd-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'FDR Vault Guide'); panel.setAttribute('translate', 'no');
  panel.innerHTML = `<div class="gd-head"><span class="gd-av"><img src="fdr-vault-mark.png" alt=""></span><div><b>FDR Vault Guide</b><small>Instant answers · works offline</small></div><button type="button" aria-label="Close guide">×</button></div>
    <div class="gd-log" aria-live="polite"></div>
    <form class="gd-form"><input type="text" placeholder="e.g. How do I renew my FDR?" aria-label="Your question" autocomplete="off"><button type="submit">Ask</button></form>`;
  // Inside the app screen (so it fits the phone and the desktop phone frame). Automated UI tests run without it unless ?guide=1.
  const mount = () => {
    if (navigator.webdriver && !/[?&]guide=1\b/.test(location.search)) return;
    const host = document.getElementById('app') || document.body;
    host.appendChild(fab); host.appendChild(panel);
  };
  document.body ? mount() : document.addEventListener('DOMContentLoaded', mount);

  const log = panel.querySelector('.gd-log'), input = panel.querySelector('input');
  let started = false, tourAt = -1;

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
  const chipsFor = ids => ids.map(id => KB.find(e => e.id === id)).filter(Boolean).map(e => [e.t, () => ask(e.t, e)]);

  function answer(e) {
    if (e.tour) return startTour();
    const d = say(e.a, e.t);
    const acts = [];
    if (canGo(e.go)) acts.push(['Take me there →', () => doGo(e.go), true]);
    actions(d, acts.concat(chipsFor(e.next || [])));
  }
  function ask(text, entry) {
    bubble(esc(text), true);
    if (entry) return answer(entry);
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
    const d = say([`Namaste! I’m the **FDR Vault Guide** for the AICTE AI-IRVP prototype. You are on ${where}.`,
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
