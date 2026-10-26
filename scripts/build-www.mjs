// Copies only the web app files into www/ (the Capacitor webDir) — no tests, SQL or node_modules in the APK.
// If AICTE_API_URL is set (e.g. a Vercel environment variable), it is written into www/config.js as API_URL.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'www');
const FILES = ['index.html', 'styles.css', 'config.js', 'data.js', 'backend.js', 'api-client.js', 'app.js', 'i18n.js', 'sw.js', 'manifest.webmanifest',
  'emblem.png', 'fdr-vault-logo.png', 'fdr-vault-mark.png', 'delhi.webp', 'mumbai.webp', 'icon-192.png', 'icon-512.png'];
const DIRS = ['members'];
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const f of FILES) if (fs.existsSync(path.join(root, f))) fs.copyFileSync(path.join(root, f), path.join(out, f));
for (const d of DIRS) fs.cpSync(path.join(root, d), path.join(out, d), { recursive: true });
if (process.env.AICTE_API_URL) {
  const cfg = path.join(out, 'config.js');
  fs.writeFileSync(cfg, fs.readFileSync(cfg, 'utf8').replace(/API_URL: '[^']*'/, `API_URL: ${JSON.stringify(process.env.AICTE_API_URL.replace(/\/$/, ''))}`));
  console.log(`API_URL = ${process.env.AICTE_API_URL}`);
}
console.log(`www/ ready (${fs.readdirSync(out).length} files)`);
