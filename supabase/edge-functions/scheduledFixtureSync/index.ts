import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { loadAdapter } from '../../../backend/adapters/index.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SportSyncConfig {
  id: number
  sport: string
  provider: string
  adapter_name: string
  api_key_reference: string
  sync_interval_minutes: number
  enabled: boolean
  supports_live: boolean
  supports_odds: boolean
  supports_player_stats: boolean
  last_sync_at: string | null
}

interface FixtureResult {
  action: string
  id_event: string
  created_at: string
  error_message?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all enabled sport configurations
    const { data: sportConfigs, error: configError } = await supabase
      .from('sport_sync')
      .select('*')
      .eq('enabled', true)

    if (configError) {
      throw new Error(`Failed to fetch sport configs: ${configError.message}`)
    }

    console.log(`Starting fixture sync for ${sportConfigs?.length || 0} sports`)

    const results: FixtureResult[] = []
    const now = new Date()
    const end = new Date(now.getTime() + 7 * 86400000) // 7 days ahead

    // Process each sport
    for (const config of sportConfigs || []) {
      try {
        console.log(`Processing ${config.sport} with adapter ${config.adapter_name}`)
        
        // Load the appropriate adapter
        const adapter = loadAdapter(config.adapter_name)
        
        // Fetch fixtures from the adapter
        const fixtures = await adapter.fetchFixtures(now, end)
        console.log(`Fetched ${fixtures.length} fixtures for ${config.sport}`)

        // Batch upsert fixtures with telemetry
        if (fixtures.length > 0) {
          // Log ingestion start for each fixture
          for (const fixture of fixtures) {
            await supabase.rpc('update_fixture_processing_log', {
              p_id_event: fixture.id_event,
              p_publish_run_id: publishRunId,
              p_phase: 'ingestion_started',
              p_sport: config.sport
            });
          }

          const { data: upsertResults, error: upsertError } = await supabase
            .rpc('upsert_raw_fixtures_batch', {
              p_fixtures: fixtures
            })

          if (upsertError) {
            // Log ingestion failure for each fixture
            for (const fixture of fixtures) {
              await supabase.rpc('update_fixture_processing_log', {
                p_id_event: fixture.id_event,
                p_publish_run_id: publishRunId,
                p_phase: 'ingestion_completed',
                p_failure_reason: upsertError.message
              });
            }
            throw new Error(`Upsert failed for ${config.sport}: ${upsertError.message}`)
          }

          // Log ingestion completion for successful fixtures
          for (const result of upsertResults || []) {
            if (result.action !== 'ERROR') {
              await supabase.rpc('update_fixture_processing_log', {
                p_id_event: result.id_event,
                p_publish_run_id: publishRunId,
                p_phase: 'ingestion_completed'
              });
            } else {
              await supabase.rpc('update_fixture_processing_log', {
                p_id_event: result.id_event,
                p_publish_run_id: publishRunId,
                p_phase: 'ingestion_completed',
                p_failure_reason: result.error_message
              });
            }
          }

          results.push(...(upsertResults || []))
        }

        // Update last_sync_at
        await supabase
          .from('sport_sync')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', config.id)

        console.log(`Completed sync for ${config.sport}`)

      } catch (error) {
        console.error(`Error processing ${config.sport}:`, error.message)
        results.push({
          action: 'ERROR',
          id_event: config.sport,
          created_at: new Date().toISOString(),
          error_message: error.message
        })
      }
    }

    // Create publish run record
    const { data: publishRun, error: runError } = await supabase
      .from('prediction_publish_runs')
      .insert({
        trigger_source: 'scheduled_fixture_sync',
        run_scope: 'UPCOMING_7_DAYS',
        requested_sports: sportConfigs?.map(c => c.sport) || [],
        status: 'completed',
        metadata: {
          fixtures_processed: results.length,
          timestamp: new Date().toISOString(),
          results: results.filter(r => r.action !== 'ERROR').length,
          errors: results.filter(r => r.action === 'ERROR').length
        }
      })
      .select()
      .single()

    if (runError) {
      console.error('Failed to create publish run:', runError.message)
    }

    return new Response(JSON.stringify({
      success: true,
      publish_run_id: publishRun?.id,
      results: results,
      summary: {
        total_sports: sportConfigs?.length || 0,
        fixtures_processed: results.filter(r => r.action !== 'ERROR').length,
        errors: results.filter(r => r.action === 'ERROR').length,
        timestamp: new Date().toISOString()
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Fixture sync error:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
