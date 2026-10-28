import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Sliders,
  Shield,
  FileCheck,
  Server,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Globe,
  Settings as SettingsIcon,
  ToggleLeft,
  ToggleRight,
  Database
} from 'lucide-react';
import { RegulatoryRuleConfig } from '../../types';
import { ReminderJobCard } from './ReminderJobCard';

export const SettingsView: React.FC = () => {
  const {
    rules,
    authorityAdapters,
    pingAuthorityAdapter,
    toggleAdapterDiscrepancy,
    currentUser
  } = useApp();

  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [pingingId, setPingingId] = useState<string | null>(null);

  const categories = ['ALL', 'CHECKLIST', 'EXPIRY', 'IDENTITY', 'FORENSICS', 'CADRE', 'INFRASTRUCTURE', 'FINANCE'];

  const filteredRules = rules.filter(rule => {
    return activeCategory === 'ALL' || rule.category === activeCategory;
  });

  const handlePing = async (adapterId: string) => {
    setPingingId(adapterId);
    await new Promise(resolve => setTimeout(resolve, 400));
    pingAuthorityAdapter(adapterId);
    setPingingId(null);
  };

  const isAdmin = currentUser.role === 'ADMIN';

  return (
    <div className="space-y-6">
      {currentUser.role === 'ADMIN' && <ReminderJobCard />}

      {/* Title & Statutory Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Regulatory Engine & Policy Matrix Settings
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <Sliders className="w-3.5 h-3.5" />
              APH Edition v2026.1
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Deterministic statutory rule engine parameters, issuing authority integration gateways, and regulatory tolerances.
          </p>
        </div>

        <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2 text-xs text-blue-900 max-w-md">
          <Lock className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            Rules run on the server and are versioned (v2026.1). A change is published as a new database migration, so every
            application records the rule version it was checked against.
          </span>
        </div>
      </div>

      {/* Authority Integrations & API Adapters */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Issuing Authority Cross-Verification Gateways</h2>
              <p className="text-[11px] text-slate-500">
                Core Banking System (CBS) and State Statutory registries integration status.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
            Simulated — no live government integrations yet
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {authorityAdapters.map(adapter => (
            <div
              key={adapter.id}
              className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between hover:border-slate-300 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-1">
                  <div className="font-bold text-slate-900 text-xs">{adapter.name}</div>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      adapter.status === 'CONNECTED' || adapter.status === 'VERIFIED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : adapter.status === 'DISCREPANCY_FOUND'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {adapter.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">{adapter.authorityType}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Ref: {adapter.referenceNumber}
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>Latency</span>
                  <span className="text-slate-800 font-semibold">{adapter.latencyMs}ms</span>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  onClick={() => handlePing(adapter.id)}
                  disabled={pingingId === adapter.id}
                  className="px-2.5 py-1 text-[11px] bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-700 transition-colors flex items-center gap-1 shadow-xs"
                >
                  <RefreshCw className={`w-3 h-3 ${pingingId === adapter.id ? 'animate-spin' : ''}`} />
                  Ping
                </button>

                {isAdmin && (
                  <button
                    onClick={() => toggleAdapterDiscrepancy(adapter.id)}
                    className={`px-2 py-1 text-[10px] rounded font-medium transition-colors ${
                      adapter.status === 'DISCREPANCY_FOUND'
                        ? 'bg-rose-600 text-white hover:bg-rose-700'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    {adapter.status === 'DISCREPANCY_FOUND' ? 'Resolve Discrepancy' : 'Simulate Discrepancy'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category Filter */}
      <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-xs flex items-center gap-1.5 flex-wrap">
        <span className="text-xs font-semibold text-slate-500 mr-2">Filter Policy Category:</span>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeCategory === cat
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Rules Matrix Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-slate-900 text-sm">Deterministic Regulatory Rule Matrix</h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Showing {filteredRules.length} of {rules.length} statutory checks
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredRules.map(rule => (
            <div key={rule.id} className="p-4 hover:bg-slate-50/60 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {rule.code}
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm">{rule.name}</h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                      rule.severity === 'CRITICAL'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : rule.severity === 'WARNING'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}
                  >
                    {rule.severity}
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {rule.category}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{rule.description}</p>

                <div className="text-[11px] text-slate-500 flex items-center gap-2 pt-1 font-mono">
                  <span className="text-slate-400">Statutory Clause:</span>
                  <span className="text-slate-700 font-semibold">{rule.handbookClause}</span>
                </div>

                {/* Thresholds summary */}
                {rule.thresholds && Object.keys(rule.thresholds).length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-slate-400 font-mono">Thresholds:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {Object.entries(rule.thresholds).map(([k, v]) => (
                        <span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-mono border border-slate-200">
                          {k}: <strong>{String(v)}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Rule status (server-enforced) */}
              <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    rule.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {rule.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  {rule.enabled ? 'Rule Active' : 'Rule Disabled'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
