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
  const saveSession = (value) => {
    session = value;
    if (value) sessionStorage.setItem(STORE, JSON.stringify(value));
    else sessionStorage.removeItem(STORE);
  };
  const readSession = () => {
    try { return JSON.parse(sessionStorage.getItem(STORE) || 'null'); }
    catch { return null; }
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
    $('dashName').textContent = (profile.full_name || session.user.email || 'Pengguna') + ' · ' + (profile.role === 'hq_admin' ? 'HQ' : 'Agent');
    showOnly('dashView');
    await loadApplications();
    $('hqTabs')?.classList.toggle('hidden', profile.role !== 'hq_admin');
  };
  const loadApplications = async () => {
    const rows = await api('/rest/v1/applications?select=id,reference_no,form_type,status,customer_email,created_at&order=created_at.desc&limit=50');
    const host = $('appList');
    if (!host) return;
    if (!rows.length) { host.textContent = 'Belum ada permohonan.'; return; }
    host.innerHTML = rows.map((row) =>
      '<article class="app-row"><b>' + safeText(row.reference_no) + '</b>' +
      '<span>' + safeText(row.form_type) + ' · ' + safeText(row.status) + '</span>' +
      '<small>' + safeText(row.customer_email || 'Tiada emel pelanggan') + '</small></article>'
    ).join('');
  };
  const login = async (email, password) => {
    const data = await api('/auth/v1/token?grant_type=password', {
      method: 'POST', body: JSON.stringify({ email, password })
    });
    saveSession(data);
    await loadProfile();
  };
  const signup = async (name, email, password) => {
    const data = await api('/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, data: { full_name: name } })
    });
    if (data.access_token) {
      saveSession(data);
      await loadProfile();
    } else {
      authMessage('Pendaftaran diterima. Sahkan alamat e-mel melalui pautan yang dihantar, kemudian log masuk. Akaun juga memerlukan kelulusan HQ.');
    }
  };
  const logout = async () => {
    try { if (session?.access_token) await api('/auth/v1/logout', { method: 'POST' }); } catch (_) {}
    saveSession(null); profile = null; showOnly('authView'); setMode('login');
  };
  const consumeOAuthCallback = () => {
    if (!location.hash || !location.hash.includes('access_token=')) return false;
    const p = new URLSearchParams(location.hash.slice(1));
    const access_token = p.get('access_token');
    if (!access_token) return false;
    saveSession({
      access_token, refresh_token: p.get('refresh_token'),
      token_type: p.get('token_type') || 'bearer',
      expires_in: Number(p.get('expires_in') || 3600),
      user: { id: p.get('user_id') }
    });
    history.replaceState(null, '', location.pathname + location.search);
    return true;
  };
  const restoreOAuthUser = async () => {
    if (!session?.access_token || session.user?.email) return;
    const user = await api('/auth/v1/user', {}, session.access_token);
    session.user = user; saveSession(session);
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
    if (!validConfig) return notify('Konfigurasi Supabase belum lengkap.');
    if (!window.supabase?.createClient) return notify('Komponen Supabase Auth belum dimuatkan. Muat semula halaman.');
    const redirect = cfg.appBaseUrl || location.origin + location.pathname;
    const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'implicit' }
    });
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirect }
    });
    if (error) notify('Google Sign-In gagal: ' + error.message);
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
    consumeOAuthCallback();
    session = readSession();
    try {
      if (session?.access_token) {
        await restoreOAuthUser();
        const user = await api('/auth/v1/user', {}, session.access_token);
        session.user = user; saveSession(session);
        await loadProfile();
      } else showOnly('authView');
    } catch (error) {
      saveSession(null); showOnly('authView');
      authMessage('Sesi tamat atau tidak sah. Sila log masuk semula. ' + error.message, true);
    }
  };
  setMode('login');
  start();
})();