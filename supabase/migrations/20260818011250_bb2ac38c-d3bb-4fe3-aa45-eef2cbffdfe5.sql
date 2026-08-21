-- 1. National-scope records are platform-only reads (previously visible to all schools)
DROP POLICY IF EXISTS records_select ON public.records;
CREATE POLICY records_select ON public.records
  FOR SELECT TO authenticated
  USING (
    (school_id IS NULL AND public.is_platform_admin(auth.uid()))
    OR (school_id IS NOT NULL AND public.has_school_access(auth.uid(), school_id))
  );

-- 2. Role administration: platform admins anywhere, school admins within their own school only
CREATE POLICY user_roles_platform_manage ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY user_roles_school_admin_insert ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id IS NOT NULL
    AND role IN ('school_admin','staff','teacher','parent','student')
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.school_id = user_roles.school_id AND ur.role = 'school_admin'
    )
  );

CREATE POLICY user_roles_school_admin_delete ON public.user_roles
  FOR DELETE TO authenticated
  USING (
    school_id IS NOT NULL
    AND role IN ('school_admin','staff','teacher','parent','student')
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.school_id = user_roles.school_id AND ur.role = 'school_admin'
    )
  );

-- School admins must also be able to read the role rows of their own school
CREATE POLICY user_roles_school_admin_select ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    school_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.school_id = user_roles.school_id AND ur.role = 'school_admin'
    )
  );

GRANT INSERT, DELETE ON public.user_roles TO authenticated;

-- 3. Bootstrap: the single existing account becomes the national super administrator
INSERT INTO public.user_roles (user_id, role, school_id, access_level)
SELECT u.id, 'super_admin', NULL, 5 FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role IN ('super_admin','national_admin') AND school_id IS NULL)
ON CONFLICT DO NOTHING;