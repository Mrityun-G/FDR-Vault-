/* AICTE API client: browser side of the project's own Node.js + PostgreSQL API (server/).
   Keeps the calling convention the portals already use ({ data, error } results; auth events SIGNED_IN, SIGNED_OUT,
   PASSWORD_RECOVERY, TOKEN_REFRESHED), so the application code stays unchanged. Holds no secrets: the API decides
   every permission. Shared by the institution app (classic script -> window.AicteApi) and the staff portal (imported).
   Keep web-portal/src/lib/api-client.js identical: npm run sync:api-client */
(function (root) {
  'use strict';

  function createClient(url, options) {
    const base = String(url || '').replace(/\/$/, '');
    const authOpts = (options && options.auth) || {};
    const store = authOpts.storage || {
      getItem: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
      setItem: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
      removeItem: k => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
    };
    const key = authOpts.storageKey || 'aicte-api-auth';
    const listeners = new Set();
    let session = null, refreshing = null, refreshTimer = 0, redirectError = null;
    try { session = JSON.parse(store.getItem(key) || 'null'); } catch (e) { session = null; }

    const emit = (event, s) => listeners.forEach(cb => { try { cb(event, s); } catch (e) { setTimeout(() => { throw e; }); } });
    function setSession(s) {
      session = s;
      clearTimeout(refreshTimer);
      if (s) {
        store.setItem(key, JSON.stringify(s));
        if (authOpts.autoRefreshToken !== false) refreshTimer = setTimeout(() => refresh().catch(() => {}), Math.max(10, s.expires_at - 60 - Date.now() / 1000) * 1000);
      } else store.removeItem(key);
    }

    async function http(method, path, opts) {
      const o = opts || {};
      const headers = {};
      if (o.auth !== false && session) headers.authorization = 'Bearer ' + session.access_token;
      let body;
      if (o.raw !== undefined) { body = o.raw; headers['content-type'] = o.contentType || 'application/octet-stream'; }
      else if (o.body !== undefined) { body = JSON.stringify(o.body); headers['content-type'] = 'application/json'; }
      let res;
      try { res = await fetch(base + path, { method, headers, body }); }
      catch (e) { return { data: null, error: { message: (e && e.message) || 'Failed to fetch', status: 0 } }; }
      const text = await res.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch (e) { json = { message: text }; }
      if (res.ok) return { data: json, error: null, status: res.status };
      const err = Object.assign({ message: 'Request failed' }, json && typeof json === 'object' ? json : {}, { status: res.status });
      err.context = { status: res.status, json: async () => json };
      return { data: null, error: err, status: res.status };
    }

    // Authenticated request: refreshes an expiring token first, retries once after "JWT expired", else signs out.
    async function call(method, path, opts) {
      await ready;
      if (session && session.expires_at - 30 < Date.now() / 1000) await refresh().catch(() => {});
      let r = await http(method, path, opts);
      if (r.status === 401 && r.error && r.error.message === 'JWT expired' && session) {
        if (await refresh().then(() => true, () => false)) r = await http(method, path, opts);
        else { setSession(null); emit('SIGNED_OUT', null); }
      }
      return r;
    }

    function refresh() {
      if (!session) return Promise.reject(new Error('No session'));
      if (!refreshing) {
        refreshing = http('POST', '/auth/token?grant_type=refresh_token', { auth: false, body: { refresh_token: session.refresh_token } }).then(r => {
          refreshing = null;
          if (r.error) {
            if (r.status) { setSession(null); emit('SIGNED_OUT', null); }   // network errors keep the session for a retry
            throw r.error;
          }
          setSession(r.data);
          emit('TOKEN_REFRESHED', r.data);
          return r.data;
        });
      }
      return refreshing;
    }

    async function signedIn(r, event) {
      if (r.error) return { data: { session: null, user: null }, error: r.error };
      const s = r.data.session !== undefined ? r.data.session : r.data;
      if (s) { setSession(s); emit(event || 'SIGNED_IN', s); }
      return { data: { session: s || null, user: (s && s.user) || r.data.user || null }, error: null };
    }

    // Returning from an email link or Google: exchange the single-use code in the URL for a session.
    const ready = (async () => {
      if (authOpts.detectSessionInUrl === false || typeof location === 'undefined') return;
      const u = new URL(location.href), code = u.searchParams.get('auth_code'), type = u.searchParams.get('auth_type');
      if (!code && !u.searchParams.has('auth_error')) return;
      const reason = u.searchParams.get('auth_error');
      ['auth_code', 'auth_type', 'auth_error'].forEach(p => u.searchParams.delete(p));
      try { history.replaceState(history.state, '', u.toString()); } catch (e) { /* ignore */ }
      // A failed Google sign-in or email link comes back with a reason: report it (AUTH_ERROR) instead of silently showing the login page.
      // Kept for listeners that subscribe later (e.g. a React app mounting after this runs).
      const failed = msg => { redirectError = msg; setTimeout(() => emit('AUTH_ERROR', { error: msg }), 0); };
      if (!code) { failed(reason || 'Sign-in did not complete. Please try again.'); return; }
      const r = await http('POST', '/auth/exchange', { auth: false, body: { code } });
      if (r.error) { failed(r.error.message || 'The sign-in link has expired. Please try again.'); return; }
      setSession(r.data);
      setTimeout(() => { emit('SIGNED_IN', r.data); if (type === 'recovery') emit('PASSWORD_RECOVERY', r.data); }, 0);
    })();
    if (session) setSession(session);

    const auth = {
      async getSession() {
        await ready;
        if (session && session.expires_at - 30 < Date.now() / 1000) await refresh().catch(() => {});
        return { data: { session }, error: null };
      },
      async getUser() {
        await ready;
        if (!session) return { data: { user: null }, error: { message: 'Auth session missing!' } };
        const r = await call('GET', '/auth/user');
        return { data: { user: r.data }, error: r.error };
      },
      onAuthStateChange(cb) {
        listeners.add(cb);
        ready.then(() => setTimeout(() => {
          if (!listeners.has(cb)) return;
          cb('INITIAL_SESSION', session);
          if (redirectError && !session) cb('AUTH_ERROR', { error: redirectError });
        }, 0));
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
      },
      async signInWithPassword(p) {
        return signedIn(await http('POST', '/auth/token?grant_type=password', { auth: false, body: { email: p.email, password: p.password } }));
      },
      async signUp(p) {
        const o = p.options || {};
        return signedIn(await http('POST', '/auth/signup', { auth: false, body: { email: p.email, password: p.password, data: o.data || {}, redirect_to: o.emailRedirectTo } }));
      },
      async signInWithOtp(p) {
        const r = await http('POST', '/auth/otp', { auth: false, body: { email: p.email } });
        return { data: r.data || {}, error: r.error };
      },
      async verifyOtp(p) {
        return signedIn(await http('POST', '/auth/verify', { auth: false, body: { email: p.email, token: p.token, type: p.type } }));
      },
      async signInWithOAuth(p) {
        const o = p.options || {};
        const q = new URLSearchParams(Object.assign({ provider: p.provider, redirect_to: o.redirectTo || location.href }, o.queryParams || {}));
        const target = base + '/auth/authorize?' + q;
        if (!o.skipBrowserRedirect) location.assign(target);
        return { data: { provider: p.provider, url: target }, error: null };
      },
      async signInWithSSO() {
        return { data: null, error: { message: 'NOT_CONFIGURED: Government SSO is not configured for this deployment. Sign in with your email and password or an OTP.' } };
      },
      async resetPasswordForEmail(email, o) {
        const r = await http('POST', '/auth/recover', { auth: false, body: { email, redirect_to: o && o.redirectTo } });
        return { data: {}, error: r.error };
      },
      async updateUser(attrs) {
        const r = await call('PUT', '/auth/user', { body: attrs });
        if (!r.error) emit('USER_UPDATED', session);
        return { data: { user: r.data }, error: r.error };
      },
      async signOut() {
        await ready;
        if (session) await http('POST', '/auth/logout').catch(() => {});
        setSession(null);
        closeStream();
        emit('SIGNED_OUT', null);
        return { error: null };
      },
    };

    // ---- live updates: one Server-Sent Events stream shared by all channels
    const channels = new Set();
    let stream = null, retry = 0;
    function closeStream() { if (stream) { stream.abort(); stream = null; } }
    async function openStream() {
      if (stream || !channels.size) return;
      await ready;
      if (!session) return;
      const ctrl = new AbortController();
      stream = ctrl;
      try {
        if (session.expires_at - 30 < Date.now() / 1000) await refresh();
        const res = await fetch(base + '/events', { headers: { authorization: 'Bearer ' + session.access_token }, signal: ctrl.signal });
        if (!res.ok || !res.body) throw new Error('events ' + res.status);
        retry = 0;
        const reader = res.body.getReader(), dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
            const m = /^data: (.*)$/m.exec(chunk);
            if (!m) continue;
            let ev; try { ev = JSON.parse(m[1]); } catch (e) { continue; }
            channels.forEach(ch => ch.handlers.forEach(h => { if (!h.table || h.table === ev.table) h.cb({ eventType: '*', schema: 'public', table: ev.table }); }));
          }
        }
      } catch (e) { /* reconnect below */ }
      if (stream === ctrl) {
        stream = null;
        if (channels.size && session) setTimeout(openStream, Math.min(30000, 1000 * Math.pow(2, retry++)));
      }
    }

    return {
      auth,
      rpc: async (fn, args) => { const r = await call('POST', '/rpc/' + encodeURIComponent(fn), { body: args || {} }); return { data: r.data, error: r.error }; },
      /** Any other API route, e.g. the Regulatory Assistant (server/assistant.mjs). */
      request: async (method, path, body) => { const r = await call(method, path, body === undefined ? {} : { body }); return { data: r.data, error: r.error }; },
      /** Staff-portal read views (server/api.mjs VIEWS). */
      data: async view => { const r = await call('GET', '/data/' + encodeURIComponent(view)); return { data: r.data, error: r.error }; },
      storage: {
        from(bucket) {
          const p = path => encodeURIComponent(bucket) + '/' + String(path).split('/').map(encodeURIComponent).join('/');
          return {
            async upload(path, file, o) {
              const r = await call('POST', '/storage/object/' + p(path), { raw: file, contentType: (o && o.contentType) || file.type || 'application/octet-stream' });
              return { data: r.error ? null : { path }, error: r.error };
            },
            async createSignedUrl(path, expiresIn) {
              const r = await call('POST', '/storage/sign/' + p(path), { body: { expiresIn } });
              return { data: r.data, error: r.error };
            },
          };
        },
      },
      functions: {
        async invoke(name, o) {
          const r = await call('POST', '/functions/' + encodeURIComponent(name), { body: (o && o.body) || {} });
          return { data: r.data, error: r.error };
        },
      },
      channel(name) {
        const ch = { name, handlers: [],
          on(type, filter, cb) { ch.handlers.push({ table: filter && filter.table, cb }); return ch; },
          subscribe() { channels.add(ch); openStream(); return ch; } };
        return ch;
      },
      async removeChannel(ch) { channels.delete(ch); if (!channels.size) closeStream(); return 'ok'; },
    };
  }

  root.AicteApi = { createClient };
})(typeof globalThis !== 'undefined' ? globalThis : window);
