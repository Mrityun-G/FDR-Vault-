// Server configuration from environment variables (see .env.example). Secrets never leave the server.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Minimal .env loader (KEY=value lines); real environment variables take precedence.
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const env = process.env;
const list = v => (v || '').split(',').map(s => s.trim()).filter(Boolean);

export const config = {
  port: +(env.PORT || 8787),
  publicUrl: (env.PUBLIC_URL || `http://localhost:${env.PORT || 8787}`).replace(/\/$/, ''),
  databaseUrl: env.DATABASE_URL,
  databaseSsl: env.DATABASE_SSL === 'true',
  dbPoolSize: +(env.DB_POOL_SIZE || 10),
  jwtSecret: env.JWT_SECRET,
  accessTokenTtl: +(env.ACCESS_TOKEN_TTL_SECONDS || 3600),
  refreshTokenTtlDays: +(env.REFRESH_TOKEN_TTL_DAYS || 30),
  // Front-end origins allowed to call the API and to be redirected back to after email links / Google sign-in.
  allowedOrigins: list(env.ALLOWED_ORIGINS),
  smtp: env.SMTP_HOST ? { host: env.SMTP_HOST, port: +(env.SMTP_PORT || 587), secure: env.SMTP_SECURE === 'true', user: env.SMTP_USER, pass: env.SMTP_PASS } : null,
  mailFrom: env.MAIL_FROM || 'AICTE Portal <no-reply@localhost>',
  // Without SMTP, accounts are confirmed at sign-up (there is no way to deliver the link).
  requireEmailConfirmation: env.REQUIRE_EMAIL_CONFIRMATION ? env.REQUIRE_EMAIL_CONFIRMATION === 'true' : !!env.SMTP_HOST,
  google: env.GOOGLE_CLIENT_ID ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET,
    authUrl: env.GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth', tokenUrl: env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token' } : null,
  anthropicApiKey: env.ANTHROPIC_API_KEY || '',
  runScheduler: env.RUN_SCHEDULER !== 'false',
};

export function assertConfig() {
  const missing = ['DATABASE_URL', 'JWT_SECRET'].filter(k => !env[k]);
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')} (see .env.example)`);
  if (env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters.');
}
