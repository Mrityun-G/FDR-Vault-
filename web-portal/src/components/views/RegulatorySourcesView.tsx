/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * RegulatorySourcesView - the sources and document requirements behind the institution app's Regulatory Assistant.
 * Administrators maintain them; scrutiny officers can read them. A requirement is only as strong as its source:
 * VERIFIED and PORTAL_RULE requirements can block a submission, UNVERIFIED / OUTDATED ones are shown for human confirmation.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { actions, loadRegulatoryCatalog, toApiError } from '../../services/backend';
import { DocumentRequirement, RegulatorySource, SourceStatus } from '../../types';
import { BookCheck, Pencil, Plus, RefreshCw, X } from 'lucide-react';

const STATUS: Record<SourceStatus, { label: string; cls: string }> = {
  VERIFIED: { label: 'Verified', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  PORTAL_RULE: { label: 'Portal rule', cls: 'bg-blue-50 text-blue-800 border-blue-200' },
  UNVERIFIED: { label: 'Unverified', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  OUTDATED: { label: 'Outdated', cls: 'bg-rose-50 text-rose-800 border-rose-200' }
};
const WORKFLOWS: Record<string, string> = {
  NEW_FDR: 'New FDR', RENEW_FDR: 'Renewal', REPLACE_FDR: 'Replacement', RELEASE_FDR: 'Lien release',
  CORRECT_FDR: 'Correction', RESPOND_DEFICIENCY: 'Compliance reply', OTHER: 'Other'
};
const DOC_TYPES = ['FDR_CORPUS', 'BANK_LETTER', 'AFFIDAVIT', 'OTHER'];

const Badge: React.FC<{ status: SourceStatus }> = ({ status }) => (
  <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${STATUS[status]?.cls || ''}`}>{STATUS[status]?.label || status}</span>
);
const input = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200';
const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <label className="block text-xs font-semibold text-slate-600 space-y-1">
    <span>{label}</span>
    {children}
    {hint && <span className="block font-normal text-slate-500">{hint}</span>}
  </label>
);

const EMPTY_SOURCE: RegulatorySource = { id: '', title: '', issuingAuthority: 'All India Council for Technical Education', url: '', section: '', effectiveDate: '', status: 'UNVERIFIED', excerpt: '', notes: '' };
const EMPTY_REQ: DocumentRequirement = { workflow: 'NEW_FDR', docKey: '', docType: 'OTHER', name: '', purpose: '', requiredFields: [], applicability: 'CONDITIONAL', condition: '', conditionLabel: '', sourceId: '', version: '2026.2', effectiveFrom: '', effectiveTo: '', active: true };

export const RegulatorySourcesView: React.FC = () => {
  const { currentUser } = useApp();
  const isAdmin = currentUser.role === 'ADMIN';
  const [sources, setSources] = useState<RegulatorySource[]>([]);
  const [reqs, setReqs] = useState<DocumentRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [editSource, setEditSource] = useState<{ value: RegulatorySource; isNew: boolean } | null>(null);
  const [editReq, setEditReq] = useState<{ value: DocumentRequirement; isNew: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const c = await loadRegulatoryCatalog(); setSources(c.sources); setReqs(c.requirements); }
    catch (e) { setError(toApiError(e).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true); setFormError(null);
    try { await fn(); setEditSource(null); setEditReq(null); setFlash(done); await load(); }
    catch (e) { setFormError(toApiError(e).message); }
    finally { setBusy(false); }
  };
  const sourceOf = (id: string) => sources.find(s => s.id === id);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><BookCheck className="w-5 h-5 text-indigo-600" /> Regulatory Sources</h1>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            The documents the institution app's Regulatory Assistant asks for, and the source behind each one. Only <b>Verified</b> and <b>Portal rule</b> requirements
            can block a submission; <b>Unverified</b> or <b>Outdated</b> ones are shown to institutions as needing confirmation from AICTE.
          </p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border border-slate-300 rounded-lg bg-white hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>
      {flash && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex justify-between">{flash}<button onClick={() => setFlash(null)} aria-label="Dismiss"><X className="w-4 h-4" /></button></div>}
      {error && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800">{error}</div>}
      {!isAdmin && <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600">Read-only: only administrators can change sources and requirements.</div>}

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">Sources</h2>
          {isAdmin && <button onClick={() => { setFormError(null); setEditSource({ value: { ...EMPTY_SOURCE }, isNew: true }); }} className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700"><Plus className="w-4 h-4" /> Add source</button>}
        </div>
        {loading ? <div className="p-5 text-sm text-slate-500">Loading…</div> : (
          <ul className="divide-y divide-slate-100">
            {sources.map(s => (
              <li key={s.id} className="px-5 py-4 flex flex-wrap gap-3 justify-between">
                <div className="min-w-0 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-900">{s.title}</span><Badge status={s.status} /><span className="text-[11px] font-mono text-slate-500">{s.id}</span></div>
                  <div className="text-xs text-slate-600 mt-1">{s.issuingAuthority}{s.section && ` · ${s.section}`}{s.effectiveDate && ` · effective ${s.effectiveDate}`}</div>
                  {s.excerpt && <blockquote className="text-xs text-slate-700 mt-2 border-l-2 border-slate-300 pl-2 italic">{s.excerpt}</blockquote>}
                  {s.notes && <div className="text-xs text-slate-500 mt-1">{s.notes}</div>}
                  {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-700 underline">{s.url}</a>}
                  {s.verifiedBy && <div className="text-[11px] text-emerald-700 mt-1">Verified by {s.verifiedBy}{s.verifiedAt && ` on ${new Date(s.verifiedAt).toLocaleDateString('en-IN')}`}</div>}
                </div>
                {isAdmin && <button onClick={() => { setFormError(null); setEditSource({ value: { ...s }, isNew: false }); }} className="self-start inline-flex items-center gap-1 text-sm font-semibold text-indigo-700"><Pencil className="w-4 h-4" /> Edit</button>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">Document requirements</h2>
          {isAdmin && <button onClick={() => { setFormError(null); setEditReq({ value: { ...EMPTY_REQ, sourceId: sources[0]?.id || '' }, isNew: true }); }} className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700"><Plus className="w-4 h-4" /> Add requirement</button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-600"><tr>
              <th className="px-4 py-2">Request</th><th className="px-4 py-2">Document</th><th className="px-4 py-2">Applies</th><th className="px-4 py-2">Source</th><th className="px-4 py-2">Version</th><th className="px-4 py-2">Status</th>{isAdmin && <th />}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {reqs.map(r => {
                const src = sourceOf(r.sourceId);
                return (
                  <tr key={`${r.workflow}/${r.docKey}/${r.version}`} className={r.active ? '' : 'opacity-60'}>
                    <td className="px-4 py-2 whitespace-nowrap">{WORKFLOWS[r.workflow] || r.workflow}</td>
                    <td className="px-4 py-2"><div className="font-semibold text-slate-800">{r.name}</div><div className="text-[11px] font-mono text-slate-500">{r.docKey} · {r.docType}</div></td>
                    <td className="px-4 py-2 text-xs">{r.applicability === 'MANDATORY' ? 'Mandatory' : 'Conditional'}{r.condition && <div className="text-slate-500">{r.conditionLabel || r.condition}</div>}</td>
                    <td className="px-4 py-2 text-xs">{src ? <><div>{src.title}</div><Badge status={src.status} /></> : r.sourceId}</td>
                    <td className="px-4 py-2 text-xs whitespace-nowrap">v{r.version}{r.effectiveFrom && <div className="text-slate-500">from {r.effectiveFrom}</div>}{r.effectiveTo && <div className="text-slate-500">to {r.effectiveTo}</div>}</td>
                    <td className="px-4 py-2 text-xs">{r.active ? 'Active' : 'Inactive'}</td>
                    {isAdmin && <td className="px-4 py-2"><button onClick={() => { setFormError(null); setEditReq({ value: { ...r }, isNew: false }); }} className="text-indigo-700" aria-label={`Edit ${r.name}`}><Pencil className="w-4 h-4" /></button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {editSource && (
        <Modal title={editSource.isNew ? 'Add source' : `Edit ${editSource.value.id}`} onClose={() => setEditSource(null)}>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Source id" hint="e.g. SRC-CIRCULAR-2026-14"><input className={input} value={editSource.value.id} disabled={!editSource.isNew} onChange={e => setEditSource({ ...editSource, value: { ...editSource.value, id: e.target.value.toUpperCase() } })} /></Field>
            <Field label="Status"><select className={input} value={editSource.value.status} onChange={e => setEditSource({ ...editSource, value: { ...editSource.value, status: e.target.value as SourceStatus } })}>
              {(Object.keys(STATUS) as SourceStatus[]).map(k => <option key={k} value={k}>{STATUS[k].label}</option>)}</select></Field>
            <div className="sm:col-span-2"><Field label="Title"><input className={input} value={editSource.value.title} onChange={e => setEditSource({ ...editSource, value: { ...editSource.value, title: e.target.value } })} /></Field></div>
            <Field label="Issuing authority"><input className={input} value={editSource.value.issuingAuthority} onChange={e => setEditSource({ ...editSource, value: { ...editSource.value, issuingAuthority: e.target.value } })} /></Field>
            <Field label="Effective date"><input type="date" className={input} value={editSource.value.effectiveDate} onChange={e => setEditSource({ ...editSource, value: { ...editSource.value, effectiveDate: e.target.value } })} /></Field>
            <div className="sm:col-span-2"><Field label="Official link (https)"><input className={input} value={editSource.value.url} onChange={e => setEditSource({ ...editSource, value: { ...editSource.value, url: e.target.value } })} /></Field></div>
            <Field label="Section / page" hint="Required to mark the source Verified."><input className={input} value={editSource.value.section} onChange={e => setEditSource({ ...editSource, value: { ...editSource.value, section: e.target.value } })} /></Field>
            <Field label="Notes"><input className={input} value={editSource.value.notes} onChange={e => setEditSource({ ...editSource, value: { ...editSource.value, notes: e.target.value } })} /></Field>
            <div className="sm:col-span-2"><Field label="Relevant excerpt" hint="Copy the exact wording from the official document. Required to mark the source Verified.">
              <textarea rows={4} className={input} value={editSource.value.excerpt} onChange={e => setEditSource({ ...editSource, value: { ...editSource.value, excerpt: e.target.value } })} /></Field></div>
          </div>
          {formError && <div className="mt-3 text-sm text-rose-700">{formError}</div>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setEditSource(null)} className="px-4 py-2 text-sm font-semibold border border-slate-300 rounded-lg">Cancel</button>
            <button disabled={busy} onClick={() => save(() => actions.saveRegulatorySource(editSource.value), 'Source saved.')} className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white disabled:opacity-60">Save</button>
          </div>
        </Modal>
      )}

      {editReq && (
        <Modal title={editReq.isNew ? 'Add requirement' : `Edit ${editReq.value.name}`} onClose={() => setEditReq(null)}>
          <p className="text-xs text-slate-600 mb-3">To change a requirement for the future, add it with a new version and an effective date, and set an end date on the old one.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Request"><select className={input} value={editReq.value.workflow} disabled={!editReq.isNew} onChange={e => setEditReq({ ...editReq, value: { ...editReq.value, workflow: e.target.value } })}>
              {Object.entries(WORKFLOWS).filter(([k]) => k !== 'RESPOND_DEFICIENCY').map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            <Field label="Document key" hint="Capital letters, e.g. BANK_LIEN_LETTER"><input className={input} value={editReq.value.docKey} disabled={!editReq.isNew} onChange={e => setEditReq({ ...editReq, value: { ...editReq.value, docKey: e.target.value.toUpperCase() } })} /></Field>
            <div className="sm:col-span-2"><Field label="Name"><input className={input} value={editReq.value.name} onChange={e => setEditReq({ ...editReq, value: { ...editReq.value, name: e.target.value } })} /></Field></div>
            <div className="sm:col-span-2"><Field label="Why it is required"><input className={input} value={editReq.value.purpose} onChange={e => setEditReq({ ...editReq, value: { ...editReq.value, purpose: e.target.value } })} /></Field></div>
            <div className="sm:col-span-2"><Field label="What it must show" hint="Separate items with commas."><input className={input} value={editReq.value.requiredFields.join(', ')} onChange={e => setEditReq({ ...editReq, value: { ...editReq.value, requiredFields: e.target.value.split(',').map(x => x.trim()).filter(Boolean) } })} /></Field></div>
            <Field label="Document type" hint="FDR_CORPUS documents are checked as deposit advices."><select className={input} value={editReq.value.docType} onChange={e => setEditReq({ ...editReq, value: { ...editReq.value, docType: e.target.value } })}>{DOC_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Applies"><select className={input} value={editReq.value.applicability} onChange={e => setEditReq({ ...editReq, value: { ...editReq.value, applicability: e.target.value as DocumentRequirement['applicability'] } })}><option value="MANDATORY">Mandatory</option><option value="CONDITIONAL">Conditional</option></select></Field>
            <Field label="Condition" hint="always, or answer=value, e.g. lienMarked=yes"><input className={input} value={editReq.value.condition} onChange={e => setEditReq({ ...editReq, value: { ...editReq.value, condition: e.target.value } })} /></Field>
            <Field label="Condition in words"><input className={input} value={editReq.value.conditionLabel} onChange={e => setEditReq({ ...editReq, value: { ...editReq.value, conditionLabel: e.target.value } })} /></Field>
            <Field label="Source"><select className={input} value={editReq.value.sourceId} onChange={e => setEditReq({ ...editReq, value: { ...editReq.value, sourceId: e.target.value } })}>{sources.map(s => <option key={s.id} value={s.id}>{s.title} ({STATUS[s.status].label})</option>)}</select></Field>
            <Field label="Version"><input className={input} value={editReq.value.version} disabled={!editReq.isNew} onChange={e => setEditReq({ ...editReq, value: { ...editReq.value, version: e.target.value } })} /></Field>
            <Field label="Effective from"><input type="date" className={input} value={editReq.value.effectiveFrom} onChange={e => setEditReq({ ...editReq, value: { ...editReq.value, effectiveFrom: e.target.value } })} /></Field>
            <Field label="Effective to"><input type="date" className={input} value={editReq.value.effectiveTo} onChange={e => setEditReq({ ...editReq, value: { ...editReq.value, effectiveTo: e.target.value } })} /></Field>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={editReq.value.active} onChange={e => setEditReq({ ...editReq, value: { ...editReq.value, active: e.target.checked } })} /> Active</label>
          </div>
          {formError && <div className="mt-3 text-sm text-rose-700">{formError}</div>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setEditReq(null)} className="px-4 py-2 text-sm font-semibold border border-slate-300 rounded-lg">Cancel</button>
            <button disabled={busy} onClick={() => save(() => actions.saveDocumentRequirement(editReq.value), 'Requirement saved.')} className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white disabled:opacity-60">Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label={title}>
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-5 mt-8">
      <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-slate-900">{title}</h3><button onClick={onClose} aria-label="Close"><X className="w-5 h-5" /></button></div>
      {children}
    </div>
  </div>
);
