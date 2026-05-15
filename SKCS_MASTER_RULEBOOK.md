# SKCS AI SPORTS EDGE — MASTER RULEBOOK v2.0 (Developer Edition)

---

## 1. RISK & CONFIDENCE FRAMEWORK

### 1.1 Confidence Tiers
| Tier | Label | Confidence Range |
|------|-------|------------------|
| ✅ Low Risk / High Confidence | Low Risk | 75% – 100% |
| 🟡 Medium Risk / Moderate Confidence | Medium Risk | 55% – 74% |
| 🔴 High Risk / Low Confidence | High Risk | 30% – 54% |
| ⚠️ Extreme Risk / Very Low Confidence | Extreme Risk | 0% – 29% |

### 1.2 Actions per Tier
- **Low Risk:** Primary display, eligible for accumulators, green styling.
- **Medium Risk:** Shown as "moderate", ineligible for accumulators.
- **High Risk:** Published only as speculative, never in accumulators, orange warning.
- **Extreme Risk:** Not published. Suppressed entirely.

### 1.3 Risk Tier Classification (Pseudocode)
```python
def classify_confidence(confidence: float) -> str:
    if confidence >= 75:
        return "Low Risk"
    elif confidence >= 55:
        return "Medium Risk"
    elif confidence >= 30:
        return "High Risk"
    else:
        return "Extreme Risk"
```

---

## 2. MAIN MARKET (DIRECT 1X2) RULES

- Main prediction confidence computed by AI pipeline.
- Displayed with risk tier label and colour.
- **Publication condition:** confidence ≥ 30% (Extreme Risk matches are never published).
- Accompanying badge: Low Risk (≥75%), Medium Risk (55–74%), High Risk (30–54%).

---

## 3. SECONDARY MARKET GOVERNANCE

### 3.1 Purpose
Offer the client additional, safer market options alongside the main pick.

### 3.2 Primary Secondary Rule (Always Active)
- Evaluate a wide pool of secondary markets.
- Filter to those with confidence **≥ 80%**.
- Apply **Best‑in‑Category** (see §4) to select **up to 4 markets**, each from a different category.
- Display as "Secondary Insights" with Low‑Risk styling.

### 3.3 Safe Haven Fallback
**Trigger:**  
- Main confidence **< 80%**  
- **AND** zero secondary markets ≥80%  
- **AND** main confidence **≥ 30%** (i.e., not Extreme).

**Fallback behaviour:**  
- Use the **Safe Haven Market List** (§4.2).
- Apply two extra filters:
  1. Confidence **> main 1X2 confidence**
  2. Confidence **≥ 75%** (ensuring offered havens are Low Risk)
- Apply Best‑in‑Category to pick up to 4 markets.
- Display with a message:  
  *"While the main market carries a [moderate/high] level of confidence, here are safer markets that cross the low‑risk threshold of 75%."*

**If main <30%:** No secondary insights are shown; the match is too unpredictable.

### 3.4 Secondary Market Selection Algorithm (Pseudocode)
```python
# Predefined market categories (see §4.1)
CATEGORIES = {
    "Double Chance / Draw No Bet": [...],
    "Goals": [...],
    "Corners": [...],
    "Cards": [...],
    "First Half Markets": [...],
    "Team Win Either Half": [...]
}

# Safe Haven market list (all markets in categories above)
SAFE_HAVEN_LIST = [ ... ]  # All markets from the categories

def select_secondary_markets(main_confidence: float, 
                             all_market_predictions: dict) -> list:
    """
    Returns up to 4 secondary market predictions (name, confidence)
    """
    # Step 1: Determine candidate pool
    candidates = []
    
    # Primary rule: markets with confidence >= 80%
    high_conf_markets = [m for m in all_market_predictions if m.confidence >= 80]
    
    if high_conf_markets:
        candidates = high_conf_markets
    elif main_confidence >= 30 and main_confidence < 80:
        # Fallback: use Safe Haven list, filtering by > main and >= 75
        for market in all_market_predictions:
            if market.name in SAFE_HAVEN_LIST:
                if market.confidence > main_confidence and market.confidence >= 75:
                    candidates.append(market)
    else:
        # Extreme risk main or no fallback condition met
        return []
    
    if not candidates:
        return []
    
    # Step 2: Best‑in‑Category selection
    best_per_category = {}
    for market in candidates:
        cat = get_category_for_market(market.name, CATEGORIES)
        if cat is None:
            continue
        if cat not in best_per_category or market.confidence > best_per_category[cat].confidence:
            best_per_category[cat] = market
    
    # Step 3: Sort and take top 4
    sorted_markets = sorted(best_per_category.values(), 
                            key=lambda m: m.confidence, reverse=True)
    return sorted_markets[:4]
```

---

## 4. SAFE HAVEN MARKET LIST & CATEGORIES

### 4.1 Market Categories (Best‑in‑Category applied)

| Category | Markets Included |
|----------|------------------|
| **Double Chance / Draw No Bet** | Double Chance (1X, X2, 12), Draw No Bet (Home), Draw No Bet (Away) |
| **Goals (Totals & Team)** | Over/Under X.5 Goals (1.5–6.5), Home Over 0.5/1.5, Away Over 0.5/1.5, BTTS Yes, BTTS No |
| **Corners** | Over/Under X.5 Corners (6.5–12.5) |
| **Cards** | Over/Under X.5 Yellow Cards (1.5–6.5) |
| **First Half Markets** | Over 0.5 First Half, Under 1.5 First Half, First Half Draw |
| **Team Win in Either Half** | Home Win Either Half, Away Win Either Half |

*BTTS is grouped with Goals. To make it a separate category, split Goals into "Goals" and "BTTS".*

### 4.2 Full Safe Haven Market List
Double Chance (1X, X2, 12)  
Draw No Bet (Home, Away)  
Over 1.5/2.5/3.5/4.5/5.5/6.5 Goals  
Under 2.5/3.5/4.5/5.5/6.5 Goals  
Home Over 0.5/1.5, Away Over 0.5/1.5  
Over 6.5–12.5 Corners, Under 6.5–12.5 Corners  
Over 1.5–6.5 Yellow Cards, Under 1.5–6.5 Yellow Cards  
BTTS Yes, BTTS No  
Over 0.5 First Half, Under 1.5 First Half, First Half Draw  
Home Win Either Half, Away Win Either Half

---

## 5. ACCUMULATOR CONSTRUCTION RULES

### 5.1 Rules
- **Minimum leg confidence:** 75% (Low Risk).  
- **Safe pool size:** Up to 12 legs selected from pre‑filtered ultra‑safe markets (Double Chance, Over 0.5 goals, etc.) where confidence ≥80%.  
- **Market conflict detection:** No two legs with correlation coefficient >0.5 (e.g., BTTS Yes + Over 2.5 Goals).  
- **Volatile market exclusions:** Correct Score, First Goalscorer, Red Cards (already banned).

### 5.2 Accumulator Leg Validation (Pseudocode)
```python
def validate_acca_legs(legs: list) -> bool:
    for leg in legs:
        if leg.confidence < 75:
            return False
        if leg.market in VOLATILE_EXCLUDED_MARKETS:
            return False
    # Check pairwise correlation
    for i in range(len(legs)):
        for j in range(i+1, len(legs)):
            corr = get_market_correlation(legs[i].market, legs[j].market)
            if corr > 0.5:
                return False
    return len(legs) <= 12
```

---

## 6. AI PREDICTION PIPELINE (UNCHANGED)

- **4‑Stage Pipeline:** Baseline → Weather → Injuries → H2H/Form.
- Weighted adjustments applied at each stage.
- Context intelligence (derby, manager change, cup congestion) triggers additional modifiers.
- Predictions generated for all supported markets.

---

## 7. DATA & INFRASTRUCTURE GOVERNANCE

- **Database:** Supabase with schema‑level constraints and triggers.
- **Old secondary market allowlist** (76% min) replaced by Safe Haven list and categories; disable old triggers.
- **Publication lock:** Weekly lock for main predictions; emergency overrides for late injuries.
- **Sync interval:** 360 minutes for football data.
- **Target leagues:** 66 football leagues.
- **API:** Football‑specific endpoints, sport sync configuration, error recovery.

---

## 8. COMPLIANCE & VALIDATION

- Red card markets banned.
- No Extreme Risk predictions published.
- Real‑time validation at DB level for confidence thresholds and category caps.
- Market diversity enforced via Best‑in‑Category, not old numeric caps.

---

## 9. FRONTEND PRESENTATION RULES

- **Risk colour coding:** Green (Low), Yellow (Medium), Orange (High). Extreme never shown.
- **Market labels:** Formatted as per defined mapping.
- **Secondary section modal:** Populated by `select_secondary_markets()`.
- **Fallbacks:** If no secondary can be shown, the section is hidden.

---

## 10. CRITICAL NUMBERS SUMMARY

| Parameter | Value |
|-----------|-------|
| Low Risk threshold | 75% |
| Medium Risk band | 55–74% |
| High Risk band | 30–54% |
| Extreme Risk max | 29% |
| Main market publication floor | 30% |
| Secondary primary confidence floor | 80% |
| Safe Haven fallback trigger | Main <80% AND no ≥80% secondary AND main ≥30% |
| Safe Haven confidence requirement | > main confidence AND ≥75% |
| Max secondary markets per match | 4 (one per category) |
| Accumulator leg minimum | 75% |
| Accumulator max legs | 12 |
| Market correlation exclusion | >0.5 |
| Football sync interval | 360 min |
| Target leagues | 66 |

---

## 11. SAME MATCH BUILDER (SMB) v2.0

### 11.1 Gulf in Class Calculation
- **Expected Goals Formula**: 
  - Home: λ = α_home × β_away × γ
  - Away: μ = α_away × β_home
  - Gulf: λ - μ (expected goal difference)
- **Fallback Parameters**: League average home 1.513, away 1.091, γ=1.0

### 11.2 Maximum Legs Allowed
- **winProb <50% OR goalDiff <1.0**: max 2 legs
- **winProb 50-65% OR goalDiff 1.0-2.5**: max 4 legs  
- **winProb 65-80% OR goalDiff 2.5-4.0**: max 6 legs
- **winProb >80% OR goalDiff >4.0**: max 8 legs

### 11.3 Prebuilt SMB Templates
**4-Leg**: Favourite Win + Over 1.5 Team Goals + Over 4.5 Corners + Lead Striker 1+ SOT

**6-Leg**: Win + Over 2.5 Goals + Over 5.5 Corners + Striker 1+ SOT + Lead at HT + Opponent Keeper 2+ Saves

**8-Leg**: Win + Over 3.5 Goals + Over 2.5 Team Goals + Over 6.5 Corners + Striker 1+ SOT + Win Both Halves + Opponent Keeper 3+ Saves + Clean Sheet (or BTTS No if unavailable)

### 11.4 SMB Confidence Calculation
- **2-3 legs**: Pairwise iterative formula with minimum ρ
- **4+ legs**: Gaussian copula method with multivariate normal CDF
- **H2H Decay**: ρ × 0.8 if H2H matches <5

### 11.5 SMB Correlation Matrix (ρ values)
- Favourite Win & Over 2.5 Goals: 0.28
- Favourite Win & Lead Striker 1+ SOT: 0.35
- Over 2.5 & BTTS Yes: 0.25
- Favourite Win & Over 4.5 Corners: 0.20
- Lead Striker SOT & Opponent Keeper Saves: 0.15
- All other related markets: 0.10
- Negative pairs (Win & Opponent RB yards): -0.30
- All player props vs match markets initially: 0.10 unless specified

### 11.6 SMB Contradiction Validation
**RED (Block) Pairs**:
- Over 2.5 ↔ Under 1.5
- BTTS Yes ↔ Home Win to Nil
- Home Win ↔ Away Clean Sheet
- Away Win ↔ Home Clean Sheet
- Draw ↔ Any Clean Sheet
- Over 1.5 FH ↔ Under 0.5 FH
- Player to Score ↔ 0-0 Correct Score
- Interval overlap conflicts

**AMBER (Warn) Pairs**:
- Joint probability <2% based on historical data
- Favourite Win 3-0 Correct Score ↔ Underdog Striker 2+ SOT

### 11.7 SMB Tier Classification
- **Tier 1**: ≥25% (green) - Statistical Edge
- **Tier 2**: 15-24% (yellow) - Speculative territory
- **Tier 3**: 8-14% (orange) - Lottery ticket zone
- **Suppressed**: <8%

### 11.8 EdgeMind SMB Phrases
- **Gulf unlocked**: "Gulf in Class Detected. Expected goal difference >4.0. Extreme 8‑leg story unlocked."
- **Tier 1**: "Statistical Edge — this story holds up. All legs positively correlated."
- **Tier 2**: "Speculative territory. Your narrative is intact, but variance is high."
- **Tier 3**: "Lottery ticket zone. ~[X]% historical hit rate. Entertainment only — stake accordingly."
- **Leg 7/8 added**: "You're in extreme territory. This combo hits roughly as often as flipping heads 5 times in a row (~3%). Know the odds."
- **Contradiction blocked**: "[Leg Y] breaks the story. We suggest [Z] instead."
- **Near-contradiction**: "These two almost never happen together. Want to pivot to a stronger narrative?"

### 11.9 SMB UI Requirements
- Tabbed interface: 4-Leg, 6-Leg, 8-Leg
- Grey out unavailable tabs with dominance gap tooltip
- Show top 3 prebuilt combos per active tab
- Live bet slip drawer for custom builds
- Real-time contradiction validation

---

*End of rulebook.*
