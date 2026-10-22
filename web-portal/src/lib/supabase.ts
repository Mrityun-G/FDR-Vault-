/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * Supabase client shared with the institution mobile app (same project, same database).
 * The anon key is public by design; row-level security and server functions protect the data.
 */

import { createClient } from '@supabase/supabase-js';
import { PORTAL } from './portal';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://csnindvgpfphcstjcsag.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzbmluZHZncGZwaGNzdGpjc2FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2ODY1NzMsImV4cCI6MjEwODI2MjU3M30.QxLJF4SnD6k5gGt6aXYE3LF4Fll2m1T104HcT3DAsW8';

export const DOCUMENTS_BUCKET = 'institution-documents';

/** Public address of the institution mobile app / PWA (institutions sign in there, not here). */
export const INSTITUTION_APP_URL = import.meta.env.VITE_INSTITUTION_APP_URL || 'https://fdr-vault.vercel.app';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: `aicte-staff-auth-${PORTAL?.id || 'root'}` }
});
