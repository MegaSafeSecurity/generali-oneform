#!/usr/bin/env bash
# Bersihkan sejarah Git daripada .env / kunci. BACA README bahagian "Bersihkan sejarah Git" dahulu.
# PENTING: putar (rotate) SEMUA kunci terlebih dahulu - memadam sejarah tidak membatalkan kunci yang sudah bocor.
set -euo pipefail
REPO_URL="${1:-https://github.com/megasafesecurity/generali-oneform.git}"
command -v git-filter-repo >/dev/null || { echo "Pasang dahulu: pip install git-filter-repo"; exit 1; }
read -r -p "Sudah putar semua kunci (Supabase/Google/DB/Render)? Taip YA: " a; [ "$a" = "YA" ] || exit 1
rm -rf generali-oneform-clean.git
git clone --mirror "$REPO_URL" generali-oneform-clean.git            # salinan kerja terpisah
cd generali-oneform-clean.git
# 1) buang semua fail .env* (kecuali .env.example), kunci peribadi dan sijil dari SEMUA commit
git filter-repo --force --invert-paths \
  --path-regex '^(.*/)?\.env(\.(?!example$)[^/]*)?$' --path-glob '*.pem' --path-glob '*.key' --path-glob '*.p12'
# 2) (pilihan) padam nilai rahsia yang pernah ditampal dalam fail lain: satu per baris dalam ../replacements.txt
#    format:  nilai-rahsia-sebenar==>***REMOVED***
if [ -f ../replacements.txt ]; then git filter-repo --force --replace-text ../replacements.txt; fi
echo "--- semakan (sepatutnya kosong) ---"
git log --all --oneline -- '.env' '.env.local' | head -3
git rev-list --all | xargs -n1 git grep -I -l -E 'service_role|sb_secret_|PRIVATE KEY' 2>/dev/null | head -5 || true
git remote add origin "$REPO_URL"
read -r -p "Hantar sejarah bersih ke GitHub (force)? Taip YA: " b; [ "$b" = "YA" ] || exit 0
git push --force --all origin && git push --force --tags origin
echo "Siap. Semua kolaborator mesti clone semula. Minta GitHub Support purge cache/PR refs jika perlu."
