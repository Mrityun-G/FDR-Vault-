/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * Live command dashboard for AICTE officers and administrators.
 * Every figure, list and button is driven by the shared Supabase data and updates in realtime.
 */

import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useApp } from '../context/AppContext';
import { formatRupees } from '../services/backend';
import { CountUp, LiveDot, RotatingText, Ticker, TickerItem, rise, stagger, useTimeAgo } from './fx';
import {
  Landmark,
  CheckCircle2,
  Clock,
  ShieldAlert,
  FileText,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Inbox,
  Search,
  AlertTriangle,
  Award,
  Send,
  Sparkles,
  ArrowRight,
  PartyPopper,
  History,
  XCircle
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { SidebarTab } from '../types';

const crore = (rupees: number) => `₹ ${(rupees / 1e7).toFixed(2)} Cr`;

type Work = { id: string; tone: 'info' | 'warning' | 'critical' | 'success'; title: string; detail: string; cta: string; go: () => void; at: string };

const TONE_STYLE: Record<Work['tone'], string> = {
  info: 'from-sky-500 to-indigo-500',
  warning: 'from-amber-500 to-orange-500',
  critical: 'from-rose-500 to-pink-500',
  success: 'from-emerald-500 to-teal-500'
};

export const DashboardView: React.FC = () => {
  const {
    currentUser,
    applications,
    fdrRecords,
    auditLogs,
    notifications,
    setActiveSidebarTab,
    globalSearchQuery,
    refresh,
    loading,
    lastSyncedAt,
    openApplication,
    openQueue
  } = useApp();
  const synced = useTimeAgo(lastSyncedAt);
  const isAdmin = currentUser.role === 'ADMIN';
  const [expiryRange, setExpiryRange] = useState<'6M' | '12M'>('6M');

  /* ------------------------------------------------------------ live figures */

  const q = globalSearchQuery.trim().toLowerCase();
  const fdrs = useMemo(
    () => (q ? fdrRecords.filter(f => [f.fdrNumber, f.institutionName, f.pid, f.bankName].some(v => v.toLowerCase().includes(q))) : fdrRecords),
    [fdrRecords, q]
  );
  const apps = useMemo(
    () => (q ? applications.filter(a => [a.applicationNumber, a.institutionName, a.pid].some(v => v.toLowerCase().includes(q))) : applications),
    [applications, q]
  );

  const count = (s: string) => apps.filter(a => a.status === s).length;
  const pipeline = [
    { status: 'SUBMITTED', label: 'New', hint: 'Awaiting pick-up', icon: Inbox, grad: 'from-sky-500 to-blue-600', n: count('SUBMITTED') },
    { status: 'UNDER_SCRUTINY', label: 'Under scrutiny', hint: 'Committee review', icon: Search, grad: 'from-indigo-500 to-violet-600', n: count('UNDER_SCRUTINY') },
    { status: 'DEFICIENCIES_NOTED', label: 'Deficiencies', hint: 'Waiting on institution', icon: AlertTriangle, grad: 'from-amber-500 to-orange-600', n: count('DEFICIENCIES_NOTED') },
    { status: 'SCRUTINY_CLEARED', label: 'Cleared', hint: 'Final approval due', icon: ShieldCheck, grad: 'from-fuchsia-500 to-purple-600', n: count('SCRUTINY_CLEARED') },
    { status: 'APPROVED', label: 'Approved', hint: 'EoA issued', icon: Award, grad: 'from-emerald-500 to-teal-600', n: count('APPROVED') }
  ];
  const rejected = count('REJECTED');
  const inPipeline = apps.length - count('APPROVED') - rejected;

  const live = fdrs.filter(f => f.status !== 'RELEASED');
  const corpus = live.reduce((s, f) => s + f.amountLakhs * 1e5, 0);
  const fdrCards: { label: string; value: number; sub: string; icon: React.FC<{ className?: string }>; grad: string; tab: SidebarTab; money?: boolean }[] = [
    { label: 'Corpus under lien', value: corpus, sub: `${live.length} live deposits`, icon: Landmark, grad: 'from-indigo-500 to-blue-600', tab: 'fdr_records', money: true },
    { label: 'Active', value: fdrs.filter(f => f.status === 'ACTIVE').length, sub: 'Joint lien confirmed', icon: CheckCircle2, grad: 'from-emerald-500 to-teal-600', tab: 'fdr_records' },
    { label: 'Expiring ≤ 180 days', value: fdrs.filter(f => f.status === 'EXPIRING_SOON').length, sub: 'Renewal due', icon: Clock, grad: 'from-amber-500 to-orange-600', tab: 'renewals' },
    { label: 'Awaiting bank lien', value: fdrs.filter(f => f.status === 'UNDER_VERIFICATION').length, sub: 'CBS endorsement', icon: ShieldAlert, grad: 'from-cyan-500 to-sky-600', tab: 'verification_center' },
    { label: 'Open FDR requests', value: fdrs.filter(f => f.pendingRequest).length, sub: 'Renewal / replacement / release', icon: Send, grad: 'from-fuchsia-500 to-pink-600', tab: 'renewals' }
  ];

  /* ------------------------------------------------------------ work queue */

  const work: Work[] = useMemo(() => {
    const out: Work[] = [];
    apps
      .filter(a => a.status === 'SUBMITTED')
      .forEach(a =>
        out.push({ id: `n-${a.id}`, tone: 'info', title: `New ${a.type.replace(/_/g, ' ').toLowerCase()} application`, detail: `${a.applicationNumber} • ${a.institutionName}`, cta: 'Start scrutiny', go: () => openApplication(a.id), at: a.submittedAt })
      );
    apps
      .filter(a => a.scrutinyRecommendation?.status === 'RESPONSE_SUBMITTED')
      .forEach(a =>
        out.push({ id: `r-${a.id}`, tone: 'warning', title: 'Compliance response received', detail: `${a.applicationNumber} • ${a.institutionName} (v${a.currentVersion})`, cta: 'Review response', go: () => openApplication(a.id), at: a.lastUpdatedAt })
      );
    if (isAdmin) {
      apps
        .filter(a => a.status === 'SCRUTINY_CLEARED')
        .forEach(a =>
          out.push({ id: `c-${a.id}`, tone: 'success', title: 'Ready for final approval', detail: `${a.applicationNumber} • ${a.institutionName}`, cta: 'Decide', go: () => openApplication(a.id), at: a.lastUpdatedAt })
        );
      fdrs
        .filter(f => f.pendingRequest)
        .forEach(f => {
          const r = f.pendingRequest!;
          out.push({
            id: `q-${r.id}`,
            tone: 'warning',
            title: `FDR ${r.kind.toLowerCase()} request`,
            detail: `${f.fdrNumber} • ${f.institutionName}`,
            cta: 'Review',
            go: () => setActiveSidebarTab(r.kind === 'RELEASE' ? 'release_requests' : 'renewals'),
            at: r.requestedAt
          });
        });
    }
    fdrs
      .filter(f => f.status === 'EXPIRING_SOON' && !f.pendingRequest && new Date(f.maturityDate).getTime() - Date.now() < 60 * 86400000)
      .forEach(f =>
        out.push({ id: `e-${f.id}`, tone: 'critical', title: 'Deposit matures within 60 days', detail: `${f.fdrNumber} • ${f.institutionName} • ${f.maturityDate}`, cta: 'Track', go: () => setActiveSidebarTab('renewals'), at: f.maturityDate })
      );
    return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  }, [apps, fdrs, isAdmin, openApplication, setActiveSidebarTab]);

  /* ------------------------------------------------------------ moving text */

  const facts = [
    `${crore(corpus)} secured under AICTE joint lien`,
    `${inPipeline} application${inPipeline === 1 ? '' : 's'} in the review pipeline`,
    `${work.length} item${work.length === 1 ? '' : 's'} need${work.length === 1 ? 's' : ''} your attention`,
    `${fdrs.filter(f => f.status === 'EXPIRING_SOON').length} deposit(s) maturing within 180 days`,
    `${count('APPROVED')} approval${count('APPROVED') === 1 ? '' : 's'} issued this cycle`
  ];

  const tickerItems: TickerItem[] = useMemo(() => {
    const fromNotifs: TickerItem[] = notifications.slice(0, 6).map(n => ({
      id: `n-${n.id}`,
      text: `${n.title} — ${n.message}`,
      tone: n.type === 'CRITICAL' ? 'critical' : n.type === 'WARNING' ? 'warning' : n.type === 'SUCCESS' ? 'success' : 'info',
      onClick: n.linkTab ? () => setActiveSidebarTab(n.linkTab as SidebarTab) : undefined
    }));
    const fromAudit: TickerItem[] = auditLogs.slice(0, 8).map(e => ({
      id: `a-${e.id}`,
      text: `${e.action.replace(/_/g, ' ')} · ${e.targetId || e.targetType} · ${e.actorName} · ${new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      tone: /REJECT|DEFICIEN|COLLISION|FAIL/.test(e.action) ? 'warning' : /APPROV|ENDORSE|SUCCESS|CLEARED/.test(e.action) ? 'success' : 'info',
      onClick: () => setActiveSidebarTab('audit_trail')
    }));
    return [...fromNotifs, ...fromAudit];
  }, [notifications, auditLogs, setActiveSidebarTab]);

  /* ------------------------------------------------------------ charts */

  const donut = [
    { name: 'Active', value: fdrs.filter(f => f.status === 'ACTIVE').length, color: '#10b981' },
    { name: 'Expiring Soon', value: fdrs.filter(f => f.status === 'EXPIRING_SOON').length, color: '#f59e0b' },
    { name: 'Matured', value: fdrs.filter(f => f.status === 'MATURED').length, color: '#a855f7' },
    { name: 'Awaiting lien', value: fdrs.filter(f => f.status === 'UNDER_VERIFICATION').length, color: '#06b6d4' },
    { name: 'Released', value: fdrs.filter(f => f.status === 'RELEASED').length, color: '#94a3b8' }
  ].filter(d => d.value > 0);

  const bars = useMemo(() => {
    const now = new Date();
    return Array.from({ length: expiryRange === '6M' ? 6 : 12 }, (_, k) => {
      const d = new Date(now.getFullYear(), now.getMonth() + 1 + k, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const matched = fdrs.filter(f => f.maturityDate?.startsWith(key));
      const amount = matched.reduce((s, f) => s + f.amountLakhs * 1e5, 0);
      return { month: d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }), count: matched.length, amount };
    });
  }, [fdrs, expiryRange]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  // Greeting name without the honorific ("Shri R. C. Verma" -> "R. C. Verma"); single-word names stay as they are.
  const firstName = currentUser.name.replace(/^(Dr\.?|Shri|Smt\.?|Prof\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, '');

  return (
    <motion.div className="space-y-6" variants={stagger} initial="hidden" animate="show">
      {/* ---------------- Hero ---------------- */}
      <motion.section variants={rise} className="relative overflow-hidden rounded-2xl bg-aurora text-white shadow-xl shadow-indigo-900/20">
        <div className="pointer-events-none absolute -top-24 -left-16 w-72 h-72 rounded-full bg-fuchsia-500/40 blur-3xl animate-float" />
        <div className="pointer-events-none absolute -bottom-28 right-10 w-80 h-80 rounded-full bg-cyan-400/30 blur-3xl animate-float-slow" />
        <div className="pointer-events-none absolute top-6 right-1/3 w-40 h-40 rounded-full bg-amber-300/20 blur-2xl animate-float" />

        <div className="relative p-6 sm:p-8 grid gap-6 lg:grid-cols-12 items-center">
          <div className="lg:col-span-7 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] bg-white/15 ring-1 ring-white/25 px-2.5 py-1 rounded-full">
                AICTE · Regulation Bureau
              </span>
              <LiveDot label={`Live · synced ${synced}`} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {greeting}, <span className="text-gradient-light">{firstName}</span>
            </h1>
            <p className="text-sm text-indigo-100 min-h-6 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-200 shrink-0" />
              <RotatingText items={facts} className="font-semibold text-white" />
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => openQueue(isAdmin && count('SCRUTINY_CLEARED') > 0 ? 'SCRUTINY_CLEARED' : 'ALL')}
                className="group px-4 py-2 text-xs font-bold rounded-xl bg-white text-indigo-700 hover:bg-indigo-50 shadow-lg shadow-indigo-950/20 flex items-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                Open scrutiny queue
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                onClick={() => setActiveSidebarTab('fdr_records')}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-white/10 hover:bg-white/20 ring-1 ring-white/30 flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                FDR ledger
              </button>
              <button
                onClick={() => void refresh()}
                disabled={loading}
                className="px-3 py-2 text-xs font-bold rounded-xl bg-white/10 hover:bg-white/20 ring-1 ring-white/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                aria-label="Refresh data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Syncing…' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-3 gap-3">
            {[
              { label: 'Corpus secured', node: <CountUp value={corpus} format={crore} /> },
              { label: 'In pipeline', node: <CountUp value={inPipeline} /> },
              { label: 'Your queue', node: <CountUp value={work.length} /> }
            ].map(k => (
              <div key={k.label} className="rounded-2xl bg-white/10 ring-1 ring-white/20 p-3 sm:p-4 backdrop-blur-sm">
                <p className="text-[10px] uppercase tracking-wider text-indigo-100 font-bold">{k.label}</p>
                <p className="text-lg sm:text-xl font-extrabold mt-1 tabular-nums">{k.node}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ---------------- Moving ticker ---------------- */}
      {tickerItems.length > 0 && (
        <motion.div variants={rise}>
          <Ticker items={tickerItems} label="LIVE" />
        </motion.div>
      )}

      {/* ---------------- Application pipeline ---------------- */}
      <motion.section variants={rise} className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Application pipeline</h2>
            <p className="text-xs text-slate-500">Submitted from the institution app; click a stage to open that queue.</p>
          </div>
          {rejected > 0 && (
            <button onClick={() => openQueue('REJECTED')} className="text-[11px] font-semibold text-rose-700 flex items-center gap-1 cursor-pointer hover:underline">
              <XCircle className="w-3.5 h-3.5" /> {rejected} not approved
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {pipeline.map((st, idx) => {
            const Icon = st.icon;
            return (
              <motion.button
                key={st.status}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => openQueue(st.status)}
                className="relative text-left bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm overflow-hidden cursor-pointer group"
              >
                <div className={`absolute inset-x-0 top-0 h-1 bg-linear-to-r ${st.grad}`} />
                <div className="flex items-center justify-between">
                  <span className={`w-9 h-9 rounded-xl bg-linear-to-br ${st.grad} text-white flex items-center justify-center shadow-md`}>
                    <Icon className="w-4.5 h-4.5" />
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">STEP {idx + 1}</span>
                </div>
                <p className="mt-3 text-2xl font-extrabold text-slate-900 tabular-nums">
                  <CountUp value={st.n} />
                </p>
                <p className="text-xs font-bold text-slate-800">{st.label}</p>
                <p className="text-[11px] text-slate-500 flex items-center justify-between">
                  {st.hint}
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                </p>
              </motion.button>
            );
          })}
        </div>
        {apps.length > 0 && (
          <div className="flex h-2 rounded-full overflow-hidden bg-slate-100" aria-hidden="true">
            {pipeline.map(st => (
              <motion.div
                key={st.status}
                className={`h-full bg-linear-to-r ${st.grad}`}
                initial={{ width: 0 }}
                animate={{ width: `${(st.n / apps.length) * 100}%` }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              />
            ))}
          </div>
        )}
      </motion.section>

      {/* ---------------- Work queue + FDR donut ---------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <motion.section variants={rise} className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Needs your attention</h3>
              <p className="text-[11px] text-slate-500">Built from live submissions, responses and FDR requests</p>
            </div>
            <span className="text-[11px] font-bold text-white bg-brand px-2.5 py-1 rounded-full">{work.length} open</span>
          </div>
          {work.length === 0 ? (
            <div className="p-10 text-center">
              <motion.div initial={{ scale: 0.6, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200 }} className="inline-flex">
                <PartyPopper className="w-10 h-10 text-fuchsia-500" />
              </motion.div>
              <p className="mt-2 text-sm font-bold text-slate-800">All clear</p>
              <p className="text-xs text-slate-500">Nothing is waiting on you right now. New submissions appear here automatically.</p>
            </div>
          ) : (
            <motion.ul variants={stagger} initial="hidden" animate="show" className="divide-y divide-slate-100">
              {work.map(w => (
                <motion.li key={w.id} variants={rise} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/80">
                  <span className={`w-1.5 self-stretch rounded-full bg-linear-to-b ${TONE_STYLE[w.tone]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900">{w.title}</p>
                    <p className="text-[11px] text-slate-500 truncate">{w.detail}</p>
                  </div>
                  <button
                    onClick={w.go}
                    className={`shrink-0 px-3 py-1.5 text-[11px] font-bold text-white rounded-lg bg-linear-to-r ${TONE_STYLE[w.tone]} shadow-sm hover:brightness-110 cursor-pointer flex items-center gap-1`}
                  >
                    {w.cta} <ChevronRight className="w-3 h-3" />
                  </button>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </motion.section>

        <motion.section variants={rise} className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">FDR status</h3>
              <p className="text-[11px] text-slate-500">Every deposit under AICTE joint lien</p>
            </div>
            <button onClick={() => setActiveSidebarTab('fdr_records')} className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer">
              Ledger →
            </button>
          </div>
          <div className="relative h-52 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donut} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={3} cornerRadius={6} animationDuration={1100}>
                  {donut.map(d => (
                    <Cell key={d.name} fill={d.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any, n: any) => [`${v} FDR${v === 1 ? '' : 's'}`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-extrabold text-gradient tabular-nums">
                <CountUp value={fdrs.length} />
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deposits</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 mt-auto">
            {donut.map(d => (
              <div key={d.name} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-50 text-[11px]">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  {d.name}
                </span>
                <strong className="text-slate-900">{d.value}</strong>
              </div>
            ))}
          </div>
        </motion.section>
      </div>

      {/* ---------------- FDR figures ---------------- */}
      <motion.section variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {fdrCards.map(c => {
          const Icon = c.icon;
          return (
            <motion.button
              key={c.label}
              variants={rise}
              whileHover={{ y: -4 }}
              onClick={() => setActiveSidebarTab(c.tab)}
              className="text-left bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm cursor-pointer relative overflow-hidden group"
            >
              <div className={`absolute -right-6 -top-6 w-20 h-20 rounded-full bg-linear-to-br ${c.grad} opacity-10 group-hover:opacity-20 transition-opacity`} />
              <span className={`w-9 h-9 rounded-xl bg-linear-to-br ${c.grad} text-white flex items-center justify-center shadow-md`}>
                <Icon className="w-4.5 h-4.5" />
              </span>
              <p className="mt-3 text-xl font-extrabold text-slate-900 tabular-nums truncate">
                <CountUp value={c.value} format={c.money ? crore : undefined} />
              </p>
              <p className="text-xs font-bold text-slate-800">{c.label}</p>
              <p className="text-[11px] text-slate-500 truncate">{c.sub}</p>
            </motion.button>
          );
        })}
      </motion.section>

      {/* ---------------- Expiry schedule + activity ---------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <motion.section variants={rise} className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Maturity schedule</h3>
              <p className="text-[11px] text-slate-500">Deposits maturing in the coming months</p>
            </div>
            <div className="relative flex bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
              {(['6M', '12M'] as const).map(r => (
                <button key={r} onClick={() => setExpiryRange(r)} className="relative px-3 py-1 rounded-md cursor-pointer">
                  {expiryRange === r && <motion.span layoutId="range-pill" className="absolute inset-0 bg-white rounded-md shadow-sm" />}
                  <span className={`relative ${expiryRange === r ? 'text-indigo-700' : 'text-slate-500'}`}>{r === '6M' ? '6 months' : '12 months'}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bars} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f8" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: '#eef2ff' }}
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="bg-slate-900 text-white p-2.5 rounded-lg shadow-lg text-xs">
                        <p className="font-bold text-amber-300">{payload[0].payload.month}</p>
                        <p>{payload[0].payload.count} deposit(s)</p>
                        <p className="text-emerald-300">{formatRupees(payload[0].payload.amount)}</p>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="count" fill="url(#barGrad)" radius={[8, 8, 0, 0]} maxBarSize={44} animationDuration={1100} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>Institutions get automatic reminders 180, 60 and 30 days before maturity.</span>
            <button onClick={() => setActiveSidebarTab('renewals')} className="text-indigo-600 font-bold hover:underline cursor-pointer">
              Renewals →
            </button>
          </div>
        </motion.section>

        <motion.section variants={rise} className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
              <History className="w-4 h-4 text-indigo-500" /> Recent activity
            </h3>
            <button onClick={() => setActiveSidebarTab('audit_trail')} className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer">
              Audit trail →
            </button>
          </div>
          {auditLogs.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-400">No activity recorded yet.</p>
          ) : (
            <motion.ol variants={stagger} initial="hidden" animate="show" className="relative px-5 py-4 space-y-4 max-h-80 overflow-y-auto">
              <span className="absolute left-[27px] top-5 bottom-5 w-px bg-linear-to-b from-indigo-200 via-fuchsia-200 to-transparent" aria-hidden="true" />
              {auditLogs.slice(0, 8).map(e => (
                <motion.li key={e.id} variants={rise} className="relative flex gap-3">
                  <span
                    className={`relative z-10 mt-0.5 w-3.5 h-3.5 rounded-full ring-4 ring-white shrink-0 ${
                      /APPROV|ENDORSE|CLEARED/.test(e.action) ? 'bg-emerald-500' : /DEFICIEN|REJECT|COLLISION/.test(e.action) ? 'bg-amber-500' : 'bg-indigo-500'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900">{e.action.replace(/_/g, ' ')}</p>
                    <p className="text-[11px] text-slate-600 line-clamp-2">{e.details}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {e.actorName} · {new Date(e.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                </motion.li>
              ))}
            </motion.ol>
          )}
        </motion.section>
      </div>
    </motion.div>
  );
};
