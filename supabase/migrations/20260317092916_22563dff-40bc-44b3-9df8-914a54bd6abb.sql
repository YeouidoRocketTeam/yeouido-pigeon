
ALTER TABLE public.insights ADD COLUMN reliability_details jsonb DEFAULT NULL;

COMMENT ON COLUMN public.insights.reliability_details IS 'Detailed breakdown of 6-criteria reliability scoring: source_authority, data_specificity, logical_completeness, time_validity, interest_transparency, cross_verification';
