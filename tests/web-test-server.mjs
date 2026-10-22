// TEST ONLY — runs the staff web portal (web-portal/) on :3100 pointed at the local Supabase stand-in (:8790).
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'web-portal');
const child = spawn('npx', ['vite', '--port', '3100', '--strictPort', '--host', '127.0.0.1'], {
  cwd,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, VITE_SUPABASE_URL: 'http://127.0.0.1:8790', VITE_SUPABASE_ANON_KEY: 'anon-test-key', VITE_INSTITUTION_APP_URL: 'http://127.0.0.1:8790' }
});
child.on('exit', code => process.exit(code ?? 0));
