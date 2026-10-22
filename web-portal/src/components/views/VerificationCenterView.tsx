/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * VerificationCenterView - Verification & Document Forensics Hub
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ReviewerDeskView } from '../ReviewerDeskView';
import { DocumentRegisterView } from '../DocumentRegisterView';
import { BankOfficialView } from '../BankOfficialView';
import { Sparkles, Landmark, FileSearch } from 'lucide-react';

type SubTab = 'scrutiny' | 'documents' | 'bank_cbs';

export const VerificationCenterView: React.FC = () => {
  const { currentUser } = useApp();
  const isBank = currentUser.role === 'BANK_OFFICIAL';
  const tabs: { id: SubTab; label: string; icon: React.FC<{ className?: string }> }[] = isBank
    ? [{ id: 'bank_cbs', label: 'Bank CBS Joint Lien Endorsement', icon: Landmark }]
    : [
        { id: 'scrutiny', label: 'Scrutiny Committee Workbench', icon: FileSearch },
        { id: 'documents', label: 'Uploaded Document Register', icon: Sparkles },
        { id: 'bank_cbs', label: 'Bank CBS Joint Lien Status', icon: Landmark }
      ];
  const [activeSubTab, setActiveSubTab] = useState<SubTab>(tabs[0].id);

  return (
    <div className="space-y-6">
      {tabs.length > 1 && (
        <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap gap-2 text-xs">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveSubTab(t.id)}
                className={`px-4 py-2 font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                  activeSubTab === t.id ? 'bg-[#1a56db] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {activeSubTab === 'scrutiny' && <ReviewerDeskView />}
      {activeSubTab === 'documents' && <DocumentRegisterView />}
      {activeSubTab === 'bank_cbs' && <BankOfficialView />}
    </div>
  );
};
