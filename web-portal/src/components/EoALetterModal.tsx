/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * Official Extension of Approval (EoA) Letter Modal
 */

import React from 'react';
import { InstitutionApplication } from '../types';
import { X, Printer, CheckCircle2, Award, ShieldCheck } from 'lucide-react';

interface Props {
  application: InstitutionApplication;
  isOpen: boolean;
  onClose: () => void;
}

export const EoALetterModal: React.FC<Props> = ({ application, isOpen, onClose }) => {
  if (!isOpen) return null;

  const approval = application.approvalDetails;
  const letterNo = approval?.eoaLetterNumber || `F.No. ${application.region}/${application.pid}/2026/EOA`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Toolbar */}
        <div className="px-6 py-3 border-b border-emerald-200 flex items-center justify-between bg-emerald-50/80 print:hidden">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-bold text-emerald-900">
              Official AICTE Extension of Approval (EoA) Grant Letter
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
            <div className="w-12 h-12 mx-auto rounded-lg bg-emerald-900 text-white flex items-center justify-center font-sans font-bold text-sm mb-2 shadow-xs">
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
              <p className="font-bold text-emerald-900">
                <span className="text-slate-500 font-normal">Order No: </span>
                {letterNo}
              </p>
              <p className="mt-1">
                <span className="text-slate-500">Application Number: </span>
                <span className="font-bold">{application.applicationNumber}</span>
              </p>
              <p>
                <span className="text-slate-500">Permanent Institute ID: </span>
                <span className="font-semibold">{application.pid}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-900">
                <span className="text-slate-500 font-normal">Date: </span>
                {approval?.approvedAt
                  ? new Date(approval.approvedAt).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  : new Date().toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
              </p>
              <p className="mt-1">
                <span className="text-slate-500">Academic Year: </span>
                <span className="font-bold text-slate-900">{application.academicYear}</span>
              </p>
            </div>
          </div>

          {/* Recipient */}
          <div className="text-xs font-sans mb-6 leading-relaxed">
            <p className="font-bold">To,</p>
            <p className="font-semibold text-slate-900">The Principal / Director,</p>
            <p className="font-bold text-emerald-950">{application.institutionName}</p>
            <p>{application.city}, {application.state}</p>
          </div>

          {/* Subject */}
          <div className="bg-emerald-50 border-l-4 border-emerald-600 p-3 mb-6 text-xs font-sans">
            <p className="font-bold text-emerald-950">
              Sub: Extension of Approval (EoA) / Sanction of Intake for Academic Year {application.academicYear} - Regarding.
            </p>
          </div>

          {/* Body */}
          <div className="text-xs font-sans leading-relaxed space-y-3 mb-6">
            <p>
              Sir / Madam,
            </p>
            <p>
              In terms of the provisions under the All India Council for Technical Education (Grant of Approvals for Technical Institutions) Regulations, 2026 notified by the Council and standards prescribed by the Council from time to time, I am directed to convey the approval to:
            </p>
          </div>

          {/* Institution Data Summary Box */}
          <div className="border border-slate-300 rounded-md overflow-hidden mb-6 font-sans text-xs bg-slate-50 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Permanent Institute Id (PID)</p>
                <p className="font-bold text-slate-900">{application.pid}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Application Id</p>
                <p className="font-bold text-slate-900">{application.applicationNumber}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Name of Institution</p>
                <p className="font-bold text-slate-900">{application.institutionName}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Sanctioned Total Intake</p>
                <p className="font-bold text-emerald-800">{application.intakeDetails.proposedTotalIntake} Seats</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Institution Type</p>
                <p className="font-bold text-slate-900">Unaided - Private (Approved)</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Region</p>
                <p className="font-bold text-slate-900">{application.region} Regional Office</p>
              </div>
            </div>
          </div>

          {/* Special Conditions */}
          <div className="text-xs font-sans space-y-2 mb-8 leading-relaxed border-t border-slate-200 pt-4">
            <p className="font-bold text-slate-900">Statutory Compliance Conditions:</p>
            <ol className="list-decimal pl-5 space-y-1 text-slate-700">
              <li>
                The Institution shall maintain the Student-to-Faculty Ratio of 1:20 and Cadre Ratio 1:2:6 throughout the academic year.
              </li>
              <li>
                The joint FDR under lien with Regional Officer AICTE shall remain unencumbered until maturity.
              </li>
              <li>
                Fire Safety and Building NOCs shall be renewed upon expiry without interruption.
              </li>
            </ol>
          </div>

          {/* Digital Signature & Seal */}
          <div className="flex justify-between items-end font-sans text-xs border-t border-slate-200 pt-6">
            <div className="flex items-center gap-2">
              <div className="w-16 h-16 border-2 border-dashed border-emerald-600 rounded flex flex-col items-center justify-center p-1 bg-emerald-50 text-center">
                <ShieldCheck className="w-6 h-6 text-emerald-700 mb-0.5" />
                <span className="text-[7px] font-bold text-emerald-800 leading-none">DIGITALLY VERIFIED</span>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">Digital Token: AICTE-REG-2026</p>
                <p className="text-[9px] font-mono text-slate-400 break-all max-w-[200px]">
                  {approval?.digitalSignFingerprint || 'SHA256:ECDSA:99fa0218821901ab'}
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="inline-block border-b border-dashed border-slate-400 pb-1 px-4 mb-1">
                <span className="font-serif italic font-bold text-slate-800">
                  {approval?.approvedBy || 'Shri R. C. Verma'}
                </span>
              </div>
              <p className="font-bold text-slate-900">Chief Administrator & Advisor</p>
              <p className="text-slate-600 text-[11px]">Regulation Bureau, AICTE New Delhi</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
