/* AICTE Intelligent Regulatory Validation Platform — Institution (Applicant) Mobile Portal */
'use strict';

/* ============================== utilities ============================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAY = 864e5;
const now = () => new Date();
const delay = ms => new Promise(r => setTimeout(r, ms));
// Whole calendar days from today (local time). A plain date ("2026-10-27") is that local day, not midnight UTC —
// otherwise in India today's date counts as "in the future" until 05:30.
const localDay = d => { const x = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00`) : new Date(d); x.setHours(0, 0, 0, 0); return x; };
const daysUntil = d => Math.round((localDay(d) - localDay(now())) / DAY);
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDT = d => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const isToday = d => !!d && new Date(d).toDateString() === now().toDateString();
const isoDate = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const addYears = (d, n, minusDay) => { const x = new Date(d); x.setFullYear(x.getFullYear() + n); if (minusDay) x.setDate(x.getDate() - 1); return isoDate(x); };
const rupees = n => '₹ ' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const crLabel = l => l >= 100 ? `${(l / 100).toFixed(2)} Cr` : `${+Number(l).toFixed(2)} Lakhs`;
const fmtAmount = l => `${rupees(l * 1e5)} (${crLabel(l)})`;
const rand = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const hex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');
const uid = p => `${p}-${Date.now().toString(36)}${hex(2)}`;
const initials = n => n.split(' ').filter(w => !/^(Dr|Prof|Shri|Smt|Mr|Ms)\.?$/i.test(w) && /^[A-Za-z]/.test(w)).map(w => w[0].toUpperCase()).slice(0, 2).join('');
// Account picture: the Google profile photo when there is one, otherwise the initials (also if the photo fails to load).
const avatar = (u, cls = '') => `<span class="avatar ${cls}">${u.avatarUrl ? `<img src="${esc(u.avatarUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(document.createTextNode('${esc(initials(u.name))}'))">` : esc(initials(u.name))}</span>`;
const short = h => h ? `${h.slice(0, 10)}…${h.slice(-6)}` : '—';

// Deterministic 256-bit fallback used only when SubtleCrypto is unavailable (non-secure context).
function fnvHex(bytes) {
  let out = '';
  for (let r = 0; r < 8; r++) {
    let h = (2166136261 ^ (r * 16777619)) >>> 0;
    for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 16777619) >>> 0; }
    out += h.toString(16).padStart(8, '0');
  }
  return out;
}
async function sha256(data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  if (crypto.subtle) {
    const d = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return fnvHex(bytes);
}
function countPdfPages(buf) {
  const s = new TextDecoder('latin1').decode(new Uint8Array(buf));
  const m = s.match(/\/Type\s*\/Page(?![a-zA-Z])/g);
  return m ? m.length : 1;
}

/* ============================== icons ============================== */
const P = {
  spark: '<path d="M12 3l1.8 4.6L18.5 9l-4.7 1.6L12 15l-1.8-4.4L5.5 9l4.7-1.4z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  files: '<path d="M15 2H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><path d="M15 2v5h5"/><path d="M4 7v13a2 2 0 0 0 2 2h9"/>',
  filePlus: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M12 18v-6M9 15h6"/>',
  fileEdit: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5"/><path d="M14 3v6h6v2"/><path d="M18.4 13.6a1.9 1.9 0 0 1 2.7 2.7L16 21.4l-3.5.9.9-3.5z"/>',
  fileCheck: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 15l2 2 4-4"/>',
  fileX: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M10 12l4 4M14 12l-4 4"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
  landmark: '<path d="M3 21h18"/><path d="M5 21V10M9.5 21V10M14.5 21V10M19 21V10"/><path d="M2 10 12 3l10 7z"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  chev: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  xCircle: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  shieldCheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2M2 2l20 20"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M14 9l2 2"/>',
  rupee: '<path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a5 5 0 0 0 0-10"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15v5M16.5 17.5h5"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  swap: '<path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
  hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
  pen: '<path d="M3 21c3 0 4-3 6.5-3S12 21 15 21s3.5-2 6-2"/><path d="m14.5 4.5 4 4L11 16H7v-4z"/>',
  print: '<path d="M6 9V2h12v7"/><rect x="2" y="9" width="20" height="8" rx="2"/><path d="M6 14h12v8H6z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 8 5-3 5 3-1.5-8"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  power: '<path d="M18.4 6.6a9 9 0 1 1-12.8 0M12 2v10"/>',
  bank: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 11h18M7 15h4"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4"/>',
};
const ic = (n, s = 20, c = '') => `<svg class="ic ${c}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

/* ============================== reference data ============================== */
const APP_TYPES = [
  { code: 'NEW_PROGRAMME', name: 'Approval Application', desc: 'Apply for new course / increase in intake', icon: 'filePlus', tone: 'blue', prefix: 'NEW' },
  { code: 'EOA', name: 'Extension of Approval', desc: 'Apply for extension of existing approval', icon: 'refresh', tone: 'purple', prefix: 'EOA' },
  { code: 'INFRASTRUCTURE_UPDATE', name: 'Change in Institution Details', desc: 'Address, management, name, built-up area change etc.', icon: 'building', tone: 'green', prefix: 'INFRA' },
  { code: 'INTAKE_VARIATION', name: 'Change in Program Details', desc: 'Add / remove / change course, intake variation', icon: 'fileEdit', tone: 'cyan', prefix: 'INTAKE' },
  { code: 'FDR', name: 'FDR / Security Deposit Related Request', desc: 'Submit new FDR, renewal / replacement, bank change, lien release', icon: 'rupee', tone: 'amber', hl: true },
  { code: 'CLOSURE', name: 'Closure / Withdrawal', desc: 'For closure or surrender of approval', icon: 'power', tone: 'red', prefix: 'CLOSURE' },
];
P.building = '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>';
const typeOf = c => APP_TYPES.find(t => t.code === c) || { name: c, icon: 'file', tone: 'slate' };
const TYPE_LONG = { NEW_PROGRAMME: 'Approval Application (New Programme / Intake)', EOA: 'Extension of Approval (EoA)', INFRASTRUCTURE_UPDATE: 'Change in Institution Details', INTAKE_VARIATION: 'Change in Program Details / Intake Variation', CLOSURE: 'Closure / Withdrawal' };

const STATUS = {
  DRAFT: ['Draft', 'slate'], SUBMITTED: ['Submitted', 'blue'], UNDER_SCRUTINY: ['Under Scrutiny', 'amber'],
  DEFICIENCIES_NOTED: ['Clarification Required', 'red'], SCRUTINY_CLEARED: ['Scrutiny Cleared', 'green'],
  APPROVED: ['Approved', 'green'], REJECTED: ['Rejected', 'red'],
};
const FSTATUS = {
  ACTIVE: ['Active (Lien Secured)', 'green'], EXPIRING_SOON: ['Expiring Soon', 'amber'], MATURED: ['Matured (10-Yr Met)', 'slate'],
  UNDER_VERIFICATION: ['Under Verification', 'cyan'], RELEASED: ['Lien Released', 'slate'],
};
const REC_STATUS = {
  IN_PROGRESS: ['Review in progress', 'amber'], DEFICIENCIES_ISSUED: ['Deficiencies issued', 'red'],
  RECOMMENDED_APPROVAL: ['Recommended for approval', 'green'], RESPONSE_SUBMITTED: ['Compliance response under review', 'blue'],
};
const chip = (pair, sm) => `<span class="chip ${pair[1]} ${sm ? 'sm' : ''}">${esc(pair[0])}</span>`;
const sevChip = s => chip({ CRITICAL: ['Critical', 'red'], WARNING: ['Warning', 'amber'], PASSED: ['Passed', 'green'], NOT_EVALUATED: ['Not evaluated', 'slate'] }[s] || [s, 'slate'], true);

const DOC_TYPES = [
  { type: 'LAND_TITLE', name: 'Land Title / Registered Sale Deed', short: 'Land Title', req: true, file: 'Land_Title_Deed' },
  { type: 'BUILDING_NOC', name: 'Building Stability / Completion Certificate', short: 'Building NOC', req: true, expiry: true, file: 'Building_Stability_Cert', authority: 'Municipal Building Department', sampleValid: '2029-03-31' },
  { type: 'FIRE_SAFETY', name: 'Fire Safety NOC', short: 'Fire Safety NOC', req: true, expiry: true, file: 'Fire_Safety_NOC', authority: 'State Fire & Emergency Services', sampleValid: '2028-01-09' },
  { type: 'FDR_CORPUS', name: 'FDR Certificate (Joint Lien)', short: 'FDR', req: true, file: 'FDR_Joint_Lien_Advice' },
  { type: 'AFFILIATION', name: 'University Affiliation Letter', short: 'Affiliation', req: true, expiry: true, file: 'University_Affiliation', authority: 'Affiliating University', sampleValid: '2028-06-30' },
  { type: 'STATE_NOC', name: 'State Govt / DTE NOC', short: 'State NOC', req: true, file: 'State_DTE_NOC' },
  { type: 'FACULTY_CADRE', name: 'Certified Faculty Cadre Register', short: 'Faculty Register', req: true, file: 'Faculty_Cadre_Register' },
  { type: 'BANK_LETTER', name: 'Bank Lien Confirmation Letter', short: 'Bank Letter', file: 'Bank_Lien_Letter' },
  { type: 'AFFIDAVIT', name: 'Affidavit / Undertaking (if applicable)', short: 'Affidavit', file: 'Affidavit_Undertaking' },
  { type: 'OTHER', name: 'Any Other Document', short: 'Other', file: 'Supporting_Document' },
];
const docMeta = t => DOC_TYPES.find(d => d.type === t) || { type: t, name: t.replace(/_/g, ' '), short: t };

const BANKS = [
  ['State Bank of India', 'SBIN', 'SBI'], ['Punjab National Bank', 'PUNB', 'PNB'], ['Canara Bank', 'CNRB', 'CAN'],
  ['HDFC Bank Ltd', 'HDFC', 'HDFC'], ['Bank of Baroda', 'BARB', 'BOB'], ['ICICI Bank Ltd', 'ICIC', 'ICICI'],
  ['Axis Bank Ltd', 'UTIB', 'AXIS'], ['Union Bank of India', 'UBIN', 'UBI'],
];
// Shared evaluator account on the live server (created by npm run db:migrate -- --seed, see README "Demo accounts").
const DEMO_LOGIN = { label: 'Institution · DITS Delhi', email: 'sih_demo.institution@example.com', password: 'Sih@2026Demo' };
const isDemoAccount = email => /^sih_demo\.[a-z]+@example\.com$/i.test(email || '');
const SAMPLE_REG = { name: 'Rajdhani Institute of Engineering & Technology', pid: '', state: 'Delhi', district: 'South West Delhi', type: 'Unaided - Private', head: 'Dr. Anita Verma', mobile: '9876543210', agree: true };
const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'];
const INST_TYPES = ['Unaided - Private', 'Govt. Aided', 'Government', 'Autonomous Institute', 'Autonomous - Private', 'Deemed to be University', 'Private University'];
const REGIONS = ['Northern', 'Southern', 'Western', 'Eastern', 'South-Western', 'North-Western', 'Central', 'South-Eastern', 'North-Eastern'];

/* ============================== persistence ============================== */
const STORE = 'aicte-irvp-institution-mobile-v1';
function freshDB() {
  const clone = x => JSON.parse(JSON.stringify(x));
  const db = { v: 1, users: clone(USERS), institutions: clone(INSTITUTIONS), apps: clone(APPS), fdrs: clone(FDRS), notifs: clone(NOTIFS), audit: clone(AUDIT), adapters: {}, tickets: [], registrations: [], session: null, acked: {}, prefs: { push: true, email: true, sms: false }, pwHash: {} };
  db.institutions.forEach(i => { db.adapters[i.id] = seedAdapters(i, db.fdrs.find(f => f.institutionId === i.id && !f.demo)); });
  return db;
}
const PREFS = 'aicte-irvp-prefs-v1';
function loadPrefs() { try { return JSON.parse(localStorage.getItem(PREFS)) || {}; } catch (e) { return {}; } }
// Server mode: server data lives in memory only; just per-device preferences are stored on the device.
function remoteSkeleton() {
  const p = loadPrefs();
  return { v: 1, users: [], institutions: [], apps: [], fdrs: [], notifs: [], audit: [], adapters: {}, tickets: [], registrations: [], session: null, acked: p.acked || {}, prefs: p.prefs || { push: true, email: true, sms: false }, pwHash: {} };
}
function load() {
  if (Backend.remote) return remoteSkeleton();
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) { const d = JSON.parse(raw); if (d && d.v === 1) return d; }
  } catch (e) { /* storage unavailable: fall back to in-memory */ }
  return freshDB();
}
function save() {
  try {
    if (Backend.remote) localStorage.setItem(PREFS, JSON.stringify({ acked: DB.acked, prefs: DB.prefs }));
    else localStorage.setItem(STORE, JSON.stringify(DB));
  } catch (e) { /* in-memory only */ }
}
let DB = load();

/* ============================== accessors ============================== */
const me = () => DB.session && DB.users.find(u => u.id === DB.session.userId);
const inst = () => DB.institutions.find(i => i.id === me()?.institutionId);
const instOf = u => DB.institutions.find(i => i.id === u.institutionId);
const instUsers = () => DB.users.filter(u => u.role === 'INSTITUTION');
const byNewest = k => (a, b) => new Date(b[k]) - new Date(a[k]);
const myApps = () => DB.apps.filter(a => a.institutionId === inst().id).sort(byNewest('lastUpdatedAt'));
const myFdrs = () => DB.fdrs.filter(f => f.institutionId === inst().id);
const myNotifs = () => DB.notifs.filter(n => n.institutionId === inst().id).sort(byNewest('timestamp'));
const myAudit = () => DB.audit.filter(a => a.institutionId === inst().id).sort(byNewest('timestamp'));
const unread = () => myNotifs().filter(n => !n.isRead).length;
const appById = id => DB.apps.find(a => a.id === id && a.institutionId === inst().id);
const fdrById = id => DB.fdrs.find(f => f.id === id && f.institutionId === inst().id);
const requiredLakhs = () => inst().requiredFdrLakhs || 100;

function fdrStatus(f) {
  if (f.status === 'RELEASED') return 'RELEASED';
  if (!f.isLienConfirmed) return 'UNDER_VERIFICATION';
  const d = daysUntil(f.maturityDate);
  if (d <= 0) return 'MATURED';
  if (d <= 180) return 'EXPIRING_SOON';
  return 'ACTIVE';
}
// Who confirmed the joint lien. Only a bank official's confirmation on the portal counts as "confirmed by the bank";
// in the offline demo every confirmation is simulated.
const LIEN_SOURCE = {
  BANK_OFFICIAL: ['Confirmed by the bank', 'ok'], AICTE_RECORDED: ['Recorded by AICTE — not confirmed by the bank', 'warn'],
  DEMO_SIMULATED: ['Simulated (demo record)', 'warn'], UNRECORDED: ['Lien on record — who confirmed it is not on file', 'warn'], PENDING: ['Awaiting bank confirmation', 'warn'],
};
const lienSource = f => (f.bankConfirmation && f.bankConfirmation.source) || (!f.isLienConfirmed ? 'PENDING' : Backend.remote ? 'UNRECORDED' : 'DEMO_SIMULATED');
// Lien release: requested → approved by AICTE (release order) → discharged by the bank in its own system.
function releaseState(f) {
  const r = f.release, rr = f.releaseRequest;
  if (r && r.dischargedAt) return ['Lien discharged by the bank', 'green'];
  if (r || (rr && rr.status === 'APPROVED')) return ['Release approved — awaiting bank discharge', 'blue'];
  if (rr && rr.status === 'PENDING') return ['Release Pending Bureau Approval', 'amber'];
  return null;
}
const lienProgress = f =>Math.min(1, Math.max(0, (now() - new Date(f.issueDate)) / (new Date(f.maturityDate) - new Date(f.issueDate))));

function logAudit(action, targetType, targetId, details, actor) {
  const a = actor || { name: me().name, role: 'INSTITUTION' };
  const ev = { id: uid('aud'), institutionId: inst().id, correlationId: `req-${hex(4)}-${now().getFullYear()}`, timestamp: now().toISOString(), actorName: a.name, actorRole: a.role, action, targetType, targetId, details, ipAddress: 'mobile-client', sha256Hash: '' };
  DB.audit.push(ev);
  save();
  sha256(JSON.stringify(ev)).then(h => { ev.sha256Hash = h; save(); });
  return ev;
}
function notify(title, message, type, link) {
  DB.notifs.push({ id: uid('n'), institutionId: inst().id, title, message, type, timestamp: now().toISOString(), isRead: false, link });
  save();
}

/* ============================== UI state & router ============================== */
const UI = { stack: [], loginTab: 'login', loginErr: null, err: {}, busy: false, appsFilter: 'ALL', appsQuery: '', alertsFilter: 'ALL', appTab: 'overview', w: null, aiRun: null, otp: null, attach: {}, edit: null, ticketForm: false, fdrMode: 'extension', esignMethod: 'AADHAAR', uploading: {}, offline: !navigator.onLine, pending: false };
const topRoute = () => UI.stack[UI.stack.length - 1];
const currentRoute = () => topRoute()?.name;
const PUBLIC = ['splash', 'login', 'boot', 'bootError'];
const ONBOARDED = 'aicte-onboarded';
const isOnboarded = () => { try { return localStorage.getItem(ONBOARDED) === '1'; } catch (e) { return false; } };
const markOnboarded = () => { try { localStorage.setItem(ONBOARDED, '1'); } catch (e) { /* ignore */ } };

const ON_ENTER = {
  appDetail: () => { UI.appTab = 'overview'; },
  fdrRenew: () => { UI.renewFor = null; },
  fdrNew: () => { UI.newFdr = null; UI.attach.fdrNew = []; },
  respond: () => { UI.attach.respond = []; },
  tickets: () => { UI.ticketForm = false; },
  instDetails: () => { UI.edit = null; },
  contact: () => { UI.edit = null; },
};
function go(name, params = {}, opts = {}) {
  UI.err = {}; UI.vals = null; UI.dirty = false;
  if (ON_ENTER[name]) ON_ENTER[name]();
  if (opts.replace) UI.stack[UI.stack.length - 1] = { name, params };
  else { UI.stack.push({ name, params }); history.pushState({ d: UI.stack.length }, ''); }
  render(true);
}
function goTab(name) { UI.err = {}; UI.vals = null; UI.dirty = false; UI.stack = [{ name, params: {} }]; render(true); }

// Back navigation. Bottom-tab screens are roots (no Back). A secondary screen goes back through the app's own
// history entries; one opened directly (no in-app history) goes to its parent page instead of leaving the app.
const ROOTS = ['dashboard', 'apps', 'fdrs', 'alerts', 'profile'];
const PARENT = { appDetail: 'apps', notice: 'apps', respond: 'apps', apptype: 'dashboard', wizard: 'apps', ai: 'apps', review: 'apps', submitted: 'apps',
  fdrDetail: 'fdrs', fdrRenew: 'fdrs', fdrRelease: 'fdrs', fdrNew: 'fdrs', compliance: 'profile', instDetails: 'profile', contact: 'profile',
  password: 'profile', tickets: 'profile', help: 'profile', about: 'profile', activity: 'profile', switchInst: 'profile' };
// Screens with forms: leaving them with unsaved input asks first.
const FORM_ROUTES = ['wizard', 'respond', 'fdrNew', 'fdrRenew', 'fdrRelease', 'tickets', 'instDetails', 'contact', 'password'];
const canGoBack = () => UI.stack.length > 1 || !(ROOTS.includes(currentRoute()) || PUBLIC.includes(currentRoute()));
// The wizard keeps its input across its steps and screens, so it has its own flag (cleared on save, submit or a new wizard).
const unsaved = () => currentRoute() === 'wizard' ? !!(UI.w && UI.wChanged) : !!UI.dirty && FORM_ROUTES.includes(currentRoute());
// Programmatic back (after a successful save, or once the user confirmed leaving): never asks.
function back() {
  UI.dirty = false;
  if (UI.stack.length > 1) {
    if (history.state && history.state.d === UI.stack.length) history.back();   // our own history entry: popstate pops it
    else { UI.stack.pop(); UI.err = {}; UI.vals = null; render(true); }
    return;
  }
  const r = currentRoute();
  if (!ROOTS.includes(r) && !PUBLIC.includes(r)) goTab(PARENT[r] || 'dashboard');
}
function confirmLeave() {
  const wiz = currentRoute() === 'wizard' && UI.w;
  openSheet('Leave this screen?', `<p class="small">You have changes on this screen that are not saved yet.</p>
    <div style="display:grid;gap:10px" class="mt16">
      ${wiz ? `<button class="btn btn-primary btn-block" data-act="leaveSave">${ic('download', 18)} Save draft &amp; leave</button>` : ''}
      <button class="btn btn-outline btn-block" data-act="leaveYes">Leave without saving</button>
      <button class="btn btn-ghost btn-block" data-act="closeSheet">Keep editing</button></div>`);
}
window.addEventListener('popstate', () => {
  if ($('#sheet').classList.contains('open')) { closeSheet(); history.pushState({}, ''); return; }
  if (UI.stack.length > 1) {
    if (unsaved()) { history.pushState({ d: UI.stack.length }, ''); confirmLeave(); return; }   // native Back on a form with changes
    UI.stack.pop(); UI.err = {}; UI.vals = null; UI.dirty = false; render(true);
  }
});

// Page-header Refresh: reloads this institution's data from the server, keeping the screen, filters, scroll and typed values.
function refreshBtn() {
  const t = UI.lastSync ? `Last updated ${UI.lastSync.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Refresh';
  return `<button class="icon-btn fv-refresh ${UI.refreshing ? 'spinning' : ''}" data-act="refreshData" aria-label="Refresh" title="${t}" ${UI.refreshing ? 'aria-busy="true"' : ''}>${ic('refresh', 20)}</button>`;
}
function setRefreshing(on) {
  UI.refreshing = on;
  $$('.fv-refresh').forEach(b => { b.classList.toggle('spinning', on); if (on) b.setAttribute('aria-busy', 'true'); else b.removeAttribute('aria-busy'); });
}
// Replays the short entrance on a list or pane whose content changed in place (filters, tabs).
function swapIn(sel) {
  const el = $(sel);
  if (!el || reducedMotion()) return;
  el.classList.remove('fv-swap'); void el.offsetWidth; el.classList.add('fv-swap');
}

function render(resetScroll) {
  clearFx();
  let r = topRoute();
  if (!me() && !PUBLIC.includes(r.name)) { UI.stack = [{ name: isOnboarded() ? 'login' : 'splash', params: {} }]; r = topRoute(); }
  if (!V[r.name]) { UI.stack = [{ name: 'dashboard', params: {} }]; r = topRoute(); }
  const prev = $('.content');
  const keep = !resetScroll && prev ? prev.scrollTop : 0;
  const v = V[r.name](r.params || {});
  // Entrance animation only when the screen changes, not when live data re-renders the same screen.
  const key = `${r.name}|${JSON.stringify(r.params || {})}`;
  $('#view').classList.toggle('enter', key !== UI.screenKey && !reducedMotion());
  UI.screenKey = key;
  // Removing a focused, edited field fires a late 'change' event; it must not mark the new screen as unsaved.
  const dirty = UI.dirty, wChanged = UI.wChanged;
  $('#view').innerHTML = shell(v);
  UI.dirty = dirty; UI.wChanged = wChanged;
  const c = $('.content');
  if (c) c.scrollTop = keep;
  v.after && v.after();
}

/* ---------- motion helpers (timers are cleared on every render) ---------- */
function clearFx() { (UI.fx || []).forEach(t => { clearInterval(t); cancelAnimationFrame(t); }); UI.fx = []; }
function rotateText(el, items, every = 3200) {
  if (!el || items.length < 2 || reducedMotion()) return;
  let k = 0;
  UI.fx.push(setInterval(() => {
    k = (k + 1) % items.length;
    el.classList.remove('in');
    el.textContent = I18N.tr(items[k]);
    void el.offsetWidth;
    el.classList.add('in');
  }, every));
}
// Counts [data-count] numbers up from zero when a screen opens; the final text is the server value.
function countUp(root) {
  if (reducedMotion() || !$('#view').classList.contains('enter')) return;
  $$('[data-count]', root).forEach(el => {
    const target = +el.dataset.count, final = el.textContent, fmt = el.dataset.fmt;
    if (!(target > 0)) return;
    const t0 = performance.now(), dur = 900;
    const step = t => {
      const p = Math.min(1, (t - t0) / dur), v = target * (1 - Math.pow(1 - p, 3));
      el.textContent = p >= 1 ? final : fmt === 'cr' ? crLabel(v) : String(Math.round(v));
      if (p < 1) UI.fx.push(requestAnimationFrame(step));
    };
    UI.fx.push(requestAnimationFrame(step));
  });
}
function ticker(items) {
  if (!items.length) return '';
  const row = hidden => items.map(t => `<button class="ticker-item" style="--dot:${t.dot}" ${t.attrs} ${hidden ? 'aria-hidden="true" tabindex="-1"' : ''}>${esc(t.text)}</button>`).join('');
  return `<div class="ticker"><span class="ticker-label"><i></i>LIVE</span><div class="ticker-viewport"><div class="ticker-track" translate="no">${row(false)}${row(true)}</div></div></div>`;
}

function shell(v) {
  let hdr = '';
  if (v.header === 'brand') hdr = brandHeader();
  else if (v.header !== 'none') {
    const canBack = canGoBack() && !v.noBack;
    hdr = `<header class="hdr ${v.hdrCls || ''}">${canBack ? `<button class="icon-btn" data-act="back" aria-label="Back">${ic('back', 22)}</button>` : ''}
      <h1>${esc(v.title || '')}${v.sub ? `<div class="sub">${esc(v.sub)}</div>` : ''}</h1>${v.refresh ? refreshBtn() : ''}${v.right || ''}</header>`;
  }
  const offline = UI.offline ? `<div class="offline-bar" role="status">${ic('alert', 16)} You're offline${Backend.remote ? ' — changes can\'t be sent until you reconnect' : ''}.</div>` : '';
  return `${offline}${hdr}${v.pre || ''}<main class="content ${v.cls || ''}">${v.body}</main>${v.footer ? `<div class="footer-bar">${v.footer}</div>` : ''}${v.tab ? tabbar(v.tab) : ''}`;
}

/* Runs an async backend operation once: blocks repeated taps, shows progress on the button, maps errors. */
async function busy(el, fn, label) {
  if (UI.pending) return undefined;
  UI.pending = true;
  const btn = el && el.closest ? el.closest('button') : null, html = btn && btn.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spin" aria-hidden="true"></span> ${esc(label || 'Please wait…')}`; }
  try { return await fn(); }
  catch (e) { handleError(e); return undefined; }
  finally { UI.pending = false; if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = html; } }
}
function handleError(e) {
  const err = toApiError(e);
  if (err.code === 'SESSION_EXPIRED' || err.code === 'NOT_AUTHENTICATED') { sessionEnded(err.message); return; }
  if (err.fields) {
    // The server names wizard fields ("fdr.issueDate"); on stand-alone forms (Submit New FDR) the same field is "issueDate".
    const f = {};
    for (const [k, v] of Object.entries(err.fields)) {
      const plain = k.replace(/^fdr\./, '');
      f[!$(`[name="${k}"]`) && $(`[name="${plain}"]`) ? plain : k] = v;
    }
    UI.err = { ...UI.err, ...f }; render();
  }
  // Say what is wrong, not only that something is: the field may be scrolled out of view.
  toast(err.fields ? `${err.message} ${Object.values(err.fields).join(' · ')}` : err.message, err.code === 'OFFLINE' || err.code === 'NETWORK' ? 'warn' : 'err');
}
function sessionEnded(msg) {
  if (Backend.remote) DB = remoteSkeleton();
  DB.session = null;
  save(); UI.w = null; UI.loginTab = 'login'; UI.loginErr = msg || null;
  closeSheet();
  UI.stack = [{ name: 'login', params: {} }];
  render(true);
}
function brandHeader() {
  const n = unread();
  return `<header class="hdr hdr-brand">
    <span class="fv-brand-tile"><img src="fdr-vault-logo.png" alt="FDR Vault logo"></span>
    <div class="fv-brand-t"><b translate="no">FDR VAULT</b><span>AICTE · Institution Portal</span></div>
    ${refreshBtn()}
    <button class="icon-btn" data-tab="alerts" aria-label="Notifications">${ic('bell', 22)}${n ? `<span class="dot-badge">${n}</span>` : ''}</button>
    <button class="icon-btn" data-tab="profile" aria-label="Profile">${avatar(me())}</button></header>`;
}
function tabbar(active) {
  const T = [['dashboard', 'home', 'Home'], ['apps', 'files', 'Applications'], ['fdrs', 'landmark', 'FDR'], ['alerts', 'bell', 'Alerts'], ['profile', 'user', 'Profile']];
  const n = unread();
  return `<nav class="tabbar">${T.map(([r, i, l]) => `<button class="${active === r ? 'on' : ''}" data-tab="${r}" aria-label="${l}">${ic(i, 22)}<span>${l}</span>${r === 'alerts' && n ? `<span class="tab-badge">${n}</span>` : ''}</button>`).join('')}</nav>`;
}

/* ============================== sheet & toast ============================== */
function openSheet(title, body) {
  const s = $('#sheet');
  s.innerHTML = `<div class="sheet-backdrop" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-grip"></div><div class="sheet-head"><h3>${esc(title)}</h3><button class="icon-btn" data-act="closeSheet" aria-label="Close">${ic('x', 20)}</button></div><div class="sheet-body">${body}</div></div>`;
  s.classList.add('open');
}
function setSheetBody(body) { const b = $('#sheet .sheet-body'); if (b) b.innerHTML = body; }
function closeSheet() { const s = $('#sheet'); s.classList.remove('open'); s.innerHTML = ''; }
function toast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `${ic(type === 'err' ? 'xCircle' : type === 'warn' ? 'alert' : type === 'info' ? 'info' : 'checkCircle', 18)}<span>${esc(msg)}</span>`;
  $('#toast').appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
// Android app: WebViews ignore <a download>, so write the file to the app cache and open the system share / save sheet.
async function nativeSave(name, content) {
  const { Filesystem, Share } = window.Capacitor.Plugins;
  try {
    const bytes = new TextEncoder().encode(content);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    const res = await Filesystem.writeFile({ path: name, data: btoa(bin), directory: 'CACHE' });
    await Share.share({ title: name, url: res.uri, dialogTitle: 'Save or share' });
  } catch (e) {
    if (!/cancel/i.test(String(e && e.message))) toast('Could not save the file on this device', 'err');
  }
}
function downloadFile(name, content, type) {
  if (isNative()) { nativeSave(name, content); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  toast(`Downloaded ${name}`);
}

/* ============================== form helpers ============================== */
function fld(label, name, value, o = {}) {
  const err = UI.err[name];
  const cls = `input ${err ? 'err' : ''}`;
  const attrs = `name="${name}" ${o.ro ? (o.opts ? 'disabled' : 'readonly') : ''} ${o.attrs || ''}`;
  let ctl;
  if (o.opts) ctl = `<select class="${cls}" ${attrs}>${o.opts.map(x => { const [v, l] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(v)}" ${String(v) === String(value ?? '') ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
  else if (o.type === 'textarea') ctl = `<textarea class="${cls}" rows="${o.rows || 3}" placeholder="${esc(o.ph || '')}" ${attrs}>${esc(value)}</textarea>`;
  else ctl = `<input class="${cls}" type="${o.type || 'text'}" value="${esc(value)}" placeholder="${esc(o.ph || '')}" ${o.type === 'number' ? 'inputmode="numeric" min="0"' : ''} ${attrs}>`;
  if (o.icon) ctl = `<div class="input-wrap">${ic(o.icon, 18)}${ctl}</div>`;
  return `<div class="field"><label>${esc(label)}${o.req ? ' <span class="req">*</span>' : ''}</label>${ctl}${err ? `<div class="ferr">${esc(err)}</div>` : o.hint ? `<div class="hint">${o.hint}</div>` : ''}</div>`;
}
function readForm(root) {
  const out = {};
  $$('[name]', root).forEach(el => {
    if (el.type === 'file') return;
    if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; return; }
    out[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  });
  return out;
}
function setPath(obj, path, v) { const k = path.split('.'); let o = obj; k.slice(0, -1).forEach(p => { o = o[p] = o[p] || {}; }); o[k[k.length - 1]] = v; }
const emailOk = s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
const mobileOk = s => {
  const digits = String(s || '').replace(/\D/g, '');
  const nationalNumber = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(nationalNumber);
};
const ifscOk = s => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(s);

/* ============================== rule engine ============================== */
function norms(p) {
  const P_ = +p.professors || 0, A = +p.associateProfessors || 0, S = +p.assistantProfessors || 0;
  const fac = P_ + A + S, st = +p.totalStudents || 0, area = +p.totalBuiltUpAreaSqM || 0;
  const reqFac = Math.ceil(st / 20), reqP = Math.floor(reqFac / 9), reqA = Math.floor(reqFac * 2 / 9), reqArea = Math.ceil(st * 5.5);
  const sfr = fac ? st / fac : 0;
  const trim = n => String(+n.toFixed(2));
  return {
    P: P_, A, S, fac, st, area, reqFac, reqP, reqA, reqArea, sfr,
    sfrStr: fac ? `1:${sfr.toFixed(1)}` : '—', sfrOk: fac > 0 && sfr <= 20, profOk: P_ >= reqP, assocOk: A >= reqA, areaOk: area >= reqArea,
    ratio: P_ ? `1 : ${trim(A / P_)} : ${trim(S / P_)}` : '—',
  };
}
function bankCode(name) { return (BANKS.find(b => b[0] === name) || [])[1]; }

function evaluateRules({ i, p, fdr, docs, analysed, reqLakhs }) {
  const F = [];
  const add = (code, severity, description, extra = {}) => {
    const r = RULES.find(x => x.code === code);
    F.push({ id: uid('find'), ruleCode: code, ruleName: r.name, severity, description, handbookClause: r.handbookClause, isDeterministic: true, ...extra });
  };
  if (docs) {
    const mand = DOC_TYPES.filter(d => d.req), missing = mand.filter(d => !docs[d.type] || !docs[d.type].fileSizeKb);
    if (missing.length) add('RULE-CHECKLIST-01', 'CRITICAL', `${mand.length - missing.length} of ${mand.length} mandatory documents provided. Missing: ${missing.map(d => d.short).join(', ')}.`);
    else add('RULE-CHECKLIST-01', 'PASSED', 'All 7 mandatory statutory categories have been provided with non-zero byte size and parseable content.');

    const exp = DOC_TYPES.filter(d => d.expiry && docs[d.type]).map(d => ({ d, v: docs[d.type].validTill }));
    const expired = exp.filter(x => x.v && daysUntil(x.v) < 0);
    const soon = exp.filter(x => x.v && daysUntil(x.v) >= 0 && daysUntil(x.v) < 183);
    const undated = exp.filter(x => !x.v);
    if (expired.length) add('RULE-EXPIRY-02', 'CRITICAL', `${expired.map(x => `${x.d.short} expired on ${fmtDate(x.v)}`).join('; ')}. A valid certificate is mandatory for AY 2026-27.`, { evidenceSnippet: expired.map(x => `${x.d.short}: valid till ${x.v}`).join(' | ') });
    else if (soon.length || undated.length) add('RULE-EXPIRY-02', 'WARNING', [soon.length ? `${soon.map(x => `${x.d.short} expires on ${fmtDate(x.v)}`).join('; ')}, within 6 months — renewal application or renewal receipt must be submitted.` : '', undated.length ? `Validity date not declared for: ${undated.map(x => x.d.short).join(', ')}.` : ''].join(' ').trim(), { evidenceSnippet: soon.map(x => `${x.d.short}: valid till ${x.v}`).join(' | ') || undefined });
    else if (exp.length) add('RULE-EXPIRY-02', 'PASSED', 'All statutory certificates remain valid for at least 6 months, through AY 2026-27.');

    const mism = (analysed || []).filter(a => a.fields.some(f => /^Institution Name/.test(f.label) && !f.isCoherent));
    if (mism.length) {
      const ent = mism[0].fields.find(f => /^Institution Name/.test(f.label)).value;
      add('RULE-PID-03', 'CRITICAL', `Extracted text references "${ent}" while filing institution PID is ${i.pid} (${i.name}). Entity name mismatch.`, { evidenceSnippet: `Deed executed in favour of ${ent}`, docType: mism[0].type });
    } else add('RULE-PID-03', 'PASSED', `PID ${i.pid} matches ${i.name} in Council Master Registry without discrepancies.`);

    const col = (analysed || []).filter(a => a.forensics.sha256Match);
    const internal = (analysed || []).filter(a => a.forensics.internalDuplicateOf);
    const filings = DB.apps.reduce((n, a) => n + (a.documents || []).length, 0);
    if (col.length) {
      const a = col[0];
      add('RULE-DUPLICATE-HASH-04', 'CRITICAL', `SHA-256 fingerprint collision detected: Uploaded ${a.name} (${a.hash}) is 100% byte-for-byte identical to document uploaded in ${a.forensics.duplicateApplicationId} (${a.forensics.duplicateInstitutionName}).`, { evidenceSnippet: `Hash: ${a.hash.slice(0, 8)}... matches ${a.forensics.duplicateApplicationId}`, docType: a.type });
    } else if (internal.length) add('RULE-DUPLICATE-HASH-04', 'WARNING', `The same file was uploaded under multiple categories: ${internal.map(a => `${a.short} = ${docMeta(a.forensics.internalDuplicateOf).short}`).join(', ')}.`);
    else add('RULE-DUPLICATE-HASH-04', 'PASSED', `Zero duplicate SHA-256 hash collisions found across ${filings} institutional filings on record.`);
  }

  const n = norms(p);
  if (n.fac && n.st) {
    if (!n.sfrOk || !n.profOk) add('RULE-CADRE-RATIO-05', 'CRITICAL', `For ${n.st.toLocaleString('en-IN')} students, required faculty is ${n.reqFac} with ${n.reqP} Professors. Institution declares ${n.fac} faculty and ${n.P} Professors (SFR ${n.sfrStr}).`);
    else if (!n.assocOk) add('RULE-CADRE-RATIO-05', 'WARNING', `SFR ${n.sfrStr} is within norm, but Associate Professor count ${n.A} is below the required ${n.reqA} for the 1:2:6 cadre ratio.`);
    else add('RULE-CADRE-RATIO-05', 'PASSED', `Calculated SFR is ${n.sfrStr} (norm <= 1:20). Cadre distribution ${n.P} : ${n.A} : ${n.S} fulfills AICTE 1:2:6 ratio norm.`);
  }
  if (n.st && n.area) {
    if (n.areaOk) add('RULE-BUILTUP-AREA-06', 'PASSED', `Built-up carpet area ${n.area.toLocaleString('en-IN')} sq.m meets the required ${n.reqArea.toLocaleString('en-IN')} sq.m (5.5 sq.m per student).`);
    else add('RULE-BUILTUP-AREA-06', 'WARNING', `Built-up carpet area ${n.area.toLocaleString('en-IN')} sq.m is short of the required ${n.reqArea.toLocaleString('en-IN')} sq.m for ${n.st.toLocaleString('en-IN')} students.`);
  }
  if (fdr) {
    const req = reqLakhs || 100, issues = [];
    if (fdr.amountLakhs < req) issues.push(`deposit ${crLabel(fdr.amountLakhs)} is below required corpus ${crLabel(req)}`);
    if (fdr.issueDate && fdr.maturityDate && fdr.maturityDate < addYears(fdr.issueDate, 10, true)) issues.push('tenure is less than the mandatory 10-year lock-in');
    if (daysUntil(fdr.maturityDate) <= 0) issues.push(`FDR matured on ${fmtDate(fdr.maturityDate)}`);
    if (!/AICTE/i.test(fdr.jointLienHolder || '')) issues.push('joint lien is not in favour of Regional Officer, AICTE');
    if (issues.length) add('RULE-FDR-CORPUS-07', 'CRITICAL', `FDR ${fdr.fdrNumber}: ${issues.join('; ')}.`);
    else if (!fdr.isLienConfirmed) add('RULE-FDR-CORPUS-07', 'WARNING', `FDR ${fdr.fdrNumber} for ${crLabel(fdr.amountLakhs)} meets corpus and tenure norms; joint lien awaiting bank CBS endorsement.`);
    else add('RULE-FDR-CORPUS-07', 'PASSED', `FDR ${fdr.fdrNumber} for ${crLabel(fdr.amountLakhs)} is under joint lien with ${fdr.jointLienHolder}, maturing ${fmtDate(fdr.maturityDate)}.`);
  }
  return F;
}
function ruleMatrix(app) {
  if (!app) return RULES.map(r => ({ ruleCode: r.code, ruleName: r.name, severity: 'NOT_EVALUATED', description: 'No application on record to evaluate.', handbookClause: r.handbookClause }));
  const fdr = DB.fdrs.find(f => f.fdrNumber === app.fdrNumber);
  const live = evaluateRules({ i: inst(), p: app.intakeDetails, fdr, docs: null, reqLakhs: app.intakeDetails.requiredFdrAmountLakhs });
  return RULES.map(r => app.findings.find(f => f.ruleCode === r.code) || live.find(f => f.ruleCode === r.code)
    || { ruleCode: r.code, ruleName: r.name, severity: 'NOT_EVALUATED', description: 'Awaiting document-level evaluation by the rule engine.', handbookClause: r.handbookClause });
}
const sevOrder = { CRITICAL: 0, WARNING: 1, PASSED: 2, NOT_EVALUATED: 3 };

/* ============================== wizard ============================== */
function activeFdrs() { return myFdrs().filter(f => !['RELEASED', 'MATURED'].includes(fdrStatus(f))).sort((a, b) => b.amountLakhs - a.amountLakhs); }
function newWizard(type) {
  const i = inst(), last = myApps().find(a => a.status !== 'DRAFT'), d = last ? last.intakeDetails : {};
  const primary = activeFdrs()[0];
  return {
    draftId: null, type, step: 1, created: now().toISOString(), idemKey: uuid(),
    inst: { name: i.name, pid: i.pid, state: i.state, district: i.district, address: i.address, type: i.type, region: i.region, academicYear: '2026-27' },
    prog: {
      currentTotalIntake: d.currentTotalIntake ?? i.sanctionedIntake, proposedTotalIntake: d.proposedTotalIntake ?? i.sanctionedIntake, totalStudents: d.totalStudents ?? i.totalStudents,
      professors: d.professors ?? '', associateProfessors: d.associateProfessors ?? '', assistantProfessors: d.assistantProfessors ?? '', totalBuiltUpAreaSqM: d.totalBuiltUpAreaSqM ?? '',
      level: 'UG', programme: '', discipline: 'Engineering & Technology', programmeIntake: '', shift: '1st Shift', change: 'Increase in intake', eoaChange: 'No change from previous year',
      changeCategory: 'Change of Address / Site', changeDetails: '', closureType: 'Progressive closure of programme', closureReason: '', liabilitiesCleared: false,
    },
    fdr: { mode: primary ? 'existing' : 'new', existingId: primary ? primary.id : '', fdrNumber: '', bankName: 'State Bank of India', branchName: '', ifscCode: '', amountRs: '', issueDate: '', maturityDate: '' },
    docs: {}, ai: null, declared: false, esign: null,
  };
}
function saveWizard() { if (UI.w) { UI.w.savedAt = now().toISOString(); } }
function wizardFdr(w) {
  if (w.fdr.mode === 'existing') return DB.fdrs.find(f => f.id === w.fdr.existingId) || null;
  const f = w.fdr;
  return { fdrNumber: (f.fdrNumber || '').trim().toUpperCase(), bankName: f.bankName, branchName: f.branchName, ifscCode: (f.ifscCode || '').trim().toUpperCase(), amountLakhs: (+f.amountRs || 0) / 1e5, issueDate: f.issueDate, maturityDate: f.maturityDate, jointLienHolder: `Regional Officer, ${w.inst.region} Regional Office, AICTE`, isLienConfirmed: false, tenureYears: 10 };
}
function collectWizard() {
  const root = $('#wiz');
  if (!root) return;
  const vals = readForm(root);
  Object.entries(vals).forEach(([k, v]) => setPath(UI.w, k, v));
}
function validateStep(step) {
  const w = UI.w, e = {};
  if (step === 1) {
    if (!w.inst.district.trim()) e['inst.district'] = 'District / City is required';
    if (!w.inst.address.trim()) e['inst.address'] = 'Address is required';
  }
  if (step === 2) {
    const p = w.prog;
    ['totalStudents', 'professors', 'associateProfessors', 'assistantProfessors', 'totalBuiltUpAreaSqM', 'currentTotalIntake', 'proposedTotalIntake'].forEach(k => {
      if (p[k] === '' || isNaN(+p[k]) || +p[k] < 0) e[`prog.${k}`] = 'Enter a valid number';
    });
    if (!e['prog.professors'] && norms(p).fac === 0) e['prog.assistantProfessors'] = 'Total faculty cannot be zero';
    if (w.type === 'NEW_PROGRAMME' || w.type === 'INTAKE_VARIATION') {
      if (!p.programme.trim()) e['prog.programme'] = 'Programme name is required';
      if (w.type === 'NEW_PROGRAMME' && !(+p.programmeIntake > 0)) e['prog.programmeIntake'] = 'Enter the proposed programme intake';
    }
    if (w.type === 'INFRASTRUCTURE_UPDATE' && !p.changeDetails.trim()) e['prog.changeDetails'] = 'Describe the requested change';
    if (w.type === 'CLOSURE') {
      if (!p.closureReason.trim()) e['prog.closureReason'] = 'State the reason for closure';
      if (!p.liabilitiesCleared) e['prog.liabilitiesCleared'] = 'Confirmation is mandatory for closure';
    }
  }
  if (step === 3) {
    const f = w.fdr;
    if (f.mode === 'existing') { if (!f.existingId) e['fdr.existingId'] = 'Select an FDR'; }
    else {
      if (!/^[A-Z0-9][A-Z0-9\-/]{5,}$/i.test(f.fdrNumber.trim())) e['fdr.fdrNumber'] = 'Enter a valid FDR / TDR number';
      if (!f.branchName.trim()) e['fdr.branchName'] = 'Branch name is required';
      if (!ifscOk(f.ifscCode.trim().toUpperCase())) e['fdr.ifscCode'] = 'IFSC must be 11 characters, e.g. SBIN0001234';
      if (!(+f.amountRs > 0)) e['fdr.amountRs'] = 'Enter the deposit amount in ₹';
      if (!f.issueDate) e['fdr.issueDate'] = 'Issue date is required';
      else if (daysUntil(f.issueDate) > 0) e['fdr.issueDate'] = 'Issue date cannot be in the future';
      if (!f.maturityDate) e['fdr.maturityDate'] = 'Maturity date is required';
      else if (f.issueDate && f.maturityDate <= f.issueDate) e['fdr.maturityDate'] = 'Maturity must be after issue date';
    }
  }
  UI.err = e;
  return !Object.keys(e).length;
}
function fdrChecks(fdr) {
  if (!fdr) return [];
  const req = requiredLakhs(), out = [];
  const bc = bankCode(fdr.bankName);
  out.push({ label: `Deposit amount ≥ required corpus (${crLabel(req)})`, s: fdr.amountLakhs >= req ? 'ok' : 'fail', note: fdr.amountLakhs ? `${crLabel(fdr.amountLakhs)} declared` : 'Amount not entered' });
  if (fdr.issueDate && fdr.maturityDate) out.push({ label: 'Tenure is 10 years (APH Chapter VI lock-in)', s: fdr.maturityDate >= addYears(fdr.issueDate, 10, true) ? 'ok' : 'fail', note: `${fmtDate(fdr.issueDate)} → ${fmtDate(fdr.maturityDate)}` });
  if (fdr.maturityDate) out.push({ label: 'Maturity date is in the future', s: daysUntil(fdr.maturityDate) > 0 ? (daysUntil(fdr.maturityDate) <= 180 ? 'warn' : 'ok') : 'fail', note: daysUntil(fdr.maturityDate) > 0 ? `${daysUntil(fdr.maturityDate)} days remaining` : 'Matured' });
  if (fdr.ifscCode) out.push({ label: 'Bank details consistent (IFSC ↔ bank)', s: bc && fdr.ifscCode.startsWith(bc) ? 'ok' : 'warn', note: bc ? `${fdr.bankName} IFSC prefix ${bc}` : 'Bank not in CBS adapter list' });
  out.push({ label: 'Joint lien in favour of Regional Officer, AICTE', s: /AICTE/.test(fdr.jointLienHolder || '') ? 'ok' : 'fail', note: fdr.jointLienHolder });
  const src = lienSource(fdr);
  out.push({ label: 'Bank confirmation of the joint lien', s: LIEN_SOURCE[src][1], note: src === 'PENDING' ? 'Awaiting confirmation by a bank official' : `${LIEN_SOURCE[src][0]}${fdr.lienEndorsementToken ? ` · Token ${fdr.lienEndorsementToken}` : ''}` });
  return out;
}
const sIcon = s => `<span class="vstat ${s}">${s === 'ok' ? ic('check', 13) : s === 'warn' ? ic('alert', 12) : s === 'fail' ? ic('x', 13) : ''}</span>`;

function sampleDoc(type) {
  const i = inst(), m = docMeta(type);
  if (type === 'LAND_TITLE') return { fileName: 'Registered_Sale_Deed_Khasra_441.pdf', fileSizeKb: 4210, fileHash: '8f4c28bb9c1184a49cbe5012e847c20a91176b9708faee6e1a499a0ff3769c01', pageCount: 18, sample: true, deedEntity: 'Delhi Institute of Technology & Science' };
  if (type === 'FIRE_SAFETY' && i.id === 'inst-1') return { fileName: 'Delhi_Fire_Service_NOC_2025.pdf', fileSizeKb: 1850, fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', pageCount: 4, validTill: '2026-11-03', sample: true };
  return { fileName: `${i.short.replace(/\s+/g, '_')}_${m.file}.pdf`, fileSizeKb: 300 + (i.pid.charCodeAt(i.pid.length - 1) * 37 + type.length * 113) % 3500, fileHash: fnvHex(new TextEncoder().encode(i.id + type)), pageCount: 2 + type.length % 12, validTill: m.expiry ? m.sampleValid : '', sample: true };
}
function hashOwner(hash) {
  for (const a of DB.apps) {
    if (a.status === 'DRAFT') continue;
    const d = (a.documents || []).find(x => x.fileHash === hash);
    if (d) return { app: a, doc: d, inst: DB.institutions.find(i => i.id === a.institutionId) };
  }
  return null;
}
function analyseDoc(m, d, ctx) {
  const { i, p, fdr, w } = ctx, n = norms(p);
  const fields = [], anomalies = [], remarks = [], verified = {};
  let qrPayload = null;
  const owner = hashOwner(d.fileHash);
  const collision = owner && owner.inst && owner.inst.id !== i.id;
  const internalDup = Object.entries(w.docs).find(([t, x]) => t !== m.type && x.fileHash === d.fileHash && DOC_TYPES.findIndex(z => z.type === t) < DOC_TYPES.findIndex(z => z.type === m.type));
  if (m.type === 'LAND_TITLE') {
    const ent = d.deedEntity || i.name;
    fields.push({ label: 'Institution Name in Deed', value: ent, page: 1, sourceLine: `Deed executed in favour of ${ent}`, isCoherent: ent === i.name });
    fields.push({ label: 'Filing Institution', value: `${i.name} (PID ${i.pid})`, page: 0, sourceLine: 'Portal application header', isCoherent: ent === i.name });
    if (d.sample) { fields.push({ label: 'Land Area (Acres)', value: '10.5 Acres (Contiguous)', page: 2, sourceLine: 'Total contiguous land measuring 10.50 Acres in Revenue Village Alipur', isCoherent: true }); qrPayload = { issuingAuthority: 'Dept of Revenue, Govt of NCT Delhi', certId: 'DEL-REV-2012-88192', issueDate: '2012-04-18', validTill: 'PERPETUAL', signerName: 'Sub-Registrar IV, North Delhi' }; }
    if (ent !== i.name) anomalies.push('Geographic and institutional entity mismatch.');
    verified['Entity Named in Deed'] = ent;
  } else if (m.expiry) {
    const v = d.validTill, left = v ? daysUntil(v) : null;
    fields.push({ label: 'Issuing Authority', value: m.authority, page: 1, sourceLine: `${m.authority} — ${m.name}`, isCoherent: true });
    fields.push({ label: 'Valid Till', value: v || 'Not declared', page: 2, sourceLine: v ? `Valid till ${fmtDate(v)}` : 'Validity date not declared by applicant', isCoherent: left !== null && left >= 183 });
    if (left !== null && left < 0) anomalies.push(`${m.short} expired on ${fmtDate(v)}.`);
    else if (left !== null && left < 183) anomalies.push(`${m.short} renewal due within ${left} days.`);
    else if (left === null) anomalies.push('Validity date not declared — cannot verify against AY 2026-27.');
    if (d.sample) qrPayload = { issuingAuthority: m.authority, certId: `${m.short.replace(/\W/g, '').toUpperCase()}/${i.pid.slice(-5)}`, issueDate: '2023-11-04', validTill: v, signerName: 'Authorised Signatory' };
    verified[`${m.short} Status`] = left === null ? 'Validity not declared' : left < 0 ? 'Expired' : left < 183 ? 'Valid but near expiry' : 'Valid';
  } else if (m.type === 'FDR_CORPUS' && fdr) {
    fields.push({ label: 'Bank Name', value: fdr.bankName, page: 1, sourceLine: `${fdr.bankName}, ${fdr.branchName}`, isCoherent: true });
    fields.push({ label: 'FDR Number', value: fdr.fdrNumber, page: 1, sourceLine: `Term Deposit Receipt No: ${fdr.fdrNumber}`, isCoherent: true });
    fields.push({ label: 'Deposit Amount', value: fmtAmount(fdr.amountLakhs), page: 1, sourceLine: `Amount: INR ${rupees(fdr.amountLakhs * 1e5).slice(2)}`, isCoherent: fdr.amountLakhs >= requiredLakhs() });
    fields.push({ label: 'Lien Holder', value: fdr.jointLienHolder, page: 1, sourceLine: `Under irrevocable joint lien with ${fdr.jointLienHolder}`, isCoherent: true });
    fields.push({ label: 'Maturity Date', value: fdr.maturityDate, page: 1, sourceLine: `Tenure 10 years, Maturity Date: ${fdr.maturityDate}`, isCoherent: fdr.maturityDate >= addYears(fdr.issueDate, 10, true) });
    if (fdr.amountLakhs < requiredLakhs()) anomalies.push(`Corpus ${crLabel(fdr.amountLakhs)} below required ${crLabel(requiredLakhs())}.`);
    verified['Corpus Amount'] = `${crLabel(fdr.amountLakhs)} (${fdr.amountLakhs >= requiredLakhs() ? 'Fully met' : 'Shortfall'})`;
    verified['Lien Status'] = LIEN_SOURCE[lienSource(fdr)][0];
  } else if (m.type === 'FACULTY_CADRE') {
    fields.push({ label: 'Total Faculty', value: `${n.fac} Regular Faculty`, page: 1, sourceLine: `Total Teaching Faculty on rolls: ${n.fac}`, isCoherent: n.sfrOk });
    fields.push({ label: 'Professors', value: String(n.P), page: 2, sourceLine: `Cadre breakdown: Professors - ${n.P}`, isCoherent: n.profOk });
    fields.push({ label: 'Associate Professors', value: String(n.A), page: 2, sourceLine: `Associate Professors - ${n.A}`, isCoherent: n.assocOk });
    fields.push({ label: 'Assistant Professors', value: String(n.S), page: 2, sourceLine: `Assistant Professors - ${n.S}`, isCoherent: true });
    if (!n.sfrOk) anomalies.push(`Student-to-Faculty Ratio ${n.sfrStr} exceeds statutory threshold of 1:20.`);
    if (!n.profOk) anomalies.push(`Professor cadre deficit: ${n.P} against ${n.reqP} required (Appendix 7).`);
    verified['Student Faculty Ratio'] = `${n.sfrStr} (Norm <= 1:20)`;
    verified['Cadre Proportion'] = `${n.ratio} (${n.profOk && n.assocOk ? 'Compliant' : 'Non-compliant'})`;
  } else if (m.type === 'STATE_NOC') {
    fields.push({ label: 'NOC Status', value: `Valid for AY ${w.inst.academicYear}`, page: 1, sourceLine: `No objection for AY ${w.inst.academicYear}`, isCoherent: true });
    fields.push({ label: 'State', value: w.inst.state, page: 1, sourceLine: `Directorate of Technical Education, ${w.inst.state}`, isCoherent: true });
  } else {
    fields.push({ label: 'Document Category', value: m.name, page: 1, sourceLine: d.fileName, isCoherent: true });
  }
  fields.push({ label: 'Pages Detected', value: String(d.pageCount), page: 0, sourceLine: d.sample ? 'Sample document' : 'PDF page tree / image count', isCoherent: true });
  if (collision) { anomalies.unshift('Binary hash match with an unrelated institution application.'); remarks.push(`CRITICAL FORENSIC ALERT: Exact SHA-256 binary duplicate of a document filed by ${owner.inst.name} in ${owner.app.applicationNumber}.`); }
  else if (owner) remarks.push(`Previously filed by this institution in ${owner.app.applicationNumber} (same-entity re-use).`);
  else remarks.push('No hash collisions detected');
  if (internalDup) { anomalies.push(`Identical file also uploaded as ${docMeta(internalDup[0]).short}.`); }

  const fail = collision || fields.some(f => /^Institution Name/.test(f.label) && !f.isCoherent) || (m.expiry && d.validTill && daysUntil(d.validTill) < 0);
  const warn = !fail && (anomalies.length || fields.some(f => !f.isCoherent));
  const statusNote = fail ? (collision ? 'SHA-256 duplicate of another institution’s filing' : anomalies[0] || 'Inconsistency detected')
    : warn ? anomalies[0] || 'Field needs attention'
      : m.type === 'FDR_CORPUS' ? 'Details matched with FDR form' : m.type === 'FACULTY_CADRE' ? 'Cadre matches declared numbers' : 'Details extracted successfully';
  const summary = fail || warn
    ? `${m.name} analysed. ${anomalies.join(' ')}`.trim()
    : `${m.name} is consistent with the application data${m.type === 'FDR_CORPUS' ? ` — ${crLabel(fdr.amountLakhs)} under joint lien with AICTE` : ''}.`;
  return {
    type: m.type, name: m.name, short: m.short, fileName: d.fileName, hash: d.fileHash, status: fail ? 'fail' : warn ? 'warn' : 'ok', note: statusNote, fields,
    forensics: { sha256Match: !!collision, duplicateApplicationId: collision ? owner.app.applicationNumber : undefined, duplicateInstitutionName: collision ? owner.inst.name : undefined, internalDuplicateOf: internalDup ? internalDup[0] : undefined, qrCodeValid: !!qrPayload, qrPayload, dateChronologyValid: !(m.expiry && d.validTill && daysUntil(d.validTill) < 0), remarks },
    gemini: { status: 'COMPLETED', modelUsed: 'gemini-3.5-flash (simulated)', timestamp: now().toISOString(), summary, verifiedAttributes: verified, detectedAnomalies: anomalies, disclaimer: 'AI interpretation based on extracted document text. Advisory only — not a regulatory decision.' },
  };
}
function runValidation(w) {
  const i = inst(), p = w.prog, fdr = wizardFdr(w);
  const analysed = DOC_TYPES.filter(d => w.docs[d.type]).map(m => analyseDoc(m, w.docs[m.type], { i, p, fdr, w }));
  const findings = evaluateRules({ i, p, fdr, docs: w.docs, analysed, reqLakhs: requiredLakhs() }).sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
  const cross = [];
  const fdrDoc = analysed.find(a => a.type === 'FDR_CORPUS');
  cross.push({ label: 'FDR number matches FDR certificate', s: fdrDoc ? 'ok' : 'warn', note: fdrDoc ? fdr.fdrNumber : 'FDR certificate not uploaded' });
  fdrChecks(fdr).forEach(c => cross.push(c));
  const pidF = findings.find(f => f.ruleCode === 'RULE-PID-03');
  cross.push({ label: 'Institution name & PID coherent across documents', s: pidF.severity === 'PASSED' ? 'ok' : 'fail', note: pidF.severity === 'PASSED' ? `PID ${i.pid}` : 'Entity mismatch' });
  const hashF = findings.find(f => f.ruleCode === 'RULE-DUPLICATE-HASH-04');
  cross.push({ label: 'No cross-application SHA-256 duplicates', s: hashF.severity === 'PASSED' ? 'ok' : hashF.severity === 'WARNING' ? 'warn' : 'fail', note: hashF.severity === 'PASSED' ? 'All fingerprints unique' : hashF.description.slice(0, 80) + '…' });
  const crit = findings.filter(f => f.severity === 'CRITICAL').length, warns = findings.filter(f => f.severity === 'WARNING').length;
  const summary = `${analysed.length} document(s) analysed with native PDF text + OCR fallback. Deterministic engine evaluated ${findings.length} rules: ${findings.length - crit - warns} passed, ${warns} warning(s), ${crit} critical. ${crit ? 'Critical findings will be visible to the Regional Scrutiny Committee and are likely to result in a deficiency notice unless rectified before submission.' : warns ? 'Advisory warnings should be addressed or explained to avoid clarification requests.' : 'No blocking issues detected.'}`;
  return { docs: analysed, findings, cross, summary, at: now().toISOString(), counts: { crit, warns, passed: findings.length - crit - warns } };
}

// Server findings are authoritative; on-device PID/entity extraction is kept as an advisory finding.
function mergeServerFindings(w, server) {
  if (!server) return;
  const advisory = w.ai.findings.filter(f => f.ruleCode === 'RULE-PID-03').map(f => ({ ...f, isDeterministic: false, ruleName: `${f.ruleName} (on-device extraction, advisory)` }));
  const findings = [...server, ...advisory].sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
  const crit = findings.filter(f => f.severity === 'CRITICAL').length, warns = findings.filter(f => f.severity === 'WARNING').length;
  const dup = server.find(f => f.ruleCode === 'RULE-DUPLICATE-HASH-04');
  w.ai.cross = w.ai.cross.map(c => c.label.startsWith('No cross-application') && dup
    ? { ...c, s: dup.severity === 'PASSED' ? 'ok' : dup.severity === 'WARNING' ? 'warn' : 'fail', note: dup.severity === 'PASSED' ? 'Verified on server across all institutions' : dup.description.slice(0, 90) + '…' } : c);
  w.ai.findings = findings;
  w.ai.counts = { crit, warns, passed: findings.length - crit - warns };
  w.ai.serverVerified = true;
}

// Success is shown only after the backend confirms the record. Retries reuse the idempotency key (no duplicates).
async function submitApplication(el) {
  const w = UI.w;
  const res = await busy(el, async () => {
    const r = await Backend.submitApplication(w);
    UI.w = null; UI.wChanged = false;
    UI.stack = [{ name: 'dashboard', params: {} }];
    go('submitted', { id: r.applicationId });
    return r;
  }, 'Submitting securely…');
  if (!res && UI.w) submissionFailedSheet();
}
function submissionFailedSheet() {
  openSheet('Submission not confirmed', `<div class="banner warn">${ic('alert', 18)}<div>We could not confirm that your application was saved. Retrying is safe — the same request reference is reused, so no duplicate application will be created.</div></div>
    ${Object.keys(UI.err).length ? `<div class="mt12 small"><b>Please correct:</b><ul style="padding-left:18px;margin:6px 0">${Object.values(UI.err).map(m => `<li>${esc(m)}</li>`).join('')}</ul></div>` : ''}
    <div style="display:grid;gap:10px" class="mt16"><button class="btn btn-primary btn-block" data-act="retrySubmit">${ic('refresh', 18)} Retry submission</button><button class="btn btn-ghost btn-block" data-act="editFromReview">Edit application</button></div>`);
}

/* ============================== acknowledgement & documents ============================== */
function ackHtml(app) {
  const i = DB.institutions.find(x => x.id === app.institutionId), fdr = DB.fdrs.find(f => f.fdrNumber === app.fdrNumber);
  const rows = [['Application Reference Number', app.applicationNumber], ['Application Type', TYPE_LONG[app.type]], ['Academic Year', app.academicYear], ['Institution', i.name], ['Permanent Institute ID (PID)', i.pid], ['Region', `${i.region} Regional Office`], ['Submitted On', fmtDT(app.submittedAt)], ['Security Deposit (FDR)', fdr ? `${fdr.fdrNumber} — ${fmtAmount(fdr.amountLakhs)}, ${fdr.bankName}` : app.fdrNumber || '—'], ['Documents Uploaded', String(app.documents.length)], ['e-Sign Reference', app.esign ? `${app.esign.ref} (${app.esign.method === 'DSC' ? 'DSC' : 'Aadhaar eSign'})` : '—'], ['Current Status', STATUS[app.status][0]]];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acknowledgement ${esc(app.applicationNumber)}</title><style>body{font-family:Georgia,serif;max-width:720px;margin:24px auto;padding:0 16px;color:#111}.c{text-align:center}h1{font-size:18px;text-align:center;margin:18px 0 6px;text-transform:uppercase}table{width:100%;border-collapse:collapse;margin-top:12px}td{border:1px solid #999;padding:7px 9px;font-size:13px;vertical-align:top}td:first-child{background:#f3f3f3;width:40%;font-weight:bold}small{color:#555}hr{border:0;border-top:2px solid #111}</style></head><body>
<div class="c"><b>अखिल भारतीय तकनीकी शिक्षा परिषद</b><br><b>ALL INDIA COUNCIL FOR TECHNICAL EDUCATION</b><br><small>(A Statutory Body under Ministry of Education, Govt. of India)<br>Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070</small></div><hr>
<h1>Application Acknowledgement</h1><p class="c"><small>AICTE Intelligent Regulatory Validation Platform (AI-IRVP) · Institution Portal</small></p>
<table>${rows.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</table>
<p><small>This acknowledgement confirms receipt of the application only. Documents are subject to automated forensic validation and Regional Scrutiny Committee review under the AICTE Approval Process Handbook (APH 2026-27).<br>System generated document · AI-IRVP Regulatory Engine v2026.1 · Generated ${esc(fmtDT(now()))}.<br>PROTOTYPE — does not constitute official regulatory approval.</small></p></body></html>`;
}
function fdrAdviceHtml(f) {
  const i = DB.institutions.find(x => x.id === f.institutionId);
  const rows = [['FDR Certificate Number', f.fdrNumber], ['Institution', i.name], ['Permanent Institute ID', i.pid], ['Principal Deposit Amount', fmtAmount(f.amountLakhs)], ['Deposit Horizon & Maturity', `${f.issueDate} to ${f.maturityDate} (${f.tenureYears} Years)`], ['Issuing Bank & Branch', `${f.bankName} • ${f.branchName} (IFSC: ${f.ifscCode})`], ['Irrevocable Joint Lien', `Jointly pledged in favour of ${f.jointLienHolder}. Non-encashable without council release decree.`], ['CBS Lien Status', f.isLienConfirmed ? `Confirmed — Token ${f.lienEndorsementToken || 'CBS-AUTH-VERIFIED'}` : 'Awaiting Bank CBS Endorsement'], ['Status', FSTATUS[fdrStatus(f)][0]], ['Linked Application', f.applicationNumber]];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(f.fdrNumber)}</title><style>body{font-family:Georgia,serif;max-width:720px;margin:24px auto;padding:0 16px}h1{font-size:17px;text-align:center}table{width:100%;border-collapse:collapse}td{border:1px solid #999;padding:7px 9px;font-size:13px}td:first-child{background:#f3f3f3;width:38%;font-weight:bold}small{color:#555}</style></head><body><h1>Fixed Deposit Advice &amp; Lien Certificate</h1><table>${rows.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</table><p><small>Generated from the AICTE Institution Portal on ${esc(fmtDT(now()))}. Core Banking (CBS) holds the authoritative ledger balance. Prototype record.</small></p></body></html>`;
}

/* ============================== views ============================== */
const V = {};

const SLIDES = [
  { tag: 'Institution Portal', h1: 'AICTE', h2: 'Intelligent Regulatory<br>Validation Platform', p: 'Security Deposit / FDR Management<br>Approval &amp; Compliance' },
  { tag: 'AI-Assisted Scrutiny', h1: 'AI-IRVP', h2: 'AI Document Validation', p: 'OCR extraction, SHA-256 duplicate forensics, 2D QR decoding and certificate expiry checks — before you submit.' },
  { tag: 'Security Deposit', h1: '₹ FDR', h2: 'Joint Lien Lifecycle', p: 'Track CBS lien endorsement, 10-year maturity, renewals, replacements and lien release from your phone.' },
];
// Office photos shown in the onboarding slideshow (first = shown on launch). They glide in left → right, one by one.
const OFFICES = [
  { city: 'AICTE · New Delhi', src: 'delhi.webp', alt: 'AICTE headquarters building, New Delhi', w: 367, h: 234, pos: 'center 45%' },
  { city: 'AICTE · Mumbai', src: 'mumbai.webp', alt: 'AICTE office building, Mumbai', w: 392, h: 202, pos: 'center 50%' },
];
function startOfficeShow() {
  const track = $('#obTrack'), cap = $('#obCity span');
  if (!track || track.children.length < 2) return;
  const n = track.children.length;
  const at = k => { track.style.transform = `translateX(${-k * 100}%)`; };
  track.style.transition = 'none'; at(n - 1);                    // the visible photo is always the last child
  const advance = () => {
    if (!track.isConnected) return clearInterval(UI.obTimer);
    if (document.hidden || UI.obPaused) return;
    track.style.transition = 'transform 1.1s cubic-bezier(.65,0,.35,1)';
    at(n - 2);                                                     // previous child slides in from the left → motion is left to right
    cap.parentElement.classList.add('swap');
    let done = false;
    const finish = () => {
      if (done || !track.isConnected) return;
      done = true;
      track.style.transition = 'none';
      track.prepend(track.lastElementChild);                       // recycle: keep an endless left-to-right loop
      at(n - 1);
      cap.textContent = track.lastElementChild.dataset.city;
      cap.parentElement.classList.remove('swap');
    };
    track.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 1300);                                      // transitionend can be skipped in background tabs
  };
  clearInterval(UI.obTimer);
  if (reducedMotion()) return;
  UI.obTimer = setInterval(advance, 3200);
  const fig = track.parentElement;
  fig.addEventListener('pointerdown', () => { UI.obPaused = true; }, { passive: true });
  fig.addEventListener('pointerup', () => { UI.obPaused = false; }, { passive: true });
  fig.addEventListener('pointercancel', () => { UI.obPaused = false; }, { passive: true });
}
const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const slideIndex = () => { const s = $('#slides'); return s ? Math.round(s.scrollLeft / (s.clientWidth || 1)) : 0; };
V.splash = () => ({
  header: 'none', cls: 'splash flush',
  body: `<div class="ob">
    <header class="ob-brand">
      <img class="ob-logo" src="emblem.png" alt="AICTE emblem" width="60" height="60" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ob-logo-fallback',textContent:'AICTE'}))">
      <div class="ob-org"><b>All India Council for Technical Education</b><span>Ministry of Education&nbsp;·<wbr> Government of India</span></div>
    </header>
    <section class="ob-carousel" aria-roledescription="carousel" aria-label="About the platform"><div class="ob-stage">
      ${`<button class="ob-lang" data-act="toggleLang" translate="no" aria-label="${I18N.lang === 'hi' ? 'Switch to English' : 'हिन्दी में बदलें'}">${ic('globe', 16)}${I18N.lang === 'hi' ? 'English' : 'हिन्दी'}</button>`}
      <button class="ob-skip" data-act="obSkip" id="obSkip" aria-label="Skip introduction">Skip</button>
      <div class="slides" id="slides" aria-live="polite">
        ${SLIDES.map((s, k) => `<div class="slide" role="group" aria-roledescription="slide" aria-label="${k + 1} of ${SLIDES.length}"><span class="ob-tag">${s.tag}</span><h1>${s.h1}</h1><h2>${s.h2}</h2><p>${s.p}</p></div>`).join('')}
      </div>
      <div class="dots" id="dots">${SLIDES.map((_, k) => `<button class="${k ? '' : 'on'}" data-act="slideTo" data-v="${k}" aria-label="Show slide ${k + 1} of ${SLIDES.length}" ${k ? '' : 'aria-current="true"'}></button>`).join('')}</div>
    </div></section>
    <figure class="ob-figure" aria-roledescription="carousel" aria-label="AICTE offices">
      <div class="ob-track" id="obTrack">${[...OFFICES].reverse().map(o => `<div class="ob-shot" data-city="${o.city}" aria-label="${o.alt}"><img class="building-image" src="${o.src}" alt="${o.alt}" width="${o.w}" height="${o.h}" decoding="async" style="object-position:${o.pos}" onerror="this.closest('.ob-shot').classList.add('failed')"><span class="ob-fallback" aria-hidden="true">${ic('landmark', 34)}<span>${o.city}</span></span></div>`).join('')}</div>
      <figcaption class="ob-city" id="obCity" aria-live="polite">${ic('landmark', 13)}<span>${OFFICES[0].city}</span></figcaption>
    </figure>
    <div class="splash-actions">
      <button class="btn btn-hero btn-block" data-act="obNext" id="obNext">Next ${ic('chev', 18)}</button>
      <button class="btn btn-outline btn-block btn-tall" data-act="openLogin">Login</button>
      <nav class="ob-links" aria-label="Legal and support"><button data-act="legal" data-v="privacy">Privacy Policy</button><span aria-hidden="true">·</span><button data-act="legal" data-v="help" aria-label="Help and Support">Help<span class="wide-only"> &amp; Support</span></button><span aria-hidden="true">·</span><button data-act="legal" data-v="terms">Terms of Use</button></nav>
    </div>
  </div>`,
  after: () => {
    const s = $('#slides'), slides = $$('.slide', s), dots = $$('#dots button'), next = $('#obNext'), skip = $('#obSkip');
    let raf = 0, last = -1;
    const paint = () => {
      raf = 0;
      const pos = s.scrollLeft / (s.clientWidth || 1);
      const k = Math.round(pos);
      if (k !== last) {
        last = k;
        dots.forEach((d, j) => { d.classList.toggle('on', j === k); d.toggleAttribute('aria-current', j === k); });
        const final = k >= SLIDES.length - 1;
        next.innerHTML = `${final ? 'Get Started' : 'Next'} ${ic('chev', 18)}`;
        next.setAttribute('aria-label', final ? 'Get started' : `Next slide (${k + 2} of ${SLIDES.length})`);
        skip.style.visibility = final ? 'hidden' : 'visible';
      }
      if (reducedMotion()) return;
      slides.forEach((el, j) => {
        const d = Math.min(1, Math.abs(pos - j));
        el.style.opacity = String(1 - d * 0.75);
        el.style.transform = `translateY(${(d * 8).toFixed(1)}px) scale(${(1 - d * 0.04).toFixed(3)})`;
      });
    };
    s.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(paint); }, { passive: true });
    paint();
    startOfficeShow();
  },
});

V.boot = () => ({
  header: 'none', cls: 'splash flush',
  body: `<div class="boot" role="status" aria-live="polite"><img src="emblem.png" alt="" width="72" height="72"><div class="spin lg" aria-hidden="true"></div><p>Connecting securely…</p></div>`,
});
V.bootError = ({ message }) => ({
  header: 'none', cls: 'splash flush',
  body: `<div class="boot"><img src="emblem.png" alt="" width="72" height="72"><div class="banner err" style="text-align:left">${ic('alert', 18)}<div><b>Unable to reach the AICTE server</b><div>${esc(message || 'Please check your connection.')}</div></div></div>
    <button class="btn btn-primary btn-block" data-act="retryBoot">${ic('refresh', 18)} Retry</button></div>`,
});

V.login = () => {
  const t = UI.loginTab, root = UI.stack.length === 1;
  return {
    header: 'none', cls: 'flush',
    body: `<section class="fv-hero">
        <div class="fv-hero-top">
          <div>${root ? `<span class="fv-aicte"><img src="emblem.png" alt="AICTE emblem"><span translate="no">AICTE</span></span>` : `<button class="icon-btn" data-act="back" aria-label="Back">${ic('back', 22)}</button>`}</div>
          <div>${root ? `<button class="fv-pill-btn" data-act="showIntro">Introduction</button>` : ''}<button class="fv-pill-btn" data-act="toggleLang" translate="no">${ic('globe', 14)} ${I18N.lang === 'hi' ? 'EN' : 'हिन्दी'}</button></div>
        </div>
        <div class="fv-logo"><img src="fdr-vault-logo.png" alt="FDR Vault logo"></div>
        <div><h1 translate="no">FDR VAULT</h1><p>Security Deposit &amp; Approvals Portal</p></div>
      </section>
      <div class="fv-sheet">
        <div class="seg" role="tablist"><button role="tab" aria-selected="${t === 'login'}" class="${t === 'login' ? 'on' : ''}" data-act="loginTab" data-v="login">Login</button><button role="tab" aria-selected="${t === 'register'}" class="${t === 'register' ? 'on' : ''}" data-act="loginTab" data-v="register">Register</button></div>
        <div class="mt16">${t === 'login' ? loginForm() : registerForm()}</div>
      </div>
      <div class="fv-below">
        ${t === 'login' ? loginExtras() : ''}
        <p class="legal" style="margin-top:20px;font-size:10.5px;color:var(--muted)">Protected system under Section 43 &amp; 66 of Information Technology Act, 2000. Unauthorized access is strictly prohibited.</p>
        <nav class="ob-links" aria-label="Legal and support"><button data-act="legal" data-v="privacy">Privacy Policy</button><span aria-hidden="true">·</span><button data-act="legal" data-v="help">Help</button><span aria-hidden="true">·</span><button data-act="legal" data-v="terms">Terms of Use</button></nav>
        ${aicteInfo()}
      </div>`,
  };
};

// AICTE leadership as published on aicte-india.org/about-us/leadership-team (photos in members/). Edit here when it changes.
const LEADERSHIP = [
  ['Chairman Secretariat', [
    ['Prof. T. G. Sitharam', 'Chairman', 'sitharam'],
    ['Dr. Abhay Jere', 'Vice Chairman', 'jere'],
    ['Prof. Rajive Kumar', 'Member Secretary', 'rajive-kumar'],
  ]],
  ['Advisers', [
    ['Dr. Raghab P. Dash', 'Adviser-I', 'raghab-dash'],
    ['Dr. Buddha Chandrasekhar', 'Chief Coordinating Officer', 'buddha-chandrasekhar'],
    ['Dr. More Ramulu', 'Adviser-I', ''],
    ['Dr. N. H. Siddalinga Swamy', 'Adviser-II', 'siddalinga-swamy'],
  ]],
  ['Directors', [
    ['Smt. Gujju Manusree', 'Director', 'manusree'],
    ['Dr. Amit Dutta', 'Director', 'amit-dutta'],
    ['Dr. Dinesh Singh', 'Director', 'dinesh-singh'],
    ['Mrs. Garima Rohela', 'Director', 'garima-rohela'],
    ['Sh. Kunal Jeet Singh', 'Director', 'kunal-jeet-singh'],
    ['Dr. Sunil Luthra', 'Director', 'sunil-luthra'],
    ['Ms. Asmita Dhillon', 'Director', 'asmita-dhillon'],
    ['Sh. Naresh Kumar Grover', 'Director', 'naresh-grover'],
  ]],
];
const APH_URL = 'https://www.pdffiller.com/s/oBzM6937B9';
function aicteInfo() {
  const person = ([name, role, img]) => `<figure class="ai-person">
      <div class="ai-photo">${img ? `<img src="members/${img}.webp" alt="${name}" loading="lazy" decoding="async" width="340" height="242" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${initials(name)}'}))">` : `<span>${initials(name)}</span>`}</div>
      <figcaption><b translate="no">${name}</b><small>${role}</small></figcaption></figure>`;
  return `<section class="ai-info" aria-labelledby="aiLead">
    <h3 class="ai-h" id="aiLead">AICTE Leadership</h3>
    ${LEADERSHIP.map(([group, people], k) => `<h4 class="ai-sub">${group}</h4><div class="ai-grid${k ? '' : ' lead'}">${people.map(person).join('')}</div>`).join('')}
    <h3 class="ai-h">Approval Process Handbook</h3>
    <a class="ai-book" href="${APH_URL}" target="_blank" rel="noopener">
      <img src="members/aph-cover.webp" alt="Cover of the AICTE Approval Process Handbook 2024-25 to 2026-27" width="420" height="594" loading="lazy" decoding="async">
      <span><b>Approval Process Handbook</b><small>2024-25 to 2026-27</small><small>Norms and procedures for AICTE approval of technical institutions.</small><em>${ic('download', 15)} Open handbook (PDF)</em></span>
    </a>
    <h3 class="ai-h">About AICTE</h3>
    <div class="ai-about">
      <img src="emblem.png" alt="AICTE logo" width="64" height="64" loading="lazy">
      <p>The All India Council for Technical Education (AICTE) is the national-level council for technical education under the Department of Higher Education, Ministry of Education, Government of India. Set up in November 1945 as an advisory body, it was given statutory status by the AICTE Act, 1987.</p>
      <p>AICTE plans and coordinates technical education across India, sets norms and standards, grants approval to institutions and programmes, and promotes quality, research and innovation.</p>
      <dl>
        <dt>Motto</dt><dd translate="no">योगः कर्मसु कौशलम् (Yogah Karmasu Kaushalam)</dd>
        <dt>Headquarters</dt><dd translate="no">Nelson Mandela Marg, Vasant Kunj, New Delhi – 110070</dd>
        <dt>Website</dt><dd><a href="https://www.aicte-india.org" target="_blank" rel="noopener" translate="no">www.aicte-india.org</a></dd>
      </dl>
    </div>
    <p class="ai-foot">© All India Council for Technical Education · Ministry of Education, Government of India</p>
  </section>`;
}
const GOOGLE_ICON = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>';
function loginForm() {
  const e = UI.err, remote = Backend.remote;
  return `${UI.loginErr ? `<div class="banner err" style="margin-bottom:14px" role="alert">${ic('alert', 18)}<div><b>Authentication Failed</b><div>${esc(UI.loginErr)}</div></div></div>` : ''}
  <form data-form="login" novalidate>
    <div class="field"><label for="loginEmail">${remote ? 'Registered Email' : 'Institution ID / Registered Email'} <span class="req">*</span></label>
      <div class="input-wrap">${ic('user', 18)}<input class="input ${e.email ? 'err' : ''}" id="loginEmail" name="email" value="${esc(UI.loginEmail || '')}" placeholder="${remote ? 'principal@institute.edu.in' : 'e.g. principal@dits-delhi.edu.in or PID'}" autocomplete="username" autocapitalize="off" inputmode="email"></div>
      ${e.email ? `<div class="ferr">${esc(e.email)}</div>` : ''}</div>
    <div class="field"><label for="pw">Password <span class="req">*</span></label>
      <div class="input-wrap">${ic('lock', 18)}<input class="input ${e.password ? 'err' : ''}" id="pw" name="password" type="password" value="${esc(UI.loginPw || '')}" placeholder="Enter your password" autocomplete="current-password" style="padding-right:48px">
      <button type="button" class="icon-btn trail" data-act="togglePw" aria-label="Show password">${ic('eye', 18)}</button></div>
      ${e.password ? `<div class="ferr">${esc(e.password)}</div>` : ''}</div>
    <div class="row between" style="margin:-2px 0 16px"><label class="check"><input type="checkbox" name="remember" ${UI.remember === false ? '' : 'checked'}> Remember me</label><button type="button" class="link" data-act="forgot">Forgot Password?</button></div>
    <button class="btn btn-primary btn-block" type="submit" ${UI.busy ? 'disabled' : ''}>${UI.busy ? '<span class="spin" aria-hidden="true"></span> Authenticating credentials...' : `${ic('lock', 17)} Login`}</button>
  </form>
  <div class="or">OR</div>
  <div class="fv-row2">
    <button class="btn btn-outline" data-act="googleLogin" aria-label="Continue with Google">${GOOGLE_ICON} Google</button>
    <button class="btn btn-outline" data-act="otpLogin" aria-label="Sign in with OTP">${ic('shieldCheck', 18)} Email OTP</button>
  </div>
  <button class="btn btn-ghost btn-block mt8" data-act="ssoLogin">${ic('landmark', 18)} Login with Government SSO</button>
  <p class="center mt12 small">New Institution? <button class="link" data-act="loginTab" data-v="register">Register Now</button></p>`;
}
// Below the login card: evaluator demo access and who may sign in here.
function loginExtras() {
  const remote = Backend.remote;
  return `${remote ? `<div class="card" style="padding:14px">
    <div class="fv-kicker">Institutional Testing / Evaluation Login</div>
    <div class="xs muted mt4">${esc(DEMO_LOGIN.email)} · <span class="mono">${esc(DEMO_LOGIN.password)}</span></div>
    <button class="btn btn-outline btn-block btn-sm mt8" data-act="demoLogin">${ic('user', 16)} Login as ${esc(DEMO_LOGIN.label)}</button></div>`
  : `<div class="card" style="padding:14px">
    <div class="fv-kicker">Select Institution (Testing &amp; Evaluation Access)</div>
    <div class="xs muted mt4">Tap any authorized institution below to load credentials and test:</div>
    <div class="row wrap mt8" style="gap:6px">${instUsers().map(u => `<button class="btn btn-ghost btn-xs" data-act="quickFill" data-id="${u.id}" style="background:#fff;border:1px solid var(--line2);color:var(--navy);font-weight:600">Institution (${esc(instOf(u).short)})</button>`).join('')}</div></div>`}
  <div class="banner info mt12">${ic('info', 18)}<div class="xs">This portal is restricted to authorized heads of technical institutions. AICTE scrutiny officers and council officials authenticate via the Administrative Council Portal.</div></div>`;
}
function registerForm() {
  const r = UI.reg || {}, c = UI.completing;
  return `${c ? `<div class="banner info">${ic('info', 18)}<div><b>Complete your registration</b><div>Signed in as <b>${esc(c.email)}</b>. Enter your institution details once; after that, signing in takes you straight to your dashboard.</div></div></div>`
    : `<div class="banner info">${ic('info', 18)}<div>Register with your institution details and you can start using the portal right away${Backend.remote ? ' (confirm your email first if we send you a link)' : ''}.</div></div>
  ${Backend.remote ? `<button class="btn btn-outline btn-block mt12" data-act="googleLogin">${GOOGLE_ICON} Register with Google</button><div class="or">OR</div>` : ''}`}
  <button type="button" class="btn btn-ghost btn-block btn-xs mt12" data-act="regSample">${ic('file', 14)} Fill sample institution details</button>
  <form data-form="register" novalidate class="mt16">
    <div class="fv-group"><div class="fv-group-h">Institution Details</div>
      ${fld('Institution Name', 'name', r.name, { req: true, ph: 'Full registered name of the institution' })}
      ${fld('Permanent Institute ID / Application ID', 'pid', r.pid, { ph: 'If already allotted, e.g. 1-12345678' })}
      <div class="grid2">${fld('State', 'state', r.state || 'Delhi', { req: true, opts: STATES })}${fld('District / City', 'district', r.district, { req: true })}</div>
      ${fld('Institution Type', 'type', r.type || INST_TYPES[0], { opts: INST_TYPES })}
    </div>
    <div class="fv-group"><div class="fv-group-h">Head of Institution &amp; Login</div>
      ${fld('Head of Institution', 'head', r.head, { req: true, ph: 'Name of Principal / Director' })}
      ${fld('Official Email', 'email', c ? c.email : r.email, { req: true, type: 'email', ro: !!c, ph: 'principal@institute.edu.in', icon: 'mail', attrs: 'autocomplete="email" autocapitalize="off"' })}
      ${fld('Mobile Number', 'mobile', r.mobile, { req: true, type: 'tel', ph: '10-digit mobile', icon: 'phone', attrs: 'autocomplete="tel"' })}
      ${c ? '' : `${fld('Create Password', 'password', '', { req: true, type: 'password', icon: 'key', attrs: 'autocomplete="new-password" data-live="pwStrength"', hint: '8+ characters with upper, lower, number and special character.' })}
      <div class="fv-strength" id="pwStrength" aria-live="polite"><div><i></i><i></i><i></i><i></i></div><span></span></div>
      ${fld('Confirm Password', 'confirm', '', { req: true, type: 'password', icon: 'key', attrs: 'autocomplete="new-password"' })}`}
    </div>
    <label class="check"><input type="checkbox" name="agree" ${r.agree ? 'checked' : ''}><span>I confirm that the information is correct, I am authorised by the institution's management to register, and I accept the <button type="button" class="link" data-act="legal" data-v="terms" style="font-size:inherit">Terms of Use</button> and <button type="button" class="link" data-act="legal" data-v="privacy" style="font-size:inherit">Privacy Policy</button>.</span></label>
    ${UI.err.agree ? `<div class="ferr">${esc(UI.err.agree)}</div>` : ''}
    <button class="btn btn-primary btn-block mt16" type="submit">${c ? 'Complete Registration' : 'Register'}</button>
  </form>
  ${c ? `<p class="center mt16 small">Not you? <button class="link" data-act="regCancel">Use another account</button></p>` : ''}`;
}

// A Google account with no registration details yet: ask for them once, keeping the session.
async function askRegistration() {
  const email = await Backend.sessionEmail();
  UI.completing = { email };
  UI.reg = { ...(UI.reg || {}), email };
  UI.loginTab = 'register'; UI.loginErr = null; UI.err = {}; UI.busy = false;
  UI.stack = [{ name: 'login', params: {} }];
  closeSheet();
  render(true);
}

const LEGAL = {
  privacy: ['Privacy Policy', `<div class="banner warn">${ic('info', 18)}<div class="xs">Draft for the prototype. Replace with the privacy policy approved by AICTE before production use.</div></div>
    <div class="legal-doc"><h4>What we collect</h4><p>Institution identifiers (name, Permanent Institute ID, address), contact details of the Head of Institution and nodal officer, application data, Security Deposit (FDR) details and the documents you upload, plus security logs (sign-in events and actions on records).</p>
    <h4>Why we collect it</h4><p>Only to process AICTE approval applications, verify security deposits under joint lien, issue notices and maintain the statutory audit trail.</p>
    <h4>Who can see it</h4><p>Your institution's authorised users, authorised AICTE scrutiny officials and administrators, and — for an FDR — the issuing bank's authorised officials. Each institution can access only its own records.</p>
    <h4>Documents and security</h4><p>Documents are stored in a private store and opened only through short-lived, authorised links. Every upload is fingerprinted (SHA-256) to detect re-used documents. Data is encrypted in transit (HTTPS).</p>
    <h4>On this device</h4><p>When connected to the AICTE server, application data is kept in memory only; the device stores your sign-in session and display preferences. Signing out removes the session.</p>
    <h4>Retention and your rights</h4><p>Records are retained as required by the AICTE Act, 1987 and the Approval Process Handbook. To correct personal details, use Profile → Contact Person Details or raise a ticket.</p></div>`],
  terms: ['Terms of Use', `<div class="banner warn">${ic('info', 18)}<div class="xs">Draft for the prototype. Replace with the terms approved by AICTE before production use.</div></div>
    <div class="legal-doc"><h4>Authorised use</h4><p>Only persons authorised by the institution's management may use an institution account. You are responsible for keeping your credentials confidential.</p>
    <h4>Accuracy of submissions</h4><p>Information and documents must be true and genuine. Submissions are e-signed; furnishing false information or re-using another institution's documents attracts action under the AICTE Approval Process Handbook.</p>
    <h4>Automated checks</h4><p>Deterministic rules and AI-assisted extraction help identify gaps. AI output is advisory; regulatory decisions are taken only by authorised AICTE officials.</p>
    <h4>Monitoring</h4><p>Actions are recorded in a tamper-evident audit log. Unauthorised access is an offence under Sections 43 &amp; 66 of the Information Technology Act, 2000.</p>
    <h4>Prototype notice</h4><p>This software is a functional prototype for evaluation and does not constitute official regulatory approval.</p></div>`],
};

V.dashboard = () => {
  const i = inst(), apps = myApps().filter(a => a.status !== 'DRAFT');
  const cnt = s => apps.filter(a => s.includes(a.status)).length;
  const alerts = myNotifs().filter(n => !n.isRead && (n.type === 'CRITICAL' || n.type === 'WARNING'));
  const fd = myFdrs(), live = fd.filter(f => fdrStatus(f) !== 'RELEASED');
  const corpus = live.reduce((s, f) => s + f.amountLakhs, 0);
  const primary = [...live].sort((a, b) => b.amountLakhs - a.amountLakhs)[0];
  const sc = s => live.filter(f => fdrStatus(f) === s).length;
  const tile = (lbl, n, icon, tone, filter) => `<button data-act="appsFilter" data-v="${filter}"><span class="tile-ico tone-${tone}">${ic(icon, 18)}</span><span><b data-count="${n}">${n}</b><small>${lbl}</small></span></button>`;
  const acts = myAudit().slice(0, 4);
  const notifs = myNotifs(), unread = notifs.filter(n => !n.isRead).length;
  const next = live.filter(f => daysUntil(f.maturityDate) > 0).sort((a, b) => a.maturityDate.localeCompare(b.maturityDate))[0];
  const facts = [
    `${crLabel(corpus)} secured under AICTE joint lien`,
    `${cnt(['SUBMITTED', 'UNDER_SCRUTINY'])} application(s) under review`,
    cnt(['DEFICIENCIES_NOTED']) ? `${cnt(['DEFICIENCIES_NOTED'])} clarification(s) required` : null,
    `${unread} unread alert(s)`,
    next ? `Next maturity: ${fmtDate(next.maturityDate)}` : null,
  ].filter(Boolean);
  const DOT = { CRITICAL: '#fb7185', WARNING: '#fbbf24', SUCCESS: '#34d399', INFO: '#38bdf8' };
  const tickerItems = [
    ...notifs.slice(0, 5).map(n => ({ text: `${n.title} — ${n.message}`, dot: DOT[n.type] || DOT.INFO, attrs: `data-act="openNotif" data-id="${esc(n.id)}"` })),
    ...myAudit().slice(0, 5).map(a => ({ text: `${a.action.replace(/_/g, ' ')} · ${a.actorName} · ${fmtDT(a.timestamp)}`, dot: '#a78bfa', attrs: 'data-go="activity"' })),
  ];
  return {
    header: 'brand', tab: 'dashboard',
    after: () => { countUp($('.content')); },
    body: `<section class="fv-inst">
        <div class="fv-inst-h">
          <span class="fv-kicker">Applicant Institution Profile</span>
          <b translate="no">${esc(i.name)}</b>
          <span><span translate="no">PID ${esc(i.pid)} · ${esc(i.region)} · </span><span>${Backend.remote ? 'Authoritative Database' : 'Authorized Evaluation Profile'}</span></span>
        </div>
        <div class="fv-stats">
          <div><b data-count="${corpus}" data-fmt="cr">${crLabel(corpus)}</b><span>FDR Corpus</span></div>
          <div><b data-count="${apps.length}">${apps.length}</b><span>Filings</span></div>
          <div><b data-count="${unread}">${unread}</b><span>Alerts</span></div>
        </div>
      </section>
      <div class="fv-status">
        ${tile('Total Applications', apps.length, 'files', 'blue', 'ALL')}
        ${tile('Under Scrutiny', cnt(['SUBMITTED', 'UNDER_SCRUTINY']), 'clock', 'amber', 'REVIEW')}
        ${tile('Clarification Required', cnt(['DEFICIENCIES_NOTED']), 'alert', 'red', 'CLARIFICATION')}
        ${tile('Approved / Cleared', cnt(['SCRUTINY_CLEARED', 'APPROVED']), 'checkCircle', 'green', 'APPROVED')}
      </div>
      <button class="card row as-entry" data-go="assistant"><span class="tile-ico tone-blue">${ic('spark', 20)}</span><span class="grow"><b class="small">AI Regulatory Assistant</b><small class="xs muted" style="display:block">New FDR, renewal, release or a deficiency reply: guided step by step, with document checks.</small></span>${ic('chev', 18)}</button>
      <h2 class="fv-h">Quick Actions</h2>
      <div class="fv-qa">
        <button data-go="apptype"><span class="fv-qa-i">${ic('filePlus', 22)}</span>New Application</button>
        <button data-tab="apps"><span class="fv-qa-i">${ic('files', 22)}</span>My Applications</button>
        <button data-tab="fdrs"><span class="fv-qa-i">${ic('rupee', 22)}</span>FDR Details</button>
        <button data-go="compliance"><span class="fv-qa-i">${ic('shieldCheck', 22)}</span>Compliance</button>
      </div>
      ${alerts.length ? `<div class="section-title" style="margin-top:18px"><span class="h2">Important Alerts</span><button class="link" data-tab="alerts">View All ${ic('chev', 14)}</button></div>
        ${alerts.slice(0, 2).map(a => `<button class="fv-alert" data-act="openNotif" data-id="${a.id}">${ic('alert', 20)}<span class="grow" translate="no"><b>${esc(a.title)}</b><small>${esc(a.message)}</small></span>${ic('chev', 18)}</button>`).join('')}` : ''}
      <div class="section-title"><span class="h2">Security Deposit (FDR)</span><button class="link" data-tab="fdrs">View All ${ic('chev', 14)}</button></div>
      <div class="card">
        <div class="row between"><div><div class="xs muted b" style="letter-spacing:.4px">CORPUS UNDER AICTE JOINT LIEN</div><div style="font-size:22px;font-weight:800;color:var(--navy)">${rupees(corpus * 1e5)}</div><div class="xs muted">${crLabel(corpus)} · ${live.length} deposit(s)</div></div><span class="tile-ico tone-green">${ic('shieldCheck', 20)}</span></div>
        <div class="row wrap mt8" style="gap:6px">${['ACTIVE', 'EXPIRING_SOON', 'MATURED', 'UNDER_VERIFICATION'].filter(s => sc(s)).map(s => `<span class="chip ${FSTATUS[s][1]} sm">${sc(s)} ${FSTATUS[s][0]}</span>`).join('')}</div>
        ${primary ? `<div class="mt12" style="border-top:1px dashed var(--line);padding-top:12px">${fdrMini(primary)}</div>` : ''}
      </div>
      <div class="section-title"><span class="h2">Recent Activity</span><button class="link" data-go="activity">View All ${ic('chev', 14)}</button></div>
      <div class="list">${acts.length ? acts.map(auditRow).join('') : '<div class="empty small">No recent activity records found.</div>'}</div>`,
  };
};
function fdrMini(f) {
  const st = fdrStatus(f), pr = lienProgress(f), d = daysUntil(f.maturityDate);
  return `<button class="row" style="width:100%;border:0;background:none;padding:0;text-align:left" data-go="fdrDetail" data-id="${f.id}">
    <div class="grow"><div class="row between"><b class="small">${esc(f.fdrNumber)}</b>${chip(FSTATUS[st], true)}</div>
    <div class="xs muted mt4">${esc(f.bankName)} · ${crLabel(f.amountLakhs)} · Matures ${fmtDate(f.maturityDate)}</div>
    <div class="bar mt8"><i style="width:${(pr * 100).toFixed(1)}%"></i></div>
    <div class="row between xs muted mt4"><span>Lock-in ${(pr * f.tenureYears).toFixed(1)} of ${f.tenureYears} yrs</span><span>${d > 0 ? `${d} days to maturity` : 'Matured'}</span></div></div></button>`;
}
// Three separate statuses: what the institution entered, the automated (advisory) checks, and the bank's own confirmation.
function verificationCard(f) {
  const checks = fdrChecks(f).slice(0, -1), passed = checks.filter(c => c.s === 'ok').length;
  const src = lienSource(f), bc = f.bankConfirmation || {};
  const bankNote = src === 'BANK_OFFICIAL' ? `${bc.by ? `${bc.by} · ` : ''}${bc.at ? fmtDT(bc.at) : ''}${f.lienEndorsementToken ? ` · Token ${f.lienEndorsementToken}` : ''}`
    : src === 'AICTE_RECORDED' ? `AICTE entered the bank's token${f.lienEndorsementToken ? ` ${f.lienEndorsementToken}` : ''}. A bank official has not confirmed it on the portal.`
    : src === 'DEMO_SIMULATED' ? 'Demo data: no bank was contacted.'
    : src === 'UNRECORDED' ? `Token ${f.lienEndorsementToken || '—'}. The record does not show who confirmed it.`
    : 'A bank official must confirm the joint lien in the bank portal. Form checks or AI review cannot replace this.';
  const row = (s, label, note) => `<div class="vrow">${sIcon(s)}<div class="grow"><div class="small b">${esc(label)}</div><div class="xs muted">${esc(note)}</div></div></div>`;
  return `<div class="card mt12"><div class="h3">Verification</div><div class="mt8">
    ${row('ok', 'Submitted by the institution', 'Deposit details and FDR advice entered by your institution. Not independent proof.')}
    ${row(checks.some(c => c.s === 'fail') ? 'fail' : checks.some(c => c.s === 'warn') ? 'warn' : 'ok', 'Automated checks (advisory)', `${passed} of ${checks.length} rule checks passed. Advisory only, not a bank confirmation.`)}
    ${row(LIEN_SOURCE[src][1], `Bank: ${LIEN_SOURCE[src][0]}`, bankNote)}</div></div>`;
}
// Lien release steps: the request, AICTE's decision with its release order, and the bank's discharge in its own system.
function releaseCard(f) {
  const rr = f.releaseRequest || {}, r = f.release || {}, rs = releaseState(f) || ['Release requested', 'amber'];
  const step = (done, label, note) => `<div class="vrow">${sIcon(done ? 'ok' : '')}<div class="grow"><div class="small b">${esc(label)}</div>${note ? `<div class="xs muted">${note}</div>` : ''}</div></div>`;
  const approvedAt = r.approvedAt || rr.approvedAt, approvedBy = r.approvedBy || rr.approvedBy;
  return `<div class="card mt12"><div class="row between"><div class="h3">Lien Release</div>${chip(rs, true)}</div><div class="mt8">
    ${step(true, 'Requested by the institution', `${rr.requestedAt ? `${fmtDT(rr.requestedAt)} · ` : ''}${rr.reason ? `“${esc(rr.reason)}”` : ''}`)}
    ${step(!!approvedAt, 'Approved by AICTE', approvedAt ? `${esc(approvedBy || '')} · ${fmtDate(approvedAt)}${r.orderNumber ? ` · Release order <span class="mono">${esc(r.orderNumber)}</span>` : ''}${r.note ? `<br>“${esc(r.note)}”` : ''}` : 'Awaiting the Regulation Bureau decision')}
    ${step(!!r.dischargedAt, `Lien discharged by ${f.bankName}`, r.dischargedAt ? `${fmtDT(r.dischargedAt)} · Reference <span class="mono">${esc(r.dischargeRef)}</span>` : 'After AICTE approval, the bank removes the lien in its own system')}</div>
    <div class="xs muted mt8">FDR Vault records the lien release. The bank pays out the deposit through its own process; no money moves through this portal.</div></div>`;
}
// One deposit in the FDR list: status, bank and amount, and the 10-year lock-in.
function fdrCard(f) {
  const st = fdrStatus(f), pr = lienProgress(f), d = daysUntil(f.maturityDate);
  const rs = releaseState(f);
  const tail = rs ? rs[0] : st === 'MATURED' ? 'Eligible for lien release'
    : st === 'EXPIRING_SOON' ? `${d} days to maturity` : LIEN_SOURCE[lienSource(f)][0];
  return `<button class="fv-card" data-go="fdrDetail" data-id="${f.id}">
    <span class="fv-card-top"><b translate="no">${esc(f.fdrNumber)}</b>${chip(FSTATUS[st], true)}</span>
    <span class="fv-sub"><span translate="no">${esc(f.bankName)} · ${crLabel(f.amountLakhs)} · </span><span>Matures ${fmtDate(f.maturityDate)}</span></span>
    <span class="fv-progress ${st === 'EXPIRING_SOON' ? 'due' : st === 'MATURED' || st === 'RELEASED' ? 'done' : ''}"><i style="width:${(pr * 100).toFixed(1)}%"></i></span>
    <span class="fv-meta"><span>Lock-in ${(pr * f.tenureYears).toFixed(1)} of ${f.tenureYears} yrs</span><span>${tail}</span></span></button>`;
}
function auditRow(a) {
  const tone = /LOGIN/.test(a.action) ? 'blue' : /ENDORSE|VERIF|SUBMITTED|CLEARED|ESIGN/.test(a.action) ? 'green' : /DEFIC|COLLISION|FLAG/.test(a.action) ? 'amber' : 'slate';
  return `<button class="li" data-act="auditInfo" data-id="${a.id}"><span class="tile-ico tone-${tone}" style="width:34px;height:34px">${ic('activity', 16)}</span>
    <div class="grow"><div class="li-t ellipsis" style="font-size:12.5px">${esc(a.action.replace(/_/g, ' '))}</div><div class="li-s" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden" translate="no">${esc(a.details)}</div>
    <div class="xs muted mt4" translate="no">${esc(a.actorName)} · ${fmtDT(a.timestamp)}</div></div></button>`;
}

V.apptype = () => ({
  title: 'New Application', sub: 'Select the type of application',
  body: APP_TYPES.map(t => `<button class="type-card ${t.hl ? 'hl' : ''}" data-act="startApp" data-type="${t.code}"><span class="tile-ico tone-${t.tone}" style="width:44px;height:44px">${ic(t.icon, 22)}</span>
      <div class="grow"><div class="t">${esc(t.name)}</div><div class="d">${esc(t.desc)}</div></div>${ic('chev', 18, 'chev')}</button>`).join('')
    + `<div class="banner info mt16">${ic('info', 18)}<div>All applications are evaluated by the deterministic APH v2026.1 rule engine and AI document forensics before Regional Scrutiny Committee review.</div></div>`,
});

const STEPS = ['Institution', 'Program', 'FDR', 'Documents'];
function stepper(cur) {
  return `<div class="stepper">${STEPS.map((s, k) => `<div class="st ${k + 1 < cur ? 'done' : k + 1 === cur ? 'cur' : ''}"><span class="n">${k + 1 < cur ? ic('check', 14) : k + 1}</span>${s}</div>`).join('')}</div>`;
}
V.wizard = () => {
  const w = UI.w;
  if (!w) return V.apptype();
  const t = typeOf(w.type);
  const body = [null, wizInst, wizProg, wizFdr, wizDocs][w.step](w);
  const left = w.step === 1 ? `<button class="btn btn-ghost" data-act="saveDraft">Save Draft</button>` : `<button class="btn btn-ghost" data-act="wizBack">Back</button>`;
  return {
    title: t.name, sub: `Step ${w.step} of 4 · ${STEPS[w.step - 1]}`,
    right: w.step > 1 ? `<button class="link" data-act="saveDraft" style="padding:0 8px">Save Draft</button>` : '',
    pre: stepper(w.step),
    body: `<form id="wiz" novalidate onsubmit="return false">${body}</form>`,
    footer: `${left}<button class="btn btn-primary" data-act="wizNext">${w.step === 4 ? 'Validate' : 'Next'} ${ic('chev', 18)}</button>`,
  };
};
function wizInst(w) {
  const x = w.inst;
  return `<div class="card"><div class="h3" style="margin-bottom:12px">Institution Details</div>
    ${fld('Institution Name', 'inst.name', x.name, { ro: true, hint: 'As per AICTE master registry. Use “Change in Institution Details” to request a name change.' })}
    <div class="grid2">${fld('Permanent Institute ID', 'inst.pid', x.pid, { ro: true })}${fld('AICTE Region', 'inst.region', x.region, { ro: true })}</div>
    ${fld('State', 'inst.state', x.state, { req: true, opts: STATES })}
    ${fld('District / City', 'inst.district', x.district, { req: true })}
    ${fld('Address', 'inst.address', x.address, { req: true, type: 'textarea', rows: 2 })}
    ${fld('Institution Type', 'inst.type', x.type, { opts: INST_TYPES })}
    ${fld('Academic Year', 'inst.academicYear', x.academicYear, { opts: ['2026-27', '2027-28'] })}
  </div>`;
}
function wizProg(w) {
  const p = w.prog;
  let spec = '';
  if (w.type === 'NEW_PROGRAMME') spec = `${fld('Programme Level', 'prog.level', p.level, { opts: [['UG', 'Under Graduate (B.E./B.Tech)'], ['PG', 'Post Graduate (M.E./M.Tech)'], ['DIPLOMA', 'Diploma'], ['PGDM', 'PG Diploma in Management'], ['MCA', 'MCA'], ['MBA', 'MBA']] })}
      ${fld('Programme / Course Name', 'prog.programme', p.programme, { req: true, ph: 'e.g. M.Tech Cyber-Physical Systems' })}
      ${fld('Discipline', 'prog.discipline', p.discipline, { opts: ['Engineering & Technology', 'Computer Applications', 'Management', 'Architecture & Planning', 'Pharmacy', 'Applied Arts & Crafts', 'Hotel Management & Catering'] })}
      <div class="grid2">${fld('Proposed Intake', 'prog.programmeIntake', p.programmeIntake, { req: true, type: 'number', ph: 'Seats' })}${fld('Shift', 'prog.shift', p.shift, { opts: ['1st Shift', '2nd Shift'] })}</div>`;
  else if (w.type === 'INTAKE_VARIATION') spec = `${fld('Programme / Course', 'prog.programme', p.programme, { req: true, ph: 'e.g. B.Tech Artificial Intelligence & Data Science' })}
      ${fld('Nature of Change', 'prog.change', p.change, { opts: ['Increase in intake', 'Reduction in intake', 'Addition of course', 'Closure of course', 'Change in course name'] })}
      ${fld('Seats Affected', 'prog.programmeIntake', p.programmeIntake, { type: 'number', ph: 'e.g. 120' })}`;
  else if (w.type === 'EOA') spec = fld('Change since last approval', 'prog.eoaChange', p.eoaChange, { opts: ['No change from previous year', 'Change declared in supporting documents'] });
  else if (w.type === 'INFRASTRUCTURE_UPDATE') spec = `${fld('Change Category', 'prog.changeCategory', p.changeCategory, { opts: ['Change of Address / Site', 'Change of Management / Trust', 'Change of Name', 'Built-up Area Update', 'Conversion (Co-ed / Women)'] })}
      ${fld('Details of Change', 'prog.changeDetails', p.changeDetails, { req: true, type: 'textarea', ph: 'Describe the change and reference supporting documents' })}`;
  else if (w.type === 'CLOSURE') spec = `${fld('Closure Type', 'prog.closureType', p.closureType, { opts: ['Progressive closure of programme', 'Complete closure of institution', 'Surrender of approval'] })}
      ${fld('Reason for Closure', 'prog.closureReason', p.closureReason, { req: true, type: 'textarea' })}
      <label class="check"><input type="checkbox" name="prog.liabilitiesCleared" ${p.liabilitiesCleared ? 'checked' : ''}> No student fee grievances, faculty arrears or regulatory penalties are outstanding; enrolled students will be allowed to complete their programme.</label>
      ${UI.err['prog.liabilitiesCleared'] ? `<div class="ferr">${esc(UI.err['prog.liabilitiesCleared'])}</div>` : ''}`;
  return `<div class="card"><div class="h3" style="margin-bottom:12px">${w.type === 'CLOSURE' ? 'Closure Details' : w.type === 'INFRASTRUCTURE_UPDATE' ? 'Requested Change' : 'Program Details'}</div>${spec}</div>
    <div class="card"><div class="h3" style="margin-bottom:12px">Intake, Faculty &amp; Infrastructure</div>
      <div class="grid2">${fld('Current Total Intake', 'prog.currentTotalIntake', p.currentTotalIntake, { req: true, type: 'number', attrs: 'data-live="norms"' })}${fld('Proposed Total Intake', 'prog.proposedTotalIntake', p.proposedTotalIntake, { req: true, type: 'number', attrs: 'data-live="norms"' })}</div>
      ${fld('Total Students on Rolls', 'prog.totalStudents', p.totalStudents, { req: true, type: 'number', attrs: 'data-live="norms"' })}
      <div class="grid3">${fld('Professors', 'prog.professors', p.professors, { req: true, type: 'number', attrs: 'data-live="norms"' })}${fld('Assoc. Profs', 'prog.associateProfessors', p.associateProfessors, { req: true, type: 'number', attrs: 'data-live="norms"' })}${fld('Asst. Profs', 'prog.assistantProfessors', p.assistantProfessors, { req: true, type: 'number', attrs: 'data-live="norms"' })}</div>
      ${fld('Built-up Carpet Area (sq.m)', 'prog.totalBuiltUpAreaSqM', p.totalBuiltUpAreaSqM, { req: true, type: 'number', attrs: 'data-live="norms"' })}
      <div id="norms">${normsBox(p)}</div></div>`;
}
function normsBox(p) {
  const n = norms(p);
  if (!n.st || !n.fac) return `<div class="banner info">${ic('info', 18)}<div>Enter students and faculty cadre to see live APH norm checks.</div></div>`;
  const row = (ok, l, v) => `<div class="row" style="padding:5px 0">${sIcon(ok)}<div class="grow small">${l}</div><b class="small">${v}</b></div>`;
  return `<div style="background:#f8fafc;border:1px solid var(--line);border-radius:12px;padding:10px 12px"><div class="xs b muted" style="margin-bottom:4px">LIVE NORM CHECK · APPENDIX 4 &amp; 7</div>
    ${row(n.sfrOk ? 'ok' : 'fail', 'Student-Faculty Ratio (≤ 1:20)', n.sfrStr)}
    ${row(n.profOk ? 'ok' : 'fail', `Professors (min ${n.reqP} of ${n.reqFac} faculty)`, n.P)}
    ${row(n.assocOk ? 'ok' : 'warn', `Assoc. Professors (min ${n.reqA})`, n.A)}
    ${row(n.profOk && n.assocOk ? 'ok' : 'warn', 'Cadre ratio (norm 1:2:6)', n.ratio)}
    ${n.area ? row(n.areaOk ? 'ok' : 'warn', `Built-up area (min ${n.reqArea.toLocaleString('en-IN')} sq.m)`, n.area.toLocaleString('en-IN')) : ''}</div>`;
}
function wizFdr(w) {
  const f = w.fdr, list = activeFdrs();
  const head = `<div class="seg" style="margin-bottom:14px"><button type="button" class="${f.mode === 'existing' ? 'on' : ''}" data-act="fdrMode" data-v="existing">FDR on Record</button><button type="button" class="${f.mode === 'new' ? 'on' : ''}" data-act="fdrMode" data-v="new">Enter New FDR</button></div>`;
  let body;
  if (f.mode === 'existing') {
    body = list.length ? list.map(x => `<label class="card row" style="cursor:pointer;margin-top:10px;${f.existingId === x.id ? 'border-color:var(--blue2);box-shadow:0 0 0 2px rgba(26,86,219,.15)' : ''}">
        <input type="radio" name="fdr.existingId" value="${x.id}" ${f.existingId === x.id ? 'checked' : ''} data-act="pickFdr" style="accent-color:var(--blue2);width:18px;height:18px">
        <div class="grow"><div class="row between"><b class="small">${esc(x.fdrNumber)}</b>${chip(FSTATUS[fdrStatus(x)], true)}</div><div class="xs muted mt4">${esc(x.bankName)} · ${fmtAmount(x.amountLakhs)}</div><div class="xs muted">Issued ${fmtDate(x.issueDate)} · Matures ${fmtDate(x.maturityDate)}</div></div></label>`).join('')
      : `<div class="empty">${ic('rupee', 36)}<div>No active FDR on record. Enter a new FDR.</div></div>`;
    body += UI.err['fdr.existingId'] ? `<div class="ferr">${esc(UI.err['fdr.existingId'])}</div>` : '';
  } else {
    body = `<div class="card"><div class="h3" style="margin-bottom:12px">FDR / Security Deposit Details</div>
      ${fld('FDR Number', 'fdr.fdrNumber', f.fdrNumber, { req: true, ph: 'e.g. SBI-FDR-99201-2024', attrs: 'data-live="fdr" autocapitalize="characters"' })}
      ${fld('Bank Name', 'fdr.bankName', f.bankName, { req: true, opts: BANKS.map(b => b[0]), attrs: 'data-live="fdr"' })}
      ${fld('Branch Name', 'fdr.branchName', f.branchName, { req: true, ph: 'e.g. Institutional Area Branch, New Delhi' })}
      ${fld('IFSC Code', 'fdr.ifscCode', f.ifscCode, { req: true, ph: 'e.g. SBIN0001234', attrs: 'data-live="fdr" autocapitalize="characters" maxlength="11"' })}
      ${fld('FDR Amount (₹)', 'fdr.amountRs', f.amountRs, { req: true, type: 'number', ph: `Minimum ${rupees(requiredLakhs() * 1e5)}`, attrs: 'data-live="fdr"', hint: f.amountRs ? `${rupees(f.amountRs)} = ${crLabel(f.amountRs / 1e5)}` : '' })}
      <div class="grid2">${fld('Issue Date', 'fdr.issueDate', f.issueDate, { req: true, type: 'date', attrs: 'data-live="fdrIssue"' })}${fld('Maturity Date', 'fdr.maturityDate', f.maturityDate, { req: true, type: 'date', attrs: 'data-live="fdr"' })}</div>
      ${fld('Joint Lien Holder', 'fdr.lien', `Regional Officer, ${w.inst.region} Regional Office, AICTE`, { ro: true })}</div>`;
  }
  return head + body + `<div id="fdrcheck" class="mt12">${fdrCheckBox(wizardFdr(w))}</div>`;
}
function fdrCheckBox(fdr) {
  if (!fdr || !fdr.fdrNumber) return '';
  const c = fdrChecks(fdr), bad = c.some(x => x.s === 'fail');
  return `${bad ? `<div class="banner err">${ic('xCircle', 18)}<div>FDR does not meet AICTE Chapter VI norms. It will be flagged as <b>CRITICAL</b> by RULE-FDR-CORPUS-07.</div></div>`
    : `<div class="banner ok">${ic('checkCircle', 18)}<div>FDR is valid and within the required amount as per AICTE norms.</div></div>`}
    <div class="card tight mt8">${c.map(x => `<div class="vrow">${sIcon(x.s)}<div class="grow"><div class="small b">${esc(x.label)}</div><div class="xs muted">${esc(x.note || '')}</div></div></div>`).join('')}</div>`;
}
function wizDocs(w) {
  const mand = DOC_TYPES.filter(d => d.req), done = mand.filter(d => w.docs[d.type]).length;
  return `<div class="row between" style="margin-bottom:10px"><div class="h2">Upload Supporting Documents</div><span class="chip ${done === mand.length ? 'green' : 'amber'} sm">${done}/${mand.length} mandatory</span></div>
    <div class="list">${DOC_TYPES.map(m => {
      const d = w.docs[m.type], up = UI.uploading[m.type];
      return `<div class="up ${d ? 'done' : ''}" ${up ? 'aria-busy="true"' : ''}><span class="fi">${up ? '<span class="spin" aria-hidden="true"></span>' : ic(d ? 'fileCheck' : 'file', 18)}</span>
        <div class="grow"><div class="nm">${esc(m.name)}${m.req ? ' <span style="color:var(--red)">*</span>' : ''}</div>
          ${d ? `<div class="meta ellipsis">${esc(d.fileName)} · ${d.fileSizeKb.toLocaleString('en-IN')} KB · ${d.pageCount} pg${d.sample ? ' · sample' : ''}</div><div class="meta mono" title="SHA-256">SHA-256 ${short(d.fileHash)}</div>
            ${m.expiry ? `<div class="row mt4" style="gap:6px"><span class="xs muted">Valid till</span><input type="date" class="input" style="min-height:32px;padding:4px 8px;font-size:12px;width:auto" value="${esc(d.validTill || '')}" data-live="validTill" data-doc="${m.type}"></div>` : ''}`
          : `<div class="meta">${up ? 'Uploading securely…' : 'PDF, JPG, PNG · Max 10 MB'}</div>`}</div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
          ${d ? `<button type="button" class="icon-btn" style="width:32px;height:32px;color:var(--red)" data-act="removeDoc" data-doc="${m.type}" aria-label="Remove">${ic('trash', 16)}</button>`
            : up ? '' : `<label class="btn btn-outline btn-xs file-btn">Upload<input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" data-doc="${m.type}" aria-label="Upload ${esc(m.name)}"></label>${Backend.remote ? '' : `<button type="button" class="link" style="font-size:11px" data-act="sampleDoc" data-doc="${m.type}">Use sample</button>`}`}
        </div></div>`;
    }).join('')}</div>
    <div class="banner info mt12">${ic('info', 18)}<div>Accepted formats: PDF, JPG, PNG · Maximum file size: 10 MB per file. A SHA-256 fingerprint is computed on your device for duplicate-document forensics${Backend.remote ? '; files are stored in your institution’s private, access-controlled folder' : ''}.</div></div>
    ${Backend.remote ? '' : `<button type="button" class="btn btn-ghost btn-block btn-sm mt12" data-act="sampleAll">${ic('layers', 16)} Attach sample set for remaining mandatory documents</button>`}`;
}

V.ai = () => {
  const w = UI.w;
  if (!w) return V.apptype();
  const run = UI.aiRun, res = w.ai;
  const docs = DOC_TYPES.filter(d => w.docs[d.type]);
  let body = `<div class="banner info">${ic('shieldCheck', 20)}<div><b>Automated Regulatory Compliance Verification</b><div>Mandatory filings are verified against AICTE Approval Process Handbook (APH 2026-27) norms, checklist completeness, and FDR corpus conditions prior to final submission.</div></div></div>`;
  if (!res) {
    const steps = [...docs.map(d => ({ name: d.name, sub: 'Document Integrity · Clause Verification' })), { name: 'Institutional Registry Verification', sub: `${DB.apps.reduce((n, a) => n + (a.documents || []).length, 0)} historical filings verified` }, { name: Backend.remote ? 'Server Rule Engine (Authoritative)' : 'Statutory Rule Engine', sub: '7 statutory rules · APH v2026.1' }];
    const k = run ? run.i : 0;
    body += `<div class="card tight mt12">${steps.map((s, j) => `<div class="vrow">${j < k ? sIcon('ok') : j === k ? '<span class="vstat run"></span>' : '<span class="vstat wait"></span>'}<div class="grow"><div class="small b">${esc(s.name)}</div><div class="xs muted">${j < k ? 'Verified' : esc(s.sub)}</div></div></div>`).join('')}</div>
      <div class="bar mt12"><i style="width:${(k / steps.length * 100).toFixed(0)}%"></i></div><p class="center xs muted mt8">${run && run.reading !== null && run.reading !== undefined ? `Verifying documents… ${run.reading} of ${docs.filter(d => w.docs[d.type].storagePath).length}` : `Verifying compliance item ${Math.min(k + 1, steps.length)} of ${steps.length}…`}<span class="fv-typing" aria-hidden="true"><i></i><i></i><i></i></span></p>`;
    return { title: 'Compliance Verification', body, after: () => { if (!UI.aiRun) startAI(); } };
  }
  const c = res.counts;
  if (res.serverError) body += `<div class="banner err mt12" role="alert">${ic('alert', 18)}<div class="grow"><b>Server validation unavailable</b><div>${esc(res.serverError)} Your application has not been submitted and nothing was lost. Results below are on-device only and cannot be used to submit.</div>
      <button class="btn btn-sm btn-primary mt8" data-act="retryServerValidation">${ic('refresh', 16)} Retry server validation</button></div></div>`;
  if (res.aiService === 'claude' || res.aiService === 'partial') body += `<div class="banner info mt12">${ic('shieldCheck', 18)}<div>Statutory documents processed under AICTE regulatory extraction engine. Official decision is recorded by the Regional Scrutiny Committee.</div></div>`;
  else if (res.aiService === 'unavailable') body += `<div class="banner warn mt12">${ic('info', 18)}<div>Automated extraction preview active; statutory rules are verified directly on the server.</div></div>`;
  if (!res.serverError && res.serverVerified) body += `<div class="banner ok mt12">${ic('shieldCheck', 18)}<div>Rule findings verified by the AICTE server (rule set ${esc(DB.ruleVersion || 'v2026.1')}), including duplicate checks across all institutions.</div></div>`;
  body += `<div class="card tight mt12">${res.docs.map(a => `<div class="vrow">${sIcon(a.status)}<div class="grow"><div class="small b">${esc(a.name)}</div><div class="xs" style="color:${a.status === 'ok' ? 'var(--green)' : a.status === 'warn' ? 'var(--amber)' : 'var(--red)'}">${esc(a.note)}</div></div></div>`).join('') || '<div class="empty small">No documents uploaded.</div>'}</div>
    <div class="section-title"><span class="h2">Cross-Check Results</span></div>
    <div class="card tight">${res.cross.map(x => `<div class="vrow">${sIcon(x.s)}<div class="grow"><div class="small b">${esc(x.label)}</div><div class="xs muted">${esc(x.note || '')}</div></div></div>`).join('')}</div>
    <div class="section-title"><span class="h2">Rule Engine Findings</span><span class="row" style="gap:4px"><span class="chip green sm">${c.passed} passed</span><span class="chip amber sm">${c.warns} warn</span><span class="chip red sm">${c.crit} critical</span></span></div>
    ${res.findings.map(findingCard).join('')}
    <div class="card mt12" style="background:#F8FAFC;border:1px solid #CBD5E1"><div class="row" style="gap:8px;color:var(--navy)">${ic('fileCheck', 18)}<b>Statutory Pre-Check Summary</b><span class="chip slate sm">Automated Review</span></div><p class="small mt8" style="color:var(--text2)" translate="no">${esc(res.summary)}</p></div>
    <div class="banner info mt12">${ic('info', 18)}<div>Preliminary automated compliance check. Final determination is rendered by the Regional Scrutiny Committee under APH v2026.1 provisions.</div></div>
    <button class="link mt12" data-act="rerunAI">${ic('refresh', 14)} Re-run verification</button>`;
  return { title: 'Compliance Verification', body, footer: `<button class="btn btn-ghost" data-act="back">Back</button><button class="btn btn-primary" data-go="review" ${res.serverError ? 'disabled' : ''}>Continue ${ic('chev', 18)}</button>` };
};
function startAI() {
  const w = UI.w, total = DOC_TYPES.filter(d => w.docs[d.type]).length + 2;
  UI.aiRun = { i: 0, total };
  const tick = () => {
    if (!UI.aiRun || currentRoute() !== 'ai' || !UI.w) { UI.aiRun = null; return; }
    UI.aiRun.i++;
    if (UI.aiRun.i >= total) {
      UI.w.ai = runValidation(UI.w);
      UI.aiRun.i = total - 1; UI.aiRun.reading = Backend.remote ? 0 : null; render();
      Backend.analyzeDocuments(UI.w, () => { if (UI.aiRun) { UI.aiRun.reading++; if (currentRoute() === 'ai') render(); } })
        .then(r => applyAiReading(UI.w, r), () => applyAiReading(UI.w, {}))
        .then(serverValidate)
        .finally(() => { UI.aiRun = null; if (currentRoute() === 'ai') render(true); });
      return;
    }
    render();
    setTimeout(tick, 420);
  };
  setTimeout(tick, 420);
}
// Merges Claude's per-document reading (server mode) into the validation results. Advisory only.
const SEV = { ok: 0, warn: 1, fail: 2 };
function applyAiReading(w, results) {
  if (!results) { w.ai.aiService = 'device'; return; }
  const got = Object.entries(results), okd = got.filter(([, r]) => r && !r.error);
  w.ai.aiService = !got.length ? 'device' : okd.length === got.length ? 'claude' : okd.length ? 'partial' : 'unavailable';
  if (!okd.length) { w.ai.aiError = got.length ? got[0][1].error : null; return; }
  let modelUsed = '';
  for (const a of w.ai.docs) {
    const r = results[a.type];
    if (!r || r.error) continue;
    modelUsed = r.analysis.modelUsed;
    const pages = a.fields.find(f => f.label === 'Pages Detected');
    a.fields = pages ? [...r.fields, pages] : r.fields;
    a.gemini = r.analysis;
    a.aiRead = true;
    const st = SEV[r.status] >= SEV[a.status] ? r.status : a.status;
    a.status = a.forensics.sha256Match ? 'fail' : st;
    a.note = r.status === 'ok' ? `Read by AI · ${r.fields.length} field(s) consistent with your form` : (r.analysis.detectedAnomalies[0] || 'Needs attention');
  }
  const named = w.ai.docs.filter(a => a.aiRead).map(a => ({ a, f: a.fields.find(f => f.label === 'Institution Name in Document') })).filter(x => x.f);
  const bad = named.find(x => !x.f.isCoherent);
  const i = inst(), rule = RULES.find(r => r.code === 'RULE-PID-03');
  w.ai.findings = w.ai.findings.filter(f => f.ruleCode !== 'RULE-PID-03');
  w.ai.findings.push(bad
    ? { id: uid('find'), ruleCode: rule.code, ruleName: rule.name, severity: 'CRITICAL', handbookClause: rule.handbookClause, isDeterministic: false, docType: bad.a.type, description: `AI reading of ${bad.a.name} names "${bad.f.value}", not ${i.name} (PID ${i.pid}).`, evidenceSnippet: bad.f.sourceLine || undefined }
    : { id: uid('find'), ruleCode: rule.code, ruleName: rule.name, severity: 'PASSED', handbookClause: rule.handbookClause, isDeterministic: false, description: named.length ? `AI read the institution name consistently in ${named.length} document(s).` : 'No institution name found to compare in the uploaded documents.' });
  w.ai.findings.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
  w.ai.aiModel = modelUsed;
  const mism = w.ai.docs.filter(a => a.aiRead && a.status !== 'ok').length;
  w.ai.summary = `AI read ${okd.length} of ${got.length} document(s)${mism ? ` and flagged ${mism} for attention` : ' with no conflicts against your form'}. ` + w.ai.summary;
}
async function serverValidate() {
  const w = UI.w;
  if (!w || !w.ai) return;
  try { mergeServerFindings(w, await Backend.validate(w)); w.ai.serverError = null; }
  catch (e) {
    const err = toApiError(e);
    if (err.code === 'VALIDATION' && err.fields) { UI.err = err.fields; w.ai.serverError = `${err.message} (${Object.values(err.fields).join('; ')})`; }
    else w.ai.serverError = err.message;
  }
}
function findingCard(f) {
  return `<div class="finding ${f.severity}"><div class="row between top"><div class="small b grow">${esc(f.ruleName)}</div>${sevChip(f.severity)}</div>
    <div class="xs muted mono" style="word-break:normal">${esc(f.ruleCode)} · ${esc(f.handbookClause)}</div>
    <p class="small mt4" style="color:var(--text2)" translate="no">${esc(f.description)}</p>${f.evidenceSnippet ? `<div class="evidence" translate="no">${esc(f.evidenceSnippet)}</div>` : ''}
    ${f.isDeterministic === false ? '<div class="xs muted mt4">Advisory — derived from on-device extraction; not a deterministic server rule.</div>' : ''}</div>`;
}

V.review = () => {
  const w = UI.w;
  if (!w || !w.ai) return V.apptype();
  const fdr = wizardFdr(w), t = typeOf(w.type), docs = DOC_TYPES.filter(d => w.docs[d.type]);
  const mand = DOC_TYPES.filter(d => d.req).length, c = w.ai.counts;
  const kv = (k, v) => `<div class="kv"><span>${esc(k)}</span><span>${esc(v)}</span></div>`;
  const p = w.prog;
  const progLine = w.type === 'NEW_PROGRAMME' ? `${p.programme} (${p.programmeIntake} seats)` : w.type === 'INTAKE_VARIATION' ? `${p.programme} — ${p.change}` : w.type === 'INFRASTRUCTURE_UPDATE' ? p.changeCategory : w.type === 'CLOSURE' ? p.closureType : p.eoaChange;
  return {
    title: 'Review Application',
    body: `<div class="card"><div class="h3" style="margin-bottom:6px">Application Summary</div>
        ${kv('Type', TYPE_LONG[w.type])}${kv('Institution', `${w.inst.name} (${w.inst.pid})`)}${kv('Academic Year', w.inst.academicYear)}${kv(w.type === 'CLOSURE' ? 'Closure' : 'Program / Change', progLine)}
        ${kv('Total Intake', `${p.currentTotalIntake} → ${p.proposedTotalIntake}`)}${kv('Faculty (P:A:Asst)', `${p.professors} : ${p.associateProfessors} : ${p.assistantProfessors}`)}
        ${kv('FDR Number', fdr.fdrNumber)}${kv('FDR Amount', fmtAmount(fdr.amountLakhs))}${kv('Bank', fdr.bankName)}${kv('Issue Date', fmtDate(fdr.issueDate))}${kv('Maturity Date', fmtDate(fdr.maturityDate))}</div>
      <div class="card"><div class="row between"><div class="h3">AI Pre-Validation</div><button class="link" data-act="back">Details ${ic('chev', 14)}</button></div>
        <div class="row mt8" style="gap:6px"><span class="chip green sm">${c.passed} passed</span><span class="chip amber sm">${c.warns} warning</span><span class="chip red sm">${c.crit} critical</span></div></div>
      <div class="card"><div class="row between"><div class="h3">Documents Uploaded (${docs.filter(d => d.req).length}/${mand})</div><button class="link" data-act="docList">View All ${ic('chev', 14)}</button></div>
        <div class="mt8">${docs.map(d => `<div class="row small" style="padding:4px 0">${sIcon(w.ai.docs.find(a => a.type === d.type)?.status || 'ok')}<span class="ellipsis">${esc(w.docs[d.type].fileName)}</span></div>`).join('') || '<div class="xs muted">No documents uploaded.</div>'}</div></div>
      <div class="card"><label class="check"><input type="checkbox" name="declared" ${w.declared ? 'checked' : ''}> I hereby declare that the information provided is correct and all documents are genuine. I understand that furnishing false information or re-used documents attracts action under the AICTE Approval Process Handbook.</label></div>
      <div class="card row" style="${w.esign ? 'background:var(--green-bg);border-color:var(--green-line)' : ''}">
        <span class="tile-ico ${w.esign ? 'solid-green' : 'tone-blue'}">${ic(w.esign ? 'check' : 'pen', 20)}</span>
        <div class="grow"><div class="small b" style="color:var(--blue)">e-Sign / Digital Consent</div><div class="xs muted">${w.esign ? `Signed via ${w.esign.method === 'DSC' ? 'DSC' : 'Aadhaar eSign'} · ${esc(w.esign.ref)} · ${fmtDT(w.esign.at)}` : 'Sign using Aadhaar OTP / DSC / eSign'}</div></div></div>`,
    footer: `<button class="btn btn-ghost" data-act="back">Back</button><button class="btn btn-primary" data-act="signSubmit" ${w.declared ? '' : 'disabled'}>${ic('pen', 18)} Sign &amp; Submit</button>`,
  };
};

V.submitted = ({ id }) => {
  const a = appById(id);
  if (!a) return V.dashboard();
  const colors = ['#0B2F5B', '#F5B82E', '#D6A62E', '#1E7A46', '#082449'];
  return {
    title: 'Submission Confirmation', noBack: true, tab: 'dashboard',
    body: `<div style="position:relative;text-align:center"><div class="confetti">${Array.from({ length: 22 }, (_, k) => `<i style="left:${(k * 4.6 + 2).toFixed(1)}%;background:${colors[k % 5]};animation-delay:${(k % 7) * 0.08}s"></i>`).join('')}</div>
      <div class="success-ring">${ic('check', 56)}</div>
      <h2 style="font-size:20px;font-weight:800;color:var(--navy)">Application Submitted Successfully!</h2>
      <p class="small muted mt4">Your application has been submitted to AICTE for review.</p></div>
      <div class="card mt16 center"><div class="xs muted b">Application Reference Number</div><div style="font-size:20px;font-weight:800;color:var(--blue);letter-spacing:.3px;margin-top:2px">${esc(a.applicationNumber)}</div>
        <div class="xs muted mt8">Submitted On</div><div class="small b">${fmtDT(a.submittedAt)}</div>
        ${a.esign ? `<div class="xs muted mt8">e-Sign Reference: <b>${esc(a.esign.ref)}</b></div>` : ''}</div>
      <div class="banner info mt12">${ic('info', 18)}<div><b>Next steps:</b> Regional Scrutiny Committee review (typically 2–3 working days). Track progress under My Applications; deficiencies, if any, will appear as alerts with a 7-working-day response window.</div></div>
      <div style="display:grid;gap:10px" class="mt16">
        <button class="btn btn-outline btn-block" data-act="ack" data-id="${a.id}">${ic('download', 18)} Download Acknowledgement</button>
        <button class="btn btn-primary btn-block" data-go="appDetail" data-id="${a.id}">View Application</button>
        <button class="btn btn-ghost btn-block" data-tab="dashboard">Back to Home</button></div>`,
  };
};

const APP_FILTERS = [['ALL', 'All', null], ['DRAFT', 'Draft', ['DRAFT']], ['SUBMITTED', 'Submitted', ['SUBMITTED']], ['REVIEW', 'Under Review', ['SUBMITTED', 'UNDER_SCRUTINY']], ['CLARIFICATION', 'Clarification', ['DEFICIENCIES_NOTED']], ['APPROVED', 'Approved', ['SCRUTINY_CLEARED', 'APPROVED']]];
V.apps = () => ({
  title: 'My Applications', tab: 'apps', refresh: true,
  right: `<button class="gold-btn" data-go="apptype" aria-label="New application">${ic('plus', 16)} New</button>`,
  body: `<div class="pills">${APP_FILTERS.map(([k, l]) => `<button class="${UI.appsFilter === k ? 'on' : ''}" data-act="appsPill" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="row mt12"><div class="search grow">${ic('search', 18)}<input class="input" placeholder="Search by Application ID" value="${esc(UI.appsQuery)}" data-live="appsSearch" aria-label="Search applications"></div></div>
    <div id="applist" class="mt12">${appList()}</div>`,
});
function appList() {
  const f = APP_FILTERS.find(x => x[0] === UI.appsFilter)[2], q = UI.appsQuery.trim().toLowerCase();
  const list = myApps().filter(a => (!f || f.includes(a.status)) && (!q || (a.applicationNumber || 'draft').toLowerCase().includes(q) || typeOf(a.type).name.toLowerCase().includes(q)));
  if (!list.length) return `<div class="empty">${ic('files', 40)}<div>No applications match this filter.</div></div>`;
  return list.map(a => {
    const t = typeOf(a.type), rec = a.scrutinyRecommendation;
    const open = a.status === 'DEFICIENCIES_NOTED' && rec && rec.status !== 'RESPONSE_SUBMITTED' && (rec.deficiencyPoints || []).length;
    const main = `<button class="fv-card" ${open ? 'style="border:0;padding:0"' : ''}${a.status === 'DRAFT' ? `data-act="resumeDraft" data-id="${a.id}"` : `data-go="appDetail" data-id="${a.id}"`}>
      <span class="fv-card-top"><b translate="no">${esc(a.applicationNumber || 'Draft — not submitted')}</b>${chip(STATUS[a.status], true)}</span>
      <span class="fv-sub">${esc(t.name)}</span>
      ${a.status === 'DRAFT' ? '' : `<span class="fv-steps" aria-hidden="true">${appSteps(a)}</span>`}
      <span class="fv-meta"><span>${a.status === 'DRAFT' ? `Saved ${fmtDate(a.lastUpdatedAt)} · Step ${a.draft.step} of 4` : `Submitted ${fmtDate(a.submittedAt)}`}</span>${open ? `<span>${rec.deficiencyPoints.length} point(s)</span>` : ''}</span></button>`;
    return open ? `<div class="fv-card alert">${main}<div class="fv-actions"><button class="btn btn-primary" data-go="respond" data-id="${a.id}">${ic('send', 16)} Submit Response</button><button class="btn btn-outline" data-go="notice" data-id="${a.id}">${ic('file', 16)} View Notice</button></div></div>` : main;
  }).join('');
}
// Five-stage progress (Submitted → AI pre-validation → Regional scrutiny → Recommendation → Bureau decision).
function appSteps(a) {
  const idx = { SUBMITTED: 2, UNDER_SCRUTINY: 2, DEFICIENCIES_NOTED: 3, SCRUTINY_CLEARED: 4, APPROVED: 5, REJECTED: 5 }[a.status] ?? 0;
  return [0, 1, 2, 3, 4].map(k => `<i class="${k < idx ? 'done' : k === idx && a.status === 'DEFICIENCIES_NOTED' ? 'warn' : ''}"></i>`).join('');
}

const TIMELINE = ['Submitted', 'AI Pre-Validation', 'Regional Scrutiny', 'Scrutiny Recommendation', 'Bureau Decision'];
function timeline(a) {
  const idx = { SUBMITTED: 2, UNDER_SCRUTINY: 2, DEFICIENCIES_NOTED: 3, SCRUTINY_CLEARED: 4, APPROVED: 5, REJECTED: 5 }[a.status] ?? 0;
  const subs = [fmtDT(a.submittedAt), a.findings.length ? `${a.findings.length} rule${a.findings.length > 1 ? 's' : ''} evaluated` : 'Pending', a.scrutinyRecommendation ? a.scrutinyRecommendation.reviewerName : 'Queued for Regional Office', a.status === 'DEFICIENCIES_NOTED' ? 'Clarification required' : a.status === 'SCRUTINY_CLEARED' ? 'Recommended for approval' : 'Pending', a.status === 'APPROVED' ? 'Approved' : 'AICTE Regulation Bureau'];
  return `<div class="timeline">${TIMELINE.map((s, k) => {
    const cls = k < idx ? 'done' : k === idx ? (a.status === 'DEFICIENCIES_NOTED' ? 'warn' : 'cur') : '';
    return `<div class="tl ${cls}"><span class="tdot">${k < idx ? ic('check', 12) : k === idx && a.status === 'DEFICIENCIES_NOTED' ? ic('alert', 11) : ''}</span><div><div class="tt">${s}</div><div class="ts">${esc(subs[k])}</div></div></div>`;
  }).join('')}</div>`;
}
V.appDetail = ({ id }) => {
  const a = appById(id);
  if (!a) return V.apps();
  const t = typeOf(a.type), rec = a.scrutinyRecommendation, pts = rec ? rec.deficiencyPoints : [];
  const actionNeeded = pts.length && !['SCRUTINY_CLEARED', 'APPROVED'].includes(a.status) && rec.status !== 'RESPONSE_SUBMITTED';
  const tab = UI.appTab;
  const kv = (k, v) => `<div class="kv"><span>${esc(k)}</span><span>${esc(v)}</span></div>`;
  let pane = '';
  if (tab === 'overview') {
    const d = a.intakeDetails, n = norms(d), fdr = DB.fdrs.find(f => f.fdrNumber === a.fdrNumber), p = a.programme || {};
    pane = `<div class="card">${kv('Application Type', TYPE_LONG[a.type])}${kv('Academic Year', a.academicYear)}${p.programme ? kv('Programme', p.programme) : ''}${p.changeCategory ? kv('Change', p.changeCategory) : ''}${p.changeDetails ? kv('Details', p.changeDetails) : ''}${p.closureType ? kv('Closure', p.closureType) : ''}
        ${kv('Submitted', fmtDT(a.submittedAt))}${kv('Last Updated', fmtDT(a.lastUpdatedAt))}${kv('Version', `v${a.currentVersion}`)}</div>
      <div class="section-title"><span class="h2">Institutional Profile</span></div>
      <div class="card">${kv('Total Intake', `${d.currentTotalIntake} → ${d.proposedTotalIntake}`)}${kv('Total Students', d.totalStudents.toLocaleString('en-IN'))}${kv('Faculty', `${n.fac} (P ${n.P} : A ${n.A} : Asst ${n.S})`)}
        ${kv('Calculated SFR', `${n.sfrStr} ${n.sfrOk ? '✓' : '✗ (norm ≤ 1:20)'}`)}${kv('Cadre Proportion', `${n.ratio} (norm 1:2:6)`)}${kv('Built-up Carpet Area', `${n.area.toLocaleString('en-IN')} sq.m (req. ${n.reqArea.toLocaleString('en-IN')})`)}
        ${kv('FDR Corpus', `${crLabel(d.fdrCorpusAmountLakhs)} (req. ${crLabel(d.requiredFdrAmountLakhs)})`)}</div>
      ${fdr ? `<div class="section-title"><span class="h2">Linked Security Deposit</span></div><div class="card">${fdrMini(fdr)}</div>` : ''}
      ${a.aiSummary ? `<div class="card mt12" style="background:#EFF6FF"><div class="row" style="gap:8px;color:#2563EB">${ic('sparkles', 18)}<b>AI Advisory Summary</b></div><p class="small mt8">${esc(a.aiSummary)}</p></div>` : ''}
      <button class="btn btn-outline btn-block mt16" data-act="ack" data-id="${a.id}">${ic('download', 18)} Download Acknowledgement</button>`;
  } else if (tab === 'findings') {
    const f = [...a.findings].sort((x, y) => sevOrder[x.severity] - sevOrder[y.severity]);
    pane = f.length ? `<div class="banner info" style="margin-bottom:12px">${ic('cpu', 18)}<div>Deterministic findings from the AICTE Rule Engine v2026.1. These are reproducible statutory checks — not AI opinions.</div></div>${f.map(findingCard).join('')}`
      : `<div class="empty">${ic('cpu', 40)}<div class="b">Evaluation queued</div><div class="small">The deterministic rule engine will evaluate this application when it is picked up by the Regional Office.</div></div>`;
    if (a.crossChecks) pane += `<div class="section-title"><span class="h2">Cross-Check Results</span></div><div class="card tight">${a.crossChecks.map(x => `<div class="vrow">${sIcon(x.s)}<div class="grow"><div class="small b">${esc(x.label)}</div><div class="xs muted">${esc(x.note || '')}</div></div></div>`).join('')}</div>`;
  } else if (tab === 'docs') {
    pane = a.documents.length ? a.documents.map(docAcc).join('') : `<div class="empty">${ic('file', 40)}<div>No document records attached to this application in the prototype dataset.</div></div>`;
  } else {
    pane = rec ? `<div class="card"><div class="row between"><div class="h3">Scrutiny Committee</div>${chip(REC_STATUS[rec.status] || [rec.status, 'slate'], true)}</div>
        <div class="row mt12"><span class="avatar" style="background:#4f46e5;border:0">${esc(initials(rec.reviewerName))}</span><div><div class="small b">${esc(rec.reviewerName)}</div><div class="xs muted">${esc(a.institutionSnapshot?.region || inst().region)} Regional Scrutiny Officer · ${fmtDT(rec.timestamp)}</div></div></div>
        <div class="mt12 small" style="color:var(--text2)"><b>Reviewer Rationale:</b> ${esc(rec.rationale)}</div>
        ${rec.officialNoticeNumber ? `<div class="mt8 xs">Notice Ref: <b class="mono">${esc(rec.officialNoticeNumber)}</b></div>` : ''}</div>
      ${pts.length ? `<div class="section-title"><span class="h2">Deficiency / Query Points</span></div><div class="card">${pts.map((x, k) => `<div class="row top" style="padding:6px 0"><span class="chip red sm">${k + 1}</span><div class="small grow">${esc(x)}</div></div>`).join('')}</div>` : ''}
      ${(a.responses || []).length ? `<div class="section-title"><span class="h2">Compliance Responses</span></div>${a.responses.map(r => `<div class="card"><div class="row between"><b class="small">Version ${r.version}</b><span class="xs muted">${fmtDT(r.at)}</span></div>${r.points.map(x => `<div class="mt8 small"><div class="xs muted">${esc(x.point)}</div><div>${esc(x.response)}</div></div>`).join('')}${r.files.length ? `<div class="xs muted mt8">${r.files.length} attachment(s): ${r.files.map(f => esc(f.fileName)).join(', ')}</div>` : ''}</div>`).join('')}` : ''}`
      : `<div class="empty">${ic('users', 40)}<div class="b">Awaiting allocation</div><div class="small">The application is queued for allocation to a Regional Scrutiny Officer.</div></div>`;
  }
  return {
    title: a.applicationNumber, sub: t.name, tab: 'apps', refresh: true,
    body: `<div class="card"><div class="row between"><div class="row"><span class="tile-ico tone-${t.tone}">${ic(t.icon, 20)}</span><div><div class="small b" style="color:var(--navy)">${esc(t.name)}</div><div class="xs muted">AY ${esc(a.academicYear)} · v${a.currentVersion}</div></div></div>${chip(STATUS[a.status])}</div>
        <div class="mt16">${timeline(a)}</div></div>
      ${actionNeeded ? `<div class="banner ${a.status === 'DEFICIENCIES_NOTED' ? 'err' : 'warn'} mt12">${ic('alert', 18)}<div class="grow"><b>${a.status === 'DEFICIENCIES_NOTED' ? 'Action Required — Deficiency Notice' : 'Reviewer Query'}</b><div>${pts.length} point(s) raised by ${esc(rec.reviewerName)}. Respond within 7 working days.</div>
        <div class="row wrap mt8" style="gap:8px"><button class="btn btn-sm btn-primary" data-go="respond" data-id="${a.id}">${ic('send', 16)} Submit Response</button><button class="btn btn-sm btn-outline" data-go="notice" data-id="${a.id}">${ic('file', 16)} View Notice</button></div></div></div>` : ''}
      ${rec && rec.status === 'RESPONSE_SUBMITTED' ? `<div class="banner info mt12">${ic('info', 18)}<div>Compliance response submitted (v${a.currentVersion}). Awaiting re-scrutiny by the Regional Office.</div></div>` : ''}
      <div class="seg mt12" style="font-size:12px"><button class="${tab === 'overview' ? 'on' : ''}" data-act="appTab" data-v="overview">Overview</button><button class="${tab === 'findings' ? 'on' : ''}" data-act="appTab" data-v="findings">Findings</button><button class="${tab === 'docs' ? 'on' : ''}" data-act="appTab" data-v="docs">Docs (${a.documents.length})</button><button class="${tab === 'scrutiny' ? 'on' : ''}" data-act="appTab" data-v="scrutiny">Scrutiny</button></div>
      <div class="mt12" id="apppane">${pane}</div>`,
  };
};
function docAcc(d) {
  const m = docMeta(d.docType), g = d.geminiAnalysis, fz = d.forensics || {};
  return `<details class="acc"><summary><div class="row grow" style="min-width:0">${sIcon(d.status === 'PROCESSED' ? 'ok' : 'warn')}<div class="grow" style="min-width:0"><div class="small b">${esc(m.name)}</div><div class="xs muted ellipsis">${esc(d.fileName)}</div></div></div>${chip(d.status === 'PROCESSED' ? ['Processed', 'green'] : ['Flagged', 'amber'], true)}</summary>
    <div class="acc-b">
      <div class="kv"><span>Size / Pages</span><span>${d.fileSizeKb.toLocaleString('en-IN')} KB · ${d.pageCount} pages</span></div>
      <div class="kv"><span>Uploaded</span><span>${fmtDT(d.uploadedAt)} · v${d.version}</span></div>
      <div class="mt8 xs muted b">SHA-256 FINGERPRINT</div><div class="mono">${esc(d.fileHash)}</div>
      ${d.storagePath || (!Backend.remote && LocalFiles[d.fileHash]) ? `<button class="btn btn-outline btn-sm btn-block mt8" data-act="viewDoc" data-path="${esc(d.storagePath || '')}" data-hash="${esc(d.fileHash)}">${ic('eye', 16)} View document (secure link)</button>` : ''}
      <div class="mt12 xs muted b">EXTRACTED FIELDS WITH SOURCE-LINE EVIDENCE</div>
      ${(d.extractedFields || []).map(f => `<div style="padding:7px 0;border-bottom:1px dashed var(--line)"><div class="row between"><span class="xs muted">${esc(f.label)}${f.page ? ` · p.${f.page}` : ''}</span>${f.isCoherent ? `<span style="color:var(--green)">${ic('check', 14)}</span>` : `<span style="color:var(--red)">${ic('alert', 14)}</span>`}</div><div class="small b">${esc(f.value)}</div><div class="xs mono muted" style="word-break:normal">“${esc(f.sourceLine)}”</div></div>`).join('')}
      <div class="mt12 xs muted b">DOCUMENT FORENSICS</div>
      <div class="kv"><span>Hash collision</span><span style="color:${fz.sha256Match ? 'var(--red)' : 'var(--green)'}">${fz.sha256Match ? `Match: ${esc(fz.duplicateApplicationId)}` : 'None'}</span></div>
      <div class="kv"><span>2D QR payload</span><span>${fz.qrCodeValid ? 'Decoded ✓' : 'Not detected'}</span></div>
      ${fz.qrPayload ? `<div class="row top mt8" style="background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:10px">${qrGlyph(d.fileHash)}<div class="xs grow"><div><b>Authority:</b> ${esc(fz.qrPayload.issuingAuthority)}</div><div><b>Signatory:</b> ${esc(fz.qrPayload.signerName)}</div><div><b>Certificate Ref:</b> ${esc(fz.qrPayload.certId)}</div><div><b>Validity:</b> ${esc(fz.qrPayload.issueDate)} → ${esc(fz.qrPayload.validTill)}</div></div></div>` : ''}
      <div class="kv"><span>Date chronology</span><span>${fz.dateChronologyValid ? 'Valid' : 'Inconsistent'}</span></div>
      ${fz.chronologyDetails ? `<div class="xs muted">${esc(fz.chronologyDetails)}</div>` : ''}
      ${(fz.remarks || []).map(r => `<div class="xs mt4">• ${esc(r)}</div>`).join('')}
      ${g ? `<div class="mt12" style="background:var(--purple-bg);border:1px solid var(--purple-line);border-radius:10px;padding:10px"><div class="row between"><span class="xs b" style="color:var(--purple)">${ic('sparkles', 14)} AI ANALYSIS · ${esc(g.modelUsed)}</span><span class="chip purple sm">Probabilistic</span></div>
        <p class="small mt4">${esc(g.summary)}</p>${Object.entries(g.verifiedAttributes || {}).map(([k, v]) => `<div class="kv"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}
        ${(g.detectedAnomalies || []).map(x => `<div class="xs mt4" style="color:var(--red)">⚠ ${esc(x)}</div>`).join('')}<div class="xs muted mt8"><i>${esc(g.disclaimer)}</i></div></div>` : ''}
      ${d.sourceTextPreview ? `<div class="evidence">${esc(d.sourceTextPreview)}</div>` : ''}
    </div></details>`;
}
function qrGlyph(seed) {
  let s = parseInt(seed.slice(0, 8), 16) || 7;
  const cells = Array.from({ length: 49 }, (_, k) => { s = (s * 1103515245 + 12345) >>> 0; const r = Math.floor(k / 7), c = k % 7; const finder = (r < 2 && c < 2) || (r < 2 && c > 4) || (r > 4 && c < 2); return finder || (s >> 16) & 1 ? '<i></i>' : '<i class="o"></i>'; });
  return `<div class="qr-box" aria-hidden="true">${cells.join('')}</div>`;
}

V.notice = ({ id }) => {
  const a = appById(id);
  if (!a) return V.apps();
  const i = inst(), rec = a.scrutinyRecommendation || {}, pts = rec.deficiencyPoints || [];
  const ref = rec.officialNoticeNumber || `AICTE/SCRUTINY/2026/${a.applicationNumber.split('-').pop()}`;
  const rows = pts.length ? pts.map((p, k) => `<tr><td>${k + 1}. ${esc(p)}</td><td>Clause 2.4 / Appendix 7</td></tr>`).join('')
    : a.findings.filter(f => f.severity !== 'PASSED').map((f, k) => `<tr><td>${k + 1}. <b>${esc(f.ruleName)} (${esc(f.ruleCode)})</b><br>${esc(f.description)}</td><td>${esc(f.handbookClause)}</td></tr>`).join('');
  return {
    title: 'Deficiency Notice', sub: ref,
    right: `<button class="icon-btn no-print" data-act="print" aria-label="Print / Save PDF">${ic('print', 20)}</button>`,
    body: `<div class="letter"><div class="lh"><img src="emblem.png" alt=""><div class="hi">अखिल भारतीय तकनीकी शिक्षा परिषद</div><div class="en">All India Council for Technical Education</div><small>(A Statutory Body under Ministry of Education, Govt. of India)</small><small>Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070 • www.aicte-india.org</small></div>
      <p><b>Notice Reference:</b> ${esc(ref)}<br><b>Application Number:</b> ${esc(a.applicationNumber)} (AY ${esc(a.academicYear)})<br><b>Permanent Institute ID (PID):</b> ${esc(i.pid)}<br><b>Date of Issue:</b> ${fmtDate(rec.timestamp || now())}<br><b>Regional Jurisdiction:</b> ${esc(i.region)} Regional Office</p>
      <p>To,<br>The Principal / Director,<br>${esc(i.name)}<br>${esc(i.city)}, ${esc(i.state)}</p>
      <p><b>Subject: Scrutiny Committee Deficiencies Notice for Application No. ${esc(a.applicationNumber)} (${esc(a.type)}) for Academic Session ${esc(a.academicYear)} - Regarding.</b></p>
      <p>Sir / Madam,</p><p>This is with reference to your online application submitted to the All India Council for Technical Education (AICTE) for grant of ${esc(TYPE_LONG[a.type])} for the Academic Session ${esc(a.academicYear)}.</p>
      <p>The documents and institutional disclosures submitted by your institution were placed before the Regional Scrutiny Committee for rigorous automated forensic validation and regulatory compliance under the provisions of the AICTE Approval Process Handbook (APH 2026-27).</p>
      <p>On examination of the application data, extracted document evidence, and physical norms, the Scrutiny Committee has recorded the following statutory deficiencies:</p>
      <table><thead><tr><th>S.No. &amp; Deficiency Detail</th><th>Relevant APH 2026 Clause</th></tr></thead><tbody>${rows || '<tr><td colspan="2">No deficiencies recorded.</td></tr>'}</tbody></table>
      <p><b>Action Required:</b></p><ol><li>Upload corrected and duly attested documentary proof / compliance affidavit through the AI-IRVP portal within <b>7 working days</b> from the date of this communication.</li><li>In case of deficiency in faculty recruitment or cadre ratio, provide advertisement copies and selection committee minutes approved by the Affiliating University.</li><li>Failure to rectify the aforementioned deficiencies within the stipulated period shall lead to non-recommendation for Extension of Approval / Intake Sanction for AY ${esc(a.academicYear)}.</li></ol>
      <div class="row between top mt16" style="font-size:11px"><div><b>System Generated Document</b><br>AI-IRVP Regulatory Engine v2026.1<br>Hash: ${esc(a.applicationNumber)}-SEC-AUTH</div><div style="text-align:right"><i style="font-size:14px">${esc(rec.reviewerName || 'Regional Scrutiny Officer')}</i><br>Regional Scrutiny Officer<br>${esc(i.region)} Regional Office<br>All India Council for Technical Education</div></div></div>
      <div class="no-print" style="display:grid;gap:10px;margin-top:16px"><button class="btn btn-outline btn-block" data-act="print">${ic('print', 18)} Print / Save PDF</button>${pts.length && a.scrutinyRecommendation.status !== 'RESPONSE_SUBMITTED' ? `<button class="btn btn-primary btn-block" data-go="respond" data-id="${a.id}">${ic('send', 18)} Submit Compliance Response</button>` : ''}</div>`,
  };
};

V.respond = ({ id }) => {
  const a = appById(id);
  if (!a) return V.apps();
  const pts = a.scrutinyRecommendation.deficiencyPoints, files = UI.attach.respond || [], v = UI.vals || {};
  return {
    title: 'Compliance Response', sub: a.applicationNumber,
    body: `<div class="banner warn">${ic('clock', 18)}<div>Respond to each point and attach duly attested proof. Your response creates version v${a.currentVersion + 1} of this application.</div></div>
      <form id="respForm" novalidate onsubmit="return false" class="mt12">
      ${pts.map((p, k) => `<div class="card"><div class="row top"><span class="chip red sm">${k + 1}</span><div class="small b grow">${esc(p)}</div></div><div class="mt8">${fld('Your response', `r${k}`, v[`r${k}`] || '', { req: true, type: 'textarea', ph: 'Explain the corrective action taken, with document references' })}</div></div>`).join('')}
      <div class="card"><div class="row between"><div class="h3">Supporting Documents</div><label class="btn btn-outline btn-xs file-btn">${ic('upload', 14)} Attach<input type="file" accept=".pdf,.jpg,.jpeg,.png" data-attach="respond" multiple></label></div>
        <div class="mt8">${files.length ? files.map((f, k) => `<div class="row" style="padding:6px 0">${sIcon('ok')}<div class="grow"><div class="small ellipsis">${esc(f.fileName)}</div><div class="xs muted mono">${short(f.fileHash)} · ${f.fileSizeKb} KB</div></div><button type="button" class="icon-btn" style="width:30px;height:30px" data-act="rmAttach" data-key="respond" data-k="${k}" aria-label="Remove">${ic('x', 14)}</button></div>`).join('') : '<div class="xs muted">e.g. DFS renewal receipt, undertaking, selection committee minutes. PDF/JPG/PNG up to 10 MB.</div>'}</div></div>
      <div class="card"><label class="check"><input type="checkbox" name="certify" ${v.certify ? 'checked' : ''}> I certify that the response and attachments are true and duly attested by the Head of Institution.</label>${UI.err.certify ? `<div class="ferr">${esc(UI.err.certify)}</div>` : ''}</div></form>`,
    footer: `<button class="btn btn-ghost" data-act="back">Cancel</button><button class="btn btn-primary" data-act="submitResponse" data-id="${a.id}">${ic('send', 18)} Submit</button>`,
  };
};

V.fdrs = () => {
  const fd = myFdrs().sort((a, b) => ['EXPIRING_SOON', 'MATURED', 'UNDER_VERIFICATION', 'ACTIVE', 'RELEASED'].indexOf(fdrStatus(a)) - ['EXPIRING_SOON', 'MATURED', 'UNDER_VERIFICATION', 'ACTIVE', 'RELEASED'].indexOf(fdrStatus(b)));
  const live = fd.filter(f => fdrStatus(f) !== 'RELEASED'), corpus = live.reduce((s, f) => s + f.amountLakhs, 0);
  const due = fd.filter(f => fdrStatus(f) === 'EXPIRING_SOON' && !f.pendingRequest).length, mat = fd.filter(f => fdrStatus(f) === 'MATURED' && !(f.releaseRequest && f.releaseRequest.status === 'PENDING')).length;
  return {
    title: 'FDR / Security Deposit', tab: 'fdrs', hdrCls: 'fv-flat', refresh: true,
    right: `<button class="icon-btn" data-go="fdrNew" aria-label="Submit new FDR">${ic('plus', 22)}</button>`,
    pre: `<div class="fv-corpus"><span class="fv-kicker">Total corpus under irrevocable joint lien</span>
        <b>${rupees(corpus * 1e5)}</b><span>${crLabel(corpus)} · ${live.length} active deposit(s) · APH Chapter VI Norms</span></div>`,
    body: `<div class="fv-row2">
        <button class="btn btn-primary" data-go="fdrNew">${ic('plus', 16)} Submit New FDR</button>
        <button class="btn btn-outline" data-act="fdrRequestMenu">${ic('swap', 16)} Renew / Replace / Release</button></div>
      ${due || mat ? `<div class="banner warn mt12">${ic('clock', 18)}<div>${due ? `<b>${due} FDR(s) due for renewal.</b> ` : ''}${mat ? `<b>${mat} matured FDR(s)</b> eligible for lien release. ` : ''}Institutions must submit statutory renewal receipts 60 days prior to certificate maturity.</div></div>` : ''}
      <div class="section-title"><span class="h2">My Deposits</span><span class="xs muted">${fd.length} record(s)</span></div>
      ${fd.map(fdrCard).join('') || `<div class="empty">${ic('rupee', 40)}<div>No FDR records.</div></div>`}`,
  };
};

V.fdrDetail = ({ id }) => {
  const f = fdrById(id);
  if (!f) return V.fdrs();
  const st = fdrStatus(f), d = daysUntil(f.maturityDate), rr = f.releaseRequest;
  const kv = (k, v) => `<div class="kv"><span>${esc(k)}</span><span>${v}</span></div>`;
  const hist = myAudit().filter(a => a.targetId === f.fdrNumber || (a.details || '').includes(f.fdrNumber));
  const pend = f.pendingRequest;
  let actions = '';
  if (pend) actions += '';
  else if (st === 'EXPIRING_SOON') actions += `<button class="btn btn-primary btn-block" data-go="fdrRenew" data-id="${f.id}">${ic('refresh', 18)} Process Renewal / Replacement</button>`;
  else if (st === 'MATURED' && !rr) actions += `<button class="btn btn-primary btn-block" data-go="fdrRelease" data-id="${f.id}">${ic('award', 18)} Initiate Release Request</button><button class="btn btn-outline btn-block" data-go="fdrRenew" data-id="${f.id}">${ic('refresh', 18)} Renew for another 10 years</button>`;
  else if (st === 'ACTIVE') actions += `<button class="btn btn-outline btn-block" data-go="fdrRenew" data-id="${f.id}" data-mode="replacement">${ic('swap', 18)} Request Bank Change / Replacement</button>`;
  actions += `<button class="btn btn-ghost btn-block" data-act="fdrAdvice" data-id="${f.id}">${ic('download', 18)} Download FDR Advice</button>`;
  return {
    title: f.fdrNumber, sub: 'Fixed Deposit Advice & Lien Certificate', tab: 'fdrs', refresh: true,
    body: `<div class="card"><div class="row between top"><div><div class="xs muted b">FDR CERTIFICATE NUMBER</div><div class="h2 mono" style="font-size:15px">${esc(f.fdrNumber)}</div></div>${chip(FSTATUS[st])}</div>
        <div class="mt12">${kv('Institution', esc(inst().name))}${kv('Permanent Institute ID', esc(inst().pid))}${kv('Principal Deposit Amount', esc(fmtAmount(f.amountLakhs)))}${kv('Deposit Horizon & Maturity', `${esc(f.issueDate)} to ${esc(f.maturityDate)} (${f.tenureYears} Years)`)}
        ${kv('Issuing Bank & Branch', `${esc(f.bankName)} • ${esc(f.branchName)} (IFSC: ${esc(f.ifscCode)})`)}${kv('Linked Application', esc(f.applicationNumber))}</div>
        <div class="mt12" style="background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:10px"><div class="xs b muted">IRREVOCABLE JOINT LIEN COVENANT</div><div class="small mt4">Jointly pledged in favour of: <b>${esc(f.jointLienHolder)}</b>. Non-encashable without council release decree.</div></div></div>
      ${verificationCard(f)}
      <div class="card mt12"><div class="h3">10-Year Lock-in</div><div class="bar mt8"><i style="width:${(lienProgress(f) * 100).toFixed(1)}%"></i></div>
        <div class="row between xs muted mt4"><span>${fmtDate(f.issueDate)}</span><span>${d > 0 ? `${d} days to maturity` : `Matured ${-d} days ago`}</span><span>${fmtDate(f.maturityDate)}</span></div>
        ${f.renewalStatus && f.renewalStatus !== 'NOT_APPLICABLE' ? `<div class="kv mt8"><span>Renewal Status</span><span>${esc(f.renewalStatus.replace(/_/g, ' '))}</span></div>` : ''}</div>
      ${pend ? `<div class="banner info mt12" role="status">${ic('clock', 18)}<div><b>${pend.kind === 'REPLACEMENT' ? 'Replacement' : 'Renewal'} request pending</b><div>Submitted ${fmtDT(pend.requestedAt)}${pend.payload && pend.payload.maturityDate ? ` · proposed maturity ${esc(pend.payload.maturityDate)}` : ''}. Awaiting bank CBS endorsement and AICTE approval — the deposit details change only after approval.</div></div></div>` : ''}
      ${rr || f.release ? releaseCard(f) : ''}
      <div style="display:grid;gap:10px" class="mt16">${actions}</div>
      ${f.demo ? `<p class="xs muted center mt12">Supplementary demo record for exercising renewal / release flows.</p>` : ''}
      ${hist.length ? `<div class="section-title"><span class="h2">History</span></div><div class="list">${hist.map(auditRow).join('')}</div>` : ''}`,
  };
};

V.fdrRenew = ({ id, mode }) => {
  const f = fdrById(id);
  if (!f) return V.fdrs();
  if (UI.renewFor !== id) { UI.renewFor = id; UI.fdrMode = mode || 'extension'; UI.renew = null; }
  const m = UI.fdrMode, r = UI.renew || {};
  return {
    title: 'Process FDR Extension / Replacement',
    body: `<div class="card" style="background:#f8fafc"><div class="small b">${esc(inst().name)}</div><div class="xs muted">Current FDR: ${esc(f.fdrNumber)} (Matures: ${esc(f.maturityDate)})</div><div class="small b mt4" style="color:var(--blue)">${esc(fmtAmount(f.amountLakhs))}</div></div>
      <div class="seg mt12"><button class="${m === 'extension' ? 'on' : ''}" data-act="renewMode" data-v="extension" data-id="${f.id}">Extension (same bank)</button><button class="${m === 'replacement' ? 'on' : ''}" data-act="renewMode" data-v="replacement" data-id="${f.id}">Replacement / Bank Change</button></div>
      <form id="renewForm" novalidate onsubmit="return false" class="mt12"><div class="card">
        ${m === 'replacement' ? `${fld('New FDR Number', 'fdrNumber', r.fdrNumber, { req: true, ph: 'e.g. HDFC-FDR-12345-2026' })}${fld('Bank Name', 'bankName', r.bankName || f.bankName, { opts: BANKS.map(b => b[0]) })}${fld('Branch Name', 'branchName', r.branchName, { req: true })}${fld('IFSC Code', 'ifscCode', r.ifscCode, { req: true, attrs: 'maxlength="11" autocapitalize="characters"' })}${fld('Amount (₹)', 'amountRs', r.amountRs || f.amountLakhs * 1e5, { req: true, type: 'number' })}` : ''}
        ${fld('New Extended Maturity Date (10-Yr Term)', 'maturityDate', r.maturityDate || addYears(f.maturityDate, 10), { req: true, type: 'date' })}
        ${fld('Bank Core Banking Renewal Token / Transaction Ref', 'token', r.token, { ph: 'e.g. CBS-RENEW-SBI-2026-9901', hint: 'Leave blank to have the CBS adapter issue one on bank endorsement.' })}
        <div class="banner info">${ic('shield', 18)}<div><b>Mandatory Covenant:</b> The renewed deposit shall automatically inherit the irrevocable joint lien in favour of the ${esc(f.jointLienHolder)}.${m === 'replacement' ? ' A replacement FDR requires fresh CBS lien endorsement by the new bank before the existing lien is discharged.' : ''}</div></div>
      </div></form>`,
    footer: `<button class="btn btn-ghost" data-act="back">Cancel</button><button class="btn btn-primary" data-act="submitRenewal" data-id="${f.id}">Submit Statutory Renewal</button>`,
  };
};

V.fdrRelease = ({ id }) => {
  const f = fdrById(id);
  if (!f) return V.fdrs();
  return {
    title: 'Request Lien Discharge',
    body: `<div class="banner info">${ic('info', 18)}<div>Statutory discharge of the AICTE joint lien following completion of the 10-year lock-in period (APH Clause 6.4). Requires AICTE Regulation Bureau approval.</div></div>
      <div class="card mt12" style="background:#f8fafc"><div class="small b">${esc(inst().name)}</div><div class="xs muted">FDR: ${esc(f.fdrNumber)} (Matured: ${esc(f.maturityDate)})</div><div class="small b mt4" style="color:var(--blue)">${esc(fmtAmount(f.amountLakhs))}</div></div>
      <form id="releaseForm" novalidate onsubmit="return false"><div class="card mt12">
        ${fld('Statutory Grounds for Release (APH Clause 6.4)', 'reason', (UI.vals || {}).reason ?? 'Completion of mandatory 10-year lock-in period with zero student liabilities.', { req: true, type: 'textarea' })}
        <label class="check"><input type="checkbox" name="certify" ${(UI.vals || {}).certify ? 'checked' : ''}> <span><b>Certification:</b> The institution affirms that no student fee grievances, faculty arrears, or regulatory penalties are outstanding.</span></label>
        ${UI.err.certify ? `<div class="ferr">${esc(UI.err.certify)}</div>` : ''}</div></form>`,
    footer: `<button class="btn btn-ghost" data-act="back">Cancel</button><button class="btn btn-primary" data-act="submitRelease" data-id="${f.id}">Submit Discharge Application</button>`,
  };
};

V.fdrNew = () => {
  const r = UI.newFdr || {}, files = UI.attach.fdrNew || [], reg = inst().region;
  const apps = myApps().filter(a => a.status !== 'DRAFT');
  return {
    title: 'Submit New FDR',
    body: `<div class="banner info">${ic('info', 18)}<div>Upload the Fixed Deposit Receipt (FDR) evidence. The deposit must be for 10 years under irrevocable joint lien with the Regional Officer, AICTE. Minimum corpus: <b>${crLabel(requiredLakhs())}</b>.</div></div>
      <form id="fdrNewForm" novalidate onsubmit="return false"><div class="card mt12">
        ${fld('FDR Number', 'fdrNumber', r.fdrNumber, { req: true, ph: 'e.g. SBI-FDR-99201-2024', attrs: 'autocapitalize="characters"' })}
        ${fld('Bank Name', 'bankName', r.bankName || BANKS[0][0], { opts: BANKS.map(b => b[0]) })}
        ${fld('Branch Name', 'branchName', r.branchName, { req: true })}
        ${fld('IFSC Code', 'ifscCode', r.ifscCode, { req: true, ph: 'e.g. SBIN0001234', attrs: 'maxlength="11" autocapitalize="characters"' })}
        ${fld('FDR Amount (₹)', 'amountRs', r.amountRs, { req: true, type: 'number' })}
        <div class="grid2">${fld('Issue Date', 'issueDate', r.issueDate, { req: true, type: 'date' })}${fld('Maturity Date', 'maturityDate', r.maturityDate, { req: true, type: 'date', hint: '10 years from issue' })}</div>
        ${fld('Linked Application', 'applicationNumber', r.applicationNumber, { opts: [['', 'Not linked (general security deposit)'], ...apps.map(a => [a.applicationNumber, a.applicationNumber])] })}
        ${fld('Joint Lien Holder', 'lien', `Regional Officer, ${reg} Regional Office, AICTE`, { ro: true })}
      </div>
      <div class="card"><div class="row between"><div class="h3">FDR Advice / Receipt <span style="color:var(--red)">*</span></div><label class="btn btn-outline btn-xs file-btn">${ic('upload', 14)} Upload<input type="file" accept=".pdf,.jpg,.jpeg,.png" data-attach="fdrNew"></label></div>
        <div class="mt8">${files.length ? files.map(f => `<div class="row">${sIcon('ok')}<div class="grow"><div class="small ellipsis">${esc(f.fileName)}</div><div class="xs muted mono">SHA-256 ${short(f.fileHash)}</div></div></div>`).join('') : '<div class="xs muted">PDF / JPG / PNG, max 10 MB</div>'}${UI.err.file ? `<div class="ferr">${esc(UI.err.file)}</div>` : ''}</div></div></form>`,
    footer: `<button class="btn btn-ghost" data-act="back">Cancel</button><button class="btn btn-primary" data-act="submitNewFdr">Submit FDR</button>`,
  };
};

V.compliance = () => {
  const filed = myApps().filter(a => a.status !== 'DRAFT'), app = filed.find(a => a.findings.length) || filed[0];
  const m = ruleMatrix(app).sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
  const passed = m.filter(f => f.severity === 'PASSED').length, evald = m.filter(f => f.severity !== 'NOT_EVALUATED').length;
  const pct = evald ? Math.round(passed / evald * 100) : 0;
  const ad = DB.adapters[inst().id] || [];
  const adTone = { CONNECTED: 'blue', VERIFIED: 'green', DISCREPANCY_FOUND: 'red' };
  return {
    title: 'Compliance & Verification', refresh: true,
    body: `<div class="card row"><svg class="ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" stroke-width="3.5"/><circle cx="18" cy="18" r="15.9" fill="none" stroke="${pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#f43f5e'}" stroke-width="3.5" stroke-dasharray="${pct} 100" stroke-linecap="round" transform="rotate(-90 18 18)"/><text x="18" y="21" text-anchor="middle" font-size="9" font-weight="800" fill="#0a2540">${pct}%</text></svg>
        <div class="grow"><div class="h3">Statutory Compliance Score</div><div class="xs muted">${passed} of ${evald} evaluated rules passed${app ? ` · Based on ${esc(app.applicationNumber)}` : ''}</div><div class="xs muted">Deterministic rule matrix · APH v2026.1</div></div></div>
      <div class="section-title"><span class="h2">Deterministic Regulatory Rule Matrix</span></div>
      ${m.map(findingCard).join('')}
      <div class="section-title"><span class="h2">Issuing Authority Verification</span><span class="chip blue sm">Simulated</span></div>
      ${ad.map(x => `<div class="card"><div class="row between top"><div class="small b grow">${esc(x.name)}</div>${chip([`Simulated · ${x.status.replace(/_/g, ' ')}`, adTone[x.status] || 'slate'], true)}</div>
        <div class="xs muted mt4 mono" style="word-break:normal">Ref ${esc(x.referenceNumber)} · ${x.latencyMs} ms · ${fmtDT(x.lastPingAt)}</div>
        <div class="mt8">${Object.entries(x.verifiedAttributes).map(([k, v]) => `<div class="kv"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}</div>
        <div class="row between mt8"><span class="xs muted" style="font-style:italic;flex:1">${esc(x.disclaimer)}</span><button class="btn btn-ghost btn-xs" data-act="pingAdapter" data-id="${x.id}">${ic('refresh', 14)} Re-verify</button></div></div>`).join('')}`,
  };
};

V.alerts = () => {
  const all = myNotifs(), f = UI.alertsFilter;
  const list = all.filter(n => f === 'ALL' || (f === 'UNREAD' && !n.isRead) || (f === 'CRITICAL' && n.type === 'CRITICAL'));
  const tone = { CRITICAL: ['red', 'alert'], WARNING: ['amber', 'alert'], SUCCESS: ['green', 'checkCircle'], INFO: ['blue', 'info'] };
  return {
    title: 'Notifications', tab: 'alerts', refresh: true,
    right: all.some(n => !n.isRead) ? `<button class="ghost-btn" data-act="readAll">Mark all read</button>` : '',
    body: `<div class="pills"><button class="${f === 'ALL' ? 'on' : ''}" data-act="alertsPill" data-v="ALL">All Alerts (${all.length})</button><button class="${f === 'UNREAD' ? 'on' : ''}" data-act="alertsPill" data-v="UNREAD">Unread (${all.filter(n => !n.isRead).length})</button><button class="${f === 'CRITICAL' ? 'on' : ''}" data-act="alertsPill" data-v="CRITICAL">Critical</button></div>
      <div id="notelist">${list.length ? [['Today', list.filter(n => isToday(n.timestamp))], ['Earlier', list.filter(n => !isToday(n.timestamp))]].filter(([, g]) => g.length).map(([h, g]) => `<h2 class="fv-h">${h}</h2>
        <div class="fv-notes">${g.map(n => {
          const [t, i] = tone[n.type] || tone.INFO;
          return `<div class="fv-note ${n.isRead ? '' : 'unread'}"><span class="tile-ico tone-${t}">${ic(i, 18)}</span>
            <div class="grow"><div class="fv-t" translate="no">${esc(n.title)}</div><div class="fv-m" translate="no">${esc(n.message)}</div><div class="fv-d">${fmtDT(n.timestamp)}</div>
            <div class="fv-links">${n.link ? `<button class="link" data-act="openNotif" data-id="${n.id}">Inspect ${ic('chev', 14)}</button>` : ''}${n.isRead ? '' : `<button class="link" style="color:var(--muted)" data-act="readNotif" data-id="${n.id}">Mark read</button>`}</div></div>
            ${n.isRead ? '' : '<span class="fv-unread" role="img" aria-label="Unread"></span>'}</div>`;
        }).join('')}</div>`).join('') : `<div class="empty">${ic('bell', 40)}<div>No notifications matching current filter.</div></div>`}</div>`,
  };
};

V.profile = () => {
  const u = me(), i = inst();
  const li = (icon, t, s, attr, extra = '') => `<button class="li" ${attr}><span class="li-ico">${ic(icon, 20)}</span><div class="grow"><div class="li-t">${t}</div>${s ? `<div class="li-s">${s}</div>` : ''}</div>${extra || ic('chev', 18, 'chev')}</button>`;
  return {
    header: 'none', tab: 'profile',
    pre: `<div class="fv-profile">${avatar(u)}
        <div class="grow"><span class="fv-kicker" style="color:#E8D29A;text-transform:none;letter-spacing:.3px">Profile &amp; Settings</span><b translate="no">${esc(u.name)}</b><span class="fv-role" translate="no">${esc(u.designation)}</span><span class="fv-org"><span translate="no">${esc(i.name)}</span> · PID <span translate="no">${esc(i.pid)}</span></span></div>
        <button class="icon-btn" data-go="instDetails" aria-label="Edit institution details" style="color:#fff">${ic('edit', 20)}</button></div>`,
    body: `<h2 class="fv-h" style="margin-top:0">Account</h2>
      <div class="list">
        ${li('building', 'Institution Details', `${esc(i.city)}, ${esc(i.state)}`, 'data-go="instDetails"')}
        ${li('user', 'Contact Person Details', esc(u.email), 'data-go="contact"')}
        ${li('lock', 'Change Password', '', 'data-go="password"')}
        <div class="li"><span class="li-ico">${ic('globe', 20)}</span><div class="grow"><div class="li-t">Language</div></div>
          <div class="fv-lang" translate="no"><button class="${I18N.lang === 'hi' ? '' : 'on'}" ${I18N.lang === 'hi' ? 'data-act="toggleLang"' : ''} aria-pressed="${I18N.lang !== 'hi'}">EN</button><button class="${I18N.lang === 'hi' ? 'on' : ''}" ${I18N.lang === 'hi' ? '' : 'data-act="toggleLang"'} aria-pressed="${I18N.lang === 'hi'}">हिन्दी</button></div></div>
        <div class="li"><span class="li-ico">${ic('bell', 20)}</span><div class="grow"><div class="li-t">Notifications</div><div class="li-s">FDR expiry, scrutiny &amp; deficiency alerts</div></div><label class="toggle"><input type="checkbox" data-pref="push" ${DB.prefs.push ? 'checked' : ''} aria-label="Notifications"><span></span></label></div>
      </div>
      <h2 class="fv-h">Compliance &amp; Records</h2>
      <div class="list">
        ${li('shieldCheck', 'Compliance & Verification', 'Rule matrix & authority adapters', 'data-go="compliance"')}
        ${li('activity', 'Activity Log', 'Tamper-evident audit trail', 'data-go="activity"')}
        ${li('message', 'Grievance / Raise a Ticket', `${DB.tickets.filter(t => t.institutionId === i.id).length} ticket(s)`, 'data-go="tickets"')}
        ${li('help', 'Help & Support', 'FAQs, handbooks, contact', 'data-go="help"')}
        ${li('info', 'About Portal', 'Version, disclaimers', 'data-go="about"')}
        ${li('download', 'Download Reports', 'FDR register, applications, activity (CSV)', 'data-act="reports"')}
        ${Backend.remote ? '' : li('swap', 'Switch Institution (Demo)', 'Explore other applicant personas', 'data-go="switchInst"')}
      </div>
      <button class="btn btn-danger fv-logout" data-act="logout">${ic('logout', 18)} Logout</button>
      <p class="legal">AICTE Intelligent Regulatory Validation Platform (AI-IRVP) • APH v2026.1 Compliance Engine</p>`,
  };
};
V.instDetails = () => {
  const i = { ...inst(), ...(UI.vals || {}) }, e = UI.edit === 'inst';
  const kv = (k, v) => `<div class="kv"><span>${esc(k)}</span><span>${esc(v)}</span></div>`;
  return {
    title: 'Institution Details',
    right: e ? '' : `<button class="link" data-act="editOn" data-v="inst" style="padding:0 8px">${ic('edit', 16)} Edit</button>`,
    body: e ? `<form id="instForm" novalidate onsubmit="return false"><div class="card">
        ${fld('Institution Name', 'name', i.name, { ro: true, hint: 'Name changes require a “Change in Institution Details” application.' })}
        ${fld('Permanent Institute ID', 'pid', i.pid, { ro: true })}
        ${fld('Address', 'address', i.address, { req: true, type: 'textarea', rows: 2 })}
        <div class="grid2">${fld('District / City', 'district', i.district, { req: true })}${fld('State', 'state', i.state, { opts: STATES })}</div>
        ${fld('Institution Type', 'type', i.type, { opts: INST_TYPES })}
        ${fld('Website', 'website', i.website, { ph: 'www.institute.edu.in' })}</div></form>`
      : `<div class="card">${kv('Institution Name', i.name)}${kv('Permanent Institute ID', i.pid)}${kv('Type', i.type)}${kv('Address', i.address)}${kv('District / City', i.district)}${kv('State', i.state)}${kv('AICTE Region', `${i.region} Regional Office`)}${kv('Website', i.website || '—')}</div>
        <div class="card">${kv('Sanctioned Intake', `${i.sanctionedIntake} Seats`)}${kv('Total Students', i.totalStudents.toLocaleString('en-IN'))}${kv('SFR', i.sfr)}${kv('Required FDR Corpus', crLabel(i.requiredFdrLakhs))}</div>
        <button class="btn btn-outline btn-block mt12" data-act="startApp" data-type="INFRASTRUCTURE_UPDATE">${ic('fileEdit', 18)} Apply for Change in Institution Details</button>`,
    footer: e ? `<button class="btn btn-ghost" data-act="editOff">Cancel</button><button class="btn btn-primary" data-act="saveInst">Save Changes</button>` : '',
  };
};
V.contact = () => {
  const x = UI.vals, u = x ? { ...me(), ...x } : me(), e = UI.edit === 'contact', n = x ? { name: x.nodalName, email: x.nodalEmail, mobile: x.nodalMobile } : inst().nodal || {};
  const kv = (k, v) => `<div class="kv"><span>${esc(k)}</span><span>${esc(v)}</span></div>`;
  return {
    title: 'Contact Person Details',
    right: e ? '' : `<button class="link" data-act="editOn" data-v="contact" style="padding:0 8px">${ic('edit', 16)} Edit</button>`,
    body: e ? `<form id="contactForm" novalidate onsubmit="return false"><div class="card"><div class="h3" style="margin-bottom:12px">Head of Institution</div>
        ${fld('Name', 'name', u.name, { req: true })}${fld('Designation', 'designation', u.designation, { req: true })}${fld('Official Email', 'email', u.email, { ro: true, hint: 'Login ID — change via DTE request.' })}${fld('Mobile', 'mobile', u.mobile, { req: true, type: 'tel' })}</div>
        <div class="card"><div class="h3" style="margin-bottom:12px">Alternate Nodal Officer</div>${fld('Name', 'nodalName', n.name)}${fld('Email', 'nodalEmail', n.email, { type: 'email' })}${fld('Mobile', 'nodalMobile', n.mobile, { type: 'tel' })}</div></form>`
      : `<div class="card"><div class="row">${avatar(u, 'lg')}<div><div class="h3">${esc(u.name)}</div><div class="xs muted">${esc(u.designation)}</div></div></div><div class="mt12">${kv('Official Email', u.email)}${kv('Mobile', u.mobile || '—')}${kv('Portal Role', 'Institution (Applicant)')}</div></div>
        <div class="card"><div class="h3">Alternate Nodal Officer</div><div class="mt8">${n.name ? kv('Name', n.name) + kv('Email', n.email || '—') + kv('Mobile', n.mobile || '—') : '<div class="xs muted">Not designated. Tap Edit to add a nodal officer.</div>'}</div></div>`,
    footer: e ? `<button class="btn btn-ghost" data-act="editOff">Cancel</button><button class="btn btn-primary" data-act="saveContact">Save</button>` : '',
  };
};
V.password = () => ({
  title: 'Change Password',
  body: `<div class="banner info">${ic('shield', 18)}<div>For a forgotten password, resets require a formal digital signature request by the Head of Institution / Nodal Officer through your State DTE.</div></div>
    <form id="pwForm" novalidate onsubmit="return false"><div class="card mt12">
      ${fld('Current Password', 'current', '', { req: true, type: 'password', icon: 'lock', attrs: 'autocomplete="current-password"' })}
      ${fld('New Password', 'next', '', { req: true, type: 'password', icon: 'key', attrs: 'autocomplete="new-password"', hint: 'Minimum 8 characters with upper-case, lower-case, number and special character.' })}
      ${fld('Confirm New Password', 'confirm', '', { req: true, type: 'password', icon: 'key', attrs: 'autocomplete="new-password"' })}</div></form>`,
  footer: `<button class="btn btn-primary btn-block" data-act="savePassword">Update Password</button>`,
});
V.tickets = () => {
  const list = DB.tickets.filter(t => t.institutionId === inst().id).sort(byNewest('createdAt'));
  const v = UI.vals || {};
  const refs = [...myApps().filter(a => a.applicationNumber).map(a => a.applicationNumber), ...myFdrs().map(f => f.fdrNumber)];
  return {
    title: 'Grievance / Tickets', refresh: !UI.ticketForm,
    body: UI.ticketForm ? `<form id="ticketForm" novalidate onsubmit="return false"><div class="card">
        ${fld('Category', 'category', v.category || 'FDR / Security Deposit', { opts: ['FDR / Security Deposit', 'Application / Scrutiny', 'Deficiency Notice', 'Technical Issue', 'Login / Credentials', 'Other'] })}
        ${fld('Related Reference', 'ref', v.ref || '', { opts: [['', 'None'], ...refs.map(r => [r, r])] })}
        ${fld('Subject', 'subject', v.subject || '', { req: true })}${fld('Description', 'desc', v.desc || '', { req: true, type: 'textarea', rows: 4 })}</div></form>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px" class="mt12"><button class="btn btn-ghost" data-act="ticketCancel">Cancel</button><button class="btn btn-primary" data-act="submitTicket">Submit Ticket</button></div>`
      : `<button class="btn btn-primary btn-block" data-act="ticketNew">${ic('plus', 18)} Raise New Ticket</button>
        <div class="mt12">${list.length ? list.map(t => `<div class="card"><div class="row between"><b class="small mono">${esc(t.id)}</b>${chip([t.status, t.status === 'Open' ? 'amber' : 'green'], true)}</div><div class="small b mt4">${esc(t.subject)}</div><div class="xs muted">${esc(t.category)}${t.ref ? ` · ${esc(t.ref)}` : ''} · ${fmtDT(t.createdAt)}</div><div class="xs mt8" style="color:var(--text2)">${esc(t.desc)}</div>${t.updates.map(x => `<div class="xs mt8" style="border-left:3px solid var(--blue2);padding-left:8px"><b>${esc(x.by)}</b> · ${fmtDT(x.at)}<br>${esc(x.text)}</div>`).join('')}</div>`).join('') : `<div class="empty">${ic('message', 40)}<div>No tickets raised yet.</div></div>`}</div>`,
  };
};
const FAQ = [
  ['How do I submit a new approval application?', 'Home → New Application → choose the application type. Complete Institution, Program, FDR and Documents steps; the AI pre-validation and deterministic rule engine run before you review, e-sign and submit. You receive an Application Reference Number and a downloadable acknowledgement.'],
  ['What are the Security Deposit (FDR) requirements?', 'Per APH Chapter VI / Clause 6.2, the institution must maintain a Fixed Deposit Receipt of at least the required corpus (₹100 Lakhs by default) for a 10-year term, under irrevocable joint lien in favour of the Regional Officer, AICTE. The issuing bank must endorse the lien in its Core Banking System (CBS).'],
  ['When must I renew an expiring FDR?', 'FDRs within 180 days of maturity are marked “Expiring Soon”. Institutions must submit renewal receipts 60 days prior to maturity via FDR → Process Renewal / Replacement. The renewed deposit automatically inherits the joint lien.'],
  ['How do I get my security deposit released?', 'After the 10-year lock-in, a matured FDR becomes eligible for joint lien discharge (APH Clause 6.4). Submit a Discharge Application with statutory grounds and certification; the AICTE Regulation Bureau approves the release decree and notifies the bank.'],
  ['Is the AI validation a regulatory decision?', 'No. AI summaries are advisory interpretations, clearly labelled. Deterministic rules (v2026.1) are evaluated separately, and final decisions are taken by the Scrutiny Committee with a human-in-the-loop review recorded in the audit ledger.'],
  ['What is SHA-256 duplicate detection?', 'A cryptographic fingerprint is computed for every uploaded file. Identical fingerprints across different institutions (e.g. a re-used land deed) are flagged CRITICAL under RULE-DUPLICATE-HASH-04.'],
  ['How do I respond to a deficiency notice?', 'Open the application → Submit Response. Answer each point and attach attested proof within 7 working days. Your response creates a new application version for re-scrutiny.'],
];
V.help = () => ({
  title: 'Help & Support',
  body: `<div class="h2" style="margin-bottom:10px">Frequently Asked Questions</div>
    ${FAQ.map(([q, a]) => `<details class="acc"><summary>${esc(q)}${ic('down', 16)}</summary><div class="acc-b">${esc(a)}</div></details>`).join('')}
    <div class="section-title"><span class="h2">Reference Handbooks</span></div>
    <div class="list">
      <button class="li" data-act="handbook" data-v="aph"><span class="li-ico">${ic('file', 20)}</span><div class="grow"><div class="li-t">Approval Process Handbook (APH 2026-27)</div></div>${ic('chev', 18, 'chev')}</button>
      <button class="li" data-act="handbook" data-v="sd"><span class="li-ico">${ic('file', 20)}</span><div class="grow"><div class="li-t">Security Deposit Verification Guidelines</div></div>${ic('chev', 18, 'chev')}</button>
      <button class="li" data-act="handbook" data-v="cred"><span class="li-ico">${ic('file', 20)}</span><div class="grow"><div class="li-t">Credential Recovery / Reset Policy</div></div>${ic('chev', 18, 'chev')}</button></div>
    <div class="section-title"><span class="h2">Contact</span></div>
    <div class="card small"><b>Regulation Bureau IT Cell</b><div class="muted">All India Council for Technical Education<br>Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070<br>www.aicte-india.org</div></div>
    <button class="btn btn-primary btn-block mt12" data-go="tickets">${ic('message', 18)} Raise a Ticket</button>`,
});
const DISCLAIMERS = [
  ['Strict Separation of Rules & AI Inference', 'The platform enforces strict structural separation between deterministic validation rules (v2026.1) and probabilistic AI extraction. AI generated summaries are advisory interpretations, labeled with disclaimers, and never treated as final regulatory decisions.'],
  ['Simulated External Issuing Authorities', 'Integrations with State Directorate of Technical Education (DTE), Affiliating Universities, State Fire Services, and Core Banking (CBS) operate through simulated adapters for demonstration and test execution. No live government databases are polled.'],
  ['Human-in-the-Loop Review Requirement', 'Reviewers must provide formal regulatory rationale and statutory handbook citations to resolve deficiencies or override deterministic findings. Overrides are permanently captured in the tamper-evident audit ledger with correlation IDs.'],
  ['Document Forensics & Duplicate Detection', 'Calculated cryptographic SHA-256 hashes cross-verify institutional documents across applications to prevent the reuse of land sale deeds, building safety certificates, or fraudulent multi-trust filings.'],
];
V.about = () => ({
  title: 'About Portal',
  body: `<div class="center"><img src="emblem.png" alt="AICTE emblem" style="width:80px;height:80px"><div class="h2 mt8">AICTE Intelligent Regulatory Validation Platform</div><div class="small muted">Institution (Applicant) Mobile Portal · Security Deposit / FDR Management</div><div class="row wrap mt8" style="justify-content:center;gap:6px"><span class="chip blue sm">Engine v2026.1</span><span class="chip purple sm">APH 2026-27</span><span class="chip slate sm">Prototype</span></div></div>
    <div class="banner warn mt16">${ic('alert', 18)}<div><b>PROTOTYPE ONLY:</b> This software system is a functional technical prototype created for evaluation, research, and testing. It does not constitute official regulatory approval or endorsement by the All India Council for Technical Education (AICTE). Real statutory approvals require authorized scrutiny committee decisions in compliance with the prevailing AICTE Approval Process Handbook.</div></div>
    ${DISCLAIMERS.map(([t, d]) => `<div class="card"><div class="small b">${esc(t)}</div><div class="xs mt4" style="color:var(--text2)">${esc(d)}</div></div>`).join('')}
    <p class="legal">Protected system under Section 43 &amp; 66 of Information Technology Act, 2000.<br>© ${now().getFullYear()} All India Council for Technical Education (AICTE), Ministry of Education, Govt. of India.</p>
    <div class="card mt12 small"><div class="kv"><span>Data source</span><span>${Backend.remote ? 'AICTE server (PostgreSQL)' : 'Demo — on this device'}</span></div><div class="kv"><span>Rule set</span><span>${esc(DB.ruleVersion || 'v2026.1')}</span></div><div class="kv"><span>App version</span><span>1.1.0</span></div></div>
    ${Backend.remote ? '' : `<button class="btn btn-danger btn-block mt16" data-act="resetDemo">${ic('refresh', 18)} Reset Demo Data</button>`}`,
});
V.activity = () => {
  const list = myAudit();
  return {
    refresh: true, title: 'Activity Log', sub: 'Section 10(1) AICTE Act 1987 — immutable record',
    body: `<div class="list">${list.length ? list.map(auditRow).join('') : '<div class="empty small">No matching audit ledger entries found.</div>'}</div>`,
  };
};
V.switchInst = () => ({
  title: 'Switch Institution (Demo)',
  body: `<div class="banner info">${ic('info', 18)}<div>Select an authorised Technical Institution persona to explore different application states. Session state persists across personas.</div></div>
    <div class="list mt12">${instUsers().map(u => { const i = instOf(u), on = u.id === me().id; return `<button class="li" data-act="switchTo" data-id="${u.id}" ${on ? 'disabled' : ''}><span class="avatar" style="border:0">${esc(initials(u.name))}</span><div class="grow"><div class="li-t">${esc(i.name)}</div><div class="li-s">${esc(u.name)} · ${esc(u.designation)}<br>PID ${esc(i.pid)} · ${esc(i.region)}</div></div>${on ? chip(['Active', 'green'], true) : ic('chev', 18, 'chev')}</button>`; }).join('')}</div>`,
});

/* ============================== sheets ============================== */
function showPrototypeNotice() {
  openSheet('Regulatory Evaluation & Prototype Notice', `<div class="banner warn">${ic('alert', 18)}<div><b>Mandatory Statutory System Disclaimer.</b> PROTOTYPE ONLY: This system does not constitute official regulatory approval or endorsement by AICTE.</div></div>
    ${DISCLAIMERS.map(([t, d]) => `<div class="mt12"><div class="small b">${esc(t)}</div><div class="xs muted mt4">${esc(d)}</div></div>`).join('')}
    <button class="btn btn-primary btn-block mt16" data-act="ackNotice">I Understand &amp; Acknowledge</button>`);
}
function otpSheetBody() {
  const o = UI.otp, remote = Backend.remote;
  if (!o.sent) return `<p class="small muted">${remote ? 'Enter your registered email. A 6-digit one-time code will be emailed to you.' : 'Enter your registered email or Permanent Institute ID. A one-time password will be sent to the registered mobile and email.'}</p>
    <div class="field mt12"><label for="otpId">${remote ? 'Registered Email' : 'Registered Email / PID'}</label><div class="input-wrap">${ic('user', 18)}<input class="input" id="otpId" value="${esc(o.id || '')}" placeholder="principal@institute.edu.in" autocapitalize="off" inputmode="email" autocomplete="email"></div>${o.err ? `<div class="ferr" role="alert">${esc(o.err)}</div>` : ''}</div>
    <button class="btn btn-primary btn-block" data-act="otpSend">Send OTP</button>`;
  return `<div class="banner info">${ic(remote ? 'mail' : 'phone', 18)}<div>${remote ? `A 6-digit code was sent to <b>${esc(o.id)}</b>. It expires in a few minutes.` : `OTP sent to the mobile ending <b>${esc(o.mask)}</b> and the registered email.<br><span class="xs">Simulated delivery — demo OTP: <b class="mono">${esc(o.demoCode)}</b></span>`}</div></div>
    <div class="field mt12"><label for="otpCode">Enter 6-digit OTP</label><input class="input mono" id="otpCode" inputmode="numeric" maxlength="6" placeholder="••••••" style="font-size:20px;letter-spacing:8px;text-align:center" autocomplete="one-time-code">${o.err ? `<div class="ferr" role="alert">${esc(o.err)}</div>` : ''}</div>
    <button class="btn btn-primary btn-block" data-act="otpVerify">Verify &amp; Login</button><div class="center mt12"><button class="link" data-act="otpResend">Resend OTP</button></div>`;
}
function esignBody() {
  const m = UI.esignMethod, s = UI.esignState || {};
  const head = `<div class="seg"><button class="${m === 'AADHAAR' ? 'on' : ''}" data-act="esignMethod" data-v="AADHAAR">Aadhaar eSign</button><button class="${m === 'DSC' ? 'on' : ''}" data-act="esignMethod" data-v="DSC">DSC Token</button></div>`;
  if (m === 'AADHAAR') {
    if (!s.sent) return `${head}<p class="small muted mt12">Sign the declaration using Aadhaar-based eSign. An OTP will be sent to the Aadhaar-linked mobile of the signatory (${esc(me().name)}).</p>
      <div class="field mt12"><label>Aadhaar / Virtual ID — last 4 digits</label><input class="input mono" id="aadhaar4" inputmode="numeric" maxlength="4" placeholder="XXXX" style="letter-spacing:6px">${s.err ? `<div class="ferr">${esc(s.err)}</div>` : ''}</div>
      <label class="check"><input type="checkbox" id="esConsent"> I consent to authenticate using Aadhaar for signing this application declaration.</label>
      <button class="btn btn-primary btn-block mt16" data-act="esignSend">Send OTP</button>`;
    return `${head}<div class="banner info mt12">${ic('phone', 18)}<div>OTP sent to Aadhaar-linked mobile (XXXX-XXXX-${esc(s.last4)}).<br><span class="xs">Simulated eSign gateway — demo OTP: <b class="mono">${s.code}</b></span></div></div>
      <div class="field mt12"><label>Enter OTP</label><input class="input mono" id="esOtp" inputmode="numeric" maxlength="6" style="font-size:20px;letter-spacing:8px;text-align:center">${s.err ? `<div class="ferr">${esc(s.err)}</div>` : ''}</div>
      <button class="btn btn-primary btn-block" data-act="esignVerify">${ic('pen', 18)} Sign &amp; Submit</button>`;
  }
  return `${head}<div class="field mt12"><label>Select Certificate</label><select class="input" id="dscCert"><option>Class 3 DSC — ${esc(me().name)} (${esc(me().designation)})</option></select><div class="hint">Simulated token — no physical USB token required.</div></div>
    <div class="field"><label>Token PIN</label><input class="input" id="dscPin" type="password" inputmode="numeric" placeholder="Minimum 4 digits">${s.err ? `<div class="ferr">${esc(s.err)}</div>` : ''}</div>
    <button class="btn btn-primary btn-block" data-act="esignDsc">${ic('pen', 18)} Sign &amp; Submit</button>`;
}
const HANDBOOKS = {
  aph: ['Approval Process Handbook (APH 2026-27)', 'The APH sets the norms and procedure for Approval, Extension of Approval (EoA), intake variation, new programmes, change in institution details, and closure. Key clauses used in this portal: Clause 1.2.3 (Institutional Identification), Clause 2.4.1 (Mandatory Submissions — 7 statutory documents), Clause 3.1.2 (Validity of Approvals), Clause 4.8.1 (Document Authenticity & Forensics), Appendix 4 (Land & Built-up Area norms), Appendix 7 (Faculty cadre ratio 1:2:6, SFR ≤ 1:20).'],
  sd: ['Security Deposit Verification Guidelines', 'Chapter VI requires institutions to maintain a security deposit as a Fixed Deposit Receipt for a 10-year term under irrevocable joint lien with the Regional Officer, AICTE (Clause 6.2). The scheduled commercial bank endorses the lien in its Core Banking System. FDRs within 180 days of maturity must be renewed, with renewal receipts submitted 60 days before maturity. After the lock-in, the joint lien may be discharged on approval of the Regulation Bureau (Clause 6.4).'],
  cred: ['Credential Recovery / Reset Policy', 'Institutions: Password resets require a formal digital signature request initiated by the registered Head of Institution / Nodal Officer through your State Directorate of Technical Education (DTE). AICTE Officials: contact the Regulation Bureau IT Cell at Headquarters, New Delhi. Bank Officials: contact your designated Institutional Banking Lead at Central Office.'],
};

/* ============================== actions ============================== */
const PW_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;
const MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };

// Validates, fingerprints (SHA-256) and counts pages on the device. Upload happens separately.
async function hashFiles(input) {
  const out = [];
  for (const f of input.files) {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (!MIME[ext] || (f.type && !Object.values(MIME).includes(f.type))) { toast(`${f.name}: only PDF, JPG or PNG files are accepted`, 'err'); continue; }
    if (f.size > 10 * 1024 * 1024) { toast(`${f.name}: exceeds 10 MB`, 'err'); continue; }
    if (!f.size) { toast(`${f.name}: empty file`, 'err'); continue; }
    const buf = await f.arrayBuffer();
    out.push({ file: f, meta: { fileName: f.name, fileSizeKb: Math.max(1, Math.round(f.size / 1024)), fileSizeBytes: f.size, mimeType: f.type || MIME[ext], fileHash: await sha256(buf), pageCount: ext === 'pdf' ? countPdfPages(buf) : 1, uploadedAt: now().toISOString() } });
  }
  input.value = '';
  return out;
}
async function uploadAll(items) {
  const done = [];
  for (const it of items) done.push({ ...it.meta, storagePath: await Backend.upload(it.file, it.meta.fileHash) });
  return done;
}

function onSignedIn() {
  UI.loginErr = null; UI.loginPw = ''; UI.err = {}; UI.appsFilter = 'ALL'; UI.w = null;
  markOnboarded();
  goTab('dashboard');
  if (!DB.acked[me().id]) showPrototypeNotice();
}

const csvCell = v => { const s = String(v ?? ''); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function downloadCsv(name, title, header, rows) {
  const i = inst();
  const lines = [[title], ['Institution', `${i.name} (PID ${i.pid})`], ['Generated', fmtDT(now())], ['Source', Backend.remote ? 'AICTE server — records authorised for this institution' : 'Demo data on this device'], [], header, ...rows];
  downloadFile(name, '﻿' + lines.map(r => r.map(csvCell).join(',')).join('\r\n'), 'text/csv');
}
function setPwBody(err) {
  return `<p class="small">Choose a new password for your account.</p>
    <div class="field mt12"><label for="newPw">New Password</label><input class="input" id="newPw" type="password" autocomplete="new-password"><div class="hint">8+ characters with upper, lower, number and special character.</div></div>
    <div class="field"><label for="newPw2">Confirm New Password</label><input class="input" id="newPw2" type="password" autocomplete="new-password">${err ? `<div class="ferr">${esc(err)}</div>` : ''}</div>
    <button class="btn btn-primary btn-block" data-act="setNewPw">Update password</button>`;
}
function helpSheetBody() {
  return `${FAQ.slice(0, 5).map(([q, a]) => `<details class="acc"><summary>${esc(q)}${ic('down', 16)}</summary><div class="acc-b">${esc(a)}</div></details>`).join('')}
    <div class="card mt12 small"><b>Regulation Bureau IT Cell</b><div class="muted">All India Council for Technical Education<br>Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070<br>www.aicte-india.org</div></div>
    <p class="xs muted mt12">Signed-in institutions can raise and track tickets from Profile → Grievance / Raise a Ticket.</p>`;
}
function otpError(e) { UI.otp.err = toApiError(e).message; setSheetBody(otpSheetBody()); }

const ACTIONS = {
  back: () => { if (unsaved()) confirmLeave(); else back(); },
  leaveYes: () => { closeSheet(); back(); },
  leaveSave: async el => {
    collectWizard();
    const saved = await busy(el, async () => { await Backend.saveDraft(UI.w); UI.wChanged = false; return true; }, 'Saving…');
    if (!saved) return;
    closeSheet(); toast('Draft saved — resume from My Applications'); back();
  },
  refreshData: async () => {
    if (UI.refreshing) return;   // one refresh at a time
    setRefreshing(true);
    try {
      await Promise.all([Backend.refresh(), delay(450)]);   // keep the spin visible long enough to register
      UI.lastSync = now();
      render();
      toast(`Updated ${UI.lastSync.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`);
    } catch (e) { toast(`Could not refresh: ${toApiError(e).message}`, 'err'); }
    finally { setRefreshing(false); }
  },
  closeSheet: () => closeSheet(),
  print: () => {
    const letter = $('.letter');
    if (!isNative() || !letter) { window.print(); return; }   // Android WebView has no print dialog: save the notice instead
    const css = [...document.styleSheets].map(sh => { try { return [...sh.cssRules].map(r => r.cssText).join('\n'); } catch (e) { return ''; } }).join('\n');
    downloadFile(`${(topRoute().params.id || 'notice')}-Deficiency-Notice.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Deficiency Notice</title><style>${css}</style></head><body style="background:#fff;padding:16px">${letter.outerHTML}</body></html>`, 'text/html');
  },
  getStarted: () => { markOnboarded(); UI.loginTab = 'register'; go('login'); },
  openLogin: () => { markOnboarded(); UI.loginTab = 'login'; go('login'); },
  obSkip: () => { markOnboarded(); UI.loginTab = 'login'; go('login', {}, { replace: true }); },
  obNext: () => { const k = slideIndex(); if (k < SLIDES.length - 1) ACTIONS.slideTo({ dataset: { v: k + 1 } }); else ACTIONS.getStarted(); },
  showIntro: () => go('splash'),
  toggleLang: () => { I18N.set(I18N.lang === 'hi' ? 'en' : 'hi'); render(); toast(I18N.lang === 'hi' ? 'भाषा: हिन्दी' : 'Language: English', 'info'); },
  slideTo: el => { const s = $('#slides'); s.scrollTo({ left: +el.dataset.v * s.clientWidth, behavior: reducedMotion() ? 'auto' : 'smooth' }); },
  legal: el => { const v = el.dataset.v; if (v === 'help') openSheet('Help & Support', helpSheetBody()); else openSheet(LEGAL[v][0], LEGAL[v][1]); },
  retryBoot: () => location.reload(),
  loginTab: el => { if (UI.completing && el.dataset.v === 'login') { ACTIONS.regCancel(); return; } UI.loginTab = el.dataset.v; UI.loginErr = null; UI.err = {}; render(true); },
  regCancel: async () => { await Backend.signOut().catch(() => {}); UI.completing = null; UI.reg = null; UI.loginTab = 'login'; UI.err = {}; render(true); },
  togglePw: el => { const p = $('#pw'); p.type = p.type === 'password' ? 'text' : 'password'; el.innerHTML = ic(p.type === 'password' ? 'eye' : 'eyeOff', 18); el.setAttribute('aria-label', p.type === 'password' ? 'Show password' : 'Hide password'); },
  demoLogin: () => { UI.loginEmail = DEMO_LOGIN.email; UI.loginPw = DEMO_LOGIN.password; UI.loginErr = null; UI.err = {}; render(); $('form[data-form="login"]').requestSubmit(); },
  regSample: () => { UI.reg = { ...SAMPLE_REG, email: (UI.reg && UI.reg.email) || '' }; UI.err = {}; render(); toast('Sample details filled. Enter your email and a password', 'info'); },
  quickFill: el => { const u = DB.users.find(x => x.id === el.dataset.id); UI.loginEmail = u.email; UI.loginPw = u.demoPassword; UI.loginErr = null; UI.err = {}; render(); },
  forgot: () => {
    if (Backend.remote) {
      openSheet('Reset your password', `<p class="small">Enter your registered email. We'll send a secure link to set a new password.</p>
        <div class="field mt12"><label for="resetEmail">Registered Email</label><input class="input" id="resetEmail" value="${esc(UI.loginEmail || '')}" inputmode="email" autocapitalize="off" autocomplete="email"></div>
        <button class="btn btn-primary btn-block" data-act="resetSend">Send reset link</button>
        <p class="xs muted mt12">No access to the registered email? The Head of Institution / Nodal Officer must request a reset through the State Directorate of Technical Education (DTE).</p>`);
      return;
    }
    openSheet('Credential Recovery / Reset Policy', `<p class="small">In compliance with statutory security standards of the All India Council for Technical Education:</p><ul class="small" style="padding-left:18px;color:var(--text2)"><li><b>Institutions:</b> Password resets require a formal digital signature request initiated by the registered Head of Institution / Nodal Officer through your State Directorate of Technical Education (DTE).</li><li class="mt8"><b>AICTE Officials:</b> Please contact the Regulation Bureau IT Cell at Headquarters, New Delhi.</li><li class="mt8"><b>Bank Officials:</b> Contact your designated Institutional Banking Lead at Central Office.</li></ul><div class="banner info mt12">${ic('info', 18)}<div>Tip: you can still sign in with an OTP sent to your registered mobile.</div></div><button class="btn btn-primary btn-block mt16" data-act="otpLogin">Sign in with OTP</button>`);
  },
  resetSend: async el => {
    const email = $('#resetEmail').value.trim();
    if (!emailOk(email)) { toast('Enter a valid email address', 'err'); return; }
    await busy(el, async () => {
      await Backend.sendReset(email);
      setSheetBody(`<div class="banner ok">${ic('mail', 18)}<div>If an account exists for <b>${esc(email)}</b>, a password reset link has been sent. Open it on this device to set a new password.</div></div><button class="btn btn-primary btn-block mt16" data-act="closeSheet">Done</button>`);
    }, 'Sending…');
  },
  setNewPw: async el => {
    const a = $('#newPw').value, b = $('#newPw2').value;
    if (!PW_RULE.test(a)) { setSheetBody(setPwBody('Use 8+ characters with upper, lower, number and special character')); return; }
    if (a !== b) { setSheetBody(setPwBody('Passwords do not match')); return; }
    await busy(el, async () => {
      await Backend.setNewPassword(a);
      closeSheet();
      toast('Password updated');
      await Backend.afterSignIn('PASSWORD_RESET');
      onSignedIn();
    }, 'Updating…');
  },
  otpLogin: () => { UI.otp = { sent: false }; openSheet('Sign in with OTP', otpSheetBody()); },
  otpSend: async el => {
    const id = $('#otpId').value.trim();
    UI.otp.id = id;
    if (!id) { UI.otp.err = 'Enter your registered email'; setSheetBody(otpSheetBody()); return; }
    await busy(el, async () => {
      try { Object.assign(UI.otp, await Backend.otpStart(id), { sent: true, err: null }); setSheetBody(otpSheetBody()); }
      catch (e) { otpError(e); }
    }, 'Sending…');
  },
  otpResend: async el => {
    await busy(el, async () => {
      try { Object.assign(UI.otp, await Backend.otpStart(UI.otp.id), { err: null }); setSheetBody(otpSheetBody()); toast('OTP resent', 'info'); }
      catch (e) { otpError(e); }
    }, 'Sending…');
  },
  otpVerify: async el => {
    const code = $('#otpCode').value.trim();
    if (!/^\d{6}$/.test(code)) { UI.otp.err = 'Enter the 6-digit code'; setSheetBody(otpSheetBody()); return; }
    await busy(el, async () => {
      try { await Backend.otpVerify(UI.otp.id, code); closeSheet(); onSignedIn(); }
      catch (e) { if (e.code === 'REGISTRATION_REQUIRED') await askRegistration(); else otpError(e); }
    }, 'Verifying…');
  },
  googleLogin: async el => { await busy(el, () => Backend.google(), 'Redirecting…'); },
  ssoLogin: async el => {
    if (Backend.remote) { await busy(el, () => Backend.sso(), 'Redirecting…'); return; }
    openSheet('Government SSO', `<div class="banner info">${ic('shield', 18)}<div>Single Sign-On via a government OIDC identity provider. <b>Simulated identity provider</b> — select a verified institutional identity.</div></div>
      <div class="list mt12">${instUsers().map(u => `<button class="li" data-act="ssoPick" data-id="${u.id}"><span class="avatar" style="border:0">${esc(initials(u.name))}</span><div class="grow"><div class="li-t">${esc(u.name)}</div><div class="li-s">${esc(instOf(u).name)}</div></div>${ic('chev', 18, 'chev')}</button>`).join('')}</div>`);
  },
  ssoPick: async el => { closeSheet(); await Backend.ssoAs(el.dataset.id); onSignedIn(); },
  ackNotice: () => { DB.acked[me().id] = true; save(); closeSheet(); },
  appsFilter: el => { UI.appsFilter = el.dataset.v; goTab('apps'); },
  appsPill: el => { UI.appsFilter = el.dataset.v; render(); swapIn('#applist'); },
  alertsPill: el => { UI.alertsFilter = el.dataset.v; render(); swapIn('#notelist'); },
  readAll: async el => { await busy(el, async () => { await Backend.markRead(null); render(); toast('All notifications marked as read'); }, 'Updating…'); },
  readNotif: el => { const n = DB.notifs.find(x => x.id === el.dataset.id); n.isRead = true; render(); Backend.markRead([n.id]).catch(handleError); },
  openNotif: el => {
    const n = DB.notifs.find(x => x.id === el.dataset.id);
    if (!n.isRead) { n.isRead = true; Backend.markRead([n.id]).catch(() => {}); }
    if (n.link) go(n.link.route, { id: n.link.id }); else render();
  },
  auditInfo: el => {
    const a = DB.audit.find(x => String(x.id) === el.dataset.id), kv = (k, v) => `<div class="kv"><span>${esc(k)}</span><span>${v}</span></div>`;
    openSheet('Audit Trail Entry Inspection', `${kv('Event ID & Action', `<span class="mono">${esc(a.id)}</span><br>${esc(a.action)}`)}${kv('Timestamp (IST)', esc(fmtDT(a.timestamp)))}${kv('Actor', `${esc(a.actorName)} (${esc(a.actorRole)})`)}${kv('Target Entity', `${esc(a.targetType)} · ${esc(a.targetId)}`)}${kv('Correlation ID', `<span class="mono">${esc(a.correlationId)}</span>`)}${kv('IP Address', esc(a.ipAddress))}
      <div class="mt12 xs muted b">STATUTORY EVENT DETAILS</div><p class="small mt4">${esc(a.details)}</p><div class="mt12 xs muted b">CRYPTOGRAPHIC HASH (SHA-256)</div><div class="mono">${esc(a.sha256Hash || 'computing…')}</div>
      ${a.prevHash ? `<div class="mt8 xs muted b">PREVIOUS HASH (CHAIN)</div><div class="mono">${esc(a.prevHash)}</div>` : ''}
      <button class="btn btn-ghost btn-block mt16" data-act="closeSheet">Close Inspection</button>`);
  },
  startApp: el => {
    const t = el.dataset.type;
    if (t === 'FDR') { go('fdrs'); return; }
    UI.w = newWizard(t); UI.wChanged = false;
    go('wizard');
  },
  resumeDraft: el => {
    const a = appById(el.dataset.id);
    UI.w = JSON.parse(JSON.stringify(a.draft));
    UI.w.draftId = UI.w.draftId || a.id;
    UI.w.idemKey = UI.w.idemKey || uuid(); UI.wChanged = false;
    go('wizard');
  },
  saveDraft: async el => { collectWizard(); await busy(el, async () => { await Backend.saveDraft(UI.w); UI.wChanged = false; toast('Draft saved — resume from My Applications'); }, 'Saving…'); },
  wizBack: () => { collectWizard(); UI.err = {}; UI.w.step--; render(true); },
  wizNext: () => {
    collectWizard();
    const w = UI.w;
    if (Object.keys(UI.uploading).length) { toast('Please wait for uploads to finish', 'warn'); return; }
    if (!validateStep(w.step)) { render(); toast('Please correct the highlighted fields', 'err'); return; }
    if (w.step < 4) { w.step++; render(true); return; }
    const missing = DOC_TYPES.filter(d => d.req && !w.docs[d.type]);
    if (missing.length) {
      openSheet('Mandatory documents missing', `<div class="banner warn">${ic('alert', 18)}<div>${missing.length} mandatory document(s) not uploaded: <b>${missing.map(d => esc(d.short)).join(', ')}</b>. They will be flagged CRITICAL by RULE-CHECKLIST-01.</div></div>
        <div style="display:grid;gap:10px" class="mt16"><button class="btn btn-primary btn-block" data-act="closeSheet">Upload Documents</button><button class="btn btn-ghost btn-block" data-act="continueAI">Continue Anyway</button></div>`);
      return;
    }
    w.ai = null;
    go('ai');
  },
  continueAI: () => { closeSheet(); UI.w.ai = null; go('ai'); },
  rerunAI: () => { UI.w.ai = null; UI.aiRun = null; render(true); },
  retryServerValidation: async el => { await busy(el, async () => { await serverValidate(); render(true); }, 'Validating…'); },
  fdrMode: el => { collectWizard(); UI.w.fdr.mode = el.dataset.v; UI.err = {}; render(); },
  pickFdr: el => { UI.w.fdr.existingId = el.value; render(); },
  sampleDoc: el => { collectWizard(); UI.w.docs[el.dataset.doc] = { ...sampleDoc(el.dataset.doc), uploadedAt: now().toISOString() }; UI.w.ai = null; render(); toast(`Sample attached: ${docMeta(el.dataset.doc).short}`); },
  sampleAll: () => { collectWizard(); DOC_TYPES.filter(d => d.req && !UI.w.docs[d.type]).forEach(d => { UI.w.docs[d.type] = { ...sampleDoc(d.type), uploadedAt: now().toISOString() }; }); UI.w.ai = null; render(); toast('Sample documents attached'); },
  removeDoc: el => { delete UI.w.docs[el.dataset.doc]; UI.w.ai = null; UI.wChanged = true; render(); },
  docList: () => {
    const w = UI.w;
    openSheet('Documents Uploaded', DOC_TYPES.filter(d => w.docs[d.type]).map(d => { const x = w.docs[d.type]; return `<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div class="small b">${esc(d.name)}</div><div class="xs muted">${esc(x.fileName)} · ${x.fileSizeKb} KB · ${x.pageCount} pages${x.validTill ? ` · valid till ${esc(x.validTill)}` : ''}</div><div class="mono xs">${esc(x.fileHash)}</div></div>`; }).join(''));
  },
  viewDoc: async el => {
    if (isNative()) {   // Android app: hand the short-lived link to the system viewer
      await busy(el, async () => { window.open(await Backend.signedUrl(el.dataset.path, el.dataset.hash), '_blank'); }, 'Opening…');
      return;
    }
    const win = window.open('', '_blank');
    await busy(el, async () => {
      try {
        const url = await Backend.signedUrl(el.dataset.path, el.dataset.hash);
        if (win) win.location.href = url; else location.assign(url);
      } catch (e) { if (win) win.close(); throw e; }
    }, 'Opening…');
  },
  signSubmit: el => {
    if (!UI.w.declared) { toast('Please accept the declaration', 'err'); return; }
    if (UI.w.esign) { submitApplication(el); return; }
    UI.esignState = {};
    openSheet('e-Sign / Digital Consent', esignBody());
  },
  retrySubmit: () => { closeSheet(); submitApplication($('[data-act="signSubmit"]')); },
  editFromReview: () => { closeSheet(); UI.stack = UI.stack.filter(s => !['ai', 'review'].includes(s.name)); render(true); },
  esignMethod: el => { UI.esignMethod = el.dataset.v; UI.esignState = {}; setSheetBody(esignBody()); },
  esignSend: () => {
    const v = $('#aadhaar4').value.trim();
    if (!/^\d{4}$/.test(v)) { UI.esignState.err = 'Enter the last 4 digits of Aadhaar / VID'; setSheetBody(esignBody()); return; }
    if (!$('#esConsent').checked) { UI.esignState.err = 'Consent is required for Aadhaar authentication'; setSheetBody(esignBody()); return; }
    UI.esignState = { sent: true, last4: v, code: String(rand(100000, 999999)) };
    setSheetBody(esignBody());
  },
  esignVerify: () => {
    if ($('#esOtp').value.trim() !== UI.esignState.code) { UI.esignState.err = 'Incorrect OTP'; setSheetBody(esignBody()); return; }
    UI.w.esign = { method: 'AADHAAR', at: now().toISOString(), ref: `ESIGN-${hex(4).toUpperCase()}`, signer: me().name };
    closeSheet(); render(); submitApplication($('[data-act="signSubmit"]'));
  },
  esignDsc: () => {
    if (!/^\d{4,}$/.test($('#dscPin').value)) { UI.esignState = { err: 'Enter a numeric token PIN of at least 4 digits' }; setSheetBody(esignBody()); return; }
    UI.w.esign = { method: 'DSC', at: now().toISOString(), ref: `DSC-${hex(4).toUpperCase()}`, signer: me().name };
    closeSheet(); render(); submitApplication($('[data-act="signSubmit"]'));
  },
  ack: el => { const a = appById(el.dataset.id); downloadFile(`${a.applicationNumber}-Acknowledgement.html`, ackHtml(a), 'text/html'); },
  fdrAdvice: el => { const f = fdrById(el.dataset.id); downloadFile(`${f.fdrNumber}-Advice.html`, fdrAdviceHtml(f), 'text/html'); },
  appTab: el => { UI.appTab = el.dataset.v; render(); swapIn('#apppane'); },
  rmAttach: el => { UI.attach[el.dataset.key].splice(+el.dataset.k, 1); render(); },
  submitResponse: async el => {
    UI.vals = null;
    const a = appById(el.dataset.id), f = readForm($('#respForm')), pts = a.scrutinyRecommendation.deficiencyPoints;
    const e = {};
    pts.forEach((_, k) => { if ((f[`r${k}`] || '').trim().length < 5) e[`r${k}`] = 'Response is required (at least a short sentence)'; });
    if (!f.certify) e.certify = 'Certification is required';
    if (Object.keys(e).length) { UI.err = e; UI.vals = f; render(); return; }
    if (UI.uploading.respond) { toast('Please wait for uploads to finish', 'warn'); return; }
    await busy(el, async () => {
      await Backend.submitResponse(a.id, pts.map((p, k) => ({ point: p, response: f[`r${k}`].trim() })), UI.attach.respond || []);
      UI.attach.respond = [];
      UI.stack = UI.stack.filter(s => !['respond', 'notice'].includes(s.name));
      render(true);
      toast('Response submitted for re-scrutiny');
    }, 'Submitting…');
  },
  fdrRequestMenu: () => {
    const fd = myFdrs();
    const item = (f, act, label) => `<button class="li" data-go="${act}" data-id="${f.id}"><span class="li-ico">${ic(act === 'fdrRelease' ? 'award' : 'refresh', 20)}</span><div class="grow"><div class="li-t">${label}</div><div class="li-s">${esc(f.fdrNumber)} · ${crLabel(f.amountLakhs)} · ${FSTATUS[fdrStatus(f)][0]}</div></div>${ic('chev', 18, 'chev')}</button>`;
    const items = [
      ...fd.filter(f => fdrStatus(f) === 'EXPIRING_SOON' && !f.pendingRequest).map(f => item(f, 'fdrRenew', 'Renew / Replace expiring FDR')),
      ...fd.filter(f => fdrStatus(f) === 'MATURED' && !f.releaseRequest).map(f => item(f, 'fdrRelease', 'Request lien release')),
      ...fd.filter(f => fdrStatus(f) === 'ACTIVE' && !f.pendingRequest).map(f => item(f, 'fdrRenew', 'Bank change / replacement')),
    ];
    openSheet('FDR Related Request', items.length ? `<div class="list">${items.join('')}</div>` : '<div class="empty small">No FDR is currently eligible for renewal, replacement or release.</div>');
  },
  renewMode: el => { UI.renew = readForm($('#renewForm')); UI.fdrMode = el.dataset.v; UI.err = {}; render(); },
  submitRenewal: async el => {
    const f = fdrById(el.dataset.id), r = readForm($('#renewForm')), repl = UI.fdrMode === 'replacement', e = {};
    if (!r.maturityDate) e.maturityDate = 'Maturity date is required';
    else if (r.maturityDate <= f.maturityDate && fdrStatus(f) !== 'MATURED') e.maturityDate = 'Must be later than the current maturity date';
    if (repl) {
      if (!/^[A-Z0-9][A-Z0-9\-/]{5,}$/i.test((r.fdrNumber || '').trim())) e.fdrNumber = 'Enter a valid FDR number';
      if (!(r.branchName || '').trim()) e.branchName = 'Branch is required';
      if (!ifscOk((r.ifscCode || '').trim().toUpperCase())) e.ifscCode = 'Invalid IFSC';
      if (!(+r.amountRs >= f.amountLakhs * 1e5)) e.amountRs = `Must be at least ${rupees(f.amountLakhs * 1e5)}`;
    }
    if (Object.keys(e).length) { UI.err = e; UI.renew = r; render(); return; }
    UI.renew = r;
    await busy(el, async () => {
      await Backend.requestRenewal(f.id, { mode: repl ? 'replacement' : 'extension', maturityDate: r.maturityDate, token: (r.token || '').trim(),
        ...(repl ? { fdrNumber: r.fdrNumber.trim().toUpperCase(), bankName: r.bankName, branchName: r.branchName.trim(), ifscCode: r.ifscCode.trim().toUpperCase(), amountRs: r.amountRs } : {}) });
      UI.renew = null; UI.renewFor = null;
      back();
      toast('Request submitted — awaiting bank endorsement and AICTE approval');
    }, 'Submitting…');
  },
  submitRelease: async el => {
    const f = fdrById(el.dataset.id), r = readForm($('#releaseForm'));
    if (r.reason.trim().length < 10 || !r.certify) { UI.err = r.certify ? {} : { certify: 'Certification is required' }; if (r.reason.trim().length < 10) UI.err.reason = 'State the statutory grounds'; UI.vals = r; render(); return; }
    await busy(el, async () => { await Backend.requestRelease(f.id, r.reason.trim(), true); back(); toast('Placed before Regulation Bureau'); }, 'Submitting…');
  },
  submitNewFdr: async el => {
    const r = readForm($('#fdrNewForm')), e = {}, files = UI.attach.fdrNew || [];
    UI.newFdr = r;
    if (!/^[A-Z0-9][A-Z0-9\-/]{5,}$/i.test(r.fdrNumber.trim())) e.fdrNumber = 'Enter a valid FDR number';
    else if (DB.fdrs.some(f => f.fdrNumber === r.fdrNumber.trim().toUpperCase())) e.fdrNumber = 'This FDR number is already registered';
    if (!r.branchName.trim()) e.branchName = 'Branch is required';
    if (!ifscOk(r.ifscCode.trim().toUpperCase())) e.ifscCode = 'Invalid IFSC, e.g. SBIN0001234';
    if (!(+r.amountRs > 0)) e.amountRs = 'Enter the amount';
    if (!r.issueDate) e.issueDate = 'Required';
    else if (daysUntil(r.issueDate) > 0) e.issueDate = 'Cannot be in the future';
    if (!r.maturityDate) e.maturityDate = 'Required';
    else if (r.issueDate && r.maturityDate < addYears(r.issueDate, 10, true)) e.maturityDate = 'Tenure must be 10 years';
    if (!files.length) e.file = 'Upload the FDR advice';
    if (Object.keys(e).length) { UI.err = e; render(); return; }
    if (UI.uploading.fdrNew) { toast('Please wait for the upload to finish', 'warn'); return; }
    await busy(el, async () => {
      const res = await Backend.submitFdr(r, files[0]);
      UI.newFdr = null; UI.attach.fdrNew = [];
      go('fdrDetail', { id: res.fdrId }, { replace: true });
      toast('FDR submitted for bank endorsement');
    }, 'Submitting…');
  },
  pingAdapter: async el => {
    const x = DB.adapters[inst().id].find(a => a.id === el.dataset.id);
    el.disabled = true; el.innerHTML = '<span class="spin" aria-hidden="true"></span> Pinging';
    const t0 = performance.now();
    await delay(rand(250, 700));
    x.latencyMs = Math.round(performance.now() - t0);
    x.lastPingAt = now().toISOString();
    if (x.id === 'auth-5') { const f = activeFdrs().find(z => z.isLienConfirmed); if (f) { x.referenceNumber = f.lienEndorsementToken; x.verifiedAttributes = { Bank: f.bankName, 'FDR Amount': rupees(f.amountLakhs * 1e5), 'Maturity Date': f.maturityDate, 'Joint Lien': f.jointLienHolder }; } }
    if (!Backend.remote) logAudit('AUTHORITY_ADAPTER_PING', 'AUTHORITY', x.id, `Re-verified ${x.name}: ${x.status} (${x.latencyMs} ms, simulated).`, { name: 'Authority Adapter Gateway', role: 'SYSTEM' });
    render();
    toast(`${x.name.split('(')[0].trim()}: ${x.status.replace(/_/g, ' ')} (simulated)`, x.status === 'DISCREPANCY_FOUND' ? 'warn' : 'ok');
  },
  editOn: el => { UI.edit = el.dataset.v; UI.err = {}; UI.vals = null; render(); },
  editOff: () => { UI.edit = null; UI.err = {}; UI.vals = null; render(); },
  saveInst: async el => {
    const r = readForm($('#instForm')), e = {};
    if (!r.address.trim()) e.address = 'Address is required';
    if (!r.district.trim()) e.district = 'District is required';
    if (Object.keys(e).length) { UI.err = e; UI.vals = r; render(); return; }
    UI.vals = r;
    await busy(el, async () => { await Backend.updateInstitution(r); UI.edit = null; UI.vals = null; UI.dirty = false; render(); toast('Institution details updated'); }, 'Saving…');
  },
  saveContact: async el => {
    const r = readForm($('#contactForm')), e = {};
    if (!r.name.trim()) e.name = 'Name is required';
    if (!r.designation.trim()) e.designation = 'Designation is required';
    if (!mobileOk(r.mobile)) e.mobile = 'Enter a valid Indian mobile number';
    if (r.nodalEmail && !emailOk(r.nodalEmail)) e.nodalEmail = 'Invalid email';
    if (r.nodalMobile && !mobileOk(r.nodalMobile)) e.nodalMobile = 'Invalid mobile';
    if (Object.keys(e).length) { UI.err = e; UI.vals = r; render(); return; }
    UI.vals = r;
    await busy(el, async () => { await Backend.updateContact(r); UI.edit = null; UI.vals = null; UI.dirty = false; render(); toast('Contact details saved'); }, 'Saving…');
  },
  savePassword: async el => {
    const r = readForm($('#pwForm')), e = {};
    if (isDemoAccount(me().email)) { toast('Password changes are disabled on the shared demo account', 'warn'); return; }
    if (!r.current) e.current = 'Enter your current password';
    if (!PW_RULE.test(r.next)) e.next = 'Use 8+ characters with upper, lower, number and special character';
    else if (r.next === r.current) e.next = 'New password must differ from the current one';
    if (r.next !== r.confirm) e.confirm = 'Passwords do not match';
    $$('#pwForm input').forEach(x => { x.value = ''; });
    if (Object.keys(e).length) { UI.err = e; render(); return; }
    await busy(el, async () => { await Backend.changePassword(me().email, r.current, r.next); back(); toast('Password updated'); }, 'Updating…');
  },
  ticketNew: () => { UI.ticketForm = true; UI.err = {}; render(true); },
  ticketCancel: () => { UI.ticketForm = false; UI.dirty = false; render(true); },
  submitTicket: async el => {
    const r = readForm($('#ticketForm')), e = {};
    if (!r.subject.trim()) e.subject = 'Subject is required';
    if (r.desc.trim().length < 10) e.desc = 'Describe the issue (min 10 characters)';
    if (Object.keys(e).length) { UI.err = e; UI.vals = r; render(); return; }
    UI.vals = r;
    await busy(el, async () => { const id = await Backend.raiseTicket(r); UI.ticketForm = false; UI.vals = null; UI.dirty = false; render(true); toast(`Ticket ${id} raised`); }, 'Submitting…');
  },
  handbook: el => { const [t, d] = HANDBOOKS[el.dataset.v]; openSheet(t, `<p class="small" style="color:var(--text2)">${esc(d)}</p><p class="xs muted mt12">Summary for reference within this prototype. Refer to the official AICTE publication for the authoritative text.</p>`); },
  reports: () => openSheet('Download Reports', `<p class="small muted">Reports contain only records your institution is authorised to see, as of now.</p>
    <div class="list mt12">
      <button class="li" data-act="csvFdrs"><span class="li-ico">${ic('rupee', 20)}</span><div class="grow"><div class="li-t">FDR / Security Deposit Register</div><div class="li-s">${myFdrs().length} deposit(s) · CSV</div></div>${ic('download', 18)}</button>
      <button class="li" data-act="csvApps"><span class="li-ico">${ic('files', 20)}</span><div class="grow"><div class="li-t">Applications &amp; Status</div><div class="li-s">${myApps().filter(a => a.status !== 'DRAFT').length} application(s) · CSV</div></div>${ic('download', 18)}</button>
      <button class="li" data-act="csvAudit"><span class="li-ico">${ic('activity', 20)}</span><div class="grow"><div class="li-t">Activity Log</div><div class="li-s">${myAudit().length} event(s) · CSV</div></div>${ic('download', 18)}</button></div>`),
  csvFdrs: () => downloadCsv(`FDR-Register-${inst().pid}.csv`, 'FDR / Security Deposit Register', ['FDR Number', 'Status', 'Amount (INR)', 'Bank', 'Branch', 'IFSC', 'Issue Date', 'Maturity Date', 'Days to Maturity', 'Lien Confirmed', 'Lien Confirmed By', 'Lien Token', 'Pending Request', 'Release', 'Linked Application'],
    myFdrs().map(f => [f.fdrNumber, FSTATUS[fdrStatus(f)][0], Math.round(f.amountLakhs * 1e5), f.bankName, f.branchName, f.ifscCode, f.issueDate, f.maturityDate, daysUntil(f.maturityDate), f.isLienConfirmed ? 'Yes' : 'No', LIEN_SOURCE[lienSource(f)][0], f.lienEndorsementToken || '', f.pendingRequest ? f.pendingRequest.kind : '', (releaseState(f) || [''])[0], f.applicationNumber])),
  csvApps: () => downloadCsv(`Applications-${inst().pid}.csv`, 'Applications & Status', ['Application Number', 'Type', 'Status', 'Academic Year', 'Submitted', 'Last Updated', 'Version', 'Critical Findings', 'Warnings', 'Open Queries', 'FDR'],
    myApps().filter(a => a.status !== 'DRAFT').map(a => [a.applicationNumber, TYPE_LONG[a.type], STATUS[a.status][0], a.academicYear, fmtDT(a.submittedAt), fmtDT(a.lastUpdatedAt), a.currentVersion, a.findings.filter(f => f.severity === 'CRITICAL').length, a.findings.filter(f => f.severity === 'WARNING').length, a.scrutinyRecommendation && a.scrutinyRecommendation.status !== 'RESPONSE_SUBMITTED' ? a.scrutinyRecommendation.deficiencyPoints.length : 0, a.fdrNumber])),
  csvAudit: () => downloadCsv(`Activity-Log-${inst().pid}.csv`, 'Activity Log', ['Timestamp', 'Action', 'Actor', 'Role', 'Target', 'Details', 'Correlation ID', 'SHA-256'],
    myAudit().map(a => [fmtDT(a.timestamp), a.action, a.actorName, a.actorRole, `${a.targetType} ${a.targetId}`, a.details, a.correlationId, a.sha256Hash])),
  switchTo: el => {
    if (Backend.remote) return;
    const u = DB.users.find(x => x.id === el.dataset.id);
    DB.session = { ...DB.session, userId: u.id, at: now().toISOString() };
    save();
    logAudit('PERSONA_SWITCH', 'USER', u.id, `Switched demo session to ${u.name} (${instOf(u).name}).`);
    UI.appsFilter = 'ALL'; UI.w = null;
    goTab('dashboard');
    toast(`Switched to ${instOf(u).short}`);
  },
  logout: () => openSheet('Logout', `<p class="small">Sign out of the AICTE Institution Portal on this device?</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px" class="mt16"><button class="btn btn-ghost" data-act="closeSheet">Cancel</button><button class="btn btn-danger" data-act="logoutYes">${ic('logout', 18)} Logout</button></div>`),
  logoutYes: async el => {
    UI.loggingOut = true;
    await busy(el, async () => { await Backend.signOut(); }, 'Signing out…');
    sessionEnded(null);
    UI.loggingOut = false;
  },
  resetDemo: () => openSheet('Reset Demo Data', `<p class="small">This clears all applications, FDR changes, tickets and audit entries created on this device and restores the original dataset. You will be signed out.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px" class="mt16"><button class="btn btn-ghost" data-act="closeSheet">Cancel</button><button class="btn btn-danger" data-act="resetYes">Reset</button></div>`),
  resetYes: () => { if (Backend.remote) return; DB = freshDB(); save(); closeSheet(); UI.w = null; UI.stack = [{ name: 'login', params: {} }]; render(true); toast('Demo data restored'); },
};

/* ============================== forms ============================== */
const FORMS = {
  login: async form => {
    if (UI.busy) return;
    const v = readForm(form), e = {};
    UI.loginEmail = v.email; UI.loginPw = v.password; UI.remember = v.remember;
    if (!v.email.trim()) e.email = Backend.remote ? 'Please enter your registered email' : 'Please enter your Email or User ID';
    if (!v.password) e.password = 'Please enter your password';
    UI.err = e; UI.loginErr = null;
    if (Object.keys(e).length) { render(); return; }
    UI.busy = true; render();
    try { await Backend.signIn(v.email, v.password, v.remember); UI.busy = false; onSignedIn(); }
    catch (err) {
      const x = toApiError(err); UI.busy = false;
      if (x.code === 'REGISTRATION_REQUIRED') { await askRegistration(); return; }
      UI.loginErr = x.message; if (x.fields) UI.err = x.fields; render();
    }
  },
  register: async form => {
    const r = readForm(form), e = {}, completing = !!UI.completing;
    UI.reg = { ...r, password: '', confirm: '' };
    if (!r.name.trim()) e.name = 'Institution name is required';
    if (!r.district.trim()) e.district = 'District / City is required';
    if (!r.head.trim()) e.head = 'Head of institution is required';
    if (!completing && !emailOk(r.email)) e.email = 'Enter a valid official email';
    if (!mobileOk(r.mobile)) e.mobile = 'Enter a valid 10-digit Indian mobile number';
    if (!completing && !PW_RULE.test(r.password)) e.password = 'Use 8+ characters with upper, lower, number and special character';
    else if (!completing && r.password !== r.confirm) e.confirm = 'Passwords do not match';
    if (!r.agree) e.agree = 'Please confirm the declaration';
    UI.err = e;
    if (Object.keys(e).length) { render(); return; }
    await busy(form.querySelector('[type=submit]'), async () => {
      const res = completing ? (await Backend.completeRegistration(r), { signedIn: true }) : await Backend.register({ ...r, email: r.email.trim() });
      UI.reg = null; UI.completing = null;
      if (res.signedIn) { onSignedIn(); toast(`Welcome! ${r.name.trim()} is registered`); return; }
      UI.loginTab = 'login'; UI.loginEmail = r.email.trim(); render(true);
      openSheet('Confirm your email', `<div class="center"><div class="success-ring" style="width:72px;height:72px;margin:6px auto 12px">${ic('mail', 36)}</div></div>
        <p class="small mt12">Your account for <b>${esc(r.name)}</b> is created. Open the link we sent to <b>${esc(r.email)}</b> to confirm your email, then log in. No further approval is needed.</p>
        <button class="btn btn-primary btn-block mt16" data-act="closeSheet">Done</button>`);
    }, 'Registering…');
  },
};

const LIVE = {
  norms: () => { collectWizard(); $('#norms').innerHTML = normsBox(UI.w.prog); },
  fdr: () => { collectWizard(); $('#fdrcheck').innerHTML = fdrCheckBox(wizardFdr(UI.w)); },
  fdrIssue: el => {
    collectWizard();
    if (el.value) { UI.w.fdr.maturityDate = addYears(el.value, 10, true); const m = $('[name="fdr.maturityDate"]'); if (m) m.value = UI.w.fdr.maturityDate; }
    $('#fdrcheck').innerHTML = fdrCheckBox(wizardFdr(UI.w));
  },
  validTill: el => { UI.w.docs[el.dataset.doc].validTill = el.value; UI.w.ai = null; },
  appsSearch: el => { UI.appsQuery = el.value; $('#applist').innerHTML = appList(); },
  pwStrength: el => {
    const v = el.value, box = $('#pwStrength');
    if (!box) return;
    const n = !v ? 0 : [v.length >= 8, /[a-z]/.test(v) && /[A-Z]/.test(v), /\d/.test(v), /[^\w\s]/.test(v)].filter(Boolean).length;
    box.className = `fv-strength ${n <= 1 ? 'weak' : n <= 3 ? 'fair' : ''}`;
    $$('i', box).forEach((i, k) => i.classList.toggle('on', k < n));
    $('span', box).textContent = v ? ['Weak', 'Weak', 'Fair', 'Good', 'Strong'][n] : '';
  },
};

/* ============================== events ============================== */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-tab],[data-go],[data-act]');
  if (!t || t.disabled) return;
  const nav = t.dataset.tab || t.dataset.go;
  if (nav) {
    e.preventDefault();
    const at = Date.now();   // ignore accidental double taps on navigation
    if (UI.lastNav && UI.lastNav.key === nav + (t.dataset.id || '') && at - UI.lastNav.at < 600) return;
    UI.lastNav = { key: nav + (t.dataset.id || ''), at };
    closeSheet();
    if (t.dataset.tab) goTab(t.dataset.tab); else go(t.dataset.go, { ...t.dataset });
    return;
  }
  const fn = ACTIONS[t.dataset.act];
  if (fn && !(t.type === 'radio' || t.type === 'checkbox')) { e.preventDefault(); fn(t, e); }
  else if (fn) fn(t, e);
});
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  FORMS[f.dataset.form](f);
});
// Unsaved-changes tracking: typing in a form on a form screen (not search boxes) marks it as changed.
const markDirty = el => {
  if (!el.closest || !el.closest('#view .content form') || el.matches('[data-live="appsSearch"]')) return;
  UI.dirty = true;
  if (el.closest('#wiz')) UI.wChanged = true;
};
document.addEventListener('input', e => { markDirty(e.target); });
document.addEventListener('change', e => { markDirty(e.target); });
document.addEventListener('input', e => { const el = e.target; if (el.matches('[data-live]') && el.type !== 'date' && el.tagName !== 'SELECT') LIVE[el.dataset.live](el); });
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.matches('input[type=file][data-doc]')) {
    const type = el.dataset.doc, items = await hashFiles(el);
    if (!items.length || !UI.w) return;
    collectWizard();
    UI.uploading[type] = true; render();
    try {
      const [meta] = await uploadAll(items.slice(0, 1));
      UI.w.docs[type] = { ...meta, validTill: '' }; UI.w.ai = null;
      toast(`Uploaded · SHA-256 ${meta.fileHash.slice(0, 8)}…`);
    } catch (err) { handleError(err); }
    finally { delete UI.uploading[type]; if (currentRoute() === 'wizard') render(); }
    return;
  }
  if (el.matches('input[type=file][data-attach]')) {
    const k = el.dataset.attach, items = await hashFiles(el);
    if (!items.length) return;
    if (k === 'fdrNew') UI.newFdr = readForm($('#fdrNewForm'));
    if (k === 'respond') UI.vals = readForm($('#respForm'));
    UI.uploading[k] = true; render();
    try {
      const metas = await uploadAll(k === 'fdrNew' ? items.slice(0, 1) : items);
      UI.attach[k] = k === 'fdrNew' ? metas : [...(UI.attach[k] || []), ...metas];
      UI.err = {};
      toast(`${metas.length} file(s) attached`);
    } catch (err) { handleError(err); }
    finally { delete UI.uploading[k]; render(); }
    return;
  }
  if (el.matches('[data-pref]')) { DB.prefs[el.dataset.pref] = el.checked; save(); toast(el.checked ? 'Notifications enabled' : 'Notifications muted', 'info'); return; }
  if (el.matches('[data-live]') && (el.type === 'date' || el.tagName === 'SELECT')) { LIVE[el.dataset.live](el); return; }
  if (el.name === 'declared' && UI.w) { UI.w.declared = el.checked; render(); }
});

// Connectivity: toggle the banner in place (no re-render, so typed input is never lost).
function paintOffline() {
  const bar = $('.offline-bar');
  if (UI.offline && !bar) $('#view').insertAdjacentHTML('afterbegin', `<div class="offline-bar" role="status">${ic('alert', 16)} You're offline${Backend.remote ? ' — changes can\'t be sent until you reconnect' : ''}.</div>`);
  if (!UI.offline && bar) bar.remove();
}
window.addEventListener('offline', () => { UI.offline = true; paintOffline(); });
window.addEventListener('online', () => {
  UI.offline = false; paintOffline(); toast('Back online');
  if (Backend.remote && me()) Backend.refresh().then(() => Backend.onRemoteChange()).catch(() => {});
});

const LIVE_ROUTES = ['dashboard', 'apps', 'appDetail', 'fdrs', 'fdrDetail', 'alerts', 'activity', 'compliance', 'tickets'];
Backend.onRemoteChange = () => {
  if (!me()) return;
  if (LIVE_ROUTES.includes(currentRoute()) && !$('#sheet').classList.contains('open') && !UI.pending) render();
  else $$('.tab-badge, .dot-badge').forEach(b => { b.textContent = unread() || ''; });
};
Backend.onAuthEvent = (event, info) => {
  if (event === 'PASSWORD_RECOVERY') openSheet('Set a new password', setPwBody());
  else if (event === 'AUTH_ERROR' && !me()) { UI.loginErr = (info && info.error) || 'Sign-in did not complete. Please try again.'; UI.loginTab = 'login'; if (currentRoute() === 'login') render(); }
  else if (event === 'SIGNED_OUT' && me() && !UI.loggingOut) sessionEnded('Your session has ended. Please sign in again.');
};

/* ============================== boot ============================== */
(async function init() {
  history.replaceState({}, '');
  if (Backend.remote) {
    UI.stack = [{ name: 'boot', params: {} }];
    render(true);
    try {
      const signedIn = await Backend.init();
      UI.stack = [{ name: signedIn ? 'dashboard' : (isOnboarded() ? 'login' : 'splash'), params: {} }];
    } catch (e) {
      const err = toApiError(e);
      if (err.code === 'REGISTRATION_REQUIRED') { await askRegistration(); return; }
      if (['ACCOUNT_PENDING', 'ACCOUNT_DISABLED', 'ROLE_MISMATCH', 'NO_PROFILE', 'SESSION_EXPIRED', 'NOT_AUTHENTICATED'].includes(err.code)) {
        if (Backend.sb) await Backend.sb.auth.signOut().catch(() => {});
        UI.loginErr = err.message;
        UI.stack = [{ name: 'login', params: {} }];
      } else UI.stack = [{ name: 'bootError', params: { message: err.message } }];
    }
    render(true);
    return;
  }
  if (DB.session && DB.session.remember === false && !sessionStorageHas()) { DB.session = null; save(); }
  const q = new URLSearchParams(location.search);
  const demo = { dits: 'user-inst-1', bce: 'user-inst-2', pat: 'user-inst-3' }[q.get('demo')];
  if (demo) { DB.session = { userId: demo, token: `aicte-jwt-${demo}-${Date.now()}`, at: now().toISOString(), method: 'DEMO_LINK', remember: true }; DB.acked[demo] = true; save(); markOnboarded(); }
  UI.stack = [{ name: me() ? 'dashboard' : (isOnboarded() ? 'login' : 'splash'), params: {} }];
  const screen = q.get('screen');
  if (screen && me() && V[screen]) {
    if (screen === 'wizard' || screen === 'ai' || screen === 'review') { UI.w = newWizard(q.get('type') || 'EOA'); UI.w.step = +(q.get('step') || 1); if (screen !== 'wizard') DOC_TYPES.filter(d => d.req).forEach(d => { UI.w.docs[d.type] = sampleDoc(d.type); }); if (screen === 'review') UI.w.ai = runValidation(UI.w); }
    if (q.get('tab')) UI.appTab = q.get('tab');
    const roots = ['dashboard', 'apps', 'fdrs', 'alerts', 'profile'];
    if (roots.includes(screen)) UI.stack = [{ name: screen, params: {} }];
    else UI.stack.push({ name: screen, params: Object.fromEntries(q) });
  }
  render(true);
  try { sessionStorage.setItem('aicte-live', '1'); } catch (e) { /* ignore */ }
})();
function sessionStorageHas() { try { return sessionStorage.getItem('aicte-live') === '1'; } catch (e) { return false; } }
