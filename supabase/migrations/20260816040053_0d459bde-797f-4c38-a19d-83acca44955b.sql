-- ============ enums ============
CREATE TYPE public.app_role AS ENUM (
  'super_admin','national_admin','regional_admin','school_admin','staff','teacher','parent','student'
);

-- ============ profiles ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ============ schools ============
CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL DEFAULT '',
  region TEXT,
  district TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  currency TEXT NOT NULL DEFAULT 'USD',
  locale TEXT NOT NULL DEFAULT 'en',
  type_code TEXT NOT NULL DEFAULT 'public',
  level_codes TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ role assignments (never on profiles) ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  access_level INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX user_roles_unique ON public.user_roles (user_id, role, COALESCE(school_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX user_roles_user_idx ON public.user_roles (user_id);
CREATE INDEX user_roles_school_idx ON public.user_roles (school_id);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ security definer helpers ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('super_admin','national_admin') AND school_id IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin' AND school_id IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.has_school_access(_user_id UUID, _school_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin(_user_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND school_id = _school_id);
$$;

CREATE OR REPLACE FUNCTION public.can_write_school(_user_id UUID, _school_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND school_id = _school_id
        AND role IN ('school_admin','staff','teacher')
    );
$$;

CREATE POLICY "user_roles_self_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));

-- ============ schools policies ============
GRANT SELECT ON public.schools TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schools_select_authenticated" ON public.schools FOR SELECT TO authenticated USING (true);
CREATE POLICY "schools_insert_platform" ON public.schools FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "schools_update" ON public.schools FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.can_write_school(auth.uid(), id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.can_write_school(auth.uid(), id));
CREATE POLICY "schools_delete_platform" ON public.schools FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- ============ national catalogue ============
CREATE TABLE public.education_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 1,
  min_age INTEGER,
  max_age INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.education_levels TO authenticated;
GRANT ALL ON public.education_levels TO service_role;
ALTER TABLE public.education_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "levels_select" ON public.education_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "levels_write" ON public.education_levels FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE public.school_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_types TO authenticated;
GRANT ALL ON public.school_types TO service_role;
ALTER TABLE public.school_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "types_select" ON public.school_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "types_write" ON public.school_types FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- ============ per-school configuration ============
CREATE TABLE public.school_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_settings TO authenticated;
GRANT ALL ON public.school_settings TO service_role;
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select" ON public.school_settings FOR SELECT TO authenticated
  USING (public.has_school_access(auth.uid(), school_id));
CREATE POLICY "settings_insert" ON public.school_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.can_write_school(auth.uid(), school_id));
CREATE POLICY "settings_update" ON public.school_settings FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.can_write_school(auth.uid(), school_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.can_write_school(auth.uid(), school_id));
CREATE POLICY "settings_delete" ON public.school_settings FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- ============ flexible per-school record store ============
CREATE TABLE public.records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection TEXT NOT NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX records_collection_school_idx ON public.records (collection, school_id);
CREATE INDEX records_data_idx ON public.records USING gin (data);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.records TO authenticated;
GRANT ALL ON public.records TO service_role;
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "records_select" ON public.records FOR SELECT TO authenticated
  USING (school_id IS NULL OR public.has_school_access(auth.uid(), school_id));
CREATE POLICY "records_insert" ON public.records FOR INSERT TO authenticated
  WITH CHECK (
    (school_id IS NULL AND public.is_super_admin(auth.uid()))
    OR public.can_write_school(auth.uid(), school_id)
    OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "records_update" ON public.records FOR UPDATE TO authenticated
  USING (
    (school_id IS NULL AND public.is_super_admin(auth.uid()))
    OR public.can_write_school(auth.uid(), school_id)
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    (school_id IS NULL AND public.is_super_admin(auth.uid()))
    OR public.can_write_school(auth.uid(), school_id)
    OR public.is_super_admin(auth.uid())
  );
CREATE POLICY "records_delete" ON public.records FOR DELETE TO authenticated
  USING (
    (school_id IS NULL AND public.is_super_admin(auth.uid()))
    OR public.can_write_school(auth.uid(), school_id)
    OR public.is_super_admin(auth.uid())
  );

-- ============ timestamps ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER touch_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_schools BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_levels BEFORE UPDATE ON public.education_levels FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_types BEFORE UPDATE ON public.school_types FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_settings BEFORE UPDATE ON public.school_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_records BEFORE UPDATE ON public.records FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ new user profile ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ national oversight rollup ============
CREATE OR REPLACE FUNCTION public.national_overview()
RETURNS TABLE (
  school_id UUID, school_name TEXT, school_code TEXT, country TEXT, region TEXT,
  type_code TEXT, level_codes TEXT[], active BOOLEAN, record_count BIGINT,
  staff_count BIGINT, configured BOOLEAN, last_activity TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.name, s.code, s.country, s.region, s.type_code, s.level_codes, s.active,
         COALESCE(r.total, 0), COALESCE(r.staff, 0),
         (cfg.school_id IS NOT NULL), GREATEST(s.updated_at, COALESCE(r.last_activity, s.updated_at))
  FROM public.schools s
  LEFT JOIN (
    SELECT school_id, count(*) AS total,
           count(*) FILTER (WHERE collection = 'staff') AS staff,
           max(updated_at) AS last_activity
    FROM public.records GROUP BY school_id
  ) r ON r.school_id = s.id
  LEFT JOIN public.school_settings cfg ON cfg.school_id = s.id
  WHERE public.is_platform_admin(auth.uid())
  ORDER BY s.name;
$$;
GRANT EXECUTE ON FUNCTION public.national_overview() TO authenticated;