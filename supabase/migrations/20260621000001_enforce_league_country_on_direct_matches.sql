BEGIN;

CREATE OR REPLACE FUNCTION public.skcs_fill_league_country_from_matches()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    m0 jsonb;
    metadata jsonb;
    derived_league text;
    derived_country text;
BEGIN
    IF NEW.matches IS NULL
       OR jsonb_typeof(NEW.matches) <> 'array'
       OR jsonb_array_length(NEW.matches) = 0 THEN
        RETURN NEW;
    END IF;

    m0 := NEW.matches -> 0;
    metadata := COALESCE(m0 -> 'metadata', '{}'::jsonb);

    derived_league := COALESCE(
        NULLIF(BTRIM(m0 ->> 'league'), ''),
        NULLIF(BTRIM(metadata ->> 'league'), ''),
        NULLIF(BTRIM(metadata ->> 'competition'), ''),
        NULLIF(BTRIM(metadata -> 'match_info' ->> 'league'), ''),
        NULLIF(BTRIM(metadata -> 'match_context' -> 'match_info' ->> 'league'), ''),
        NULLIF(BTRIM(metadata -> 'raw_provider_data' -> 'league' ->> 'name'), ''),
        NULLIF(BTRIM(metadata -> 'raw_provider_data' -> 'competition' ->> 'name'), ''),
        NULLIF(BTRIM(metadata -> 'raw_provider_data' -> 'tournament' ->> 'name'), '')
    );

    derived_country := COALESCE(
        NULLIF(BTRIM(m0 ->> 'country'), ''),
        NULLIF(BTRIM(metadata ->> 'country'), ''),
        NULLIF(BTRIM(metadata ->> 'league_country'), ''),
        NULLIF(BTRIM(metadata -> 'match_info' ->> 'country'), ''),
        NULLIF(BTRIM(metadata -> 'match_context' -> 'match_info' ->> 'country'), ''),
        NULLIF(BTRIM(metadata -> 'raw_provider_data' -> 'league' ->> 'country'), ''),
        NULLIF(BTRIM(metadata -> 'raw_provider_data' ->> 'country'), '')
    );

    IF derived_league IS NOT NULL THEN
        NEW.matches := jsonb_set(NEW.matches, '{0,league}', to_jsonb(derived_league), true);
        metadata := metadata
            || jsonb_build_object(
                'league', derived_league,
                'competition', COALESCE(NULLIF(BTRIM(metadata ->> 'competition'), ''), derived_league)
            );
    END IF;

    IF derived_country IS NOT NULL THEN
        NEW.matches := jsonb_set(NEW.matches, '{0,country}', to_jsonb(derived_country), true);
        metadata := metadata
            || jsonb_build_object(
                'country', derived_country,
                'league_country', derived_country
            );
    END IF;

    NEW.matches := jsonb_set(NEW.matches, '{0,metadata}', metadata, true);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_skcs_fill_league_country_on_direct1x2 ON public.direct1x2_prediction_final;

CREATE TRIGGER trg_skcs_fill_league_country_on_direct1x2
BEFORE INSERT OR UPDATE OF matches
ON public.direct1x2_prediction_final
FOR EACH ROW
EXECUTE FUNCTION public.skcs_fill_league_country_from_matches();

-- Backfill existing rows by re-saving matches through the trigger.
UPDATE public.direct1x2_prediction_final
SET matches = matches
WHERE matches IS NOT NULL
  AND jsonb_typeof(matches) = 'array'
  AND jsonb_array_length(matches) > 0;

COMMIT;
