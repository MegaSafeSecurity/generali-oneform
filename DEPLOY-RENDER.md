# Generali OneForm — Render deployment fix

## Why the current Render deploy fails
The repository root contains `index.html`, `app.js`, `styles.css`, `liquid-nav.js`, and `assets/`.
There is no `public/` directory. The failed Render deploy is configured to publish `public`,
so Render reports: `Publish directory public does not exist!`.

## Existing Render service: change these settings
In Render Dashboard > your service > Settings > Build & Deploy:
- Runtime: Static
- Build Command: leave empty
- Publish Directory: `.`

Save changes, then open Deploys and choose **Manual Deploy > Deploy latest commit**.

The included `render.yaml` expresses the same static-site configuration for a Render Blueprint.
It does not change an already-created service's settings unless the service is managed from that Blueprint.

## Important: backend is NOT activated by this deployment fix
This package remains a frontend/handoff scaffold. `app.js` intentionally displays the
preparation-mode notice. The included Supabase Edge Function is a 501 placeholder.
Do not collect real customer information until the missing backend workflows, access policies,
PDF generation/mapping, private file storage, Gmail delivery, and security tests are implemented.

Required server-side configuration is listed in `ENVIRONMENT.example`.
Never put Supabase service-role keys, Google client secrets, or refresh tokens in browser code,
GitHub, or a public ZIP. Set secrets only in the relevant server/Edge Function secret manager.

## Files preserved
All original files and PDF templates from the supplied ZIP are retained unchanged.
