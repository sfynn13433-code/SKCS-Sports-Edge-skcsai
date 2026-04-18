ALTER TABLE public.predictions_final DROP CONSTRAINT IF EXISTS predictions_final_risk_level_check;
ALTER TABLE public.predictions_final ADD CONSTRAINT predictions_final_risk_level_check
CHECK (risk_level = ANY (ARRAY['safe'::text, 'good'::text, 'fair'::text, 'unsafe'::text, 'medium'::text, 'low'::text]));
