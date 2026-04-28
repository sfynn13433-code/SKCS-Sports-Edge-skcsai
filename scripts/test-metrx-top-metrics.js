'use strict';

require('dotenv').config();

const {
    fetchTopMatchMetrics
} = require('../backend/services/metrxFactoryService');

const {
    extractMetrxTopMatches
} = require('../backend/services/metrxFactoryExtractor');

function printMatchSummary(match, index) {
    console.log('');
    console.log(`Match ${index + 1}`);
    console.log('-----------------------------');
    console.log(
        `${match.home_team?.name || 'Unknown Home'} vs ${match.away_team?.name || 'Unknown Away'}`
    );
    console.log(`Match ID: ${match.provider_match_id || 'n/a'}`);
    console.log(`Start: ${match.start_time || 'n/a'}`);
    console.log(
        `Competition: ${match.competition?.name || 'n/a'} (${match.competition?.id || 'no id'})`
    );
    console.log(
        `Competition PI/Rank: ${match.competition?.performance_index ?? 'n/a'} / ${match.competition?.rank ?? 'n/a'}`
    );
    console.log(
        `xG Home/Away: ${match.metrics?.expected_goals_home ?? 'n/a'} / ${match.metrics?.expected_goals_away ?? 'n/a'}`
    );
    console.log(`xG Quality: ${match.metrics?.xg_quality ?? 'n/a'}`);
    console.log(
        `Venue Advantage: ${match.metrics?.expected_venue_advantage ?? 'n/a'}`
    );
    console.log(
        `Handicap Line: ${match.metrics?.expected_handicap_line ?? 'n/a'}`
    );
    console.log(`Points Line: ${match.metrics?.expected_points_line ?? 'n/a'}`);
    console.log(`Total Line: ${match.metrics?.expected_total_line ?? 'n/a'}`);
    console.log(`Odds Quality: ${match.metrics?.odds_quality ?? 'n/a'}`);
    console.log(`Raw Keys: ${(match.raw_keys || []).join(', ')}`);
    console.log(`Nested Match Keys: ${(match.nested_keys?.match || []).join(', ')}`);
    console.log(`Nested Performance Keys: ${(match.nested_keys?.performance || []).join(', ')}`);
    console.log(`Nested Scores Keys: ${(match.nested_keys?.scores || []).join(', ')}`);
}

async function main() {
    console.log('=== SKCS Metrx Factory Top Match Metrics Test ===');
    console.log('Mode: isolated service + extractor only');
    console.log('Live requests allowed in this script: 1');
    console.log('');

    const result = await fetchTopMatchMetrics({
        rawParams: {
            metric: 'abs(sub(TIH,TIA))',
            start: 'U',
            projections: 'MD,TI,XG',
            maxCount: 3,
            order: 'DESC',
            estimateBill: false
        }
    });

    console.log('Provider:', result.provider);
    console.log('Endpoint:', result.endpoint);
    console.log('HTTP Status:', result.status);
    console.log('OK:', result.ok);
    console.log('Rate Limit:', JSON.stringify(result.rateLimit, null, 2));

    if (!result.ok) {
        console.error('');
        console.error('Metrx Factory request failed.');
        console.error('Error:', result.error);
        console.error('Details:', result.details);
        process.exitCode = 1;
        return;
    }

    const raw = result.data;
    const rawKeys =
        raw && typeof raw === 'object' && !Array.isArray(raw)
            ? Object.keys(raw)
            : Array.isArray(raw)
                ? ['<array>']
                : [typeof raw];

    console.log('');
    console.log('Raw top-level keys:', rawKeys.join(', '));

    const matches = extractMetrxTopMatches(raw);

    console.log('');
    console.log('Normalized matches:', matches.length);

    if (!matches.length) {
        console.log('');
        console.log('No normalized matches found.');
        const firstRow = Array.isArray(raw?.result) ? raw.result[0] : null;
        if (firstRow) {
            console.log('First raw result row preview:');
            console.log(JSON.stringify(firstRow, null, 2).slice(0, 3000));
        }
        console.log(
            'Safe raw preview:',
            JSON.stringify(raw, null, 2).slice(0, 3000)
        );
        return;
    }

    matches.slice(0, 5).forEach(printMatchSummary);

    console.log('');
    console.log('✅ Metrx Factory isolated top metrics test completed.');
    console.log('No Supabase writes performed.');
    console.log('No aiPipeline wiring performed.');
}

main().catch((error) => {
    console.error('Unexpected test failure:', error.message || error);
    process.exitCode = 1;
});
