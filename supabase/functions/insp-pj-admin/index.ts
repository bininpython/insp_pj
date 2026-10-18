import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

Deno.serve((request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  return new Response(JSON.stringify({ error: "Este endpoint foi aposentado. O painel Equipe Inspeção usa armazenamento local." }), {
    status: 410,
    headers,
  });
});
