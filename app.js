/* Generali OneForm — Supabase REST bootstrap.
 * Only the public anon/publishable key belongs in config.js.
 * Service-role keys and Google/Gmail secrets must remain in Edge Function secrets.
 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const toast = $('toast');
  const msg = $('authMsg');
  const cfg = window.GENERALI_ONEFORM_CONFIG || {};
  const validConfig = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.supabaseUrl || '') &&
    typeof cfg.supabaseAnonKey === 'string' &&
    cfg.supabaseAnonKey.length > 20 &&
    !/YOUR_|PLACEHOLDER/i.test(cfg.supabaseAnonKey);
  const STORE = 'generali_oneform_session_v1';
  let session = null;
  let profile = null;
  let authMode = 'login';
  let supabaseClient = null;

  const notify = (text) => {
    if (toast) { toast.textContent = text; toast.classList.add('show'); }
    else console.info('[Generali OneForm]', text);
  };
  const authMessage = (text, error = false) => {
    if (!msg) return;
    msg.textContent = text;
    msg.hidden = !text;
    msg.dataset.state = error ? 'error' : 'info';
  };
  const showOnly = (id) => {
    ['authView','pendingView','dashView','custHomeView','formView','reviewView','doneView']
      .forEach((key) => $(key)?.classList.toggle('hidden', key !== id));
    document.body.dataset.mode = id;
  };
  const api = async (path, options = {}, token) => {
    if (!validConfig) throw new Error('Konfigurasi Supabase belum lengkap. Sediakan URL projek dan public anon/publishable key dalam config.js.');
    const response = await fetch(cfg.supabaseUrl.replace(/\/$/, '') + path, {
      ...options,
      headers: {
        apikey: cfg.supabaseAnonKey,
        ...((token || (!path.startsWith('/auth/v1/token') && !path.startsWith('/auth/v1/signup') && !path.startsWith('/auth/v1/recover') && session?.access_token)) ? { Authorization: 'Bearer ' + (token || session.access_token) } : {}),
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.msg || body.message || body.error_description || body.error || 'Permintaan gagal (' + response.status + ')');
      error.status = response.status;
      throw error;
    }
    return body;
  };
  const getSupabaseClient = () => {
    if (!window.supabase?.createClient) throw new Error('Komponen Supabase Auth belum dimuatkan. Muat semula halaman.');
    if (!supabaseClient) {
      // Let supabase-js own OAuth callback parsing, PKCE exchange, persistence and refresh.
      // Do not manually parse access tokens from the URL or keep a second competing session.
      supabaseClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce'
        }
      });
    }
    return supabaseClient;
  };
  const saveSession = (value) => {
    session = value || null;
    if (!value) {
      try { sessionStorage.removeItem(STORE); } catch (_) {}
    }
  };
  const safeText = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
  const setMode = (mode) => {
    authMode = mode;
    $('tabLogin')?.setAttribute('aria-selected', String(mode === 'login'));
    $('tabSignup')?.setAttribute('aria-selected', String(mode === 'signup'));
    $('authTitle')?.replaceChildren(document.createTextNode(mode === 'login' ? 'Selamat kembali' : 'Daftar akaun ejen'));
    $('authSubmit')?.replaceChildren(document.createTextNode(mode === 'login' ? 'Log masuk' : 'Daftar akaun'));
    $('nameField')?.classList.toggle('hidden', mode !== 'signup');
    $('authPass')?.setAttribute('autocomplete', mode === 'login' ? 'current-password' : 'new-password');
    authMessage('');
  };
  const loadProfile = async () => {
    const rows = await api('/rest/v1/profiles?select=id,full_name,role,is_active&id=eq.' + encodeURIComponent(session.user.id), {}, session.access_token);
    profile = rows[0] || null;
    if (!profile || !profile.is_active) {
      $('pendingText').textContent = 'Akaun anda telah didaftarkan tetapi belum diaktifkan oleh pentadbir HQ. Sila hubungi HQ untuk kelulusan.';
      showOnly('pendingView');
      return;
    }
    $('dashName').textContent = (profile.full_name || session.user.email || 'Pengguna') + ' · ' + (profile.role === 'admin' ? 'HQ' : 'Agent');
    showOnly('dashView');
    try {
      await loadApplications();
    } catch (error) {
      // A dashboard list failure must not invalidate a valid Auth session.
      const host = $('appList');
      if (host) host.textContent = 'Log masuk berjaya, tetapi senarai permohonan belum dapat dimuatkan. Sila cuba muat semula.';
      console.error('[Generali OneForm] application list failed:', error);
    }
    $('hqTabs')?.classList.toggle('hidden', profile.role !== 'admin');
  };
  const loadApplications = async () => {
    // Match the live production schema: insurance_type is the form column and
    // application IDs are the only reference identifier currently provisioned.
    const rows = await api('/rest/v1/applications?select=id,insurance_type,status,customer_email,created_at&order=created_at.desc&limit=50');
    const host = $('appList');
    if (!host) return;
    if (!rows.length) { host.textContent = 'Belum ada permohonan.'; return; }
    host.innerHTML = rows.map((row) =>
      '<article class="app-row"><b>' + safeText(String(row.id || '').slice(0, 8).toUpperCase()) + '</b>' +
      '<span>' + safeText(row.insurance_type) + ' · ' + safeText(row.status) + '</span>' +
      '<small>' + safeText(row.customer_email || 'Tiada emel pelanggan') + '</small></article>'
    ).join('');
  };
  const login = async (email, password) => {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.session) throw new Error('Log masuk belum menghasilkan sesi. Sila cuba semula.');
    saveSession(data.session);
    await loadProfile();
  };
  const signup = async (name, email, password) => {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: cfg.appBaseUrl || (location.origin + location.pathname)
      }
    });
    if (error) throw error;
    if (data.session?.access_token) {
      saveSession(data.session);
      await loadProfile();
    } else {
      authMessage('Pendaftaran diterima. Sahkan alamat e-mel melalui pautan yang dihantar. Selepas pengesahan, log masuk semula. Akaun ejen juga memerlukan kelulusan HQ.');
    }
  };
  const logout = async () => {
    try {
      const client = getSupabaseClient();
      const { error } = await client.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.warn('[Generali OneForm] sign-out:', error.message);
    }
    saveSession(null); profile = null; showOnly('authView'); setMode('login');
  };
  const showCallbackError = () => {
    const params = new URLSearchParams(location.hash.replace(/^#/, ''));
    const query = new URLSearchParams(location.search);
    const description = params.get('error_description') || query.get('error_description');
    const code = params.get('error_code') || query.get('error_code');
    if (!description && !code) return false;
    authMessage('Pengesahan Google tidak berjaya' + (code ? ' (' + code + ')' : '') + ': ' +
      decodeURIComponent(String(description || 'Sila semak konfigurasi OAuth dan Redirect URLs.').replace(/\+/g, ' ')), true);
    return true;
  };

  $('tabLogin')?.addEventListener('click', () => setMode('login'));
  $('tabSignup')?.addEventListener('click', () => setMode('signup'));
  $('authForm')?.addEventListener('submit', async (event) => {
    event.preventDefault(); authMessage('');
    const email = $('authEmail')?.value.trim();
    const password = $('authPass')?.value || '';
    if (!email || password.length < 8) return authMessage('Masukkan e-mel sah dan kata laluan sekurang-kurangnya 8 aksara.', true);
    const submit = $('authSubmit'); if (submit) submit.disabled = true;
    try {
      if (authMode === 'signup') {
        const name = $('authName')?.value.trim();
        if (!name) throw new Error('Sila masukkan nama penuh.');
        await signup(name, email, password);
      } else await login(email, password);
    } catch (error) { authMessage(error.message, true); }
    finally { if (submit) submit.disabled = false; }
  });
  $('googleBtn')?.addEventListener('click', async () => {
    if (!validConfig) return authMessage('Konfigurasi Supabase belum lengkap.', true);
    try {
      const client = getSupabaseClient();
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: cfg.appBaseUrl || (location.origin + location.pathname) }
      });
      if (error) throw error;
    } catch (error) {
      authMessage('Google Sign-In gagal: ' + error.message, true);
    }
  });
  $('forgotBtn')?.addEventListener('click', async () => {
    const email = $('authEmail')?.value.trim();
    if (!email) return authMessage('Masukkan e-mel anda dahulu.');
    try {
      await api('/auth/v1/recover', { method:'POST', body:JSON.stringify({ email, gotrue_meta_security:{ captcha_token:null } }) });
      authMessage('Jika akaun wujud, pautan tetapan semula kata laluan akan dihantar.');
    } catch (error) { authMessage(error.message, true); }
  });
  ['logoutBtn','pendingLogout'].forEach((id) => $(id)?.addEventListener('click', logout));
  $('pendingRefresh')?.addEventListener('click', async () => { try { await loadProfile(); } catch (e) { notify(e.message); } });
  $('copyLink')?.addEventListener('click', async () => {
    const value = $('guestUrl')?.value;
    if (!value) return;
    try { await navigator.clipboard.writeText(value); notify('Pautan disalin.'); }
    catch (_) { $('guestUrl')?.select(); notify('Sila salin pautan secara manual.'); }
  });
  $('createLink')?.addEventListener('click', () => notify('Pautan pelanggan belum dibuka: fungsi token pelanggan perlu dipasang dan diuji sebelum pautan selamat boleh dikeluarkan.'));
  ['submitApplication','downloadPdfReview','downloadPdfDone'].forEach((id) =>
    $(id)?.addEventListener('click', () => notify('Penghantaran dan PDF akhir belum diaktifkan. Jangan hantar data pelanggan sehingga pemetaan PDF dan aliran pelanggan diluluskan.'))
  );
  $('langBtn')?.addEventListener('click', () => notify('Antara muka asal dikekalkan. Terjemahan penuh BM/EN belum diaktifkan.'));
  $('downloadTemplate')?.addEventListener('click', () => {
    const map = { PI:'PI-Security-Guards-02-2025.pdf', PL:'Public-Liability-02-2025.pdf', GPA:'Biz-PA-Proposal-12-2025.pdf' };
    const type = $('linkForm')?.value || 'PI';
    const a = document.createElement('a'); a.href = './templates/' + map[type]; a.download = map[type]; a.click();
  });

  const start = async () => {
    if (!validConfig) {
      const note = document.createElement('div');
      note.setAttribute('role','status');
      note.className = 'config-warning';
      note.textContent = 'Mod konfigurasi diperlukan — masukkan Supabase URL dan public anon/publishable key dalam config.js. Fungsi backend belum tersedia sehingga pendaftaran dan permohonan tidak boleh digunakan.';
      $('main')?.prepend(note);
      showOnly('authView');
      return;
    }
    try {
      if (showCallbackError()) return;
      const client = getSupabaseClient();
      // getSession waits for supabase-js URL callback detection / PKCE exchange and
      // restores persisted sessions before the app decides which screen to show.
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      session = data.session || null;
      if (!session?.access_token) {
        showOnly('authView');
        return;
      }
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      session.user = userData.user;
      saveSession(session);
      await loadProfile();
    } catch (error) {
      console.error('[Generali OneForm] authentication initialization failed:', error);
      showOnly('authView');
      authMessage('Sesi tidak dapat dipulihkan. ' + error.message + ' Sila cuba log masuk semula.', true);
    }
  };
  setMode('login');
  start();
})();