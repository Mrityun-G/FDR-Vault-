import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  FileText,
  Shield,
  Search,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  UserCheck,
  Hash,
  AlertCircle
} from 'lucide-react';
import { AuditEvent } from '../../types';

export const AuditTrailView: React.FC = () => {
  const { auditLogs, globalSearchQuery } = useApp();
  const [searchTerm, setSearchTerm] = useState(globalSearchQuery || '');
  const [selectedTargetType, setSelectedTargetType] = useState<string>('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditEvent | null>(null);

  const filteredLogs = auditLogs.filter(log => {
    const matchesTarget =
      selectedTargetType === 'ALL' || log.targetType === selectedTargetType;
    const query = (searchTerm || globalSearchQuery).toLowerCase();
    const matchesSearch =
      !query ||
      log.action.toLowerCase().includes(query) ||
      log.actorName.toLowerCase().includes(query) ||
      log.targetId.toLowerCase().includes(query) ||
      log.details.toLowerCase().includes(query) ||
      (log.sha256Hash && log.sha256Hash.toLowerCase().includes(query));

    return matchesTarget && matchesSearch;
  });

  const handleExportJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(auditLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `aicte_audit_trail_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Title & Statutory Integrity Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Statutory Regulatory Audit Ledger
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Cryptographically Verified (SHA-256)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Section 10(1) AICTE Act 1987 — Immutable, chronological activity record of all scrutinies, FDR endorsements, rule updates, and approvals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJson}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export Audit Ledger (JSON)
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Logged Events</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{auditLogs.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Chronologically ordered</div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Scrutiny & Decisions</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {auditLogs.filter(l => l.targetType === 'APPLICATION' || l.targetType === 'RECOMMENDATION').length}
          </div>
          <div className="text-[11px] text-emerald-600 mt-0.5">Officer accountability tracked</div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Document & CBS Verifications</span>
            <FileText className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {auditLogs.filter(l => l.targetType === 'DOCUMENT' || l.targetType === 'AUTHORITY_ADAPTER').length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Evidence & external cross-checks</div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Regulatory Engine Events</span>
            <Shield className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {auditLogs.filter(l => l.targetType === 'RULE').length}
          </div>
          <div className="text-[11px] text-amber-600 mt-0.5">APH v2026.1 parameter shifts</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search action, officer, ID, proof hash..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-500">Target Type:</span>
          <select
            value={selectedTargetType}
            onChange={e => setSelectedTargetType(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">All Categories ({auditLogs.length})</option>
            <option value="APPLICATION">Application</option>
            <option value="DOCUMENT">Document</option>
            <option value="RULE">Rule</option>
            <option value="AUTHORITY_ADAPTER">Authority Adapter</option>
            <option value="RECOMMENDATION">Recommendation</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
              <tr>
                <th className="py-3 px-4">Timestamp (IST)</th>
                <th className="py-3 px-4">Action & Details</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Target Category</th>
                <th className="py-3 px-4">Target ID</th>
                <th className="py-3 px-4">Cryptographic Hash</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No matching audit ledger entries found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-4 max-w-sm">
                      <div className="font-semibold text-slate-800">{log.action}</div>
                      <div className="text-slate-500 text-[11px] truncate mt-0.5">{log.details}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-800">{log.actorName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">UID: {log.actorId}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {log.targetType}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-600 text-[11px]">
                      {log.targetId}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[10px] text-slate-400">
                      {log.sha256Hash ? (
                        <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          {log.sha256Hash.substring(0, 14)}...
                        </span>
                      ) : (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-xs hover:underline"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Event Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">Audit Trail Entry Inspection</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">Event ID & Action</span>
                <p className="font-mono text-slate-800 font-bold text-sm mt-0.5">{selectedLog.action}</p>
                <p className="font-mono text-slate-400 text-[10px]">ID: {selectedLog.id}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-400 text-[10px] block">Actor</span>
                  <span className="font-semibold text-slate-800">{selectedLog.actorName}</span>
                  <span className="text-slate-400 text-[10px] block">({selectedLog.actorId})</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">Timestamp</span>
                  <span className="font-mono text-slate-700">
                    {new Date(selectedLog.timestamp).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">Target Entity</span>
                <p className="text-slate-700 mt-0.5">
                  Type: <strong className="font-semibold text-slate-900">{selectedLog.targetType}</strong> | Entity ID: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">{selectedLog.targetId}</code>
                </p>
              </div>

              <div>
                <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">Statutory Event Details</span>
                <div className="mt-1 p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                  {selectedLog.details}
                </div>
              </div>

              {selectedLog.sha256Hash && (
                <div>
                  <span className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold flex items-center gap-1">
                    <Hash className="w-3 h-3 text-blue-600" />
                    Cryptographic Proof Signature (SHA-256)
                  </span>
                  <div className="mt-1 p-2 bg-blue-50/50 border border-blue-200 rounded-lg text-blue-900 font-mono text-[10px] break-all select-all">
                    {selectedLog.sha256Hash}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
