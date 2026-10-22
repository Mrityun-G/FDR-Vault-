/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * ReleaseRequestsView - FDR Joint Lien Release & Security Deposit Refund Requests
 * (requests are filed by institutions in the mobile app after the lock-in matures)
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { FdrRecord, FdrRequest } from '../../types';
import { ArrowUpRightSquare, CheckCircle2, ShieldCheck, X, Lock } from 'lucide-react';
import { FdrRequestDecisionModal, RequestSummary } from './FdrRequestDecision';

export const ReleaseRequestsView: React.FC = () => {
  const { fdrRecords, currentUser } = useApp();
  const isAdmin = currentUser.role === 'ADMIN';
  const [decision, setDecision] = useState<{ fdr: FdrRecord; request: FdrRequest; approve: boolean } | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const pending = fdrRecords.filter(f => f.pendingRequest?.kind === 'RELEASE');
  const maturedNoRequest = fdrRecords.filter(f => f.status === 'MATURED' && !f.pendingRequest);
  const released = fdrRecords.filter(f => f.status === 'RELEASED');

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
              <ArrowUpRightSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Security Deposit (FDR) Lien Release & Refund Desk</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Discharge of the AICTE joint lien after the lock-in period (APH Clause 6.4). Institutions apply from the mobile app.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-purple-50 text-purple-900 border border-purple-200 px-3 py-1.5 rounded-lg">
            {pending.length} release request(s) pending
          </span>
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Release requests awaiting a decision</h3>
          <span className="text-xs text-slate-500">Requires AICTE administrator approval</span>
        </div>
        <div className="divide-y divide-slate-100 text-xs">
          {pending.length === 0 && <p className="p-6 text-center text-slate-500">No release requests are pending.</p>}
          {pending.map(fdr => {
            const req = fdr.pendingRequest!;
            return (
              <div key={req.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-sm">{fdr.fdrNumber}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">Release pending</span>
                    <span className="text-[10px] font-mono text-slate-400">PID: {fdr.pid}</span>
                  </div>
                  <p className="font-bold text-slate-900">{fdr.institutionName}</p>
                  <p className="text-[11px] text-slate-500">
                    Principal: <strong className="text-blue-900">{fdr.amountFormatted}</strong> • {fdr.bankName} ({fdr.branchName}) • Matured {fdr.maturityDate}
                  </p>
                  <RequestSummary fdr={fdr} request={req} />
                </div>
                {isAdmin ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setDecision({ fdr, request: req, approve: true })}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Grant Release Decree
                    </button>
                    <button
                      onClick={() => setDecision({ fdr, request: req, approve: false })}
                      className="px-4 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold rounded-lg text-xs cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-500 flex items-center gap-1.5 shrink-0">
                    <Lock className="w-3.5 h-3.5" /> Administrator decision
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <h3 className="text-sm font-bold text-slate-900 p-4 border-b border-slate-200">Matured, no release requested</h3>
          <div className="divide-y divide-slate-100 text-xs">
            {maturedNoRequest.length === 0 && <p className="p-4 text-slate-500">None.</p>}
            {maturedNoRequest.map(f => (
              <div key={f.id} className="p-3">
                <span className="font-mono font-bold">{f.fdrNumber}</span> • {f.institutionName}
                <span className="block text-[11px] text-slate-500">
                  {f.amountFormatted} • matured {f.maturityDate}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <h3 className="text-sm font-bold text-slate-900 p-4 border-b border-slate-200">Lien discharged</h3>
          <div className="divide-y divide-slate-100 text-xs">
            {released.length === 0 && <p className="p-4 text-slate-500">None yet.</p>}
            {released.map(f => (
              <div key={f.id} className="p-3">
                <span className="font-mono font-bold">{f.fdrNumber}</span> • {f.institutionName}
                {f.releaseRequest?.approvedBy && (
                  <span className="block text-[11px] text-emerald-800">
                    Approved by {f.releaseRequest.approvedBy}
                    {f.releaseRequest.approvedAt && <> on {new Date(f.releaseRequest.approvedAt).toLocaleDateString()}</>}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

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
