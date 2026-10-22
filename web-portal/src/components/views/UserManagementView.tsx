/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * UserManagementView - accounts, pending institution registrations and access approval.
 * Administrators invite staff, approve institution emails (linked to a PID) and enable / disable accounts.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { actions, loadDirectory, loadInstitutionList, toApiError } from '../../services/backend';
import { DirectoryUser, RegistrationRequest, UserInvite, UserRole } from '../../types';
import { ShieldCheck, Building2, Landmark, Search, KeyRound, RefreshCw, UserPlus, X, CheckCircle2, Clock } from 'lucide-react';

const roleBadge = (role: string) => {
  const map: Record<string, { label: string; cls: string; Icon: React.FC<{ className?: string }> }> = {
    ADMIN: { label: 'AICTE Administrator', cls: 'bg-purple-100 text-purple-800 border-purple-200', Icon: ShieldCheck },
    REVIEWER: { label: 'AICTE Scrutiny Officer', cls: 'bg-blue-100 text-blue-800 border-blue-200', Icon: ShieldCheck },
    BANK_OFFICIAL: { label: 'Bank Official', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', Icon: Landmark },
    INSTITUTION: { label: 'Technical Institution', cls: 'bg-amber-100 text-amber-800 border-amber-200', Icon: Building2 }
  };
  const m = map[role];
  if (!m) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${m.cls}`}>
      <m.Icon className="w-3 h-3" />
      {m.label}
    </span>
  );
};

const statusBadge = (status: string) =>
  status === 'ACTIVE' ? (
    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">Active</span>
  ) : status === 'DISABLED' ? (
    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">Disabled</span>
  ) : (
    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">Pending</span>
  );

type Filter = 'ALL' | 'AICTE' | 'INSTITUTION' | 'BANK' | 'PENDING';

export const UserManagementView: React.FC = () => {
  const { currentUser } = useApp();
  const isAdmin = currentUser.role === 'ADMIN';

  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationRequest[]>([]);
  const [invites, setInvites] = useState<UserInvite[]>([]);
  const [institutions, setInstitutions] = useState<{ name: string; pid: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [roleFilter, setRoleFilter] = useState<Filter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const [inviteOpen, setInviteOpen] = useState<null | 'STAFF' | 'INSTITUTION'>(null);
  const [form, setForm] = useState({ email: '', role: 'REVIEWER' as UserRole, name: '', designation: '', bank: '', pid: '' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<RegistrationRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dir, inst] = await Promise.all([loadDirectory(isAdmin), loadInstitutionList()]);
      setUsers(dir.users);
      setRegistrations(dir.registrations);
      setInvites(dir.invites);
      setInstitutions(inst);
      setLoadError(null);
    } catch (e) {
      setLoadError(toApiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, done: string, after?: () => void) => {
    setBusy(true);
    setFormError(null);
    try {
      await fn();
      setFlash(done);
      after?.();
      await load();
    } catch (e) {
      setFormError(toApiError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const openInvite = (kind: 'STAFF' | 'INSTITUTION', preset: Partial<typeof form> = {}) => {
    setForm({ email: '', role: 'REVIEWER', name: '', designation: '', bank: '', pid: institutions[0]?.pid || '', ...preset });
    setFormError(null);
    setInviteOpen(kind);
  };

  const submitInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteOpen === 'STAFF') {
      void run(
        () => actions.inviteStaff(form.email, form.role, form.name, form.designation, form.bank),
        `${form.email} can now sign in as ${form.role.replace('_', ' ').toLowerCase()} (email/password or Google).`,
        () => setInviteOpen(null)
      );
    } else {
      void run(
        () => actions.inviteInstitution(form.email, form.pid),
        `${form.email} is approved for PID ${form.pid}. They sign in from the mobile app.`,
        () => setInviteOpen(null)
      );
    }
  };

  const q = searchTerm.toLowerCase();
  const filteredUsers = users.filter(u => {
    const matchesRole =
      roleFilter === 'ALL' ||
      (roleFilter === 'AICTE' && (u.role === 'ADMIN' || u.role === 'REVIEWER')) ||
      (roleFilter === 'INSTITUTION' && u.role === 'INSTITUTION') ||
      (roleFilter === 'BANK' && u.role === 'BANK_OFFICIAL') ||
      (roleFilter === 'PENDING' && u.status === 'PENDING_VERIFICATION');
    const matchesSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.institutionName || '').toLowerCase().includes(q) ||
      (u.pid || '').toLowerCase().includes(q) ||
      (u.bankName || '').toLowerCase().includes(q);
    return matchesRole && matchesSearch;
  });
  const pendingRegs = registrations.filter(r => r.status === 'FORWARDED_TO_DTE');
  const count = (f: Filter) =>
    users.filter(
      u =>
        f === 'ALL' ||
        (f === 'AICTE' && (u.role === 'ADMIN' || u.role === 'REVIEWER')) ||
        (f === 'INSTITUTION' && u.role === 'INSTITUTION') ||
        (f === 'BANK' && u.role === 'BANK_OFFICIAL') ||
        (f === 'PENDING' && u.status === 'PENDING_VERIFICATION')
    ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Stakeholder Accounts & Access Control</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <KeyRound className="w-3.5 h-3.5" />
              Server-enforced RBAC
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Accounts on the shared backend: AICTE officials and bank officials sign in here, institutions in the mobile app.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} disabled={loading} className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white flex items-center gap-1.5 cursor-pointer disabled:opacity-60">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {isAdmin && (
            <>
              <button onClick={() => openInvite('STAFF')} className="px-3 py-2 text-xs font-bold bg-brand text-white rounded-lg flex items-center gap-1.5 cursor-pointer">
                <UserPlus className="w-3.5 h-3.5" /> Invite staff
              </button>
              <button onClick={() => openInvite('INSTITUTION')} className="px-3 py-2 text-xs font-bold border border-[#1a56db] text-[#1a56db] bg-white rounded-lg flex items-center gap-1.5 cursor-pointer">
                <Building2 className="w-3.5 h-3.5" /> Approve institution email
              </button>
            </>
          )}
        </div>
      </div>

      {loadError && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">{loadError}</div>}
      {flash && (
        <div role="status" className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {flash}
          </span>
          <button onClick={() => setFlash(null)} aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {pendingRegs.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-amber-200 bg-amber-50/60 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-700" />
            <h2 className="text-sm font-bold text-slate-900">Institution registrations awaiting verification ({pendingRegs.length})</h2>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {pendingRegs.map(r => {
              const p = r.payload;
              const user = users.find(u => u.id === r.userId);
              return (
                <div key={r.requestNo} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">
                      {p.name || 'Unnamed institution'} <span className="font-mono text-[10px] text-slate-400">{r.requestNo}</span>
                    </p>
                    <p className="text-[11px] text-slate-600">
                      {p.type} • {[p.district, p.state].filter(Boolean).join(', ')} • Claimed PID {p.pid || '—'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {p.head} • {user?.email || p.email} • {p.mobile} • {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => openInvite('INSTITUTION', { email: user?.email || p.email || '', pid: institutions.find(i => i.pid === p.pid)?.pid || institutions[0]?.pid || '' })}
                        className="px-3 py-1.5 bg-emerald-700 text-white font-bold rounded-lg cursor-pointer"
                      >
                        Verify & link to PID
                      </button>
                      <button
                        onClick={() => {
                          setRejecting(r);
                          setRejectReason('');
                          setFormError(null);
                        }}
                        className="px-3 py-1.5 border border-rose-300 text-rose-700 font-bold rounded-lg cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, email, PID, institution or bank..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:bg-white"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(
            [
              ['ALL', 'All Accounts'],
              ['AICTE', 'AICTE Officials'],
              ['INSTITUTION', 'Institutions'],
              ['BANK', 'Bank Officials'],
              ['PENDING', 'Pending']
            ] as [Filter, string][]
          ).map(([f, label]) => (
            <button
              key={f}
              onClick={() => setRoleFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${roleFilter === f ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {label} ({count(f)})
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {!loading && filteredUsers.length === 0 && <p className="text-xs text-slate-500 col-span-full text-center py-8">No accounts match.</p>}
        {filteredUsers.map(user => {
          const isCurrent = currentUser.id === user.id;
          return (
            <div
              key={user.id}
              className={`bg-white border rounded-xl p-5 shadow-xs flex flex-col justify-between ${isCurrent ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'}`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm shrink-0">
                      {user.name
                        .split(' ')
                        .map(n => n[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('')}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 text-sm leading-tight truncate">{user.name}</h3>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">{user.designation}</div>
                    </div>
                  </div>
                  {isCurrent ? <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">You</span> : statusBadge(user.status)}
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Role</span>
                    {roleBadge(user.role)}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Email</span>
                    <span className="font-mono text-slate-700 text-[11px] truncate max-w-47.5">{user.email}</span>
                  </div>
                  {user.institutionName && (
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400">Institution</span>
                      <span className="text-slate-800 text-right font-medium truncate max-w-47.5">
                        {user.institutionName} ({user.pid})
                      </span>
                    </div>
                  )}
                  {user.bankName && (
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-400">Bank</span>
                      <span className="text-slate-800 text-right font-medium text-[11px]">{user.bankName}</span>
                    </div>
                  )}
                </div>
              </div>
              {isAdmin && !isCurrent && (
                <div className="mt-5 pt-3 border-t border-slate-100">
                  {user.status === 'ACTIVE' ? (
                    <button
                      disabled={busy}
                      onClick={() => void run(() => actions.setUserStatus(user.id, 'DISABLED'), `${user.email} disabled.`)}
                      className="w-full py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold text-xs rounded-lg disabled:opacity-60 cursor-pointer"
                    >
                      Disable account
                    </button>
                  ) : user.status === 'DISABLED' ? (
                    <button
                      disabled={busy}
                      onClick={() => void run(() => actions.setUserStatus(user.id, 'ACTIVE'), `${user.email} enabled.`)}
                      className="w-full py-2 border border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-semibold text-xs rounded-lg disabled:opacity-60 cursor-pointer"
                    >
                      Enable account
                    </button>
                  ) : (
                    <button
                      onClick={() => openInvite(user.role === 'INSTITUTION' ? 'INSTITUTION' : 'STAFF', { email: user.email, name: user.name })}
                      className="w-full py-2 border border-blue-300 text-blue-700 hover:bg-blue-50 font-semibold text-xs rounded-lg cursor-pointer"
                    >
                      Approve access…
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isAdmin && invites.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <h2 className="text-sm font-bold text-slate-900 p-4 border-b border-slate-200">Approved emails (activate on first sign-in)</h2>
          <div className="divide-y divide-slate-100 text-xs">
            {invites.map(v => (
              <div key={v.email} className="p-3 flex justify-between gap-3">
                <span className="font-mono">{v.email}</span>
                <span className="text-slate-600">
                  {v.role.replace('_', ' ')}
                  {v.pid && <> • PID {v.pid}</>}
                  {v.bankName && <> • {v.bankName}</>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {inviteOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={submitInvite} className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden" noValidate>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">{inviteOpen === 'STAFF' ? 'Invite AICTE or bank staff' : 'Approve an institution email'}</h3>
              <button type="button" onClick={() => setInviteOpen(null)} aria-label="Close" className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3 text-xs">
              <label className="block">
                <span className="font-bold text-slate-700">Email (Google or password account)</span>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="mt-1 w-full p-2 border border-slate-300 rounded-md" />
              </label>
              {inviteOpen === 'STAFF' ? (
                <>
                  <label className="block">
                    <span className="font-bold text-slate-700">Role</span>
                    <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as UserRole })} className="mt-1 w-full p-2 border border-slate-300 rounded-md bg-white">
                      <option value="REVIEWER">AICTE Scrutiny Officer</option>
                      <option value="ADMIN">AICTE Administrator</option>
                      <option value="BANK_OFFICIAL">Bank Official</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="font-bold text-slate-700">Full name</span>
                    <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1 w-full p-2 border border-slate-300 rounded-md" />
                  </label>
                  <label className="block">
                    <span className="font-bold text-slate-700">Designation</span>
                    <input value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Regional Officer" className="mt-1 w-full p-2 border border-slate-300 rounded-md" />
                  </label>
                  {form.role === 'BANK_OFFICIAL' && (
                    <label className="block">
                      <span className="font-bold text-slate-700">Bank (must match the bank name on FDRs)</span>
                      <input list="bank-names" value={form.bank} onChange={e => setForm({ ...form, bank: e.target.value })} placeholder="e.g. State Bank of India" className="mt-1 w-full p-2 border border-slate-300 rounded-md" />
                      <datalist id="bank-names">
                        <option value="State Bank of India" />
                        <option value="Punjab National Bank" />
                        <option value="Bank of Baroda" />
                        <option value="Canara Bank" />
                        <option value="HDFC Bank" />
                      </datalist>
                    </label>
                  )}
                </>
              ) : (
                <label className="block">
                  <span className="font-bold text-slate-700">Institution</span>
                  <select value={form.pid} onChange={e => setForm({ ...form, pid: e.target.value })} className="mt-1 w-full p-2 border border-slate-300 rounded-md bg-white">
                    {institutions.map(i => (
                      <option key={i.pid} value={i.pid}>
                        {i.name} ({i.pid})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="text-[11px] text-slate-500">
                If the person already has an account it is activated now; otherwise it activates the first time they sign in with this email.
              </p>
              {formError && <p className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800">{formError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setInviteOpen(null)} className="px-4 py-2 border border-slate-300 rounded-md font-semibold">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="px-4 py-2 bg-brand text-white font-bold rounded-md disabled:opacity-60">
                  {busy ? 'Saving…' : 'Approve'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-slate-900">Reject registration {rejecting.requestNo}</h3>
            <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason (shared in the audit trail)" className="w-full p-2 border border-slate-300 rounded-md" />
            {formError && <p className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800">{formError}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setRejecting(null)} className="px-4 py-2 border border-slate-300 rounded-md font-semibold">
                Cancel
              </button>
              <button
                disabled={busy || rejectReason.trim().length < 10}
                onClick={() => void run(() => actions.rejectRegistration(rejecting.requestNo, rejectReason), `${rejecting.requestNo} rejected.`, () => setRejecting(null))}
                className="px-4 py-2 bg-rose-700 text-white font-bold rounded-md disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Reject registration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
