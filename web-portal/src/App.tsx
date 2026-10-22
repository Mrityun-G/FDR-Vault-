/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LoginPage } from './components/LoginPage';
import { AppShell } from './components/common/AppShell';
import { supabase } from './lib/supabase';
import { toApiError } from './services/backend';

/** Shown after following a password-reset email: Supabase signs the user in with a recovery session. */
const PasswordRecoveryModal: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState<{ busy?: boolean; done?: boolean; error?: string }>({});

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') setOpen(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setState({ error: 'Use at least 8 characters.' });
    if (password !== confirm) return setState({ error: 'The two passwords do not match.' });
    setState({ busy: true });
    const { error } = await supabase.auth.updateUser({ password });
    setState(error ? { error: toApiError(error).message } : { done: true });
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/60 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-3 text-xs" noValidate>
        <h3 className="text-sm font-bold text-slate-900">Set a new password</h3>
        {state.done ? (
          <>
            <p className="text-emerald-800 bg-emerald-50 border border-emerald-200 rounded p-2">Password updated.</p>
            <div className="flex justify-end">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-1.5 bg-[#0f4299] text-white font-bold rounded-md">
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="New password" aria-label="New password" autoComplete="new-password" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm new password" aria-label="Confirm new password" autoComplete="new-password" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            {state.error && <p className="text-rose-600 font-medium">{state.error}</p>}
            <div className="flex justify-end">
              <button type="submit" disabled={state.busy} className="px-4 py-1.5 bg-[#0f4299] text-white font-bold rounded-md disabled:opacity-60">
                {state.busy ? 'Saving…' : 'Save password'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
};

const MainRouter: React.FC = () => {
  const { isAuthenticated, authReady } = useApp();

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#edf3f8] text-xs text-slate-500 gap-2">
        <div className="w-4 h-4 border-2 border-slate-300 border-t-[#0f4299] rounded-full animate-spin" />
        Connecting securely…
      </div>
    );
  }

  // The Login Page is the authentication gate for unauthenticated users
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Once authenticated, render the complete Government Dashboard with fixed navy sidebar
  return <AppShell />;
};

export default function App() {
  return (
    <AppProvider>
      <MainRouter />
      <PasswordRecoveryModal />
    </AppProvider>
  );
}
