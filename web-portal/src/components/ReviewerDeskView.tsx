/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * Reviewer Scrutiny Workbench & Split-View Document Inspector
 */

import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  FileSearch,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Building2,
  FileText,
  UserCheck,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  ExternalLink,
  Printer,
  X,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Send,
  Lock
} from 'lucide-react';
import { InstitutionApplication, ValidationFinding } from '../types';
import { DeficiencyNoticeModal } from './DeficiencyNoticeModal';
import { EoALetterModal } from './EoALetterModal';
import { actions } from '../services/backend';

export const ReviewerDeskView: React.FC = () => {
  const {
    currentUser,
    applications,
    selectedAppId,
    setSelectedAppId,
    activeApp,
    overrideFinding,
    submitScrutinyDecision,
    finalDecision,
    authorityAdapters,
    pingAuthorityAdapter,
    scrutinyFilter
  } = useApp();
  const isAdmin = currentUser.role === 'ADMIN';

  // Server round-trips: one action at a time, with its error shown in the open dialog.
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Final decision (administrators)
  const [finalModal, setFinalModal] = useState<null | 'APPROVE' | 'REJECT'>(null);
  const [finalRationale, setFinalRationale] = useState('');
  const [isEoaOpen, setIsEoaOpen] = useState(false);
  const [openingDoc, setOpeningDoc] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState(scrutinyFilter);
  useEffect(() => setSelectedStatus(scrutinyFilter), [scrutinyFilter]);
  const [activeDocIndex, setActiveDocIndex] = useState(0);

  // Override Modal state
  const [overrideModalFinding, setOverrideModalFinding] = useState<ValidationFinding | null>(null);
  const [overrideRationale, setOverrideRationale] = useState('');
  const [overrideCitation, setOverrideCitation] = useState('Approval Process Handbook Clause 3.2 (Executive Discretion)');

  // Recommendation Modal state
  const [isRecommendModalOpen, setIsRecommendModalOpen] = useState(false);
  const [recommendDecision, setRecommendDecision] = useState<'RECOMMENDED_APPROVAL' | 'DEFICIENCIES_ISSUED' | 'REJECTED'>('RECOMMENDED_APPROVAL');
  const [recommendRationale, setRecommendRationale] = useState('');
  const [deficiencyInput, setDeficiencyInput] = useState('');
  const [deficiencyList, setDeficiencyList] = useState<string[]>([]);

  // Auxiliary notice modal
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);

  const currentApp = activeApp || applications[0];

  // Filtering applications
  const filteredApps = applications.filter(app => {
    const matchesSearch =
      app.institutionName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.applicationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.pid.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRegion = selectedRegion === 'ALL' || app.region === selectedRegion;
    const matchesStatus = selectedStatus === 'ALL' || app.status === selectedStatus;
    return matchesSearch && matchesRegion && matchesStatus;
  });

  const activeDoc = currentApp?.documents[activeDocIndex] || currentApp?.documents[0] || null;

  const isDecided = currentApp?.status === 'APPROVED' || currentApp?.status === 'REJECTED';

  const runAction = async (fn: () => Promise<void>, done: string, close: () => void) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      close();
      setFlash(done);
    } catch (e: any) {
      setActionError(e.message || 'The server rejected this action.');
    } finally {
      setBusy(false);
    }
  };

  const handleOpenOverride = (finding: ValidationFinding) => {
    setOverrideModalFinding(finding);
    setOverrideRationale('');
    setActionError(null);
  };

  const handleConfirmOverride = () => {
    if (!overrideModalFinding || !overrideRationale.trim()) return;
    const finding = overrideModalFinding;
    void runAction(
      () => overrideFinding(currentApp.id, finding.id, overrideRationale, overrideCitation),
      `Override recorded for ${finding.ruleCode}.`,
      () => setOverrideModalFinding(null)
    );
  };

  const openStored = async (storagePath: string) => {
    try {
      window.open(await actions.documentUrl(storagePath), '_blank', 'noopener');
    } catch (e: any) {
      setFlash(`Could not open the document: ${e.message}`);
    }
  };

  const handleOpenDocument = async () => {
    if (!activeDoc?.storagePath) return;
    setOpeningDoc(true);
    await openStored(activeDoc.storagePath);
    setOpeningDoc(false);
  };

  const handleSubmitFinal = () => {
    if (!finalModal) return;
    const approve = finalModal === 'APPROVE';
    void runAction(
      () => finalDecision(currentApp.id, approve, finalRationale),
      approve
        ? `${currentApp.applicationNumber} approved. The institution has been notified.`
        : `${currentApp.applicationNumber} not approved. The institution has been notified.`,
      () => setFinalModal(null)
    );
  };

  const handleOpenRecommendationModal = (decision: 'RECOMMENDED_APPROVAL' | 'DEFICIENCIES_ISSUED' | 'REJECTED') => {
    setRecommendDecision(decision);
    setRecommendRationale(
      decision === 'RECOMMENDED_APPROVAL'
        ? 'All mandatory submissions, Student-Faculty Ratio, and statutory certificates have been thoroughly verified against APH 2026 norms. Application recommended for grant of approval.'
        : 'Discrepancies identified during automated forensics and cadre ratio validation require statutory response.'
    );
    if (decision === 'DEFICIENCIES_ISSUED') {
      const initialDefs = currentApp.findings
        .filter(f => (f.severity === 'CRITICAL' || f.severity === 'WARNING') && !f.isOverridden)
        .map(f => `${f.ruleName}: ${f.description}`);
      setDeficiencyList(initialDefs);
    } else {
      setDeficiencyList([]);
    }
    setActionError(null);
    setIsRecommendModalOpen(true);
  };

  const handleAddDeficiency = () => {
    if (!deficiencyInput.trim()) return;
    setDeficiencyList(prev => [...prev, deficiencyInput.trim()]);
    setDeficiencyInput('');
  };

  const handleRemoveDeficiency = (idx: number) => {
    setDeficiencyList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmitRecommendation = () => {
    void runAction(
      () => submitScrutinyDecision(currentApp.id, recommendDecision, recommendRationale, deficiencyList),
      recommendDecision === 'DEFICIENCIES_ISSUED'
        ? `Deficiency notice issued for ${currentApp.applicationNumber}. The institution sees it in the mobile app.`
        : recommendDecision === 'RECOMMENDED_APPROVAL'
        ? `${currentApp.applicationNumber} cleared by scrutiny and sent for final approval.`
        : `${currentApp.applicationNumber} marked not recommended.`,
      () => setIsRecommendModalOpen(false)
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Reviewer Identity & Regional Scrutiny Jurisdiction */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-800 font-extrabold text-base shrink-0 shadow-xs">
              <FileSearch className="w-6 h-6 text-indigo-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Scrutiny Committee Workbench
                </h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-300">
                  {currentUser.name}{currentUser.region ? ` (${currentUser.region} Region)` : ` • ${currentUser.designation || 'Scrutiny Officer'}`}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Automated Regulatory Forensics, Split-View Evidence Inspector & Human-in-the-Loop Scrutiny Desk
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-slate-500">Queue Load: </span>
              <strong className="text-slate-900">{filteredApps.length} Applications</strong>
            </div>
            <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
              <span className="text-amber-700">Flagged Findings: </span>
              <strong>{currentApp?.findings.filter(f => f.severity === 'CRITICAL' && !f.isOverridden).length || 0} Critical</strong>
            </div>
          </div>
        </div>
      </div>

      {flash && (
        <div role="status" className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs flex items-center justify-between">
          <span>{flash}</span>
          <button onClick={() => setFlash(null)} className="text-emerald-700" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Scrutiny Queue Table with Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search PID, Institute, App ID..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <select
              value={selectedRegion}
              onChange={e => setSelectedRegion(e.target.value)}
              className="text-xs p-1.5 border border-slate-300 rounded-md bg-white"
            >
              <option value="ALL">All Regions</option>
              <option value="Northern">Northern</option>
              <option value="Southern">Southern</option>
              <option value="Western">Western</option>
              <option value="Eastern">Eastern</option>
              <option value="Central">Central</option>
              <option value="North-Western">North-Western</option>
              <option value="South-Western">South-Western</option>
            </select>

            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="text-xs p-1.5 border border-slate-300 rounded-md bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Submitted (New)</option>
              <option value="UNDER_SCRUTINY">Under Scrutiny</option>
              <option value="DEFICIENCIES_NOTED">Deficiencies Issued</option>
              <option value="SCRUTINY_CLEARED">Scrutiny Cleared</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Not Approved</option>
            </select>
          </div>

          <span className="text-[11px] text-slate-500">
            Click row to load Split-View Inspector
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-200">
            <thead className="bg-slate-100/70 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-2.5">Application No</th>
                <th className="px-4 py-2.5">Institution & PID</th>
                <th className="px-4 py-2.5">Type & Year</th>
                <th className="px-4 py-2.5">Region</th>
                <th className="px-4 py-2.5">SFR / Cadre</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredApps.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    {applications.length === 0
                      ? 'No applications have been submitted yet. Institutions submit them from the mobile app.'
                      : 'No applications match these filters.'}
                  </td>
                </tr>
              )}
              {filteredApps.map(app => {
                const isSelected = app.id === currentApp?.id;
                const criticalCount = app.findings.filter(f => f.severity === 'CRITICAL' && !f.isOverridden).length;
                return (
                  <tr
                    key={app.id}
                    onClick={() => setSelectedAppId(app.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/70 font-semibold'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      {app.applicationNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{app.institutionName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">PID: {app.pid}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-800">{app.type.replace('_', ' ')}</span>
                      <div className="text-[10px] text-slate-400">AY {app.academicYear}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium">{app.region}</td>
                    <td className="px-4 py-3">
                      <span className="text-slate-800 font-semibold">{app.intakeDetails.studentFacultyRatio}</span>
                      <div className="text-[10px] text-slate-500">{app.intakeDetails.cadreRatioRatioStr}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            app.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : app.status === 'SCRUTINY_CLEARED'
                              ? 'bg-blue-100 text-blue-800'
                              : app.status === 'DEFICIENCIES_NOTED'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-indigo-100 text-indigo-900'
                          }`}
                        >
                          {app.status.replace('_', ' ')}
                        </span>
                        {criticalCount > 0 && (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1 rounded border border-rose-200">
                            {criticalCount} Critical
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-indigo-700 font-bold hover:underline flex items-center justify-end gap-1">
                        Inspect <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SPLIT-VIEW SCRUTINY WORKBENCH */}
      {currentApp && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Panel 1 (Left 3 cols): Institutional Disclosures & Faculty Cadre Validator */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4">
              <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Institutional Profile
                </span>
                <span className="text-[10px] font-mono text-slate-400">{currentApp.pid}</span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[11px] text-slate-500 block">Institution</span>
                  <span className="font-bold text-slate-900">{currentApp.institutionName}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Location & Region</span>
                  <span className="text-slate-800">{currentApp.city}, {currentApp.state} ({currentApp.region})</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Application Ref</span>
                  <span className="font-mono text-indigo-900 font-bold">{currentApp.applicationNumber}</span>
                </div>
              </div>

              {/* Cadre Ratio Check Box */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">Faculty Cadre Analysis</span>
                  <span className="text-[10px] font-bold text-slate-500">Norm: 1:2:6</span>
                </div>

                <div className="grid grid-cols-3 gap-1 text-center">
                  <div className="p-1.5 bg-white border border-slate-200 rounded">
                    <p className="text-[10px] text-slate-500 font-bold">Profs</p>
                    <p className="text-sm font-extrabold text-slate-900">{currentApp.intakeDetails.professors}</p>
                  </div>
                  <div className="p-1.5 bg-white border border-slate-200 rounded">
                    <p className="text-[10px] text-slate-500 font-bold">Assoc Profs</p>
                    <p className="text-sm font-extrabold text-slate-900">{currentApp.intakeDetails.associateProfessors}</p>
                  </div>
                  <div className="p-1.5 bg-white border border-slate-200 rounded">
                    <p className="text-[10px] text-slate-500 font-bold">Asst Profs</p>
                    <p className="text-sm font-extrabold text-slate-900">{currentApp.intakeDetails.assistantProfessors}</p>
                  </div>
                </div>

                <div className="text-[11px] space-y-1 pt-1">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Calculated SFR:</span>
                    <strong className={Number(currentApp.intakeDetails.studentFacultyRatio.split(':')[1]) > 20 ? 'text-rose-700' : 'text-emerald-700'}>
                      {currentApp.intakeDetails.studentFacultyRatio}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Cadre Proportion:</span>
                    <strong className="text-slate-800">{currentApp.intakeDetails.cadreRatioRatioStr}</strong>
                  </div>
                </div>
              </div>

              {/* Land & Infrastructure norms */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                <span className="font-bold text-slate-900 block">Instructional Area</span>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-600">Built-up Carpet Area:</span>
                  <span className="font-semibold text-slate-900">{currentApp.intakeDetails.totalBuiltUpAreaSqM} sq.m</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-600">Required Norm Area:</span>
                  <span className="text-slate-700">{currentApp.intakeDetails.requiredBuiltUpAreaSqM} sq.m</span>
                </div>
              </div>
            </div>
          </div>

          {/* Panel 2 (Center 5 cols): Document Forensics & Evidence Viewer */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-700" />
                  Document Forensics & OCR Extractor
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {currentApp.documents.length} Files Filed
                </span>
              </div>

              {/* Document switcher pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {currentApp.documents.map((doc, idx) => (
                  <button
                    key={doc.id}
                    onClick={() => setActiveDocIndex(idx)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                      activeDocIndex === idx
                        ? 'bg-indigo-700 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {doc.docType.replace('_', ' ')}
                  </button>
                ))}
              </div>

              {activeDoc ? (
                <div className="space-y-3">
                  {/* File meta card */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 text-xs">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900">{activeDoc.fileName}</h4>
                        <p className="text-[10px] text-slate-500">
                          {activeDoc.pageCount} Pages • {(activeDoc.fileSizeKb / 1024).toFixed(2)} MB • Uploaded {new Date(activeDoc.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                        v{activeDoc.version}
                      </span>
                    </div>

                    <div className="font-mono text-[10px] text-slate-500 break-all select-all pt-1 border-t border-slate-200">
                      SHA-256: {activeDoc.fileHash}
                    </div>

                    {activeDoc.storagePath && (
                      <button
                        onClick={handleOpenDocument}
                        disabled={openingDoc}
                        className="mt-1 px-2.5 py-1 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-[11px] rounded flex items-center gap-1 disabled:opacity-60 cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {openingDoc ? 'Opening…' : 'Open original document'}
                      </button>
                    )}

                    {activeDoc.forensics.sha256Match && (
                      <div className="p-2 bg-rose-50 border border-rose-300 rounded text-rose-900 text-xs font-bold">
                        🚨 SHA-256 Duplicate Collision!
                        <p className="text-[11px] font-normal text-rose-800 mt-0.5">
                          Identical file hash matched against {activeDoc.forensics.duplicateApplicationId} ({activeDoc.forensics.duplicateInstitutionName}).
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 2D QR Code Payload Cross-Check */}
                  {activeDoc.forensics.qrPayload && (
                    <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-200 text-xs space-y-1">
                      <div className="flex items-center justify-between text-blue-950 font-bold">
                        <span>2D QR Digital Certificate Payload</span>
                        <span className="text-[10px] bg-blue-100 px-1.5 py-0.2 rounded text-blue-800">
                          Decoded
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700">
                        <strong>Authority:</strong> {activeDoc.forensics.qrPayload.issuingAuthority}
                      </p>
                      <p className="text-[11px] text-slate-700">
                        <strong>Signatory:</strong> {activeDoc.forensics.qrPayload.signerName}
                      </p>
                      <p className="text-[11px] text-slate-700">
                        <strong>Certificate Ref:</strong> {activeDoc.forensics.qrPayload.certId}
                      </p>
                    </div>
                  )}

                  {/* Extracted Lines Evidence Box */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 mb-1.5">
                      Extracted Text Snippets with Page-Level Evidence
                    </h5>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {activeDoc.extractedFields.map((field, i) => (
                        <div key={i} className="p-2 bg-slate-50 border border-slate-200 rounded text-xs space-y-0.5">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="font-bold text-slate-700">{field.label}</span>
                            <span className="text-[10px] font-bold text-indigo-800 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                              Page {field.page}
                            </span>
                          </div>
                          <p className="font-semibold text-slate-900">{field.value}</p>
                          <p className="text-[10px] font-mono text-slate-500 bg-white p-1 rounded border border-slate-200/80">
                            Line: "{field.sourceLine}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Gemini Advisory Box */}
                  {activeDoc.geminiAnalysis && (
                    <div className="p-3 bg-amber-50/70 border border-amber-300 rounded-lg text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-950 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                          AI Advisory Extraction Summary
                        </span>
                        <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1 rounded uppercase">
                          Probabilistic
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700 leading-relaxed">
                        {activeDoc.geminiAnalysis.summary}
                      </p>
                      <p className="text-[9px] text-slate-500 italic pt-1 border-t border-amber-200">
                        {activeDoc.geminiAnalysis.disclaimer}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center py-8">
                  No documents available for forensics view.
                </p>
              )}
            </div>
          </div>

          {/* Panel 3 (Right 4 cols): Findings, Issuing Authority Checks & Scrutiny Action */}
          <div className="lg:col-span-4 space-y-4">
            {/* Deterministic Findings list */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
              <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-700" />
                  Rule Engine Findings (v2026.1)
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {currentApp.findings.length} Evaluated
                </span>
              </div>

              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {currentApp.findings.map(finding => {
                  const isPassed = finding.severity === 'PASSED';
                  const isCritical = finding.severity === 'CRITICAL';
                  return (
                    <div
                      key={finding.id}
                      className={`p-2.5 rounded-lg border text-xs space-y-1.5 ${
                        finding.isOverridden
                          ? 'border-indigo-200 bg-indigo-50/40 opacity-90'
                          : isCritical
                          ? 'border-rose-200 bg-rose-50/50'
                          : isPassed
                          ? 'border-emerald-200 bg-emerald-50/40'
                          : 'border-amber-200 bg-amber-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          {isPassed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : isCritical ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          )}
                          <span>{finding.ruleName}</span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-400">{finding.ruleCode}</span>
                      </div>

                      <p className="text-[11px] text-slate-700 leading-relaxed">{finding.description}</p>

                      {finding.isOverridden ? (
                        <div className="p-1.5 bg-indigo-100/70 border border-indigo-200 rounded text-[10px] text-indigo-950">
                          <p className="font-bold">Overridden by {finding.overrideDetails?.overriddenBy}</p>
                          <p className="italic">"{finding.overrideDetails?.rationale}"</p>
                          <p className="text-indigo-800 font-semibold mt-0.5">Citation: {finding.overrideDetails?.statutoryCitation}</p>
                        </div>
                      ) : (
                        !isPassed && finding.isDeterministic && !isDecided && (
                          <div className="pt-1 flex justify-end">
                            <button
                              onClick={() => handleOpenOverride(finding)}
                              className="px-2 py-0.5 bg-white border border-slate-300 hover:border-indigo-500 text-indigo-700 hover:bg-indigo-50 font-bold text-[10px] rounded transition-colors cursor-pointer"
                            >
                              Reviewer Override...
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Issuing Authority Adapters ping card */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
              <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
                  Issuing Authority Cross-Checks
                </span>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                  Simulated
                </span>
              </div>

              <div className="space-y-2">
                {authorityAdapters.slice(0, 3).map(adapter => (
                  <div key={adapter.id} className="p-2 border border-slate-200 rounded text-xs flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800">{adapter.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Ref: {adapter.referenceNumber} • {adapter.latencyMs}ms
                      </p>
                    </div>
                    <button
                      onClick={() => pingAuthorityAdapter(adapter.id)}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-[10px] flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      Ping
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Scrutiny Decision Action Box */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block border-b border-slate-200 pb-2">
                Scrutiny Committee Recommendation
              </span>

              <div className="text-[11px] text-slate-600">
                Current status: <strong className="text-slate-900">{currentApp.status.replace(/_/g, ' ')}</strong>
                {currentApp.scrutinyRecommendation?.officialNoticeNumber && (
                  <> • Notice {currentApp.scrutinyRecommendation.officialNoticeNumber}</>
                )}
              </div>

              {currentApp.status === 'DEFICIENCIES_NOTED' && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900">
                  Waiting for the institution's compliance response. It appears here when they reply from the mobile app.
                </div>
              )}

              {currentApp.status === 'SCRUTINY_CLEARED' && !isAdmin && (
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-900">
                  Cleared by scrutiny. An AICTE administrator gives the final approval.
                </div>
              )}

              {currentApp.status === 'SCRUTINY_CLEARED' && isAdmin && (
                <div className="grid grid-cols-1 gap-2 pt-1">
                  <button
                    onClick={() => {
                      setFinalRationale('All statutory norms verified by the Regional Scrutiny Committee. Approval granted for the academic year.');
                      setActionError(null);
                      setFinalModal('APPROVE');
                    }}
                    className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Grant Final Approval (EoA)
                  </button>
                  <button
                    onClick={() => {
                      setFinalRationale('');
                      setActionError(null);
                      setFinalModal('REJECT');
                    }}
                    className="w-full py-2 px-3 border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    Do Not Approve
                  </button>
                </div>
              )}

              {currentApp.status === 'APPROVED' && (
                <button
                  onClick={() => setIsEoaOpen(true)}
                  className="w-full py-1.5 px-3 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  View Extension of Approval Letter
                </button>
              )}

              {currentApp.status === 'REJECTED' && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-900">
                  Not approved. {currentApp.scrutinyRecommendation?.rationale}
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 pt-1">
                {(currentApp.status === 'SUBMITTED' || currentApp.status === 'UNDER_SCRUTINY') && (
                <>
                <button
                  onClick={() => handleOpenRecommendationModal('RECOMMENDED_APPROVAL')}
                  className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Recommend Approval (Scrutiny Cleared)
                </button>

                <button
                  onClick={() => handleOpenRecommendationModal('DEFICIENCIES_ISSUED')}
                  className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Issue Official Scrutiny Deficiencies
                </button>

                <button
                  onClick={() => handleOpenRecommendationModal('REJECTED')}
                  className="w-full py-2 px-3 border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  Not Recommended (Reject)
                </button>
                </>
                )}

                {currentApp.status === 'DEFICIENCIES_NOTED' && (
                  <button
                    onClick={() => setIsNoticeOpen(true)}
                    className="w-full py-1.5 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Current Deficiency Notice
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compliance responses filed by the institution */}
      {currentApp && (currentApp.responses?.length || 0) > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3 text-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block border-b border-slate-200 pb-2">
            Institution Compliance Responses
          </span>
          {currentApp.responses!.map(r => (
            <div key={r.version} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
              <p className="font-bold text-slate-900">
                Version {r.version} • {new Date(r.submittedAt).toLocaleString()}
              </p>
              <ol className="list-decimal pl-5 space-y-1 text-[11px] text-slate-700">
                {r.points.map((pt, i) => (
                  <li key={i}>
                    {pt.point && <span className="text-slate-500">{pt.point} — </span>}
                    <span className="text-slate-900">{pt.response}</span>
                  </li>
                ))}
              </ol>
              {r.files.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {r.files.map((f, i) =>
                    f.storagePath ? (
                      <button
                        key={i}
                        onClick={() => void openStored(f.storagePath!)}
                        className="px-2 py-0.5 bg-white border border-indigo-200 text-indigo-700 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" /> {f.fileName}
                      </button>
                    ) : (
                      <span key={i} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px]">
                        {f.fileName}
                      </span>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Final decision modal (administrators) */}
      {finalModal && currentApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">
                {finalModal === 'APPROVE' ? 'Grant Final Approval' : 'Record Non-Approval'} — {currentApp.applicationNumber}
              </h3>
              <button onClick={() => setFinalModal(null)} className="text-slate-400 hover:text-slate-600" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-600">
                {currentApp.institutionName} • {currentApp.type.replace(/_/g, ' ')} • AY {currentApp.academicYear}
              </p>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Reasoned decision (mandatory, shared with the institution)</label>
                <textarea
                  rows={4}
                  value={finalRationale}
                  onChange={e => setFinalRationale(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-md text-xs"
                />
              </div>
              {actionError && <p className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800">{actionError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setFinalModal(null)} className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 font-semibold">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy || finalRationale.trim().length < 10}
                  onClick={handleSubmitFinal}
                  className={`px-4 py-2 text-white rounded-md font-bold disabled:opacity-50 ${
                    finalModal === 'APPROVE' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-rose-700 hover:bg-rose-800'
                  }`}
                >
                  {busy ? 'Recording…' : finalModal === 'APPROVE' ? 'Approve & Issue EoA' : 'Record Non-Approval'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentApp && <EoALetterModal application={currentApp} isOpen={isEoaOpen} onClose={() => setIsEoaOpen(false)} />}

      {/* Reviewer Override Modal */}
      {overrideModalFinding && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-indigo-50/60">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-700" />
                <h3 className="text-base font-bold text-slate-900">
                  Record Statutory Reviewer Override
                </h3>
              </div>
              <button onClick={() => setOverrideModalFinding(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <p className="font-bold text-slate-800">Target Rule: {overrideModalFinding.ruleName} ({overrideModalFinding.ruleCode})</p>
                <p className="text-slate-600">{overrideModalFinding.description}</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Regulatory Handbook Citation (Mandatory)
                </label>
                <input
                  type="text"
                  value={overrideCitation}
                  onChange={e => setOverrideCitation(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-md text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Official Justification & Reviewer Rationale (Mandatory)
                </label>
                <textarea
                  rows={3}
                  value={overrideRationale}
                  onChange={e => setOverrideRationale(e.target.value)}
                  placeholder="Provide detailed statutory reason why this deficiency is resolved or condoned under APH norms..."
                  className="w-full p-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              {actionError && <p className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800">{actionError}</p>}

              <div className="p-2.5 bg-amber-50 rounded border border-amber-200 text-amber-900 text-[11px]">
                <strong>Audit Notice:</strong> This override will be stamped with your official identity, current timestamp, and logged to the tamper-evident audit ledger.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOverrideModalFinding(null)}
                  className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy || overrideRationale.trim().length < 10 || !overrideCitation.trim()}
                  onClick={handleConfirmOverride}
                  className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white rounded-md font-bold"
                >
                  {busy ? 'Recording…' : 'Authorize Override'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scrutiny Recommendation Modal */}
      {isRecommendModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">
                Confirm Scrutiny Recommendation
              </h3>
              <button onClick={() => setIsRecommendModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Decision</label>
                <div className="p-2.5 rounded-lg border font-bold text-sm bg-slate-50 text-slate-900">
                  {recommendDecision.replace('_', ' ')}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reviewer Summary Rationale</label>
                <textarea
                  rows={3}
                  value={recommendRationale}
                  onChange={e => setRecommendRationale(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-md text-xs"
                />
              </div>

              {recommendDecision === 'DEFICIENCIES_ISSUED' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Specific Deficiencies Checklist (Included in Official Notice)
                  </label>
                  <div className="space-y-1.5 mb-2 max-h-36 overflow-y-auto">
                    {deficiencyList.map((d, idx) => (
                      <div key={idx} className="p-2 bg-amber-50 border border-amber-200 rounded flex justify-between items-center text-[11px]">
                        <span>{idx + 1}. {d}</span>
                        <button onClick={() => handleRemoveDeficiency(idx)} className="text-slate-400 hover:text-rose-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={deficiencyInput}
                      onChange={e => setDeficiencyInput(e.target.value)}
                      placeholder="Add deficiency point..."
                      className="flex-1 p-2 border border-slate-300 rounded text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddDeficiency}
                      className="px-3 py-1 bg-slate-200 hover:bg-slate-300 font-bold rounded text-xs"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {actionError && <p className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800">{actionError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRecommendModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitRecommendation}
                  disabled={
                    busy ||
                    recommendRationale.trim().length < 10 ||
                    (recommendDecision === 'DEFICIENCIES_ISSUED' && deficiencyList.length === 0)
                  }
                  className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-md font-bold disabled:opacity-50"
                >
                  {busy ? 'Submitting…' : 'Submit Official Recommendation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deficiency Notice Printable Modal */}
      {currentApp && (
        <DeficiencyNoticeModal
          application={currentApp}
          isOpen={isNoticeOpen}
          onClose={() => setIsNoticeOpen(false)}
        />
      )}
    </div>
  );
};
