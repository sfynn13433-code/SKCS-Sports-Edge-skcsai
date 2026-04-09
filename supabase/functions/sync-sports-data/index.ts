/**
 * Supabase Edge Function: sync-sports-data
 *
 * Triggers the live backend ingestion pipeline so scheduled runs
 * actually execute real sync logic (instead of placeholder provider calls).
 */

Deno.serve(async (_req) => {
  const nowISO = new Date().toISOString();
  const backendHostRaw = Deno.env.get('SKCS_BACKEND_HOST') || Deno.env.get('BACKEND_HOST') || '';
  const apiKey = Deno.env.get('ADMIN_API_KEY') || Deno.env.get('SKCS_REFRESH_KEY') || '';

  if (!backendHostRaw || !apiKey) {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: 'Missing SKCS_BACKEND_HOST/BACKEND_HOST or ADMIN_API_KEY/SKCS_REFRESH_KEY',
        timestamp: nowISO
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }

  const backendHost = backendHostRaw.replace(/\/+$/, '');
  const target = `${backendHost}/api/pipeline/run-full`;

  try {
    const response = await fetch(target, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        source: 'supabase_edge_sync'
      })
    });

    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }

    return new Response(
      JSON.stringify({
        status: response.ok ? 'success' : 'error',
        backend_status: response.status,
        target,
        payload,
        timestamp: nowISO
      }),
      { headers: { 'Content-Type': 'application/json' }, status: response.ok ? 200 : response.status }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
        target,
        timestamp: nowISO
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 502 }
    );
  }
});
