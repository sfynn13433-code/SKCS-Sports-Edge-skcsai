# SKCS Execution Spine Compliance Map

## Summary
- Files scanned: 3736
- Files with findings: 174
- Files already using `executeOperation`: 1
- Direct cron schedules: 21
- Direct AI calls: 10
- Direct pipeline entry calls: 20
- Raw SQL write surfaces: 707

## Findings
### .gemini/antigravity/README.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 173: `### **Update Process**`

### .venv/Lib/site-packages/pyparsing/ai/best_practices.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 8: `- Before developing the pyparsing expressions, define a Backus-Naur Form definition and save this in docs/grammar.md. Update this document as changes are made in the parser.`

### backend/audit/system_integrity_audit.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 167: `# Update events with intelligence links`
- Raw SQL update at line 221: `**Update all frontend-facing API endpoints** to read from new schema:`
- Raw SQL update at line 293: `3. **MEDIUM PRIORITY**: Update all prediction API endpoints to read from new JSONB columns (`edge_data`, `live_momentum`)`

### backend/core/executionPipeline.js
- Wrapped with `executeOperation`: yes
- Wrapped execution spine at line 21: `async function executeOperation(context = {}) {`

### backend/core/verificationController.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 260: ``INSERT INTO public.system_health_state (`

### backend/database.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 481: `INSERT INTO tier_rules (tier, min_confidence, allowed_markets, max_acca_size, allowed_volatility)`
- Raw SQL insert at line 493: `INSERT INTO acca_rules (rule_name, rule_value)`
- Raw SQL insert at line 515: `INSERT INTO table_lifecycle_registry (table_name, lifecycle_state, is_active, owner_component, notes)`
- Raw SQL insert at line 589: ``INSERT INTO prediction_results (match_id, sport, prediction_type, market, prediction, actual_outcome, status, confidence, odds, settled_at)`
- Raw SQL insert at line 815: `'INSERT INTO users (email, password_hash, subscription_type, subscription_expiry) VALUES ($1, $2, $3, $4) RETURNING id, email, subscription_type',`
- Raw SQL insert at line 900: ``INSERT INTO subscriptions (`
- Raw SQL insert at line 969: ``INSERT INTO profiles (id, email, subscription_status, is_test_user, plan_id, plan_tier, plan_expires_at)`
- Raw SQL update at line 342: `UPDATE direct1x2_prediction_final`
- Raw SQL update at line 485: `ON CONFLICT (tier) DO UPDATE SET`
- Raw SQL update at line 499: `ON CONFLICT (rule_name) DO UPDATE SET`
- Raw SQL update at line 529: `ON CONFLICT (table_name) DO UPDATE SET`
- Raw SQL update at line 879: `'UPDATE users SET has_used_day_zero = TRUE WHERE id = $1',`
- Raw SQL update at line 972: `DO UPDATE SET`
- Raw SQL update at line 989: `console.log('Weekly accuracy update not yet implemented for PostgreSQL');`
- Raw SQL delete at line 468: `DELETE FROM tier_rules`

### backend/dbBootstrap.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 399: `INSERT INTO secondary_market_allowlist (market_key, category) VALUES`
- Raw SQL insert at line 572: `INSERT INTO tier_rules (tier, min_confidence, allowed_markets, max_acca_size, allowed_volatility)`
- Raw SQL insert at line 588: `INSERT INTO acca_rules (rule_name, rule_value)`
- Raw SQL insert at line 1079: `INSERT INTO table_lifecycle_registry (table_name, lifecycle_state, is_active, owner_component, notes)`
- Raw SQL update at line 81: `UPDATE prediction_publish_runs`
- Raw SQL update at line 294: `UPDATE direct1x2_prediction_final`
- Raw SQL update at line 301: `UPDATE direct1x2_prediction_final`
- Raw SQL update at line 348: `UPDATE direct1x2_prediction_final pf`
- Raw SQL update at line 487: `BEFORE INSERT OR UPDATE ON direct1x2_prediction_final`
- Raw SQL update at line 576: `ON CONFLICT (tier) DO UPDATE SET`
- Raw SQL update at line 594: `ON CONFLICT (rule_name) DO UPDATE SET`
- Raw SQL update at line 653: `UPDATE predictions_accuracy pa`
- Raw SQL update at line 1099: `ON CONFLICT (table_name) DO UPDATE SET`
- Raw SQL delete at line 33: `DELETE FROM fixtures`
- Raw SQL delete at line 105: `DELETE FROM direct1x2_prediction_final pf`
- Raw SQL delete at line 114: `DELETE FROM predictions_accuracy pa`
- Raw SQL delete at line 557: `DELETE FROM tier_rules`

### backend/routes/predictions.js
- Wrapped with `executeOperation`: no
- Raw SQL delete at line 2799: `await query(`DELETE FROM predictions_filtered`);`
- Raw SQL delete at line 2800: `await query(`DELETE FROM predictions_raw`);`
- Raw SQL delete at line 2801: `const finalResult = await query(`DELETE FROM direct1x2_prediction_final`);`
- Raw SQL delete at line 2802: `await query(`DELETE FROM prediction_publish_runs`);`
- Raw SQL delete at line 2803: `await query(`DELETE FROM rapidapi_cache`);`
- Raw SQL delete at line 2804: `await query(`DELETE FROM context_intelligence_cache`);`
- Raw SQL delete at line 2805: `await query(`DELETE FROM fixture_context_cache`);`
- Raw SQL delete at line 2843: `await query(`DELETE FROM predictions_filtered WHERE raw_id IN (SELECT id FROM predictions_raw WHERE metadata->>'data_mode' = 'test')`);`
- Raw SQL delete at line 2845: `const rawResult = await query(`DELETE FROM predictions_raw WHERE metadata->>'data_mode' = 'test'`);`
- Raw SQL delete at line 2847: `await query(`DELETE FROM direct1x2_prediction_final`);`

### backend/routes/refresh-ai.js
- Wrapped with `executeOperation`: no
- Direct AI insight call at line 61: `const aiInsight = await generateInsight({`
- Raw SQL update at line 88: `// Update in database using PostgreSQL`
- Raw SQL update at line 91: `UPDATE direct1x2_prediction_final`
- Raw SQL update at line 104: `console.error(`[Admin] Update failed for ${p.id}:`, updateError);`

### backend/routes/sportsEdge.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 4: `* Directive: Do not break the system or update existing code.`

### backend/routes/v1/acca.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 98: `INSERT INTO accas (user_id, total_confidence, combined_odds, leg_count,`
- Raw SQL insert at line 116: `INSERT INTO acca_legs (acca_id, prediction_id, created_at)`

### backend/scripts/patch-card-uniqueness.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 136: `// PATCH 2: Update 6-leg ACCA build loop with card uniqueness, team lock, pool rotation`
- Raw SQL update at line 232: `// PATCH 3: Update Mega ACCA build with full diagnostics`
- Raw SQL update at line 329: `// PATCH 4: Update diagnostics block to include new fields`

### backend/scripts/patch-final-flow.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 11: `// PATCH 1: Update require block to add new insightEngine exports`
- Raw SQL update at line 221: `// PATCH 3: Update diagnostics block`

### backend/scripts/patch-row-cleanup.js
- Wrapped with `executeOperation`: no
- Raw SQL delete at line 25: `'DELETE FROM direct1x2_prediction_final WHERE tier = $1',`

### backend/scripts/patch-skcs-law.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 158: `// PATCH 3: Update buildFinalForTier diagnostics to include SKCS law checks`

### backend/semantic-layer/violationLogger.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 85: ``INSERT INTO public.semantic_violations (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`,`

### backend/server-express.js
- Wrapped with `executeOperation`: no
- Direct cron scheduling at line 170: `// cron.schedule(WEEKLY_ROLLING_SCRAPE_CRON, () => {`
- Direct cron scheduling at line 205: `// cron.schedule(ACCA_ROLLING_SYNC_CRON, () => {`
- Direct cron scheduling at line 209: `// cron.schedule(CORE_MARKET_ROLLING_SYNC_CRON, () => {`
- Direct sync pipeline call at line 1764: `const count = await syncDailyFixtures(today);`
- Direct enrichment call at line 1818: `const enriched = await enrichMatchContext(id_event);`
- Direct insight generation call at line 1822: `const insight = await generateEdgeMindInsight(id_event);`
- Raw SQL insert at line 1014: `INSERT INTO prediction_publish_runs (`
- Raw SQL insert at line 1051: `INSERT INTO tier_rules (tier, min_confidence, allowed_markets, max_acca_size, allowed_volatility)`
- Raw SQL insert at line 1204: `INSERT INTO direct1x2_prediction_final (`
- Raw SQL insert at line 1272: `INSERT INTO rapidapi_cache (cache_key, provider_name, payload, updated_at)`
- Raw SQL insert at line 1510: `INSERT INTO public_intelligence (`
- Raw SQL update at line 129: `// Update publish run with error`
- Raw SQL update at line 131: `UPDATE prediction_publish_runs`
- Raw SQL update at line 1032: `UPDATE prediction_publish_runs`
- Raw SQL update at line 1055: `ON CONFLICT (tier) DO UPDATE SET`
- Raw SQL update at line 1274: `ON CONFLICT (cache_key) DO UPDATE SET`
- Raw SQL update at line 1504: `// Update state tracker`
- Raw SQL update at line 1516: `ON CONFLICT (espn_entity_id) DO UPDATE SET`

### backend/services/accaBuilder.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 1479: `INSERT INTO same_match_combinations (`
- Raw SQL insert at line 3260: `INSERT INTO team_week_locks (`
- Raw SQL insert at line 3482: `insert into direct1x2_prediction_final (`
- Raw SQL insert at line 3576: ``INSERT INTO predictions_stage_1`
- Raw SQL insert at line 3635: ``INSERT INTO predictions_stage_2`
- Raw SQL insert at line 3688: ``INSERT INTO predictions_stage_3`
- Raw SQL insert at line 3701: `INSERT INTO debug_published (publish_run_id, tier, sport, candidate, rejection_metadata)`
- Raw SQL update at line 1484: `ON CONFLICT (fixture_id, combination_legs) DO UPDATE SET`
- Raw SQL delete at line 3882: `await client.query('DELETE FROM predictions_stage_1 WHERE created_at < NOW() - INTERVAL \'1 day\'');`
- Raw SQL delete at line 3883: `await client.query('DELETE FROM predictions_stage_2 WHERE created_at < NOW() - INTERVAL \'1 day\'');`
- Raw SQL delete at line 3884: `await client.query('DELETE FROM predictions_stage_3 WHERE created_at < NOW() - INTERVAL \'1 day\'');`
- Raw SQL delete at line 3930: `'DELETE FROM direct1x2_prediction_final WHERE tier = $1',`

### backend/services/aiPipeline.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 1995: `insert into predictions_raw`
- Raw SQL insert at line 2259: `INSERT INTO prediction_publish_runs (`
- Raw SQL update at line 1970: `update predictions_raw`
- Raw SQL update at line 2238: `UPDATE prediction_publish_runs`
- Raw SQL update at line 2314: `UPDATE prediction_publish_runs`
- Raw SQL update at line 2343: `UPDATE prediction_publish_runs`

### backend/services/aiPipelineOrchestrator.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 20: `INSERT INTO prediction_publish_runs (`
- Raw SQL insert at line 151: `INSERT INTO predictions_raw (`
- Raw SQL insert at line 368: `// Insert into predictions_filtered`
- Raw SQL insert at line 370: `INSERT INTO predictions_filtered (raw_id, tier, is_valid, reject_reason)`
- Raw SQL insert at line 376: `INSERT INTO direct1x2_prediction_final (`
- Raw SQL insert at line 423: `INSERT INTO predictions_filtered (raw_id, tier, is_valid, reject_reason)`
- Raw SQL insert at line 471: `INSERT INTO direct1x2_prediction_final (`
- Raw SQL update at line 57: `// Update publish run as completed`
- Raw SQL update at line 59: `UPDATE prediction_publish_runs`
- Raw SQL update at line 76: `// Update publish run as failed`
- Raw SQL update at line 79: `UPDATE prediction_publish_runs`

### backend/services/aiProvider.js
- Wrapped with `executeOperation`: no
- Direct AI insight call at line 671: `async function generateInsight(params) {`
- Direct Dolphin call at line 210: `async function analyzeWithDolphin(match) {`
- Raw SQL update at line 848: `// Update default confidence to 85 to pass DB trigger and allow secondary markets`
- Raw SQL update at line 880: `// Update default confidence to 85 to pass DB trigger and allow secondary markets`

### backend/services/aiProvider_odds_update.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 2: `* aiProvider_odds_update.js - EdgeMind Prompt Update for Odds Integration`
- Raw SQL update at line 85: `// Also need to update the Groq version of the function`

### backend/services/aiScoring.js
- Wrapped with `executeOperation`: no
- Direct Dolphin call at line 163: `const dolphinResult = await analyzeWithDolphin(dolphinInput);`

### backend/services/aiTelemetryService.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 63: ``INSERT INTO public.ai_pipeline_telemetry (`
- Raw SQL insert at line 124: ``INSERT INTO public.blocked_ai_calls_log (`

### backend/services/antigravity/WorkflowEngine.js
- Wrapped with `executeOperation`: no
- Direct cron scheduling at line 132: `const task = cron.schedule(triggers.schedule, () => {`
- Direct cron scheduling at line 709: `const task = cron.schedule(schedule, () => {}, { scheduled: false });`

### backend/services/apiCacheService.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 161: `INSERT INTO rapidapi_cache (cache_key, provider_name, payload, updated_at)`
- Raw SQL update at line 163: `ON CONFLICT (cache_key) DO UPDATE SET`

### backend/services/blockedApiCallsLog.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 52: ``INSERT INTO blocked_api_calls_log (sport, provider, reason, source, units, metadata)`

### backend/services/contextEnrichmentService.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 119: `INSERT INTO event_odds_snapshots (id_event, odds, source)`
- Raw SQL insert at line 126: `INSERT INTO match_context_data (`
- Raw SQL insert at line 401: `INSERT INTO context_intelligence_cache (`
- Raw SQL update at line 15: `UPDATE context_enrichment_queue`
- Raw SQL update at line 40: `UPDATE context_enrichment_queue`
- Raw SQL update at line 55: `UPDATE context_enrichment_queue`
- Raw SQL update at line 133: `DO UPDATE SET`
- Raw SQL update at line 407: `DO UPDATE SET`

### backend/services/cronJobs.js
- Wrapped with `executeOperation`: no
- Direct cron scheduling at line 24: `cron.schedule('1 0 * * *', async () => {`
- Direct cron scheduling at line 45: `cron.schedule('*/30 * * * *', async () => {`
- Direct cron scheduling at line 127: `cron.schedule('5,35 * * * *', async () => {`
- Direct cron scheduling at line 143: `cron.schedule('*/30 * * * *', async () => {`
- Direct sync pipeline call at line 34: `const count = await syncDailyFixtures(today);`
- Direct enrichment call at line 98: `const enriched = await enrichMatchContext(id_event);`
- Direct insight generation call at line 102: `const insight = await generateEdgeMindInsight(id_event);`
- Raw SQL delete at line 156: `DELETE FROM direct1x2_prediction_final pf`
- Raw SQL delete at line 169: `//     DELETE FROM predictions_raw`

### backend/services/direct1x2Builder.js
- Wrapped with `executeOperation`: no
- Direct AI insight call at line 514: `const aiInsight = await generateInsight({`
- Raw SQL update at line 691: `// Update only the fields that should change, preserving tier, type, and publish_run_id`
- Raw SQL update at line 766: `AFTER INSERT OR UPDATE ON direct1x2_prediction_final`

### backend/services/filterEngine.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 207: `insert into predictions_filtered (raw_id, tier, is_valid, reject_reason, is_watchlist)`
- Raw SQL update at line 210: `do update set`

### backend/services/masterRulebookRiskClassification.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 195: `* Update AI provider prompt with Master Rulebook rules`

### backend/services/oddsApiPipeline.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 316: `INSERT INTO match_context_data (id_event, odds, updated_at)`
- Raw SQL update at line 314: `// Update match_context_data with odds`
- Raw SQL update at line 319: `DO UPDATE SET`

### backend/services/proFootballDataService.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 4: `* Directive: Do not break the system or update existing code.`

### backend/services/providerQuotaService.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 19: ``INSERT INTO rapidapi_quota_usage (provider_name, window_type, window_start, usage_count, updated_at)`
- Raw SQL update at line 29: ``UPDATE rapidapi_quota_usage`

### backend/services/skcsHeartbeat.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 4: `* Directive: Do not break the system or update existing code.`
- Raw SQL update at line 276: `// Every 30 minutes: Update Live Scores (Basic Plan optimization)`
- Raw SQL update at line 283: `// Every hour: Update Trends and News`

### backend/services/sportsApiProFootballService.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 117: `// Update last request timestamp`

### backend/services/thesportsdbPipeline.js
- Wrapped with `executeOperation`: no
- Direct sync pipeline call at line 5: `* 1. syncDailyFixtures(date) - Discovery layer: populate raw_fixtures table`
- Direct sync pipeline call at line 69: `* syncDailyFixtures(date)`
- Direct sync pipeline call at line 75: `async function syncDailyFixtures(date) {`
- Direct enrichment call at line 6: `* 2. enrichMatchContext(idEvent) - Deep insight layer: fetch lineups, stats, timeline`
- Direct enrichment call at line 185: `* enrichMatchContext(idEvent)`
- Direct enrichment call at line 193: `async function enrichMatchContext(idEvent) {`
- Direct insight generation call at line 7: `* 3. generateEdgeMindInsight(idEvent) - AI prediction layer: generate insights`
- Direct insight generation call at line 385: `* generateEdgeMindInsight(idEvent)`
- Direct insight generation call at line 393: `async function generateEdgeMindInsight(idEvent) {`
- Raw SQL insert at line 46: `INSERT INTO raw_fixtures (id_event, sport, league_id, home_team_id, away_team_id, start_time, raw_json)`
- Raw SQL insert at line 118: `//   INSERT INTO raw_fixtures (id_event, sport, league_id, home_team_id, away_team_id, start_time, raw_json)`
- Raw SQL insert at line 352: `INSERT INTO match_context_data (id_event, lineups, stats, timeline, home_last_5, away_last_5, deep_context)`
- Raw SQL insert at line 489: `INSERT INTO ai_predictions (match_id, confidence_score, edgemind_feedback, value_combos, same_match_builder)`
- Raw SQL update at line 48: `ON CONFLICT (id_event) DO UPDATE SET`
- Raw SQL update at line 120: `//   ON CONFLICT (id_event) DO UPDATE SET`
- Raw SQL update at line 354: `ON CONFLICT (id_event) DO UPDATE SET`
- Raw SQL update at line 491: `ON CONFLICT (match_id) DO UPDATE SET`

### backend/services/tier1BootstrapService.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 222: `INSERT INTO rapidapi_cache (cache_key, provider_name, payload, updated_at)`
- Raw SQL update at line 224: `ON CONFLICT (cache_key) DO UPDATE SET`

### backend/services/unifiedFixturesService.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 99: `INSERT INTO fixtures_unified (provider, provider_match_id, sport, match_format, competition, home_team, away_team, venue, country, start_time, status, raw_status, raw_payload)`

### backend/services/unifiedPredictionsService.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 114: `INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, metadata, ai_model, sport, market_type, processing_stage, matches, edgemind_report, secondary_insights, secondary_markets, total_confidence)`
- Raw SQL update at line 148: `* Update prediction status`
- Raw SQL update at line 151: `* @param {Object} updateData - Additional update data`
- Raw SQL update at line 156: `UPDATE predictions_unified`

### backend/src/services/contextIntelligence/cacheService.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 91: `INSERT INTO context_intelligence_cache (cache_key, fixture_id, payload, last_verified, expires_at, updated_at)`
- Raw SQL update at line 94: `DO UPDATE SET`

### backend/utils/apiCache.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 72: `INSERT INTO rapidapi_cache (cache_key, provider_name, payload, updated_at)`
- Raw SQL update at line 74: `ON CONFLICT (cache_key) DO UPDATE SET`

### backend/utils/apiUsageLimiter.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 55: `console.warn('[apiUsageLimiter] Failed to update usage logs:', upsertError.message);`

### backend/utils/jobLogger.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 14: `INSERT INTO scheduling_logs (`
- Raw SQL update at line 37: `UPDATE scheduling_logs SET`
- Raw SQL update at line 70: `UPDATE scheduling_logs SET`

### backend/utils/purgeStaleData.js
- Wrapped with `executeOperation`: no
- Raw SQL delete at line 39: `DELETE FROM direct1x2_prediction_final`
- Raw SQL delete at line 67: `DELETE FROM predictions_raw`

### check-recent-predictions.js
- Wrapped with `executeOperation`: no
- Direct AI insight call at line 80: `console.log('4. generateInsight() is throwing errors');`

### COMPREHENSIVE_FOOTBALL_RULES_REPORT.md
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 598: `INSERT INTO sport_sync (sport, enabled, adapter_name, provider, sync_interval_minutes, supports_odds, supports_player_stats) VALUES`

### DASHBOARD_QUICK_START.md
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 109: `**Not Yet Displayed:** Need to insert into HTML`

### DASHBOARD_REFACTOR_GUIDE.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 25: `**State Update Function:**`
- Raw SQL update at line 244: `// Update display text`
- Raw SQL update at line 312: `3. **Update Main Content Area:**`

### DEPLOYMENT_VERIFICATION_GUIDE.md
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 79: `INSERT INTO direct1x2_prediction_final`
- Raw SQL insert at line 98: `INSERT INTO direct1x2_prediction_final`
- Raw SQL insert at line 105: `INSERT INTO direct1x2_prediction_final`
- Raw SQL insert at line 112: `INSERT INTO direct1x2_prediction_final`
- Raw SQL insert at line 130: `INSERT INTO direct1x2_prediction_final`
- Raw SQL insert at line 134: `INSERT INTO direct1x2_prediction_final`
- Raw SQL insert at line 170: `INSERT INTO direct1x2_prediction_final`
- Raw SQL insert at line 174: `INSERT INTO direct1x2_prediction_final`
- Raw SQL insert at line 207: `INSERT INTO direct1x2_prediction_final`
- Raw SQL insert at line 244: `INSERT INTO direct1x2_prediction_final`
- Raw SQL insert at line 280: `INSERT INTO direct1x2_prediction_final`
- Raw SQL delete at line 89: `psql $DATABASE_URL -c "DELETE FROM direct1x2_prediction_final WHERE match_id = 'test_extreme_001';"`
- Raw SQL delete at line 121: `psql $DATABASE_URL -c "DELETE FROM direct1x2_prediction_final WHERE match_id = 'test_secondary_001';"`

### docs/DEPLOYMENT_GUIDE.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 157: `- Update dependencies monthly`

### docs/SKCS_ENGINE_V2_PHASE05_INGEST_MAP.md
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 172: `| 5 | Unify table target: RPC or insert into `football_canonical_events` | migration / `canonicalEvents.js` |`

### docs/SKCS_ENGINE_V2_PHASE0B5_REPLAY.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 57: `| Goals update latency | Finished refresh job (`fixtures?id=`) |`
- Raw SQL update at line 153: `UPDATE football_canonical_events`

### dolphin-server/README.md
- Wrapped with `executeOperation`: no
- Direct AI insight call at line 53: `2. If available, it calls `aiProvider.generateInsight()` with match details`

### football-ecosystem-report.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 27: `UPDATE predictions_raw SET sport = 'Football' WHERE LOWER(sport) IN ('football', 'soccer');`
- Raw SQL update at line 28: `UPDATE direct1x2_prediction_final SET sport = 'Football' WHERE LOWER(sport) IN ('football', 'soccer');`
- Raw SQL update at line 29: `UPDATE predictions_accuracy SET sport = 'Football' WHERE LOWER(sport) IN ('football', 'soccer');`
- Raw SQL update at line 197: `- **Update Frequency**: Every 60 seconds (live scores)`

### FRONTEND_FIXES_SUMMARY.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 11: `### 2. Update Risk Thresholds to Master Rulebook`
- Raw SQL update at line 49: `### 1. Update Risk Classification Service`

### FRONTEND_INVESTIGATION_REPORT.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 150: `### 1. Update Risk Thresholds`
- Raw SQL update at line 155: `- Update color thresholds to 75%, 55%, 30%`
- Raw SQL update at line 179: `### 4. Update Message Templates`
- Raw SQL update at line 216: `2. **Critical**: Update Safe Haven logic (lines 784-846)`
- Raw SQL update at line 218: `4. **High**: Update message templates (lines 826-833)`

### FULL_WORKSPACE_AUDIT_REPORT.md
- Wrapped with `executeOperation`: no
- Raw SQL delete at line 49: `| `about-bg.jpg` | `public/about-bg.jpg` | 778KB | DELETE from root |`
- Raw SQL delete at line 50: `| `hero-page.jpg` | `public/hero-page.jpg` | 148KB | DELETE from root |`
- Raw SQL delete at line 51: `| `language.jpg` | `public/language.jpg` | 337KB | DELETE from root |`
- Raw SQL delete at line 52: `| `login.jpg` | `public/login.jpg` | 100KB | DELETE from root |`
- Raw SQL delete at line 53: `| `windrawwin.jpg` | `public/windrawwin.jpg` | 218KB | DELETE from root |`
- Raw SQL delete at line 60: `| `about-bg.webp` | `public/about-bg.webp` | 69KB | DELETE from root |`
- Raw SQL delete at line 61: `| `hero-page.webp` | `public/hero-page.webp` | 45KB | DELETE from root |`
- Raw SQL delete at line 434: `| Duplicate images | 1.5MB wasted | Delete from root |`

### IMPLEMENTATION_GAP_ANALYSIS.md
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 227: `INSERT INTO secondary_market_allowlist (market_key, min_confidence, is_safe_haven) VALUES`
- Raw SQL update at line 172: `### 1. Update Confidence Thresholds`
- Raw SQL update at line 210: `### 3. Update ACCA Confidence Minimums`
- Raw SQL update at line 221: `-- Update risk tier enum`
- Raw SQL update at line 225: `-- Update secondary market allowlist`
- Raw SQL update at line 226: `UPDATE secondary_market_allowlist SET min_confidence = 80 WHERE is_primary = true;`

### IMPLEMENTATION_SUMMARY.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 21: `✔️ State update function triggers automatic re-rendering`

### MASTER_RULEBOOK_IMPLEMENTATION_GUIDE.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 56: `BEFORE INSERT OR UPDATE ON direct1x2_prediction_final`
- Raw SQL update at line 65: `BEFORE INSERT OR UPDATE ON direct1x2_prediction_final`
- Raw SQL update at line 216: `# Update configuration`
- Raw SQL update at line 218: `# Update confidence thresholds in the backup`
- Raw SQL update at line 324: `3. Update frontend to use new endpoints`
- Raw SQL update at line 329: `2. Update documentation`

### phase2-final-summary.json
- Wrapped with `executeOperation`: no
- Raw SQL update at line 29: `"Gradually update filtering logic to use unified service",`

### phase3-comprehensive-summary.json
- Wrapped with `executeOperation`: no
- Raw SQL update at line 56: `"Gradually update prediction services to use unified service",`

### phase3-migration-summary.json
- Wrapped with `executeOperation`: no
- Raw SQL update at line 33: `"Gradually update prediction services to use unified service",`

### PRIVACY_POLICY.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 60: `We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date.`

### public/js/hero-carousel.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 346: `// Update indicators`

### public/js/smh-hub.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 720: `// Helper: Update modal with AI prediction data`
- Raw SQL update at line 1435: `// Update AI confidence score`
- Raw SQL update at line 1551: `// Helper: Update modal loading state`
- Raw SQL update at line 1641: `// Update modal if it's already open`
- Raw SQL update at line 1652: `// Update modal with placeholder content`
- Raw SQL update at line 1673: `// Update modal with error message`
- Raw SQL update at line 1683: `// Update modal with timeout message`
- Raw SQL update at line 1693: `// Update modal with generic error message`
- Raw SQL update at line 1818: `// 1. Update Terminal Content`
- Raw SQL update at line 1824: `// Update UI States for all buttons`

### public/js/supabase-bundle.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 530: `* insert into`
- Raw SQL insert at line 887: `* insert into`
- Raw SQL insert at line 951: `* insert into`
- Raw SQL insert at line 1010: `* insert into`
- Raw SQL insert at line 1015: `* insert into`
- Raw SQL insert at line 1076: `* insert into`
- Raw SQL insert at line 1081: `* insert into`
- Raw SQL insert at line 1137: `* insert into`
- Raw SQL insert at line 1182: `* insert into`
- Raw SQL insert at line 1186: `* insert into`
- Raw SQL insert at line 1246: `* insert into`
- Raw SQL insert at line 1368: `* insert into`
- Raw SQL insert at line 1413: `* insert into`
- Raw SQL insert at line 1454: `* insert into`
- Raw SQL insert at line 1527: `* insert into`
- Raw SQL insert at line 1558: `* insert into`
- Raw SQL insert at line 1684: `* insert into`
- Raw SQL insert at line 1731: `* insert into`
- Raw SQL insert at line 1786: `* insert into`
- Raw SQL insert at line 1833: `* insert into`
- Raw SQL insert at line 1884: `* insert into`
- Raw SQL insert at line 1931: `* insert into`
- Raw SQL insert at line 1982: `* insert into`
- Raw SQL insert at line 2053: `* insert into`
- Raw SQL insert at line 2157: `* insert into`
- Raw SQL insert at line 2217: `* insert into`
- Raw SQL insert at line 2291: `* insert into`
- Raw SQL insert at line 2334: `* insert into`
- Raw SQL insert at line 2373: `* insert into`
- Raw SQL insert at line 2425: `* insert into`
- Raw SQL insert at line 2468: `* insert into`
- Raw SQL insert at line 2507: `* insert into`
- Raw SQL insert at line 2566: `* insert into`
- Raw SQL insert at line 2626: `* insert into`
- Raw SQL insert at line 2685: `* insert into`
- Raw SQL insert at line 2744: `* insert into`
- Raw SQL insert at line 2804: `* insert into`
- Raw SQL insert at line 2856: `* insert into`
- Raw SQL insert at line 2899: `* insert into`
- Raw SQL insert at line 2960: `* insert into texts (content) values`
- Raw SQL insert at line 3060: `* insert into`
- Raw SQL insert at line 3123: `* insert into`
- Raw SQL insert at line 3187: `* insert into`
- Raw SQL insert at line 3224: `* insert into`
- Raw SQL insert at line 3269: `* insert into`
- Raw SQL insert at line 3274: `* insert into`
- Raw SQL insert at line 3340: `* insert into`
- Raw SQL insert at line 3386: `* insert into`
- Raw SQL insert at line 3391: `* insert into`
- Raw SQL insert at line 3513: `* insert into`
- Raw SQL insert at line 3555: `* insert into`
- Raw SQL insert at line 3608: `* insert into`
- Raw SQL insert at line 3613: `* insert into`
- Raw SQL insert at line 3672: `* insert into`
- Raw SQL insert at line 3677: `* insert into`
- Raw SQL insert at line 3750: `* insert into`
- Raw SQL insert at line 3755: `* insert into`
- Raw SQL insert at line 3760: `* insert into`
- Raw SQL insert at line 3836: `*  insert into`
- Raw SQL insert at line 3842: `*  insert into`
- Raw SQL insert at line 3918: `* insert into users (id, name)`
- Raw SQL insert at line 3922: `* insert into`
- Raw SQL insert at line 3927: `* insert into`
- Raw SQL insert at line 3933: `* insert into`
- Raw SQL insert at line 4001: `* insert into`
- Raw SQL insert at line 4006: `* insert into`
- Raw SQL insert at line 4056: `*   insert into orchestral_sections (name)`
- Raw SQL insert at line 4059: `* insert into instruments (name, section_id) values`
- Raw SQL insert at line 4097: `* insert into`
- Raw SQL insert at line 4139: `* insert into`
- Raw SQL insert at line 4187: `*   insert into orchestral_sections (name)`
- Raw SQL insert at line 4190: `* insert into instruments (name, section_id) values`
- Raw SQL insert at line 4232: `* insert into myschema.mytable (data) values ('mydata');`
- Raw SQL insert at line 4272: `* Perform an INSERT into the table or view.`
- Raw SQL insert at line 4509: `* insert into`
- Raw SQL insert at line 4545: `* insert into`
- Raw SQL insert at line 4594: `* insert into`
- Raw SQL insert at line 4679: `* insert into`
- Raw SQL insert at line 4707: `* insert into`
- Raw SQL insert at line 4755: `* insert into`
- Raw SQL insert at line 4838: `* insert into`
- Raw SQL insert at line 4866: `* insert into`
- Raw SQL insert at line 4899: `* insert into`
- Raw SQL insert at line 5206: `* insert into`
- Raw SQL update at line 4641: `* Perform an UPDATE on the table or view.`
- Raw SQL update at line 4646: `* @param values - The values to update with`
- Raw SQL update at line 4693: `* @example Update a record and return it`
- Raw SQL update at line 4702: `* @exampleSql Update a record and return it`
- Raw SQL update at line 4713: `* @exampleResponse Update a record and return it`
- Raw SQL update at line 4730: `* working with JSON data. Currently, it is only possible to update the entire JSON document.`
- Raw SQL update at line 9545: `* Can update the schema, partition spec, or properties of a table.`
- Raw SQL update at line 9548: `* @param request - Update request with fields to modify`
- Raw SQL update at line 10277: `* @example Update file`
- Raw SQL update at line 10299: `* @example Update file using `ArrayBuffer` from base64 file data`
- Raw SQL update at line 10317: `* - For React Native, using either `Blob`, `File` or `FormData` does not work as intended. Update file using `ArrayBuffer` from base64 file data instead, see example below.`
- Raw SQL update at line 10796: `* Update file metadata`
- Raw SQL update at line 10797: `* @param id the file id to update metadata`
- Raw SQL update at line 11136: `* @example Update bucket`
- Raw SQL update at line 16619: `*   2. `phone_change` – Used when verifying an OTP sent to a new phone number during a phone number update process.`
- Raw SQL update at line 16624: `*   4. `email_change` – Used when verifying an OTP sent to a new email address during an email update process.`
- Raw SQL update at line 17351: `* @exampleDescription Update the email for an authenticated user`
- Raw SQL update at line 17354: `* @example Update the email for an authenticated user`
- Raw SQL update at line 17361: `* @exampleResponse Update the email for an authenticated user`
- Raw SQL update at line 17415: `* @exampleDescription Update the phone number for an authenticated user`
- Raw SQL update at line 17418: `* @example Update the phone number for an authenticated user`
- Raw SQL update at line 17425: `* @example Update the password for an authenticated user`
- Raw SQL update at line 17432: `* @exampleDescription Update the user's metadata`
- Raw SQL update at line 17437: `* @example Update the user's metadata`
- Raw SQL update at line 17444: `* @exampleDescription Update the user's password with a nonce`
- Raw SQL update at line 17447: `* @example Update the user's password with a nonce`
- Raw SQL update at line 18038: `*     - Avoid making assumptions as to when this event is fired, this may occur even when the user is already signed in. Instead, check the user object attached to the event to see if a new user has signed in and update your application's UI.`
- Raw SQL update at line 18056: `*     - Emitted each time the `supabase.auth.updateUser()` method finishes successfully. Listen to it to update your application's UI based on new profile information.`
- Raw SQL update at line 18174: `*     // show screen to update user's password`
- Raw SQL update at line 18251: `* - The password reset flow consist of 2 broad steps: (i) Allow the user to login via the password reset link; (ii) Update the user's password.`
- Raw SQL update at line 18253: `* To update the user's password, see [`updateUser()`](/docs/reference/javascript/auth-updateuser).`
- Raw SQL update at line 19807: `* Update a passkey.`

### public/js/vip-stress-dashboard.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 1026: `// Fetch AI prediction data and update modal sections`

### README_DASHBOARD_REFACTOR.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 116: `- **State Update Function**: Lines 15-18`

### refresh-ai-insights.js
- Wrapped with `executeOperation`: no
- Direct AI insight call at line 79: `const aiInsight = await generateInsight({`
- Raw SQL update at line 92: `// Update in database`
- Raw SQL update at line 116: `console.log(`   ❌ Update failed: ${updateError.message}`);`

### safe-migration-plan.json
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 27: `"sql": "INSERT INTO fixtures_unified (match_id, home_team, away_team, venue, match_date, match_time, league, status, sport, created_at)\n               SELECT match_id, home_team, away_team, venue, match_date, match_time, league, status, 'football', created_at\n               FROM fixtures;",`
- Raw SQL insert at line 33: `"sql": "INSERT INTO fixtures_unified (match_id, home_team, away_team, venue, match_date, match_time, league, status, sport, created_at)\n               SELECT match_id, home_team, away_team, venue, match_date, match_time, league, status, 'cricket', created_at\n               FROM cricket_fixtures;",`
- Raw SQL insert at line 95: `"sql": "INSERT INTO market_rules_unified (tier, sport, rule_type, rule_config, min_confidence, max_confidence, max_predictions, features, created_at)\n               SELECT tier, 'all', 'volatility', \n                      jsonb_build_object('allowed_volatility', allowed_volatility),\n                      min_confidence, max_confidence, max_predictions, features, created_at\n               FROM tier_rules;",`
- Raw SQL insert at line 101: `"sql": "INSERT INTO market_rules_unified (tier, sport, rule_type, rule_config, min_confidence, max_confidence, created_at)\n               SELECT tier, 'cricket', 'markets', \n                      jsonb_build_object('allowed_markets', allowed_markets),\n                      min_confidence, max_confidence, created_at\n               FROM cricket_market_rules;",`
- Raw SQL insert at line 162: `"sql": "INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, metadata, sport, processing_stage, created_at)\n               SELECT match_id, home_team, away_team, prediction, confidence, 'raw', metadata, 'football', 'stage_1', created_at\n               FROM predictions_raw;",`
- Raw SQL insert at line 168: `"sql": "INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, filter_reason, sport, processing_stage, created_at)\n               SELECT match_id, home_team, away_team, prediction, confidence, 'filtered', filter_reason, 'football', 'stage_2', created_at\n               FROM predictions_filtered;",`
- Raw SQL insert at line 174: `"sql": "INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, ai_model, sport, processing_stage, created_at)\n               SELECT match_id, home_team, away_team, prediction, confidence, 'ai_generated', ai_model, 'football', 'stage_3', created_at\n               FROM ai_predictions;",`
- Raw SQL update at line 59: `"action": "Gradually update cricket code to use unified table",`
- Raw SQL update at line 127: `"action": "Update filter engine to use unified rules",`
- Raw SQL update at line 205: `"action": "Update pipeline services gradually",`
- Raw SQL update at line 244: `"action": "Update all remaining references",`

### scratch/db_normalize.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 6: `await query("UPDATE predictions_raw SET sport = 'basketball' WHERE sport = 'nba'");`
- Raw SQL update at line 7: `await query("UPDATE predictions_raw SET sport = 'nfl' WHERE sport = 'american_football'");`
- Raw SQL update at line 8: `await query("UPDATE predictions_raw SET sport = 'football' WHERE sport LIKE 'soccer_%'");`
- Raw SQL update at line 11: `await query("UPDATE leagues SET sport = 'basketball' WHERE sport = 'nba'");`
- Raw SQL update at line 12: `await query("UPDATE leagues SET sport = 'nfl' WHERE sport = 'american_football'");`
- Raw SQL update at line 13: `await query("UPDATE leagues SET sport = 'football' WHERE sport LIKE 'soccer_%'");`
- Raw SQL update at line 17: `await query("UPDATE match_context_data SET sport = 'basketball' WHERE sport = 'nba'");`
- Raw SQL update at line 18: `await query("UPDATE match_context_data SET sport = 'nfl' WHERE sport = 'american_football'");`
- Raw SQL update at line 19: `await query("UPDATE match_context_data SET sport = 'football' WHERE sport LIKE 'soccer_%'");`

### scripts/analyze-supabase-visual.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 177: `risks: ['Need to update queries to filter by sport', 'Potential data conflicts if match_id overlaps']`
- Raw SQL update at line 185: `risks: ['Need to update filtering logic', 'Potential performance impact']`
- Raw SQL update at line 292: `mitigation: 'Comprehensive code review, update all references, gradual migration'`

### scripts/apply-db-governance.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 70: `INSERT INTO secondary_markets_allowlist (market_name)`
- Raw SQL update at line 108: `CREATE TRIGGER trigger_enforce_insight_rules BEFORE INSERT OR UPDATE ON direct1x2_prediction_final FOR EACH ROW EXECUTE FUNCTION enforce_insight_rules();`
- Raw SQL update at line 142: `CREATE TRIGGER trigger_enforce_pf_rules BEFORE INSERT OR UPDATE ON predictions_final FOR EACH ROW EXECUTE FUNCTION enforce_pf_rules();`
- Raw SQL delete at line 13: `DELETE FROM direct1x2_prediction_final`
- Raw SQL delete at line 25: `DELETE FROM direct1x2_prediction_final`

### scripts/apply-migrations.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 60: `await query('INSERT INTO _migration_log (filename) VALUES ($1)', [file]);`

### scripts/backfill-direct1x2-final-fields.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 18: `UPDATE direct1x2_prediction_final`
- Raw SQL update at line 71: `UPDATE direct1x2_prediction_final`

### scripts/backfill-fixture-ids.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 53: `// Update prediction with fixture_id`
- Raw SQL update at line 55: `UPDATE direct1x2_prediction_final`

### scripts/backfill-football-context.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 441: ``INSERT INTO event_injury_snapshots (`
- Raw SQL insert at line 585: ``INSERT INTO event_weather_snapshots (`
- Raw SQL insert at line 648: ``INSERT INTO event_news_snapshots (`
- Raw SQL update at line 458: `DO UPDATE SET`
- Raw SQL update at line 608: `DO UPDATE SET`
- Raw SQL update at line 677: `DO UPDATE SET`

### scripts/backfill-predictions-accuracy.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 29: `UPDATE predictions_accuracy pa`
- Raw SQL update at line 40: `UPDATE predictions_accuracy`
- Raw SQL update at line 48: `UPDATE predictions_accuracy pa`
- Raw SQL update at line 108: `UPDATE predictions_accuracy pa`
- Raw SQL update at line 137: `UPDATE predictions_accuracy`
- Raw SQL update at line 144: `UPDATE predictions_accuracy pa`

### scripts/backfill-provider-event-id.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 7: `// Use a CTE to compute the desired value and only update rows that won't conflict`
- Raw SQL update at line 46: `UPDATE canonical_events ce`

### scripts/bridge-raw-predictions-for-grading.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 90: `INSERT INTO direct1x2_prediction_final (`

### scripts/brute-force-ingest.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 247: `INSERT INTO direct1x2_prediction_final (`

### scripts/build-acca.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 123: `INSERT INTO direct1x2_prediction_final (tier, type, matches, total_confidence, risk_level, sport, market_type, recommendation, created_at)`
- Raw SQL insert at line 176: `INSERT INTO direct1x2_prediction_final (tier, type, matches, total_confidence, risk_level, sport, market_type, recommendation, created_at)`

### scripts/check-final-table-schema.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 69: `INSERT INTO direct1x2_prediction_final (`
- Raw SQL update at line 73: `) ON CONFLICT (id) DO UPDATE SET`

### scripts/check-raw-prediction-structure.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 114: `console.log('2. If not, update the data insertion to populate these fields from metadata');`
- Raw SQL update at line 115: `console.log('3. Or update the filtering logic to use metadata as fallback');`

### scripts/check-supabase-vs-pg-tiers.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 120: `console.log('Update error:', updateError.message);`

### scripts/cleanup-competition-allowlists.js
- Wrapped with `executeOperation`: no
- Raw SQL delete at line 109: ``DELETE FROM ${tableName} WHERE id::text = ANY($1::text[])`,`

### scripts/cleanup-duplicate-fallbacks.js
- Wrapped with `executeOperation`: no
- Raw SQL delete at line 154: `DELETE FROM direct1x2_prediction_final`

### scripts/cleanup-live-direct-duplicates.js
- Wrapped with `executeOperation`: no
- Raw SQL delete at line 115: `DELETE FROM direct1x2_prediction_final pf`

### scripts/cleanup-predictions.js
- Wrapped with `executeOperation`: no
- Raw SQL delete at line 4: `await pool.query("DELETE FROM direct1x2_prediction_final WHERE created_at > NOW() - INTERVAL '1 hour'");`

### scripts/cleanup-unknown-teams.js
- Wrapped with `executeOperation`: no
- Raw SQL delete at line 4: `const r = await pool.query("DELETE FROM direct1x2_prediction_final WHERE matches->0->>'home_team' = 'Unknown Home' OR matches->0->>'away_team' = 'Unknown Away' RETURNING id");`

### scripts/cleanup.js
- Wrapped with `executeOperation`: no
- Raw SQL delete at line 10: `await pool.query("DELETE FROM direct1x2_prediction_final WHERE matches::text LIKE '%Unknown%'");`
- Raw SQL delete at line 13: `await pool.query("DELETE FROM direct1x2_prediction_final WHERE recommendation LIKE '%RED CARDS%'");`

### scripts/complete-phase2-rules.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 90: `let migrateQuery = 'INSERT INTO market_rules_unified (tier, sport, rule_type, rule_config';`
- Raw SQL insert at line 151: `INSERT INTO market_rules_unified (tier, sport, rule_type, market_key, market_group, rule_config, min_confidence, strong_confidence, elite_confidence, acca_min_confidence, acca_allowed, allowed_formats, requires_confirmed_lineup, requires_toss, display_only, volatility_level, notes, created_at, updated_at)`
- Raw SQL update at line 337: `'Gradually update filtering logic to use unified service',`

### scripts/complete-phase3-predictions.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 55: `INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, metadata, sport, processing_stage, created_at)`
- Raw SQL insert at line 108: `INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, filter_reason, sport, processing_stage, created_at)`
- Raw SQL insert at line 136: `INSERT INTO predictions_unified (match_id, status, filter_reason, processing_stage, created_at)`
- Raw SQL insert at line 158: `INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, ai_model, sport, processing_stage, created_at)`
- Raw SQL update at line 344: `'Gradually update prediction services to use unified service',`

### scripts/create-migration-plan.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 33: `command: 'INSERT INTO fixtures (match_id, home_team, away_team, venue, match_date, match_time, league, status, sport, created_at) SELECT match_id, home_team, away_team, venue, match_date, match_time, league, status, \'cricket\', created_at FROM cricket_fixtures;',`
- Raw SQL insert at line 110: `command: `INSERT INTO market_rules (tier, sport, allowed_volatility, min_confidence, max_confidence, max_predictions, features, created_at)`
- Raw SQL insert at line 118: `command: `INSERT INTO market_rules (tier, sport, allowed_markets, min_confidence, max_confidence, created_at)`
- Raw SQL insert at line 200: `command: `INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, metadata, sport, created_at)`
- Raw SQL insert at line 208: `command: `INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, filter_reason, sport, created_at)`
- Raw SQL insert at line 216: `command: `INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, ai_model, sport, created_at)`
- Raw SQL update at line 44: `action: 'Update application queries to filter by sport',`
- Raw SQL update at line 131: `action: 'Update application code to use market_rules',`
- Raw SQL update at line 158: `'Update application code to use old table names'`
- Raw SQL update at line 232: `action: 'Update application code to use unified table',`
- Raw SQL update at line 243: `action: 'Update prediction pipeline logic',`
- Raw SQL update at line 244: `description: 'Modify pipeline to update status instead of moving between tables'`
- Raw SQL update at line 266: `'Update application code to use old table names',`
- Raw SQL update at line 296: `action: 'Update application code for new column names',`
- Raw SQL update at line 297: `description: 'Update all references to use standardized names'`
- Raw SQL update at line 302: `'Update application code back to original names'`

### scripts/db-cleanup.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 41: `// Insert into archive table`
- Raw SQL insert at line 44: `INSERT INTO zz_archive_matches`
- Raw SQL delete at line 50: `// Delete from main table`
- Raw SQL delete at line 52: `DELETE FROM events`
- Raw SQL delete at line 69: `DELETE FROM api_raw`
- Raw SQL delete at line 78: `DELETE FROM api_raw`
- Raw SQL delete at line 99: `DELETE FROM predictions_raw`
- Raw SQL delete at line 121: `DELETE FROM predictions_filtered`
- Raw SQL delete at line 135: `DELETE FROM rapidapi_cache`
- Raw SQL delete at line 143: `DELETE FROM scheduling_logs`

### scripts/debug-cricket-ai-predictions.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 216: `console.log('1. Update the AI predictions endpoint to handle cricket match IDs');`

### scripts/debug-matches-content.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 142: `// If we find a working search method, update the endpoint`
- Raw SQL update at line 166: `// Update the endpoint to use this method`

### scripts/deployment_verification.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 106: `INSERT INTO direct1x2_prediction_final`
- Raw SQL insert at line 139: `INSERT INTO direct1x2_prediction_final`
- Raw SQL insert at line 147: `INSERT INTO direct1x2_prediction_final`
- Raw SQL insert at line 156: `INSERT INTO direct1x2_prediction_final`
- Raw SQL insert at line 190: `INSERT INTO direct1x2_prediction_final`
- Raw SQL insert at line 197: `INSERT INTO direct1x2_prediction_final`
- Raw SQL insert at line 250: `INSERT INTO direct1x2_prediction_final`
- Raw SQL insert at line 257: `INSERT INTO direct1x2_prediction_final`
- Raw SQL insert at line 306: `INSERT INTO direct1x2_prediction_final`
- Raw SQL insert at line 315: `INSERT INTO direct1x2_prediction_final`
- Raw SQL insert at line 370: `INSERT INTO direct1x2_prediction_final`
- Raw SQL insert at line 379: `INSERT INTO direct1x2_prediction_final`
- Raw SQL insert at line 430: `INSERT INTO direct1x2_prediction_final`
- Raw SQL delete at line 121: `await db.query('DELETE FROM direct1x2_prediction_final WHERE match_id = \'test_match_001\'');`
- Raw SQL delete at line 170: `await db.query('DELETE FROM direct1x2_prediction_final WHERE match_id = $1', [matchId]);`
- Raw SQL delete at line 231: `await db.query('DELETE FROM direct1x2_prediction_final WHERE match_id = $1', [matchId]);`
- Raw SQL delete at line 287: `await db.query('DELETE FROM direct1x2_prediction_final WHERE match_id = $1', [matchId]);`
- Raw SQL delete at line 351: `await db.query('DELETE FROM direct1x2_prediction_final WHERE match_id IN (\'test_match_005\', \'test_match_006\')');`
- Raw SQL delete at line 404: `await db.query('DELETE FROM direct1x2_prediction_final WHERE match_id IN (\'test_match_007\', \'test_match_008\')');`
- Raw SQL delete at line 453: `await db.query('DELETE FROM direct1x2_prediction_final WHERE match_id = $1', [matchId]);`

### scripts/diagnostic-espn-fixed.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 312: `console.log('   2. Update endpoints to use site.api.espn.com URLs');`

### scripts/external-scheduler.js
- Wrapped with `executeOperation`: no
- Direct cron scheduling at line 15: `cron.schedule('0 */6 * * *', async () => {`
- Direct cron scheduling at line 24: `cron.schedule('*/30 * * * *', async () => {`
- Direct cron scheduling at line 33: `cron.schedule('0 */4 * * *', async () => {`
- Direct cron scheduling at line 42: `cron.schedule('0 2 * * *', async () => {`

### scripts/fetch-live-fixtures.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 146: `INSERT INTO prediction_publish_runs (`
- Raw SQL insert at line 1087: `INSERT INTO events (id, sport_key, commence_time, home_team, away_team)`
- Raw SQL insert at line 1268: `INSERT INTO direct1x2_prediction_final (`
- Raw SQL update at line 171: `UPDATE prediction_publish_runs`
- Raw SQL update at line 200: `UPDATE prediction_publish_runs`
- Raw SQL update at line 1089: `ON CONFLICT (id) DO UPDATE SET`
- Raw SQL update at line 1228: `UPDATE direct1x2_prediction_final`

### scripts/fix-ai-predictions-endpoint.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 170: `// Now update the endpoint code`
- Raw SQL update at line 197: `execSync('cd "' + path.dirname(__dirname) + '" && git commit -m "fix: Update AI predictions endpoint to handle JSONB matches field correctly\n\n- Change matches::text to matches::textb::text for proper JSONB text search\n- This fixes the 500 error when searching for match_id in JSONB data\n- FC Lorient vs Le Havre AC (match_id: 542703) will now be found correctly\n- Endpoint will return proper AI prediction data instead of 500 error"', { stdio: 'inherit' });`

### scripts/fix-json-simple.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 16: `UPDATE direct1x2_prediction_final`
- Raw SQL update at line 32: `UPDATE predictions_unified`
- Raw SQL update at line 53: `UPDATE direct1x2_prediction_final`
- Raw SQL update at line 72: `UPDATE direct1x2_prediction_final`
- Raw SQL update at line 88: `// STEP 3: Update plan_visibility if needed`
- Raw SQL update at line 94: `UPDATE direct1x2_prediction_final`

### scripts/fix-matches-structure.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 30: `// Update the matches field to be a proper JSON string`
- Raw SQL update at line 38: `// Update the database to store it as JSON string`
- Raw SQL update at line 40: `UPDATE direct1x2_prediction_final`

### scripts/fix-placeholders-and-insights.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 16: `UPDATE ai_predictions_backup_phase3`
- Raw SQL update at line 39: `// Update with better analysis text`
- Raw SQL update at line 41: `UPDATE ai_predictions_backup_phase3`
- Raw SQL update at line 68: `UPDATE direct1x2_prediction_final`
- Raw SQL update at line 78: `UPDATE predictions_unified`
- Raw SQL update at line 95: `// Update context_insights for better data`
- Raw SQL update at line 97: `UPDATE direct1x2_prediction_final`
- Raw SQL update at line 148: `UPDATE direct1x2_prediction_final`

### scripts/fix-prediction-76412.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 57: `// Update the filtered record to mark it as valid`
- Raw SQL update at line 59: `UPDATE predictions_filtered`
- Raw SQL update at line 73: `console.log('❌ Prediction still fails filtering - no update needed');`

### scripts/fix-remaining-json-issues.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 16: `UPDATE direct1x2_prediction_final`
- Raw SQL update at line 26: `UPDATE predictions_unified`
- Raw SQL update at line 83: `UPDATE direct1x2_prediction_final`

### scripts/fix-sport-data.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 30: `UPDATE direct1x2_prediction_final`

### scripts/force-enrich-match.js
- Wrapped with `executeOperation`: no
- Direct enrichment call at line 34: `const enriched = await enrichMatchContext(eventId);`
- Direct insight generation call at line 41: `const insight = await generateEdgeMindInsight(eventId);`

### scripts/gatekeeper-pipeline.js
- Wrapped with `executeOperation`: no
- Direct AI insight call at line 283: `const insightData = await generateInsight({`
- Raw SQL insert at line 425: `INSERT INTO direct1x2_prediction_final (`

### scripts/hotfix-acca-rules.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 14: `await client.query(`INSERT INTO acca_rules (rule_name, rule_value) VALUES ('exact_legs_6', '"6"')`);`
- Raw SQL insert at line 15: `await client.query(`INSERT INTO acca_rules (rule_name, rule_value) VALUES ('exact_legs_12', '"12"')`);`
- Raw SQL insert at line 16: `await client.query(`INSERT INTO acca_rules (rule_name, rule_value) VALUES ('6fold_tier', '"normal"')`);`
- Raw SQL insert at line 17: `await client.query(`INSERT INTO acca_rules (rule_name, rule_value) VALUES ('12fold_tier', '"deep"')`);`
- Raw SQL delete at line 11: `await client.query('DELETE FROM acca_rules');`
- Raw SQL delete at line 25: `const deleted = await client.query("DELETE FROM direct1x2_prediction_final WHERE type = 'acca' AND recommendation IN ('Safe Double', 'Medium Acca 3-Fold') RETURNING id");`

### scripts/implement-phase1-fixtures-corrected.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 104: `INSERT INTO fixtures_unified (provider, provider_match_id, sport, match_format, competition, home_team, away_team, venue, country, start_time, status, raw_status, raw_payload, created_at, updated_at)`
- Raw SQL insert at line 135: `INSERT INTO fixtures_unified (provider_match_id, sport, home_team, away_team, venue, start_time, status, created_at)`
- Raw SQL insert at line 316: `INSERT INTO fixtures_unified (provider, provider_match_id, sport, match_format, competition, home_team, away_team, venue, country, start_time, status, raw_status, raw_payload)`
- Raw SQL update at line 435: `'Gradually update cricket code to use unified service',`

### scripts/implement-phase1-fixtures.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 75: `INSERT INTO fixtures_unified (match_id, home_team, away_team, venue, match_date, match_time, league, status, sport, created_at)`
- Raw SQL insert at line 94: `INSERT INTO fixtures_unified (match_id, home_team, away_team, venue, match_date, match_time, league, status, sport, created_at)`
- Raw SQL insert at line 246: `INSERT INTO fixtures_unified (match_id, home_team, away_team, venue, match_date, match_time, league, status, sport)`
- Raw SQL update at line 323: `'Gradually update cricket code to use unified service',`

### scripts/implement-phase2-rules-conservative.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 104: `INSERT INTO market_rules_unified (tier, sport, rule_type, rule_config, min_confidence, max_confidence, max_predictions, features, created_at, updated_at)`
- Raw SQL insert at line 133: `INSERT INTO market_rules_unified (tier, sport, rule_type, market_key, market_group, rule_config, min_confidence, strong_confidence, elite_confidence, acca_min_confidence, acca_allowed, allowed_formats, requires_confirmed_lineup, requires_toss, display_only, volatility_level, notes, created_at, updated_at)`

### scripts/implement-phase2-rules.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 124: `INSERT INTO market_rules_unified (tier, sport, rule_type, rule_config, min_confidence, max_confidence, max_predictions, features, created_at, updated_at)`
- Raw SQL insert at line 145: `INSERT INTO market_rules_unified (tier, sport, rule_type, market_key, market_group, rule_config, min_confidence, strong_confidence, elite_confidence, acca_min_confidence, acca_allowed, allowed_formats, requires_confirmed_lineup, requires_toss, display_only, volatility_level, notes, created_at, updated_at)`
- Raw SQL insert at line 438: `INSERT INTO market_rules_unified (tier, sport, rule_type, market_key, market_group, rule_config, min_confidence, max_confidence, max_predictions, features, allowed_formats, requires_confirmed_lineup, requires_toss, display_only, volatility_level, notes)`
- Raw SQL update at line 548: `'Gradually update filtering logic to use unified service',`

### scripts/implement-phase3-predictions.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 141: `INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, metadata, sport, processing_stage, created_at)`
- Raw SQL insert at line 174: `INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, filter_reason, sport, processing_stage, created_at)`
- Raw SQL insert at line 207: `INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, ai_model, sport, processing_stage, created_at)`
- Raw SQL insert at line 240: `INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, sport, market_type, matches, edgemind_report, secondary_insights, secondary_markets, total_confidence, processing_stage, created_at)`
- Raw SQL insert at line 266: `INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, created_at)`
- Raw SQL insert at line 472: `INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, metadata, ai_model, sport, market_type, processing_stage, matches, edgemind_report, secondary_insights, secondary_markets, total_confidence)`
- Raw SQL update at line 506: `* Update prediction status`
- Raw SQL update at line 509: `* @param {Object} updateData - Additional update data`
- Raw SQL update at line 514: `UPDATE predictions_unified`
- Raw SQL update at line 644: `'Gradually update prediction services to use unified service',`

### scripts/import-f1-formula1db.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 61: ``insert into public.f1_tracks(key, name, city, country_code)`
- Raw SQL insert at line 73: ``insert into public.f1_teams(key, name, country_code)`
- Raw SQL insert at line 94: ``insert into public.f1_persons(key, first_name, last_name, code, date_of_birth, country_code)`
- Raw SQL insert at line 112: ``insert into public.f1_races(season, round, name, date, track_id, status, raw_json)`
- Raw SQL insert at line 131: ``insert into public.f1_rosters(season, team_id, person_id, car_number)`
- Raw SQL insert at line 140: ``insert into public.f1_results(race_id, position, person_id, team_id, laps, time_text, time_ms, status)`
- Raw SQL update at line 63: `on conflict (key) do update set name=excluded.name, city=excluded.city, country_code=excluded.country_code, updated_at=now()`
- Raw SQL update at line 75: `on conflict (key) do update set name=excluded.name, country_code=excluded.country_code, updated_at=now()`
- Raw SQL update at line 96: `on conflict (key) do update set first_name=excluded.first_name, last_name=excluded.last_name, code=excluded.code, date_of_birth=coalesce(excluded.date_of_birth, public.f1_persons.date_of_birth), country_code=excluded.country_code, updated_at=now()`
- Raw SQL update at line 114: `on conflict (season, round) do update set name=excluded.name, date=excluded.date, track_id=coalesce(excluded.track_id, public.f1_races.track_id), status=excluded.status, raw_json=excluded.raw_json, updated_at=now()`
- Raw SQL update at line 133: `on conflict (season, team_id, person_id) do update set car_number=excluded.car_number, updated_at=now()`,`
- Raw SQL update at line 142: `on conflict (race_id, person_id) do update set position=excluded.position, team_id=coalesce(excluded.team_id, public.f1_results.team_id), laps=excluded.laps, time_text=excluded.time_text, time_ms=excluded.time_ms, status=excluded.status, updated_at=now()`,`

### scripts/import-today-snapshot-pipeline.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 1602: `INSERT INTO events (id, sport_key, commence_time, home_team, away_team, status)`
- Raw SQL update at line 1604: `ON CONFLICT (id) DO UPDATE`

### scripts/manual-grade.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 158: `INSERT INTO predictions_accuracy (`
- Raw SQL update at line 181: `DO UPDATE SET`

### scripts/map-table-dependencies.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 64: ``INSERT INTO ${table}`,`
- Raw SQL update at line 355: `'Update all code references before dropping tables',`
- Raw SQL delete at line 66: ``DELETE FROM ${table}`,`

### scripts/migration1-plan-visibility.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 116: `for (const update of updates) {`
- Raw SQL update at line 119: `UPDATE direct1x2_prediction_final`
- Raw SQL update at line 138: `console.log(`UPDATE SUMMARY: ${successCount} success, ${errorCount} errors\n`);`

### scripts/normalize-sport-values.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 27: `for (const update of updates) {`
- Raw SQL update at line 30: `UPDATE predictions_raw`
- Raw SQL update at line 46: `UPDATE predictions_unified`
- Raw SQL update at line 60: `UPDATE fixtures`

### scripts/publish-prediction-76412.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 28: `INSERT INTO direct1x2_prediction_final (`
- Raw SQL update at line 47: `) ON CONFLICT (id) DO UPDATE SET`

### scripts/repair-unknown-team-names.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 198: `UPDATE direct1x2_prediction_final`

### scripts/resolve-results.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 262: `// Insert into predictions_accuracy with all required fields`
- Raw SQL insert at line 264: `INSERT INTO predictions_accuracy (`
- Raw SQL update at line 64: `// STEP 3: Update events table`
- Raw SQL update at line 66: `UPDATE events`
- Raw SQL update at line 288: `DO UPDATE SET`

### scripts/safe-migration-plan.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 56: `sql: `INSERT INTO fixtures_unified (match_id, home_team, away_team, venue, match_date, match_time, league, status, sport, created_at)`
- Raw SQL insert at line 64: `sql: `INSERT INTO fixtures_unified (match_id, home_team, away_team, venue, match_date, match_time, league, status, sport, created_at)`
- Raw SQL insert at line 144: `sql: `INSERT INTO market_rules_unified (tier, sport, rule_type, rule_config, min_confidence, max_confidence, max_predictions, features, created_at)`
- Raw SQL insert at line 154: `sql: `INSERT INTO market_rules_unified (tier, sport, rule_type, rule_config, min_confidence, max_confidence, created_at)`
- Raw SQL insert at line 245: `sql: `INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, metadata, sport, processing_stage, created_at)`
- Raw SQL insert at line 253: `sql: `INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, filter_reason, sport, processing_stage, created_at)`
- Raw SQL insert at line 261: `sql: `INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, ai_model, sport, processing_stage, created_at)`
- Raw SQL update at line 93: `action: 'Gradually update cricket code to use unified table',`
- Raw SQL update at line 188: `action: 'Update filter engine to use unified rules',`
- Raw SQL update at line 294: `action: 'Update pipeline services gradually',`
- Raw SQL update at line 331: `action: 'Update all remaining references',`

### scripts/scheduler.js
- Wrapped with `executeOperation`: no
- Direct cron scheduling at line 15: `cron.schedule('*/10 * * * *', async () => {`
- Direct cron scheduling at line 31: `cron.schedule('*/30 * * * *', async () => {`
- Direct cron scheduling at line 47: `cron.schedule('*/15 * * * *', async () => {`
- Direct cron scheduling at line 63: `cron.schedule('0 3 * * *', async () => {`

### scripts/simple-sync.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 78: `INSERT INTO prediction_publish_runs (`
- Raw SQL insert at line 112: `INSERT INTO direct1x2_prediction_final (`
- Raw SQL update at line 138: `UPDATE prediction_publish_runs`
- Raw SQL update at line 157: `UPDATE prediction_publish_runs`

### scripts/test-final-endpoint.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 77: `// Now update the endpoint to use this simplified version`
- Raw SQL update at line 120: `// Also update the response building`

### scripts/test-fixed-endpoint.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 152: `execSync('cd "' + path.dirname(__dirname) + '" && git commit -m "fix: Update AI predictions endpoint to handle JSONB matches field correctly\n\n- Change matches::text to matches::textb::text for proper JSONB text search\n- Update column names to match actual database schema\n- This fixes the 500 error when searching for match_id in JSONB data\n- FC Lorient vs Le Havre AC (match_id: 542703) will now be found correctly\n- Endpoint will return proper AI prediction data instead of 500 error"', { stdio: 'inherit' });`
- Raw SQL update at line 152: `execSync('cd "' + path.dirname(__dirname) + '" && git commit -m "fix: Update AI predictions endpoint to handle JSONB matches field correctly\n\n- Change matches::text to matches::textb::text for proper JSONB text search\n- Update column names to match actual database schema\n- This fixes the 500 error when searching for match_id in JSONB data\n- FC Lorient vs Le Havre AC (match_id: 542703) will now be found correctly\n- Endpoint will return proper AI prediction data instead of 500 error"', { stdio: 'inherit' });`

### scripts/test-fixed-pipeline.js
- Wrapped with `executeOperation`: no
- Direct enrichment call at line 21: `const success = await thesportsdbPipeline.enrichMatchContext(testEventId);`
- Direct insight generation call at line 28: `const insightSuccess = await thesportsdbPipeline.generateEdgeMindInsight(testEventId);`

### scripts/test-pipeline-integration.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 186: `INSERT INTO context_enrichment_queue (id_event, sport, action, status, priority)`
- Raw SQL update at line 188: `ON CONFLICT (id_event) DO UPDATE SET`
- Raw SQL delete at line 280: `await query('DELETE FROM context_enrichment_queue WHERE id_event LIKE \'TEST_%\'');`
- Raw SQL delete at line 281: `await query('DELETE FROM raw_fixtures WHERE id_event LIKE \'TEST_%\'');`
- Raw SQL delete at line 282: `await query('DELETE FROM match_context_data WHERE id_event LIKE \'TEST_%\'');`

### scripts/test-telemetry-integration.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 231: `INSERT INTO event_odds_snapshots (id_event, odds, source)`
- Raw SQL insert at line 273: `INSERT INTO prediction_publish_runs (`
- Raw SQL delete at line 149: `DELETE FROM fixture_processing_log`
- Raw SQL delete at line 259: `DELETE FROM event_odds_snapshots WHERE id_event = $1`
- Raw SQL delete at line 400: `DELETE FROM fixture_processing_log`
- Raw SQL delete at line 405: `DELETE FROM prediction_publish_runs WHERE id = $1`

### scripts/track-prediction-accuracy.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 359: `// Insert into predictions_accuracy with all required fields`
- Raw SQL insert at line 361: `INSERT INTO predictions_accuracy (`
- Raw SQL update at line 385: `DO UPDATE SET`
- Raw SQL update at line 431: `// Update stats`

### scripts/trigger-publication.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 132: `INSERT INTO direct1x2_prediction_final (`
- Raw SQL update at line 140: `) ON CONFLICT (id) DO UPDATE SET`

### scripts/verify_dom_structure.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 112: `// Test AI prediction update function`
- Raw SQL update at line 113: `console.log('\n🧪 Testing AI Update Functions...');`

### SINGLE_USE_AUDIT_REPORT.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 38: `**Action Required:** Update to reflect correct policy (ACCA-only restriction)`
- Raw SQL update at line 172: `| Documentation (3 files) | HIGH | Documentation | Update policy statement |`
- Raw SQL update at line 189: `2. **Update documentation:**`
- Raw SQL update at line 204: `- Update utility functions to only check ACCA usage`
- Raw SQL update at line 240: `2. `TERMS_OF_SERVICE.md` - Update policy statement`
- Raw SQL update at line 241: `3. `public/terms.html` - Update policy statement`
- Raw SQL update at line 242: `4. `public/index.html` - Update policy statement`
- Raw SQL update at line 260: `**Immediate Action Required:** Remove the global single-use logic from `fetch-live-fixtures.js` and update documentation to reflect the correct ACCA-only restriction policy.`

### SKCS-KNOWLEDGE/audit/cron_provider_runtime_map.md
- Wrapped with `executeOperation`: no
- Direct cron scheduling at line 23: `- Triggered by `cron.schedule('1 0 * * *', ...)``
- Direct cron scheduling at line 69: `- Triggered by `cron.schedule('*/30 * * * *', ...)``
- Direct cron scheduling at line 115: `- Triggered by `cron.schedule('*/30 * * * *', ...)``
- Raw SQL update at line 431: `- On insert/update trigger and bulk refresh helper`

### SKCS-KNOWLEDGE/audit/prediction_dependency_audit.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 221: `- Refresh jobs update existing rows`

### SKCS-KNOWLEDGE/audit/verification_runtime_audit.md
- Wrapped with `executeOperation`: no
- Direct enrichment call at line 112: `| Evidence | `fetchTheSportsDB()` returns `null` on invalid JSON; `enrichMatchContext()` catches the resulting failure and continues with fallback values. |`

### SKCS-KNOWLEDGE/governance/documentation_policy.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 19: `- Update the knowledge layer in the same change as the code when possible.`

### SKCS-KNOWLEDGE/knowledge/cost_registry.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 270: `- Triggered on insert/update and via batch refresh`

### SKCS-KNOWLEDGE/knowledge/pipeline_metrics_registry.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 47: `4. Use the observed data to update the cost registry before any optimization decision.`

### SKCS-KNOWLEDGE/knowledge/scheduled_jobs.md
- Wrapped with `executeOperation`: no
- Direct cron scheduling at line 17: `- Contains a `cron.schedule(...)` example for partition maintenance.`

### SKCS-KNOWLEDGE/knowledge/semantic_field_mapping_registry.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 60: `- Update this registry whenever a source feed changes field names, status labels, or supported context types.`

### sportbook/NOTES.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 27: `update app on heroku`

### SPORT_CONSISTENCY_AUDIT_REPORT.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 325: `UPDATE predictions_raw SET sport = 'AFL' WHERE sport = 'afl';`
- Raw SQL update at line 326: `UPDATE predictions_raw SET sport = 'Basketball' WHERE sport = 'basketball';`
- Raw SQL update at line 327: `UPDATE predictions_raw SET sport = 'Cricket' WHERE sport = 'cricket';`
- Raw SQL update at line 328: `UPDATE predictions_raw SET sport = 'Football' WHERE sport = 'football';`
- Raw SQL update at line 329: `UPDATE predictions_raw SET sport = 'F1' WHERE sport = 'formula1';`
- Raw SQL update at line 330: `UPDATE predictions_raw SET sport = 'Handball' WHERE sport = 'handball';`
- Raw SQL update at line 331: `UPDATE predictions_raw SET sport = 'MLB' WHERE sport = 'baseball' OR sport = 'MLB';`
- Raw SQL update at line 332: `UPDATE predictions_raw SET sport = 'MMA' WHERE sport = 'mma';`
- Raw SQL update at line 333: `UPDATE predictions_raw SET sport = 'NBA' WHERE sport = 'nba'; -- or Basketball`
- Raw SQL update at line 334: `UPDATE predictions_raw SET sport = 'NFL' WHERE sport = 'nfl' OR sport = 'american_football';`
- Raw SQL update at line 335: `UPDATE predictions_raw SET sport = 'NHL' WHERE sport = 'hockey';`
- Raw SQL update at line 336: `UPDATE predictions_raw SET sport = 'Rugby' WHERE sport = 'rugby';`
- Raw SQL update at line 337: `UPDATE predictions_raw SET sport = 'Tennis' WHERE sport = 'tennis';`
- Raw SQL update at line 338: `UPDATE predictions_raw SET sport = 'Volleyball' WHERE sport = 'volleyball';`
- Raw SQL update at line 341: `UPDATE predictions_unified SET sport = 'Football' WHERE sport = 'football';`
- Raw SQL update at line 344: `UPDATE fixtures SET sport = 'Cricket' WHERE sport = 'cricket';`
- Raw SQL update at line 357: `**Action Required:** Update static JSON files to use Title Case sport names`
- Raw SQL update at line 365: `**Action Required:** Update masterRulebookRiskClassification.js to use DB enum labels`
- Raw SQL update at line 369: `- Update getRiskTierLabel() mapping accordingly`
- Raw SQL update at line 379: `2. Add trigger to normalize sport values on INSERT/UPDATE`

### supabase/edge-functions/scheduled-fixture-sync/index.ts
- Wrapped with `executeOperation`: no
- Raw SQL update at line 76: `// Update last_sync_at for this sport`

### supabase/edge-functions/scheduledFixtureSync/index.ts
- Wrapped with `executeOperation`: no
- Raw SQL update at line 122: `// Update last_sync_at`

### supabase-migration-plan.json
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 30: `"command": "INSERT INTO fixtures (match_id, home_team, away_team, venue, match_date, match_time, league, status, sport, created_at) SELECT match_id, home_team, away_team, venue, match_date, match_time, league, status, 'cricket', created_at FROM cricket_fixtures;",`
- Raw SQL insert at line 98: `"command": "INSERT INTO market_rules (tier, sport, allowed_volatility, min_confidence, max_confidence, max_predictions, features, created_at) \n                      SELECT tier, 'all', allowed_volatility, min_confidence, max_confidence, max_predictions, features, created_at \n                      FROM tier_rules;",`
- Raw SQL insert at line 104: `"command": "INSERT INTO market_rules (tier, sport, allowed_markets, min_confidence, max_confidence, created_at) \n                      SELECT tier, 'cricket', allowed_markets, min_confidence, max_confidence, created_at \n                      FROM cricket_market_rules;",`
- Raw SQL insert at line 173: `"command": "INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, metadata, sport, created_at) \n                      SELECT match_id, home_team, away_team, prediction, confidence, 'raw', metadata, 'football', created_at \n                      FROM predictions_raw;",`
- Raw SQL insert at line 179: `"command": "INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, filter_reason, sport, created_at) \n                      SELECT match_id, home_team, away_team, prediction, confidence, 'filtered', filter_reason, 'football', created_at \n                      FROM predictions_filtered;",`
- Raw SQL insert at line 185: `"command": "INSERT INTO predictions_unified (match_id, home_team, away_team, prediction, confidence, status, ai_model, sport, created_at) \n                      SELECT match_id, home_team, away_team, prediction, confidence, 'ai_generated', ai_model, 'football', created_at \n                      FROM ai_predictions;",`
- Raw SQL update at line 41: `"action": "Update application queries to filter by sport",`
- Raw SQL update at line 115: `"action": "Update application code to use market_rules",`
- Raw SQL update at line 142: `"Update application code to use old table names"`
- Raw SQL update at line 196: `"action": "Update application code to use unified table",`
- Raw SQL update at line 207: `"action": "Update prediction pipeline logic",`
- Raw SQL update at line 208: `"description": "Modify pipeline to update status instead of moving between tables"`
- Raw SQL update at line 230: `"Update application code to use old table names",`
- Raw SQL update at line 262: `"action": "Update application code for new column names",`
- Raw SQL update at line 263: `"description": "Update all references to use standardized names"`
- Raw SQL update at line 268: `"Update application code back to original names"`

### supabase-table-analysis.json
- Wrapped with `executeOperation`: no
- Raw SQL update at line 9611: `"name": "Users can update own profile",`

### supabase-visual-analysis-report.json
- Wrapped with `executeOperation`: no
- Raw SQL update at line 228: `"Need to update queries to filter by sport",`
- Raw SQL update at line 242: `"Need to update filtering logic",`
- Raw SQL update at line 332: `"mitigation": "Comprehensive code review, update all references, gradual migration"`

### SUPABASE_DIAGNOSTIC_REPORT.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 110: `- **Merge Potential:** MEDIUM - Could update instead of insert`
- Raw SQL update at line 217: `ON CONFLICT (id_event) DO UPDATE SET`
- Raw SQL update at line 224: `ON CONFLICT (id_event) DO UPDATE SET`
- Raw SQL update at line 235: `ON CONFLICT (match_id) DO UPDATE SET`
- Raw SQL update at line 300: `2. Update fallback logic to use UPDATE instead of INSERT when found`
- Raw SQL update at line 300: `2. Update fallback logic to use UPDATE instead of INSERT when found`
- Raw SQL update at line 402: `3. **Update direct1x2Builder.js** to use UPDATE instead of INSERT in fallback logic`
- Raw SQL update at line 402: `3. **Update direct1x2Builder.js** to use UPDATE instead of INSERT in fallback logic`
- Raw SQL update at line 427: `3. Update the fallback logic in direct1x2Builder.js`
- Raw SQL delete at line 322: `DELETE FROM direct1x2_prediction_final`
- Raw SQL delete at line 341: `DELETE FROM predictions_accuracy`
- Raw SQL delete at line 356: `DELETE FROM rapidapi_cache`
- Raw SQL delete at line 359: `DELETE FROM context_intelligence_cache`

### SUPABASE_TABLE_ANALYSIS.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 3352: `**Users can update own profile**`

### table-dependency-map.json
- Wrapped with `executeOperation`: no
- Raw SQL update at line 536: `"Update all code references before dropping tables",`
- Raw SQL delete at line 120: `"pattern": "DELETE FROM fixtures",`
- Raw SQL delete at line 194: `"pattern": "DELETE FROM predictions_raw",`
- Raw SQL delete at line 244: `"pattern": "DELETE FROM predictions_raw",`

### TERMS_OF_SERVICE.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 126: `We may update these Terms to reflect changes in our Service or legal requirements. When we do, we will post the updated Terms on our website and update the "Last updated" date at the top. Your continued use of the Service after changes take effect indicates your acceptance of the revised Terms.`
- Raw SQL update at line 126: `We may update these Terms to reflect changes in our Service or legal requirements. When we do, we will post the updated Terms on our website and update the "Last updated" date at the top. Your continued use of the Service after changes take effect indicates your acceptance of the revised Terms.`

### test-ai-insights.js
- Wrapped with `executeOperation`: no
- Direct AI insight call at line 52: `const insight = await generateInsight(testParams);`

### trigger_ai.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 9: `console.log('Using API Key:', API_KEY === 'YOUR_ADMIN_API_KEY' ? 'NOT SET - Please update the script' : 'SET');`

### _archive/docs_legacy/cloud-run-job-deployment.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 80: `gcloud run jobs update skcs-vip-generator \`
- Raw SQL update at line 147: `gcloud run jobs update skcs-vip-generator \`
- Raw SQL update at line 155: `gcloud run jobs update skcs-vip-generator \`

### _archive/docs_legacy/DEBUG_REPORT.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 287: `| Vercel Deploy | Misconfigured `vercel.json` | Update for frontend-only or serverless |`

### _archive/docs_legacy/google-cloud-soccer-refresh.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 59: `### Update the Scheduler Job`
- Raw SQL update at line 62: `gcloud scheduler jobs update http skcs-football-refresh --location=us-central1 --schedule="0 8,16,20 * * *" --time-zone="Africa/Johannesburg" --uri="https://<your-backend-host>/api/refresh-predictions?sport=football" --http-method=POST --headers="x-api-key=<SKCS_REFRESH_KEY>" --description="Trigger the soccer prediction refresh workflow"`
- Raw SQL update at line 105: `### Update The Scheduler Job`
- Raw SQL update at line 108: `gcloud scheduler jobs update http skcs-football-grade --location=us-central1 --schedule="0 4 * * *" --time-zone="Africa/Johannesburg" --uri="https://<your-backend-host>/api/grade-predictions?sport=football" --http-method=POST --update-headers="x-api-key=<SKCS_REFRESH_KEY>" --attempt-deadline=30m --description="Grade yesterday's soccer predictions"`

### _archive/docs_legacy/INGESTION_STATUS_REPORT.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 31: `- **Output:** Shows `INSERT sports: [...]` and `UPDATE sports: [...]``

### _archive/docs_legacy/service-account-region-setup.md
- Wrapped with `executeOperation`: no
- Raw SQL update at line 67: `gcloud run jobs update skcs-vip-generator \`

### _archive/scripts/fix-sport-filter.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 37: `UPDATE predictions_final`

### _archive/scripts/fix-tier-rules.js
- Wrapped with `executeOperation`: no
- Raw SQL update at line 22: `// Update tier_rules to be more lenient (use JSONB format)`
- Raw SQL update at line 24: `UPDATE tier_rules SET`
- Raw SQL update at line 33: `UPDATE tier_rules SET`

### _archive/scripts/migration2-fix.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 59: `INSERT INTO normalized_fixtures (`

### _archive/scripts/migration2-normalized-fixtures.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 52: `INSERT INTO normalized_fixtures (`

### _archive/scripts/migration2-v2.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 37: `INSERT INTO normalized_fixtures (`

### _archive/scripts/migration2-v3.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 84: `INSERT INTO normalized_fixtures (`

### _archive/scripts/phase2-schema-refactor.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 156: `INSERT INTO subscription_plans (plan_id, name, tier, duration_days, price, daily_allocations, capabilities) VALUES`

### _archive/scripts/track-prediction-accuracy.js
- Wrapped with `executeOperation`: no
- Raw SQL insert at line 903: `INSERT INTO predictions_accuracy (`
- Raw SQL update at line 940: `DO UPDATE SET`
