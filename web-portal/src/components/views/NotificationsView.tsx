/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * NotificationsView - Regulatory Alerts & Notice Center
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  ExternalLink,
  CheckCheck,
  Filter
} from 'lucide-react';

export const NotificationsView: React.FC = () => {
  const { notifications, markNotificationRead, setActiveSidebarTab } = useApp();
  const [filterType, setFilterType] = useState('ALL');

  const filteredNotifs = notifications.filter(n => {
    if (filterType === 'UNREAD') return !n.isRead;
    if (filterType === 'CRITICAL') return n.type === 'CRITICAL';
    return true;
  });

  const handleMarkAllRead = () => {
    notifications.forEach(n => markNotificationRead(n.id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Regulatory Alerts & Notification Center
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time compliance advisories, FDR expiry notices, scrutiny recommendations, and forensics alerts
              </p>
            </div>
          </div>
          <button
            onClick={handleMarkAllRead}
            className="px-3.5 py-1.5 text-xs font-bold text-[#1a56db] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" />
            Mark All as Read
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-3 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer ${
                filterType === 'ALL' ? 'bg-[#1a56db] text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All Alerts ({notifications.length})
            </button>
            <button
              onClick={() => setFilterType('UNREAD')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer ${
                filterType === 'UNREAD' ? 'bg-[#1a56db] text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Unread ({notifications.filter(n => !n.isRead).length})
            </button>
            <button
              onClick={() => setFilterType('CRITICAL')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer ${
                filterType === 'CRITICAL' ? 'bg-[#1a56db] text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Critical Expiries
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {filteredNotifs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              No notifications matching current filter.
            </div>
          ) : (
            filteredNotifs.map(notif => (
              <div
                key={notif.id}
                className={`p-4 flex items-start justify-between gap-4 transition-colors ${
                  !notif.isRead ? 'bg-blue-50/40 font-medium' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {notif.type === 'CRITICAL' ? (
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                    ) : notif.type === 'SUCCESS' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <Info className="w-5 h-5 text-blue-600 shrink-0" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{notif.title}</h3>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{notif.message}</p>
                    <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                      {new Date(notif.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {notif.linkTab && (
                    <button
                      onClick={() => {
                        markNotificationRead(notif.id);
                        setActiveSidebarTab(notif.linkTab as any);
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold text-[#1a56db] bg-white border border-slate-300 rounded hover:bg-slate-50 cursor-pointer flex items-center gap-1"
                    >
                      Inspect <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                  {!notif.isRead && (
                    <button
                      onClick={() => markNotificationRead(notif.id)}
                      className="text-slate-400 hover:text-slate-600 text-[10px] font-semibold cursor-pointer"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
