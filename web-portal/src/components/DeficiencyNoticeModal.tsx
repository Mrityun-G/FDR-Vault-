/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * Official Scrutiny Deficiency Notice Modal & Printable Document
 */

import React from 'react';
import { InstitutionApplication } from '../types';
import { X, Printer, Download, AlertTriangle, FileText } from 'lucide-react';

interface Props {
  application: InstitutionApplication;
  isOpen: boolean;
  onClose: () => void;
}

export const DeficiencyNoticeModal: React.FC<Props> = ({ application, isOpen, onClose }) => {
  if (!isOpen) return null;

  const recommendation = application.scrutinyRecommendation;
  const deficiencies = recommendation?.deficiencyPoints || [];
  const noticeNo = recommendation?.officialNoticeNumber || `AICTE/SCRUTINY/2026/${application.applicationNumber.split('-').pop()}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Toolbar */}
        <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-700" />
            <span className="text-xs font-bold text-slate-800">
              Official Council Scrutiny Deficiency Notice
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Official Document Body */}
        <div className="p-8 sm:p-12 text-slate-800 font-serif max-h-[80vh] overflow-y-auto print:max-h-none print:p-0 print:overflow-visible">
          {/* Council Letterhead */}
          <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
            <div className="w-12 h-12 mx-auto rounded-lg bg-amber-900 text-white flex items-center justify-center font-sans font-bold text-sm mb-2 shadow-xs">
              AICTE
            </div>
            <h1 className="text-base font-bold uppercase tracking-wider text-slate-900">
              अखिल भारतीय तकनीकी शिक्षा परिषद
            </h1>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
              All India Council for Technical Education
            </h2>
            <p className="text-[10px] font-sans text-slate-600 mt-1">
              (A Statutory Body under Ministry of Education, Govt. of India)
            </p>
            <p className="text-[10px] font-sans text-slate-600">
              Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070 • www.aicte-india.org
            </p>
          </div>

          {/* Letter Meta */}
          <div className="flex justify-between items-start text-xs font-sans mb-6 border-b border-slate-200 pb-3">
            <div>
              <p className="font-semibold text-slate-900">
                <span className="text-slate-500 font-normal">Notice Reference: </span>
                {noticeNo}
              </p>
              <p className="mt-1">
                <span className="text-slate-500">Application Number: </span>
                <span className="font-bold">{application.applicationNumber}</span> (AY {application.academicYear})
              </p>
              <p>
                <span className="text-slate-500">Permanent Institute ID (PID): </span>
                <span className="font-semibold">{application.pid}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-900">
                <span className="text-slate-500 font-normal">Date of Issue: </span>
                {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <p className="mt-1">
                <span className="text-slate-500">Regional Jurisdiction: </span>
                <span className="font-semibold">{application.region} Regional Office</span>
              </p>
            </div>
          </div>

          {/* Recipient */}
          <div className="text-xs font-sans mb-6 leading-relaxed">
            <p className="font-bold">To,</p>
            <p className="font-semibold text-slate-900">The Principal / Director,</p>
            <p className="font-bold text-amber-900">{application.institutionName}</p>
            <p>{application.city}, {application.state}</p>
          </div>

          {/* Subject */}
          <div className="bg-amber-50/70 border-l-4 border-amber-600 p-3 mb-6 text-xs font-sans">
            <p className="font-bold text-slate-900">
              Subject: Scrutiny Committee Deficiencies Notice for Application No. {application.applicationNumber} ({application.type}) for Academic Session {application.academicYear} - Regarding.
            </p>
          </div>

          {/* Body */}
          <div className="text-xs font-sans leading-relaxed space-y-3 mb-6">
            <p>
              Sir / Madam,
            </p>
            <p>
              This is with reference to your online application submitted to the All India Council for Technical Education (AICTE) for grant of {application.type} for the Academic Session {application.academicYear}.
            </p>
            <p>
              The documents and institutional disclosures submitted by your institution were placed before the Regional Scrutiny Committee for rigorous automated forensic validation and regulatory compliance under the provisions of the AICTE Approval Process Handbook (APH 2026-27).
            </p>
            <p className="font-semibold text-slate-900">
              On examination of the application data, extracted document evidence, and physical norms, the Scrutiny Committee has recorded the following statutory deficiencies:
            </p>
          </div>

          {/* Deficiencies Checklist Table */}
          <div className="border border-slate-300 rounded-md overflow-hidden mb-6 font-sans text-xs">
            <div className="bg-slate-100 font-bold px-3 py-2 border-b border-slate-300 flex justify-between">
              <span>S.No. & Deficiency Detail</span>
              <span>Relevant APH 2026 Clause</span>
            </div>
            <div className="divide-y divide-slate-200">
              {deficiencies.length > 0 ? (
                deficiencies.map((d, index) => (
                  <div key={index} className="p-3 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-amber-800">{index + 1}.</span>
                      <span className="text-slate-800 font-medium">{d}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap bg-slate-100 px-2 py-0.5 rounded">
                      Clause 2.4 / Appendix 7
                    </span>
                  </div>
                ))
              ) : (
                application.findings
                  .filter(f => f.severity === 'CRITICAL' || f.severity === 'WARNING')
                  .map((f, index) => (
                    <div key={f.id} className="p-3 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-amber-800">{index + 1}.</span>
                        <div>
                          <p className="font-bold text-slate-900">{f.ruleName} ({f.ruleCode})</p>
                          <p className="text-slate-700 text-[11px] mt-0.5">{f.description}</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap bg-slate-100 px-2 py-0.5 rounded">
                        {f.handbookClause}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Instructions to Institute */}
          <div className="text-xs font-sans space-y-2 mb-8 leading-relaxed border-t border-slate-200 pt-4">
            <p className="font-bold text-slate-900">Action Required:</p>
            <ol className="list-decimal pl-5 space-y-1 text-slate-700">
              <li>
                Upload corrected and duly attested documentary proof / compliance affidavit through the AI-IRVP portal within <strong>7 working days</strong> from the date of this communication.
              </li>
              <li>
                In case of deficiency in faculty recruitment or cadre ratio, provide advertisement copies and selection committee minutes approved by the Affiliating University.
              </li>
              <li>
                Failure to rectify the aforementioned deficiencies within the stipulated period shall lead to non-recommendation for Extension of Approval / Intake Sanction for AY 2026-27.
              </li>
            </ol>
          </div>

          {/* Signature & Seal */}
          <div className="flex justify-between items-end font-sans text-xs border-t border-slate-200 pt-6">
            <div>
              <p className="text-[10px] text-slate-500">System Generated Document</p>
              <p className="text-[10px] text-slate-500">AI-IRVP Regulatory Engine v2026.1</p>
              <p className="text-[10px] font-mono text-slate-400 mt-1">Hash: {application.applicationNumber}-SEC-AUTH</p>
            </div>
            <div className="text-right">
              <div className="inline-block border-b border-dashed border-slate-400 pb-1 px-4 mb-1">
                <span className="font-serif italic font-bold text-slate-800">
                  {recommendation?.reviewerName || 'Dr. Sunil K. Mehta'}
                </span>
              </div>
              <p className="font-bold text-slate-900">Regional Scrutiny Officer</p>
              <p className="text-slate-600 text-[11px]">{application.region} Regional Office</p>
              <p className="text-slate-600 text-[11px]">All India Council for Technical Education</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
