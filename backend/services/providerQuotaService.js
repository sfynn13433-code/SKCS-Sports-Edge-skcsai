'use strict';

const { query, withTransaction } = require('../database');

function truncateToUtc(date, unit) {
  const d = new Date(date);
  if (unit === 'day') {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  }
  if (unit === 'minute') {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), 0, 0));
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), 0));
}

async function ensureRow(client, provider, windowType, windowStart) {
  const res = await client.query(
    `INSERT INTO rapidapi_quota_usage (provider_name, window_type, window_start, usage_count, updated_at)
     VALUES ($1, $2, $3, 0, NOW())
     ON CONFLICT (provider_name, window_type, window_start) DO NOTHING`,
    [provider, windowType, windowStart]
  );
  return res.rowCount >= 0;
}

async function tryIncrement(client, provider, windowType, windowStart, limit) {
  const upd = await client.query(
    `UPDATE rapidapi_quota_usage
     SET usage_count = usage_count + 1, updated_at = NOW()
     WHERE provider_name = $1 AND window_type = $2 AND window_start = $3 AND usage_count < $4
     RETURNING usage_count`,
    [provider, windowType, windowStart, limit]
  );
  if (upd.rowCount > 0) {
    return { allowed: true, count: Number(upd.rows[0].usage_count || 0) };
  }
  const sel = await client.query(
    `SELECT usage_count FROM rapidapi_quota_usage WHERE provider_name = $1 AND window_type = $2 AND window_start = $3`,
    [provider, windowType, windowStart]
  );
  const current = Number(sel.rows?.[0]?.usage_count || 0);
  return { allowed: current < limit, count: current };
}

async function consumeQuota(providerName, { perMinuteLimit = null, dailyLimit = null } = {}) {
  const provider = String(providerName || '').trim();
  if (!provider) return { allowed: true };

  return withTransaction(async (client) => {
    const now = new Date();
    if (perMinuteLimit && Number.isFinite(perMinuteLimit) && perMinuteLimit > 0) {
      const minuteStart = truncateToUtc(now, 'minute');
      await ensureRow(client, provider, 'minute', minuteStart.toISOString());
      const r = await tryIncrement(client, provider, 'minute', minuteStart.toISOString(), perMinuteLimit);
      if (!r.allowed) return { allowed: false, scope: 'minute', limit: perMinuteLimit, used: r.count };
    }

    if (dailyLimit && Number.isFinite(dailyLimit) && dailyLimit > 0) {
      const dayStart = truncateToUtc(now, 'day');
      await ensureRow(client, provider, 'day', dayStart.toISOString());
      const r = await tryIncrement(client, provider, 'day', dayStart.toISOString(), dailyLimit);
      if (!r.allowed) return { allowed: false, scope: 'day', limit: dailyLimit, used: r.count };
    }

    return { allowed: true };
  });
}

module.exports = {
  consumeQuota
};
