/* Deployment configuration.
   Leave API_URL empty to run in local DEMO mode (data stays on the device).
   Set it to the address of the project's API server (server/, Node.js + PostgreSQL) to use the real backend.
   On Vercel, set the AICTE_API_URL environment variable instead: the build writes it here.
   No keys or secrets belong in this file — the API server holds them. */
window.AICTE_CONFIG = {
  API_URL: '',
  STORAGE_BUCKET: 'institution-documents',
  SSO_DOMAIN: '',              // Government SSO is not available on the standalone server; leave empty
  API_CLIENT_URL: 'api-client.js',
};
