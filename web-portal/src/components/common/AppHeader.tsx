/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * AppHeader - White Government Header with Global Search & Notifications
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Search,
  Bell,
  Menu,
  ChevronDown,
  LogOut,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldAlert,
  X,
  ExternalLink
} from 'lucide-react';

interface Props {
  onToggleMobileMenu: () => void;
}

export const AppHeader: React.FC<Props> = ({ onToggleMobileMenu }) => {
  const {
    currentUser,
    logout,
    setIsDisclaimerOpen,
    notifications,
    markNotificationRead,
    globalSearchQuery,
    setGlobalSearchQuery,
    setActiveSidebarTab
  } = useApp();

  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleNotificationClick = (notif: typeof notifications[0]) => {
    markNotificationRead(notif.id);
    if (notif.linkTab) {
      setActiveSidebarTab(notif.linkTab as any);
    }
    setIsNotifDropdownOpen(false);
  };

  const handleMarkAllRead = () => {
    notifications.forEach(n => markNotificationRead(n.id));
  };

  return (
    <header className="sticky top-0 z-30 glass border-b border-slate-200/70 shadow-2xs">
      {/* Tricolor India Stripe with a light sweep */}
      <div className="relative h-1 w-full bg-linear-to-r from-[#FF9933] via-white to-[#138808] overflow-hidden">
        <div className="absolute inset-0 shimmer" />
      </div>

      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Mobile Toggle & Global Search */}
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <button
            onClick={onToggleMobileMenu}
            className="p-2 text-slate-500 hover:text-slate-800 md:hidden rounded-lg hover:bg-slate-100 cursor-pointer"
            aria-label="Open sidebar menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Global Search Bar */}
          <div className="relative w-full max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={globalSearchQuery}
              onChange={e => setGlobalSearchQuery(e.target.value)}
              placeholder="Search institutions, PID, FDR certificate number, bank..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-white/70 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:bg-white focus:border-violet-400 focus:ring-4 focus:ring-violet-500/15 transition-all"
            />
            {globalSearchQuery && (
              <button
                onClick={() => setGlobalSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Notifications, Prototype Badge & Profile Menu */}
        <div className="flex items-center gap-3">
          {/* Regulatory Disclaimer Pill */}
          <button
            onClick={() => setIsDisclaimerOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors cursor-pointer"
            title="View Statutory Evaluation Notice"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Prototype Evaluation</span>
          </button>

          {/* Notifications Bell Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setIsNotifDropdownOpen(!isNotifDropdownOpen);
                setIsProfileMenuOpen(false);
              }}
              className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Regulatory Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white font-extrabold text-[9px] flex items-center justify-center ring-2 ring-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {isNotifDropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-slate-900">Regulatory Notifications</span>
                    <span className="px-1.5 py-0.2 bg-blue-100 text-[#1a56db] text-[10px] font-bold rounded-full">
                      {unreadCount} New
                    </span>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] font-semibold text-[#1a56db] hover:underline cursor-pointer"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No notifications available.
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-3 text-xs transition-colors cursor-pointer hover:bg-slate-50 flex items-start gap-2.5 ${
                          !notif.isRead ? 'bg-blue-50/40 font-medium' : 'text-slate-600'
                        }`}
                      >
                        <div className="mt-0.5">
                          {notif.type === 'CRITICAL' ? (
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          ) : notif.type === 'SUCCESS' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Info className="w-4 h-4 text-blue-600 shrink-0" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-900 text-xs">{notif.title}</p>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{notif.message}</p>
                          <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                            {new Date(notif.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Menu Button */}
          <div className="relative">
            <button
              onClick={() => {
                setIsProfileMenuOpen(!isProfileMenuOpen);
                setIsNotifDropdownOpen(false);
              }}
              className="flex items-center gap-2 p-1.5 pl-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-2xs ${
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

              <div className="hidden lg:block text-left pr-1">
                <span className="text-xs font-bold text-slate-900 block truncate max-w-[130px]">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
                  {currentUser.role.replace('_', ' ')}
                </span>
              </div>

              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs">
                <div className="px-3.5 py-2 border-b border-slate-100">
                  <p className="font-bold text-slate-900 truncate">{currentUser.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{currentUser.email}</p>
                  <span className="mt-1 inline-block text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 uppercase">
                    {currentUser.bankName || currentUser.designation || currentUser.role.replace('_', ' ')}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    void logout();
                  }}
                  className="w-full px-3.5 py-2 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-bold"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-600" />
                  Sign Out of Session
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
