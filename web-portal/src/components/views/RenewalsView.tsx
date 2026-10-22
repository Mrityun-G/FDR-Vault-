/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * RenewalsView - FDR renewal & replacement requests (filed by institutions in the mobile app)
 * and deposits nearing maturity without a renewal on file.
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { FdrRecord, FdrRequest } from '../../types';
import { RefreshCw, Clock, CheckCircle2, X, Lock } from 'lucide-react';
import { FdrRequestDecisionModal, RequestSummary } from './FdrRequestDecision';

export const RenewalsView: React.FC = () => {
  const { fdrRecords, currentUser } = useApp();
  const isAdmin = currentUser.role === 'ADMIN';
  const [decision, setDecision] = useState<{ fdr: FdrRecord; request: FdrRequest; approve: boolean } | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const pending = fdrRecords.filter(f => f.pendingRequest && f.pendingRequest.kind !== 'RELEASE');
  const expiringWithoutRequest = fdrRecords.filter(f => f.status === 'EXPIRING_SOON' && !f.pendingRequest);
  const decided = fdrRecords
    .flatMap(f => (f.requests || []).filter(r => r.kind !== 'RELEASE' && r.status !== 'PENDING').map(r => ({ f, r })))
    .sort((a, b) => (b.r.decidedAt || '').localeCompare(a.r.decidedAt || ''))
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">FDR Renewals & Replacement Center</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Institutions file renewals and replacements from the mobile app. An AICTE administrator approves or rejects them here.
              </p>
            </div>
          </div>
          <div className="flex gap-2 text-xs font-mono font-bold">
            <span className="bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-lg">{pending.length} awaiting decision</span>
            <span className="bg-rose-50 text-rose-900 border border-rose-200 px-3 py-1.5 rounded-lg">{expiringWithoutRequest.length} expiring, none filed</span>
          </div>
        </div>
      </div>

      {successMsg && (
        <div role="status" className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Requests awaiting a decision</h2>
        {pending.length === 0 && (
          <p className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">No renewal or replacement requests are pending.</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pending.map(fdr => {
            const req = fdr.pendingRequest!;
            return (
              <div key={req.id} className="bg-white p-5 rounded-xl border border-amber-200 shadow-2xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{fdr.institutionName}</h3>
                    <p className="text-[11px] text-slate-500">
                      PID {fdr.pid} • {fdr.bankName} • {fdr.amountFormatted}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">{req.kind}</span>
                </div>
                <RequestSummary fdr={fdr} request={req} />
                {isAdmin ? (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setDecision({ fdr, request: req, approve: true })}
                      className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs cursor-pointer"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setDecision({ fdr, request: req, approve: false })}
                      className="flex-1 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold rounded-lg text-xs cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" /> An AICTE administrator decides this request.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Maturing within 180 days with no renewal filed</h2>
        {expiringWithoutRequest.length === 0 && (
          <p className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">Every maturing deposit has a request on file.</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {expiringWithoutRequest.map(fdr => (
            <div key={fdr.id} className="bg-white p-4 rounded-xl border border-rose-200 shadow-2xs text-xs space-y-1.5">
              <div className="flex justify-between gap-2">
                <span className="font-mono font-bold text-slate-900">{fdr.fdrNumber}</span>
                <span className="text-[10px] font-bold text-rose-700 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {fdr.maturityDate}
                </span>
              </div>
              <p className="font-bold text-slate-900">{fdr.institutionName}</p>
              <p className="text-slate-500">
                {fdr.amountFormatted} • {fdr.bankName}
              </p>
              <p className="text-[10px] text-slate-400">The institution receives automatic reminders 180, 60 and 30 days before maturity.</p>
            </div>
          ))}
        </div>
      </section>

      {decided.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <h2 className="text-sm font-bold text-slate-900 p-4 border-b border-slate-200">Recent decisions</h2>
          <div className="divide-y divide-slate-100 text-xs">
            {decided.map(({ f, r }) => (
              <div key={r.id} className="p-3 flex justify-between gap-3">
                <span>
                  <strong>{r.kind}</strong> • {f.fdrNumber} • {f.institutionName}
                  {r.decisionNote && <span className="block text-[11px] text-slate-500">{r.decisionNote}</span>}
                </span>
                <span className={`font-bold shrink-0 ${r.status === 'APPROVED' ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {r.status} {r.decidedBy && <span className="block text-[10px] font-normal text-slate-500">{r.decidedBy}</span>}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {decision && (
        <FdrRequestDecisionModal
          fdr={decision.fdr}
          request={decision.request}
          approve={decision.approve}
          onClose={() => setDecision(null)}
          onDone={setSuccessMsg}
        />
      )}
    </div>
  );
};
