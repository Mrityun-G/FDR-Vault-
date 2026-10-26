// Copies only the web app files into www/ (the Capacitor webDir) — no tests, SQL or node_modules in the APK.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'www');
const FILES = ['index.html', 'styles.css', 'config.js', 'data.js', 'backend.js', 'app.js', 'guide.js', 'i18n.js', 'sw.js', 'manifest.webmanifest',
  'emblem.png', 'delhi.webp', 'mumbai.webp', 'icon-192.png', 'icon-512.png'];
const DIRS = ['members'];
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const f of FILES) if (fs.existsSync(path.join(root, f))) fs.copyFileSync(path.join(root, f), path.join(out, f));
for (const d of DIRS) fs.cpSync(path.join(root, d), path.join(out, d), { recursive: true });
console.log(`www/ ready (${fs.readdirSync(out).length} files)`);
