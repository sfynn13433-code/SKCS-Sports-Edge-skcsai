'use strict';

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function normalizeWinnerFromPrediction(prediction) {
    const key = String(prediction || '').trim().toLowerCase();
    if (!key) return null;
    if (key === 'home' || key === 'home_win' || key === 'home win') return 'home';
    if (key === 'away' || key === 'away_win' || key === 'away win') return 'away';
    return null;
}

function deriveVolatilityFromConfidence(confidence) {
    if (confidence >= 78) return 'low';
    if (confidence >= 66) return 'medium';
    return 'high';
}

function extractImpliedSignalFromOddsEvent(match, homeTeam, awayTeam) {
    const raw = match?.raw_provider_data || match?.metadata?.raw_provider_data || null;
    const bookmakers = Array.isArray(raw?.bookmakers) ? raw.bookmakers : [];
    if (!bookmakers.length || !homeTeam || !awayTeam) return null;

    for (const bookmaker of bookmakers) {
        const markets = Array.isArray(bookmaker?.markets) ? bookmaker.markets : [];
        const h2h = markets.find((market) => String(market?.key || '').toLowerCase() === 'h2h');
        const outcomes = Array.isArray(h2h?.outcomes) ? h2h.outcomes : [];
        if (!outcomes.length) continue;

        let homeProb = null;
        let awayProb = null;

        for (const outcome of outcomes) {
            const price = Number(outcome?.price);
            if (!Number.isFinite(price) || price <= 1) continue;
            const implied = 1 / price;
            const name = String(outcome?.name || '').trim();
            if (name === homeTeam) homeProb = implied;
            if (name === awayTeam) awayProb = implied;
        }

        if (!Number.isFinite(homeProb) || !Number.isFinite(awayProb)) continue;

        const total = homeProb + awayProb;
        if (!Number.isFinite(total) || total <= 0) continue;

        const normHome = homeProb / total;
        const normAway = awayProb / total;
        const edge = Math.abs(normHome - normAway); // 0..1
        const winner = normHome >= normAway ? 'home' : 'away';
        const confidence = clamp(Math.round((56 + edge * 44) * 100) / 100, 50, 96);

        return {
            winner,
            confidence,
            volatility: deriveVolatilityFromConfidence(confidence)
        };
    }

    return null;
}

function scoreMatch(match) {
    if (!match || typeof match !== 'object') {
        throw new Error('aiScoring.scoreMatch requires a match object');
    }

    const home = String(match.home_team || match.homeTeam || '').trim();
    const away = String(match.away_team || match.awayTeam || '').trim();
    const modelWinner = normalizeWinnerFromPrediction(
        match.model_prediction || match.model_pick || match?.metadata?.model_prediction || null
    );
    const modelConfidence = Number(match.model_confidence ?? match?.metadata?.model_confidence);

    if (modelWinner && Number.isFinite(modelConfidence) && modelConfidence > 0) {
        const confidence = clamp(Math.round(modelConfidence * 100) / 100, 0, 100);
        const volatility = deriveVolatilityFromConfidence(confidence);
        return {
            confidence,
            volatility,
            winner: modelWinner
        };
    }

    const baseWinner = normalizeWinnerFromPrediction(
        match.base_prediction || match.prediction || match.pick || null
    );
    const baseConfidence = Number(match.base_confidence ?? match.confidence);

    if (baseWinner && Number.isFinite(baseConfidence) && baseConfidence > 0) {
        const confidence = clamp(Math.round(baseConfidence * 100) / 100, 0, 100);
        const volatility = deriveVolatilityFromConfidence(confidence);
        return {
            confidence,
            volatility,
            winner: baseWinner
        };
    }

    const impliedSignal = extractImpliedSignalFromOddsEvent(match, home, away);
    if (impliedSignal) {
        return impliedSignal;
    }

    // Conservative fallback: use home advantage when no structured evidence is available.
    const winner = 'home';
    const confidence = 58;
    const volatility = 'high';

    if (String(process.env.DEBUG_AI_SCORING || '').trim().toLowerCase() === 'true') {
        console.log('[aiScoring] match_id=%s home=%s away=%s winner=%s confidence=%.2f volatility=%s',
            match.match_id,
            home || 'N/A',
            away || 'N/A',
            winner,
            confidence,
            volatility
        );
    }

    return {
        confidence,
        volatility,
        winner
    };
}

module.exports = {
    scoreMatch
};
