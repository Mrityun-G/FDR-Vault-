// Authentication (replaces Supabase Auth): email + password, email confirmation, email OTP, password reset,
// Google sign-in, sessions with rotating refresh tokens. Creating a row in auth.users fires the existing
// handle_new_user trigger, so registration, invites and roles work exactly as before.
import express from 'express';
import { config } from './config.mjs';
import { query } from './db.mjs';
import { mail } from './mail.mjs';
import { signJwt, verifyJwt, randomToken, sha256, otpCode, rateLimited } from './tokens.mjs';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const fail = (res, status, message, extra = {}) => res.status(status).json({ message, ...extra });
const normEmail = e => String(e || '').trim().toLowerCase();

/** Only our own front ends may be redirected to after an email link or Google sign-in (no open redirects). */
export function safeRedirect(url) {
  try {
    const u = new URL(url);
    const local = !config.allowedOrigins.length && ['localhost', '127.0.0.1'].includes(u.hostname);
    return (local || config.allowedOrigins.includes(u.origin)) && /^https?:$/.test(u.protocol) ? u.toString() : null;
  } catch { return null; }
}
const withParams = (url, params) => { const u = new URL(url); for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v); return u.toString(); };

const publicUser = u => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: u.email_confirmed_at,
  user_metadata: u.raw_user_meta_data || {}, app_metadata: u.raw_app_meta_data || {}, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at });

async function issueSession(user) {
  const refresh = randomToken();
  const { rows: [s] } = await query(`insert into auth.sessions(user_id, refresh_token_hash, expires_at) values ($1, $2, now() + make_interval(days => $3)) returning id`,
    [user.id, sha256(refresh), config.refreshTokenTtlDays]);
  await query('update auth.users set last_sign_in_at = now() where id = $1', [user.id]);
  return sessionResponse(user, s.id, refresh);
}
function sessionResponse(user, sid, refresh) {
  const now = Math.floor(Date.now() / 1000), exp = now + config.accessTokenTtl;
  const access = signJwt({ sub: user.id, email: user.email, role: 'authenticated', sid, iat: now, exp }, config.jwtSecret);
  return { access_token: access, token_type: 'bearer', expires_in: config.accessTokenTtl, expires_at: exp, refresh_token: refresh, user: publicUser(user) };
}

async function newOneTimeToken(userId, kind, minutes, { redirectTo = null, value = randomToken() } = {}) {
  await query(`update auth.one_time_tokens set used_at = now() where user_id = $1 and kind = $2 and used_at is null`, [userId, kind]);
  await query(`insert into auth.one_time_tokens(user_id, kind, token_hash, redirect_to, expires_at) values ($1, $2, $3, $4, now() + make_interval(mins => $5))`,
    [userId, kind, sha256(value), redirectTo, minutes]);
  return value;
}
async function useOneTimeToken(kinds, value, userId = null) {
  const { rows: [t] } = await query(`update auth.one_time_tokens set used_at = now()
      where id = (select id from auth.one_time_tokens where kind = any($1) and token_hash = $2 and used_at is null and expires_at > now()
                    and ($3::uuid is null or user_id = $3) limit 1)
      returning user_id, kind, redirect_to`, [kinds, sha256(value), userId]);
  return t || null;
}
const userById = async id => (await query('select * from auth.users where id = $1', [id])).rows[0];
const userByEmail = async email => (await query('select * from auth.users where lower(email) = $1', [normEmail(email)])).rows[0];
const verifyLink = (token, type, redirectTo) => `${config.publicUrl}/auth/verify?${new URLSearchParams({ token, type, ...(redirectTo ? { redirect_to: redirectTo } : {}) })}`;

// pg errors raised by the registration trigger ("CODE: message" + JSON detail) pass through unchanged.
const dbError = (res, e) => fail(res, 400, e.message, { details: e.detail || null, code: e.code });

/** Express middleware: sets req.uid / req.sid / req.email from a valid Bearer access token of a live session. */
export async function authenticate(req, res, next) {
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!bearer) return next();
  const p = verifyJwt(bearer, config.jwtSecret);
  let live = false;
  try { live = !!p && (await query('select 1 from auth.sessions where id = $1 and user_id = $2 and revoked_at is null and expires_at > now()', [p.sid, p.sub])).rowCount > 0; }
  catch (e) { return next(e); }
  if (live) { req.uid = p.sub; req.sid = p.sid; req.email = p.email; } else req.expiredToken = true;
  next();
}
/** Routes that need a signed-in user. An expired/revoked token gets "JWT expired" so the client refreshes or signs out. */
export const requireUser = (req, res, next) => (req.uid ? next()
  : req.expiredToken ? fail(res, 401, 'JWT expired', { code: 'SESSION_EXPIRED' }) : fail(res, 401, 'NOT_AUTHENTICATED: Sign in to continue.'));

export const authRouter = express.Router();

authRouter.post('/signup', async (req, res) => {
  const email = normEmail(req.body.email), password = String(req.body.password || '');
  if (!EMAIL_RE.test(email)) return fail(res, 400, 'Enter a valid email address.');
  if (password.length < 8) return fail(res, 400, 'Password should be at least 8 characters.');
  if (rateLimited(`signup:${req.ip}`, 10, 3600_000)) return fail(res, 429, 'Too many requests. Please wait and try again.');
  if (await userByEmail(email)) return fail(res, 422, 'User already registered');
  const redirectTo = req.body.redirect_to ? safeRedirect(req.body.redirect_to) : null;
  let user;
  try {
    user = (await query(`insert into auth.users(email, encrypted_password, raw_user_meta_data, email_confirmed_at)
        values ($1, crypt($2, gen_salt('bf', 10)), $3, case when $4 then null else now() end) returning *`,
      [email, password, req.body.data || {}, config.requireEmailConfirmation])).rows[0];
  } catch (e) { return e.code === '23505' ? fail(res, 422, 'User already registered') : dbError(res, e); }
  if (config.requireEmailConfirmation) {
    const token = await newOneTimeToken(user.id, 'confirmation', 24 * 60, { redirectTo });
    await mail.confirmation(email, verifyLink(token, 'signup', redirectTo));
    return res.json({ user: publicUser(user), session: null });
  }
  const session = await issueSession(user);
  res.json({ user: session.user, session });
});

authRouter.post('/token', async (req, res) => {
  const grant = req.query.grant_type;
  if (grant === 'password') {
    const email = normEmail(req.body.email);
    if (rateLimited(`login:${req.ip}`, 30, 600_000) || rateLimited(`login:${email}`, 10, 600_000)) return fail(res, 429, 'Too many attempts. Please wait a minute and try again.');
    const { rows: [u] } = await query(`select *, encrypted_password is not null and encrypted_password = crypt($2, encrypted_password) as ok from auth.users where lower(email) = $1`,
      [email, String(req.body.password || '')]);
    if (!u || !u.ok) return fail(res, 400, 'Invalid login credentials');
    if (!u.email_confirmed_at) return fail(res, 400, 'Email not confirmed');
    return res.json(await issueSession(u));
  }
  if (grant === 'refresh_token') {
    const refresh = String(req.body.refresh_token || ''), next = randomToken();
    const { rows: [s] } = await query(`update auth.sessions set refresh_token_hash = $2, refreshed_at = now()
        where refresh_token_hash = $1 and revoked_at is null and expires_at > now() returning id, user_id`, [sha256(refresh), sha256(next)]);
    if (!s) return fail(res, 401, 'Invalid Refresh Token: Refresh Token Not Found', { code: 'SESSION_EXPIRED' });
    return res.json(sessionResponse(await userById(s.user_id), s.id, next));
  }
  fail(res, 400, 'Unsupported grant type');
});

authRouter.post('/otp', async (req, res) => {
  const email = normEmail(req.body.email);
  if (!EMAIL_RE.test(email)) return fail(res, 400, 'Enter a valid email address.');
  if (rateLimited(`otp:${email}`, 1, 60_000) || rateLimited(`otp:${req.ip}`, 20, 3600_000)) return fail(res, 429, 'For security purposes, you can only request this after 60 seconds.');
  const u = await userByEmail(email);
  if (!u) return fail(res, 422, 'Signups not allowed for otp');   // sign-in codes are only for existing accounts
  const code = await newOneTimeToken(u.id, 'email_otp', 10, { value: otpCode() });
  await mail.otp(u.email, code);
  res.json({});
});

authRouter.post('/verify', async (req, res) => {
  const u = await userByEmail(req.body.email), code = String(req.body.token || '').trim();
  if (!u || rateLimited(`verify:${u.id}`, 5, 600_000)) return fail(res, 400, 'Token has expired or is invalid');
  const t = await useOneTimeToken(['email_otp'], code, u.id);
  if (!t) return fail(res, 400, 'Token has expired or is invalid');
  await query('update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = $1', [u.id]);   // the code proves the address
  const session = await issueSession(await userById(u.id));
  res.json({ user: session.user, session });
});

authRouter.post('/recover', async (req, res) => {
  const email = normEmail(req.body.email), redirectTo = req.body.redirect_to ? safeRedirect(req.body.redirect_to) : null;
  if (rateLimited(`recover:${email}`, 1, 60_000)) return fail(res, 429, 'For security purposes, you can only request this after 60 seconds.');
  const u = await userByEmail(email);
  if (u) { const token = await newOneTimeToken(u.id, 'recovery', 60, { redirectTo }); await mail.recovery(u.email, verifyLink(token, 'recovery', redirectTo)); }
  res.json({});   // same answer whether or not the account exists
});

// Email links land here, then return to the app with a single-use code it exchanges for a session (tokens never appear in URLs).
authRouter.get('/verify', async (req, res) => {
  const t = await useOneTimeToken(['confirmation', 'recovery'], String(req.query.token || ''));
  const back = (t && t.redirect_to) || safeRedirect(String(req.query.redirect_to || ''));
  if (!t) return back ? res.redirect(withParams(back, { auth_error: 'Email link is invalid or has expired' })) : res.status(400).type('text').send('This link is invalid or has expired.');
  if (t.kind === 'confirmation') await query('update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = $1', [t.user_id]);
  const type = t.kind === 'recovery' ? 'recovery' : 'signup';
  if (!back) return res.type('text').send(type === 'recovery' ? 'Link verified. Open the portal to continue.' : 'Email confirmed. You can now sign in.');
  const code = await newOneTimeToken(t.user_id, 'auth_code', 5);
  res.redirect(withParams(back, { auth_code: code, auth_type: type }));
});

authRouter.post('/exchange', async (req, res) => {
  const t = await useOneTimeToken(['auth_code'], String(req.body.code || ''));
  if (!t) return fail(res, 400, 'Sign-in link is invalid or has expired');
  res.json(await issueSession(await userById(t.user_id)));
});

authRouter.get('/user', requireUser, async (req, res) => res.json(publicUser(await userById(req.uid))));

authRouter.put('/user', requireUser, async (req, res) => {
  const password = req.body.password;
  if (password !== undefined) {
    if (String(password).length < 8) return fail(res, 400, 'Password should be at least 8 characters.');
    await query(`update auth.users set encrypted_password = crypt($2, gen_salt('bf', 10)), updated_at = now() where id = $1`, [req.uid, String(password)]);
  }
  res.json(publicUser(await userById(req.uid)));
});

authRouter.post('/logout', requireUser, async (req, res) => {
  await query('update auth.sessions set revoked_at = now() where id = $1', [req.sid]);
  res.status(204).end();
});

// ---------------------------------------------------------------- Google sign-in (OAuth 2.0 authorization code flow)

authRouter.get('/authorize', (req, res) => {
  const back = safeRedirect(String(req.query.redirect_to || ''));
  if (req.query.provider !== 'google' || !config.google) return fail(res, 400, 'Google sign-in is not configured on this server.');
  if (!back) return fail(res, 400, 'Redirect address is not allowed.');
  const state = signJwt({ purpose: 'google', back, nonce: randomToken(12), exp: Math.floor(Date.now() / 1000) + 600 }, config.jwtSecret);
  const params = new URLSearchParams({ client_id: config.google.clientId, redirect_uri: `${config.publicUrl}/auth/callback`, response_type: 'code',
    scope: 'openid email profile', state, ...(req.query.prompt ? { prompt: String(req.query.prompt) } : {}) });
  res.redirect(`${config.google.authUrl}?${params}`);
});

authRouter.get('/callback', async (req, res) => {
  const st = verifyJwt(String(req.query.state || ''), config.jwtSecret);
  if (!st || st.purpose !== 'google') return res.status(400).type('text').send('Sign-in request expired. Please try again.');
  const back = msg => res.redirect(withParams(st.back, { auth_error: msg }));
  if (req.query.error || !req.query.code) return back('Google sign-in was cancelled');
  try {
    const r = await fetch(config.google.tokenUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: String(req.query.code), client_id: config.google.clientId, client_secret: config.google.clientSecret,
        redirect_uri: `${config.publicUrl}/auth/callback`, grant_type: 'authorization_code' }) });
    const tok = await r.json();
    if (!r.ok || !tok.id_token) return back('Google sign-in failed');
    // The ID token comes straight from Google's token endpoint over TLS (OIDC Core 3.1.3.7), so its claims are checked, not its signature.
    const id = JSON.parse(Buffer.from(tok.id_token.split('.')[1], 'base64url').toString());
    if (id.aud !== config.google.clientId || !['accounts.google.com', 'https://accounts.google.com'].includes(id.iss) || id.exp * 1000 < Date.now()) return back('Google sign-in failed');
    if (!id.email || id.email_verified === false || id.email_verified === 'false') return back('Your Google account email is not verified');
    const email = normEmail(id.email);
    let user = (await query(`select u.* from auth.identities i join auth.users u on u.id = i.user_id where i.provider = 'google' and i.provider_id = $1`, [id.sub])).rows[0];
    if (!user) {
      user = await userByEmail(email);
      if (user) await query('update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = $1', [user.id]);
      else user = (await query(`insert into auth.users(email, raw_user_meta_data, email_confirmed_at) values ($1, $2, now()) returning *`,
        [email, { full_name: id.name || '', name: id.name || '', avatar_url: id.picture || '', email, provider: 'google' }])).rows[0];
      await query(`insert into auth.identities(provider, provider_id, user_id, email) values ('google', $1, $2, $3) on conflict do nothing`, [id.sub, user.id, email]);
    }
    // Keep the Google profile photo current; the apps show it as the account picture. Only Google's own image host is accepted.
    if (/^https:\/\/[a-z0-9-]+\.googleusercontent\.com\//.test(id.picture || ''))
      await query(`update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('avatar_url', $2::text) where id = $1`, [user.id, id.picture]);
    const code = await newOneTimeToken(user.id, 'auth_code', 5);
    res.redirect(withParams(st.back, { auth_code: code, auth_type: 'signin' }));
  } catch (e) {
    console.error('google callback', e);
    back(/^[A-Z_]+: /.test(e.message) ? e.message.replace(/^[A-Z_]+: /, '') : 'Google sign-in failed');
  }
});
