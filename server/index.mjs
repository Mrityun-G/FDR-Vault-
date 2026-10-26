// AICTE FDR Vault API server (Node.js + Express + PostgreSQL).   npm run server
import { config, assertConfig } from './config.mjs';
import { createApp } from './app.mjs';
import { startChangeListener, startScheduler } from './api.mjs';
import { migrate } from './migrate.mjs';

assertConfig();
if (process.env.MIGRATE_ON_START === 'true') await migrate();
await startChangeListener();
if (config.runScheduler) startScheduler();
createApp().listen(config.port, () => console.log(`API listening on ${config.publicUrl} (port ${config.port})`));
