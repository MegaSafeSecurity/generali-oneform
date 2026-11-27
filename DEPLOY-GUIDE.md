# Panduan Deploy (GitHub + Render / GitHub Pages)

## 1. Log masuk ejen awal
- Emel: `agent@generali-oneform.my`
- Kata laluan: `45034600abb5`  (TUKAR sebelum guna sebenar)

Tukar kata laluan: `npm run hash-password -- KataLaluanBaharu` -> salin `salt` dan `hash` ke `src/client/config.ts` (`AGENTS`).
Tukar juga `LINK_SECRET` (sebarang teks rawak panjang). Pautan lama menjadi tidak sah selepas `LINK_SECRET` ditukar.

## 2. Uji tempatan
```
npm ci
npm run build
npx serve dist
```

## 3. Push ke GitHub
```
git init && git add . && git commit -m "Generali OneForm static"
git branch -M main
git remote add origin https://github.com/megasafesecurity/generali-oneform.git
git push -u origin main --force
```

## 4a. GitHub Pages (https://megasafesecurity.github.io/generali-oneform/)
Repo > Settings > Pages > **Source: GitHub Actions**. Setiap push ke `main` akan build dan deploy sendiri (`.github/workflows/pages.yml`).

## 4b. Render (Static Site)
Render > New + > **Blueprint** > pilih repo (guna `render.yaml`). Atau manual: Static Site, Build `npm ci && npm run build`, Publish Directory `dist`, tambah Rewrite `/*` -> `/index.html`.

## 5. Aliran kerja & had (BACA)
1. Ejen log masuk > pilih borang > **Cipta pautan** > hantar pautan kepada pelanggan.
2. Pelanggan isi borang (draf disimpan automatik dalam pelayar), tandatangan, cop > **Hantar** > muat turun PDF.
3. Data pelanggan kekal **dalam pelayar pelanggan**. Untuk sampai kepada ejen, pelanggan hantar PDF, dan ejen boleh **Import rekod** (fail JSON) untuk melihat/muat turun semula PDF.

Had keselamatan portal tanpa pelayan:
- Kata laluan ejen dan `LINK_SECRET` berada dalam kod JavaScript yang boleh dibaca sesiapa. Ia menghalang akses santai dan pindaan tamat tempoh, **bukan** serangan bersungguh-sungguh.
- Pautan tidak boleh dibatalkan atau dihadkan sekali guna.
- PDF yang dijana ialah dokumen ringkasan bersih (jawapan + tandatangan + cop). Templat PDF asal kekal tersedia sebagai muat turun kosong; jawapan tidak dipetakan ke koordinat templat asal.
Untuk keselamatan sebenar (pengesahan pelayan, penyimpanan pusat, e-mel), sambungkan Supabase kelak.
