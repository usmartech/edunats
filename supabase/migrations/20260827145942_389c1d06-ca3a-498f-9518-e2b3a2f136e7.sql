ALTER TABLE public.school_registrations
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by UUID;