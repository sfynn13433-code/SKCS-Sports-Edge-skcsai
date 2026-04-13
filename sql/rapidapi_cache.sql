CREATE TABLE IF NOT EXISTS public.rapidapi_cache (
    cache_key text PRIMARY KEY,
    provider_name text NOT NULL,
    payload jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rapidapi_cache_provider_name
    ON public.rapidapi_cache (provider_name);

CREATE INDEX IF NOT EXISTS idx_rapidapi_cache_updated_at
    ON public.rapidapi_cache (updated_at DESC);
