/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * Security Deposit / FDR Management Portal - Staff Login Page
 * (AICTE officials and bank officials. Institutions use the mobile app.)
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { INSTITUTION_APP_URL } from '../lib/supabase';
import { AicteLogo } from './AicteLogo';
import { motion } from 'motion/react';
import { RotatingText, Ticker } from './fx';
import {
  ShieldCheck,
  Building2,
  Landmark,
  Eye,
  EyeOff,
  Lock,
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
  X,
  ExternalLink,
  Info,
  Smartphone
} from 'lucide-react';

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z" />
  </svg>
);

export const LoginPage: React.FC = () => {
  const { loginWithPassword, loginWithGoogle, sendPasswordReset, authError } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetState, setResetState] = useState<{ busy?: boolean; sent?: boolean; error?: string }>({});

  const shownError = errorMessage || authError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { email?: string; password?: string } = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) errors.email = 'Enter your official email address';
    if (!password) errors.password = 'Please enter your password';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await loginWithPassword(email, password);
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setIsGoogleLoading(true);
    setErrorMessage(null);
    try {
      await loginWithGoogle(); // redirects to Google
    } catch (err: any) {
      setErrorMessage(err.message || 'Google sign-in is not available right now.');
      setIsGoogleLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(resetEmail.trim())) {
      setResetState({ error: 'Enter a valid email address' });
      return;
    }
    setResetState({ busy: true });
    try {
      await sendPasswordReset(resetEmail);
      setResetState({ sent: true });
    } catch (err: any) {
      setResetState({ error: err.message || 'Could not send the reset email.' });
    }
  };

  return (
    <div className="relative min-h-screen bg-aurora flex flex-col justify-between font-sans overflow-hidden">
      {/* Floating colour light */}
      <div className="pointer-events-none absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-fuchsia-500/35 blur-3xl animate-float" aria-hidden="true" />
      <div className="pointer-events-none absolute top-1/3 -right-32 w-[32rem] h-[32rem] rounded-full bg-cyan-400/30 blur-3xl animate-float-slow" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-40 left-1/4 w-[26rem] h-[26rem] rounded-full bg-amber-300/20 blur-3xl animate-float" aria-hidden="true" />

      {/* Top Tricolor Strip */}
      <div className="relative h-1.5 w-full bg-linear-to-r from-[#FF9933] via-white to-[#138808] overflow-hidden">
        <div className="absolute inset-0 shimmer" />
      </div>

      {/* Header matching government portal style */}
      <header className="relative glass border-b border-white/40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <AicteLogo size={52} className="w-13 h-13" />
              <div>
                <h1 className="text-base sm:text-lg font-extrabold text-[#0a2540] tracking-tight leading-tight">AICTE</h1>
                <p className="text-xs sm:text-sm font-bold text-[#0f2d59] leading-tight">All India Council for Technical Education</p>
                <p className="text-[11px] font-medium text-slate-500 leading-tight">Ministry of Education, Government of India</p>
              </div>
            </div>
            <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
              <span className="text-[11px] uppercase tracking-wider font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block mb-1">
                Officer &amp; Bank Portal
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-[#0a2540] tracking-tight">Security Deposit / FDR Management Portal</h2>
            </div>
          </div>
        </div>
      </header>

      {/* Main Login Section */}
      <main className="relative flex-1 flex flex-col items-center justify-center gap-6 p-4 sm:p-6 lg:p-8">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center text-white max-w-2xl"
        >
          <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-indigo-100">Regulation, made</p>
          <h2 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight">
            <RotatingText items={['Transparent.', 'Secure.', 'Accountable.', 'Paperless.', 'Real-time.']} className="text-gradient-light pb-1" />
          </h2>
          <p className="mt-2 text-sm text-indigo-100">
            Institutions file from the mobile app. Officers, administrators and banks act here, on the same live record.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl shadow-indigo-950/40 ring-1 ring-white/40 overflow-hidden"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 min-h-[540px]">
            {/* LEFT SECTION — Login Form (7 cols) */}
            <div className="md:col-span-7 p-6 sm:p-10 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-100">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <AicteLogo size={42} className="w-10 h-10" />
                  <div>
                    <h3 className="text-base font-extrabold tracking-tight text-gradient">Staff Sign-in</h3>
                    <p className="text-xs text-slate-500 font-medium">AICTE scrutiny officers, administrators and bank officials</p>
                  </div>
                </div>

                {shownError && (
                  <div role="alert" className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Authentication Failed</p>
                      <p className="text-[11px] text-rose-800 mt-0.5 leading-relaxed">{shownError}</p>
                    </div>
                  </div>
                )}

                <motion.button
                  type="button"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleGoogle}
                  disabled={isGoogleLoading || isLoading}
                  className="w-full py-2.5 px-4 bg-white border border-slate-300 hover:border-indigo-300 hover:shadow-md text-slate-800 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isGoogleLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
                  ) : (
                    <GoogleIcon />
                  )}
                  <span>{isGoogleLoading ? 'Redirecting to Google…' : 'Continue with Google'}</span>
                </motion.button>

                <div className="flex items-center gap-3 my-5 text-[11px] font-bold text-slate-400">
                  <div className="h-px flex-1 bg-slate-200" />
                  OR
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div>
                    <label htmlFor="staff-email" className="block text-xs font-bold text-slate-700 mb-1.5">
                      Official Email <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <UserIcon className="w-4 h-4" />
                      </div>
                      <input
                        id="staff-email"
                        type="email"
                        value={email}
                        onChange={e => {
                          setEmail(e.target.value);
                          if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined }));
                        }}
                        placeholder="name@aicte-india.org"
                        className={`w-full pl-9 pr-3 py-2.5 text-xs text-slate-900 bg-white border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0f4299]/30 transition-all ${
                          fieldErrors.email ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 focus:border-[#0f4299]'
                        }`}
                        autoComplete="username"
                      />
                    </div>
                    {fieldErrors.email && <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.email}</p>}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="staff-password" className="text-xs font-bold text-slate-700">
                        Password <span className="text-rose-600">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setResetEmail(email);
                          setResetState({});
                          setIsForgotPasswordOpen(true);
                        }}
                        className="text-[11px] font-semibold text-[#0f4299] hover:underline cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        id="staff-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => {
                          setPassword(e.target.value);
                          if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: undefined }));
                        }}
                        placeholder="Enter account password"
                        className={`w-full pl-9 pr-10 py-2.5 text-xs text-slate-900 bg-white border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0f4299]/30 transition-all ${
                          fieldErrors.password ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 focus:border-[#0f4299]'
                        }`}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {fieldErrors.password && <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.password}</p>}
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isLoading || isGoogleLoading}
                      className="w-full py-2.5 px-4 bg-brand hover:brightness-110 active:brightness-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Authenticating credentials...</span>
                        </>
                      ) : (
                        <span>Login</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              <div className="pt-4 mt-6 border-t border-slate-100 text-[10px] text-slate-400 text-center">
                Protected system under Section 43 &amp; 66 of Information Technology Act, 2000. Unauthorized access is prohibited.
              </div>
            </div>

            {/* RIGHT SECTION — Who signs in where (5 cols) */}
            <div className="md:col-span-5 bg-linear-to-br from-indigo-50/80 via-white to-fuchsia-50/60 p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="mb-4">
                  <h3 className="text-sm font-extrabold text-[#0a2540] tracking-tight">Who signs in here</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Your role is assigned by an AICTE administrator and checked on the server.</p>
                </div>

                <div className="space-y-3">
                  <div className="p-4 rounded-2xl border bg-white border-slate-200/90 card-hover">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-md">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#0a2540]">AICTE Official</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          Scrutiny officers review applications and issue deficiency notices. Administrators grant final approval, decide FDR
                          requests and manage accounts.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl border bg-white border-slate-200/90 card-hover">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-md">
                        <Landmark className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#0a2540]">Bank Official</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          Verify Fixed Deposit Receipts held with your bank and endorse the AICTE joint lien.
                        </p>
                      </div>
                    </div>
                  </div>

                  <a
                    href={INSTITUTION_APP_URL}
                    className="block p-4 rounded-2xl border bg-amber-50/60 border-amber-200 hover:bg-amber-50 card-hover"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-linear-to-br from-amber-500 to-orange-600 text-white shadow-md">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#0a2540] flex items-center gap-1">
                          Institution? Use the mobile app <ExternalLink className="w-3 h-3" />
                        </h4>
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed flex items-start gap-1">
                          <Smartphone className="w-3.5 h-3.5 shrink-0 mt-px" />
                          Applications, documents and FDRs are submitted in the AICTE Institution app.
                        </p>
                      </div>
                    </div>
                  </a>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200/70 text-[10px] text-slate-500 leading-relaxed space-y-1">
                <div className="flex items-center gap-1 font-semibold text-slate-700">
                  <Info className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                  <span>Server-Side RBAC Enforcement</span>
                </div>
                <p>
                  Every action on this portal is checked by the server against your role and recorded in the tamper-evident audit trail.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <Ticker
          label="PORTAL"
          className="w-full max-w-4xl"
          items={[
            { id: 'a', text: 'Live scrutiny queue of applications submitted from the institution app', tone: 'info' },
            { id: 'b', text: 'Deficiency notices reach institutions instantly as app notifications', tone: 'warning' },
            { id: 'c', text: 'Bank officials endorse the AICTE joint lien with their CBS reference', tone: 'success' },
            { id: 'd', text: 'Every decision is recorded in a tamper-evident, hash-chained audit trail', tone: 'info' },
            { id: 'e', text: 'Duplicate documents across institutions are caught by SHA-256 fingerprints', tone: 'critical' }
          ]}
        />
      </main>

      <footer className="relative glass border-t border-white/40 py-4 text-center text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]">
          <p>© 2026 All India Council for Technical Education (AICTE), New Delhi. All Rights Reserved.</p>
          <div className="flex items-center gap-3 text-slate-600 font-medium">
            <span>Approval Process Handbook (APH 2026-27)</span>
            <span>•</span>
            <span>Security Deposit Verification Guidelines</span>
          </div>
        </div>
      </footer>

      {isForgotPasswordOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Reset your password</h3>
              <button onClick={() => setIsForgotPasswordOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            {resetState.sent ? (
              <div className="p-6 text-xs text-slate-700 space-y-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>If an account exists for {resetEmail}, a reset link is on its way. Open it on this device to choose a new password.</span>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => setIsForgotPasswordOpen(false)} className="px-4 py-1.5 bg-[#0f4299] text-white font-bold text-xs rounded-md">
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleReset} className="p-6 text-xs text-slate-700 space-y-3" noValidate>
                <p>Enter your official email. We will send you a link to set a new password. Accounts that sign in with Google do not need a password.</p>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  placeholder="name@aicte-india.org"
                  className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-lg"
                  aria-label="Email for password reset"
                />
                {resetState.error && <p className="text-[11px] text-rose-600 font-medium">{resetState.error}</p>}
                <div className="pt-1 flex justify-end gap-2">
                  <button type="button" onClick={() => setIsForgotPasswordOpen(false)} className="px-4 py-1.5 border border-slate-300 rounded-md font-semibold">
                    Cancel
                  </button>
                  <button type="submit" disabled={resetState.busy} className="px-4 py-1.5 bg-[#0f4299] text-white font-bold rounded-md disabled:opacity-60">
                    {resetState.busy ? 'Sending…' : 'Send reset link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
