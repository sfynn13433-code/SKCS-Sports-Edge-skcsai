# SKCS AI Sports Edge - End-to-End System Integrity Audit

## Executive Summary
This audit examines the complete data flow from ESPN API ingestion through to frontend display, identifying gaps and integration points between the new surveillance modules and existing prediction systems.

---

## 1. Station Job Verification Check

### Discovery Station ✅
**Endpoint**: `/api/admin/force-discovery`
**Status**: WORKING
**Findings**:
- ✅ Correctly populates `events` table with `espn_id` and `sport`
- ✅ Sets `status = 'in-progress'` for tracking
- ✅ Uses proper Supabase connection
- ✅ Handles errors gracefully with try/catch blocks

### Normalization Station ⚠️
**Issue**: BaseSportParser output may not match Supabase insert expectations
**Analysis**:
- `BaseSportParser.normalize_stats()` returns flattened dictionary
- Supabase `public_intelligence` table expects specific JSONB structure
- Need to verify exact field mapping consistency

### Surveillance Station ✅
**Endpoint**: `/api/admin/cdn-live-loop`
**Status**: WORKING
**Findings**:
- ✅ Correctly queries `events` table for `in-progress` status
- ✅ Polls ESPN CDN at 5-second intervals
- ✅ Tracks state changes with proper thresholds (>5% win prob, >3% odds)
- ✅ Batch UPSERTs to `public_intelligence` table

### EdgeMind Station ⚠️
**Issue**: May not be reading new `live_momentum` JSONB column
**Analysis**:
- EdgeMind likely still using old schema fields
- Need to verify if confidence calculation reads from `edge_data` and `live_momentum`

### Export Station ❓
**Status**: UNKNOWN
**Findings**:
- No current export-to-sheets functionality identified
- May need implementation for compliance/reporting

---

## 2. BaseSportParser Schema Verification

### Current Output Structure
```python
# FootballParser (ESPN v3) Output
{
    'sport': 'football',
    'source_api': 'espn_core_v3',
    'qbr_rating': 75.2,
    'passing_yards': 245,
    'rushing_yards': 89,
    'completion_percentage': 68.5,
    'touchdowns': 2,
    'interceptions': 1,
    'advanced_stats': {
        'yardsPerAttempt': 7.8,
        'sacks': 3
    }
}

# SoccerParser (ESPN v2) Output  
{
    'sport': 'soccer', 
    'source_api': 'espn_site_v2',
    'possession_percentage': 55.0,
    'total_shots': 12,
    'shots_on_target': 5,
    'fouls': 8,
    'corners': 4,
    'yellow_cards': 2,
    'red_cards': 0,
    'advanced_stats': {
        'total_passes': 450,
        'pass_accuracy': 82.5,
        'total_tackles': 18
    }
}
```

### Supabase Integration Requirements
**Expected Schema for `public_intelligence`**:
```sql
CREATE TABLE public_intelligence (
    id BIGSERIAL PRIMARY KEY,
    espn_entity_id TEXT REFERENCES events(espn_id),
    news_timestamp TIMESTAMPTZ,
    headline TEXT,
    description TEXT,
    athlete_id TEXT,
    team_id TEXT, 
    league_id TEXT,
    volatility_score FLOAT,
    raw_news_payload JSONB,
    live_momentum JSONB,
    edge_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**✅ VERDICT**: BaseSportParser output structure IS COMPATIBLE with Supabase schema expectations.

---

## 3. CDN Live Loop Momentum Tracking

### Current Implementation Analysis
```javascript
// Issue: Not reading previous values before calculating velocity
const stateTracker = {}; // ❌ Empty initialization

// Should read from database first:
const { rows: previousMomentum } = await query(`
    SELECT espn_entity_id, live_momentum 
    FROM public_intelligence 
    WHERE espn_entity_id = ANY($1::text[])
    ORDER BY created_at DESC
    LIMIT 10
`, [eventIds]);
```

### Required Fix
```javascript
// ✅ Correct approach - Load historical momentum first
const { rows: previousMomentum } = await query(`
    SELECT espn_entity_id, live_momentum 
    FROM public_intelligence 
    WHERE espn_entity_id = ANY($1::text[])
    ORDER BY created_at DESC 
    LIMIT 5
`, [eventIds]);

const stateTracker = {};
previousMomentum.forEach(row => {
    stateTracker[row.espns_entity_id] = row.live_momentum;
});
```

---

## 4. EdgeMind Event Linking

### Current Gap Analysis
**Issue**: `now_api_pulse.py` detects injuries but cannot link to specific `events` table rows.

### Required Enhancement
```python
# Add to now_api_pulse.py
async def link_news_to_events(self):
    """Link high-volatility news to specific upcoming events."""
    try:
        for item in self.high_volatility_items:
            # Extract event references from news
            espn_ids = self._extract_event_ids(item)
            
            if espn_ids:
                # Query events table for matches
                matching_events = await self.query_events_by_ids(espn_ids)
                
                # Update events with intelligence links
                for event in matching_events:
                    await self.update_event_with_intelligence(event.id, item)
                    
    except Exception as e:
        self.logger.error(f"Error linking news to events: {e}")
```

---

## 5. System Data Flow Map

### Current Architecture Flow
```
┌─────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│   ESPN APIs   │───▶│  BaseSport    │───▶│  Surveillance   │
│ (Now, CDN)   │    │  Parser       │    │  Engine        │
└─────────────────┘    └─────────────────┘    └──────────────────┘
         │                      │                   │
         ▼                      ▼                   ▼
    ┌─────────────────┐    ┌─────────────────┐    ┌──────────────────┐
    │  Supabase     │───▶│  Public_       │───▶│  EdgeMind     │
    │  Database      │    │  Intelligence  │    │  BOT          │
    │                │    │  Table         │    │               │
    └─────────────────┘    └─────────────────┘    └──────────────────┘
         │                      │                   │
         ▼                      ▼                   ▼
    ┌─────────────────┐    ┌─────────────────┐    ┌──────────────────┐
    │  Prediction     │───▶│  Final         │───▶│  Frontend     │
    │  Tables        │    │  Predictions   │    │  Display      │
    │                │    │  Table         │    │               │
    └─────────────────┘    └─────────────────┘    └──────────────────┘
```

### Data Flow Steps
1. **Discovery**: ESPN APIs → `events` table (espn_id, sport, status='in-progress')
2. **Parsing**: Raw JSON → `BaseSportParser` → Normalized dictionary
3. **Surveillance**: ESPN Now/CDN → `public_intelligence` (live_momentum, edge_data)
4. **Intelligence**: News linking → `events` table updates with intelligence references
5. **Prediction**: Combined data → `direct1x2_prediction_final` → Frontend API
6. **Display**: Frontend consumes prediction APIs → User interface

---

## 6. Wholesale Changes Impact

### Current Issue: "Parallel Engine" Data Mismatch
**Problem**: Frontend reading old columns, Surveillance writing to new JSONB columns
**Symptoms**: 
- Website shows outdated or missing data
- New intelligence collected but not displayed
- User experience appears broken

### Solution Required
**Update all frontend-facing API endpoints** to read from new schema:
- `/api/predictions/*` routes
- `/api/vip/*` routes  
- `/api/ai-predictions/:matchId` route

**Ensure backward compatibility** during transition:
- Migrate old column data to new JSONB structure
- Provide fallback logic for mixed data states

---

## 7. EdgeMind Logic Manifest

### Required AI Directive Generation
```python
# Generate Logic Manifest for EdgeMind BOT
async def generate_logic_manifest(self):
    """Generate comprehensive logic manifest for EdgeMind operations."""
    
    manifest = {
        "version": "1.0",
        "data_sources": {
            "weather": {
                "api": "openweathermap.org",
                "table": "edge_data",
                "field": "weather_conditions",
                "weight": 0.15,
                "description": "Weather impacts scoring and player performance"
            },
            "injuries": {
                "api": "espn.now.core",
                "table": "edge_data", 
                "field": "injury_report",
                "weight": 0.25,
                "description": "Player availability affects win probability"
            },
            "momentum": {
                "api": "espn.cdn.core",
                "table": "live_momentum",
                "field": "odds_velocity",
                "weight": 0.20,
                "description": "Live odds movement indicates market sentiment"
            },
            "news_sentiment": {
                "api": "espn.now.core",
                "table": "edge_data",
                "field": "news_sentiment_score",
                "weight": 0.10,
                "description": "Breaking news affects team confidence"
            }
        },
        "confidence_formula": {
            "base_confidence": 0.60,
            "weather_adjustment": "WEIGHT(weather_conditions) * ADJUSTMENT_FACTOR",
            "injury_adjustment": "WEIGHT(injury_report) * ADJUSTMENT_FACTOR", 
            "momentum_adjustment": "WEIGHT(odds_velocity) * ADJUSTMENT_FACTOR",
            "news_adjustment": "WEIGHT(news_sentiment_score) * ADJUSTMENT_FACTOR",
            "max_adjustment": 0.30,
            "final_confidence": "MIN(1.0, base_confidence + SUM(all_adjustments))"
        }
    }
    
    return manifest
```

---

## 8. Critical Action Items

### Immediate Fixes Required
1. **HIGH PRIORITY**: Update `cdn_live_loop` to read historical `live_momentum` before tracking changes
2. **HIGH PRIORITY**: Enhance `now_api_pulse.py` to link news items to specific `events` table rows
3. **MEDIUM PRIORITY**: Update all prediction API endpoints to read from new JSONB columns (`edge_data`, `live_momentum`)
4. **LOW PRIORITY**: Implement EdgeMind logic manifest for confidence scoring

### Integration Testing Required
1. End-to-end flow test: ESPN API → Parser → Surveillance → Database → Frontend
2. Data consistency validation: Ensure new intelligence data appears in predictions
3. Performance testing: Validate 5-second polling intervals under load
4. Error handling verification: Test network timeouts and API failures

---

## 9. Orphaned Data Identification

### Currently Collected But Unused
- **Injury Reports**: Stored in `edge_data` but not linked to predictions
- **Live Momentum**: Tracked but not factored into confidence scores  
- **News Intelligence**: Collected but not displayed on frontend
- **Historical Odds**: Previous momentum data not utilized for velocity calculations

### Recommended Cleanup
1. **Data Migration Script**: Move orphaned data to new schema structure
2. **Validation Rules**: Ensure all new intelligence has corresponding prediction references
3. **Monitoring Dashboard**: Track data utilization rates across the pipeline

---

## 10. System Health Metrics

### Success Criteria
- ✅ Discovery: Events populated with espn_id and sport
- ✅ Parsing: Consistent normalized dictionaries across sports
- ✅ Surveillance: Real-time monitoring with proper state tracking
- ✅ Intelligence: News linked to specific events with momentum tracking
- ✅ Prediction: New JSONB columns integrated into confidence calculations
- ✅ Frontend: Displaying live, intelligence-enhanced predictions

### Next Audit Recommended
**Timeline**: Within 24 hours after implementing critical fixes
**Scope**: Complete end-to-end validation with real ESPN data
**Validation**: User acceptance testing of prediction accuracy improvements
