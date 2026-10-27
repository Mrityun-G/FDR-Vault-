/* Backend abstraction for the Institution portal.
   - Server mode (config.js has API_URL): auth, RPC workflow functions, private storage, live updates via the project API (server/).
   - Demo mode (no keys): the same operations against an on-device store, with the same rules and semantics.
   The UI only calls Backend.*; it never writes server state directly. */
'use strict';

class ApiError extends Error {
  constructor(code, message, fields) { super(message); this.code = code; this.fields = fields || null; }
}

const CFG = window.AICTE_CONFIG || {};
const REMOTE = !!CFG.API_URL;
const BUCKET = CFG.STORAGE_BUCKET || 'institution-documents';

const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));
const safeName = n => n.normalize('NFKD').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(-120);
// AICTE regional office for a state (same mapping as public._region_for on the server).
const REGION_OF = {
  Central: ['Madhya Pradesh', 'Chhattisgarh', 'Gujarat'],
  Eastern: ['West Bengal', 'Odisha', 'Jharkhand', 'Bihar', 'Assam', 'Arunachal Pradesh', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Sikkim', 'Tripura', 'Andaman and Nicobar Islands'],
  'North-Central': ['Uttar Pradesh', 'Uttarakhand'],
  'North-Western': ['Punjab', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Ladakh', 'Chandigarh'],
  'South-Central': ['Andhra Pradesh', 'Telangana'],
  Southern: ['Tamil Nadu', 'Puducherry'],
  'South-Western': ['Karnataka', 'Kerala', 'Lakshadweep'],
  Western: ['Maharashtra', 'Goa', 'Dadra and Nagar Haveli and Daman and Diu'],
};
const regionFor = state => Object.keys(REGION_OF).find(k => REGION_OF[k].includes(state)) || 'Northern';

function setRemember(on) { try { localStorage.setItem('aicte-remember', on === false ? '0' : '1'); } catch (e) { /* ignore */ } }
const rememberStorage = {
  pick() { try { return localStorage.getItem('aicte-remember') === '0' ? sessionStorage : localStorage; } catch (e) { return null; } },
  getItem(k) { try { return this.pick()?.getItem(k) ?? null; } catch (e) { return null; } },
  setItem(k, v) { try { this.pick()?.setItem(k, v); } catch (e) { /* ignore */ } },
  removeItem(k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) { /* ignore */ } },
};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = () => reject(new ApiError('NETWORK', 'Could not load the secure client library. Check your connection and retry.'));
    document.head.appendChild(s);
  });
}

// Server errors are raised as "CODE: message" with JSON field errors in `details` (see _fail() in the migration).
function toApiError(e) {
  if (e instanceof ApiError) return e;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return new ApiError('OFFLINE', "You're offline. Reconnect and try again.");
  const msg = String((e && (e.message || e.error_description || e.msg)) || 'Unexpected error');
  const m = /^([A-Z_]+): ([\s\S]*)$/.exec(msg);
  if (m) {
    let fields = null;
    try { fields = e.details ? JSON.parse(e.details) : null; } catch (x) { fields = null; }
    return new ApiError(m[1], m[2], fields);
  }
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg)) return new ApiError('NETWORK', 'The server could not be reached. Your data has not been lost — please retry.');
  if (/JWT|token is expired|invalid claim|refresh token/i.test(msg)) return new ApiError('SESSION_EXPIRED', 'Your session has expired. Please sign in again.');
  if (/Invalid login credentials/i.test(msg)) return new ApiError('INVALID_CREDENTIALS', 'Invalid User ID or Password. Check your credentials and try again.');
  if (/Email not confirmed/i.test(msg)) return new ApiError('EMAIL_NOT_CONFIRMED', 'Verify your email address using the link we sent, then sign in.');
  if (/rate limit|too many/i.test(msg)) return new ApiError('RATE_LIMITED', 'Too many attempts. Please wait a minute and try again.');
  if (/already registered|already exists/i.test(msg)) return new ApiError('VALIDATION', 'This email is already registered — please login.', { email: 'This email is already registered — please login' });
  return new ApiError('SERVER', msg);
}

// Payload sent to submit_application (validation dry-run or final submission).
function buildPayload(w) {
  const f = w.fdr;
  return {
    type: w.type, inst: w.inst, prog: w.prog, draftId: w.draftId || null, declared: !!w.declared, esign: w.esign || null,
    fdr: f.mode === 'existing' ? { mode: 'existing', existingId: f.existingId }
      : { mode: 'new', fdrNumber: (f.fdrNumber || '').trim().toUpperCase(), bankName: f.bankName, branchName: (f.branchName || '').trim(), ifscCode: (f.ifscCode || '').trim().toUpperCase(), amount: +f.amountRs || 0, issueDate: f.issueDate, maturityDate: f.maturityDate },
    docs: DOC_TYPES.filter(d => w.docs[d.type]).map(d => {
      const x = w.docs[d.type], a = w.ai && w.ai.docs.find(z => z.type === d.type);
      return { docType: d.type, fileName: x.fileName, fileSizeBytes: x.fileSizeBytes || x.fileSizeKb * 1024, mimeType: x.mimeType || 'application/pdf', fileHash: x.fileHash,
        storagePath: x.storagePath || null, pageCount: x.pageCount, validTill: x.validTill || '',
        extractedFields: a ? a.fields : [], forensics: a ? a.forensics : {}, aiAnalysis: a ? a.gemini : null, clientStatus: a ? a.status : 'ok' };
    }),
    aiSummary: w.ai ? w.ai.summary : null,
    aiFindings: w.ai ? w.ai.findings.filter(x => x.isDeterministic === false) : [],
    crossChecks: w.ai ? w.ai.cross : [],
  };
}
// Values the institution declared in the form, sent so the AI reading can be cross-checked against them.
function declaredFor(w, type) {
  const f = wizardFdr(w), p = w.prog, x = w.docs[type] || {};
  const d = { validTill: x.validTill || undefined };
  if ((type === 'FDR_CORPUS' || type === 'BANK_LETTER') && f) Object.assign(d, { fdrNumber: f.fdrNumber, amountInr: Math.round(f.amountLakhs * 1e5), bankName: f.bankName, issueDate: f.issueDate, maturityDate: f.maturityDate });
  if (type === 'FACULTY_CADRE') Object.assign(d, { professors: +p.professors, associateProfessors: +p.associateProfessors, assistantProfessors: +p.assistantProfessors });
  return d;
}
const draftPayload = w => JSON.parse(JSON.stringify({ ...w, ai: null, savedAt: new Date().toISOString() }));

/* ------------------------------------------------------------------ server (API) implementation */
const Remote = {
  sb: null, channel: null, refreshTimer: 0,
  async init() {
    if (!window.AicteApi) await loadScript(CFG.API_CLIENT_URL || 'api-client.js');
    this.sb = window.AicteApi.createClient(CFG.API_URL, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: rememberStorage, storageKey: 'aicte-irvp-auth' },
    });
    this.sb.auth.onAuthStateChange((event, session) => { if (Backend.onAuthEvent) setTimeout(() => Backend.onAuthEvent(event, session), 0); });
    const { data } = await this.sb.auth.getSession();
    if (!data.session) return false;
    await this.refresh();
    this.subscribe();
    return true;
  },
  async rpc(fn, args) {
    if (!navigator.onLine) throw new ApiError('OFFLINE', "You're offline. Reconnect and try again.");
    const { data, error } = await this.sb.rpc(fn, args || {});
    if (error) throw toApiError(error);
    return data;
  },
  async afterSignIn(method) {
    try { await this.refresh(); } catch (e) {
      // A new Google account keeps its session so the user can enter their registration details.
      if (e.code !== 'REGISTRATION_REQUIRED') await this.sb.auth.signOut().catch(() => {});
      throw e;
    }
    this.rpc('log_client_event', { p_action: 'USER_LOGIN_SUCCESS', p_details: `Institution portal login via ${method} (mobile).` }).catch(() => {});
    this.subscribe();
  },
  async signIn(email, password, remember) {
    if (!/@/.test(email)) throw new ApiError('VALIDATION', 'Use your registered official email address to sign in.', { email: 'Enter your registered email address' });
    setRemember(remember);
    const { error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw toApiError(error);
    await this.afterSignIn('PASSWORD');
  },
  async otpStart(email) {
    const { error } = await this.sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
    if (error) throw toApiError(error);
    return { delivery: 'email' };
  },
  async otpVerify(email, code) {
    setRemember(true);
    const { error } = await this.sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    if (error) throw new ApiError('INVALID_OTP', 'Incorrect or expired code. Request a new one and try again.');
    await this.afterSignIn('OTP');
  },
  async sso() {
    if (!CFG.SSO_DOMAIN) throw new ApiError('NOT_CONFIGURED', 'Government SSO is not configured for this deployment. Sign in with your email and password or an OTP.');
    const { data, error } = await this.sb.auth.signInWithSSO({ domain: CFG.SSO_DOMAIN, options: { redirectTo: location.origin + location.pathname } });
    if (error) throw toApiError(error);
    location.href = data.url;
  },
  async google() {
    // Google refuses OAuth inside embedded WebViews, so the Android app signs in with email/password or OTP instead.
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())
      throw new ApiError('NOT_SUPPORTED', 'Google sign-in is available on the web portal. In the Android app, sign in with your email and password or an OTP.');
    setRemember(true);
    const { data, error } = await this.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } } });
    if (error) throw toApiError(error);
    location.href = data.url;
  },
  async sendReset(email) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname });
    if (error) throw toApiError(error);
  },
  async setNewPassword(pw) {
    const { error } = await this.sb.auth.updateUser({ password: pw });
    if (error) throw toApiError(error);
  },
  async register(r) {
    const { password, confirm, agree, ...registration } = r;
    const { data, error } = await this.sb.auth.signUp({
      email: r.email.trim(), password,
      options: { emailRedirectTo: location.origin + location.pathname, data: { full_name: r.head, registration: { ...registration, role: 'INSTITUTION' } } },
    });
    if (error) throw toApiError(error);
    if (!data.session) return { signedIn: false, emailConfirmation: true };   // active once the email is confirmed
    await this.afterSignIn('REGISTRATION');
    return { signedIn: true };
  },
  // Registration details for an account created by Google sign-in (asked once, on the first login).
  async completeRegistration(r) {
    const { password, confirm, agree, email, ...registration } = r;
    await this.rpc('complete_registration', { p: { ...registration, role: 'INSTITUTION' } });
    await this.afterSignIn('GOOGLE');
  },
  async sessionEmail() {
    const { data } = await this.sb.auth.getSession();
    return data.session ? data.session.user.email : '';
  },
  async signOut() {
    await this.rpc('log_client_event', { p_action: 'USER_LOGOUT', p_details: 'Signed out of the mobile portal.' }).catch(() => {});
    this.unsubscribe();
    await this.sb.auth.signOut();
  },
  async changePassword(email, current, next) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password: current });
    if (error) throw new ApiError('VALIDATION', 'Current password is incorrect.', { current: 'Current password is incorrect' });
    await this.setNewPassword(next);
    await this.rpc('log_client_event', { p_action: 'PASSWORD_CHANGED', p_details: 'Account password changed from mobile portal.' });
  },
  async refresh() {
    applyServerState(await this.rpc('get_portal_state'));
    // Google profile photo of the signed-in account (saved by the server at Google sign-in), shown as the avatar.
    const { data } = await this.sb.auth.getSession();
    const pic = data && data.session && data.session.user && (data.session.user.user_metadata || {}).avatar_url;
    if (DB.users[0]) DB.users[0].avatarUrl = /^https:\/\/[a-z0-9-]+\.googleusercontent\.com\//.test(pic || '') ? pic : '';
  },
  async upload(file) {
    if (!navigator.onLine) throw new ApiError('OFFLINE', "You're offline. Reconnect to upload.");
    const path = `${inst().id}/${uuid()}/${safeName(file.name)}`;
    const { error } = await this.sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (error) throw toApiError(error);
    return path;
  },
  async signedUrl(path) {
    const { data, error } = await this.sb.storage.from(BUCKET).createSignedUrl(path, 120);
    if (error) throw toApiError(error);
    return data.signedUrl;
  },
  async saveDraft(w) {
    w.draftId = await this.rpc('save_draft', { p_id: w.draftId || null, p_type: w.type, p_payload: draftPayload(w) });
    await this.refresh();
  },
  async validate(w) {
    const r = await this.rpc('submit_application', { p_payload: buildPayload(w), p_idempotency_key: null, p_dry_run: true });
    return r.findings;
  },
  async submitApplication(w) {
    const r = await this.rpc('submit_application', { p_payload: buildPayload(w), p_idempotency_key: w.idemKey, p_dry_run: false });
    await this.refresh();
    return { applicationId: r.applicationId, applicationNumber: r.applicationNumber, replayed: r.replayed };
  },
  async submitResponse(appId, responses, files) {
    const r = await this.rpc('submit_compliance_response', { p_application_id: appId, p_responses: responses, p_files: files });
    await this.refresh();
    return r;
  },
  async submitFdr(p, evidence) {
    const r = await this.rpc('submit_fdr', { p: { ...p, amount: +p.amountRs, evidence } });
    await this.refresh();
    return { fdrId: r.fdrId };
  },
  async requestRenewal(fdrId, p) {
    await this.rpc('request_fdr_renewal', { p_fdr_id: fdrId, p: { ...p, amount: p.amountRs ? +p.amountRs : undefined } });
    await this.refresh();
  },
  async requestRelease(fdrId, reason, certified) {
    await this.rpc('request_lien_release', { p_fdr_id: fdrId, p_reason: reason, p_certified: certified });
    await this.refresh();
  },
  async markRead(ids) { await this.rpc('mark_notifications_read', { p_ids: ids || null }); await this.refresh(); },
  async raiseTicket(r) {
    const t = await this.rpc('raise_ticket', { p_category: r.category, p_ref: r.ref || null, p_subject: r.subject, p_description: r.desc });
    await this.refresh();
    return t.ticketNo;
  },
  async updateInstitution(r) { await this.rpc('update_institution_profile', { p: r }); await this.refresh(); },
  async updateContact(r) { await this.rpc('update_contact_details', { p: r }); await this.refresh(); },
  async deleteDraft(id) { await this.rpc('delete_draft', { p_id: id }); await this.refresh(); },
  // Reads each uploaded document with Claude (server function "analyze-document"). Advisory; never blocks submission.
  async analyzeDocuments(w, onEach) {
    const docs = DOC_TYPES.filter(d => w.docs[d.type] && w.docs[d.type].storagePath);
    const results = {};
    let next = 0;
    const worker = async () => {
      while (next < docs.length) {
        const d = docs[next++], x = w.docs[d.type];
        try {
          const { data, error } = await this.sb.functions.invoke('analyze-document', { body: { storagePath: x.storagePath, docType: d.type, mimeType: x.mimeType, declared: declaredFor(w, d.type) } });
          if (error) {
            let body = null;
            try { body = error.context && typeof error.context.json === 'function' ? await error.context.json() : null; } catch (e) { body = null; }
            results[d.type] = { error: (body && body.message) || error.message || 'AI service unavailable', code: (body && body.code) || (error.context && error.context.status === 404 ? 'AI_NOT_DEPLOYED' : 'AI_UNAVAILABLE') };
          } else results[d.type] = data;
        } catch (e) { results[d.type] = { error: toApiError(e).message, code: 'AI_UNAVAILABLE' }; }
        if (onEach) onEach(d.type);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    return results;
  },
  subscribe() {
    const i = inst();
    if (!i || this.channel) return;
    const onChange = () => {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = setTimeout(() => this.refresh().then(() => Backend.onRemoteChange && Backend.onRemoteChange()).catch(() => {}), 700);
    };
    let ch = this.sb.channel(`institution-${i.id}`);
    ['notifications', 'applications', 'fdrs', 'scrutiny', 'fdr_requests'].forEach(table => {
      ch = ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `institution_id=eq.${i.id}` }, onChange);
    });
    this.channel = ch.subscribe();
  },
  unsubscribe() { if (this.channel) { this.sb.removeChannel(this.channel); this.channel = null; } },
};

// Maps get_portal_state() into the client's in-memory cache (never persisted to device storage).
function applyServerState(s) {
  DB.users = [s.me];
  DB.institutions = [s.institution];
  DB.apps = s.apps || [];
  DB.fdrs = (s.fdrs || []).map(f => ({ ...f, amountLakhs: Number(f.amountLakhs) }));
  DB.notifs = s.notifs || [];
  DB.audit = s.audit || [];
  DB.tickets = s.tickets || [];
  const keep = DB.adapters && DB.adapters[s.institution.id];
  DB.adapters = { [s.institution.id]: keep || seedAdapters(s.institution, DB.fdrs.find(f => f.isLienConfirmed && f.status !== 'RELEASED')) };
  DB.session = { userId: s.me.id, at: s.serverTime, remote: true };
  DB.ruleVersion = s.ruleVersion;
}

/* ------------------------------------------------------------------ on-device demo implementation */
const LocalFiles = {};   // sha256 -> object URL (session only) so uploaded documents can be previewed in demo mode

const Local = {
  async init() { return !!me(); },
  async signIn(email, password, remember) {
    await delay(600);
    const q = email.trim().toLowerCase();
    const u = DB.users.find(x => x.email.toLowerCase() === q || x.id.toLowerCase() === q || (x.pid && x.pid.toLowerCase() === q));
    if (!u) throw new ApiError('INVALID_CREDENTIALS', 'Invalid User ID or Password. Check your credentials and try again.');
    if (u.role !== 'INSTITUTION') throw new ApiError('ROLE_MISMATCH', `This account (${u.name}) is registered as ${u.role.replace('_', ' ')}. Sign in on the AICTE staff portal instead.`);
    if (!password || password.length < 4) throw new ApiError('INVALID_CREDENTIALS', 'Invalid password. Password must be at least 4 characters.');
    if (DB.pwHash[u.id] && DB.pwHash[u.id] !== await sha256(password)) throw new ApiError('INVALID_CREDENTIALS', 'Invalid User ID or Password. Check your credentials and try again.');
    this.startSession(u, 'PASSWORD', remember);
  },
  startSession(u, method, remember) {
    DB.session = { userId: u.id, token: `aicte-jwt-${u.id}-${Date.now()}`, at: now().toISOString(), method, remember: remember !== false };
    logAudit('USER_LOGIN_SUCCESS', 'USER', u.id, `Institution portal login via ${method} (mobile).`);
    save();
  },
  async otpStart(id) {
    const q = id.trim().toLowerCase();
    const u = DB.users.find(x => x.email.toLowerCase() === q || (x.pid && x.pid === q) || x.id === q);
    if (!u) throw new ApiError('NOT_FOUND', 'No account found for this Email / PID.');
    if (u.role !== 'INSTITUTION') throw new ApiError('ROLE_MISMATCH', `This account (${u.name}) is registered as ${u.role.replace('_', ' ')}. Sign in on the AICTE staff portal instead.`);
    this.otp = { user: u.id, code: String(rand(100000, 999999)) };
    return { delivery: 'demo', demoCode: this.otp.code, mask: (u.mobile || '').slice(-4) };
  },
  async otpVerify(id, code) {
    if (!this.otp || code.trim() !== this.otp.code) throw new ApiError('INVALID_OTP', 'Incorrect OTP. Please try again.');
    this.startSession(DB.users.find(u => u.id === this.otp.user), 'OTP', true);
    this.otp = null;
  },
  async ssoAs(userId) { this.startSession(DB.users.find(u => u.id === userId), 'SSO', true); },
  async google() { throw new ApiError('NOT_CONFIGURED', 'Google sign-in needs the AICTE server. In demo mode, use the test credentials below.'); },
  async sendReset() { throw new ApiError('NOT_SUPPORTED', 'Password reset emails are not available in demo mode.'); },
  // Registration activates the account immediately (no DTE / AICTE approval step).
  async register(r) {
    if (DB.users.some(u => u.email.toLowerCase() === r.email.toLowerCase())) throw new ApiError('VALIDATION', 'This email is already registered — please login.', { email: 'This email is already registered — please login' });
    const pid = (r.pid || '').trim().toUpperCase() || `1-${rand(20000000, 29999999)}`;
    let i = DB.institutions.find(x => x.pid.toUpperCase() === pid);
    if (i && DB.users.some(u => u.institutionId === i.id)) throw new ApiError('VALIDATION', 'This PID is already registered to another account. Sign in with that account.', { pid: 'This PID is already registered' });
    if (!i) {
      i = { id: uid('inst'), name: r.name.trim(), short: r.name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 6).toUpperCase(), pid, city: r.district.trim(), district: r.district.trim(), state: r.state,
        region: regionFor(r.state), type: r.type, address: `${r.district.trim()}, ${r.state}`, website: '', sanctionedIntake: 0, totalStudents: 0, sfr: '—', requiredFdrLakhs: 100 };
      DB.institutions.push(i);
      DB.adapters[i.id] = seedAdapters(i, null);
    }
    const u = { id: uid('user'), name: r.head.trim(), email: r.email.trim(), role: 'INSTITUTION', designation: 'Head of Institution', institutionId: i.id, pid: i.pid, region: i.region, mobile: r.mobile.trim() };
    DB.users.push(u);
    DB.pwHash[u.id] = await sha256(r.password);
    const { password, confirm, ...rest } = r;
    DB.registrations.push({ id: `REG-${now().getFullYear()}-${rand(10000, 99999)}`, ...rest, at: now().toISOString(), status: 'ACTIVATED' });
    this.startSession(u, 'REGISTRATION', true);
    return { signedIn: true };
  },
  async signOut() { logAudit('USER_LOGOUT', 'USER', me().id, 'Signed out of the mobile portal.'); DB.session = null; save(); },
  async changePassword(email, current, next) {
    const u = me(), stored = DB.pwHash[u.id];
    if (stored ? stored !== await sha256(current) : current.length < 4) throw new ApiError('VALIDATION', 'Current password is incorrect.', { current: 'Current password is incorrect' });
    DB.pwHash[u.id] = await sha256(next);
    logAudit('PASSWORD_CHANGED', 'USER', u.id, 'Account password changed from mobile portal.');
  },
  async refresh() { /* on-device store is always current */ },
  async upload(file, hash) { LocalFiles[hash] = URL.createObjectURL(file); return null; },
  async signedUrl(path, hash) {
    if (LocalFiles[hash]) return LocalFiles[hash];
    throw new ApiError('NOT_AVAILABLE', 'Document content is not retained in demo mode (only its fingerprint and metadata).');
  },
  async saveDraft(w) {
    const ts = now().toISOString();
    if (!w.draftId) w.draftId = uid('app');
    const fdr = wizardFdr(w);
    DB.apps = DB.apps.filter(a => a.id !== w.draftId);
    DB.apps.push({ id: w.draftId, applicationNumber: null, institutionId: inst().id, type: w.type, status: 'DRAFT', academicYear: w.inst.academicYear, submittedAt: null, lastUpdatedAt: ts, currentVersion: 0, fdrNumber: fdr ? fdr.fdrNumber : '', intakeDetails: {}, documents: [], findings: [], responses: [], draft: draftPayload(w) });
    save();
  },
  async deleteDraft(id) { DB.apps = DB.apps.filter(a => !(a.id === id && a.status === 'DRAFT')); save(); },
  async validate() { return null; },   // client rule engine results are used as-is in demo mode
  async analyzeDocuments() { return null; },   // demo mode keeps the on-device preview
  async submitApplication(w) {
    await delay(500);
    const existing = DB.apps.find(a => a.idempotencyKey && a.idempotencyKey === w.idemKey);
    if (existing) return { applicationId: existing.id, applicationNumber: existing.applicationNumber, replayed: true };
    const i = inst(), u = me(), t = typeOf(w.type), fdr = wizardFdr(w), n = norms(w.prog);
    const appNo = `APP-${now().getFullYear()}-${t.prefix}-${rand(1000, 9999)}`;
    const ts = now().toISOString();
    const app = {
      id: w.draftId || uid('app'), applicationNumber: appNo, institutionId: i.id, type: w.type, status: 'SUBMITTED', academicYear: w.inst.academicYear,
      submittedAt: ts, lastUpdatedAt: ts, currentVersion: 1, fdrNumber: fdr.fdrNumber, programme: { ...w.prog }, institutionSnapshot: { ...w.inst }, idempotencyKey: w.idemKey,
      intakeDetails: { currentTotalIntake: +w.prog.currentTotalIntake, proposedTotalIntake: +w.prog.proposedTotalIntake, totalStudents: n.st, facultyCount: n.fac, professors: n.P, associateProfessors: n.A, assistantProfessors: n.S, totalBuiltUpAreaSqM: n.area, fdrCorpusAmountLakhs: fdr.amountLakhs, requiredFdrAmountLakhs: requiredLakhs() },
      documents: w.ai.docs.map(a => {
        const d = w.docs[a.type];
        return { id: uid('doc'), docType: a.type, fileName: d.fileName, fileSizeKb: d.fileSizeKb, fileHash: d.fileHash, storagePath: d.storagePath || null, uploadedAt: d.uploadedAt || ts, version: 1, pageCount: d.pageCount, status: a.status === 'ok' ? 'PROCESSED' : 'FLAGGED', validTill: d.validTill, extractedFields: a.fields, forensics: a.forensics, geminiAnalysis: a.gemini };
      }),
      findings: w.ai.findings, crossChecks: w.ai.cross, aiSummary: w.ai.summary, esign: w.esign, declaration: true, responses: [],
      history: [{ from: null, to: 'SUBMITTED', at: ts, actorRole: 'INSTITUTION' }],
    };
    DB.apps = DB.apps.filter(a => a.id !== app.id);
    DB.apps.push(app);
    if (w.fdr.mode === 'new') {
      DB.fdrs.push({ id: uid('fdr'), fdrNumber: fdr.fdrNumber, institutionId: i.id, applicationNumber: appNo, amountLakhs: fdr.amountLakhs, bankName: fdr.bankName, branchName: fdr.branchName, ifscCode: fdr.ifscCode, issueDate: fdr.issueDate, maturityDate: fdr.maturityDate, tenureYears: 10, status: 'UNDER_VERIFICATION', jointLienHolder: fdr.jointLienHolder, isLienConfirmed: false, renewalStatus: 'NOT_APPLICABLE' });
      logAudit('FDR_SUBMITTED', 'FDR', fdr.fdrNumber, `New FDR ${fdr.fdrNumber} (${fmtAmount(fdr.amountLakhs)}) submitted with ${appNo}; awaiting bank CBS joint lien endorsement.`);
    }
    const c = w.ai.counts;
    logAudit('ESIGN_COMPLETED', 'APPLICATION', appNo, `Declaration e-signed via ${w.esign.method === 'DSC' ? 'Digital Signature Certificate' : 'Aadhaar eSign (OTP)'} by ${u.name}. Ref ${w.esign.ref}.`);
    logAudit('DOCUMENT_UPLOAD', 'APPLICATION', appNo, `Uploaded ${app.documents.length} document(s): ${app.documents.map(d => `${docMeta(d.docType).short} (SHA-256 ${d.fileHash.slice(0, 8)}...)`).join(', ')}.`);
    logAudit('DETERMINISTIC_EVALUATION', 'APPLICATION', appNo, `Evaluated ${app.findings.length} deterministic rules: ${c.passed} passed, ${c.warns} warning(s), ${c.crit} critical.`, { name: 'AICTE Rule Engine v2026.1', role: 'SYSTEM' });
    logAudit('APPLICATION_SUBMITTED', 'APPLICATION', appNo, `Submitted ${TYPE_LONG[w.type]} for AY ${w.inst.academicYear}.`);
    notify('Application Submitted Successfully', `${appNo} (${t.name}) has been submitted to AICTE and queued for Regional Scrutiny.`, 'SUCCESS', { route: 'appDetail', id: app.id });
    if (c.crit) notify('AI pre-validation flagged critical findings', `${c.crit} critical finding(s) on ${appNo} will be reviewed by the Scrutiny Committee.`, 'WARNING', { route: 'appDetail', id: app.id });
    save();
    return { applicationId: app.id, applicationNumber: appNo, replayed: false };
  },
  async submitResponse(appId, responses, files) {
    const a = appById(appId), rec = a.scrutinyRecommendation;
    if (!rec || !rec.deficiencyPoints.length || rec.status === 'RESPONSE_SUBMITTED') throw new ApiError('INVALID_STATE', 'There is no open query on this application.');
    a.currentVersion++;
    a.responses.push({ at: now().toISOString(), version: a.currentVersion, points: responses, files });
    a.status = 'UNDER_SCRUTINY';
    rec.status = 'RESPONSE_SUBMITTED';
    a.lastUpdatedAt = now().toISOString();
    logAudit('COMPLIANCE_RESPONSE_SUBMITTED', 'APPLICATION', a.applicationNumber, `Compliance response v${a.currentVersion} submitted for ${responses.length} point(s) with ${files.length} attachment(s).`);
    notify('Compliance response submitted', `${a.applicationNumber} v${a.currentVersion} is back with the Regional Scrutiny Committee.`, 'SUCCESS', { route: 'appDetail', id: a.id });
    save();
    return { version: a.currentVersion };
  },
  async submitFdr(r, evidence) {
    const number = r.fdrNumber.trim().toUpperCase();
    if (DB.fdrs.some(f => f.fdrNumber === number)) throw new ApiError('VALIDATION', 'This FDR number is already registered', { fdrNumber: 'This FDR number is already registered' });
    const f = { id: uid('fdr'), fdrNumber: number, institutionId: inst().id, applicationNumber: r.applicationNumber || '—', amountLakhs: +r.amountRs / 1e5, bankName: r.bankName, branchName: r.branchName.trim(), ifscCode: r.ifscCode.trim().toUpperCase(), issueDate: r.issueDate, maturityDate: r.maturityDate, tenureYears: 10, status: 'UNDER_VERIFICATION', jointLienHolder: `Regional Officer, ${inst().region} Regional Office, AICTE`, isLienConfirmed: false, renewalStatus: 'NOT_APPLICABLE', evidence };
    DB.fdrs.push(f);
    logAudit('FDR_SUBMITTED', 'FDR', f.fdrNumber, `Uploaded FDR evidence ${evidence.fileName} (SHA-256 ${evidence.fileHash.slice(0, 8)}...) for ${fmtAmount(f.amountLakhs)}; awaiting bank CBS joint lien endorsement.`);
    notify('New FDR submitted', `${f.fdrNumber} (${crLabel(f.amountLakhs)}) is awaiting ${f.bankName} CBS joint lien confirmation.`, 'INFO', { route: 'fdrDetail', id: f.id });
    save();
    return { fdrId: f.id };
  },
  async requestRenewal(fdrId, p) {
    const f = fdrById(fdrId);
    if (f.pendingRequest || (f.releaseRequest && f.releaseRequest.status === 'PENDING')) throw new ApiError('INVALID_STATE', 'A request for this FDR is already pending.');
    const repl = p.mode === 'replacement';
    f.pendingRequest = { kind: repl ? 'REPLACEMENT' : 'RENEWAL', requestedAt: now().toISOString(), payload: p };
    f.renewalStatus = repl ? 'REPLACEMENT_SUBMITTED' : 'RENEWAL_SUBMITTED';
    logAudit(repl ? 'FDR_REPLACEMENT_REQUESTED' : 'FDR_RENEWAL_REQUESTED', 'FDR', f.fdrNumber, `${repl ? 'Replacement' : 'Extension'} requested for ${f.fdrNumber}; proposed maturity ${p.maturityDate}.`);
    notify(repl ? 'FDR replacement submitted' : 'FDR renewal submitted', `${repl ? 'Replacement' : 'Extension'} request for ${f.fdrNumber} is awaiting bank CBS endorsement and AICTE approval.`, 'INFO', { route: 'fdrDetail', id: f.id });
    save();
  },
  async requestRelease(fdrId, reason) {
    const f = fdrById(fdrId);
    if (f.pendingRequest || f.releaseRequest) throw new ApiError('INVALID_STATE', 'A request for this FDR is already pending.');
    f.releaseRequest = { requestedAt: now().toISOString(), reason, status: 'PENDING' };
    logAudit('FDR_LIEN_RELEASE_REQUESTED', 'FDR', f.fdrNumber, `Lien discharge requested for ${f.fdrNumber} by ${me().name}.`);
    notify('Release request submitted', `Release request submitted for ${f.fdrNumber}. Placed before Regulation Bureau.`, 'INFO', { route: 'fdrDetail', id: f.id });
    save();
  },
  async markRead(ids) { myNotifs().forEach(n => { if (!ids || ids.includes(n.id)) n.isRead = true; }); save(); },
  async raiseTicket(r) {
    const id = `TKT-${now().getFullYear()}-${rand(1000, 9999)}`;
    DB.tickets.push({ id, institutionId: inst().id, category: r.category, ref: r.ref, subject: r.subject.trim(), desc: r.desc.trim(), status: 'Open', createdAt: now().toISOString(), updates: [{ at: now().toISOString(), by: 'AICTE Helpdesk', text: `Ticket registered and assigned to the ${inst().region} Regional Office.` }] });
    logAudit('GRIEVANCE_RAISED', 'TICKET', id, `${r.category}: ${r.subject.trim()}`);
    save();
    return id;
  },
  async updateInstitution(r) {
    const i = inst();
    Object.assign(i, { address: r.address.trim(), district: r.district.trim(), city: r.district.trim(), state: r.state, type: r.type, website: r.website.trim() });
    logAudit('INSTITUTION_PROFILE_UPDATED', 'INSTITUTION', i.pid, 'Updated institution contact profile (address / type / website).');
    save();
  },
  async updateContact(r) {
    Object.assign(me(), { name: r.name.trim(), designation: r.designation.trim(), mobile: r.mobile.trim() });
    inst().nodal = { name: r.nodalName.trim(), email: r.nodalEmail.trim(), mobile: r.nodalMobile.trim() };
    logAudit('CONTACT_DETAILS_UPDATED', 'USER', me().id, 'Updated Head of Institution and nodal officer contact details.');
    save();
  },
  subscribe() {}, unsubscribe() {},
};

const Backend = Object.assign(Object.create(REMOTE ? Remote : Local), {
  remote: REMOTE,
  mode: REMOTE ? 'SERVER' : 'DEMO',
  onAuthEvent: null,
  onRemoteChange: null,
});
