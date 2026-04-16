insert into tier_rules (tier, min_confidence, allowed_markets, max_acca_size, allowed_volatility)
values
    (
        'normal',
        40,
        '["ALL"]'::jsonb,
        3,
        '["low","medium","high"]'::jsonb
    ),
    (
        'deep',
        40,
        '["ALL"]'::jsonb,
        12,
        '["low","medium","high"]'::jsonb
    )
on conflict (tier) do update set
    min_confidence = excluded.min_confidence,
    allowed_markets = excluded.allowed_markets,
    max_acca_size = excluded.max_acca_size,
    allowed_volatility = excluded.allowed_volatility;
