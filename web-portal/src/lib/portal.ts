/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * Which staff portal this page is: the Officer portal (/officer) or the Admin console (/admin).
 * One build serves both; the path decides. VITE_PORTAL=officer|admin pins a dedicated deployment to one portal.
 * Institutions use the separate mobile app (INSTITUTION_APP_URL).
 */

import { UserRole } from '../types';

export type PortalId = 'officer' | 'admin';

export interface PortalConfig {
  id: PortalId;
  path: string;
  name: string;
  short: string;
  tagline: string;
  /** Roles allowed to sign in here (the server enforces what each role may do). */
  roles: UserRole[];
  /** Tailwind gradient stops used for this portal's accents. */
  accent: string;
  badge: string;
}

export const PORTALS: Record<PortalId, PortalConfig> = {
  officer: {
    id: 'officer',
    path: '/officer',
    name: 'Officer Portal',
    short: 'Officer',
    tagline: 'Scrutiny officers and bank officials',
    roles: ['REVIEWER', 'BANK_OFFICIAL'],
    accent: 'from-indigo-500 via-violet-500 to-fuchsia-500',
    badge: 'OFFICER PORTAL'
  },
  admin: {
    id: 'admin',
    path: '/admin',
    name: 'Admin Console',
    short: 'Admin',
    tagline: 'AICTE administrators: final approvals, FDR decisions, accounts',
    roles: ['ADMIN'],
    accent: 'from-rose-500 via-orange-500 to-amber-400',
    badge: 'ADMIN CONSOLE'
  }
};

function detect(): PortalId | null {
  const pinned = (import.meta.env.VITE_PORTAL || '').toLowerCase();
  if (pinned === 'officer' || pinned === 'admin') return pinned;
  if (typeof window === 'undefined') return null;
  const first = window.location.pathname.split('/').filter(Boolean)[0]?.toLowerCase();
  return first === 'officer' || first === 'admin' ? first : null;
}

/** Current portal, or null on the root page (which shows the portal chooser). */
export const PORTAL: PortalConfig | null = (() => {
  const id = detect();
  return id ? PORTALS[id] : null;
})();

/** Portal a role belongs to. */
export const portalForRole = (role: UserRole): PortalConfig | null =>
  role === 'ADMIN' ? PORTALS.admin : role === 'REVIEWER' || role === 'BANK_OFFICIAL' ? PORTALS.officer : null;

/** Absolute link to a portal on this site. */
export const portalUrl = (p: PortalConfig) => `${typeof window === 'undefined' ? '' : window.location.origin}${p.path}`;
