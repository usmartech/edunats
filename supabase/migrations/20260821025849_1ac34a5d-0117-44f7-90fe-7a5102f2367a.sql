-- ============ platform settings ============
CREATE TABLE public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  platform_name TEXT NOT NULL DEFAULT 'EduNat',
  tagline TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  support_email TEXT,
  auto_approve_registrations BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_settings_singleton CHECK (singleton)
);
GRANT SELECT, INSERT, UPDATE ON public.platform_settings TO authenticated;
GRANT SELECT ON public.platform_settings TO anon;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY platform_settings_read ON public.platform_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY platform_settings_update ON public.platform_settings FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- ============ countries ============
CREATE TABLE public.countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.countries TO authenticated;
GRANT SELECT ON public.countries TO anon;
GRANT ALL ON public.countries TO service_role;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY countries_read ON public.countries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY countries_write ON public.countries FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- ============ regions ============
CREATE TABLE public.regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.regions TO authenticated;
GRANT SELECT ON public.regions TO anon;
GRANT ALL ON public.regions TO service_role;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY regions_read ON public.regions FOR SELECT TO anon, authenticated USING (true);

-- ============ hierarchy columns ============
ALTER TABLE public.schools
  ADD COLUMN country_id UUID REFERENCES public.countries(id) ON DELETE SET NULL,
  ADD COLUMN region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  ADD COLUMN status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN created_by UUID;
CREATE INDEX schools_country_idx ON public.schools (country_id);
CREATE INDEX schools_region_idx ON public.schools (region_id);

ALTER TABLE public.user_roles
  ADD COLUMN country_id UUID REFERENCES public.countries(id) ON DELETE CASCADE,
  ADD COLUMN region_id UUID REFERENCES public.regions(id) ON DELETE CASCADE;
DROP INDEX IF EXISTS user_roles_unique;
CREATE UNIQUE INDEX user_roles_unique ON public.user_roles (
  user_id, role,
  COALESCE(school_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(region_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(country_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- ============ scope helpers ============
CREATE OR REPLACE FUNCTION public.is_national_admin(_user_id UUID, _country_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'national_admin'
      AND (country_id IS NULL OR country_id = _country_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_regional_admin(_user_id UUID, _region_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'regional_admin' AND region_id = _region_id
  );
$$;

CREATE OR REPLACE FUNCTION public.school_in_scope(_user_id UUID, _school_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(_user_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND school_id = _school_id)
    OR EXISTS (
      SELECT 1 FROM public.schools s
      WHERE s.id = _school_id
        AND (
          public.is_national_admin(_user_id, s.country_id)
          OR (s.region_id IS NOT NULL AND public.is_regional_admin(_user_id, s.region_id))
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.has_school_access(_user_id UUID, _school_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.school_in_scope(_user_id, _school_id);
$$;

CREATE OR REPLACE FUNCTION public.can_write_school(_user_id UUID, _school_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND school_id = _school_id
        AND role IN ('school_admin','staff','teacher')
    )
    OR EXISTS (
      SELECT 1 FROM public.schools s
      WHERE s.id = _school_id
        AND (
          public.is_national_admin(_user_id, s.country_id)
          OR (s.region_id IS NOT NULL AND public.is_regional_admin(_user_id, s.region_id))
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.is_platform_bootstrapped()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin');
$$;

-- regions are managed by the super admin and the country's national admin
CREATE POLICY regions_write ON public.regions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_national_admin(auth.uid(), country_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_national_admin(auth.uid(), country_id));

-- schools: hierarchy-aware writes
DROP POLICY IF EXISTS schools_update ON public.schools;
CREATE POLICY schools_update ON public.schools FOR UPDATE TO authenticated
  USING (public.can_write_school(auth.uid(), id))
  WITH CHECK (public.can_write_school(auth.uid(), id));
DROP POLICY IF EXISTS schools_delete_platform ON public.schools;
CREATE POLICY schools_delete_platform ON public.schools FOR DELETE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_national_admin(auth.uid(), country_id)
    OR (region_id IS NOT NULL AND public.is_regional_admin(auth.uid(), region_id))
  );

-- roles: national and regional admins manage roles inside their scope
CREATE POLICY user_roles_scope_manage ON public.user_roles FOR ALL TO authenticated
  USING (
    (school_id IS NOT NULL AND public.can_write_school(auth.uid(), school_id) AND NOT public.is_super_admin(auth.uid()) AND role <> 'super_admin')
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    (school_id IS NOT NULL AND public.can_write_school(auth.uid(), school_id) AND role <> 'super_admin')
    OR public.is_super_admin(auth.uid())
  );

-- ============ school registration requests ============
CREATE TABLE public.school_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  school_name TEXT NOT NULL,
  proposed_code TEXT NOT NULL,
  country_id UUID REFERENCES public.countries(id) ON DELETE SET NULL,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  district TEXT,
  type_code TEXT NOT NULL DEFAULT 'public',
  level_codes TEXT[] NOT NULL DEFAULT '{}',
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT school_registrations_status CHECK (status IN ('pending','approved','rejected'))
);
CREATE INDEX school_registrations_status_idx ON public.school_registrations (status);
GRANT SELECT, INSERT, UPDATE ON public.school_registrations TO authenticated;
GRANT ALL ON public.school_registrations TO service_role;
ALTER TABLE public.school_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY registrations_own_select ON public.school_registrations FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR public.is_national_admin(auth.uid(), country_id)
    OR (region_id IS NOT NULL AND public.is_regional_admin(auth.uid(), region_id))
  );
CREATE POLICY registrations_own_insert ON public.school_registrations FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND status = 'pending');
CREATE POLICY registrations_review ON public.school_registrations FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_national_admin(auth.uid(), country_id)
    OR (region_id IS NOT NULL AND public.is_regional_admin(auth.uid(), region_id))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.is_national_admin(auth.uid(), country_id)
    OR (region_id IS NOT NULL AND public.is_regional_admin(auth.uid(), region_id))
  );

-- ============ audit log ============
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  scope TEXT NOT NULL DEFAULT 'platform',
  scope_id UUID,
  action TEXT NOT NULL,
  target_table TEXT,
  target_id UUID,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON public.audit_log (created_at DESC);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_insert ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());
CREATE POLICY audit_select ON public.audit_log FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (scope = 'school' AND scope_id IS NOT NULL AND public.can_write_school(auth.uid(), scope_id))
  );

-- ============ triggers ============
CREATE TRIGGER touch_platform_settings BEFORE UPDATE ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_countries BEFORE UPDATE ON public.countries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_regions BEFORE UPDATE ON public.regions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_registrations BEFORE UPDATE ON public.school_registrations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ scoped oversight rollup ============
DROP FUNCTION IF EXISTS public.national_overview();
CREATE OR REPLACE FUNCTION public.national_overview()
RETURNS TABLE (
  school_id UUID, school_name TEXT, school_code TEXT, country TEXT, region TEXT,
  country_id UUID, region_id UUID,
  type_code TEXT, level_codes TEXT[], active BOOLEAN, record_count BIGINT,
  staff_count BIGINT, configured BOOLEAN, last_activity TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.name, s.code,
         COALESCE(c.name, s.country), COALESCE(rg.name, s.region),
         s.country_id, s.region_id,
         s.type_code, s.level_codes, s.active,
         COALESCE(r.total, 0), COALESCE(r.staff, 0),
         (cfg.school_id IS NOT NULL), GREATEST(s.updated_at, COALESCE(r.last_activity, s.updated_at))
  FROM public.schools s
  LEFT JOIN public.countries c ON c.id = s.country_id
  LEFT JOIN public.regions rg ON rg.id = s.region_id
  LEFT JOIN (
    SELECT school_id, count(*) AS total,
           count(*) FILTER (WHERE collection = 'staff') AS staff,
           max(updated_at) AS last_activity
    FROM public.records GROUP BY school_id
  ) r ON r.school_id = s.id
  LEFT JOIN public.school_settings cfg ON cfg.school_id = s.id
  WHERE public.school_in_scope(auth.uid(), s.id)
  ORDER BY s.name;
$$;

DO $$
DECLARE fn text;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

INSERT INTO public.platform_settings (platform_name, tagline)
VALUES ('EduNat', 'National school management platform')
ON CONFLICT DO NOTHING;