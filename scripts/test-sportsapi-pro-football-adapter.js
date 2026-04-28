'use strict';

const {
    isSportsApiProFootballEnabled,
    discoverAndBuildSampleContexts
} = require('../backend/providers/football/sportsApiProFootballAdapter');

function printContext(context, index) {
    const base = context?.detail || context?.normalizedGame || {};
    console.log(`\n[Context ${index + 1}]`);
    console.log(`gameId: ${context?.gameId ?? 'n/a'}`);
    console.log(`kickoff_time: ${base?.kickoff_time ?? 'n/a'}`);
    console.log(`status: ${base?.status ?? 'n/a'}`);
    console.log(`competition: ${base?.competition?.name ?? 'n/a'} (${base?.competition?.id ?? 'n/a'})`);
    console.log(`home team: ${base?.home_team?.name ?? 'n/a'} (${base?.home_team?.id ?? 'n/a'})`);
    console.log(`away team: ${base?.away_team?.name ?? 'n/a'} (${base?.away_team?.id ?? 'n/a'})`);
    console.log(`detailJoined: ${Boolean(context?.joinability?.detailJoined)}`);
    console.log(`statsJoined: ${Boolean(context?.joinability?.statsJoined)}`);
    console.log(`squadsJoined: ${Boolean(context?.joinability?.squadsJoined)}`);
    console.log(`teamsConfirmed: ${Boolean(context?.joinability?.teamsConfirmed)}`);
    console.log(`team paths: home=${base?.team_diagnostics?.home_path ?? 'n/a'} away=${base?.team_diagnostics?.away_path ?? 'n/a'}`);
    if (Array.isArray(base?.team_diagnostics?.candidate_paths) && base.team_diagnostics.candidate_paths.length) {
        console.log(`team candidate paths: ${base.team_diagnostics.candidate_paths.slice(0, 5).join(', ')}`);
    }
    if (Array.isArray(base?.team_diagnostics?.inference_warnings) && base.team_diagnostics.inference_warnings.length) {
        console.log(`team inference warnings: ${base.team_diagnostics.inference_warnings.join(', ')}`);
    }
    console.log(`warnings: ${Array.isArray(context?.warnings) && context.warnings.length ? context.warnings.join(', ') : 'none'}`);
}

async function run() {
    console.log('=== SKCS SPORTSAPI PRO FOOTBALL ADAPTER TEST START ===');
    const enabled = isSportsApiProFootballEnabled();
    console.log(`Feature flag ENABLE_SPORTSAPI_PRO_FOOTBALL: ${enabled ? 'true' : 'false'}`);

    if (!enabled) {
        console.log(JSON.stringify({
            ok: false,
            disabled: true,
            reason: 'ENABLE_SPORTSAPI_PRO_FOOTBALL is not true'
        }, null, 2));
        console.log('To run this isolated adapter test, set ENABLE_SPORTSAPI_PRO_FOOTBALL=true in your local .env only.');
        process.exitCode = 0;
        return;
    }

    const result = await discoverAndBuildSampleContexts(3);
    const contexts = Array.isArray(result?.contexts) ? result.contexts : [];
    const selectedGameIds = Array.isArray(result?.selectedGameIds) ? result.selectedGameIds : [];

    console.log(`current games count: ${result?.currentGamesNormalizedCount ?? 0}`);
    console.log(`selected game IDs: ${selectedGameIds.length ? selectedGameIds.join(', ') : 'none'}`);

    for (let i = 0; i < contexts.length; i += 1) {
        printContext(contexts[i], i);
    }

    if (result?.rateLimit) {
        console.log('\nrate limits:');
        console.log(JSON.stringify(result.rateLimit, null, 2));
    }

    const detailJoinCount = contexts.filter((c) => c?.joinability?.detailJoined).length;
    const statsJoinCount = contexts.filter((c) => c?.joinability?.statsJoined).length;
    const squadJoinCount = contexts.filter((c) => c?.joinability?.squadsJoined).length;
    const kickoffConfirmedCount = contexts.filter((c) => c?.joinability?.kickoffConfirmed).length;
    const statusConfirmedCount = contexts.filter((c) => c?.joinability?.statusConfirmed).length;
    const competitionConfirmedCount = contexts.filter((c) => c?.joinability?.competitionConfirmed).length;
    const teamsConfirmedCount = contexts.filter((c) => c?.joinability?.teamsConfirmed).length;
    const teamIdsFoundCount = contexts.reduce((sum, c) => {
        const base = c?.detail || c?.normalizedGame || {};
        let count = 0;
        if (base?.home_team?.id !== null && base?.home_team?.id !== undefined && base?.home_team?.id !== '') count += 1;
        if (base?.away_team?.id !== null && base?.away_team?.id !== undefined && base?.away_team?.id !== '') count += 1;
        return sum + count;
    }, 0);
    const teamNamesFoundCount = contexts.reduce((sum, c) => {
        const base = c?.detail || c?.normalizedGame || {};
        let count = 0;
        if (base?.home_team?.name) count += 1;
        if (base?.away_team?.name) count += 1;
        return sum + count;
    }, 0);
    const teamInferenceWarningCount = contexts.reduce((sum, c) => {
        const base = c?.detail || c?.normalizedGame || {};
        return sum + (Array.isArray(base?.team_diagnostics?.inference_warnings) ? base.team_diagnostics.inference_warnings.length : 0);
    }, 0);
    const topTeamCandidatePaths = Array.from(new Set(contexts.flatMap((c) => {
        const base = c?.detail || c?.normalizedGame || {};
        return Array.isArray(base?.team_diagnostics?.candidate_paths) ? base.team_diagnostics.candidate_paths : [];
    }))).slice(0, 10);

    console.log('\n=== SKCS SPORTSAPI PRO FOOTBALL ADAPTER TEST SUMMARY ===');
    console.log(`Feature flag enabled? ${enabled ? 'yes' : 'no'}`);
    console.log(`Current games normalized count: ${result?.currentGamesNormalizedCount ?? 0}`);
    console.log(`Contexts built: ${contexts.length}`);
    console.log(`Detail join count: ${detailJoinCount}`);
    console.log(`Stats join count: ${statsJoinCount}`);
    console.log(`Squad join count: ${squadJoinCount}`);
    console.log(`Kickoff confirmed count: ${kickoffConfirmedCount}`);
    console.log(`Status confirmed count: ${statusConfirmedCount}`);
    console.log(`Competition confirmed count: ${competitionConfirmedCount}`);
    console.log(`Teams confirmed count: ${teamsConfirmedCount}`);
    console.log(`Team IDs found count: ${teamIdsFoundCount}`);
    console.log(`Team names found count: ${teamNamesFoundCount}`);
    console.log(`Team inference warning count: ${teamInferenceWarningCount}`);
    console.log(`Top team candidate paths observed: ${topTeamCandidatePaths.length ? topTeamCandidatePaths.join(', ') : 'none'}`);
    console.log('Provider predictions called? no');
    console.log('DB writes? no');
    console.log('Production wiring? no');
    console.log('Review decision: ADAPTER ONLY. DO NOT WIRE INTO PIPELINE YET.');

    process.exitCode = 0;
}

run().catch((error) => {
    console.error(`Adapter test failure: ${String(error?.message || error)}`);
    process.exitCode = 1;
});
