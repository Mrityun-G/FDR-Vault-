/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * DashboardView - Executive Government Dashboard with 5 KPI Cards, Charts & Recent Activity
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Landmark,
  CheckCircle2,
  Clock,
  Award,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
  FileText,
  Calendar,
  Filter,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Building2,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { FdrStatus, FdrRecord } from '../types';

export const DashboardView: React.FC = () => {
  const {
    currentUser,
    fdrRecords,
    auditLogs,
    setActiveSidebarTab,
    globalSearchQuery
  } = useApp();

  const [expiryRange, setExpiryRange] = useState<'6M' | '12M'>('6M');

  // Filter FDR records by global search if active
  const filteredFdrs = useMemo(() => {
    if (!globalSearchQuery.trim()) return fdrRecords;
    const q = globalSearchQuery.toLowerCase();
    return fdrRecords.filter(
      f =>
        f.fdrNumber.toLowerCase().includes(q) ||
        f.institutionName.toLowerCase().includes(q) ||
        f.pid.toLowerCase().includes(q) ||
        f.bankName.toLowerCase().includes(q)
    );
  }, [fdrRecords, globalSearchQuery]);

  // Calculations for Summary Cards
  const totalFdrCount = filteredFdrs.length;
  const activeCount = filteredFdrs.filter(f => f.status === 'ACTIVE').length;
  const expiringCount = filteredFdrs.filter(f => f.status === 'EXPIRING_SOON').length;
  const maturedCount = filteredFdrs.filter(f => f.status === 'MATURED').length;
  const pendingCount = filteredFdrs.filter(f => f.status === 'UNDER_VERIFICATION').length;
  const releasedCount = filteredFdrs.filter(f => f.status === 'RELEASED').length;

  const totalCorpusLakhs = filteredFdrs.reduce((acc, f) => acc + f.amountLakhs, 0);
  const totalCorpusCrores = (totalCorpusLakhs / 100).toFixed(2);

  const activePercent = totalFdrCount > 0 ? ((activeCount / totalFdrCount) * 100).toFixed(1) : '0';

  // Section 5: Donut Chart Data (FDR Status Overview)
  const donutData = useMemo(() => {
    const raw = [
      { name: 'Active', value: activeCount, color: '#10b981' },
      { name: 'Expiring Soon', value: expiringCount, color: '#f59e0b' },
      { name: 'Matured', value: maturedCount, color: '#8b5cf6' },
      { name: 'Under Verification', value: pendingCount, color: '#06b6d4' },
      { name: 'Released', value: releasedCount, color: '#64748b' }
    ];
    return raw.filter(d => d.value > 0);
  }, [activeCount, expiringCount, maturedCount, pendingCount, releasedCount]);

  // Section 6: Expiry Trend Bar Chart Data (Actual Next 6 Months from real records)
  const barChartData = useMemo(() => {
    // The coming 6 or 12 calendar months, starting next month.
    const now = new Date();
    const months = Array.from({ length: expiryRange === '6M' ? 6 : 12 }, (_, k) => {
      const d = new Date(now.getFullYear(), now.getMonth() + 1 + k, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-IN', expiryRange === '6M' ? { month: 'short', year: 'numeric' } : { month: 'short', year: '2-digit' });
      return { key, label };
    });

    return months.map(m => {
      // Find matching FDRs whose maturity date starts with YYYY-MM
      const matched = filteredFdrs.filter(f => f.maturityDate && f.maturityDate.startsWith(m.key));
      const count = matched.length;
      const totalAmountLakhs = matched.reduce((acc, curr) => acc + curr.amountLakhs, 0);

      return {
        month: m.label,
        count,
        amountLakhs: totalAmountLakhs,
        formattedAmount: totalAmountLakhs > 0 ? `₹ ${(totalAmountLakhs / 100).toFixed(2)} Cr` : '₹ 0'
      };
    });
  }, [filteredFdrs, expiryRange]);

  // Section 7: Recent Activity Data
  const recentActivities = useMemo(() => {
    return auditLogs.slice(0, 6);
  }, [auditLogs]);

  return (
    <div className="space-y-6">
      {/* Page Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Security Deposit / FDR Overview
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Council surveillance of institutional corpus deposits under irrevocable joint lien (APH Chapter VI)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setActiveSidebarTab('fdr_records')}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            View Ledger
          </button>
          <button
            onClick={() => setActiveSidebarTab('verification_center')}
            className="px-3.5 py-2 text-xs font-bold text-white bg-[#1a56db] hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Verification Center
          </button>
        </div>
      </div>

      {/* SECTION 4: FIVE SUMMARY CARDS IN ONE ROW ON DESKTOP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total FDRs */}
        <div
          onClick={() => setActiveSidebarTab('fdr_records')}
          className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-blue-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total FDRs
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{totalFdrCount}</span>
            <span className="text-[11px] font-semibold text-blue-700">Records</span>
          </div>
          <p className="text-[11px] font-medium text-slate-500 mt-1.5 truncate">
            ₹ {totalCorpusCrores} Cr Secured Corpus
          </p>
        </div>

        {/* Card 2: Active */}
        <div
          onClick={() => setActiveSidebarTab('fdr_records')}
          className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-emerald-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Active
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{activeCount}</span>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
              {activePercent}%
            </span>
          </div>
          <p className="text-[11px] font-medium text-emerald-700 mt-1.5 truncate">
            Irrevocable Joint Lien Active
          </p>
        </div>

        {/* Card 3: Expiring Soon */}
        <div
          onClick={() => setActiveSidebarTab('renewals')}
          className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-amber-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Expiring Soon
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-700">{expiringCount}</span>
            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
              ≤ 180 Days
            </span>
          </div>
          <p className="text-[11px] font-medium text-amber-700 mt-1.5 truncate">
            Action: Issue Renewal Notice
          </p>
        </div>

        {/* Card 4: Matured */}
        <div
          onClick={() => setActiveSidebarTab('release_requests')}
          className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-purple-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Matured
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{maturedCount}</span>
            <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-1.5 py-0.2 rounded">
              10-Yr Met
            </span>
          </div>
          <p className="text-[11px] font-medium text-purple-700 mt-1.5 truncate">
            Eligible for Discharge / Release
          </p>
        </div>

        {/* Card 5: Pending Verification */}
        <div
          onClick={() => setActiveSidebarTab('verification_center')}
          className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-cyan-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Pending Verification
            </span>
            <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-cyan-800">{pendingCount}</span>
            <span className="text-[10px] font-bold text-cyan-800 bg-cyan-100 px-1.5 py-0.2 rounded">
              Awaiting CBS
            </span>
          </div>
          <p className="text-[11px] font-medium text-cyan-800 mt-1.5 truncate">
            Bank Endorsement Required
          </p>
        </div>
      </div>

      {/* SECTIONS 5 & 6: TWO CHARTS SIDE BY SIDE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT CHART: FDR Status Overview (Donut Chart - 5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">FDR Status Overview</h3>
                <p className="text-[11px] text-slate-500">Categorical breakdown of deposit states</p>
              </div>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                Total: {totalFdrCount}
              </span>
            </div>

            {/* Donut Chart with Centered Total */}
            <div className="relative h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={92}
                    paddingAngle={3}
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      `${val} FDRs (${((Number(val) / totalFdrCount) * 100).toFixed(1)}%)`,
                      name
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Centered Total Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-extrabold text-slate-900 leading-none">
                  {totalFdrCount}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                  Total FDRs
                </span>
              </div>
            </div>
          </div>

          {/* Legend with Status Names, Counts & Percentages */}
          <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between p-1.5 bg-slate-50 rounded">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                  <span className="text-slate-600 text-[11px]">Active</span>
                </div>
                <span className="font-bold text-slate-900 text-[11px]">
                  {activeCount} ({totalFdrCount > 0 ? ((activeCount / totalFdrCount) * 100).toFixed(0) : 0}%)
                </span>
              </div>

              <div className="flex items-center justify-between p-1.5 bg-slate-50 rounded">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                  <span className="text-slate-600 text-[11px]">Expiring Soon</span>
                </div>
                <span className="font-bold text-slate-900 text-[11px]">
                  {expiringCount} ({totalFdrCount > 0 ? ((expiringCount / totalFdrCount) * 100).toFixed(0) : 0}%)
                </span>
              </div>

              <div className="flex items-center justify-between p-1.5 bg-slate-50 rounded">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6]" />
                  <span className="text-slate-600 text-[11px]">Matured</span>
                </div>
                <span className="font-bold text-slate-900 text-[11px]">
                  {maturedCount} ({totalFdrCount > 0 ? ((maturedCount / totalFdrCount) * 100).toFixed(0) : 0}%)
                </span>
              </div>

              <div className="flex items-center justify-between p-1.5 bg-slate-50 rounded">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#06b6d4]" />
                  <span className="text-slate-600 text-[11px]">Under Verif.</span>
                </div>
                <span className="font-bold text-slate-900 text-[11px]">
                  {pendingCount} ({totalFdrCount > 0 ? ((pendingCount / totalFdrCount) * 100).toFixed(0) : 0}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT CHART: Expiry Trend Chart (Bar Chart - 7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">FDR Expiry Schedule</h3>
                <p className="text-[11px] text-slate-500">Maturity distribution over upcoming regulatory horizon</p>
              </div>

              {/* Date-Range Filter */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  onClick={() => setExpiryRange('6M')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    expiryRange === '6M'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Next 6 Months
                </button>
                <button
                  onClick={() => setExpiryRange('12M')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    expiryRange === '12M'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Next 12 Months
                </button>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    label={{ value: 'Maturing FDRs', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#94a3b8' } }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-2.5 rounded-lg shadow-lg text-xs space-y-1">
                            <p className="font-bold text-amber-300">{data.month}</p>
                            <p className="text-slate-200">
                              Maturing Deposits: <strong className="text-white">{data.count} FDRs</strong>
                            </p>
                            <p className="text-slate-300 text-[11px]">
                              Value: <strong className="text-emerald-400">{data.formattedAmount}</strong>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#1a56db"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              Institutions must submit renewal receipts 60 days prior to certificate maturity.
            </span>
            <button
              onClick={() => setActiveSidebarTab('renewals')}
              className="text-[#1a56db] font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              Manage Renewals <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 7: RECENT ACTIVITY PANEL */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-900">Recent Regulatory Activity</h3>
          </div>
          <button
            onClick={() => setActiveSidebarTab('audit_trail')}
            className="text-xs font-semibold text-[#1a56db] hover:underline cursor-pointer flex items-center gap-1"
          >
            View Full Audit Trail <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {recentActivities.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No recent activity records found.
            </div>
          ) : (
            recentActivities.map(event => (
              <div
                key={event.id}
                className="p-3.5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      event.action.includes('LOGIN')
                        ? 'bg-blue-50 text-blue-700'
                        : event.action.includes('ENDORSE') || event.action.includes('VERIF')
                        ? 'bg-emerald-50 text-emerald-700'
                        : event.action.includes('DEFIC') || event.action.includes('COLLISION')
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{event.action.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                        {event.correlationId}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{event.details}</p>
                  </div>
                </div>

                <div className="sm:text-right shrink-0 pl-10 sm:pl-0">
                  <span className="text-[11px] font-semibold text-slate-800 block">
                    {event.actorName} ({event.actorRole})
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(event.timestamp).toLocaleTimeString()} • {new Date(event.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
