'use strict';

const axios = require('axios');
const config = require('../config');
const { query } = require('../db');
const { normalizeTier1Sport } = require('./tier1SchemaProfile');

const THESPORTSDB_BASE_URL = 'https://www.thesportsdb.com/api/v1/json';
const TIER1_HTTP_DELAY_MS = Math.max(2400, Number(process.env.TIER1_HTTP_DELAY_MS || 2400));
const MAX_TEAMS_PER_LEAGUE = Math.max(1, Math.min(40, Number(process.env.TIER1_MAX_TEAMS_PER_LEAGUE || 10)));
const MAX_PLAYERS_PER_TEAM = Math.max(1, Math.min(50, Number(process.env.TIER1_MAX_PLAYERS_PER_TEAM || 8)));
const TIER1_REDIS_QUEUE_KEY = String(process.env.TIER1_REDIS_QUEUE_KEY || 'skcs:tier1:priority:queue').trim();

const SPORT_PRIORITY = Object.freeze({
    Football: 100,
    Basketball: 90,
    Rugby: 80,
    MMA: 70
});

const DISCOVERY_COUNTRIES = Object.freeze(['World', 'USA']);
const TARGET_SPORTS = new Set(['Soccer', 'Basketball', 'Rugby', 'Fighting']);
const TARGET_PROMOTIONS = ['ufc', 'pfl', 'bellator'];

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function appendVariant(url, variant) {
    const value = String(url || '').trim();
    if (!value) return null;
    if (value.endsWith(`/${variant}`)) return value;
    return `${value}/${variant}`;
}

function canonicalSportFromTheSportsDb(strSport, leagueName) {
    const sport = String(strSport || '').trim();
    if (sport === 'Soccer') return 'football';
    if (sport === 'Basketball') return 'basketball';
    if (sport === 'Rugby') return 'rugby';
    if (sport === 'Fighting') {
        const name = String(leagueName || '').toLowerCase();
        if (TARGET_PROMOTIONS.some((promo) => name.includes(promo))) return 'mma';
    }
    return '';
}

class Tier1PriorityQueue {
    constructor(options = {}) {
        this.items = [];
        this.redis = options.redis || null;
        this.queueKey = options.queueKey || TIER1_REDIS_QUEUE_KEY;
        this.sequence = 0;
    }

    async enqueue(item) {
        if (!item || !item.sport) return;
        const normalizedSport = normalizeTier1Sport(item.sport);
        const weight = Number(item.priority || SPORT_PRIORITY[normalizedSport] || 0);
        const payload = {
            ...item,
            sport: normalizedSport,
            priority: weight,
            enqueuedAt: Date.now()
        };
        if (this.redis) {
            this.sequence += 1;
            const score = (weight * 1_000_000) - this.sequence;
            await this.redis.zAdd(this.queueKey, [{
                score,
                value: JSON.stringify(payload)
            }]);
            return;
        }
        this.items.push(payload);
    }

    async drainSorted() {
        if (this.redis) {
            const rows = await this.redis.zRange(this.queueKey, 0, -1, { REV: true });
            await this.redis.del(this.queueKey);
            return rows
                .map((raw) => {
                    try {
                        return JSON.parse(raw);
                    } catch {
                        return null;
                    }
                })
                .filter(Boolean);
        }
        return this.items
            .slice()
            .sort((a, b) => {
                if (b.priority !== a.priority) return b.priority - a.priority;
                return a.enqueuedAt - b.enqueuedAt;
            });
    }
}

async function createRedisClientIfEnabled() {
    const redisUrl = String(process.env.REDIS_URL || '').trim();
    if (!redisUrl) return null;
    try {
        // Lazy require keeps this additive if redis is not configured.
        const { createClient } = require('redis');
        const client = createClient({ url: redisUrl });
        client.on('error', (err) => {
            console.warn('[tier1-bootstrap] redis error:', err.message);
        });
        await client.connect();
        return client;
    } catch (error) {
        console.warn('[tier1-bootstrap] redis unavailable; falling back to in-memory queue:', error.message);
        return null;
    }
}

class ThrottledSportsDbClient {
    constructor(sportsDbKey, delayMs = TIER1_HTTP_DELAY_MS) {
        this.api = axios.create({
            baseURL: THESPORTSDB_BASE_URL,
            timeout: 20000
        });
        this.sportsDbKey = sportsDbKey;
        this.delayMs = Math.max(0, Number(delayMs) || 0);
        this.lastCallAt = 0;
    }

    async request(endpoint, params = {}) {
        const now = Date.now();
        const elapsed = now - this.lastCallAt;
        if (elapsed < this.delayMs) {
            await sleep(this.delayMs - elapsed);
        }
        this.lastCallAt = Date.now();
        const response = await this.api.get(`/${this.sportsDbKey}/${endpoint}`, { params });
        return response?.data || {};
    }
}

async function discoverLeagues(client, countries = DISCOVERY_COUNTRIES) {
    const collected = [];
    for (const country of countries) {
        const payload = await client.request('search_all_leagues.php', { c: country });
        const leagues = Array.isArray(payload?.countrys) ? payload.countrys : [];
        for (const league of leagues) {
            const strSport = String(league?.strSport || '').trim();
            if (!TARGET_SPORTS.has(strSport)) continue;
            const canonicalSport = canonicalSportFromTheSportsDb(strSport, league?.strLeague);
            if (!canonicalSport) continue;
            collected.push({
                idLeague: String(league?.idLeague || '').trim(),
                strLeague: String(league?.strLeague || '').trim() || null,
                strSport,
                canonicalSport,
                strCountry: String(league?.strCountry || country).trim() || country
            });
        }
    }
    const deduped = [];
    const seen = new Set();
    for (const row of collected) {
        if (!row.idLeague) continue;
        if (seen.has(row.idLeague)) continue;
        seen.add(row.idLeague);
        deduped.push(row);
    }
    return deduped;
}

async function hydrateLeagueEntities(client, league) {
    const teamsPayload = await client.request('lookup_all_teams.php', { id: league.idLeague });
    const teams = Array.isArray(teamsPayload?.teams) ? teamsPayload.teams : [];
    const hydratedTeams = [];
    const hydratedPlayers = [];

    for (const team of teams.slice(0, MAX_TEAMS_PER_LEAGUE)) {
        const teamId = String(team?.idTeam || '').trim();
        if (!teamId) continue;

        const teamDetail = await client.request('lookupteam.php', { id: teamId });
        const teamRow = Array.isArray(teamDetail?.teams) ? teamDetail.teams[0] : null;
        const finalTeam = teamRow || team;
        hydratedTeams.push({
            idTeam: String(finalTeam?.idTeam || teamId),
            team_name: finalTeam?.strTeam || team?.strTeam || null,
            team_badge: appendVariant(finalTeam?.strTeamBadge || team?.strTeamBadge || null, 'tiny'),
            league_id: league.idLeague,
            sport: league.canonicalSport
        });

        const playersPayload = await client.request('lookup_all_players.php', { id: teamId });
        const players = Array.isArray(playersPayload?.player) ? playersPayload.player : [];

        for (const player of players.slice(0, MAX_PLAYERS_PER_TEAM)) {
            const playerId = String(player?.idPlayer || '').trim();
            if (!playerId) continue;
            const playerDetail = await client.request('lookupplayer.php', { id: playerId });
            const playerRow = Array.isArray(playerDetail?.players) ? playerDetail.players[0] : null;
            const finalPlayer = playerRow || player;
            hydratedPlayers.push({
                idPlayer: String(finalPlayer?.idPlayer || playerId),
                player_name: finalPlayer?.strPlayer || player?.strPlayer || null,
                player_cutout: appendVariant(finalPlayer?.strCutout || finalPlayer?.strPlayerCutout || player?.strCutout || null, 'preview'),
                team_id: teamId,
                league_id: league.idLeague,
                sport: league.canonicalSport
            });
        }
    }

    return {
        league,
        teams: hydratedTeams,
        players: hydratedPlayers
    };
}

async function cacheTier1Payload(cacheKey, payload, providerName = 'the-sports-db') {
    await query(`
        INSERT INTO rapidapi_cache (cache_key, provider_name, payload, updated_at)
        VALUES ($1, $2, $3::jsonb, NOW())
        ON CONFLICT (cache_key) DO UPDATE SET
            provider_name = EXCLUDED.provider_name,
            payload = EXCLUDED.payload,
            updated_at = NOW()
    `, [cacheKey, providerName, JSON.stringify(payload || {})]);
}

function groupLeaguesBySport(leagues) {
    const out = new Map();
    for (const league of Array.isArray(leagues) ? leagues : []) {
        const sport = normalizeTier1Sport(league?.canonicalSport);
        if (!SPORT_PRIORITY[sport]) continue;
        if (!out.has(sport)) out.set(sport, []);
        out.get(sport).push(league);
    }
    return out;
}

async function runTier1Stage1Bootstrap(options = {}) {
    const sportsDbKey = String(config.theSportsDbKey || '').trim();
    if (!sportsDbKey) {
        throw new Error('TheSportsDB key is missing (THESPORTSDB_KEY or SPORTS_DB_KEY)');
    }

    const delayMs = Math.max(2400, Number(options.delayMs || TIER1_HTTP_DELAY_MS));
    const countries = Array.isArray(options.countries) && options.countries.length
        ? options.countries
        : DISCOVERY_COUNTRIES;
    const client = new ThrottledSportsDbClient(sportsDbKey, delayMs);

    const discovered = await discoverLeagues(client, countries);
    const leaguesBySport = groupLeaguesBySport(discovered);

    const redisClient = await createRedisClientIfEnabled();
    const queue = new Tier1PriorityQueue({ redis: redisClient, queueKey: TIER1_REDIS_QUEUE_KEY });
    for (const [sport, leagues] of leaguesBySport.entries()) {
        await queue.enqueue({
            sport,
            priority: SPORT_PRIORITY[sport],
            leagues
        });
    }

    const orderedJobs = await queue.drainSorted();
    if (redisClient) {
        await redisClient.quit().catch(() => {});
    }
    const hydrationResults = [];

    for (const job of orderedJobs) {
        const sportLeagues = Array.isArray(job.leagues) ? job.leagues : [];
        const sportResult = {
            sport: job.sport,
            priority: job.priority,
            leagues_discovered: sportLeagues.length,
            leagues_hydrated: 0,
            teams_hydrated: 0,
            players_hydrated: 0,
            leagues: []
        };

        for (const league of sportLeagues) {
            const hydrated = await hydrateLeagueEntities(client, league);
            sportResult.leagues_hydrated += 1;
            sportResult.teams_hydrated += hydrated.teams.length;
            sportResult.players_hydrated += hydrated.players.length;
            sportResult.leagues.push({
                league: hydrated.league,
                teams: hydrated.teams,
                players: hydrated.players
            });
        }

        hydrationResults.push(sportResult);
    }

    const payload = {
        generated_at: new Date().toISOString(),
        countries,
        queue_priority: SPORT_PRIORITY,
        throttle_ms: delayMs,
        results: hydrationResults
    };

    await cacheTier1Payload('tier1_stage1_entities', payload, 'the-sports-db');
    await cacheTier1Payload(`tier1_stage1_entities_${new Date().toISOString().slice(0, 10)}`, payload, 'the-sports-db');

    return payload;
}

async function saveProvisioningPayload(namespace, key, payload) {
    const safeNamespace = String(namespace || '').trim().toLowerCase();
    const safeKey = String(key || '').trim();
    if (!safeNamespace || !safeKey) {
        throw new Error('namespace and key are required');
    }
    const cacheKey = `tier1_provisioning_${safeNamespace}_${safeKey}`;
    await cacheTier1Payload(cacheKey, {
        generated_at: new Date().toISOString(),
        namespace: safeNamespace,
        key: safeKey,
        payload: payload && typeof payload === 'object' ? payload : {}
    }, 'tier1-provisioning');
    return { cacheKey };
}

module.exports = {
    SPORT_PRIORITY,
    TIER1_HTTP_DELAY_MS,
    runTier1Stage1Bootstrap,
    saveProvisioningPayload
};
