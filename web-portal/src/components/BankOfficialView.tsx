/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * Bank Official Portal View - FDR Verification & CBS Joint Lien Endorsement
 * Bank officials see only deposits held with their bank (enforced by row-level security).
 */

import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatRupees } from '../services/backend';
import { Landmark, ShieldCheck, Search, CheckCircle2, AlertTriangle, RefreshCw, FileText, Lock } from 'lucide-react';

export const BankOfficialView: React.FC = () => {
  const { currentUser, fdrRecords, endorseLien } = useApp();
  const canEndorse = currentUser.role === 'BANK_OFFICIAL' || currentUser.role === 'ADMIN';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const records = fdrRecords.filter(f => f.status !== 'RELEASED');
  const q = searchQuery.toLowerCase();
  const filteredFdrs = records.filter(
    f => f.institutionName.toLowerCase().includes(q) || f.fdrNumber.toLowerCase().includes(q) || f.pid.toLowerCase().includes(q)
  );
  const activeRecord = records.find(f => f.id === selectedId) || filteredFdrs.find(f => !f.isLienConfirmed) || filteredFdrs[0] || null;

  useEffect(() => {
    setToken('');
    setError(null);
  }, [activeRecord?.id]);

  const endorsed = records.filter(f => f.isLienConfirmed);
  const corpus = records.reduce((sum, f) => sum + f.amountLakhs * 1e5, 0);

  const handleEndorseLien = async () => {
    if (!activeRecord) return;
    setIsVerifying(true);
    setError(null);
    try {
      await endorseLien(activeRecord.id, token.trim());
      setFlash(`Joint lien on ${activeRecord.fdrNumber} recorded. The institution has been notified.`);
      setToken('');
    } catch (e: any) {
      setError(e.message || 'The endorsement was not recorded.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 shadow-xs">
              <Landmark className="w-6 h-6 text-blue-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Bank Official FDR Verification Portal</h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">
                  {currentUser.role === 'BANK_OFFICIAL' ? currentUser.bankName : 'All banks (AICTE view)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Chapter VI security deposits under irrevocable joint lien with AICTE. Endorse a lien only after checking the deposit in your
                Core Banking System.
              </p>
            </div>
          </div>
          <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
            <span className="text-slate-500">Official: </span>
            <strong>{currentUser.name}</strong>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 mt-5 border-t border-slate-100">
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <p className="text-[11px] text-slate-500 font-semibold uppercase">FDR Records</p>
            <p className="text-xl font-extrabold text-slate-900 mt-1">{records.length}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Under AICTE joint lien</p>
          </div>
          <div className="bg-emerald-50/70 p-3.5 rounded-lg border border-emerald-200">
            <p className="text-[11px] text-emerald-900 font-semibold uppercase">Lien Endorsed</p>
            <p className="text-xl font-extrabold text-emerald-900 mt-1">{endorsed.length}</p>
            <p className="text-[10px] text-emerald-700 mt-0.5">Confirmed in CBS</p>
          </div>
          <div className="bg-amber-50/70 p-3.5 rounded-lg border border-amber-200">
            <p className="text-[11px] text-amber-900 font-semibold uppercase">Pending Endorsement</p>
            <p className="text-xl font-extrabold text-amber-900 mt-1">{records.length - endorsed.length}</p>
            <p className="text-[10px] text-amber-700 mt-0.5">Awaiting bank confirmation</p>
          </div>
          <div className="bg-blue-50/70 p-3.5 rounded-lg border border-blue-200">
            <p className="text-[11px] text-blue-900 font-semibold uppercase">Corpus Secured</p>
            <p className="text-sm font-extrabold text-blue-900 mt-1">{formatRupees(corpus)}</p>
          </div>
        </div>
      </div>

      {flash && (
        <div role="status" className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs flex items-center justify-between">
          <span>{flash}</span>
          <button onClick={() => setFlash(null)} className="font-bold" aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-700" />
              Institutional Security Deposits (FDR)
            </h3>
            <span className="text-[10px] font-mono text-slate-500">{filteredFdrs.length} Records</span>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search FDR Number, Institution, PID..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
            />
          </div>
          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredFdrs.length === 0 && <p className="text-xs text-slate-500 text-center py-6">No deposits found.</p>}
            {filteredFdrs.map(record => (
              <div
                key={record.id}
                onClick={() => setSelectedId(record.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  activeRecord?.id === record.id ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-500/30 shadow-xs' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono font-bold text-xs text-blue-950">{record.fdrNumber}</span>
                    <h4 className="text-xs font-bold text-slate-900 mt-0.5">{record.institutionName}</h4>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      record.isLienConfirmed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {record.isLienConfirmed ? 'Lien Endorsed' : 'Pending'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-200/60 text-[11px] text-slate-600">
                  <div>
                    Amount: <strong className="text-slate-900">{record.amountFormatted}</strong>
                  </div>
                  <div className="text-right">
                    {record.bankName}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7">
          {activeRecord ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  Core Banking Joint Lien Inspector
                </h3>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Ref: {activeRecord.applicationNumber}</span>
              </div>

              <div className="border border-slate-200 bg-slate-50/50 rounded-xl p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 gap-2">
                  <span className="font-bold text-slate-800 text-sm">{activeRecord.institutionName}</span>
                  <span className="font-mono text-xs font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded">{activeRecord.fdrNumber}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Permanent Institute ID</span>
                    <span className="font-bold text-slate-900">{activeRecord.pid}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Security Deposit Value</span>
                    <span className="font-extrabold text-blue-950 text-sm">{activeRecord.amountFormatted}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Issue Date</span>
                    <span className="text-slate-800 font-medium">{activeRecord.issueDate}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Maturity Date ({activeRecord.tenureYears}-Yr Lock-in)</span>
                    <span className="text-slate-800 font-bold">{activeRecord.maturityDate}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[11px] text-slate-500 block">Bank Branch & IFSC</span>
                    <span className="text-slate-800">
                      {activeRecord.bankName}, {activeRecord.branchName} (IFSC: {activeRecord.ifscCode})
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[11px] text-slate-500 block">Mandatory Joint Lien Covenant</span>
                    <span className="font-bold text-emerald-950">Jointly held with {activeRecord.jointLienHolder}. Non-encashable without an AICTE release decree.</span>
                  </div>
                </div>
              </div>

              {activeRecord.isLienConfirmed ? (
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between text-emerald-950 font-bold gap-2">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      Irrevocable Joint Lien Confirmed in CBS Ledger
                    </div>
                    <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">Token: {activeRecord.lienEndorsementToken}</span>
                  </div>
                  {activeRecord.lienEndorsedAt && (
                    <p className="text-[10px] text-slate-500 font-mono pt-1 border-t border-emerald-200">
                      Endorsed at: {new Date(activeRecord.lienEndorsedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : canEndorse ? (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                    Pending Bank Official Lien Endorsement
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    Check the deposit against your CBS ledger, mark the lien in CBS, then enter the CBS lien reference below.
                  </p>
                  <input
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    placeholder="CBS lien reference, e.g. CBS-SBI-LIEN-2026-00123"
                    aria-label="CBS lien reference"
                    className="w-full px-3 py-2 border border-amber-300 rounded-md font-mono bg-white"
                  />
                  {error && <p className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800">{error}</p>}
                  <button
                    onClick={handleEndorseLien}
                    disabled={isVerifying || token.trim().length < 6}
                    className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {isVerifying ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Recording lien…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Confirm & Endorse Joint Lien with AICTE
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center gap-2">
                  <Lock className="w-4 h-4" /> Awaiting the bank's CBS endorsement. Only bank officials and AICTE administrators can record it.
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs text-slate-500">
              No deposits are held with {currentUser.bankName || 'this bank'} yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
