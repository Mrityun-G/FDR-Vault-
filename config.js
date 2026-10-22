/* Deployment configuration.
   Leave SUPABASE_URL / SUPABASE_ANON_KEY empty to run in local DEMO mode (data stays on the device).
   Fill them in (Supabase Dashboard → Project Settings → API) to use the Supabase backend.
   The anon key is a public, RLS-restricted key — never put the service_role key here. */
window.AICTE_CONFIG = {
  SUPABASE_URL: 'https://vugrvrphquujgzttqtun.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1Z3J2cnBocXV1amd6dHRxdHVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2NzYwNDgsImV4cCI6MjEwODI1MjA0OH0.U8SPo2ZDthd2IH0PC8xgF7aO4T1BU7kFMP4EUgb_O2M',
  STORAGE_BUCKET: 'institution-documents',
  SSO_DOMAIN: '',              // optional: SAML SSO domain configured in Supabase Auth (e.g. 'aicte-india.org')
  SUPABASE_JS_URL: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js',
};
