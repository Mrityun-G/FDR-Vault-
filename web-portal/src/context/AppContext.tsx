/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * Global Application Context & State Management
 *
 * Staff portal (AICTE reviewers, administrators, bank officials). Institutions use the mobile app.
 * Data comes from the shared Supabase database under row-level security; every change goes through
 * an audited server function, after which the data is reloaded. Realtime keeps open screens current.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  User,
  InstitutionApplication,
  RegulatoryRuleConfig,
  IssuingAuthorityStatus,
  AuditEvent,
  FdrRecord,
  RegulatoryNotification,
  SidebarTab
} from '../types';
import { INITIAL_RULES, INITIAL_AUTHORITY_ADAPTERS } from '../data/mockData';
import { supabase } from '../lib/supabase';
import { PORTAL, portalForRole, portalUrl } from '../lib/portal';
import { actions, buildNotifications, loadApplications, loadAudit, loadFdrs, loadProfile, toApiError, StaffRegistration } from '../services/backend';

const GUEST: User = { id: '', name: 'Guest', email: '', role: 'REVIEWER', designation: '' };
const READ_KEY = 'aicte-staff-read-notifications';

interface AppContextType {
  // Authentication
  currentUser: User;
  isAuthenticated: boolean;
  authReady: boolean;
  authError: string | null;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  /** Set when a signed-in account (usually a first Google sign-in) still has to enter its registration details. */
  pendingRegistration: { email: string } | null;
  register: (email: string, password: string, details: StaffRegistration) => Promise<'SIGNED_IN' | 'CONFIRM_EMAIL'>;
  completeRegistration: (details: StaffRegistration) => Promise<void>;
  cancelRegistration: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;

  // Server data
  loading: boolean;
  dataError: string | null;
  lastSyncedAt: Date | null;
  refresh: () => Promise<void>;
  applications: InstitutionApplication[];
  selectedAppId: string | null;
  setSelectedAppId: (id: string | null) => void;
  activeApp: InstitutionApplication | null;
  fdrRecords: FdrRecord[];
  auditLogs: AuditEvent[];
  notifications: RegulatoryNotification[];
  markNotificationRead: (id: string) => void;

  // Reference data (rule matrix mirrors server rule_config v2026.1; authority adapters are simulated)
  rules: RegulatoryRuleConfig[];
  authorityAdapters: IssuingAuthorityStatus[];
  pingAuthorityAdapter: (adapterId: string) => void;
  toggleAdapterDiscrepancy: (adapterId: string) => void;

  // Navigation & UI
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeSidebarTab: SidebarTab;
  setActiveSidebarTab: (tab: SidebarTab) => void;
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;
  isDisclaimerOpen: boolean;
  setIsDisclaimerOpen: (open: boolean) => void;
  /** Status filter the Scrutiny Workbench opens with ('ALL' or an application status). */
  scrutinyFilter: string;
  setScrutinyFilter: (status: string) => void;
  /** Jump to the Scrutiny Workbench with one application selected. */
  openApplication: (appId: string) => void;
  /** Jump to the Scrutiny Workbench filtered to one status. */
  openQueue: (status: string) => void;

  // Actions (server functions; each reloads data on success and throws ApiError on failure)
  submitScrutinyDecision: (
    appId: string,
    decision: 'RECOMMENDED_APPROVAL' | 'DEFICIENCIES_ISSUED' | 'REJECTED',
    rationale: string,
    deficiencyPoints: string[]
  ) => Promise<void>;
  startScrutiny: (appId: string) => Promise<void>;
  finalDecision: (appId: string, approve: boolean, rationale: string) => Promise<void>;
  overrideFinding: (appId: string, findingId: string, rationale: string, statutoryCitation: string) => Promise<void>;
  endorseLien: (fdrId: string, token: string) => Promise<void>;
  decideFdrRequest: (requestId: string, approve: boolean, note: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const readSet = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]'));
  } catch {
    return new Set();
  }
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(GUEST);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingRegistration, setPendingRegistration] = useState<{ email: string } | null>(null);

  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [applications, setApplications] = useState<InstitutionApplication[]>([]);
  const [fdrRecords, setFdrRecords] = useState<FdrRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(readSet);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  const [authorityAdapters, setAuthorityAdapters] = useState<IssuingAuthorityStatus[]>(INITIAL_AUTHORITY_ADAPTERS);
  const [activeTab, setActiveTab] = useState<string>('applications');
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('dashboard');
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [isDisclaimerOpen, setIsDisclaimerOpen] = useState(false);
  const [scrutinyFilter, setScrutinyFilter] = useState('ALL');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const userRef = useRef<User>(GUEST);
  const entering = useRef(false);
  const refreshTimer = useRef<number>(0);

  /* ---------------------------------------------------------------- data */

  const refresh = useCallback(async () => {
    const user = userRef.current;
    if (!user.id) return;
    setLoading(true);
    try {
      const isStaff = user.role === 'ADMIN' || user.role === 'REVIEWER';
      const [apps, fdrs, audit] = await Promise.all([
        isStaff ? loadApplications() : Promise.resolve([]),
        loadFdrs(),
        isStaff ? loadAudit() : Promise.resolve([])
      ]);
      setApplications(apps);
      setFdrRecords(fdrs);
      setAuditLogs(audit);
      setDataError(null);
      setLastSyncedAt(new Date());
    } catch (e) {
      const err = toApiError(e);
      setDataError(err.message);
      if (err.code === 'SESSION_EXPIRED') await supabase.auth.signOut();
    } finally {
      setLoading(false);
    }
  }, []);

  const scheduleRefresh = useCallback(() => {
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => void refresh(), 400);
  }, [refresh]);

  /* ---------------------------------------------------------------- session */

  /** Loads the staff profile for the current Supabase session. Returns an error message when access is refused. */
  const enterSession = useCallback(async (): Promise<string | null> => {
    entering.current = true;
    try {
      const user = await loadProfile();
      // Each portal admits only its own roles; point the person to the right address.
      if (PORTAL && !PORTAL.roles.includes(user.role)) {
        const home = portalForRole(user.role);
        throw toApiError({
          message: `ROLE_MISMATCH: This ${user.role === 'ADMIN' ? 'administrator' : user.role === 'BANK_OFFICIAL' ? 'bank official' : 'scrutiny officer'} account signs in at the ${home?.name || 'staff portal'}${home ? `: ${portalUrl(home)}` : ''}.`
        });
      }
      userRef.current = user;
      setCurrentUser(user);
      setIsAuthenticated(true);
      setAuthError(null);
      setPendingRegistration(null);
      setActiveSidebarTab(user.role === 'BANK_OFFICIAL' ? 'verification_center' : 'dashboard');
      await refresh();
      return null;
    } catch (e) {
      const err = toApiError(e);
      userRef.current = GUEST;
      setCurrentUser(GUEST);
      setIsAuthenticated(false);
      if (err.code === 'REGISTRATION_REQUIRED') {
        // Keep the session: the login page asks for the registration details once.
        const { data } = await supabase.auth.getUser();
        setAuthError(null);
        setPendingRegistration({ email: data.user?.email || '' });
        return null;
      }
      // Signed in to Supabase, but not as active AICTE staff: show why and sign out.
      const message = err.message;
      setAuthError(message);
      userRef.current = GUEST;
      setCurrentUser(GUEST);
      setIsAuthenticated(false);
      await supabase.auth.signOut();
      return message;
    } finally {
      entering.current = false;
    }
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session && !cancelled) await enterSession();
      if (!cancelled) setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setPendingRegistration(null);
        userRef.current = GUEST;
        setCurrentUser(GUEST);
        setIsAuthenticated(false);
        setApplications([]);
        setFdrRecords([]);
        setAuditLogs([]);
      } else if (event === 'SIGNED_IN') {
        // Returning from Google: the session arrives via the URL after first render. (A password
        // sign-in starts its own session setup before this timer fires, so it is skipped then.)
        setTimeout(() => {
          if (!userRef.current.id && !entering.current) void enterSession();
        }, 0);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [enterSession]);

  // Live updates: any change an institution makes in the mobile app (or another officer makes here) reloads the data.
  useEffect(() => {
    if (!isAuthenticated) return;
    const channel = supabase.channel('staff-portal');
    ['applications', 'fdrs', 'fdr_requests', 'scrutiny'].forEach(table =>
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleRefresh)
    );
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAuthenticated, scheduleRefresh]);

  const loginWithPassword = async (email: string, password: string) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw toApiError(error);
    const refused = await enterSession();
    if (refused) throw toApiError({ message: `FORBIDDEN: ${refused}` });
  };

  const loginWithGoogle = async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname, queryParams: { prompt: 'select_account' } }
    });
    if (error) throw toApiError(error);
  };

  const register = async (email: string, password: string, details: StaffRegistration) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: window.location.origin + window.location.pathname, data: { full_name: details.fullName, registration: details } }
    });
    if (error) throw toApiError(error);
    if (!data.session) return 'CONFIRM_EMAIL';
    const refused = await enterSession();
    if (refused) throw toApiError({ message: `FORBIDDEN: ${refused}` });
    return 'SIGNED_IN';
  };

  const completeRegistration = async (details: StaffRegistration) => {
    await actions.completeRegistration(details);
    const refused = await enterSession();
    if (refused) throw toApiError({ message: `FORBIDDEN: ${refused}` });
  };

  const cancelRegistration = async () => {
    setPendingRegistration(null);
    await supabase.auth.signOut();
  };

  const sendPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + window.location.pathname });
    if (error) throw toApiError(error);
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  /* ---------------------------------------------------------------- navigation helpers */

  const openApplication = (appId: string) => {
    setSelectedAppId(appId);
    setScrutinyFilter('ALL');
    setActiveSidebarTab('verification_center');
  };
  const openQueue = (status: string) => {
    setScrutinyFilter(status);
    setActiveSidebarTab('verification_center');
  };

  /* ---------------------------------------------------------------- derived state */

  const activeApp = applications.find(a => a.id === selectedAppId) || applications[0] || null;

  const notifications = useMemo(
    () => buildNotifications(currentUser, applications, fdrRecords).map(n => ({ ...n, isRead: readIds.has(n.id) })),
    [currentUser, applications, fdrRecords, readIds]
  );

  const markNotificationRead = (id: string) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem(READ_KEY, JSON.stringify([...next].slice(-500)));
      } catch {
        /* storage unavailable: read state lasts for this session only */
      }
      return next;
    });
  };

  /* ---------------------------------------------------------------- actions */

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      throw toApiError(e);
    }
    await refresh();
  };

  const byId = (appId: string) => {
    const app = applications.find(a => a.id === appId);
    if (!app) throw toApiError({ message: 'NOT_FOUND: Application not found. Refresh and try again.' });
    return app;
  };

  const submitScrutinyDecision: AppContextType['submitScrutinyDecision'] = (appId, decision, rationale, points) =>
    run(() => actions.scrutinyDecision(byId(appId), decision, rationale, points));
  const startScrutiny = (appId: string) => run(() => actions.startScrutiny(appId));
  const finalDecision = (appId: string, approve: boolean, rationale: string) => run(() => actions.finalDecision(appId, approve, rationale));
  const overrideFinding = (_appId: string, findingId: string, rationale: string, citation: string) =>
    run(() => actions.overrideFinding(findingId, rationale, citation));
  const endorseLien = (fdrId: string, token: string) => run(() => actions.endorseLien(fdrId, token));
  const decideFdrRequest = (requestId: string, approve: boolean, note: string) => run(() => actions.decideFdrRequest(requestId, approve, note));

  // Simulated issuing-authority adapters (no live government integrations in this prototype).
  const pingAuthorityAdapter = (adapterId: string) =>
    setAuthorityAdapters(prev =>
      prev.map(a => (a.id === adapterId ? { ...a, status: 'VERIFIED', latencyMs: Math.floor(110 + Math.random() * 90), lastPingAt: new Date().toISOString() } : a))
    );
  const toggleAdapterDiscrepancy = (adapterId: string) =>
    setAuthorityAdapters(prev =>
      prev.map(a =>
        a.id === adapterId ? { ...a, status: a.status === 'DISCREPANCY_FOUND' ? 'VERIFIED' : 'DISCREPANCY_FOUND', lastPingAt: new Date().toISOString() } : a
      )
    );

  return (
    <AppContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        authReady,
        authError,
        loginWithPassword,
        loginWithGoogle,
        pendingRegistration,
        register,
        completeRegistration,
        cancelRegistration,
        sendPasswordReset,
        logout,
        loading,
        dataError,
        lastSyncedAt,
        refresh,
        applications,
        selectedAppId,
        setSelectedAppId,
        activeApp,
        fdrRecords,
        auditLogs,
        notifications,
        markNotificationRead,
        rules: INITIAL_RULES,
        authorityAdapters,
        pingAuthorityAdapter,
        toggleAdapterDiscrepancy,
        activeTab,
        setActiveTab,
        activeSidebarTab,
        setActiveSidebarTab,
        globalSearchQuery,
        setGlobalSearchQuery,
        isDisclaimerOpen,
        setIsDisclaimerOpen,
        scrutinyFilter,
        setScrutinyFilter,
        openApplication,
        openQueue,
        submitScrutinyDecision,
        startScrutiny,
        finalDecision,
        overrideFinding,
        endorseLien,
        decideFdrRequest
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
