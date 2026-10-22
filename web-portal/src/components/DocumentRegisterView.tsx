/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * Uploaded Document Register — every document institutions filed from the mobile app, with the
 * server's forensic checks and the advisory AI reading. Originals open through short-lived signed links.
 */

import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { actions } from '../services/backend';
import { DocumentEvidence, InstitutionApplication } from '../types';
import { FileText, Search, ShieldAlert, Sparkles, ExternalLink, CheckCircle2, AlertTriangle } from 'lucide-react';

type Row = { doc: DocumentEvidence; app: InstitutionApplication };

export const DocumentRegisterView: React.FC = () => {
  const { applications, setSelectedAppId, globalSearchQuery } = useApp();
  const [search, setSearch] = useState(globalSearchQuery || '');
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const rows: Row[] = useMemo(
    () =>
      applications
        .flatMap(app => app.documents.map(doc => ({ doc, app })))
        .sort((a, b) => b.doc.uploadedAt.localeCompare(a.doc.uploadedAt)),
    [applications]
  );

  const q = search.toLowerCase();
  const filtered = rows.filter(
    ({ doc, app }) =>
      (!onlyFlagged || doc.status === 'FLAGGED' || doc.forensics.sha256Match) &&
      (!q ||
        doc.fileName.toLowerCase().includes(q) ||
        doc.docType.toLowerCase().includes(q) ||
        app.institutionName.toLowerCase().includes(q) ||
        app.applicationNumber.toLowerCase().includes(q) ||
        doc.fileHash.startsWith(q))
  );
  const active = filtered.find(r => r.doc.id === selected) || filtered[0] || null;

  const openOriginal = async (doc: DocumentEvidence) => {
    if (!doc.storagePath) return;
    setOpening(doc.id);
    setOpenError(null);
    try {
      window.open(await actions.documentUrl(doc.storagePath), '_blank', 'noopener');
    } catch (e: any) {
      setOpenError(e.message);
    } finally {
      setOpening(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Uploaded Document Register</h1>
          <p className="text-xs text-slate-500 mt-1">
            Documents filed by institutions in the mobile app, with server-side SHA-256 duplicate checks and the advisory AI reading.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
            <strong>{rows.length}</strong> documents
          </span>
          <span className="px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900">
            <strong>{rows.filter(r => r.doc.status === 'FLAGGED' || r.doc.forensics.sha256Match).length}</strong> flagged
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3 border-b border-slate-200 bg-slate-50/60 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search file, type, institution, application or hash…"
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
              />
            </div>
            <label className="flex items-center gap-2 text-[11px] text-slate-600">
              <input type="checkbox" checked={onlyFlagged} onChange={e => setOnlyFlagged(e.target.checked)} /> Only flagged / duplicate documents
            </label>
          </div>
          <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
            {filtered.length === 0 && <p className="p-6 text-center text-xs text-slate-500">No documents match.</p>}
            {filtered.map(({ doc, app }) => {
              const flagged = doc.status === 'FLAGGED' || doc.forensics.sha256Match;
              return (
                <button
                  key={doc.id}
                  onClick={() => setSelected(doc.id)}
                  className={`w-full text-left p-3 text-xs transition-colors cursor-pointer ${active?.doc.id === doc.id ? 'bg-indigo-50/70' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-slate-900 break-all">{doc.fileName}</span>
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${flagged ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {flagged ? 'Flagged' : 'Processed'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {doc.docType.replace(/_/g, ' ')} • {app.institutionName} • {app.applicationNumber}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7">
          {active ? (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 text-xs">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 break-all">
                    <FileText className="w-4 h-4 text-indigo-700 shrink-0" /> {active.doc.fileName}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {active.doc.pageCount} page(s) • {(active.doc.fileSizeKb / 1024).toFixed(2)} MB • v{active.doc.version} • uploaded{' '}
                    {new Date(active.doc.uploadedAt).toLocaleString()}
                    {active.doc.validTill && <> • valid till {active.doc.validTill}</>}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {active.doc.storagePath ? (
                    <button
                      onClick={() => openOriginal(active.doc)}
                      disabled={opening === active.doc.id}
                      className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-md flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> {opening === active.doc.id ? 'Opening…' : 'Open original'}
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400">Demo record — no stored file</span>
                  )}
                  <button
                    onClick={() => setSelectedAppId(active.app.id)}
                    className="text-[11px] text-indigo-700 font-semibold hover:underline cursor-pointer"
                    title="Select this application in the Scrutiny Workbench"
                  >
                    {active.app.applicationNumber} →
                  </button>
                </div>
              </div>
              {openError && <p className="text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">{openError}</p>}

              <div className="font-mono text-[10px] text-slate-500 break-all">SHA-256: {active.doc.fileHash}</div>

              {active.doc.forensics.sha256Match ? (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <div>
                    <p className="font-bold">Duplicate document detected</p>
                    <p className="text-[11px]">
                      The same file was filed under {active.doc.forensics.duplicateApplicationId || 'another application'}
                      {active.doc.forensics.duplicateInstitutionName ? ` (${active.doc.forensics.duplicateInstitutionName})` : ''}.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> No SHA-256 collision with any other institution's filings.
                </div>
              )}

              {active.doc.forensics.remarks.length > 0 && (
                <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-slate-700">
                  {active.doc.forensics.remarks.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}

              {active.doc.extractedFields.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-800 mb-1.5">Extracted fields</h4>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {active.doc.extractedFields.map((f, i) => (
                      <div key={i} className={`p-2 border rounded ${f.isCoherent === false ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex justify-between text-[11px]">
                          <span className="font-bold text-slate-700 flex items-center gap-1">
                            {f.isCoherent === false && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                            {f.label}
                          </span>
                          {f.page > 0 && <span className="text-[10px] text-indigo-800">Page {f.page}</span>}
                        </div>
                        <p className="font-semibold text-slate-900">{f.value}</p>
                        {f.sourceLine && <p className="text-[10px] font-mono text-slate-500">"{f.sourceLine}"</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {active.doc.geminiAnalysis ? (
                <div className="p-3 bg-amber-50/70 border border-amber-300 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-950 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-700" /> AI advisory reading
                    </span>
                    <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1 rounded uppercase">{active.doc.geminiAnalysis.modelUsed}</span>
                  </div>
                  <p className="text-[11px] text-slate-700">{active.doc.geminiAnalysis.summary}</p>
                  {active.doc.geminiAnalysis.detectedAnomalies?.length > 0 && (
                    <ul className="list-disc pl-5 text-[11px] text-rose-800">
                      {active.doc.geminiAnalysis.detectedAnomalies.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[9px] text-slate-500 italic pt-1 border-t border-amber-200">{active.doc.geminiAnalysis.disclaimer}</p>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">No AI reading stored for this document.</p>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs text-slate-500">
              No documents have been uploaded yet. Institutions upload documents from the mobile app.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
