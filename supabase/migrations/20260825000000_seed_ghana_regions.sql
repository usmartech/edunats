-- Seed default country (Ghana) and all 16 regions

INSERT INTO public.countries (id, code, name, active)
VALUES ('00000000-0000-0000-0000-000000000023', 'GH', 'Ghana', true)
ON CONFLICT (code) DO NOTHING;

DO $$
DECLARE
  ghana_id UUID;
BEGIN
  SELECT id INTO ghana_id FROM public.countries WHERE code = 'GH';

  IF ghana_id IS NOT NULL THEN
    INSERT INTO public.regions (country_id, code, name, active) VALUES
      (ghana_id, 'GAR', 'Greater Accra', true),
      (ghana_id, 'ASH', 'Ashanti', true),
      (ghana_id, 'WHR', 'Western', true),
      (ghana_id, 'WNR', 'Western North', true),
      (ghana_id, 'CPR', 'Central', true),
      (ghana_id, 'EPR', 'Eastern', true),
      (ghana_id, 'VTR', 'Volta', true),
      (ghana_id, 'OTR', 'Oti', true),
      (ghana_id, 'NPR', 'Northern', true),
      (ghana_id, 'SVR', 'Savannah', true),
      (ghana_id, 'NER', 'North East', true),
      (ghana_id, 'UER', 'Upper East', true),
      (ghana_id, 'UWR', 'Upper West', true),
      (ghana_id, 'BAR', 'Bono', true),
      (ghana_id, 'BER', 'Bono East', true),
      (ghana_id, 'AHR', 'Ahafo', true)
    ON CONFLICT (country_id, code) DO NOTHING;
  END IF;
END $$;
