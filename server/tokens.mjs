// Signed access tokens (HS256 JWT), random secrets and hashing. Only hashes of refresh tokens and one-time codes are stored.
import crypto from 'node:crypto';

const b64u = v => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('base64url');

export function signJwt(payload, secret) {
  const head = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u(payload)}`;
  return `${head}.${hmac(secret, head)}`;
}

/** Returns the payload of a valid, unexpired token, or null. */
export function verifyJwt(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const expected = Buffer.from(hmac(secret, `${parts[0]}.${parts[1]}`));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const head = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (head.alg !== 'HS256' || !payload.exp || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch { return null; }
}

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');
export const otpCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

/** Short-lived signature for a storage download link. */
export const signPath = (secret, path, exp) => hmac(secret, `storage:${path}:${exp}`);
export function verifyPathSig(secret, path, exp, sig) {
  if (!exp || +exp * 1000 < Date.now()) return false;
  const a = Buffer.from(signPath(secret, path, exp)), b = Buffer.from(String(sig || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// In-memory fixed-window rate limiter (per process) for sign-in, OTP and email endpoints.
const hits = new Map();
export function rateLimited(key, max, windowMs) {
  const now = Date.now(), h = hits.get(key);
  if (!h || h.reset < now) { hits.set(key, { n: 1, reset: now + windowMs }); return false; }
  h.n++;
  return h.n > max;
}
setInterval(() => { const now = Date.now(); for (const [k, h] of hits) if (h.reset < now) hits.delete(k); }, 60_000).unref();
