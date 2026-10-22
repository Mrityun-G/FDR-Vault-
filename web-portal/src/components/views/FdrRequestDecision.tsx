/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * Shared pieces for FDR requests filed by institutions (renewal, replacement, lien release):
 * a summary of what was requested and the administrator's approve / reject dialog.
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatRupees } from '../../services/backend';
import { FdrRecord, FdrRequest } from '../../types';
import { X } from 'lucide-react';

export const RequestSummary: React.FC<{ fdr: FdrRecord; request: FdrRequest }> = ({ fdr, request }) => {
  const p = request.payload || {};
  return (
    <div className="text-[11px] text-slate-700 space-y-0.5">
      <p>
        Filed {new Date(request.requestedAt).toLocaleString()} for <strong className="font-mono">{fdr.fdrNumber}</strong>
      </p>
      {request.kind === 'RELEASE' && request.reason && <p className="italic">“{request.reason}”</p>}
      {request.kind !== 'RELEASE' && p.maturityDate && (
        <p>
          Proposed maturity: <strong>{p.maturityDate}</strong> (current {fdr.maturityDate})
        </p>
      )}
      {request.kind === 'REPLACEMENT' && (
        <p>
          New deposit: <strong className="font-mono">{String(p.fdrNumber || '').toUpperCase()}</strong> • {p.bankName}, {p.branchName} (IFSC{' '}
          {String(p.ifscCode || '').toUpperCase()}) • {p.amount ? formatRupees(Number(p.amount)) : '—'}
        </p>
      )}
      {request.kind === 'RENEWAL' && p.token && (
        <p>
          Bank renewal reference: <span className="font-mono">{p.token}</span>
        </p>
      )}
    </div>
  );
};

interface DecisionProps {
  fdr: FdrRecord;
  request: FdrRequest;
  approve: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}

export const FdrRequestDecisionModal: React.FC<DecisionProps> = ({ fdr, request, approve, onClose, onDone }) => {
  const { decideFdrRequest } = useApp();
  const [note, setNote] = useState(
    approve
      ? request.kind === 'RELEASE'
        ? 'Lock-in completed with no outstanding student or regulatory liabilities. Joint lien discharge approved; bank may release the deposit.'
        : 'Bank evidence verified. Request approved; the joint lien continues on the updated deposit.'
      : ''
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await decideFdrRequest(request.id, approve, note.trim());
      onDone(`${request.kind.charAt(0) + request.kind.slice(1).toLowerCase()} request for ${fdr.fdrNumber} ${approve ? 'approved' : 'rejected'}. The institution has been notified.`);
      onClose();
    } catch (e: any) {
      setError(e.message || 'The decision was not recorded.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h3 className="text-base font-bold text-slate-900">
            {approve ? 'Approve' : 'Reject'} {request.kind.toLowerCase()} request
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <p className="font-bold text-slate-900">{fdr.institutionName}</p>
            <p className="font-extrabold text-blue-900">{fdr.amountFormatted}</p>
            <RequestSummary fdr={fdr} request={request} />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Decision note (shared with the institution)</label>
            <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md text-xs" />
          </div>
          {approve && request.kind === 'REPLACEMENT' && (
            <p className="p-2.5 bg-blue-50 border border-blue-200 rounded text-blue-950 text-[11px]">
              Approving replaces the deposit on record. The new deposit then needs its own CBS lien endorsement by the bank.
            </p>
          )}
          {error && <p className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-md font-semibold text-slate-700">
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || (!approve && note.trim().length < 10)}
              className={`px-4 py-2 text-white font-bold rounded-md disabled:opacity-50 ${approve ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-rose-700 hover:bg-rose-800'}`}
            >
              {busy ? 'Recording…' : approve ? 'Approve request' : 'Reject request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
