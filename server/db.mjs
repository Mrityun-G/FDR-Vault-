// PostgreSQL access. Every client request runs in its own transaction as the database role "authenticated"
// (or "anon") with the caller's user id set, so the schema's grants and row-level security policies decide
// what each request may read or change — exactly as before the migration.
import pg from 'pg';
import { config } from './config.mjs';

// Return dates as plain strings (as the previous API did), not JS Date objects.
pg.types.setTypeParser(1082, v => v);

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: config.dbPoolSize,
});

async function tx(fn, setup) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await setup(client);
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Runs fn(client) as the signed-in user (uid) or as an anonymous caller (uid = null), under RLS. */
export function asUser(uid, fn) {
  return tx(fn, async c => {
    await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid || '']);
    await c.query(uid ? 'set local role authenticated' : 'set local role anon');
  });
}

/** Runs fn(client) as the server itself: no user, recognised by public._is_service(). */
export function asService(fn) {
  return tx(fn, c => c.query(`select set_config('request.jwt.claim.sub', '', true), set_config('aicte.service', 'on', true)`));
}

/** Plain query as the server's own role (auth tables, migrations). */
export const query = (text, params) => pool.query(text, params);
