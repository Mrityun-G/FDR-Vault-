/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * Client for the project's API server (Node.js + PostgreSQL), shared with the institution mobile app (same server, same database).
 * Holds no secrets: the server's row-level security and workflow functions protect the data.
 */

import './api-client.js';
import { PORTAL } from './portal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export const DOCUMENTS_BUCKET = 'institution-documents';

/** Public address of the institution mobile app / PWA (institutions sign in there, not here). */
export const INSTITUTION_APP_URL = import.meta.env.VITE_INSTITUTION_APP_URL || 'https://fdr-vault.vercel.app';

type Result<T = any> = Promise<{ data: T; error: any }>;
export type AuthEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'PASSWORD_RECOVERY' | 'AUTH_ERROR';
export interface Session { access_token: string; refresh_token: string; expires_at: number; user: { id: string; email: string } }
interface Channel { on(type: string, filter: Record<string, unknown>, cb: (payload: unknown) => void): Channel; subscribe(): Channel }

/** The API client's surface (see api-client.js). */
export interface ApiClient {
  auth: {
    getSession(): Result<{ session: Session | null }>;
    getUser(): Result<{ user: { id: string; email: string } | null }>;
    onAuthStateChange(cb: (event: AuthEvent, session: Session | null) => void): { data: { subscription: { unsubscribe(): void } } };
    signInWithPassword(p: { email: string; password: string }): Result<{ session: Session | null; user: any }>;
    signUp(p: { email: string; password: string; options?: { emailRedirectTo?: string; data?: Record<string, unknown> } }): Result<{ session: Session | null; user: any }>;
    signInWithOAuth(p: { provider: 'google'; options?: { redirectTo?: string; queryParams?: Record<string, string> } }): Result<{ provider: string; url: string }>;
    resetPasswordForEmail(email: string, o?: { redirectTo?: string }): Result;
    updateUser(attrs: { password?: string }): Result;
    signOut(): Promise<{ error: any }>;
  };
  rpc<T = any>(fn: string, args?: Record<string, unknown>): Result<T>;
  data<T = any>(view: string): Result<T>;
  storage: { from(bucket: string): { createSignedUrl(path: string, expiresIn: number): Result<{ signedUrl: string }> } };
  channel(name: string): Channel;
  removeChannel(ch: Channel): Promise<string>;
}

export const api: ApiClient = (globalThis as any).AicteApi.createClient(API_URL, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: `aicte-staff-auth-${PORTAL?.id || 'root'}` }
});
