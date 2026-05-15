# SMB v2.0 Implementation Prompt for Windsurf

You are implementing the SKCS Same Match Builder (SMB v2.0) in the existing codebase. The complete specification is locked in SKCS_MASTER_RULEBOOK.md section 11. Do not deviate from these rules.

## FILES TO WORK ON:
- public/js/smh-hub.js (frontend logic)
- Any new SQL migration files if needed for correlation data

## NEW FUNCTIONS REQUIRED:

### 1. calculateGulfInClass(match)
- Compute expected home goals λ = α_home × β_away × γ
- Compute expected away goals μ = α_away × β_home
- Return λ - μ (expected goal difference)
- Use team parameters (α, β) stored in match object. If missing, fallback to league average home 1.513, away 1.091, γ=1.0.

### 2. getMaxLegsAllowed(match)
- Call calculateGulfInClass(match)
- Apply these rules:
  - winProb <50% or goalDiff <1.0 → max 2 legs
  - winProb 50-65% or goalDiff 1.0-2.5 → max 4 legs
  - winProb 65-80% or goalDiff 2.5-4.0 → max 6 legs
  - winProb >80% or goalDiff >4.0 → max 8 legs
- Return the integer.

### 3. generatePrebuiltSMB(match, legCount)
- legCount is 4, 6, or 8.
- Use template combos as follows:
  - 4-leg: Favourite Win + Over 1.5 Team Goals + Over 4.5 Corners + Lead Striker 1+ SOT
  - 6-leg: Win + Over 2.5 Goals + Over 5.5 Corners + Striker 1+ SOT + Lead at HT + Opponent Keeper 2+ Saves
  - 8-leg: Win + Over 3.5 Goals + Over 2.5 Team Goals + Over 6.5 Corners + Striker 1+ SOT + Win Both Halves + Opponent Keeper 3+ Saves + Clean Sheet (or BTTS No if Clean Sheet unavailable)
- If a leg market is unavailable, substitute the next-highest correlated alternative from the allowed pool (Over/Under goals, corners, BTTS, team goals, team to win both halves, half-time result, keeper saves).
- Generate 3-5 variants, calculate joint probability for each using the Gaussian copula method (see below), return top 3 sorted by combined confidence.

### 4. calculateSMBConfidence(legs)
- For 2-3 legs: use pairwise iterative formula: P(A∩B) = P_A*P_B + ρ*√(P_A(1-P_A)*P_B(1-P_B)), using minimum pairwise ρ among all pairs.
- For 4+ legs: use Gaussian copula method.
  - Step A: Convert each marginal probability P_i to latent normal z_i = Φ^(-1)(P_i). Use a standard normal inverse CDF (you can implement a simple approximation or use jStat).
  - Step B: Compute multivariate normal CDF: P(all) = Φ_Σ(z_1,...,z_k) where Σ is the correlation matrix built from the correlation table below.
  - Step C: For computational efficiency, if exact MVN CDF is too heavy, use a pre-computed lookup or approximate with the mean of pairwise joint probabilities using the minimum ρ. The key is to *not* use simple independence multiplication.
- Apply H2H decay: if H2H matches <5, multiply ρ by 0.8.
- Return combined probability (0 to 1).

### 5. validateSMBLegs(selectedLegs, mainPick)
- Build a contradiction graph using exclusion pairs:
  - RED (block): Over 2.5 ↔ Under 1.5, BTTS Yes ↔ Home Win to Nil, Home Win ↔ Away Clean Sheet, Away Win ↔ Home Clean Sheet, Draw ↔ Any Clean Sheet, Over 1.5 FH ↔ Under 0.5 FH, Player to Score ↔ 0-0 Correct Score, any interval overlap with conflicting totals (parse time strings like "Goal before 30:00" to [0,30] and check subsets).
  - AMBER (warn, don't block): Joint probability <2% based on historical conditional frequencies. Hardcoded pairs: Favourite Win 3-0 Correct Score ↔ Underdog Striker 2+ SOT.
- Also check main pick alignment: any match result leg must equal mainPick.
- Return {valid: boolean, errors: [{leg1, leg2, message, type: 'block'|'warn'}], suggestions: []}. If a block occurs, suggest a positively correlated alternative (e.g., Home Win to Nil for Home Win + BTTS No).

### 6. renderSMBWidget(match)
- Build a tabbed UI with tabs "4-Leg", "6-Leg", "8-Leg".
- Grey out tabs that exceed getMaxLegsAllowed(match). Show tooltip: "This match lacks the dominance gap required for [N]-leg builds."
- Active tab shows the top 3 prebuilt combos from generatePrebuiltSMB.
- Each combo shows legs, combined confidence %, tier colour (Tier 1: ≥25% green, Tier 2: 15-24% yellow, Tier 3: 8-14% orange), and EdgeMind message (see phrasebook).
- Bet slip drawer at bottom updates live as user builds custom combo.

## CORRELATION MATRIX (ρ values):
- Favourite Win & Over 2.5 Goals: 0.28
- Favourite Win & Lead Striker 1+ SOT: 0.35
- Over 2.5 & BTTS Yes: 0.25
- Favourite Win & Over 4.5 Corners: 0.20
- Lead Striker SOT & Opponent Keeper Saves: 0.15
- All other related markets: 0.10
- Negative pairs (Win & Opponent RB yards): -0.30
- All player props vs match markets initially: 0.10 unless specified

## EDGEMIND PHRASES (exact strings):
- Gulf unlocked: "Gulf in Class Detected. Expected goal difference >4.0. Extreme 8‑leg story unlocked."
- Tier 1: "Statistical Edge — this story holds up. All legs positively correlated."
- Tier 2: "Speculative territory. Your narrative is intact, but variance is high."
- Tier 3: "Lottery ticket zone. ~[X]% historical hit rate. Entertainment only — stake accordingly."
- Leg 7/8 added: "You're in extreme territory. This combo hits roughly as often as flipping heads 5 times in a row (~3%). Know the odds."
- Contradiction blocked: "[Leg Y] breaks the story. We suggest [Z] instead."
- Near-contradiction: "These two almost never happen together. Want to pivot to a stronger narrative?"

## IMPORTANT:
- Do not break existing DC Combo or ACCA logic.
- Add new code; do not overwrite working functions unless necessary.
- Keep all calculations client-side where possible.
- The match object will have fields: winProb, homeTeamAlpha, homeTeamBeta, awayTeamAlpha, awayTeamBeta, h2hSampleSize, availableMarkets[]. Use these if present; else fallback to defaults.
