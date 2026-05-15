// FINAL DOUBLE CHANCE COMBOS ALGORITHM (with Consistency Engine)
// Integrates Contradiction Governance Module for Main pick alignment

// Import contradiction governance (will be available in same context)
// const { isCompatibleWithMain, DC_COMPATIBILITY } = require('./contradictionGovernance');

// Contradiction map: main pick -> disallowed DC base
const DC_FORBIDDEN = {
  '1': ['X2', 'Away DNB'],
  'X': ['12', 'Home DNB', 'Away DNB'],
  '2': ['1X', 'Home DNB']
};

// Correlation matrix
const DC_CORRELATION = {
  "1X_Over1.5": 0.30, "1X_Over2.5": 0.35, "1X_BTTS_No": 0.40,
  "1X_Under2.5": 0.25, "12_Over1.5": 0.45, "12_Over2.5": 0.50,
  "12_BTTS_Yes": 0.30, "12_Under2.5": -0.20, "X2_Over1.5": 0.25,
  "X2_Over2.5": 0.30, "X2_BTTS_No": 0.35, "X2_Under2.5": 0.20
};

// Category definitions
const DC_CATEGORIES = {
  "1X_GOALS": ["C01","C02","C04"],
  "1X_BTTS": ["C03"],
  "12_GOALS": ["C05","C06","C08"],
  "12_BTTS": ["C07"],
  "X2_GOALS": ["C09","C10","C12"],
  "X2_BTTS": ["C11"]
};

/**
 * Compute combined confidence with correlation adjustment
 * Formula: P_joint = P_DC * P_supp + ρ * sqrt(P_DC * (1-P_DC) * P_supp * (1-P_supp))
 */
function computeCombinedConf(P_A, P_B, pairKey) {
  const rho = DC_CORRELATION[pairKey] || 0;
  const independent = P_A * P_B;
  const adjustment = rho * Math.sqrt(P_A * (1-P_A) * P_B * (1-P_B));
  return Math.min(1, Math.max(0, independent + adjustment));
}

/**
 * Select Double Chance combos with contradiction filtering
 * @param {string} mainPick - Main 1X2 pick ('1', 'X', or '2')
 * @param {Object} prob1X2 - 1X2 probabilities {home, draw, away}
 * @param {number} probOver1_5 - Over 1.5 goals probability
 * @param {number} probOver2_5 - Over 2.5 goals probability
 * @param {number} probUnder2_5 - Under 2.5 goals probability
 * @param {number} probBTTS_Yes - BTTS Yes probability
 * @param {number} probBTTS_No - BTTS No probability
 * @returns {Object} {combos: Array, message: string}
 */
function selectDoubleChanceCombos(mainPick, prob1X2, probOver1_5, probOver2_5, probUnder2_5, probBTTS_Yes, probBTTS_No) {
  // Validate inputs
  if (!mainPick || !prob1X2 || typeof prob1X2.home !== 'number') {
    return { combos: [], message: "Invalid input probabilities for Double Chance calculation." };
  }

  // Derive single probabilities
  const p_1X = prob1X2.home + prob1X2.draw;
  const p_12 = prob1X2.home + prob1X2.away;
  const p_X2 = prob1X2.draw + prob1X2.away;

  // Define all 12 combos with dc base
  const allCombos = [
    { id:"C01", dc:"1X", base:"1X", support:"Over1.5", P_A:p_1X, P_B:probOver1_5, pairKey:"1X_Over1.5" },
    { id:"C02", dc:"1X", base:"1X", support:"Over2.5", P_A:p_1X, P_B:probOver2_5, pairKey:"1X_Over2.5" },
    { id:"C03", dc:"1X", base:"1X", support:"BTTS_No", P_A:p_1X, P_B:probBTTS_No, pairKey:"1X_BTTS_No" },
    { id:"C04", dc:"1X", base:"1X", support:"Under2.5", P_A:p_1X, P_B:probUnder2_5, pairKey:"1X_Under2.5" },
    { id:"C05", dc:"12", base:"12", support:"Over1.5", P_A:p_12, P_B:probOver1_5, pairKey:"12_Over1.5" },
    { id:"C06", dc:"12", base:"12", support:"Over2.5", P_A:p_12, P_B:probOver2_5, pairKey:"12_Over2.5" },
    { id:"C07", dc:"12", base:"12", support:"BTTS_Yes", P_A:p_12, P_B:probBTTS_Yes, pairKey:"12_BTTS_Yes" },
    { id:"C08", dc:"12", base:"12", support:"Under2.5", P_A:p_12, P_B:probUnder2_5, pairKey:"12_Under2.5" },
    { id:"C09", dc:"X2", base:"X2", support:"Over1.5", P_A:p_X2, P_B:probOver1_5, pairKey:"X2_Over1.5" },
    { id:"C10", dc:"X2", base:"X2", support:"Over2.5", P_A:p_X2, P_B:probOver2_5, pairKey:"X2_Over2.5" },
    { id:"C11", dc:"X2", base:"X2", support:"BTTS_No", P_A:p_X2, P_B:probBTTS_No, pairKey:"X2_BTTS_No" },
    { id:"C12", dc:"X2", base:"X2", support:"Under2.5", P_A:p_X2, P_B:probUnder2_5, pairKey:"X2_Under2.5" }
  ];

  // 1. Filter: remove combos whose DC base is forbidden by Main pick
  const forbidden = DC_FORBIDDEN[mainPick] || [];
  const allowed = allCombos.filter(c => !forbidden.includes(c.base));

  // If no combos survive contradiction filter, return early
  if (allowed.length === 0) {
    return { combos: [], message: "No compatible Double Chance combos available for this match due to main pick alignment." };
  }

  // 2. Calculate combined confidence and assign tiers
  allowed.forEach(c => {
    c.confidence = computeCombinedConf(c.P_A, c.P_B, c.pairKey);
    c.tier = c.confidence >= 0.60 ? 1 : c.confidence >= 0.40 ? 2 : 3;
  });

  // 3. Suppress < 20%
  const valid = allowed.filter(c => c.confidence >= 0.20);

  if (valid.length === 0) {
    return { combos: [], message: "No Double Chance combos meet minimum confidence threshold (20%)." };
  }

  // 4. Best-in-Category (only active categories that appear)
  const categoryBest = {};
  for (const [cat, ids] of Object.entries(DC_CATEGORIES)) {
    const candidates = valid.filter(c => ids.includes(c.id));
    if (candidates.length > 0) {
      categoryBest[cat] = candidates.reduce((a, b) => a.confidence > b.confidence ? a : b);
    }
  }

  let selected = Object.values(categoryBest)
    .sort((a,b) => b.confidence - a.confidence)
    .slice(0, 6);

  // 5. Back-fill if fewer than 6
  if (selected.length < 6) {
    const remaining = valid.filter(c => !selected.some(s => s.id === c.id))
      .sort((a,b) => b.confidence - a.confidence);
    selected = selected.concat(remaining).slice(0,6);
  }

  // 6. Build result with proper formatting
  const hasTier1 = selected.some(c => c.tier === 1);
  const message = hasTier1 
    ? "These Double Chance combos offer enhanced safety by covering two match outcomes combined with a supporting market. Tier 1 (green) represents the lowest risk."
    : "No low-risk Double Chance combos available for this match, but these balanced options may still offer value.";

  return {
    combos: selected.map(c => ({
      id: c.id,
      name: `${c.dc} & ${c.support.replace(/_/g,' ')}`,
      confidence: (c.confidence * 100).toFixed(1) + '%',
      tier: c.tier,
      tierLabel: c.tier === 1 ? "Low Risk" : c.tier === 2 ? "Balanced" : "Speculative",
      color: c.tier === 1 ? "green" : c.tier === 2 ? "yellow" : "orange",
      dcBase: c.dc,
      supportMarket: c.support,
      correlation: DC_CORRELATION[c.pairKey] || 0
    })),
    message,
    summary: {
      totalCombos: allCombos.length,
      filteredByContradiction: allCombos.length - allowed.length,
      suppressedByConfidence: allowed.length - valid.length,
      finalSelection: selected.length,
      mainPick: mainPick,
      forbiddenBases: forbidden
    }
  };
}

/**
 * Get compatibility summary for a Main pick
 * @param {string} mainPick - Main 1X2 pick ('1', 'X', or '2')
 * @returns {Object} Compatibility information
 */
function getDCCompatibilitySummary(mainPick) {
  const forbidden = DC_FORBIDDEN[mainPick] || [];
  const allowedBases = ['1X', '12', 'X2'].filter(base => !forbidden.includes(base));
  
  return {
    mainPick: mainPick,
    forbiddenBases: forbidden,
    allowedBases: allowedBases,
    availableCombos: allowedBases.length * 4, // 4 support markets per DC base
    contradictionMessage: forbidden.length > 0 
      ? `Main pick ${mainPick} excludes ${forbidden.join(' and ')} bases for consistency.`
      : `Main pick ${mainPick} allows all Double Chance bases.`
  };
}

// Export for use in smh-hub.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    selectDoubleChanceCombos,
    getDCCompatibilitySummary,
    DC_FORBIDDEN,
    DC_CORRELATION,
    DC_CATEGORIES
  };
}
