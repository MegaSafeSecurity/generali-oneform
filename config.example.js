/* Copy to config.js and fill with the Supabase project URL + public anon/publishable key.
   This file is safe for browser use only when it contains the PUBLIC anon/publishable key.
   NEVER put service_role, Google client secret, or Gmail refresh token here. */
window.GENERALI_ONEFORM_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
  supabaseAnonKey: "YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY",
  appBaseUrl: window.location.origin + window.location.pathname.replace(/\/$/, "")
};
