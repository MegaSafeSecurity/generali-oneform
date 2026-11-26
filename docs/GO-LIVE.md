# Go-live: percuma (Supabase Free + Render Free)

Fasa 1 siap: log masuk ejen, pautan pelanggan sekali guna, data disimpan dalam Supabase dengan peraturan RLS.
Belum siap: **PDF rasmi diisi** (fasa 2) dan **hantar ke HQ melalui Gmail** (fasa 3). Lihat bahagian "Had" di bawah.

## A. Supabase (10 minit)
1. https://supabase.com > New project (pilih kawasan terdekat, mis. Singapore). Simpan kata laluan DB.
2. **SQL Editor** > jalankan fail ini mengikut urutan: `supabase/migrations/002_agent_portal_google_email.sql`, kemudian `003_access_hardening.sql`. (Jangan jalankan `supabase/legacy/`.)
3. **Authentication > Sign In / Providers**: matikan **Allow new users to sign up** (ejen dicipta oleh anda sahaja).
4. **Authentication > Users > Add user**: emel + kata laluan kuat, tandakan *Auto confirm*. Kemudian di SQL Editor:
   ```sql
   insert into public.profiles (id, full_name, role)
   select id, 'Nama Ejen', 'agent' from auth.users where email = 'ejen@contoh.com';
   -- untuk admin: tukar 'agent' kepada 'admin'
   ```
5. **Project Settings > API Keys**: salin *Project URL*, *Publishable key* dan *Secret key*.
6. Pilihan tetapi disyorkan: jalankan `supabase/tests/rls_staging_test.sql` dalam SQL Editor. Mesej `ALL ASSERTIONS PASSED` bermakna peraturan akses berfungsi. (Ia membuat data ujian dan di-rollback.)

## B. Render (10 minit)
1. Letak folder projek di GitHub (repo peribadi). **Jangan** commit `.env`.
2. https://render.com > New + > **Blueprint** > pilih repo > Render membaca `render.yaml`.
3. Isi 3 nilai: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`. Deploy.
4. Buka `https://NAMA-ANDA.onrender.com/api/health` : mesti `{"ok":true,"mode":"supabase"}`. Jika `memory`, kunci belum dibaca. (Dalam mod production, jika kunci tiada, aplikasi enggan bermula.)

## C. Ujian penerimaan (guna data palsu dahulu)
1. Log masuk sebagai ejen > pilih borang > **Cipta pautan** > salin pautan.
2. Buka pautan dalam tetingkap *incognito* > isi borang > tandatangan > hantar.
3. Ejen: segarkan > status **Diterima**. Dalam Supabase: `applications` (status `submitted`), `application_events`, dan Storage `private-application-files/<id>/signature.png`.
4. Buka semula pautan yang sama: mesti ditolak (sekali guna).
5. Log masuk sebagai ejen B: tidak boleh nampak permohonan ejen A.

## Had pelan percuma (sahkan di laman rasmi sebelum bergantung)
- **Render Free**: tidur selepas 15 minit tiada trafik; permintaan pertama ambil ~1 minit. Boleh restart bila-bila masa.
- **Supabase Free**: projek **dijeda selepas seminggu tanpa aktiviti**; **tiada sandaran automatik**; 500 MB DB, 1 GB storan.
  Cron percuma (mis. UptimeRobot) memanggil `/api/health?deep=1` setiap 5-10 minit boleh mengekalkan kedua-duanya aktif, tetapi itu bukan jaminan.
- **Sebelum data pelanggan sebenar (NRIC, tandatangan)**: naik taraf Supabase ke Pro (sandaran harian) dan pertimbangkan Render berbayar; semak PDPA dan kebenaran Generali (lihat `DEPLOYMENT-CHECKLIST.md`).
