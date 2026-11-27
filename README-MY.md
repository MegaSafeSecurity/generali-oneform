# Generali OneForm — handoff package

## Identiti & kandungan ZIP
- Nama produk: Generali Insurance Malaysia Berhad / Generali OneForm.
- Logo dan aset rasmi dikekalkan daripada ZIP yang dibekalkan.
- PDF asal dikekalkan tanpa suntingan: PI Security Guards (6 halaman), Public Liability (5 halaman), Biz PA Proposal (7 halaman).

## Status sebenar pakej ini
Pakej ini ialah **handoff / starter scaffold**, bukan sistem produksi yang telah disahkan. ZIP asal memanggil `./app.js` tetapi fail tersebut tiada. Fail `public/app.js` yang ditambah di sini ialah bootstrap keselamatan yang memaparkan status konfigurasi; ia sengaja tidak berpura-pura bahawa log masuk, pautan pelanggan, PDF atau e-mel sudah berfungsi.

Belum boleh disahkan atau diaktifkan daripada fail ZIP sahaja:
1. Supabase project URL/keys, database deployment dan Storage private bucket.
2. Google OAuth consent/client ID/secret, refresh token dan alamat Gmail penghantar/HQ.
3. Pengesahan MFA, proses kelulusan ejen, serta penetapan HQ admin secara manual.
4. Pemetaan setiap medan borang ke kedudukan dalam PDF asal (perlu QA halaman demi halaman).
5. PDF output final, upload/download dokumen, customer token flow dan Gmail delivery worker.
6. RLS/storage policies lengkap, security testing, deployment domain dan end-to-end test.

## Struktur
- `public/` — UI, CSS, logo dan PDF asal.
- `supabase/migrations/202611270001_initial_schema.sql` — skema awal + polisi RLS asas (perlu review dan ujian).
- `supabase/functions/email-notify/index.ts` — placeholder, bukan penghantar e-mel aktif.
- `ENVIRONMENT.example` — senarai konfigurasi yang diperlukan.

## Setup seterusnya
1. Cipta projek Supabase dan simpan URL + anon/publishable key dalam environment deployment.
2. Semak dan jalankan migration selepas security review. Jangan gunakan service-role key di browser.
3. Tetapkan role `hq_admin` melalui proses admin yang dipercayai; jangan benarkan pendaftaran awam memilih role.
4. Aktifkan Google OAuth di Supabase dan tambah redirect URL production.
5. Lengkapkan storage bucket private, signed URL dan polisi storage.
6. Bangunkan PDF mapping berdasarkan borang rasmi; sahkan setiap medan dan halaman dengan pemilik produk.
7. Implement Gmail OAuth di server/Edge Function, termasuk refresh-token rotation, retry, idempotency dan log status.
8. Uji sekurang-kurangnya dua akaun ejen dan satu akaun HQ: ejen A tidak boleh membaca rekod ejen B; HQ boleh membaca semua.
9. Jalankan ujian keselamatan dan end-to-end sebelum menerima data pelanggan sebenar.

## Perhatian
Borang insurans boleh mengandungi data peribadi dan kewangan. Jangan muat naik data pelanggan sebenar ke versi ini sehingga akses, retention, encryption, consent, backup dan security review diluluskan.
