
-- Drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Admin can insert departments" ON public.departments;
DROP POLICY IF EXISTS "Admin can update departments" ON public.departments;
DROP POLICY IF EXISTS "Admin can delete departments" ON public.departments;
DROP POLICY IF EXISTS "Anyone authenticated can view departments" ON public.departments;

CREATE POLICY "Anyone authenticated can view departments"
  ON public.departments FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert departments"
  ON public.departments FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update departments"
  ON public.departments FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete departments"
  ON public.departments FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
