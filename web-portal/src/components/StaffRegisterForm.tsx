/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * Staff self-registration: officers, bank officials and administrators register with their details
 * (email + password, or Google) and can use the portal immediately. No approval step.
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import { CheckCircle2, Mail } from 'lucide-react';

const ROLE_LABELS: Partial<Record<UserRole, string>> = {
  REVIEWER: 'Scrutiny Officer',
  BANK_OFFICIAL: 'Bank Official',
  ADMIN: 'Administrator'
};

const PW_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const EMAIL_RULE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const mobileOk = (s: string) => {
  const digits = s.replace(/\D/g, '');
  return /^[6-9]\d{9}$/.test(digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits);
};

type Fields = 'role' | 'fullName' | 'designation' | 'mobile' | 'bankName' | 'email' | 'password' | 'confirm';

interface Props {
  roles: UserRole[];
  accent: string;
  onGoogle: () => void;
  googleBusy: boolean;
  googleIcon: React.ReactNode;
}

export const StaffRegisterForm: React.FC<Props> = ({ roles, accent, onGoogle, googleBusy, googleIcon }) => {
  const { register, completeRegistration, cancelRegistration, pendingRegistration } = useApp();
  const completing = !!pendingRegistration;

  const [v, setV] = useState<Record<Fields, string>>({
    role: roles[0], fullName: '', designation: '', mobile: '', bankName: '', email: '', password: '', confirm: ''
  });
  const [errors, setErrors] = useState<Partial<Record<Fields, string>>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const set = (k: Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setV(prev => ({ ...prev, [k]: e.target.value }));
    if (errors[k]) setErrors(prev => ({ ...prev, [k]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: Partial<Record<Fields, string>> = {};
    if (v.fullName.trim().length < 3) err.fullName = 'Enter your full name';
    if (v.mobile.trim() && !mobileOk(v.mobile)) err.mobile = 'Enter a valid 10-digit Indian mobile number';
    if (v.role === 'BANK_OFFICIAL' && v.bankName.trim().length < 3) err.bankName = 'Enter your bank name';
    if (!completing) {
      if (!EMAIL_RULE.test(v.email.trim())) err.email = 'Enter your official email address';
      if (!PW_RULE.test(v.password)) err.password = 'Use 8+ characters with upper, lower, number and special character';
      else if (v.password !== v.confirm) err.confirm = 'Passwords do not match';
    }
    setErrors(err);
    if (Object.keys(err).length) return;

    const details = {
      role: v.role as UserRole,
      fullName: v.fullName.trim(),
      designation: v.designation.trim(),
      mobile: v.mobile.trim(),
      bankName: v.role === 'BANK_OFFICIAL' ? v.bankName.trim() : undefined
    };
    setBusy(true);
    setMessage(null);
    try {
      if (completing) await completeRegistration(details);
      else if ((await register(v.email, v.password, details)) === 'CONFIRM_EMAIL') setConfirmSent(true);
    } catch (ex: any) {
      setMessage(ex.message || 'Registration failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (confirmSent) {
    return (
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-start gap-2.5">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <span>
          Your account is created. Open the link we sent to <b>{v.email.trim()}</b> to confirm your email, then log in. No further approval is needed.
        </span>
      </div>
    );
  }

  const input = (k: Fields, label: string, opts: { type?: string; ph?: string; req?: boolean; auto?: string } = {}) => (
    <div>
      <label htmlFor={`reg-${k}`} className="block text-xs font-bold text-slate-700 mb-1.5">
        {label} {opts.req && <span className="text-rose-600">*</span>}
      </label>
      <input
        id={`reg-${k}`}
        type={opts.type || 'text'}
        value={v[k]}
        onChange={set(k)}
        placeholder={opts.ph}
        autoComplete={opts.auto}
        className={`w-full px-3 py-2.5 text-xs text-slate-900 bg-white border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0f4299]/30 transition-all ${
          errors[k] ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 focus:border-[#0f4299]'
        }`}
      />
      {errors[k] && <p className="text-[11px] text-rose-600 mt-1 font-medium">{errors[k]}</p>}
    </div>
  );

  return (
    <div>
      {completing ? (
        <div className="mb-4 p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-950 text-xs flex items-start gap-2.5">
          <Mail className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Complete your registration</p>
            <p className="text-[11px] mt-0.5 leading-relaxed">
              Signed in as <b>{pendingRegistration.email}</b>. Enter your details for this portal once; after that, signing in takes you straight in.
            </p>
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={onGoogle}
            disabled={googleBusy || busy}
            className="w-full py-2.5 px-4 bg-white border border-slate-300 hover:border-indigo-300 hover:shadow-md text-slate-800 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {googleIcon}
            <span>{googleBusy ? 'Redirecting to Google…' : 'Register with Google'}</span>
          </button>
          <div className="flex items-center gap-3 my-4 text-[11px] font-bold text-slate-400">
            <div className="h-px flex-1 bg-slate-200" />
            OR
            <div className="h-px flex-1 bg-slate-200" />
          </div>
        </>
      )}

      {message && (
        <div role="alert" className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-[11px]">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
        {roles.length > 1 && (
          <div>
            <label htmlFor="reg-role" className="block text-xs font-bold text-slate-700 mb-1.5">
              I am a <span className="text-rose-600">*</span>
            </label>
            <select id="reg-role" value={v.role} onChange={set('role')} className="w-full px-3 py-2.5 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg">
              {roles.map(r => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r] || r}
                </option>
              ))}
            </select>
          </div>
        )}
        {input('fullName', 'Full Name', { req: true, ph: 'As on your official ID', auto: 'name' })}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {input('designation', 'Designation', { ph: ROLE_LABELS[v.role as UserRole] })}
          {input('mobile', 'Mobile Number', { type: 'tel', ph: '10-digit mobile', auto: 'tel' })}
        </div>
        {v.role === 'BANK_OFFICIAL' && input('bankName', 'Bank Name', { req: true, ph: 'e.g. State Bank of India' })}
        {!completing && (
          <>
            {input('email', 'Official Email', { type: 'email', req: true, ph: 'name@aicte-india.org', auto: 'email' })}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {input('password', 'Create Password', { type: 'password', req: true, auto: 'new-password' })}
              {input('confirm', 'Confirm Password', { type: 'password', req: true, auto: 'new-password' })}
            </div>
          </>
        )}
        <button
          type="submit"
          disabled={busy || googleBusy}
          className={`w-full py-2.5 px-4 bg-linear-to-r ${accent} hover:brightness-110 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60`}
        >
          {busy ? 'Registering…' : completing ? 'Complete Registration' : 'Register'}
        </button>
      </form>

      {completing && (
        <p className="text-center mt-4 text-[11px] text-slate-500">
          Not you?{' '}
          <button type="button" onClick={() => void cancelRegistration()} className="font-semibold text-[#0f4299] hover:underline cursor-pointer">
            Use another account
          </button>
        </p>
      )}
    </div>
  );
};
