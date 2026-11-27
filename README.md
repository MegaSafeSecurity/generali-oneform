# Generali OneForm | Agent Portal (Static, 100% Frontend)

Portal permohonan PI / PL / Biz PA (GPA) yang berjalan sepenuhnya dalam pelayar. Tiada pelayan backend.

- `public/` - HTML, CSS, `app.js`, nav WebGL, aset, templat PDF asal (sumber tunggal)
- `src/client/` - TypeScript strict: auth ejen, pautan bertandatangan 7 hari, draf, rekod, PDF (`pdf-lib`)
- `npm run build` -> `dist/` (sedia untuk Render Static Site / GitHub Pages)
- `render.yaml`, `.github/workflows/pages.yml` - konfigurasi deploy

Folder `server.js`, `src/store`, `src/services`, `scripts/*-check.js`, `supabase/` ialah backend Node/Supabase lama.
Ia **tidak digunakan** oleh build statik; dikekalkan sebagai rujukan jika anda mahu migrasi ke Supabase kelak.

Panduan penuh: **DEPLOY-GUIDE.md**
