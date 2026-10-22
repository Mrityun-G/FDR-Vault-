/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * AppShell - Main Layout Frame with Fixed Navy-Blue Sidebar & View Router
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { DashboardView } from '../DashboardView';
import { InstitutionsView } from '../views/InstitutionsView';
import { FdrRecordsView } from '../views/FdrRecordsView';
import { VerificationCenterView } from '../views/VerificationCenterView';
import { RenewalsView } from '../views/RenewalsView';
import { ReleaseRequestsView } from '../views/ReleaseRequestsView';
import { ReportsView } from '../views/ReportsView';
import { NotificationsView } from '../views/NotificationsView';
import { AuditTrailView } from '../views/AuditTrailView';
import { UserManagementView } from '../views/UserManagementView';
import { SettingsView } from '../views/SettingsView';
import { DisclaimerModal } from '../DisclaimerModal';

export const AppShell: React.FC = () => {
  const { activeSidebarTab, globalSearchQuery, setGlobalSearchQuery, dataError, refresh, loading } = useApp();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const renderActiveView = () => {
    switch (activeSidebarTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'institutions':
        return <InstitutionsView />;
      case 'fdr_records':
        return <FdrRecordsView />;
      case 'verification_center':
        return <VerificationCenterView />;
      case 'renewals':
        return <RenewalsView />;
      case 'release_requests':
        return <ReleaseRequestsView />;
      case 'reports':
        return <ReportsView />;
      case 'notifications':
        return <NotificationsView />;
      case 'audit_trail':
        return <AuditTrailView />;
      case 'user_management':
        return <UserManagementView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row antialiased text-slate-800 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Fixed Left Sidebar */}
      <AppSidebar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 md:pl-64">
        {/* Top White Header */}
        <AppHeader onToggleMobileMenu={() => setIsMobileOpen(prev => !prev)} />

        {/* Global Search Filter Ribbon (if user typed in global search) */}
        {globalSearchQuery && (
          <div className="bg-blue-50/90 border-b border-blue-200 px-6 py-2 flex items-center justify-between text-xs text-blue-900">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Global Search active:</span>
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-blue-200">
                "{globalSearchQuery}"
              </span>
              <span className="text-blue-700 hidden sm:inline">
                Filtering across FDRs, Institutions, and Audit entries
              </span>
            </div>
            <button
              onClick={() => setGlobalSearchQuery('')}
              className="text-blue-700 hover:text-blue-900 font-semibold hover:underline cursor-pointer"
            >
              Clear Filter &times;
            </button>
          </div>
        )}

        {dataError && (
          <div role="alert" className="bg-rose-50 border-b border-rose-200 px-6 py-2 flex items-center justify-between gap-3 text-xs text-rose-900">
            <span>
              <strong>Could not load data from the server.</strong> {dataError}
            </span>
            <button
              onClick={() => void refresh()}
              disabled={loading}
              className="px-3 py-1 bg-white border border-rose-300 rounded font-bold hover:bg-rose-100 disabled:opacity-60 cursor-pointer"
            >
              {loading ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        )}

        {/* Dynamic Tab Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {renderActiveView()}
        </main>

        {/* Footer */}
        <footer className="mt-auto border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
            <div>
              &copy; {new Date().getFullYear()} All India Council for Technical Education (AICTE), Ministry of Education, Govt. of India.
            </div>
            <div className="text-[11px] text-slate-400">
              AICTE Intelligent Regulatory Validation Platform (AI-IRVP) &bull; APH v2026.1 Compliance Engine
            </div>
          </div>
        </footer>
      </div>

      {/* Global Modals */}
      <DisclaimerModal />
    </div>
  );
};
