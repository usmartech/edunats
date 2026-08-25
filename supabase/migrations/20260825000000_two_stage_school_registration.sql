-- Update school_registrations to support two-stage approval: Regional confirmation -> National approval
ALTER TABLE public.school_registrations
  DROP CONSTRAINT IF EXISTS school_registrations_status;

ALTER TABLE public.school_registrations
  ADD CONSTRAINT school_registrations_status CHECK (status IN ('pending','region_confirmed','approved','rejected'));

ALTER TABLE public.school_registrations
  ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES auth.users ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
