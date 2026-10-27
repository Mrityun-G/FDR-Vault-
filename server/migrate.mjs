// Applies the schema in order and records each file, so every file runs once. Never drops or deletes anything.
//   server/db/000_platform.sql  ->  supabase/migrations/*.sql (unchanged)  ->  server/db/900_postgres_compat.sql  ->  910_india_time.sql
// Usage: npm run db:migrate            (add --seed to load supabase/seed.sql + the demo accounts on an empty database;
//                                       add --reset-test-data too to then empty it like the live project: demo logins + empty DITS Delhi;
//                                       add --demo-data to load the full demo dataset for every portal, on any database, only adding rows)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { ROOT, config } from './config.mjs';

export function migrationFiles() {
  const dir = path.join(ROOT, 'supabase', 'migrations');
  return [
    path.join(ROOT, 'server', 'db', '000_platform.sql'),
    ...fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort().map(f => path.join(dir, f)),
    path.join(ROOT, 'server', 'db', '900_postgres_compat.sql'),
    path.join(ROOT, 'server', 'db', '910_india_time.sql'),
  ];
}

export const DEMO_PASSWORD = 'Sih@2026Demo';
export const DEMO_ACCOUNTS = ['sih_demo.institution@example.com', 'sih_demo.officer@example.com', 'sih_demo.bank@example.com', 'sih_demo.admin@example.com'];

export async function migrate(databaseUrl = config.databaseUrl, { seed = false, resetTestData = false, demoData = false, log = console.log, ssl = config.databaseSsl } = {}) {
  const client = new pg.Client({ connectionString: databaseUrl, ssl: ssl ? { rejectUnauthorized: false } : undefined });
  await client.connect();
  try {
    await client.query(`create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
    // The 900 file redefines functions created by later migrations, so it re-runs whenever a migration is applied.
    const done = new Set((await client.query('select name from public.schema_migrations')).rows.map(r => r.name));
    let applied = 0;
    for (const file of migrationFiles()) {
      const name = path.relative(ROOT, file).replace(/\\/g, '/');
      if (done.has(name) && !(applied && name.endsWith('900_postgres_compat.sql'))) continue;
      await client.query('begin');
      try {
        await client.query(fs.readFileSync(file, 'utf8'));
        await client.query('insert into public.schema_migrations(name) values ($1) on conflict (name) do update set applied_at = now()', [name]);
        await client.query('commit');
      } catch (e) {
        await client.query('rollback');
        throw new Error(`${name}: ${e.message}`);
      }
      applied++;
      log(`applied ${name}`);
    }
    log(applied ? `${applied} migration file(s) applied` : 'database schema is up to date');
    const seeded = seed && await seedDemo(client, log);
    // Same script the live project was emptied with: keeps only the 4 demo accounts and an empty DITS Delhi.
    // Only right after seeding an empty database, so this flag can sit in a start command without ever wiping real data.
    if (resetTestData && seeded) { await client.query(fs.readFileSync(path.join(ROOT, 'supabase', 'scripts', 'reset-test-data.sql'), 'utf8')); log('reset-test-data.sql applied'); }
    if (demoData) await loadDemoData(client, log);
  } finally {
    await client.end();
  }
}

// Demo data for an empty database: supabase/seed.sql (institutions incl. DITS Delhi) and the four evaluator logins
// listed in the README, created exactly as the README's SQL did on Supabase.
async function seedDemo(client, log) {
  if ((await client.query('select count(*)::int n from public.institutions')).rows[0].n) { log('seed skipped: database already has data'); return false; }
  await client.query(fs.readFileSync(path.join(ROOT, 'supabase', 'seed.sql'), 'utf8'));   // has its own begin/commit
  await client.query('begin');
  try {
    await client.query(`select set_config('aicte.service', 'on', true)`);
    await client.query(`select public.admin_invite_staff('sih_demo.officer@example.com', 'REVIEWER', 'Demo Scrutiny Officer', 'Scrutiny Officer')`);
    await client.query(`select public.admin_invite_staff('sih_demo.bank@example.com', 'BANK_OFFICIAL', 'Demo Bank Official', 'Branch Manager', 'State Bank of India')`);
    await client.query(`select public.admin_invite_staff('sih_demo.admin@example.com', 'ADMIN', 'Demo Administrator', 'Administrator')`);
    for (const email of DEMO_ACCOUNTS) {
      await client.query(`insert into auth.users(email, encrypted_password, email_confirmed_at) values ($1, crypt($2, gen_salt('bf', 10)), now())`, [email, DEMO_PASSWORD]);
    }
    await client.query(`select public.admin_link_user('sih_demo.institution@example.com', '1-10928371')`);
    await client.query(`update public.profiles set full_name = 'Dr. R. K. Sharma (Demo)', designation = 'Principal' where email = 'sih_demo.institution@example.com'`);
    await client.query('commit');
    log('seed.sql and the 4 demo accounts loaded');
    return true;
  } catch (e) {
    await client.query('rollback');
    throw new Error(`seed: ${e.message}`);
  }
}

// Full demo dataset (applications, FDRs, requests, tickets ... for every portal) on top of seed.sql's records.
// Both files skip rows that already exist; seed.sql is only re-run while its records are missing (e.g. after reset-test-data).
async function loadDemoData(client, log) {
  const sql = file => fs.readFileSync(path.join(ROOT, 'supabase', ...file.split('/')), 'utf8');
  if (!(await client.query(`select 1 from public.applications where application_number = 'APP-2026-EOA-1082'`)).rowCount) await client.query(sql('seed.sql'));
  await client.query(sql('scripts/load-demo-data.sql'));
  const { rows: [n] } = await client.query(`select (select count(*)::int from public.institutions) i, (select count(*)::int from public.applications) a, (select count(*)::int from public.fdrs) f`);
  log(`demo data loaded: ${n.i} institutions, ${n.a} applications, ${n.f} FDRs`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!config.databaseUrl) { console.error('DATABASE_URL is not set (see .env.example)'); process.exit(1); }
  migrate(config.databaseUrl, { seed: process.argv.includes('--seed'), resetTestData: process.argv.includes('--reset-test-data'), demoData: process.argv.includes('--demo-data') }).catch(e => { console.error(e.message); process.exit(1); });
}
