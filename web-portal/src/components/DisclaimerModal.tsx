/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * Regulatory Disclaimer Modal
 */

import React from 'react';
import { useApp } from '../context/AppContext';
import { AlertTriangle, X, ShieldAlert, CheckCircle2, FileText, Lock } from 'lucide-react';

export const DisclaimerModal: React.FC = () => {
  const { isDisclaimerOpen, setIsDisclaimerOpen } = useApp();

  if (!isDisclaimerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-amber-200 flex items-center justify-between bg-amber-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-600/20 flex items-center justify-center text-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Regulatory Evaluation & Prototype Notice
              </h2>
              <p className="text-xs text-amber-800 font-medium">
                Mandatory Statutory System Disclaimer
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsDisclaimerOpen(false)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs text-slate-700 leading-relaxed max-h-[70vh] overflow-y-auto">
          <div className="p-3.5 bg-amber-50/70 border border-amber-300 rounded-lg text-amber-900 font-semibold text-xs">
            PROTOTYPE ONLY: This software system is a functional technical prototype created for evaluation, research, and testing. It does not constitute official regulatory approval or endorsement by the All India Council for Technical Education (AICTE). Real statutory approvals require authorized scrutiny committee decisions in compliance with the prevailing AICTE Approval Process Handbook.
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-slate-900">Strict Separation of Rules & AI Inference</h4>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  The platform enforces strict structural separation between deterministic validation rules (v2026.1) and probabilistic AI extraction. AI generated summaries are advisory interpretations, labeled with disclaimers, and never treated as final regulatory decisions.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-slate-900">Simulated External Issuing Authorities</h4>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Integrations with State Directorate of Technical Education (DTE), Affiliating Universities, State Fire Services, and Core Banking (CBS) operate through simulated adapters for demonstration and test execution. No live government databases are polled.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <FileText className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-slate-900">Human-in-the-Loop Review Requirement</h4>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Reviewers must provide formal regulatory rationale and statutory handbook citations to resolve deficiencies or override deterministic findings. Overrides are permanently captured in the tamper-evident audit ledger with correlation IDs.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-slate-900">Document Forensics & Duplicate Detection</h4>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Calculated cryptographic SHA-256 hashes cross-verify institutional documents across applications to prevent the reuse of land sale deeds, building safety certificates, or fraudulent multi-trust filings.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={() => setIsDisclaimerOpen(false)}
            className="px-4 py-1.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold rounded-md transition-colors"
          >
            I Understand & Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
};
