GENERALI ONEFORM — VIBEHOST STATIC ROOT FIX

This ZIP is specifically for VibeHost dashboard's STATIC upload / drag-and-drop.
It fixes the archive layout by putting index.html at the ZIP ROOT (not inside generali-oneform/public/).

IMPORTANT LIMITATION: VibeHost static runtime does not execute Node server.js or API routes.
The static guard disables backend-dependent actions and warns visitors. This bundle can render
the frontend and download original blank PDF templates, but it is NOT a functional production
application. Do not collect or enter customer data through this static deployment.

Upload this ZIP in VibeHost dashboard only to replace the Not Found homepage with a visible
frontend shell. For API-backed login, customer submissions, persistent storage and email, use
the full Node package and VibeHost CLI/Node runtime (runtime availability may be restricted).

Files: index.html, styles.css, app.js, assets/, templates/, service worker, static-host-guard.js
