# Generali OneForm — Supabase backend repair branch

## Identiti dan fail asal
- Nama produk: Generali Insurance Malaysia Berhad / Generali OneForm.
- UI, logo, styles, liquid navigation dan struktur borang asal dikekalkan.
- PDF asal dikekalkan tanpa perubahan:
  - \`PI-Security-Guards-02-2025.pdf\` — 6 halaman
  - \`Public-Liability-02-2025.pdf\` — 5 halaman
  - \`Biz-PA-Proposal-12-2025.pdf\` — 7 halaman

## Perubahan dalam branch ini
- \`app.js\`: aliran Supabase Auth e-mel/kata laluan, Google OAuth redirect, pemulihan kata laluan, sesi tab, semakan profil/kelulusan, paparan dashboard dan senarai permohonan.
- \`config.js\`: tempat konfigurasi URL projek dan public anon/publishable key. Isi nilai sebenar sebelum deploy.
- \`supabase/migrations/202611270002_security_hardening.sql\`: profil baharu sentiasa agent tidak aktif; polisi draft lebih ketat; sekatan perubahan medan dilindungi; akses fail berdasarkan pemilikan permohonan; bucket Storage private.
- \`index.html\`: muatkan config.js dan benarkan sambungan ke projek Supabase yang ditetapkan.
- \`SECURITY-TESTS.md\`: senarai ujian negatif/positif sebelum produksi.

## Perkara yang masih BELUM siap
Branch ini bukan sistem permohonan produksi penuh. Fungsi berikut sengaja kekal dinyahaktifkan:
1. Customer secure-link token creation, anonymous customer form access, expiry dan one-time submit.
2. Pemetaan semua medan PI, PL dan Biz PA ke PDF rasmi dan PDF overlay/flatten final.
3. Upload metadata lengkap, scan fail, penyimpanan PDF akhir dan signed download.
4. Gmail API delivery, OAuth refresh, attachment, retry, idempotency dan status e-mel.
5. Paparan/kelulusan ejen di HQ, MFA dan audit log.
6. End-to-end security tests dan deployment production.

Jangan gunakan untuk menerima data pelanggan sebenar sehingga perkara ini disiapkan dan disahkan.

## Konfigurasi frontend
1. Buka \`config.js\`.
2. Kekalkan URL projek: \`https://xaidyjflzrnzomjsxhfu.supabase.co\`.
3. Gantikan \`PASTE_PUBLIC_ANON_OR_PUBLISHABLE_KEY_HERE\` dengan **public anon/publishable key** dari Supabase Project Settings → API Keys.
4. Jangan sekali-kali letak \`service_role\`, Google client secret atau Gmail refresh token di sini.
5. Commit/deploy \`config.js\`. Public anon key memang boleh dilihat di browser; keselamatan bergantung pada RLS.

## Supabase deployment
1. Pastikan migration asal \`202611270001_initial_schema.sql\` telah dijalankan.
2. Jalankan migration tambahan \`202611270002_security_hardening.sql\`.
3. Semak hasil migration dan RLS di Supabase SQL Editor.
4. Aktifkan Email provider; tetapkan Site URL dan Redirect URLs kepada domain GitHub Pages/Render yang benar-benar digunakan.
5. Jika Google Sign-In digunakan, konfigurasi Google provider di Supabase Auth. Ini berasingan daripada Gmail API send-mail OAuth.
6. Tetapkan akaun HQ melalui proses pentadbir dipercayai sahaja. Jangan benarkan signup awam memilih role atau status aktif.
7. Uji dua akaun ejen dan satu akaun HQ seperti dalam \`SECURITY-TESTS.md\`.

## Satu mailbox untuk HQ dan Agent
Gunakan alamat Gmail yang sama sebagai mailbox penghantaran/penerimaan HQ dan Agent jika itu keputusan operasi. Walau bagaimanapun, role \`agent\` dan \`hq_admin\` mesti kekal pada akaun pengguna berasingan dan ditetapkan oleh pentadbir. Jangan berkongsi kata laluan akaun ejen/HQ.

Gmail API send-mail memerlukan OAuth server-side dan secret disimpan dalam Supabase Edge Function secrets. Google Sign-In hanya mengesahkan identiti pengguna; ia tidak secara automatik memberi kebenaran menghantar e-mel.

## Hosting
GitHub Pages atau Render Static boleh host frontend. Render static hosting bukan backend. Backend aplikasi hendaklah menggunakan Supabase Auth, Postgres, Storage dan Edge Functions. Pastikan Publish Directory Render ialah \`.\` jika deploy dari root repository.

## Nota keselamatan dan privasi
Borang mengandungi data peribadi dan perniagaan. Sebelum penggunaan sebenar, dapatkan kelulusan pemilik proses/IT Generali, semak notis privasi/retention, backup, audit log, kawalan akses, pemprosesan fail dan keperluan pematuhan. Jangan masukkan data pelanggan sebenar semasa ujian.
