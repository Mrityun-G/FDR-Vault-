/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * FdrRecordsView - Master FDR Ledger & Security Deposit Management
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { FdrStatus, FdrRecord } from '../../types';
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Award,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  ChevronRight,
  Download,
  Landmark,
  X,
  FileCheck2
} from 'lucide-react';

export const FdrRecordsView: React.FC = () => {
  const { fdrRecords, globalSearchQuery, endorseLien, currentUser } = useApp();
  const canEndorse = currentUser.role === 'BANK_OFFICIAL' || currentUser.role === 'ADMIN';
  const [lienToken, setLienToken] = useState('');
  const [endorsing, setEndorsing] = useState(false);
  const [endorseError, setEndorseError] = useState<string | null>(null);
  const banks = useMemo(() => Array.from(new Set(fdrRecords.map(f => f.bankName))).sort(), [fdrRecords]);

  const [search, setSearch] = useState(globalSearchQuery || '');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedBank, setSelectedBank] = useState<string>('ALL');
  const [inspectFdr, setInspectFdr] = useState<FdrRecord | null>(null);

  const filteredFdrs = useMemo(() => {
    return fdrRecords.filter(f => {
      const q = search.toLowerCase();
      const matchesSearch =
        f.fdrNumber.toLowerCase().includes(q) ||
        f.institutionName.toLowerCase().includes(q) ||
        f.pid.toLowerCase().includes(q) ||
        f.bankName.toLowerCase().includes(q);
      const matchesStatus = selectedStatus === 'ALL' || f.status === selectedStatus;
      const matchesBank = selectedBank === 'ALL' || f.bankName.includes(selectedBank);
      return matchesSearch && matchesStatus && matchesBank;
    });
  }, [fdrRecords, search, selectedStatus, selectedBank]);

  const getStatusBadge = (status: FdrStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
            Active (Lien Secured)
          </span>
        );
      case 'EXPIRING_SOON':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <Clock className="w-3 h-3 text-amber-700" />
            Expiring Soon
          </span>
        );
      case 'MATURED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
            <Award className="w-3 h-3 text-purple-700" />
            Matured (10-Yr Met)
          </span>
        );
      case 'UNDER_VERIFICATION':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-900 border border-cyan-300">
            <ShieldAlert className="w-3 h-3 text-cyan-700" />
            Under Verification
          </span>
        );
      case 'RELEASED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
            Lien Released
          </span>
        );
    }
  };

  const handleEndorseQuick = async (fdr: FdrRecord) => {
    setEndorsing(true);
    setEndorseError(null);
    try {
      await endorseLien(fdr.id, lienToken.trim());
      setLienToken('');
      setInspectFdr(null);
    } catch (e: any) {
      setEndorseError(e.message || 'The endorsement was not recorded.');
    } finally {
      setEndorsing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Master Security Deposit (FDR) Ledger
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Statutory register of institutional Fixed Deposit Receipts under irrevocable AICTE joint lien
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200">
            {filteredFdrs.length} of {fdrRecords.length} Records
          </span>
        </div>
      </div>

      {/* Filter Toolbar & Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search FDR number, institute, PID..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="text-xs p-1.5 bg-white border border-slate-300 rounded-md"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active (Lien Secured)</option>
              <option value="EXPIRING_SOON">Expiring Soon (≤ 180 Days)</option>
              <option value="MATURED">Matured (10-Yr Met)</option>
              <option value="UNDER_VERIFICATION">Under Verification</option>
              <option value="RELEASED">Lien Released</option>
            </select>

            <select
              value={selectedBank}
              onChange={e => setSelectedBank(e.target.value)}
              className="text-xs p-1.5 bg-white border border-slate-300 rounded-md"
            >
              <option value="ALL">All Banks</option>
              {banks.map(b => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-200">
            <thead className="bg-slate-100/70 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-2.5">FDR Number & App</th>
                <th className="px-4 py-2.5">Institution & PID</th>
                <th className="px-4 py-2.5">Deposit Amount</th>
                <th className="px-4 py-2.5">Bank & Branch</th>
                <th className="px-4 py-2.5">Maturity Date</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredFdrs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No FDR records match.
                  </td>
                </tr>
              )}
              {filteredFdrs.map(fdr => (
                <tr key={fdr.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">
                    {fdr.fdrNumber}
                    <span className="block font-sans text-[10px] text-slate-400 font-normal mt-0.5">
                      {fdr.applicationNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900">{fdr.institutionName}</p>
                    <p className="text-[11px] font-mono text-slate-500">PID: {fdr.pid}</p>
                  </td>
                  <td className="px-4 py-3 font-extrabold text-blue-900 text-xs">
                    {fdr.amountFormatted}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{fdr.bankName}</p>
                    <p className="text-[10px] text-slate-400 truncate max-w-xs">{fdr.branchName}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-slate-800">{fdr.maturityDate}</span>
                    <span className="block text-[10px] text-slate-400">Tenure: {fdr.tenureYears} Years</span>
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(fdr.status)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setInspectFdr(fdr);
                        setLienToken('');
                        setEndorseError(null);
                      }}
                      className="text-[#1a56db] hover:underline font-bold flex items-center justify-end gap-1 cursor-pointer"
                    >
                      Inspect <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Modal */}
      {inspectFdr && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-blue-50/60">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-blue-700" />
                <h3 className="text-base font-bold text-slate-900">
                  Fixed Deposit Advice & Lien Certificate
                </h3>
              </div>
              <button onClick={() => setInspectFdr(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">FDR Certificate Number</span>
                  <p className="text-sm font-mono font-bold text-blue-950">{inspectFdr.fdrNumber}</p>
                </div>
                {getStatusBadge(inspectFdr.status)}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Institution</span>
                  <strong className="text-slate-900">{inspectFdr.institutionName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Permanent Institute ID</span>
                  <strong className="font-mono text-slate-900">{inspectFdr.pid}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Principal Deposit Amount</span>
                  <strong className="text-sm font-extrabold text-blue-900">{inspectFdr.amountFormatted}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Deposit Horizon & Maturity</span>
                  <strong className="text-slate-900">
                    {inspectFdr.issueDate} to {inspectFdr.maturityDate} ({inspectFdr.tenureYears} Years)
                  </strong>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 block text-[11px]">Issuing Commercial Bank & Branch</span>
                  <p className="text-slate-800">{inspectFdr.bankName} • {inspectFdr.branchName} (IFSC: {inspectFdr.ifscCode})</p>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 block text-[11px]">Irrevocable Joint Lien Covenant</span>
                  <p className="font-semibold text-emerald-950 bg-emerald-50 p-2 rounded border border-emerald-200">
                    Jointly pledged in favour of: <strong>{inspectFdr.jointLienHolder}</strong>. Non-encashable without council release decree.
                  </p>
                </div>
              </div>

              {inspectFdr.isLienConfirmed ? (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded text-emerald-900 text-xs flex justify-between items-center">
                  <div>
                    <span className="font-bold block">CBS Joint Lien Confirmed</span>
                    <span className="font-mono text-[10px] text-emerald-800">Token: {inspectFdr.lienEndorsementToken || 'CBS-AUTH-VERIFIED'}</span>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded text-amber-900 text-xs space-y-2">
                  <div>
                    <span className="font-bold block">Awaiting Bank CBS Endorsement</span>
                    <span className="text-[10px] text-amber-800">
                      {canEndorse
                        ? 'Enter the CBS lien reference after marking the lien in Core Banking.'
                        : 'The bank official records the lien from the bank desk.'}
                    </span>
                  </div>
                  {canEndorse && (
                    <div className="flex gap-2">
                      <input
                        value={lienToken}
                        onChange={e => setLienToken(e.target.value)}
                        placeholder="CBS lien reference"
                        aria-label="CBS lien reference"
                        className="flex-1 px-2 py-1.5 border border-amber-300 rounded font-mono bg-white"
                      />
                      <button
                        onClick={() => handleEndorseQuick(inspectFdr)}
                        disabled={endorsing || lienToken.trim().length < 6}
                        className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded text-xs cursor-pointer disabled:opacity-60"
                      >
                        {endorsing ? 'Recording…' : 'Confirm Lien'}
                      </button>
                    </div>
                  )}
                  {endorseError && <p className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800">{endorseError}</p>}
                </div>
              )}

              {(inspectFdr.requests?.length || 0) > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-700">Requests from the institution</span>
                  {inspectFdr.requests!.map(r => (
                    <div key={r.id} className="p-2 bg-slate-50 border border-slate-200 rounded flex justify-between gap-2">
                      <span>
                        <strong>{r.kind}</strong> • {new Date(r.requestedAt).toLocaleDateString()}
                        {r.reason && <> • {r.reason}</>}
                      </span>
                      <span
                        className={`font-bold ${r.status === 'PENDING' ? 'text-amber-700' : r.status === 'APPROVED' ? 'text-emerald-700' : 'text-rose-700'}`}
                      >
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInspectFdr(null)}
                  className="px-4 py-2 border border-slate-300 rounded-md font-semibold text-slate-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
