// TEST ONLY — runs the staff web portal (web-portal/) on :3100 pointed at the integration-test API server (:8790, npm run e2e:server).
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'web-portal');
const child = spawn('npx', ['vite', '--port', '3100', '--strictPort', '--host', '127.0.0.1'], {
  cwd,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, VITE_API_URL: 'http://127.0.0.1:8790', VITE_INSTITUTION_APP_URL: 'http://127.0.0.1:8790' }
});
child.on('exit', code => process.exit(code ?? 0));
