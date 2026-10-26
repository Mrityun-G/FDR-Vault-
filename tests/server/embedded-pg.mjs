// TEST ONLY: starts a throw-away real PostgreSQL 17 server (embedded-postgres) in tests/output/pg-<port>.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'output');

export async function startPostgres(port = 54329) {
  const databaseDir = path.join(OUT, `pg-${port}`);
  fs.rmSync(databaseDir, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  // A non-superuser owner, like a hosted database account, so the tests do not rely on superuser rights.
  const pg = new EmbeddedPostgres({ databaseDir, port, user: 'postgres', password: 'postgres', persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], onLog: () => {}, onError: () => {} });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('fdrvault');
  const admin = pg.getPgClient('fdrvault');
  await admin.connect();
  await admin.query(`create role fdrvault_app login password 'app-pass' createrole`);
  await admin.query(`alter database fdrvault owner to fdrvault_app`);
  await admin.query(`grant all on schema public to fdrvault_app`);
  await admin.query(`alter schema public owner to fdrvault_app`);
  await admin.end();
  return {
    url: `postgres://fdrvault_app:app-pass@127.0.0.1:${port}/fdrvault`,
    superUrl: `postgres://postgres:postgres@127.0.0.1:${port}/fdrvault`,
    stop: () => pg.stop(),
  };
}
