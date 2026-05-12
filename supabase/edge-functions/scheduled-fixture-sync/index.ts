import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const backendUrl = Deno.env.get("BACKEND_URL")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  try {
    console.log('Scheduled fixture sync started');
    
    // 1. Fetch all enabled sports
    const { data: sports, error: sportError } = await supabase
      .from("sport_sync")
      .select("*")
      .eq("enabled", true);
    
    if (sportError) throw sportError;
    if (!sports || sports.length === 0) {
      console.log('No enabled sports found');
      return new Response(JSON.stringify({ success: true, message: 'No enabled sports' }), { status: 200 });
    }

    const now = new Date();
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    console.log(`Processing ${sports.length} sports for fixture sync`);

    // 2. Create a publish run for this cycle
    const { data: run, error: runError } = await supabase
      .from("prediction_publish_runs")
      .insert({
        trigger_source: "scheduled",
        run_scope: "UPCOMING_7_DAYS",
        requested_sports: sports.map(s => s.sport),
        status: "started",
        started_at: now.toISOString()
      })
      .select("id")
      .single();
    
    if (runError) throw runError;
    const publishRunId = run.id;

    console.log(`Created publish run: ${publishRunId}`);

    // 3. Process each sport by calling internal backend endpoint
    const results: any[] = [];
    
    for (const sportConfig of sports) {
      try {
        console.log(`Processing sport: ${sportConfig.sport} with adapter: ${sportConfig.adapter_name}`);
        
        // Call internal backend adapter endpoint
        const adapterResponse = await fetch(
          `${backendUrl}/api/internal/fetch-fixtures`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sport: sportConfig.sport,
              start: now.toISOString(),
              end: endDate.toISOString(),
              publishRunId
            })
          }
        );
        
        if (!adapterResponse.ok) {
          throw new Error(`Adapter failed for ${sportConfig.sport}: ${adapterResponse.status} ${adapterResponse.statusText}`);
        }
        
        const { fixtures } = await adapterResponse.json();
        
        // Update last_sync_at for this sport
        await supabase
          .from("sport_sync")
          .update({ last_sync_at: new Date().toISOString() })
          .eq("sport", sportConfig.sport);

        results.push({ 
          sport: sportConfig.sport, 
          count: fixtures || 0, 
          status: "ok" 
        });
        
        console.log(`Successfully processed ${sportConfig.sport}: ${fixtures || 0} fixtures`);
        
      } catch (err) {
        console.error(`Sport ${sportConfig.sport} failed:`, err.message);
        
        // Log partial failure to publish run
        await supabase
          .from("prediction_publish_runs")
          .update({ 
            error_message: `Sport ${sportConfig.sport} failed: ${err.message}` 
          })
          .eq("id", publishRunId);
          
        results.push({ 
          sport: sportConfig.sport, 
          status: "error", 
          error: err.message 
        });
      }
    }

    // 4. Trigger enrichment & AI pipeline via backend
    try {
      console.log('Triggering enrichment and AI pipeline...');
      const pipelineResponse = await fetch(`${backendUrl}/api/pipeline/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publishRunId })
      });
      
      if (!pipelineResponse.ok) {
        throw new Error(`Pipeline trigger failed: ${pipelineResponse.status} ${pipelineResponse.statusText}`);
      }
      
      const pipelineResult = await pipelineResponse.json();
      console.log('Pipeline triggered successfully:', pipelineResult);
      
    } catch (err) {
      console.error('Pipeline trigger failed:', err.message);
    }

    // 5. Mark run as completed
    await supabase
      .from("prediction_publish_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        metadata: { results }
      })
      .eq("id", publishRunId);

    console.log('Scheduled fixture sync completed successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      publishRunId,
      results,
      timestamp: new Date().toISOString()
    }), { status: 200 });
    
  } catch (err) {
    console.error("Global sync error:", err);
    return new Response(JSON.stringify({ 
      error: err.message,
      timestamp: new Date().toISOString()
    }), { status: 500 });
  }
});
