/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * AppSidebar - Navy Blue Government Sidebar Navigation
 */

import React from 'react';
import { motion } from 'motion/react';
import { PORTAL } from '../../lib/portal';
import { useApp } from '../../context/AppContext';
import { SidebarTab } from '../../types';
import { AicteLogo } from '../AicteLogo';
import {
  LayoutDashboard,
  Building2,
  FileText,
  ShieldCheck,
  RefreshCw,
  ArrowUpRightSquare,
  BarChart3,
  Bell,
  History,
  Users,
  Settings,
  LogOut,
  ChevronRight,
  ShieldAlert,
  BookCheck
} from 'lucide-react';

interface Props {
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export const AppSidebar: React.FC<Props> = ({ isMobileOpen, setIsMobileOpen }) => {
  const {
    currentUser,
    activeSidebarTab,
    setActiveSidebarTab,
    notifications,
    logout
  } = useApp();

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const allItems: { id: SidebarTab; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'institutions', label: 'Institutions', icon: Building2 },
    { id: 'fdr_records', label: 'FDR Records', icon: FileText },
    { id: 'verification_center', label: 'Verification Center', icon: ShieldCheck },
    { id: 'renewals', label: 'Renewals & Replacements', icon: RefreshCw },
    { id: 'release_requests', label: 'Release / Refund Requests', icon: ArrowUpRightSquare },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
    { id: 'audit_trail', label: 'Audit Trail', icon: History },
    { id: 'user_management', label: 'User Management', icon: Users },
    { id: 'regulatory_sources', label: 'Regulatory Sources', icon: BookCheck },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Each role sees only the work it is authorised for (the server enforces the same rules).
  const visibleFor: Record<string, SidebarTab[]> = {
    ADMIN: allItems.map(i => i.id),
    REVIEWER: ['dashboard', 'institutions', 'fdr_records', 'verification_center', 'renewals', 'release_requests', 'reports', 'notifications', 'audit_trail', 'user_management', 'regulatory_sources', 'settings'],
    BANK_OFFICIAL: ['fdr_records', 'verification_center', 'notifications']
  };
  const menuItems = allItems.filter(i => (visibleFor[currentUser.role] || []).includes(i.id));

  const handleNavClick = (tab: SidebarTab) => {
    setActiveSidebarTab(tab);
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-linear-to-b from-[#0b1033] via-[#16124a] to-[#0b1b3a] border-r border-white/5 text-slate-300 flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 overflow-hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="pointer-events-none absolute -top-20 -left-20 w-60 h-60 rounded-full bg-indigo-500/25 blur-3xl animate-float-slow" aria-hidden="true" />
        <div className="pointer-events-none absolute bottom-10 -right-24 w-60 h-60 rounded-full bg-fuchsia-500/15 blur-3xl animate-float" aria-hidden="true" />
        <div className="relative">
          {/* Sidebar Branding Header */}
          <div className="p-4 border-b border-white/10 bg-white/[0.03]">
            <div className="flex items-center gap-3">
              <AicteLogo size={40} className="w-10 h-10 shrink-0" />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-white text-base tracking-tight">AICTE</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-800">
                    GOVT OF INDIA
                  </span>
                </div>
                <p className="text-[11px] font-semibold truncate leading-tight mt-0.5 text-gradient-light">
                  {PORTAL ? `${PORTAL.name} · FDR & Approvals` : 'Security Deposit / FDR Portal'}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Menu List */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-175px)]">
            <p className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Navigation Menu
            </p>
            {menuItems.map(item => {
              const Icon = item.icon;
              const isActive = activeSidebarTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`relative w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    isActive ? 'text-white font-bold' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      className={`absolute inset-0 rounded-xl bg-linear-to-r ${PORTAL?.accent || 'from-indigo-500 via-violet-500 to-fuchsia-500'} shadow-lg shadow-violet-900/40`}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <div className="relative flex items-center gap-3 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`relative px-1.5 py-0.2 text-[10px] font-bold rounded-full ${
                        isActive ? 'bg-white text-violet-700' : 'bg-rose-500 text-white animate-pulse'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer: User Profile & Role Info */}
        <div className="relative p-3 border-t border-white/10 bg-white/[0.03] text-xs">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5 truncate">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 ${
                  currentUser.role === 'INSTITUTION'
                    ? 'bg-amber-600'
                    : currentUser.role === 'REVIEWER'
                    ? 'bg-indigo-600'
                    : currentUser.role === 'BANK_OFFICIAL'
                    ? 'bg-blue-600'
                    : 'bg-rose-700'
                }`}
              >
                {currentUser.name
                  .split(' ')
                  .map(n => n[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')}
              </div>

              <div className="truncate">
                <p className="font-bold text-white text-xs truncate">{currentUser.name}</p>
                <p className="text-[10px] text-slate-400 truncate">
                  {currentUser.role === 'BANK_OFFICIAL' ? currentUser.bankName || 'Bank Official' : currentUser.role === 'ADMIN' ? 'Administrator' : 'Scrutiny Officer'}
                </p>
              </div>
            </div>

          </div>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10 px-1 text-[11px] text-slate-400">
            <span>Engine: v2026.1</span>
            <button
              onClick={() => void logout()}
              className="text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
