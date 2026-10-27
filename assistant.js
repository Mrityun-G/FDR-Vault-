/* AICTE Regulatory Assistant — guided FDR submissions inside the institution app.
   Loaded after app.js and uses its screens, helpers and Backend. Two screens:
     assistant     : start a new request or resume one
     assistantApp  : one application — Chat (questions), Checklist (upload + validation), Form, Review / Submit
   The rules are assistant-rules.js. On the server they run in server/assistant.mjs; in demo mode LocalAssistant
   below runs them on the device. Nothing here decides compliance or invents a value. */
(() => {
  const AR = window.AssistantRules;
  PARENT.assistant = 'dashboard';
  PARENT.assistantApp = 'dashboard';
  UI.asst = { s: null, tab: 'chat', loading: false, uploading: {}, list: null, pending: null };

  const STATE_TONE = { DRAFT: 'slate', QUESTIONS_IN_PROGRESS: 'blue', DOCUMENTS_REQUIRED: 'amber', NEEDS_CORRECTION: 'red', MANUAL_REVIEW: 'amber', FORM_GENERATED: 'blue',
    AWAITING_USER_CONFIRMATION: 'blue', READY_FOR_SUBMISSION: 'green', SUBMITTED: 'green', UNDER_REVIEW: 'amber', APPROVED: 'green', REJECTED: 'red', CLARIFICATION_REQUIRED: 'red',
    VALIDATION_IN_PROGRESS: 'blue' };
  const V_TONE = { GREEN: 'green', AMBER: 'amber', RED: 'red' };
  const V_LABEL = { GREEN: 'Checks passed', AMBER: 'Needs review', RED: 'Must be fixed' };
  const SRC_LABEL = { VERIFIED: ['Verified source', 'green'], PORTAL_RULE: ['Portal rule (AICTE clause not verified)', 'blue'], UNVERIFIED: ['Not verified — needs human confirmation', 'amber'], OUTDATED: ['Outdated source — needs review', 'red'] };
  const F_LABEL = { VERIFIED: ['From portal record', 'green'], EXTRACTED: ['Read from document', 'blue'], USER: ['Entered by you', 'slate'], USER_DIFFERS: ['Differs from document', 'amber'], CONFLICT: ['Conflict', 'red'], MISSING: ['Missing', 'red'] };
  const STAGES = [['chat', 'Questions'], ['checklist', 'Documents'], ['form', 'Form'], ['review', 'Review']];
  const st = () => UI.asst.s;
  const api = (method, path, body) => Backend.assistant(method, path, body);

  // ------------------------------------------------------------------ loading and actions

  async function load(id, quiet) {
    UI.asst.loading = !quiet;
    try { UI.asst.s = await api('GET', `/sessions/${id}`); }
    catch (e) { handleError(e); if (!UI.asst.s) back(); }
    finally { UI.asst.loading = false; if (['assistantApp'].includes(currentRoute())) render(); }
  }
  async function act(fn, okMsg) {
    if (UI.asst.busy) return;
    UI.asst.busy = true; render();
    try { const s = await fn(); if (s && s.id) UI.asst.s = s; if (okMsg) toast(okMsg); }
    catch (e) { const err = toApiError(e); if (err.code === 'BLOCKED' && Array.isArray(err.fields)) toast(`${err.message} ${err.fields[0]}`, 'err'); else handleError(e); }
    finally { UI.asst.busy = false; render(); }
  }
  const say = (role, text) => api('POST', `/sessions/${st().id}/messages`, { messages: [{ role, text, phase: st().workflow ? 'post' : 'pre' }] }).catch(() => {});

  // Files are checked on the device before upload: type, size, empty, real PDF/JPEG/PNG content, no password protection.
  async function deepCheck(f) {
    const buf = new Uint8Array(await f.arrayBuffer());
    const head = String.fromCharCode(...buf.slice(0, 8));
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf') {
      if (!head.startsWith('%PDF-')) return 'is not a valid PDF (the file may be damaged)';
      const text = new TextDecoder('latin1').decode(buf);
      if (/\/Encrypt\b/.test(text)) return 'is password-protected. Upload an unprotected copy';
    } else if (ext === 'png' && !(buf[0] === 0x89 && head.slice(1, 4) === 'PNG')) return 'is not a valid PNG image';
    else if ((ext === 'jpg' || ext === 'jpeg') && !(buf[0] === 0xff && buf[1] === 0xd8)) return 'is not a valid JPEG image';
    return null;
  }
  async function uploadFor(docKey, files) {
    const s = st();
    if (!s || !files || !files.length) return;
    const f = files[0];
    const bad = await deepCheck(f).catch(() => 'could not be read');
    if (bad) { toast(`${f.name} ${bad}.`, 'err'); return; }
    const [item] = await hashFiles({ files: [f], value: '' });
    if (!item) return;
    UI.asst.uploading[docKey] = 'Uploading securely…'; render();
    try {
      const storagePath = await Backend.upload(item.file, item.meta.fileHash);
      UI.asst.uploading[docKey] = 'Reading and checking the document…'; render();
      UI.asst.s = await api('POST', `/sessions/${s.id}/documents`, { docKey, file: { ...item.meta, storagePath: storagePath || `local/${item.meta.fileHash}` } });
      const v = (UI.asst.s.checklist.find(i => i.docKey === docKey) || {}).validation;
      toast(v ? `${item.meta.fileName}: ${V_LABEL[v.status]}` : 'Uploaded', v && v.status === 'RED' ? 'err' : v && v.status === 'AMBER' ? 'warn' : 'ok');
    } catch (e) { handleError(e); }
    finally { delete UI.asst.uploading[docKey]; render(); }
  }

  Object.assign(ACTIONS, {
    asstNew: async () => {
      try { const s = await api('POST', '/sessions', {}); UI.asst.s = s; UI.asst.tab = 'chat'; go('assistantApp', { id: s.id }); }
      catch (e) { handleError(e); }
    },
    asstOpen: el => { UI.asst.s = null; UI.asst.tab = 'chat'; go('assistantApp', { id: el.dataset.id }); },
    asstTab: el => { UI.asst.tab = el.dataset.v; render(true); },
    asstWorkflow: el => act(async () => {
      const wf = AR.workflowOf(el.dataset.v);
      if (UI.asst.pending) { await say('user', `Yes, ${wf.name.toLowerCase()}.`); UI.asst.pending = null; }
      return api('POST', `/sessions/${st().id}/answer`, { workflow: wf.code });
    }),
    asstChange: () => openSheet('Change the request type?', `<p class="small">Your answers and uploaded documents for this request will be cleared.</p>
      <div style="display:grid;gap:8px" class="mt12">${AR.WORKFLOWS.filter(w => w.code !== st().workflow).map(w => `<button class="btn btn-outline btn-block" data-act="asstWorkflowSheet" data-v="${w.code}">${esc(w.name)}</button>`).join('')}</div>`),
    asstWorkflowSheet: el => { closeSheet(); ACTIONS.asstWorkflow(el); },
    asstAnswer: el => act(() => api('POST', `/sessions/${st().id}/answer`, { key: el.dataset.key, value: el.dataset.v === '__none' ? null : el.dataset.v })),
    asstAnswerText: () => {
      const v = ($('#asstText') || {}).value || '', q = st().nextQuestion;
      if (v.trim().length < 3) { toast('Please write a little more.', 'warn'); return; }
      act(() => api('POST', `/sessions/${st().id}/answer`, { key: q.key, value: v.trim() }));
    },
    asstAsk: async () => {
      const box = $('#asstAsk'), text = box ? box.value.trim() : '';
      if (text.length < 3) return;
      box.value = '';
      const s = st();
      await say('user', text);
      if (!s.workflow) {
        try {
          const c = await api('POST', '/classify', { text });
          const wf = AR.workflowOf(c.workflow);
          const reply = c.workflow === 'OTHER' || c.confidence < 0.5
            ? 'I am not sure which request this is. Please choose one of the options above, or describe it differently.'
            : `It sounds like you want to: ${wf.name}. Is that right?`;
          await say('assistant', reply);
          UI.asst.pending = c.workflow !== 'OTHER' && c.confidence >= 0.5 ? c.workflow : null;
        } catch (e) { handleError(e); }
      } else await say('assistant', explain(text));
      await load(s.id, true);
    },
    asstNo: () => { UI.asst.pending = null; say('assistant', 'No problem. Please choose the request type from the options.').then(() => load(st().id, true)); },
    asstPick: el => { const inp = $(`input[type=file][data-asst-doc="${el.dataset.key}"]`); if (inp) inp.click(); },
    asstRemove: el => act(() => api('POST', `/sessions/${st().id}/documents/${encodeURIComponent(el.dataset.key)}/remove`), 'Document removed'),
    asstPreview: async el => {
      const d = st().checklist.find(i => i.docKey === el.dataset.key);
      if (!d || !d.file) return;
      try { const url = await Backend.signedUrl(d.file.storagePath, d.file.fileHash); if (url) window.open(url, '_blank', 'noopener'); else toast('Preview is not available for this file.', 'warn'); }
      catch (e) { handleError(e); }
    },
    asstSample: el => act(() => api('POST', `/sessions/${st().id}/sample`, { docKey: el.dataset.key }), 'Sample document attached (demo)'),
    asstSaveForm: () => {
      const vals = readForm($('#asstForm'));
      act(() => api('POST', `/sessions/${st().id}/form`, { values: vals }), 'Form saved and re-checked');
    },
    asstUseValue: el => act(() => api('POST', `/sessions/${st().id}/form`, { values: { [el.dataset.key]: el.dataset.v } }), 'Value chosen'),
    asstReview: () => act(async () => { const s = await api('POST', `/sessions/${st().id}/review`, { open: true }); UI.asst.tab = 'review'; return s; }),
    asstBackEdit: () => act(async () => { const s = await api('POST', `/sessions/${st().id}/review`, { open: false }); UI.asst.tab = 'form'; return s; }),
    asstSubmit: () => {
      const ok = $('#asstDecl') && $('#asstDecl').checked;
      if (!ok) { UI.err = { asstDecl: 'Please confirm the declaration.' }; render(); return; }
      act(async () => {
        const s = await api('POST', `/sessions/${st().id}/submit`, { confirm: true, declaration: true });
        if (Backend.remote) await Backend.refresh().catch(() => {});
        UI.asst.tab = 'review';
        return s;
      }, 'Submitted through the portal');
    },
    asstPackage: () => act(() => api('POST', `/sessions/${st().id}/package`), 'Submission package prepared'),
    asstDownload: () => { downloadFile(`FDR-Vault-Assistant-${(st().workflow || 'draft').toLowerCase()}-${st().id.slice(0, 8)}.html`, packageHtml(st()), 'text/html'); },
    asstPrint: () => {
      const w = window.open('', '_blank');
      if (!w) { toast('Allow pop-ups to print, or use Download.', 'warn'); return; }
      w.document.write(packageHtml(st()) + '<script>setTimeout(() => print(), 300)<\/script>'); w.document.close();
    },
    asstGoRecord: () => {
      const s = st(), r = s.submission && s.submission.result;
      if (!r) return;
      if (r.fdrId) go('fdrDetail', { id: r.fdrId });
      else if (s.record && s.record.fdr && !r.applicationId) go('fdrDetail', { id: s.record.fdr.id });
      else if (r.applicationId) go('appDetail', { id: r.applicationId });
      else if (r.ticketNo) go('tickets');
    },
  });

  // Drag and drop onto a checklist item.
  document.addEventListener('dragover', e => { const z = e.target.closest && e.target.closest('[data-asst-drop]'); if (z) { e.preventDefault(); z.classList.add('as-drag'); } });
  document.addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('[data-asst-drop]'); if (z) z.classList.remove('as-drag'); });
  document.addEventListener('drop', e => {
    const z = e.target.closest && e.target.closest('[data-asst-drop]');
    if (!z) return;
    e.preventDefault(); z.classList.remove('as-drag');
    uploadFor(z.dataset.asstDrop, e.dataTransfer.files);
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.matches && el.matches('input[type=file][data-asst-doc]')) { const files = [...el.files]; el.value = ''; uploadFor(el.dataset.asstDoc, files); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'asstAsk') { e.preventDefault(); ACTIONS.asstAsk(); } });

  // Plain-English explanations of terms used in this workflow (general guidance, not regulatory advice).
  const GLOSSARY = [
    [/\bfdr\b|fixed deposit/, 'An FDR (Fixed Deposit Receipt) is the bank’s receipt for your security deposit. The portal records its number, amount, dates and bank from it.'],
    [/lien|joint/, 'A joint lien means the deposit cannot be withdrawn without AICTE’s consent. In this portal the lien is in favour of the Regional Officer of your AICTE Regional Office, and the bank confirms it in its Core Banking System.'],
    [/ifsc/, 'The IFSC is the 11-character code of the bank branch, for example SBIN0001234. The first four letters identify the bank.'],
    [/matur/, 'The maturity date is when the deposit ends. The portal expects a 10-year deposit; a lien can be released only after maturity.'],
    [/beneficiar|wording/, 'The beneficiary / lien wording on the advice should name AICTE (the Regional Officer). If it cannot be read, add the bank’s lien letter or a clearer copy.'],
    [/green|amber|red|status|valid/, 'GREEN: passed the checks that could be done. AMBER: needs manual review or more evidence. RED: something required is missing or wrong and must be fixed before you can submit.'],
    [/source|regulat|rule|verified|circular|handbook/, 'Each requirement shows its source. “Portal rule” means this portal enforces it but the AICTE clause has not been verified; “Not verified” items need confirmation from AICTE and never block your submission.'],
    [/who|where|send|official|department/, 'The Review tab shows where this request goes in the portal and whether that routing is verified. Nothing is sent until you confirm.'],
  ];
  function explain(text) {
    const t = text.toLowerCase(), hit = GLOSSARY.find(([re]) => re.test(t));
    return hit ? hit[1] : 'I can explain the steps of this application (FDR, lien, IFSC, maturity, statuses, sources). For anything else, please raise a helpdesk ticket from Profile.';
  }

  // ------------------------------------------------------------------ screens

  V.assistant = () => {
    if (!UI.asst.list && !UI.asst.listLoading) {
      UI.asst.listLoading = true;
      api('GET', '/sessions').then(l => { UI.asst.list = l; }).catch(handleError).finally(() => { UI.asst.listLoading = false; if (currentRoute() === 'assistant') render(); });
    }
    const list = UI.asst.list || [];
    return {
      title: 'Regulatory Assistant', sub: 'Guided FDR submissions',
      body: `<div class="card as-hero"><div class="row top"><span class="tile-ico tone-blue">${ic('spark', 22)}</span><div class="grow">
          <div class="h3">AICTE Regulatory Assistant</div>
          <div class="small mt4">Tell me what you need. I ask a few questions, list the documents for your request with their source, check each upload, fill the form from your documents, and prepare it for your confirmation.</div></div></div>
          <button class="btn btn-primary btn-block mt12" data-act="asstNew">${ic('spark', 18)} Start a new request</button></div>
        <div class="banner info mt12">${ic('info', 18)}<div class="xs">The assistant checks documents against the rules configured in this portal. Its checks are not an AICTE approval, and nothing is submitted until you confirm.</div></div>
        <div class="section-title"><span class="h2">Your requests</span></div>
        ${UI.asst.listLoading && !UI.asst.list ? '<div class="empty"><span class="spin"></span></div>'
          : list.length ? list.map(r => `<button class="card row as-item" data-act="asstOpen" data-id="${esc(r.id)}"><div class="grow"><b class="small">${esc(r.workflowName || 'New request')}</b>
              <div class="xs muted">Updated ${fmtDT(r.updatedAt)}${r.reference ? ` · Ref ${esc(String(r.reference).slice(0, 18))}` : ''}</div></div>
              ${chip(r.submitted ? ['Submitted', 'green'] : r.packagedAt ? ['Ready for submission', 'green'] : ['In progress', 'amber'], true)}${ic('chev', 18)}</button>`).join('')
          : `<div class="empty">${ic('message', 36)}<div>No requests yet.</div></div>`}`,
    };
  };
  ON_ENTER.assistant = () => { UI.asst.list = null; };

  V.assistantApp = ({ id }) => {
    const s = st();
    if (!s || s.id !== id) {
      if (!UI.asst.loading) setTimeout(() => load(id), 0);
      return { title: 'Regulatory Assistant', body: '<div class="empty"><span class="spin"></span><div>Opening your request…</div></div>' };
    }
    const tab = s.workflow ? UI.asst.tab : 'chat';
    const locked = !!s.submission;
    const stage = !s.workflow || s.nextQuestion ? 0 : s.state === 'DOCUMENTS_REQUIRED' || s.state === 'NEEDS_CORRECTION' ? 1 : ['AWAITING_USER_CONFIRMATION', 'READY_FOR_SUBMISSION'].includes(s.state) || locked ? 3 : 2;
    const pre = `<div class="as-top"><div class="row between"><span class="xs muted">${esc(s.workflowName || 'New request')}</span>
        ${chip([UI.asst.busy || Object.keys(UI.asst.uploading).length ? 'Validation in progress' : s.stateLabel, STATE_TONE[s.state] || 'slate'], true)}</div>
      <div class="seg mt8" role="tablist">${STAGES.map(([k, l], n) => `<button role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''} ${n < stage ? 'as-done' : ''}" data-act="asstTab" data-v="${k}" ${!s.workflow && k !== 'chat' ? 'disabled' : ''}>${n < stage ? ic('check', 12) + ' ' : ''}${l}</button>`).join('')}</div></div>`;
    const body = { chat: chatTab, checklist: checklistTab, form: formTab, review: reviewTab }[tab](s, locked);
    return { title: 'Regulatory Assistant', sub: s.workflow ? s.workflowName : 'What would you like to do?', pre, body,
      footer: tab === 'chat' && !locked ? `<input class="input grow" id="asstAsk" maxlength="500" placeholder="${s.workflow ? 'Ask about a term or a step…' : 'Or describe what you need…'}" aria-label="Message the assistant"><button class="btn btn-primary" data-act="asstAsk" aria-label="Send">${ic('send', 18)}</button>` : '' };
  };
  ON_ENTER.assistantApp = () => { UI.asst.pending = null; UI.err = {}; };

  // ------------------------------------------------------------------ chat

  const bot = html => `<div class="as-msg bot"><span class="as-av">${ic('spark', 16)}</span><div class="as-b">${html}</div></div>`;
  const mine = text => `<div class="as-msg me"><div class="as-b">${esc(text)}</div></div>`;
  function answerLabel(q, v, s) {
    if (v === null || v === undefined || v === '') return q.none || 'None';
    if (q.kind === 'choice') return (q.options.find(o => o[0] === v) || [, v])[1];
    if (q.kind === 'fdr') { const f = DB.fdrs.find(x => x.id === v); return f ? `${f.fdrNumber} (${f.bankName})` : (s.record && s.record.fdr ? s.record.fdr.fdrNumber : 'Selected FDR'); }
    if (q.kind === 'app') { const a = DB.apps.find(x => x.id === v); return a ? a.applicationNumber : 'Selected application'; }
    return v;
  }
  function choicesFor(q) {
    if (q.kind === 'choice') return q.options.map(([v, l]) => `<button class="as-chip" data-act="asstAnswer" data-key="${q.key}" data-v="${esc(v)}">${esc(l)}</button>`).join('');
    if (q.kind === 'fdr') {
      const ok = f => {
        if (fdrStatus(f) === 'RELEASED') return false;
        const pending = f.pendingRequest || (f.releaseRequest && f.releaseRequest.status === 'PENDING');
        if (q.filter === 'renewable') return !pending;
        if (q.filter === 'releasable') return !pending && fdrStatus(f) === 'MATURED' && f.isLienConfirmed;
        return true;
      };
      const list = myFdrs().filter(ok);
      return list.length ? list.map(f => `<button class="as-chip as-wide" data-act="asstAnswer" data-key="${q.key}" data-v="${esc(f.id)}"><b>${esc(f.fdrNumber)}</b><small>${esc(f.bankName)} · ${fmtAmount(f.amountLakhs)} · matures ${fmtDate(f.maturityDate)} · ${esc(FSTATUS[fdrStatus(f)][0])}</small></button>`).join('')
        : `<div class="xs muted">None of your FDRs can be used for this request${q.filter === 'releasable' ? ' (a release needs a matured FDR whose lien the bank endorsed, with no pending request)' : ' (each may already have a pending request)'}.</div>`;
    }
    if (q.kind === 'app') {
      const list = myApps().filter(a => a.status !== 'DRAFT' && (q.filter === 'deficient' ? a.status === 'DEFICIENCIES_NOTED' : !['APPROVED', 'REJECTED'].includes(a.status)));
      return `${list.map(a => `<button class="as-chip as-wide" data-act="asstAnswer" data-key="${q.key}" data-v="${esc(a.id)}"><b>${esc(a.applicationNumber)}</b><small>${esc((STATUS[a.status] || [a.status])[0])}</small></button>`).join('')}
        ${q.optional ? `<button class="as-chip" data-act="asstAnswer" data-key="${q.key}" data-v="__none">${esc(q.none)}</button>` : ''}
        ${!list.length && !q.optional ? '<div class="xs muted">You have no application with an open deficiency notice.</div>' : ''}`;
    }
    return `<textarea class="input" id="asstText" rows="3" maxlength="2000" placeholder="Type your answer"></textarea><button class="btn btn-primary btn-sm mt8" data-act="asstAnswerText">${ic('send', 16)} Send</button>`;
  }
  function chatTab(s, locked) {
    const i = s.institution || inst(), out = [];
    const msgs = s.messages || [], pre = msgs.filter(m => m.phase !== 'post'), post = msgs.filter(m => m.phase === 'post');
    const logged = m => (m.role === 'user' ? mine(m.text) : bot(esc(m.text)));
    out.push(bot(`<b>Welcome to the AICTE Regulatory Assistant.</b> What would you like to do today?`));
    if (!s.workflow) out.push(`<div class="as-chips">${AR.WORKFLOWS.map(w => `<button class="as-chip" data-act="asstWorkflow" data-v="${w.code}">${esc(w.name)}</button>`).join('')}</div>`);
    pre.forEach(m => out.push(logged(m)));
    if (!s.workflow && UI.asst.pending) out.push(`<div class="as-chips"><button class="as-chip on" data-act="asstWorkflow" data-v="${UI.asst.pending}">Yes, continue</button><button class="as-chip" data-act="asstNo">No, choose another</button></div>`);
    if (s.workflow) {
      out.push(mine(s.workflowName));
      out.push(bot(`Understood. I’ll ask only what I need. I already have your institution’s details from your profile: <b>${esc(i.name)}</b> (PID ${esc(i.pid)}), ${esc(i.region)} Regional Office.${locked ? '' : ` <button class="link" data-act="asstChange">Change request type</button>`}`));
      for (const q of AR.QUESTIONS[s.workflow]) {
        if (!(q.key in s.answers)) break;
        out.push(bot(esc(q.ask)));
        out.push(mine(answerLabel(q, s.answers[q.key], s)));
      }
      if (s.nextQuestion && !locked) out.push(bot(esc(s.nextQuestion.ask)) + `<div class="as-chips">${choicesFor(s.nextQuestion)}</div>`);
      else if (!s.nextQuestion) {
        const d = s.destination;
        out.push(bot(`<b>Where this goes:</b> ${esc(d.role)}.<br>${esc(d.why)}<div class="xs mt4">${chip(d.verified === 'PORTAL_WORKFLOW' ? ['Portal routing', 'blue'] : ['Needs human confirmation', 'amber'], true)} ${esc(d.note)}</div>`));
        const applicable = s.checklist.filter(c => c.applies);
        out.push(bot(applicable.length ? `Your document checklist is ready. Please upload the documents listed below. I will check each document against the applicable requirements and identify any missing information.
          <ul class="as-ul">${applicable.map(c => `<li>${esc(c.name)} ${chip(c.applicability === 'MANDATORY' && c.blocking ? ['Required', 'red'] : ['If applicable', 'slate'], true)}</li>`).join('')}</ul>
          <button class="btn btn-primary btn-sm" data-act="asstTab" data-v="checklist">${ic('upload', 16)} Open checklist</button>`
          : `No documents are configured for this request. Continue to the form. <button class="btn btn-primary btn-sm mt8" data-act="asstTab" data-v="form">Open form</button>`));
        if (s.checklist.some(c => c.uploaded)) out.push(bot(progressText(s)));
        if (s.submission) out.push(bot(`<b>Submitted</b> on ${fmtDT(s.submission.at)} to ${esc(s.submission.destination)}. Reference: <span class="mono">${esc(s.submission.reference || '—')}</span>. Current status: <b>${esc(s.stateLabel)}</b>${s.stateDetail ? ` — ${esc(s.stateDetail)}` : ''}.`));
      }
    }
    post.forEach(m => out.push(logged(m)));
    return `<div class="as-thread">${out.join('')}</div>`;
  }
  function progressText(s) {
    const c = s.counts;
    if (!s.blockers.length) return c.required && c.satisfied === c.required ? `${c.satisfied} of ${c.required} required checklist items satisfied. The form is ready for your review.`
      : `No blocking issues. ${c.pendingManual ? `${c.pendingManual} item(s) still need manual verification by AICTE or the bank.` : ''} The form is ready for your review.`;
    return `Still to do (${s.blockers.length}):<ul class="as-ul">${s.blockers.slice(0, 5).map(b => `<li>${esc(b)}</li>`).join('')}</ul>`;
  }

  // ------------------------------------------------------------------ checklist

  function sourceBlock(src) {
    const [l, t] = SRC_LABEL[src.status] || [src.status, 'slate'];
    return `<details class="acc as-src"><summary><span class="xs">Source: ${esc(src.title)}</span> ${chip([l, t], true)}${ic('down', 14)}</summary><div class="acc-b xs">
      <div><b>Issued by:</b> ${esc(src.issuingAuthority || '—')}</div>
      ${src.section ? `<div><b>Section / page:</b> ${esc(src.section)}</div>` : ''}
      ${src.effectiveDate ? `<div><b>Effective:</b> ${fmtDate(src.effectiveDate)}</div>` : ''}
      ${src.excerpt ? `<div class="mt4"><b>Excerpt:</b> “${esc(src.excerpt)}”</div>` : ''}
      ${src.notes ? `<div class="mt4 muted">${esc(src.notes)}</div>` : ''}
      ${src.url ? `<div class="mt4"><a href="${esc(src.url)}" target="_blank" rel="noopener">Official link</a></div>` : ''}
      ${src.verifiedBy ? `<div class="mt4">Verified by ${esc(src.verifiedBy)} on ${fmtDate(src.verifiedAt)}</div>` : ''}</div></details>`;
  }
  function checklistTab(s, locked) {
    const items = s.checklist.filter(c => c.applies), skipped = s.checklist.filter(c => !c.applies);
    const done = items.filter(c => c.uploaded).length;
    const pct = items.length ? Math.round(100 * done / items.length) : 100;
    if (s.nextQuestion) return `<div class="empty">${ic('message', 36)}<div>Answer the questions first; your checklist depends on them.</div><button class="btn btn-primary btn-sm mt8" data-act="asstTab" data-v="chat">Back to questions</button></div>`;
    return `<div class="card"><div class="row between"><b class="small">${done} of ${items.length} document(s) uploaded</b><span class="xs muted">${pct}%</span></div><div class="as-bar mt8"><i style="width:${pct}%"></i></div>
        <div class="xs muted mt8">PDF, JPG or PNG · up to 10 MB · drag a file onto an item or tap Upload.</div></div>
      ${items.map(c => itemCard(c, locked)).join('') || '<div class="empty">No documents are needed for this request.</div>'}
      ${skipped.length ? `<div class="section-title"><span class="h2">Not needed for your answers</span></div>${skipped.map(c => `<div class="card as-off"><b class="small">${esc(c.name)}</b><div class="xs muted">Only ${esc(c.conditionLabel || 'in some cases')}.</div></div>`).join('')}` : ''}
      ${!s.blockers.length && !locked ? `<button class="btn btn-primary btn-block mt12" data-act="asstTab" data-v="form">Continue to the form ${ic('chev', 18)}</button>` : ''}`;
  }
  function itemCard(c, locked) {
    const v = c.validation, up = UI.asst.uploading[c.docKey];
    const tag = c.applicability === 'MANDATORY' ? (c.blocking ? ['Mandatory', 'red'] : ['Mandatory (unconfirmed)', 'amber']) : ['Conditional', 'slate'];
    return `<div class="card as-doc ${v ? 'v-' + v.status.toLowerCase() : ''}" data-asst-drop="${locked ? '' : esc(c.docKey)}">
      <div class="row between top"><div class="grow"><b class="small">${esc(c.name)}</b><div class="xs muted mt4">${esc(c.purpose)}</div></div>${chip(tag, true)}</div>
      ${c.applicability === 'CONDITIONAL' && c.conditionLabel ? `<div class="xs mt4">Needed ${esc(c.conditionLabel)}.</div>` : ''}
      ${c.needsHumanReview ? `<div class="banner warn mt8">${ic('alert', 16)}<div class="xs">This requirement is not confirmed by an official source. Ask AICTE whether it applies; it will not block your submission.</div></div>` : ''}
      <details class="acc"><summary><span class="xs">What the document must show</span>${ic('down', 14)}</summary><div class="acc-b xs"><ul class="as-ul">${(c.requiredFields || []).map(f => `<li>${esc(f)}</li>`).join('')}</ul>Accepted: ${esc((c.formats || []).join(', '))}</div></details>
      ${sourceBlock(c.source)}
      ${c.file ? `<div class="row mt8">${ic('fileCheck', 18)}<div class="grow"><div class="small ellipsis">${esc(c.file.fileName)}</div><div class="xs muted mono">SHA-256 ${short(c.file.fileHash)}</div></div></div>` : ''}
      ${v ? `<div class="mt8">${chip([V_LABEL[v.status], V_TONE[v.status]], true)}</div>
        ${v.issues.map(x => `<div class="as-issue ${x.level.toLowerCase()}"><b>${esc(x.message)}</b><div>${esc(x.fix)}</div></div>`).join('')}
        ${v.note ? `<div class="xs muted mt4">${esc(v.note)}</div>` : ''}
        <div class="xs muted mt4">Checks performed: ${esc(v.checks.join(', '))}.</div>` : ''}
      ${up ? `<div class="row mt8"><span class="spin"></span><span class="xs">${esc(up)}</span></div>` : locked ? '' : `<div class="row mt8" style="gap:8px;flex-wrap:wrap">
        <button class="btn btn-outline btn-xs" data-act="asstPick" data-key="${esc(c.docKey)}">${ic('upload', 14)} ${c.uploaded ? 'Replace' : 'Upload'}</button>
        <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" data-asst-doc="${esc(c.docKey)}" aria-label="Upload ${esc(c.name)}">
        ${c.uploaded ? `<button class="btn btn-ghost btn-xs" data-act="asstPreview" data-key="${esc(c.docKey)}">${ic('eye', 14)} Open</button><button class="btn btn-ghost btn-xs" data-act="asstRemove" data-key="${esc(c.docKey)}">${ic('trash', 14)} Remove</button>` : ''}
        ${!Backend.remote && !c.uploaded ? `<button class="link xs" data-act="asstSample" data-key="${esc(c.docKey)}">Use sample (demo)</button>` : ''}</div>`}
    </div>`;
  }

  // ------------------------------------------------------------------ form

  function formTab(s, locked) {
    if (s.nextQuestion) return `<div class="empty">${ic('message', 36)}<div>Answer the questions first.</div></div>`;
    if (!s.form.length) return '<div class="empty">This request has no form.</div>';
    const editable = !locked && !['AWAITING_USER_CONFIRMATION', 'READY_FOR_SUBMISSION'].includes(s.state);
    return `<div class="banner info">${ic('info', 18)}<div class="xs">Values are filled from your documents and your profile. Check each one; correct anything that is wrong. Nothing missing is guessed.</div></div>
      <form id="asstForm" novalidate onsubmit="return false">${s.form.map(f => fieldCard(f, editable)).join('')}</form>
      ${editable ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px" class="mt12"><button class="btn btn-outline" data-act="asstSaveForm">Save &amp; re-check</button>
        <button class="btn btn-primary" data-act="asstReview" ${s.blockers.length ? 'disabled' : ''}>Final review ${ic('chev', 18)}</button></div>
        ${s.blockers.length ? `<div class="xs muted mt8">Final review opens when nothing is blocking (${s.blockers.length} left: see Review).</div>` : ''}` : ''}`;
  }
  function fieldCard(f, editable) {
    const [l, t] = F_LABEL[f.status] || [f.status, 'slate'];
    const src = f.source;
    const where = src ? (src.kind === 'document' ? `${src.label}${src.page ? `, page ${src.page}` : ''}` : src.label) : '';
    const input = !editable || f.readOnly ? `<div class="as-val">${esc(f.value || '—')}</div>`
      : f.kind === 'bank' ? fld('', f.key, f.value, { opts: [['', 'Choose'], ...AR.BANK_NAMES.map(b => [b, b])] })
      : fld('', f.key, f.value, { type: f.kind === 'date' ? 'date' : f.kind === 'textarea' ? 'textarea' : f.kind === 'amount' ? 'number' : 'text' });
    return `<div class="card as-field ${f.status === 'CONFLICT' || f.status === 'MISSING' || f.problem ? 'bad' : ''}">
      <div class="row between"><b class="small">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ''}</b>${chip([l, t], true)}</div>
      ${f.hint ? `<div class="xs muted mt4">${esc(f.hint)}</div>` : ''}
      ${input}
      ${where ? `<div class="xs muted">Source: ${esc(where)}${f.confidence != null && src.kind === 'document' ? ` · reading confidence ${Math.round(f.confidence * 100)}%` : ''}</div>` : ''}
      ${src && src.line ? `<div class="xs as-quote">“${esc(src.line)}”</div>` : ''}
      ${f.note ? `<div class="xs mt4" style="color:var(--amber)">${esc(f.note)}</div>` : ''}
      ${f.problem ? `<div class="ferr">${esc(f.problem)}</div>` : ''}
      ${f.status === 'CONFLICT' && editable ? `<div class="as-chips mt4">${f.conflicts.map(c => `<button class="as-chip" data-act="asstUseValue" data-key="${f.key}" data-v="${esc(c.value)}">Use ${esc(c.value)} <small>(${esc(c.source.label)})</small></button>`).join('')}</div>` : ''}
    </div>`;
  }

  // ------------------------------------------------------------------ review and submission

  function reviewTab(s, locked) {
    const i = s.institution, d = s.destination, c = s.counts;
    const allGreen = c.required && c.satisfied === c.required && !c.pendingManual;
    const docs = s.checklist.filter(x => x.uploaded);
    const status = s.submission ? `<div class="card as-done-card"><div class="row between"><b>Submitted</b>${chip([s.stateLabel, STATE_TONE[s.state] || 'slate'], true)}</div>
        <div class="kv"><span>Reference</span><span class="mono">${esc(s.submission.reference || '—')}</span></div>
        <div class="kv"><span>Submitted on</span><span>${fmtDT(s.submission.at)}</span></div>
        <div class="kv"><span>Sent to</span><span>${esc(s.submission.destination)}</span></div>
        ${s.stateDetail ? `<div class="xs mt8">${esc(s.stateDetail)}</div>` : ''}
        <button class="btn btn-outline btn-block btn-sm mt12" data-act="asstGoRecord">Open in the portal</button></div>` : '';
    return `${status}
      ${s.state === 'READY_FOR_SUBMISSION' ? `<div class="banner ok">${ic('checkCircle', 18)}<div><b>Ready for submission — not submitted.</b> This portal has no channel for this request. Download the package and send it through the official AICTE channel once you have confirmed the right authority.</div></div>` : ''}
      <div class="card"><div class="h3">Application</div>
        <div class="kv"><span>Institution</span><span>${esc(i.name)} (PID ${esc(i.pid)})</span></div>
        <div class="kv"><span>Request</span><span>${esc(s.workflowName)}</span></div>
        <div class="kv"><span>Goes to</span><span>${esc(d.role)}</span></div>
        <div class="xs muted mt4">${esc(d.why)} ${esc(d.note)}</div></div>
      <div class="card"><div class="h3">Checklist</div>
        <div class="small mt4">${allGreen ? `${c.satisfied} of ${c.required} required checklist items satisfied.`
          : `${c.satisfied} of ${c.required} required item(s) passed every check${c.pendingManual ? `; ${c.pendingManual} still need manual verification by AICTE or the bank` : ''}.`}</div>
        ${s.checklist.filter(x => x.applies).map(x => `<div class="vrow">${sIcon(!x.uploaded ? (x.blocking ? 'fail' : 'warn') : x.validation.status === 'GREEN' ? 'ok' : x.validation.status === 'AMBER' ? 'warn' : 'fail')}<div class="grow"><div class="small b">${esc(x.name)}</div>
          <div class="xs muted">${x.uploaded ? esc(x.file.fileName) + ' · ' + V_LABEL[x.validation.status] : x.blocking ? 'Not uploaded (required)' : 'Not uploaded'}${x.needsHumanReview ? ' · source not verified' : ''}</div></div>
          ${x.uploaded ? `<button class="btn btn-ghost btn-xs" data-act="asstPreview" data-key="${esc(x.docKey)}">${ic('eye', 14)}</button>` : ''}</div>`).join('')}</div>
      <div class="card"><div class="h3">Form</div>${s.form.map(f => `<div class="kv"><span>${esc(f.label)}</span><span>${esc(f.value || '—')}</span></div>`).join('')}
        ${!locked ? `<button class="link xs mt8" data-act="${s.state === 'AWAITING_USER_CONFIRMATION' ? 'asstBackEdit' : 'asstTab'}" data-v="form">Edit the form</button>` : ''}</div>
      ${s.blockers.length ? `<div class="card"><div class="h3" style="color:var(--red)">Must be fixed before submission</div><ul class="as-ul">${s.blockers.map(b => `<li>${esc(b)}</li>`).join('')}</ul></div>` : ''}
      ${s.warnings.length ? `<div class="card"><div class="h3">Please note</div><ul class="as-ul">${s.warnings.map(b => `<li>${esc(b)}</li>`).join('')}</ul></div>` : ''}
      <div class="banner warn">${ic('info', 18)}<div class="xs">These are automated checks, not an AICTE approval or a guarantee of acceptance. A document passing the checks is not proof that it is genuine; the bank confirms deposits in its Core Banking System.</div></div>
      <div class="row mt12" style="gap:8px"><button class="btn btn-outline btn-sm grow" data-act="asstDownload">${ic('download', 16)} Download draft</button><button class="btn btn-outline btn-sm grow" data-act="asstPrint">Print / save as PDF</button></div>
      ${locked ? '' : s.state === 'AWAITING_USER_CONFIRMATION' ? `<div class="card mt12"><label class="check"><input type="checkbox" id="asstDecl"> <span>I confirm that the information and documents are true and correct, that I am authorised to submit them for ${esc(i.name)}, and that I want this request sent to ${esc(d.role)}.</span></label>
          ${UI.err.asstDecl ? `<div class="ferr">${esc(UI.err.asstDecl)}</div>` : ''}
          <button class="btn btn-primary btn-block mt12" data-act="asstSubmit" ${UI.asst.busy ? 'disabled' : ''}>${ic('send', 18)} Confirm and submit</button></div>`
        : !s.integration && s.state !== 'READY_FOR_SUBMISSION' ? `<button class="btn btn-primary btn-block mt12" data-act="asstPackage" ${s.blockers.length ? 'disabled' : ''}>Prepare submission package</button>`
        : s.integration ? `<button class="btn btn-primary btn-block mt12" data-act="asstReview" ${s.blockers.length ? 'disabled' : ''}>Open final confirmation</button>` : ''}`;
  }

  // Printable draft / submission package. Labelled as a draft: it is not an official AICTE form.
  function packageHtml(s) {
    const e = esc, i = s.institution, d = s.destination;
    const rows = s.form.map(f => `<tr><td>${e(f.label)}</td><td>${e(f.value || '—')}</td><td>${e(f.source ? f.source.label + (f.source.page ? `, p. ${f.source.page}` : '') : '—')}</td><td>${e((F_LABEL[f.status] || [f.status])[0])}</td></tr>`).join('');
    const docs = s.checklist.filter(x => x.applies).map(x => `<tr><td>${e(x.name)}<br><small>${e(x.applicability)} · source: ${e(x.source.title)} (${e((SRC_LABEL[x.source.status] || [x.source.status])[0])})</small></td>
      <td>${x.file ? `${e(x.file.fileName)}<br><small>SHA-256 ${e(x.file.fileHash)}</small>` : 'Not uploaded'}</td><td>${x.validation ? e(V_LABEL[x.validation.status]) + (x.validation.issues.length ? '<br><small>' + x.validation.issues.map(z => e(z.message)).join('<br>') + '</small>' : '') : '—'}</td></tr>`).join('');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(s.workflowName)} — draft</title>
<style>body{font:14px/1.5 system-ui,sans-serif;color:#111;margin:24px;max-width:900px}h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse;margin:12px 0}td,th{border:1px solid #ccc;padding:6px;text-align:left;vertical-align:top}small{color:#555}.draft{border:2px solid #b45309;color:#7c2d12;padding:8px 12px;margin:12px 0;font-weight:600}</style></head><body>
<div class="draft">DRAFT prepared with the FDR Vault Regulatory Assistant. This is not an official AICTE form${s.submission ? '' : ' and has not been submitted'}.</div>
<h1>${e(s.workflowName)}</h1><p>${e(i.name)} (PID ${e(i.pid)}) · ${e(i.region)} Regional Office<br>Prepared ${e(fmtDT(now()))} · Status: ${e(s.stateLabel)}${s.submission ? ` · Reference ${e(s.submission.reference || '—')} (${e(fmtDT(s.submission.at))})` : ''}</p>
<h2>Destination</h2><p>${e(d.role)}<br><small>${e(d.why)} ${e(d.note)}</small></p>
<h2>Form</h2><table><tr><th>Field</th><th>Value</th><th>Source</th><th>Status</th></tr>${rows}</table>
<h2>Documents and checks</h2><table><tr><th>Requirement</th><th>File</th><th>Result</th></tr>${docs || '<tr><td colspan="3">None</td></tr>'}</table>
${s.blockers.length ? `<h2>Open issues</h2><ul>${s.blockers.map(b => `<li>${e(b)}</li>`).join('')}</ul>` : ''}
${s.warnings.length ? `<h2>Notes</h2><ul>${s.warnings.map(b => `<li>${e(b)}</li>`).join('')}</ul>` : ''}
<p><small>Automated checks are advisory and are not an AICTE approval. Attach the original documents listed above when submitting through an official channel.</small></p></body></html>`;
  }

  // ------------------------------------------------------------------ demo mode: the same API on this device

  window.LocalAssistant = {
    today: () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    sessions: () => { DB.assist = DB.assist || []; return DB.assist.filter(x => x.institutionId === inst().id); },
    find(id) { const x = this.sessions().find(z => z.id === id); if (!x) throw new ApiError('NOT_FOUND', 'Application not found.'); return x; },
    ctx(x) {
      const i = inst(), answers = { ...x.answers }, record = {};
      if (answers.fdrId) {
        const f = fdrById(answers.fdrId);
        if (f) {
          record.fdr = { id: f.id, fdrNumber: f.fdrNumber, amount: Math.round(f.amountLakhs * 1e5), bankName: f.bankName, branchName: f.branchName, ifscCode: f.ifscCode, issueDate: f.issueDate, maturityDate: f.maturityDate, isLienConfirmed: f.isLienConfirmed, released: fdrStatus(f) === 'RELEASED' };
          if (x.workflow === 'CORRECT_FDR' && answers.field) {
            answers.fieldLabel = Object.fromEntries(AR.QUESTIONS.CORRECT_FDR[1].options)[answers.field];
            record.fieldValue = { fdrNumber: f.fdrNumber, amount: record.fdr.amount, issueDate: f.issueDate, maturityDate: f.maturityDate, bank: `${f.bankName}, ${f.branchName} (${f.ifscCode})` }[answers.field] ?? '';
          }
        }
      }
      if (x.workflow === 'RESPOND_DEFICIENCY' && answers.applicationId) {
        const a = appById(answers.applicationId), r = a && a.scrutinyRecommendation;
        if (a) record.app = { id: a.id, applicationNumber: a.applicationNumber, status: a.status, points: (r && r.deficiencyPoints) || [], noticeNumber: r && r.officialNoticeNumber, noticeAt: r && r.timestamp };
      }
      if (x.workflow === 'NEW_FDR' && answers.purpose) { const a = appById(answers.purpose); answers.purposeNumber = a ? a.applicationNumber : ''; }
      const known = {};
      DB.apps.filter(a => a.institutionId === i.id).forEach(a => (a.documents || []).forEach(d => { known[d.fileHash] = `with ${a.applicationNumber}`; }));
      myFdrs().forEach(f => { if (f.evidence && f.evidence.fileHash) known[f.evidence.fileHash] = `as evidence for ${f.fdrNumber}`; });
      this.sessions().filter(o => o.id !== x.id).forEach(o => o.docs.forEach(d => { known[d.fileHash] = 'in another assistant application'; }));
      return { workflow: x.workflow, answers, record, today: this.today(), userValues: x.userValues, knownHashes: known, docs: x.docs,
        institution: { name: i.name, pid: i.pid, region: i.region, requiredFdrLakhs: i.requiredFdrLakhs } };
    },
    view(x) {
      const ctx = this.ctx(x), ev = AR.evaluate(ctx), wf = x.workflow ? AR.workflowOf(x.workflow) : null;
      let state = AR.state({ workflow: x.workflow, answers: ctx.answers, reviewOpened: x.reviewOpened, packaged: !!x.packagedAt, submission: x.submission }, ev), detail = null;
      if (x.submission) [state, detail] = this.derived(x);
      return { id: x.id, workflow: x.workflow, workflowName: wf && wf.name, destination: wf && wf.destination, integration: wf ? !!wf.integration : null,
        answers: x.answers, messages: x.messages, state, stateLabel: AR.STATE_LABELS[state], stateDetail: detail, submission: x.submission, packagedAt: x.packagedAt,
        record: ctx.record, institution: ctx.institution, nextQuestion: x.workflow ? AR.nextQuestion(x.workflow, x.answers) : null,
        checklist: ev.checklist, form: ev.form, blockers: ev.blockers, warnings: ev.warnings, counts: ev.counts, createdAt: x.createdAt, updatedAt: x.updatedAt };
    },
    derived(x) {
      const r = x.submission.result || {};
      if (x.submission.fn === 'submit_fdr') { const f = fdrById(r.fdrId); return !f ? ['SUBMITTED', null] : f.isLienConfirmed ? ['APPROVED', 'The bank endorsed the joint lien.'] : ['UNDER_REVIEW', 'Waiting for the bank to endorse the joint lien.']; }
      if (x.submission.fn === 'submit_compliance_response') { const a = appById(r.applicationId); return a ? [{ DEFICIENCIES_NOTED: 'CLARIFICATION_REQUIRED', APPROVED: 'APPROVED', REJECTED: 'REJECTED' }[a.status] || 'UNDER_REVIEW', null] : ['SUBMITTED', null]; }
      if (x.submission.fn === 'raise_ticket') return ['UNDER_REVIEW', `Helpdesk ticket ${r.ticketNo}`];
      return ['UNDER_REVIEW', 'Waiting for an AICTE administrator to decide.'];
    },
    touch(x) { x.updatedAt = new Date().toISOString(); save(); return this.view(x); },
    editable(x) { if (x.submission) throw new ApiError('INVALID_STATE', 'This application has been submitted and can no longer be changed.'); },
    sampleExtraction(x, docKey) {
      const ctx = this.ctx(x), req = AR.checklist(ctx).find(i => i.docKey === docKey), f = ctx.record.fdr, today = ctx.today, i = ctx.institution;
      const base = { documentKind: `Sample ${req.name}`, matchesExpectedType: true, legibility: 'clear', institutionNameInDocument: i.name, issuingAuthority: x.answers.bankName || (f && f.bankName) || '',
        referenceNumber: '', issueDate: '', validTill: '', amountInr: '', fdrNumber: '', bankName: x.answers.bankName || (f && f.bankName) || '', lienHolder: `Regional Officer, ${i.region} Regional Office, AICTE`,
        maturityDate: '', facultyProfessors: '', facultyAssociate: '', facultyAssistant: '', keyFields: [], anomalies: [], summary: 'Sample document generated in demo mode.', confidence: 0.9 };
      if (req.docType !== 'FDR_CORPUS') return base;
      const prefix = (AR.BANK_PREFIX[base.bankName] || 'SBIN').slice(0, 4).replace('SBIN', 'SBI');
      if (x.workflow === 'NEW_FDR' || x.workflow === 'REPLACE_FDR') {
        const n = `${prefix}-FDR-${rand(10000, 99999)}-${today.slice(0, 4)}`;
        return { ...base, fdrNumber: n, amountInr: String(f ? f.amount : i.requiredFdrLakhs * 1e5), issueDate: today, maturityDate: AR.addYears(today, 10), keyFields: [{ label: 'FDR No.', value: n, page: 1, sourceLine: `Receipt No. ${n}` }] };
      }
      return { ...base, fdrNumber: f.fdrNumber, amountInr: String(f.amount), issueDate: f.issueDate, maturityDate: x.workflow === 'RENEW_FDR' ? `${+f.maturityDate.slice(0, 4) + 10}${f.maturityDate.slice(4)}` : f.maturityDate };
    },
    async handle(method, path, body = {}) {
      const p = path.split('/').filter(Boolean);
      if (method === 'GET' && p[0] === 'sessions' && !p[1]) return this.sessions().slice().reverse().map(x => ({ id: x.id, workflow: x.workflow, workflowName: x.workflow && AR.workflowOf(x.workflow).name, submitted: !!x.submission, reference: x.submission && x.submission.reference, packagedAt: x.packagedAt, createdAt: x.createdAt, updatedAt: x.updatedAt }));
      if (method === 'POST' && p[0] === 'sessions' && !p[1]) {
        const x = { id: uuid(), institutionId: inst().id, workflow: body.workflow || null, answers: {}, userValues: {}, messages: [], docs: [], reviewOpened: false, packagedAt: null, submission: null, createdAt: new Date().toISOString() };
        DB.assist = DB.assist || []; DB.assist.push(x); logAudit('ASSISTANT_STARTED', 'ASSISTANT', x.id, 'Regulatory Assistant started'); return this.touch(x);
      }
      if (method === 'POST' && p[0] === 'classify') return AR.classify(body.text);
      const x = this.find(p[1]), sub = p[2];
      if (method === 'GET') return this.view(x);
      if (sub === 'messages') { x.messages = [...x.messages, ...body.messages.map(m => ({ ...m, at: new Date().toISOString() }))].slice(-100); save(); return { ok: true }; }
      this.editable(x);
      if (sub === 'answer') {
        if (body.workflow !== undefined) { if (body.workflow !== x.workflow) Object.assign(x, { workflow: body.workflow, answers: {}, userValues: {}, docs: [], reviewOpened: false, packagedAt: null }); return this.touch(x); }
        const q = (AR.QUESTIONS[x.workflow] || []).find(z => z.key === body.key);
        if (!q) throw new ApiError('VALIDATION', 'Unknown question.');
        if (body.value === '' || body.value === '__reset') { delete x.answers[q.key]; return this.touch(x); }
        if (q.kind === 'choice' && !q.options.some(o => o[0] === body.value)) throw new ApiError('VALIDATION', 'Choose one of the options.');
        x.answers[q.key] = body.value;
        return this.touch(x);
      }
      if (sub === 'documents' && !p[3]) {
        const meta = body.file;
        x.docs = x.docs.filter(d => d.docKey !== body.docKey).concat({ docKey: body.docKey, ...meta, uploadedAt: new Date().toISOString(), extraction: null, extractionError: 'AI_NOT_CONFIGURED' });
        Object.assign(x, { reviewOpened: false, packagedAt: null });
        logAudit('ASSISTANT_DOCUMENT_UPLOADED', 'ASSISTANT', x.id, `${meta.fileName} (SHA-256 ${meta.fileHash.slice(0, 8)}...), not read automatically (demo mode).`);
        return this.touch(x);
      }
      if (sub === 'sample') {
        const ext = this.sampleExtraction(x, body.docKey), hash = await sha256(new TextEncoder().encode(x.id + body.docKey + Date.now()));
        x.docs = x.docs.filter(d => d.docKey !== body.docKey).concat({ docKey: body.docKey, fileName: `Sample_${body.docKey}.pdf`, mimeType: 'application/pdf', fileHash: hash, fileSizeBytes: 120000, pageCount: 2, storagePath: null, sample: true, uploadedAt: new Date().toISOString(), extraction: ext });
        return this.touch(x);
      }
      if (sub === 'documents' && p[4] === 'remove') { x.docs = x.docs.filter(d => d.docKey !== p[3]); x.reviewOpened = false; return this.touch(x); }
      if (sub === 'form') {
        const schema = AR.formSchema(x.workflow, this.ctx(x).record);
        for (const [k, v] of Object.entries(body.values || {})) { const f = schema.find(z => z.key === k); if (f && !f.readOnly) { if (v === null || v === '') delete x.userValues[k]; else x.userValues[k] = String(v); } }
        Object.assign(x, { reviewOpened: false, packagedAt: null });
        return this.touch(x);
      }
      const v = this.view(x);
      if (sub === 'review') { if (body.open && v.blockers.length) throw new ApiError('BLOCKED', 'Fix the remaining issues before the final review.', v.blockers); x.reviewOpened = !!body.open; return this.touch(x); }
      if (sub === 'package') { if (v.blockers.length) throw new ApiError('BLOCKED', 'Fix the remaining issues first.', v.blockers); if (!v.integration) x.packagedAt = new Date().toISOString(); return this.touch(x); }
      if (sub === 'submit') {
        if (!v.integration) throw new ApiError('NO_INTEGRATION', 'This request cannot be submitted through the portal.');
        if (!x.reviewOpened) throw new ApiError('INVALID_STATE', 'Open the final review before submitting.');
        if (v.blockers.length) throw new ApiError('BLOCKED', 'Some requirements are not met yet.', v.blockers);
        const ctx = this.ctx(x), files = x.docs.map(d => ({ fileName: d.fileName, fileHash: d.fileHash, fileSizeKb: Math.round(d.fileSizeBytes / 1024), mimeType: d.mimeType, storagePath: d.storagePath }));
        const evidence = x.workflow === 'RESPOND_DEFICIENCY' ? files : files[0];
        const call = AR.submissionPayload(x.workflow, v.form, ctx.record, evidence), a = call.args;
        let result;
        if (call.fn === 'submit_fdr') result = await Backend.submitFdr({ ...a.p, amountRs: a.p.amountRs }, a.p.evidence);
        else if (call.fn === 'request_fdr_renewal') { await Backend.requestRenewal(a.p_fdr_id, a.p); result = { requestId: `${a.p_fdr_id}:${a.p.mode}` }; }
        else if (call.fn === 'request_lien_release') { await Backend.requestRelease(a.p_fdr_id, a.p_reason, true); result = { requestId: `${a.p_fdr_id}:release` }; }
        else if (call.fn === 'raise_ticket') result = { ticketNo: await Backend.raiseTicket({ category: a.p_category, ref: a.p_ref, subject: a.p_subject, desc: a.p_description }) };
        else { const r = await Backend.submitResponse(a.p_application_id, a.p_responses, a.p_files); result = { applicationId: a.p_application_id, version: r.version }; }
        x.submission = { fn: call.fn, result, reference: result.ticketNo || result.fdrId || (result.version && `${ctx.record.app.applicationNumber} v${result.version}`) || result.requestId, at: new Date().toISOString(), destination: AR.workflowOf(x.workflow).destination.role };
        x.reviewOpened = false;
        logAudit('ASSISTANT_SUBMITTED', 'ASSISTANT', x.id, `${AR.workflowOf(x.workflow).name} submitted (demo mode).`);
        return this.touch(x);
      }
      throw new ApiError('NOT_FOUND', 'Unknown request.');
    },
  };
})();
