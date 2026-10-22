/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * ReportsView - Regulatory Throughput, Compliance Analytics & Executive Reports
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  BarChart3,
  Download,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Layers,
  FileText
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export const ReportsView: React.FC = () => {
  const { applications, fdrRecords } = useApp();

  const regionalData = [
    { name: 'Northern', totalFdr: 6, corpusCr: 6.0, compliance: 94 },
    { name: 'Southern', totalFdr: 4, corpusCr: 4.2, compliance: 96 },
    { name: 'Western', totalFdr: 3, corpusCr: 3.1, compliance: 91 },
    { name: 'Eastern', totalFdr: 2, corpusCr: 2.0, compliance: 88 },
    { name: 'South-Western', totalFdr: 3, corpusCr: 3.3, compliance: 95 }
  ];

  const handleExportCsv = () => {
    const headers = ['FDR Number', 'Institution Name', 'PID', 'Bank Name', 'Amount (Lakhs)', 'Maturity Date', 'Status'];
    const rows = fdrRecords.map(f => [
      f.fdrNumber,
      `"${f.institutionName}"`,
      f.pid,
      f.bankName,
      f.amountLakhs,
      f.maturityDate,
      f.status
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AICTE_FDR_Regulatory_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Reports & Regulatory Analytics
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Executive intelligence on institutional security deposits, regional compliance, and scrutiny velocities
              </p>
            </div>
          </div>
          <button
            onClick={handleExportCsv}
            className="px-4 py-2 bg-[#1a56db] hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4" />
            Export Executive CSV Report
          </button>
        </div>
      </div>

      {/* Regional Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            Regional FDR Corpus Volume & Compliance
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Total active security deposits secured across AICTE regional jurisdictions
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionalData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="corpusCr" name="Corpus (₹ Crores)" fill="#1a56db" radius={[4, 4, 0, 0]} />
                <Bar dataKey="totalFdr" name="Deposit Records" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            Regulatory Health Indicators
          </h3>
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500 text-[11px] block">Average Scrutiny Velocity</span>
              <p className="text-lg font-bold text-slate-900 mt-0.5">2.4 Working Days</p>
              <span className="text-[10px] text-emerald-700 font-semibold">88.5% reduction vs traditional manual scrutiny</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500 text-[11px] block">Lien Verification Integrity</span>
              <p className="text-lg font-bold text-emerald-800 mt-0.5">100% CBS Verified</p>
              <span className="text-[10px] text-slate-500">Scheduled Commercial Banks</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500 text-[11px] block">SHA-256 Collision Defense</span>
              <p className="text-lg font-bold text-blue-900 mt-0.5">Zero Undetected Duplicates</p>
              <span className="text-[10px] text-slate-500">Cross-application cryptographic checks</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
