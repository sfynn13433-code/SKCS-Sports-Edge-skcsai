-- =========================================================
-- SKCS Semantic Violation Summary RPC
-- Returns aggregated drift facts for the control plane.
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_semantic_violation_summary(
    since_ts timestamptz,
    pipeline_filter text DEFAULT NULL,
    provider_filter text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    result jsonb;
BEGIN
    WITH base AS (
        SELECT
            occurred_at,
            pipeline,
            violation_type,
            severity,
            rule_id,
            field_path,
            raw_value,
            context,
            game_id,
            message
        FROM public.semantic_violations
        WHERE occurred_at >= since_ts
          AND (pipeline_filter IS NULL OR pipeline = pipeline_filter)
          AND (
                provider_filter IS NULL
                OR COALESCE(context->>'provider', pipeline, '') = provider_filter
          )
    ),
    total_stats AS (
        SELECT COUNT(*)::integer AS total_violations
        FROM base
    ),
    severity_counts AS (
        SELECT LOWER(severity) AS severity, COUNT(*)::integer AS count
        FROM base
        GROUP BY 1
    ),
    type_counts AS (
        SELECT violation_type, COUNT(*)::integer AS count
        FROM base
        GROUP BY 1
    ),
    hourly_counts AS (
        SELECT date_trunc('hour', occurred_at) AS bucket_hour, COUNT(*)::integer AS count
        FROM base
        GROUP BY 1
    ),
    hourly_series AS (
        SELECT generate_series(
            date_trunc('hour', GREATEST(since_ts, now() - interval '24 hours')),
            date_trunc('hour', now()),
            interval '1 hour'
        ) AS bucket_hour
    ),
    drift_velocity AS (
        SELECT COALESCE(
            jsonb_agg(COALESCE(hourly_counts.count, 0) ORDER BY hourly_series.bucket_hour),
            '[]'::jsonb
        ) AS per_hour_last_24h
        FROM hourly_series
        LEFT JOIN hourly_counts USING (bucket_hour)
    ),
    window_split AS (
        SELECT
            COUNT(*) FILTER (WHERE occurred_at < since_ts + ((now() - since_ts) / 2))::integer AS earlier_half,
            COUNT(*) FILTER (WHERE occurred_at >= since_ts + ((now() - since_ts) / 2))::integer AS later_half
        FROM base
    ),
    rule_failure_heatmap AS (
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'rule_id', rule_id,
                    'field_path', field_path,
                    'count', count,
                    'pct_of_total', CASE
                        WHEN total_stats.total_violations = 0 THEN 0
                        ELSE ROUND((count::numeric / total_stats.total_violations::numeric) * 100, 2)
                    END
                )
                ORDER BY count DESC, rule_id, field_path
            ),
            '[]'::jsonb
        ) AS items
        FROM (
            SELECT rule_id, field_path, COUNT(*)::integer AS count
            FROM base
            GROUP BY rule_id, field_path
        ) ranked
        CROSS JOIN total_stats
    ),
    provider_drift AS (
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'provider', provider,
                    'new_field_intrusions', COALESCE(new_field_intrusions, '[]'::jsonb),
                    'missing_canonical_ids', missing_canonical_ids,
                    'last_intrusion_at', last_intrusion_at
                )
                ORDER BY missing_canonical_ids DESC, provider
            ),
            '[]'::jsonb
        ) AS items
        FROM (
            SELECT
                COALESCE(NULLIF(context->>'provider', ''), pipeline, 'unknown') AS provider,
                COALESCE((
                    SELECT jsonb_agg(field_name ORDER BY field_name)
                    FROM (
                        SELECT DISTINCT NULLIF(raw_value->>'field_name', '') AS field_name
                    ) field_names
                    WHERE field_name IS NOT NULL
                ), '[]'::jsonb) AS new_field_intrusions,
                COUNT(*) FILTER (WHERE violation_type = 'MISSING_CANONICAL_ID')::integer AS missing_canonical_ids,
                MAX(occurred_at) FILTER (
                    WHERE violation_type IN ('UNKNOWN_FIELD', 'MISSING_CANONICAL_ID')
                ) AS last_intrusion_at
            FROM base
            GROUP BY 1
        ) provider_rows
    ),
    recent_criticals AS (
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'occurred_at', occurred_at,
                    'pipeline', pipeline,
                    'violation_type', violation_type,
                    'severity', severity,
                    'rule_id', rule_id,
                    'field_path', field_path,
                    'message', message,
                    'context', context
                )
                ORDER BY occurred_at DESC
            ),
            '[]'::jsonb
        ) AS items
        FROM (
            SELECT occurred_at, pipeline, violation_type, severity, rule_id, field_path, message, context
            FROM base
            WHERE LOWER(severity) IN ('critical', 'blocked')
            ORDER BY occurred_at DESC
            LIMIT 10
        ) critical_rows
    )
    SELECT jsonb_build_object(
        'window', jsonb_build_object(
            'from', since_ts,
            'to', now()
        ),
        'pipeline', COALESCE(pipeline_filter, (
            SELECT pipeline
            FROM base
            GROUP BY pipeline
            ORDER BY COUNT(*) DESC, pipeline
            LIMIT 1
        ), 'unknown'),
        'provider', COALESCE(provider_filter, (
            SELECT COALESCE(NULLIF(context->>'provider', ''), pipeline, 'unknown')
            FROM base
            GROUP BY 1
            ORDER BY COUNT(*) DESC, 1
            LIMIT 1
        ), NULL),
        'total_violations', COALESCE((SELECT total_violations FROM total_stats), 0),
        'critical_violations', COALESCE((SELECT count FROM severity_counts WHERE severity = 'critical'), 0),
        'warning_violations', COALESCE((SELECT count FROM severity_counts WHERE severity = 'warning'), 0),
        'blocked_violations', COALESCE((SELECT count FROM severity_counts WHERE severity = 'blocked'), 0),
        'by_severity', COALESCE((
            SELECT jsonb_object_agg(severity, count)
            FROM severity_counts
        ), '{}'::jsonb),
        'by_type', COALESCE((
            SELECT jsonb_object_agg(violation_type, count)
            FROM type_counts
        ), '{}'::jsonb),
        'drift_velocity', jsonb_build_object(
            'per_hour_last_24h', COALESCE((SELECT per_hour_last_24h FROM drift_velocity), '[]'::jsonb),
            'trend', CASE
                WHEN COALESCE((SELECT later_half FROM window_split), 0) > COALESCE((SELECT earlier_half FROM window_split), 0) THEN 'rising'
                WHEN COALESCE((SELECT later_half FROM window_split), 0) < COALESCE((SELECT earlier_half FROM window_split), 0) THEN 'falling'
                ELSE 'stable'
            END
        ),
        'rule_failure_heatmap', COALESCE((SELECT items FROM rule_failure_heatmap), '[]'::jsonb),
        'provider_drift', COALESCE((SELECT items FROM provider_drift), '[]'::jsonb),
        'degraded_flag', EXISTS (
            SELECT 1
            FROM base
            WHERE LOWER(severity) IN ('critical', 'blocked')
        ),
        'canonical_integrity_broken', EXISTS (
            SELECT 1
            FROM base
            WHERE violation_type = 'MISSING_CANONICAL_ID'
               OR rule_id IN ('IDENTITY_REQUIRED', 'CANONICAL_IDENTITY_REQUIRED')
        ),
        'recent_criticals', COALESCE((SELECT items FROM recent_criticals), '[]'::jsonb)
    ) INTO result;

    RETURN COALESCE(result, '{}'::jsonb);
END;
$$;
