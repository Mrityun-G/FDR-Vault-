/* Deployment configuration.
   Leave SUPABASE_URL / SUPABASE_ANON_KEY empty to run in local DEMO mode (data stays on the device).
   Fill them in (Supabase Dashboard → Project Settings → API) to use the Supabase backend.
   The anon key is a public, RLS-restricted key — never put the service_role key here. */
window.AICTE_CONFIG = {
  SUPABASE_URL: 'https://csnindvgpfphcstjcsag.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzbmluZHZncGZwaGNzdGpjc2FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2ODY1NzMsImV4cCI6MjEwODI2MjU3M30.QxLJF4SnD6k5gGt6aXYE3LF4Fll2m1T104HcT3DAsW8',
  STORAGE_BUCKET: 'institution-documents',
  SSO_DOMAIN: '',              // optional: SAML SSO domain configured in Supabase Auth (e.g. 'aicte-india.org')
  SUPABASE_JS_URL: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js',
};
