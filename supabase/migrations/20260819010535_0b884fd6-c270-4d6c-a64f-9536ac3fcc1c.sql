CREATE OR REPLACE FUNCTION public.is_school_admin(_user_id uuid, _school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id AND role = 'school_admin'
  );
$$;

DROP POLICY IF EXISTS user_roles_school_admin_insert ON public.user_roles;
DROP POLICY IF EXISTS user_roles_school_admin_delete ON public.user_roles;
DROP POLICY IF EXISTS user_roles_school_admin_select ON public.user_roles;

CREATE POLICY user_roles_school_admin_insert ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id IS NOT NULL
    AND role IN ('school_admin','staff','teacher','parent','student')
    AND public.is_school_admin(auth.uid(), school_id)
  );

CREATE POLICY user_roles_school_admin_delete ON public.user_roles
  FOR DELETE TO authenticated
  USING (
    school_id IS NOT NULL
    AND role IN ('school_admin','staff','teacher','parent','student')
    AND public.is_school_admin(auth.uid(), school_id)
  );

CREATE POLICY user_roles_school_admin_select ON public.user_roles
  FOR SELECT TO authenticated
  USING (school_id IS NOT NULL AND public.is_school_admin(auth.uid(), school_id));