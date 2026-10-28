/**
 * Daily FDR maturity reminder job (administrators): whether today's run happened, the recent runs, and "Run now".
 * The server runs the job once per India date from 07:00 IST; a manual run never creates duplicate reminders.
 */

import React, { useEffect, useState } from 'react';
import { actions } from '../../services/backend';
import { ReminderJobStatus } from '../../types';
import { BellRing, RefreshCw } from 'lucide-react';

export const ReminderJobCard: React.FC = () => {
  const [status, setStatus] = useState<ReminderJobStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => actions.reminderJobStatus().then(setStatus, e => setMessage(e.message || 'Job status unavailable.'));
  useEffect(() => void load(), []);

  const runNow = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await actions.runReminders();
      setMessage(r.ran ? `Run complete: ${r.checked} deposit(s) in a reminder window, ${r.created} new reminder(s).` : r.reason || 'The job did not run.');
      await load();
    } catch (e: any) {
      setMessage(e.message || 'The job did not run.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Daily FDR maturity reminders</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Runs every day from 07:00 IST for deposits 180, 60 and 30 days from maturity, and matured ones. Reminders go to the institution's app and email.
            </p>
          </div>
        </div>
        <button
          onClick={runNow}
          disabled={busy}
          className="px-4 py-2 bg-brand hover:brightness-110 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> Run now
        </button>
      </div>
      {status && (
        <p className={`text-xs font-semibold ${status.ranToday ? 'text-emerald-800' : 'text-amber-800'}`}>
          {status.ranToday ? `Ran today (${status.today}).` : `Not yet run today (${status.today}).`}
        </p>
      )}
      {message && <p className="p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700">{message}</p>}
      {status && status.recent.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="text-slate-500">
              <tr>
                {['Started', 'For date', 'Trigger', 'Deposits due', 'New reminders', 'Result'].map(h => (
                  <th key={h} className="text-left font-semibold px-2 py-1.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {status.recent.map(r => (
                <tr key={r.startedAt}>
                  <td className="px-2 py-1.5">{new Date(r.startedAt).toLocaleString()}</td>
                  <td className="px-2 py-1.5">{r.runDate}</td>
                  <td className="px-2 py-1.5">{r.trigger === 'SCHEDULE' ? 'Schedule' : r.trigger === 'ADMIN' ? 'Admin' : 'Server'}</td>
                  <td className="px-2 py-1.5">{r.checked ?? '—'}</td>
                  <td className="px-2 py-1.5">{r.created ?? '—'}</td>
                  <td className={`px-2 py-1.5 ${r.error ? 'text-rose-700' : 'text-emerald-800'}`}>{r.error || 'OK'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
