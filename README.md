# Generali OneForm

Portal permohonan **PI / PL / Biz PA (GPA)** untuk **Ejen**, **HQ** dan **Pelanggan**.
Susunan: **GitHub** (kod) -> **Render** (Static Site) + **Supabase** (Auth, Postgres, RLS). Tiada pelayan backend.

| Peranan | Cara masuk | Apa yang boleh dibuat |
|---|---|---|
| Pelanggan | Pautan selamat (7 hari) daripada ejen, tiada akaun | Isi borang, tandatangan, cop, hantar, muat turun PDF |
| Ejen | Daftar / Log masuk / Google (perlu diluluskan HQ) | Cipta pautan, lihat permohonan sendiri, muat turun PDF |
| HQ | Daftar / Log masuk / Google (emel dalam `hq_allowlist`) | Semua permohonan, lulus/gantung ejen |

Bar menu **Utama / Biz PA / Public Liability / PI Security Guards** hanya muncul di **dalam**: selepas log masuk (Ejen/HQ) dan pada halaman Pelanggan. Tidak di halaman depan.

```
public/        index.html, styles.css, liquid-nav.js (efek nav), aset, template PDF asal
src/           TypeScript strict: supabase.ts, form-engine.ts, pdf.ts, i18n.ts, main.ts
supabase/      schema.sql (boleh dijalankan berulang), reset.sql (pilihan, memadam)
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
