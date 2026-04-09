'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_HISTORY_ITEMS = 40;
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

const systemInstruction = `
You are EdgeMind BOT, an elite sports analysis AI integrated into the SKCS prediction platform.
Your primary user is Stephen. Use a professional, analytical, and conversational tone.
You can greet naturally (example: "Hi Stephen, how are you today?").

Rules:
1. Provide data-driven sports reasoning and matchup analysis.
2. Preserve context of teams, competitions, and discussion threads.
3. Format responses clearly for a compact sidebar UI.
4. If the user asks for certainty, provide probabilities and risk framing instead of guarantees.
5. If internal prediction context is unavailable, state that briefly and continue with best-effort analysis.
`;

const sessionMemory = new Map();
let cachedSupabase = null;

function cleanupExpiredSessions() {
    const now = Date.now();
    for (const [sessionId, payload] of sessionMemory.entries()) {
        if (!payload || !payload.updatedAt || now - payload.updatedAt > SESSION_TTL_MS) {
            sessionMemory.delete(sessionId);
        }
    }
}

function normalizeRole(role) {
    const value = String(role || '').toLowerCase();
    if (value === 'assistant' || value === 'bot' || value === 'model') {
        return 'model';
    }
    return 'user';
}

function normalizeHistory(history) {
    if (!Array.isArray(history)) return [];

    return history
        .map((entry) => {
            const text = String(
                entry && typeof entry === 'object'
                    ? (entry.content ?? entry.text ?? '')
                    : ''
            ).trim();
            if (!text) return null;

            return {
                role: normalizeRole(entry.role),
                parts: [{ text }]
            };
        })
        .filter(Boolean)
        .slice(-MAX_HISTORY_ITEMS);
}

function extractSessionId(req) {
    const explicit = String(req.body?.sessionId || req.headers['x-session-id'] || '').trim();
    if (explicit) return explicit;

    const keyPart = String(req.headers['x-api-key'] || 'anonymous').trim();
    const ipPart = String(req.ip || req.headers['x-forwarded-for'] || 'unknown').trim();
    return `${keyPart}:${ipPart}`;
}

function getStoredSessionHistory(sessionId) {
    const hit = sessionMemory.get(sessionId);
    if (!hit) return [];

    const now = Date.now();
    if (now - hit.updatedAt > SESSION_TTL_MS) {
        sessionMemory.delete(sessionId);
        return [];
    }

    return Array.isArray(hit.history) ? hit.history.slice(-MAX_HISTORY_ITEMS) : [];
}

function storeSessionHistory(sessionId, history) {
    sessionMemory.set(sessionId, {
        updatedAt: Date.now(),
        history: history.slice(-MAX_HISTORY_ITEMS)
    });
}

function getSupabase() {
    if (cachedSupabase) return cachedSupabase;

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;

    cachedSupabase = createClient(url, key);
    return cachedSupabase;
}

function sanitize(value, fallback = 'Unknown') {
    const text = String(value ?? '').trim();
    return text.length ? text : fallback;
}

async function buildPredictionContext(message) {
    const supabase = getSupabase();
    if (!supabase) return '';

    const { data, error } = await supabase
        .from('predictions_final')
        .select('type, total_confidence, risk_level, matches, created_at')
        .order('created_at', { ascending: false })
        .limit(40);

    if (error || !Array.isArray(data) || !data.length) {
        return '';
    }

    const normalizedQuery = String(message || '').toLowerCase();
    const flattened = [];

    for (const row of data) {
        if (!Array.isArray(row.matches)) continue;

        for (const match of row.matches) {
            flattened.push({
                home: sanitize(match?.metadata?.home_team || match?.home_team),
                away: sanitize(match?.metadata?.away_team || match?.away_team),
                sport: sanitize(match?.sport, 'football'),
                prediction: sanitize(match?.prediction, 'n/a'),
                market: sanitize(match?.market, 'n/a'),
                confidence: Number(row.total_confidence || 0),
                risk: sanitize(row.risk_level, 'n/a'),
                type: sanitize(row.type, 'single')
            });
        }
    }

    if (!flattened.length) return '';

    const relevant = flattened.filter((match) => {
        if (!normalizedQuery) return false;
        return (
            normalizedQuery.includes(match.home.toLowerCase()) ||
            normalizedQuery.includes(match.away.toLowerCase()) ||
            normalizedQuery.includes(match.sport.toLowerCase())
        );
    });

    const picked = (relevant.length ? relevant : flattened).slice(0, 12);
    const lines = picked.map((m, idx) => (
        `${idx + 1}. ${m.home} vs ${m.away} (${m.sport}) | pick=${m.prediction} | market=${m.market} | confidence=${m.confidence}% | risk=${m.risk} | type=${m.type}`
    ));

    return [
        'Internal SKCS prediction context (recent records):',
        ...lines
    ].join('\n');
}

async function generateBotResponse(req, res) {
    cleanupExpiredSessions();

    const message = String(req.body?.message || '').trim();
    const userName = String(req.body?.userName || 'Stephen').trim() || 'Stephen';

    if (!message) {
        return res.status(400).json({
            success: false,
            error: 'Message is required.'
        });
    }

    if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({
            success: false,
            error: 'EdgeMind is not configured. GEMINI_API_KEY is missing.'
        });
    }

    const sessionId = extractSessionId(req);
    const providedHistory = normalizeHistory(req.body?.chatHistory);
    const storedHistory = getStoredSessionHistory(sessionId);
    const history = (providedHistory.length ? providedHistory : storedHistory).slice(-MAX_HISTORY_ITEMS);

    try {
        const predictionContext = await buildPredictionContext(message);
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            systemInstruction
        });

        const chat = model.startChat({
            history,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1000
            }
        });

        const composedMessage = [
            `Primary user: ${userName}`,
            predictionContext ? predictionContext : '',
            `User message: ${message}`
        ].filter(Boolean).join('\n\n');

        const result = await chat.sendMessage(composedMessage);
        const reply = String(result?.response?.text?.() || '').trim()
            || 'I could not generate a response right now. Please try again.';

        const nextHistory = [
            ...history,
            { role: 'user', parts: [{ text: message }] },
            { role: 'model', parts: [{ text: reply }] }
        ].slice(-MAX_HISTORY_ITEMS);
        storeSessionHistory(sessionId, nextHistory);

        return res.status(200).json({
            success: true,
            reply,
            response: reply,
            sessionId
        });
    } catch (error) {
        console.error('[edgemind] Gemini error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to communicate with EdgeMind Core.'
        });
    }
}

module.exports = {
    generateBotResponse
};
