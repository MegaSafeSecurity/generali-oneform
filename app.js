/* Generali OneForm - safe bootstrap.
 * This ZIP did not include the original application logic. This file deliberately
 * does not simulate authentication, submission, PDF generation or email delivery.
 */
(() => {
  'use strict';
  const toast = document.getElementById('toast');
  const show = (message) => {
    if (toast) { toast.textContent = message; toast.classList.add('show'); }
    else console.info('[Generali OneForm]', message);
  };
  const configMissing = !window.GENERALI_ONEFORM_CONFIG ||
    !window.GENERALI_ONEFORM_CONFIG.supabaseUrl ||
    !window.GENERALI_ONEFORM_CONFIG.supabaseAnonKey;
  if (configMissing) {
    const note = document.createElement('div');
    note.setAttribute('role','status');
    note.style.cssText = 'margin:18px auto;padding:14px 18px;max-width:960px;border:1px solid #e7b7ae;border-radius:12px;background:#fff8f6;color:#76251c;font:14px/1.5 system-ui';
    note.innerHTML = '<strong>Mod persediaan — sambungan backend belum dikonfigurasi.</strong><br>' +
      'Antara muka dan aset Generali dimuatkan, tetapi log masuk, penghantaran permohonan, PDF dan e-mel belum diaktifkan. ' +
      'Rujuk README-MY.md sebelum penggunaan sebenar.';
    document.querySelector('main')?.prepend(note);
  }
  document.getElementById('langBtn')?.addEventListener('click', () => {
    show('Pilihan bahasa UI asal memerlukan fail aplikasi asal yang tiada dalam ZIP.');
  });
  document.getElementById('googleBtn')?.addEventListener('click', () => {
    show('Google OAuth belum disambungkan. Lengkapkan konfigurasi Supabase dan Google OAuth dahulu.');
  });
  document.getElementById('loginBtn')?.addEventListener('click', () => {
    show('Log masuk belum diaktifkan: konfigurasi backend diperlukan.');
  });
  document.getElementById('signupBtn')?.addEventListener('click', () => {
    show('Pendaftaran belum diaktifkan: konfigurasi backend diperlukan.');
  });
  document.querySelectorAll('button').forEach((b) => {
    if (!b.dataset.bootstrapBound && ['createLink','submitApplication','downloadPdfReview','downloadPdfDone'].includes(b.id)) {
      b.dataset.bootstrapBound = '1';
      b.addEventListener('click', () => show('Fungsi ini belum diaktifkan. Jangan gunakan untuk menerima permohonan sebenar.'));
    }
  });
  console.info('Generali OneForm bootstrap loaded. Backend is intentionally disabled until configured.');
})();
