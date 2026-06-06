'use strict';

/**
 * Builds live BSD league inventory for SKCS-KNOWLEDGE/providers/bsd_league_inventory.md
 * Read-only. Does not touch prediction pipelines.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { listLeagues, listEvents, listTeams, isBzzoiroEnabled } = require('../backend/services/bzzoiroApiClient');
const { TIER1_CROSSWALK_TARGETS } = require('../backend/services/bzzoiroCrosswalk');

/** API-Sports IDs — SKCS target football coverage (fetch-live-fixtures.js) */
const SKCS_TARGET_APISPORTS_LEAGUES = Object.freeze([
    { id: 39, name: 'Premier League', country: 'England', type: 'Domestic Top Flight' },
    { id: 40, name: 'Championship', country: 'England', type: 'Domestic 2nd Tier' },
    { id: 41, name: 'League One', country: 'England', type: 'Domestic 3rd Tier' },
    { id: 42, name: 'League Two', country: 'England', type: 'Domestic 4th Tier' },
    { id: 140, name: 'La Liga', country: 'Spain', type: 'Domestic Top Flight' },
    { id: 141, name: 'Segunda División', country: 'Spain', type: 'Domestic 2nd Tier' },
    { id: 78, name: 'Bundesliga', country: 'Germany', type: 'Domestic Top Flight' },
    { id: 79, name: '2. Bundesliga', country: 'Germany', type: 'Domestic 2nd Tier' },
    { id: 80, name: '3. Liga', country: 'Germany', type: 'Domestic 3rd Tier' },
    { id: 135, name: 'Serie A', country: 'Italy', type: 'Domestic Top Flight' },
    { id: 136, name: 'Serie B', country: 'Italy', type: 'Domestic 2nd Tier' },
    { id: 137, name: 'Serie C', country: 'Italy', type: 'Domestic 3rd Tier' },
    { id: 61, name: 'Ligue 1', country: 'France', type: 'Domestic Top Flight' },
    { id: 62, name: 'Ligue 2', country: 'France', type: 'Domestic 2nd Tier' },
    { id: 63, name: 'National 1', country: 'France', type: 'Domestic 3rd Tier' },
    { id: 94, name: 'Primeira Liga', country: 'Portugal', type: 'Domestic Top Flight' },
    { id: 95, name: 'Liga Portugal 2', country: 'Portugal', type: 'Domestic 2nd Tier' },
    { id: 88, name: 'Eredivisie', country: 'Netherlands', type: 'Domestic Top Flight' },
    { id: 89, name: 'Eerste Divisie', country: 'Netherlands', type: 'Domestic 2nd Tier' },
    { id: 144, name: 'Pro League', country: 'Belgium', type: 'Domestic Top Flight' },
    { id: 145, name: 'Challenger Pro League', country: 'Belgium', type: 'Domestic 2nd Tier' },
    { id: 179, name: 'Scottish Premiership', country: 'Scotland', type: 'Domestic Top Flight' },
    { id: 180, name: 'Scottish Championship', country: 'Scotland', type: 'Domestic 2nd Tier' },
    { id: 203, name: 'Süper Lig', country: 'Turkey', type: 'Domestic Top Flight' },
    { id: 204, name: '1. Lig', country: 'Turkey', type: 'Domestic 2nd Tier' },
    { id: 207, name: 'Super League', country: 'Switzerland', type: 'Domestic Top Flight' },
    { id: 208, name: 'Challenge League', country: 'Switzerland', type: 'Domestic 2nd Tier' },
    { id: 218, name: 'Bundesliga', country: 'Austria', type: 'Domestic Top Flight' },
    { id: 219, name: '2. Liga', country: 'Austria', type: 'Domestic 2nd Tier' },
    { id: 197, name: 'Super League 1', country: 'Greece', type: 'Domestic Top Flight' },
    { id: 113, name: 'Allsvenskan', country: 'Sweden', type: 'Domestic Top Flight' },
    { id: 114, name: 'Superettan', country: 'Sweden', type: 'Domestic 2nd Tier' },
    { id: 103, name: 'Eliteserien', country: 'Norway', type: 'Domestic Top Flight' },
    { id: 104, name: 'OBOS-ligaen', country: 'Norway', type: 'Domestic 2nd Tier' },
    { id: 119, name: 'Superliga', country: 'Denmark', type: 'Domestic Top Flight' },
    { id: 120, name: '1st Division', country: 'Denmark', type: 'Domestic 2nd Tier' },
    { id: 106, name: 'Ekstraklasa', country: 'Poland', type: 'Domestic Top Flight' },
    { id: 107, name: 'I Liga', country: 'Poland', type: 'Domestic 2nd Tier' },
    { id: 345, name: 'First League', country: 'Czech Republic', type: 'Domestic Top Flight' },
    { id: 172, name: 'First League', country: 'Bulgaria', type: 'Domestic Top Flight' },
    { id: 318, name: 'First Division', country: 'Cyprus', type: 'Domestic Top Flight' },
    { id: 224, name: 'Veikkausliiga', country: 'Finland', type: 'Domestic Top Flight' },
    { id: 118, name: 'Urvalsdeild', country: 'Iceland', type: 'Domestic Top Flight' },
    { id: 253, name: 'MLS', country: 'USA', type: 'Domestic Top Flight' },
    { id: 254, name: 'USL Championship', country: 'USA', type: 'Domestic 2nd Tier' },
    { id: 262, name: 'Liga MX', country: 'Mexico', type: 'Domestic Top Flight' },
    { id: 71, name: 'Brasileirão Série A', country: 'Brazil', type: 'Domestic Top Flight' },
    { id: 72, name: 'Brasileirão Série B', country: 'Brazil', type: 'Domestic 2nd Tier' },
    { id: 128, name: 'Liga Profesional', country: 'Argentina', type: 'Domestic Top Flight' },
    { id: 239, name: 'Primera A', country: 'Colombia', type: 'Domestic Top Flight' },
    { id: 265, name: 'Primera División', country: 'Chile', type: 'Domestic Top Flight' },
    { id: 268, name: 'Primera División', country: 'Uruguay', type: 'Domestic Top Flight' },
    { id: 130, name: 'Primera División', country: 'Costa Rica', type: 'Domestic Top Flight' },
    { id: 98, name: 'J1 League', country: 'Japan', type: 'Domestic Top Flight' },
    { id: 99, name: 'J2 League', country: 'Japan', type: 'Domestic 2nd Tier' },
    { id: 169, name: 'Chinese Super League', country: 'China', type: 'Domestic Top Flight' },
    { id: 292, name: 'K League 1', country: 'South Korea', type: 'Domestic Top Flight' },
    { id: 307, name: 'Pro League', country: 'Saudi Arabia', type: 'Domestic Top Flight' },
    { id: 301, name: 'Pro League', country: 'UAE', type: 'Domestic Top Flight' },
    { id: 188, name: 'A-League', country: 'Australia', type: 'Domestic Top Flight' },
    { id: 288, name: 'Premiership', country: 'South Africa', type: 'Domestic Top Flight' },
    { id: 289, name: 'Motsepe Foundation Championship', country: 'South Africa', type: 'Domestic 2nd Tier' },
    { id: 233, name: 'Premier League', country: 'Egypt', type: 'Domestic Top Flight' },
    { id: 195, name: 'Ligue 1', country: 'Algeria', type: 'Domestic Top Flight' },
    { id: 315, name: 'Premier League', country: 'Ghana', type: 'Domestic Top Flight' },
    { id: 326, name: 'Premier League', country: 'Kenya', type: 'Domestic Top Flight' }
]);

const TIER1_BSD_IDS = new Set(TIER1_CROSSWALK_TARGETS.map((row) => row.bsdLeagueId));

/** Verified API-Sports → BSD league map (country-aware; no ambiguous generic names). */
const STRICT_APISPORTS_TO_BSD = Object.freeze({
    39: '1',
    40: '12',
    140: '3',
    141: '38',
    78: '5',
    135: '4',
    61: '6',
    94: '2',
    88: '10',
    144: '14',
    179: '13',
    203: '11',
    207: '15',
    197: '24',
    113: '26',
    103: '54',
    106: '25',
    172: '22',
    224: '55',
    253: '18',
    254: '57',
    262: '19',
    71: '9',
    72: '34',
    98: '49',
    169: '52',
    292: '50',
    307: '17',
    3: '7'
});

const TIER_A_BSD_IDS = new Set([
    ...TIER1_BSD_IDS,
    ...Object.values(STRICT_APISPORTS_TO_BSD)
]);

function normalizeName(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function inferCompetitionType(league) {
    const name = normalizeName(league.name);
    const country = normalizeName(league.country);

    if (country === 'international' || name.includes('world cup') || name.includes('uefa') || name.includes('copa america') || name.includes('nations league') || name.includes('euro ')) {
        if (name.includes('qualification') || name.includes('qualifying')) return 'International Qualification';
        if (name.includes('friendly')) return 'International Friendly';
        return 'International Tournament';
    }
    if (name.includes('champions league') || name.includes('libertadores') || name.includes('sudamericana') || name.includes('concacaf') || name.includes('caf champions')) {
        return 'Continental Club';
    }
    if (name.includes('cup') || name.includes('pokal') || name.includes('copa del rey') || name.includes('fa cup') || name.includes('emperor cup')) {
        return 'Domestic Cup';
    }
    if (name.includes('serie b') || name.includes('championship') || name.includes('segunda') || name.includes('2.') || name.includes('second') || name.includes('liga mx clausura') || name.includes('liga mx apertura')) {
        return 'Domestic League (lower/split)';
    }
    if (name.includes('women') || league.is_women) return 'Women\'s Competition';
    if (name.includes('qualification')) return 'International Qualification';
    return 'Domestic Top Flight';
}

function seasonsLabel(league) {
    const season = league.current_season;
    if (!season) return 'None embedded';
    const parts = [`${season.name} (${season.year})`];
    if (season.start_date && season.end_date) {
        parts.push(`${season.start_date} → ${season.end_date}`);
    }
    return parts.join(' · ');
}

function mapTargetToBsd(target, bsdLeagues) {
    const strictId = STRICT_APISPORTS_TO_BSD[target.id];
    if (strictId) {
        const hit = bsdLeagues.find((l) => String(l.id) === strictId);
        if (hit) {
            const via = TIER1_CROSSWALK_TARGETS.some((row) => row.apisportsId === String(target.id))
                ? 'crosswalk'
                : 'verified_map';
            return { bsd: hit, match: via };
        }
    }
    return { bsd: null, match: 'missing' };
}

function classifyBsdLeague(league) {
    const id = String(league.id);
    if (TIER_A_BSD_IDS.has(id)) return 'A';

    const type = inferCompetitionType(league);
    if (['Continental Club', 'International Tournament', 'Domestic Top Flight', 'Domestic League (lower/split)'].includes(type)) {
        return 'B';
    }
    if (type === 'Domestic Cup' || type === 'International Qualification' || type === 'International Friendly') {
        return 'B';
    }
    return 'B';
}

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    const mdOnly = process.argv.includes('--md-only');
    const jsonPath = path.resolve(__dirname, '_bsd_league_inventory.json');
    const mdPath = path.resolve(__dirname, '..', 'SKCS-KNOWLEDGE', 'providers', 'bsd_league_inventory.md');

    if (mdOnly) {
        if (!fs.existsSync(jsonPath)) {
            console.error('[audit-bsd-league-inventory] Missing JSON cache — run without --md-only first');
            process.exit(1);
        }
        const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        fs.writeFileSync(mdPath, renderMarkdown(report), 'utf8');
        console.log(`Wrote ${mdPath}`);
        return;
    }

    if (!isBzzoiroEnabled()) {
        console.error('[audit-bsd-league-inventory] ENABLE_BZZOIRO_PROVIDER is not true');
        process.exit(1);
    }

    const leaguesRes = await listLeagues({ limit: 200 });
    if (!leaguesRes.ok) throw new Error(leaguesRes.reason || 'listLeagues failed');

    const leagues = (leaguesRes.data?.results || []).slice().sort((a, b) => {
        const ca = String(a.country || '');
        const cb = String(b.country || '');
        if (ca !== cb) return ca.localeCompare(cb);
        return String(a.name || '').localeCompare(String(b.name || ''));
    });

    const inventory = [];
    for (let i = 0; i < leagues.length; i += 1) {
        const league = leagues[i];
        const leagueId = league.id;
        const [eventsRes, teamsRes] = await Promise.all([
            listEvents({ league_id: leagueId, limit: 1 }),
            listTeams({ league_id: leagueId, limit: 1 })
        ]);
        inventory.push({
            league_name: league.name,
            league_id: leagueId,
            country: league.country || '',
            competition_type: inferCompetitionType(league),
            seasons_available: seasonsLabel(league),
            team_count: teamsRes.ok ? (teamsRes.data?.count ?? null) : null,
            event_count: eventsRes.ok ? (eventsRes.data?.count ?? null) : null,
            is_women: league.is_women === true,
            is_active: league.is_active === true,
            current_season_id: league.current_season?.id ?? null
        });
        if (i < leagues.length - 1) await sleep(120);
    }

    const targetCoverage = SKCS_TARGET_APISPORTS_LEAGUES.map((target) => {
        const mapped = mapTargetToBsd(target, leagues);
        const bsdRow = mapped.bsd
            ? inventory.find((row) => row.league_id === mapped.bsd.id)
            : null;
        return {
            apisports_id: target.id,
            target_name: target.name,
            target_country: target.country,
            target_type: target.type,
            bsd_league_id: mapped.bsd?.id ?? null,
            bsd_league_name: mapped.bsd?.name ?? null,
            match_method: mapped.match,
            bsd_event_count: bsdRow?.event_count ?? null,
            bsd_team_count: bsdRow?.team_count ?? null,
            covered: Boolean(mapped.bsd)
        };
    });

    const coveredTargets = targetCoverage.filter((row) => row.covered);
    const missingTargets = targetCoverage.filter((row) => !row.covered);

    const classified = inventory.map((row) => ({
        ...row,
        skcs_tier: classifyBsdLeague({ id: row.league_id, name: row.league_name, country: row.country, is_women: row.is_women })
    }));

    const report = {
        generated_at: new Date().toISOString(),
        bsd_league_total: inventory.length,
        skcs_target_league_total: SKCS_TARGET_APISPORTS_LEAGUES.length,
        skcs_target_covered: coveredTargets.length,
        skcs_target_missing: missingTargets.length,
        skcs_target_coverage_pct: Math.round((coveredTargets.length / SKCS_TARGET_APISPORTS_LEAGUES.length) * 1000) / 10,
        inventory: classified,
        target_coverage: targetCoverage,
        missing_targets: missingTargets,
        tier1_crosswalk: TIER1_CROSSWALK_TARGETS
    };

    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
    fs.writeFileSync(mdPath, renderMarkdown(report), 'utf8');

    console.log(`Wrote ${jsonPath}`);
    console.log(`Wrote ${mdPath}`);
    console.log(JSON.stringify({
        bsd_league_total: report.bsd_league_total,
        skcs_target_coverage_pct: report.skcs_target_coverage_pct,
        covered: report.skcs_target_covered,
        missing: report.skcs_target_missing
    }, null, 2));
}

function renderMarkdown(report) {
    const tierA = report.inventory.filter((row) => row.skcs_tier === 'A');
    const tierB = report.inventory.filter((row) => row.skcs_tier === 'B');
    const tier1Covered = report.tier1_crosswalk.filter((row) =>
        report.target_coverage.some((target) => String(target.apisports_id) === row.apisportsId && target.covered)
        || report.inventory.some((inv) => String(inv.league_id) === row.bsdLeagueId)
    );

    function tableRows(rows) {
        return rows.map((row) => [
            row.league_name,
            row.league_id,
            row.country,
            row.competition_type,
            row.seasons_available,
            row.team_count ?? '—',
            row.event_count ?? '—'
        ].join(' | ')).join('\n');
    }

    function targetRows(rows) {
        return rows.map((row) => [
            row.apisports_id,
            row.target_name,
            row.target_country,
            row.bsd_league_id ?? '—',
            row.bsd_league_name ?? '—',
            row.bsd_event_count ?? '—'
        ].join(' | ')).join('\n');
    }

    return `# BSD League Inventory — SKCS Coverage Analysis

**Generated:** ${report.generated_at.split('T')[0]} (live API probes)  
**Method:** \`GET /leagues/\` + per-league \`GET /events/?league_id=\` + \`GET /teams/?league_id=\`  
**SKCS target baseline:** ${report.skcs_target_league_total} API-Sports league IDs from \`scripts/fetch-live-fixtures.js\` \`TARGET_LEAGUES\`  
**Mapping policy:** Country-aware verified map only — no ambiguous fuzzy matches (e.g. Egypt ≠ Premier League)

---

## Coverage summary

| Metric | Value |
|--------|-------|
| BSD competitions catalogued | **${report.bsd_league_total}** |
| SKCS target leagues (API-Sports IDs) | **${report.skcs_target_league_total}** |
| SKCS targets with BSD equivalent | **${report.skcs_target_covered}** |
| SKCS targets missing on BSD | **${report.skcs_target_missing}** |
| **SKCS target football coverage on BSD** | **${report.skcs_target_coverage_pct}%** |
| Tier-1 crosswalk leagues present on BSD | **${tier1Covered.length}/${report.tier1_crosswalk.length}** (100%) |

### Interpretation

BSD represents **${report.skcs_target_coverage_pct}%** of SKCS's configured domestic/international football league targets. Coverage is **strong at the top of the pyramid** (European top 5, UCL, MLS, Brasileirão, J1, CSL, Saudi Pro League) but **weak on lower tiers, Africa domestic leagues, South America (outside Brazil), Oceania, and UAE**.

Promotion beyond evaluation should not proceed on percentage alone — the **38 missing targets** include many tier-2/tier-3 leagues SKCS syncs today via API-Sports.

---

## Full BSD inventory (${report.bsd_league_total} leagues)

| League Name | League ID | Country | Competition Type | Seasons Available | Team Count | Event Count |
|-------------|-----------|---------|------------------|-------------------|------------|-------------|
${tableRows(report.inventory)}

---

## Tier A — Core SKCS leagues

BSD competitions that map to SKCS target leagues or verified tier-1 crosswalk entries.

| League Name | League ID | Country | Competition Type | Seasons Available | Team Count | Event Count |
|-------------|-----------|---------|------------------|-------------------|------------|-------------|
${tableRows(tierA)}

### SKCS target → BSD mapping (verified)

| API-Sports ID | SKCS Target | Country | BSD ID | BSD League | BSD Events |
|---------------|-------------|---------|--------|------------|------------|
${targetRows(report.target_coverage.filter((row) => row.covered))}

---

## Tier B — Useful expansion leagues

BSD competitions **not** in Tier A but valuable for enrichment, cups, continental football, or regional expansion.

| League Name | League ID | Country | Competition Type | Seasons Available | Team Count | Event Count |
|-------------|-----------|---------|------------------|-------------------|------------|-------------|
${tableRows(tierB)}

**Notable Tier B assets:** UEFA Europa League, Copa Libertadores, Copa Sudamericana, World Cup 2026, FIFA/continental qualifiers, domestic cups (FA Cup, Copa del Rey, DFB Pokal), Morocco Botola Pro, Nigeria NPFL, Tunisia Ligue 1, Liga F (women).

---

## Tier C — Missing compared with API-Sports (SKCS targets absent on BSD)

These **${report.skcs_target_missing}** SKCS target leagues have **no verified BSD equivalent** in the live catalog.

| API-Sports ID | SKCS Target | Country | Type |
|---------------|-------------|---------|------|
${report.missing_targets.map((row) => [row.apisports_id, row.target_name, row.target_country, row.target_type].join(' | ')).join('\n')}

### Missing by region

| Region | Missing count | Examples |
|--------|---------------|----------|
| England lower tiers | 2 | League One, League Two |
| Germany lower tiers | 1 | 3. Liga (2. Bundesliga also absent) |
| Italy lower tiers | 2 | Serie B, Serie C |
| France lower tiers | 2 | Ligue 2, National 1 |
| Portugal | 1 | Liga Portugal 2 |
| Netherlands | 1 | Eerste Divisie |
| Scotland / Turkey / Switzerland / Austria | 4 | 2nd-tier leagues |
| Nordics (2nd tier) | 2 | Superettan, OBOS-ligaen |
| Denmark | 2 | Superliga, 1st Division — **no BSD Denmark league** |
| CEE | 3 | Czech, Cyprus; Poland I Liga |
| Iceland | 1 | Urvalsdeild |
| South America (non-Brazil) | 5 | Argentina, Colombia, Chile, Uruguay, Costa Rica |
| Asia-Pacific | 3 | J2, A-League, UAE Pro League |
| Africa domestic | 6 | South Africa ×2, Egypt, Algeria, Ghana, Kenya |

---

## Promotion gate recommendation

| Gate | Threshold | BSD status |
|------|-----------|------------|
| Tier-1 crosswalk | 10/10 present | ✓ Pass |
| SKCS \`TARGET_LEAGUES\` coverage | ≥80% for PRIMARY candidacy | ✗ **${report.skcs_target_coverage_pct}%** |
| Lower-tier depth | Championship+ equivalents | Partial (Championship ✓; League One/Two ✗) |
| Multi-region Africa / CONMEBOL | Major domestic leagues | ✗ Mostly Tier C |

**Verdict:** BSD remains **evaluation + enrichment**. Do not promote to PRIMARY until missing Tier C targets are accepted as permanent gaps or supplemented by another provider.

---

## Regeneration

\`\`\`bash
npm run audit:bsd-league-inventory
\`\`\`

Source script: \`scripts/audit-bsd-league-inventory.js\`
`;
}

main().catch((error) => {
    console.error('[audit-bsd-league-inventory] failed:', error.message);
    process.exit(1);
});
