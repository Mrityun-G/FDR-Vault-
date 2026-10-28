/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * ReportsView - regulatory reports from live records (services/reports.ts), with filters and CSV export.
 * Every figure is computed from the records the signed-in user may read; nothing is estimated or hard-coded.
 */

import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { buildReports, toCsv, Report, LIEN_CONFIRMATION_LABEL } from '../../services/reports';
import { LienConfirmation } from '../../types';
import { BarChart3, Download, Search } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const PREVIEW_ROWS = 100;
const SOURCES: LienConfirmation[] = ['BANK_OFFICIAL', 'AICTE_RECORDED', 'UNRECORDED', 'DEMO_SIMULATED', 'PENDING'];

function download(r: Report) {
  const url = URL.createObjectURL(new Blob(['﻿' + toCsv(r)], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `AICTE_${r.id}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const ReportsView: React.FC = () => {
  const { applications, fdrRecords } = useApp();
  const [search, setSearch] = useState('');
  const [bank, setBank] = useState('');
  const [selected, setSelected] = useState<Report['id']>('pending-verification');

  const banks = useMemo(() => [...new Set(fdrRecords.map(f => f.bankName))].sort(), [fdrRecords]);
  const reports = useMemo(() => buildReports(applications, fdrRecords, { search, bank }), [applications, fdrRecords, search, bank]);
  const report = reports.find(r => r.id === selected) || reports[0];
  const lienData = useMemo(() => {
    const q = search.trim().toLowerCase();
    const live = fdrRecords.filter(f => f.status !== 'RELEASED' && (!bank || f.bankName === bank) &&
      (!q || f.institutionName.toLowerCase().includes(q) || f.pid.toLowerCase().includes(q)));
    return SOURCES.map(s => ({ name: LIEN_CONFIRMATION_LABEL[s], count: live.filter(f => f.lienConfirmation === s).length })).filter(d => d.count);
  }, [fdrRecords, bank, search]);

  const downloadAll = () => reports.forEach((r, i) => setTimeout(() => download(r), i * 400));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Reports</h1>
              <p className="text-xs text-slate-500 mt-0.5">Built from the current records you can access. Filter, preview, and export each report as CSV.</p>
            </div>
          </div>
          <button
            onClick={downloadAll}
            className="px-4 py-2 bg-brand hover:brightness-110 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4" />
            Download all reports (CSV)
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 mt-5 pt-5 border-t border-slate-100 text-xs">
          <label className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by institution name or PID"
              aria-label="Filter by institution name or PID"
              className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-md"
            />
          </label>
          <select value={bank} onChange={e => setBank(e.target.value)} aria-label="Filter by bank" className="px-3 py-2 border border-slate-300 rounded-md bg-white">
            <option value="">All banks</option>
            {banks.map(b => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </div>
        {bank && <p className="text-[11px] text-slate-500 mt-2">A bank filter shows deposit reports only; application reports are not tied to a bank.</p>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {reports.map(r => (
          <button
            key={r.id}
            onClick={() => setSelected(r.id)}
            aria-pressed={r.id === report.id}
            className={`text-left p-4 rounded-xl border bg-white cursor-pointer transition-colors ${r.id === report.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'}`}
          >
            <span className="block text-[11px] font-semibold text-slate-500">{r.title}</span>
            <span className="block text-2xl font-extrabold text-slate-900 mt-1">{r.rows.length}</span>
            <span className="block text-[10px] text-slate-400">{r.rows.length === 1 ? 'row' : 'rows'}</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{report.title}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{report.description}</p>
          </div>
          <button
            onClick={() => download(report)}
            className="px-3 py-2 border border-slate-300 bg-white hover:bg-slate-50 font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
        {report.rows.length === 0 ? (
          <p className="p-6 text-center text-xs text-slate-500">Nothing to report.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {report.headers.map(h => (
                    <th key={h} className="text-left font-semibold px-3 py-2 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                  <tr key={i} className="align-top">
                    {row.map((c, j) => (
                      <td key={j} className="px-3 py-2 text-slate-800 max-w-xs">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {report.rows.length > PREVIEW_ROWS && (
              <p className="p-3 text-[11px] text-slate-500 border-t border-slate-100">
                Showing {PREVIEW_ROWS} of {report.rows.length} rows. The CSV export has all of them.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <h3 className="text-sm font-bold text-slate-900 mb-1">Joint lien confirmation (deposits not released)</h3>
        <p className="text-xs text-slate-500 mb-4">Only “Confirmed by the bank” is a confirmation by a bank official of that bank.</p>
        {lienData.length === 0 ? (
          <p className="text-xs text-slate-500">No deposits.</p>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lienData} layout="vertical" margin={{ top: 0, right: 16, left: 16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={230} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Deposits" fill="#1a56db" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
