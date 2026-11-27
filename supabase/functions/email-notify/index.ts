// Edge Function scaffold only. Requires server-side Gmail OAuth implementation and secrets.
// Never place GOOGLE_CLIENT_SECRET, refresh tokens, or Supabase service-role keys in browser code.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  return new Response(JSON.stringify({
    ok: false,
    code: "NOT_CONFIGURED",
    message: "Gmail OAuth delivery is not implemented in this handoff scaffold."
  }), { status: 501, headers: { "content-type": "application/json" } });
});
