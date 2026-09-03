-- =============== SOURCES ===============
CREATE TABLE public.geo_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  publisher text NOT NULL DEFAULT '',
  reference_year integer,
  url text,
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.geo_sources TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geo_sources TO authenticated;
GRANT ALL ON public.geo_sources TO service_role;
ALTER TABLE public.geo_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY geo_sources_read ON public.geo_sources FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY geo_sources_write ON public.geo_sources FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE TRIGGER touch_geo_sources BEFORE UPDATE ON public.geo_sources FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============== LEVELS ===============
CREATE TABLE public.geo_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  rank integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_id, code)
);
GRANT SELECT ON public.geo_levels TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geo_levels TO authenticated;
GRANT ALL ON public.geo_levels TO service_role;
ALTER TABLE public.geo_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY geo_levels_read ON public.geo_levels FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY geo_levels_write ON public.geo_levels FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_national_admin(auth.uid(), country_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_national_admin(auth.uid(), country_id));
CREATE TRIGGER touch_geo_levels BEFORE UPDATE ON public.geo_levels FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============== UNITS ===============
CREATE TABLE public.geo_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  level_id uuid NOT NULL REFERENCES public.geo_levels(id) ON DELETE RESTRICT,
  parent_id uuid REFERENCES public.geo_units(id) ON DELETE CASCADE,
  region_id uuid REFERENCES public.regions(id) ON DELETE SET NULL,
  code text NOT NULL,
  name text NOT NULL,
  unit_type text NOT NULL DEFAULT '',
  capital text,
  source_id uuid REFERENCES public.geo_sources(id) ON DELETE SET NULL,
  source_ref text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_id, code)
);
CREATE INDEX geo_units_parent_idx ON public.geo_units(parent_id);
CREATE INDEX geo_units_level_idx ON public.geo_units(level_id);
GRANT SELECT ON public.geo_units TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geo_units TO authenticated;
GRANT ALL ON public.geo_units TO service_role;
ALTER TABLE public.geo_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY geo_units_read ON public.geo_units FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY geo_units_write ON public.geo_units FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_national_admin(auth.uid(), country_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_national_admin(auth.uid(), country_id));
CREATE TRIGGER touch_geo_units BEFORE UPDATE ON public.geo_units FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============== RELATIONSHIPS ===============
CREATE TABLE public.geo_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_unit_id uuid NOT NULL REFERENCES public.geo_units(id) ON DELETE CASCADE,
  child_unit_id uuid NOT NULL REFERENCES public.geo_units(id) ON DELETE CASCADE,
  relationship_type text NOT NULL DEFAULT 'contains',
  source_id uuid REFERENCES public.geo_sources(id) ON DELETE SET NULL,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_unit_id, child_unit_id, relationship_type)
);
GRANT SELECT ON public.geo_relationships TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geo_relationships TO authenticated;
GRANT ALL ON public.geo_relationships TO service_role;
ALTER TABLE public.geo_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY geo_rel_read ON public.geo_relationships FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY geo_rel_write ON public.geo_relationships FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE TRIGGER touch_geo_relationships BEFORE UPDATE ON public.geo_relationships FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============== LINEAGE ===============
CREATE TABLE public.geo_unit_lineage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.geo_units(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.geo_sources(id) ON DELETE SET NULL,
  action text NOT NULL,
  changed_by uuid,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX geo_lineage_unit_idx ON public.geo_unit_lineage(unit_id);
GRANT SELECT, INSERT ON public.geo_unit_lineage TO authenticated;
GRANT ALL ON public.geo_unit_lineage TO service_role;
ALTER TABLE public.geo_unit_lineage ENABLE ROW LEVEL SECURITY;
CREATE POLICY geo_lineage_read ON public.geo_unit_lineage FOR SELECT TO authenticated USING (true);
CREATE POLICY geo_lineage_insert ON public.geo_unit_lineage FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()) AND changed_by = auth.uid());

-- =============== ADDRESS + GEO ON REGISTRATIONS AND SCHOOLS ===============
ALTER TABLE public.school_registrations
  ADD COLUMN mmda_id uuid REFERENCES public.geo_units(id) ON DELETE SET NULL,
  ADD COLUMN sub_metro_id uuid REFERENCES public.geo_units(id) ON DELETE SET NULL,
  ADD COLUMN locality_id uuid REFERENCES public.geo_units(id) ON DELETE SET NULL,
  ADD COLUMN locality_name text,
  ADD COLUMN postal_address text,
  ADD COLUMN nearest_landmark text,
  ADD COLUMN area_community text,
  ADD COLUMN gps_lat numeric,
  ADD COLUMN gps_lng numeric,
  ADD COLUMN digital_address text;

ALTER TABLE public.schools
  ADD COLUMN mmda_id uuid REFERENCES public.geo_units(id) ON DELETE SET NULL,
  ADD COLUMN sub_metro_id uuid REFERENCES public.geo_units(id) ON DELETE SET NULL,
  ADD COLUMN locality_id uuid REFERENCES public.geo_units(id) ON DELETE SET NULL,
  ADD COLUMN locality_name text,
  ADD COLUMN postal_address text,
  ADD COLUMN nearest_landmark text,
  ADD COLUMN area_community text,
  ADD COLUMN gps_lat numeric,
  ADD COLUMN gps_lng numeric,
  ADD COLUMN digital_address text;