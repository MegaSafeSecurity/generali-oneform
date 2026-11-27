# Generali OneForm v3 — Nota Serahan

## Apa yang dikemas kini
- Kekalkan struktur aplikasi dan aset logo rasmi Generali yang dibekalkan dalam ZIP asal.
- Kekalkan borang PI, PL dan Biz PA, peranan Ejen/HQ/Pelanggan, RLS dan pautan pelanggan bertoken 7 hari.
- Tambah pemilihan sehingga 8 dokumen sokongan (PDF, JPG, PNG, DOC, DOCX, XLS, XLSX).
- Tambah fungsi Supabase Edge `send-hq-email` untuk menghantar PDF permohonan dan fail sokongan sebagai lampiran berasingan melalui Gmail shared mailbox.
- Tambah status penghantaran e-mel pada dashboard dan perlindungan penghantaran berganda biasa.
- Rahsia Google OAuth dan `service_role` hanya digunakan dalam Supabase Edge Function.
- Tambah keserasian request anonim untuk Supabase legacy anon JWT dan publishable key.

## Semakan yang berjaya
- 76 ID HTML unik; tiada ID berganda.
- Aset logo Generali PNG wujud dan header fail sah.
- Semakan TypeScript untuk kod aplikasi lulus menggunakan deklarasi sementara bagi `pdf-lib`.
- Semakan sintaks TypeScript Edge Function lulus menggunakan deklarasi sementara Deno.
- `node --check` untuk build script dan mock test lulus.
- `python -m py_compile tests/e2e.py` lulus.
- Imbasan rahsia Git lulus: 38 fail dijejaki, tiada rahsia dikesan.

## Belum boleh disahkan dari persekitaran ini
- Build pengeluaran sebenar tidak dapat dijalankan kerana npm registry tidak dapat dicapai (`EAI_AGAIN` semasa memuat turun `esbuild`).
- Ujian E2E Playwright, sambungan Supabase sebenar, Google OAuth dan penghantaran Gmail sebenar belum dijalankan.
- Aplikasi belum di-deploy ke Render dan tiada URL live dicipta.

## Langkah wajib sebelum live
1. Pasang dependencies di komputer/build runner yang mempunyai internet: `npm install`.
2. Jalankan `supabase/schema.sql`, kemudian `supabase/email-dispatch.sql` di Supabase SQL Editor.
3. Sediakan Google OAuth refresh token dengan scope `https://www.googleapis.com/auth/gmail.send`.
4. Tetapkan `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GMAIL_SHARED_MAILBOX`, dan `HQ_EMAIL` menggunakan `supabase secrets set`.
5. Deploy `supabase functions deploy send-hq-email`.
6. Masukkan `SUPABASE_URL` dan `SUPABASE_ANON_KEY` ke environment Render dan deploy static site.
7. Uji dahulu dengan peti mel HQ ujian. Pastikan Gmail shared mailbox/alias dibenarkan menghantar sebagai alamat `GMAIL_SHARED_MAILBOX`.

## Batasan yang disengajakan / perlu diketahui
- Dokumen sokongan dihantar terus sebagai lampiran e-mel; versi ini tidak menyimpan fail sokongan secara kekal ke Supabase Storage.
- PDF permohonan ialah PDF ringkasan digital, bukan borang asal yang diisi pada koordinat medan PDF template. Template asal dikekalkan sebagai rujukan kosong.
- Jika e-mel gagal selepas permohonan berjaya direkod, nombor rujukan tetap dikeluarkan dan status e-mel menjadi `failed`; pentadbir perlu menyemak dan mengurus penghantaran semula.
