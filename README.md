# Generali OneForm

Portal permohonan **PI / PL / Biz PA (GPA)** untuk **Ejen**, **HQ** dan **Pelanggan**.
Susunan: **GitHub** (kod) -> **Render** (Static Site) + **Supabase** (Auth, Postgres, RLS, Edge Function Gmail). Rahsia OAuth dan service-role kekal di server.

| Peranan | Cara masuk | Apa yang boleh dibuat |
|---|---|---|
| Pelanggan | Pautan selamat (7 hari) daripada ejen, tiada akaun | Isi borang, tandatangan, cop, hantar, muat turun PDF |
| Ejen | Daftar / Log masuk / Google (perlu diluluskan HQ) | Cipta pautan, lihat permohonan sendiri, muat turun PDF |
| HQ | Daftar / Log masuk / Google (emel dalam `hq_allowlist`) | Semua permohonan, lulus/gantung ejen |

Bar menu **Utama / Biz PA / Public Liability / PI Security Guards** hanya muncul di **dalam**: selepas log masuk (Ejen/HQ) dan pada halaman Pelanggan. Tidak di halaman depan.

```
public/        index.html, styles.css, liquid-nav.js (efek nav), aset, template PDF asal
src/           TypeScript strict: supabase.ts, form-engine.ts, pdf.ts, i18n.ts, main.ts
supabase/      schema.sql, email-dispatch.sql, Edge Function send-hq-email, reset.sql (pilihan, memadam)
scripts/       scan-secrets.mjs, clean-git-history.sh
tests/         mock-supabase.mjs + e2e.py (ujian tempatan tanpa Supabase sebenar)
render.yaml    Blueprint Render    .github/workflows/ci.yml   semakan build + imbasan rahsia
```

## 1. Supabase
1. Buat projek. **SQL Editor** > jika projek ini pernah dijalankan dengan skema lama dan keluar ralat `policy "profiles_read_self_or_admin" ... already exists`, jalankan **`supabase/reset.sql`** dahulu (memadam jadual dalam skema `public`; akaun Auth kekal).
2. Buka **`supabase/schema.sql`**, tukar `ganti-emel-hq@gmail.com` kepada emel HQ anda (huruf kecil), tampal semua > **Run**. Boleh dijalankan berulang kali tanpa ralat.
3. **Authentication > Providers > Email**: biarkan **Confirm email = ON** (wajib; ini yang menghalang orang lain mendaftar guna emel HQ anda).
4. **Authentication > Providers > Google** (untuk "Teruskan dengan Google"):
   - Google Cloud Console > APIs & Services > Credentials > *OAuth client ID* > *Web application*.
   - *Authorized redirect URI* = `https://<PROJECT-REF>.supabase.co/auth/v1/callback`
   - Salin Client ID dan Client Secret ke Supabase, aktifkan.
5. **Authentication > URL Configuration**: *Site URL* = URL Render anda; tambah ke *Redirect URLs*: URL Render (`https://xxx.onrender.com/**`) dan `http://localhost:3000/**`.
6. **Project Settings > API**: salin **Project URL** dan kunci **anon / publishable**. JANGAN guna `service_role` / `secret`.

Tambah HQ lain kelak (SQL Editor): `insert into public.hq_allowlist(email) values ('nama@gmail.com');` kemudian orang itu daftar/log masuk dengan emel tersebut.

## 2. Render
1. Push repo ke GitHub (lihat bahagian 4 jika repo lama ada `.env` dalam sejarah).
2. Render > **New + > Blueprint** > pilih repo (guna `render.yaml`).
3. Isi **Environment**: `SUPABASE_URL` dan `SUPABASE_ANON_KEY`. Build gagal dengan sengaja jika kunci itu ialah `service_role`.
4. Deploy. Log masuk dengan emel HQ (atau Google) untuk menjadi HQ.

Kunci tidak pernah disimpan dalam repo: ia disuntik masa build (`build.mjs`). Kunci anon memang bersifat awam; keselamatan data dijaga oleh RLS dalam `schema.sql`.

## 3. Ralat lock file di GitHub Actions
`Dependencies lock file is not found` berpunca daripada `cache: npm` tanpa `package-lock.json`. Workflow ini **tidak** guna cache. Pilihan: jalankan `npm install` sekali di komputer dan commit `package-lock.json` (disyorkan).

## 4. Bersihkan sejarah Git (.env / kunci)
**Langkah 0 (paling penting): putar semua kunci.** Memadam sejarah tidak membatalkan kunci yang sudah bocor.
Supabase (reset JWT secret / API keys, tukar DB password), Google OAuth client secret, kunci Render/GitHub token.

> **Jangan** jalankan `git filter-repo --path src/ --to-subdirectory-filter my-module ...`. Itu contoh dokumentasi untuk *mengekstrak* folder `src/` ke repo baharu: ia **memadam semua fail lain** daripada sejarah.

Gunakan skrip yang disediakan (pasang dahulu: `pip install git-filter-repo`):
```
./scripts/clean-git-history.sh https://github.com/megasafesecurity/generali-oneform.git
```
Ia klon *mirror* repo, membuang semua `.env*` (kecuali `.env.example`), `*.pem`, `*.key`, `*.p12` dari **semua commit**, boleh juga memadam nilai rahsia tertentu (`replacements.txt`, satu baris `nilai==>***REMOVED***`), semak, kemudian *force push*. Selepas itu:
- Semua kolaborator mesti **clone semula** (jangan `git pull`).
- GitHub menyimpan cache/PR refs/fork: minta GitHub Support purge jika repo pernah awam, dan semak fork.
- Hidupkan **Settings > Code security > Secret scanning + Push protection**.
- Imbas bila-bila masa: `npm run scan-secrets` (CI menjalankannya setiap push).

## 5. Ujian tempatan
```
cp .env.example .env     # isi nilai sebenar
npm install && npm run dev
```
Ujian automatik tanpa Supabase sebenar: `node tests/mock-supabase.mjs` + build dengan `SUPABASE_URL=http://localhost:54321`, kemudian `python3 tests/e2e.py` (Playwright).

## Had yang perlu anda tahu
- **Belum diuji pada Supabase/Google sebenar.** `schema.sql` tidak dapat dijalankan pada Postgres di persekitaran pembinaan; aliran aplikasi diuji pada pelayan tiruan yang meniru peraturannya. Jalankan `schema.sql` dan semak ralat di SQL Editor.
- PDF ialah dokumen ringkasan kemas (jawapan + tandatangan + cop); jawapan **tidak** dipetakan ke koordinat template PDF asal (template asal kekal sebagai muat turun kosong).
- Draf disimpan di Supabase (RPC), bukan dalam pelayar. Tandatangan/cop disimpan sebagai imej PNG (maksimum 800 KB selepas pemampatan).
- Pautan pelanggan tamat 7 hari dan boleh dibatalkan oleh ejen/HQ; token disimpan sebagai hash SHA-256 sahaja, dan dipaparkan sekali semasa dicipta.

## 6. Penghantaran automatik ke HQ melalui Gmail (ditambah dalam pakej ini)

Apabila pelanggan menghantar borang, sistem akan:
1. menyimpan permohonan sebagai `submitted` melalui RPC yang dilindungi token;
2. menjana PDF ringkasan permohonan menggunakan logo Generali dalam aset projek;
3. menghantar PDF itu dan dokumen sokongan sebagai lampiran berasingan melalui Gmail shared mailbox ke HQ;
4. menanda status e-mel (`pending`, `sending`, `sent`, `failed`) untuk mengelakkan penghantaran berganda biasa.

### A. Database
Jalankan `supabase/email-dispatch.sql` dalam Supabase SQL Editor selepas `schema.sql`. Migration ini menambah status penghantaran e-mel dan kebenaran minimum untuk Edge Function menggunakan `service_role` di server sahaja.

### B. Google OAuth untuk Gmail
Dalam Google Cloud Console, gunakan OAuth client jenis Web application dan aktifkan Gmail API. OAuth scope yang diperlukan ialah `https://www.googleapis.com/auth/gmail.send`. Hasilkan refresh token untuk akaun shared mailbox (akses offline). Pastikan alamat shared mailbox ialah akaun Gmail yang diberi kebenaran menghantar, atau alamat send-as yang telah disahkan dalam Gmail.

### C. Deploy Edge Function
Pasang Supabase CLI, login dan link projek. Tetapkan rahsia terus ke Supabase (jangan letak dalam `.env` frontend atau Git):

```sh
supabase secrets set \
  GOOGLE_CLIENT_ID="..." \
  GOOGLE_CLIENT_SECRET="..." \
  GOOGLE_REFRESH_TOKEN="..." \
  GMAIL_SHARED_MAILBOX="shared-mailbox@gmail.com" \
  HQ_EMAIL="alamat-hq-sebenar@example.com"

supabase functions deploy send-hq-email
```

`SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` disediakan secara automatik dalam Supabase Edge Functions. Jangan salin `service_role` ke Render, browser atau fail ZIP.

### D. Dokumen sokongan
Pada halaman semakan pelanggan, boleh pilih sehingga 8 fail PDF/JPG/PNG/DOC/DOCX/XLS/XLSX; maksimum 8 MB setiap fail dan 18 MB jumlah. Fail dihantar sebagai lampiran berasingan dalam e-mel HQ dan tidak disimpan kekal dalam Storage oleh versi ini. PDF permohonan dijana berasingan dan dilampirkan sebagai fail utama.

### E. Penting sebelum operasi sebenar
- Isikan `HQ_EMAIL` dengan alamat sebenar HQ dan rahsia OAuth milik shared mailbox anda.
- Uji penghantaran ke peti ujian dalaman dahulu. Gmail hanya boleh menghantar daripada mailbox OAuth atau alias send-as yang disahkan.
- Jika penghantaran gagal selepas permohonan berjaya disimpan, pelanggan tetap menerima nombor rujukan; status e-mel ditanda `failed` dan perlu disemak oleh pentadbir.
- PDF dalam versi ini ialah PDF ringkasan digital, bukan penulisan jawapan ke koordinat template PDF asal. Template asal kekal sebagai fail rujukan kosong.
