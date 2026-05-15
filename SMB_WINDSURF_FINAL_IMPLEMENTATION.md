# SMB v2.0 Final Locked Implementation Prompt for Windsurf

🔒 **SKCS SAME MATCH BUILDER — FINAL LOCKED SPECIFICATION v2.0**
Status: Approved & Locked | Date: 15 May 2026

---

You are implementing the SKCS Same Match Builder (SMB v2.0) using the FINAL LOCKED SPECIFICATION. Do not deviate from these rules.

## 1. ARCHITECTURE: TWO-MODEL ENGINE

**Model** | **Role** | **Trigger**
---|---|---
Bivariate Poisson | Calculates expected goal difference (λ - μ). Determines the "Gulf in Class" gate. | Runs on every match pre‑kickoff.
Gaussian Copula | Computes the true joint probability of the full combo, adjusted for correlation. | Runs when user opens a builder tab (4/6/8 leg).

## 2. GULF IN CLASS GATE (DYNAMIC LEG CAPPING)

**Favourite Win %** | **λ - μ** | **Max Legs Unlocked**
---|---|---
<50% | <1.0 | 2 (basic builder only)
50–65% | 1.0 – 2.5 | 4
65–80% | 2.5 – 4.0 | 6
>80% | >4.0 | 8

**Greyed‑out tabs** show EdgeMind explanation: *"This match lacks the dominance gap required for [6/8]‑leg builds."*

## 3. EXTREME TIER THRESHOLDS

**Tier** | **Combined Confidence** | **Label**
---|---|---
Tier 1 (Strong) | ≥25% | Statistical Edge
Tier 2 (Speculative) | 15–24% | High Risk
Tier 3 (Extreme) | 8–14% | Lottery Ticket
Suppressed | <8% | Not Shown

## 4. CORRELATION MATRIX (KEY ρ VALUES)

**Pair** | **ρ**
---|---
Favourite Win & Over 2.5 Goals | 0.28
Favourite Win & Lead Striker 1+ SOT | 0.35
Over 2.5 & BTTS Yes | 0.25
Favourite Win & Over 4.5 Corners | 0.20
Lead Striker SOT & Opponent Keeper Saves | 0.15
All other related markets | 0.10
Negative pairs (e.g. Win & Opponent RB yards) | -0.30

**H2H sample <5 matches**: multiply ρ by 0.8.

## 5. CONTRADICTION GRAPH

- **Red exclusion edges**: Logically impossible pairs (e.g. Over 2.5 ↔ Under 1.5; Home Win ↔ Away Clean Sheet). **Blocked.**
- **Amber near‑exclusion edges**: Joint probability <2% historically. **Warned.**
- **Time‑interval mapping**: Parses "Goal before 30:00" to [0,30]; blocks conflicting totals in overlapping intervals.

## 6. PRE‑BUILT COMBO TEMPLATES

**4‑leg "Dominant Narrative"**: Win, Over 1.5 Team Goals, Over 4.5 Corners, Striker 1+ SOT.

**6‑leg "Full Stack"**: Win, Over 2.5 Goals, Over 5.5 Corners, Striker 1+ SOT, Lead HT, Opponent Keeper 2+ Saves.

**8‑leg "Gulf in Class"**: Win, Over 3.5 Goals, Over 2.5 Team Goals, Over 6.5 Corners, Striker 1+ SOT, Win Both Halves, Opponent Keeper 3+ Saves, Clean Sheet (or BTTS No).

**Templates auto‑substitute** missing markets with next‑best correlated alternative.

## 7. EDGEMIND MESSAGING (LOCKED PHRASES)

**Trigger** | **Message**
---|---
Gulf in Class unlocked | "Gulf in Class Detected. Expected goal difference >4.0. Extreme 8‑leg story unlocked."
Tier 1 achieved | "Statistical Edge — this story holds up. All legs positively correlated."
Tier 3 warning | "Lottery ticket zone. ~[X]% historical hit rate. Entertainment only."
7th/8th leg added | "This combo hits ~3 times in 100. Know the odds."
Contradiction blocked | "[Leg Y] breaks the story. We suggest [Z] instead."

---

## IMPLEMENTATION REQUIREMENTS

### FILES TO WORK ON:
- `public/js/smh-hub.js` (frontend logic)

### CORE FUNCTIONS TO IMPLEMENT:

#### 1. calculateGulfInClass(match)
- Compute expected home goals λ = α_home × β_away × γ
- Compute expected away goals μ = α_away × β_home  
- Return λ - μ (expected goal difference)
- Use team parameters (α, β) from match object. Fallback: home 1.513, away 1.091, γ=1.0.

#### 2. getMaxLegsAllowed(match)
- Call calculateGulfInClass(match)
- Apply Gulf in Class gate rules above
- Return integer (2, 4, 6, or 8)

#### 3. generatePrebuiltSMB(match, legCount)
- legCount: 4, 6, or 8
- Use pre-built templates above
- Auto-substitute missing markets with correlated alternatives
- Generate 3-5 variants, calculate joint probability using Gaussian copula
- Return top 3 sorted by combined confidence

#### 4. calculateSMBConfidence(legs)
- **2-3 legs**: Pairwise iterative formula with minimum ρ
- **4+ legs**: Gaussian copula method:
  - Convert P_i to latent normal z_i = Φ^(-1)(P_i)
  - Compute multivariate normal CDF: Φ_Σ(z_1,...,z_k)
  - Use correlation matrix from Section 4
  - Apply H2H decay (ρ × 0.8 if H2H <5)
- Return combined probability (0 to 1)

#### 5. validateSMBLegs(selectedLegs, mainPick)
- Build contradiction graph using Section 5 rules
- Red edges: Block with suggestions
- Amber edges: Warn with alternatives
- Check main pick alignment for result markets
- Return {valid: boolean, errors: [], suggestions: []}

#### 6. renderSMBWidget(match)
- Tabbed UI: "4-Leg", "6-Leg", "8-Leg"
- Grey out tabs exceeding getMaxLegsAllowed(match)
- Show Gulf in Class tooltip for greyed tabs
- Display top 3 prebuilt combos per active tab
- Show combined confidence, tier color, EdgeMind message
- Live bet slip drawer with real-time validation

### CRITICAL IMPLEMENTATION NOTES:

- **Do not break existing DC Combo or ACCA logic**
- **Add new code; do not overwrite working functions**
- **Keep calculations client-side where possible**
- **Match object fields**: winProb, homeTeamAlpha, homeTeamBeta, awayTeamAlpha, awayTeamBeta, h2hSampleSize, availableMarkets[]
- **Use fallbacks when team parameters missing**
- **Implement exact EdgeMind phrases from Section 7**
- **Apply tier thresholds from Section 3**
- **Use correlation matrix from Section 4**
- **Implement contradiction validation from Section 5**

### VALIDATION REQUIREMENTS:

- All combos must pass contradiction validation
- Gulf in Class gate must restrict leg counts properly
- Correlation calculations must use Gaussian copula for 4+ legs
- EdgeMind messages must match exact phrases
- Tier colors must align with thresholds
- UI must grey out unavailable tabs with proper tooltips

---

**This specification is LOCKED. Implement exactly as specified without deviation.**
