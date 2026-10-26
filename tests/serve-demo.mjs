// TEST ONLY — serves the app on :8765 with an empty API_URL config.js, so the demo / onboarding / Hindi
// browser tests run in on-device demo mode even when config.js points at a live API server.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.env.PORT || 8765);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const DEMO_CONFIG = `window.AICTE_CONFIG = { API_URL: '', STORAGE_BUCKET: 'institution-documents', SSO_DOMAIN: '', API_CLIENT_URL: 'api-client.js' };`;

http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/config.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(DEMO_CONFIG); }
  const file = path.join(ROOT, p === '/' ? 'index.html' : p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`demo-mode app on http://127.0.0.1:${PORT}`));
