'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'services', 'accaBuilder.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the function by line-based search
const lines = content.split('\n');
const startLine = lines.findIndex(l => l.startsWith('function finalizeAccumulatorRow'));
const endLine = lines.findIndex((l, i) => i > startLine && l.trim() === '}' && lines[i + 1]?.trim() === '' && lines[i + 2]?.startsWith('function hasMixedSportCoverage'));

if (startLine === -1 || endLine === -1) {
    console.error('Could not find function boundaries');
    console.error('startLine:', startLine, 'endLine:', endLine);
    process.exit(1);
}

console.log(`Found finalizeAccumulatorRow at lines ${startLine + 1}-${endLine + 1}`);

const newFunction = `function finalizeAccumulatorRow(legs, options = {}) {
    const profile = String(options.profile || 'mixed_sport');
    const minLegConfidenceFloor = Number(options.minLegConfidenceFloor || ACCA_MIN_LEG_CONFIDENCE);
    const isMega = options.isMega === true;
    const legCount = Number(legs?.length || 0);
    const ticketLabel = legCount >= MEGA_ACCA_SIZE ? '12 MATCH MEGA ACCA' : '6 MATCH ACCA';

    // Compute diversity breakdown: count market families across legs
    const diversityBreakdown = {};
    legs.forEach((leg) => {
        const marketType = String(leg?.market || leg?.metadata?.market || '').toLowerCase();
        let family = 'other';
        if (marketType.includes('combo')) family = 'combo';
        else if (marketType.includes('double_chance')) family = 'double_chance';
        else if (marketType.includes('draw_no_bet')) family = 'draw_no_bet';
        else if (marketType.includes('team_total')) family = 'team_total';
        else if (marketType.includes('over') || marketType.includes('under')) family = 'totals';
        else if (marketType.includes('btts')) family = 'btts';
        else if (marketType.includes('handicap')) family = 'handicap';
        else if (marketType.includes('half')) family = 'half_time';
        else if (marketType.includes('corner')) family = 'corners';
        else if (marketType.includes('card')) family = 'cards';
        else if (marketType.includes('winner') || marketType === '1x2' || marketType.includes('match_result')) family = 'match_result';
        diversityBreakdown[family] = (diversityBreakdown[family] || 0) + 1;
    });

    const payloadLegs = legs.map((leg) => {
        const finalLeg = toFinalMatchPayload(leg);
        finalLeg.metadata = {
            ...(finalLeg.metadata || {}),
            sport_type: getSportTypeLabel(finalLeg.sport),
            acca_profile: profile,
            acca_profile_label: profile === 'football_only' ? 'Football ACCA' : 'Mixed Sport ACCA',
            acca_ticket_label: ticketLabel,
            min_leg_confidence_floor: minLegConfidenceFloor
        };
        if (isMega) {
            finalLeg.metadata.mega_acca_leg = true;
        }
        return finalLeg;
    });

    const averageLegConfidence = computeTotalConfidence(payloadLegs);
    const totalConfidence = computeCompoundConfidence(payloadLegs);
    const totalTicketProbability = totalConfidence.toFixed(2) + '%';

    const payloadLegsWithConfidenceMeta = payloadLegs.map((leg) => ({
        ...leg,
        metadata: {
            ...(leg.metadata || {}),
            display_label: ticketLabel,
            average_leg_confidence: averageLegConfidence,
            compound_ticket_confidence: totalConfidence,
            total_ticket_probability_display: totalTicketProbability
        }
    }));

    return {
        match_id: payloadLegsWithConfidenceMeta.map((leg) => leg.match_id).filter(Boolean).join('|'),
        matches: payloadLegsWithConfidenceMeta,
        total_confidence: totalConfidence,
        total_ticket_probability: totalConfidence,
        totalTicketProbability: totalTicketProbability,
        ticket_label: ticketLabel,
        display_label: ticketLabel,
        average_leg_confidence: averageLegConfidence,
        diversity_breakdown: diversityBreakdown,
        risk_level: isMega ? 'safe' : riskLevelFromConfidence(totalConfidence)
    };
}`;

// Replace the function
lines.splice(startLine, endLine - startLine + 1, ...newFunction.split('\n'));
content = lines.join('\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Patched finalizeAccumulatorRow successfully');
console.log('New line count:', content.split('\n').length);
