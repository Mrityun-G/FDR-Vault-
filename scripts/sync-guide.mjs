// Copies guide.js (the Evaluator Guide chat) into the staff portal's public/ folder so both sites ship the same file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.copyFileSync(path.join(root, 'guide.js'), path.join(root, 'web-portal', 'public', 'guide.js'));
console.log('web-portal/public/guide.js updated');
