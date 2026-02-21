
-- Fix the RLS SELECT policy for tickets to handle NULL from get_incidents_department_id()
DROP POLICY IF EXISTS "Users see own tickets, staff see dept, admin all" ON public.tickets;

CREATE POLICY "Users see own tickets, staff see dept, admin all"
ON public.tickets FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (created_by = auth.uid())
  OR (
    (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'maintenance'::app_role) OR has_role(auth.uid(), 'support'::app_role))
    AND (
      assigned_to = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
      OR department_id = get_user_department_id(auth.uid())
    )
    AND (
      get_incidents_department_id() IS NULL
      OR department_id <> get_incidents_department_id()
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

-- Also fix the UPDATE policy similarly
DROP POLICY IF EXISTS "Staff/admin can update tickets" ON public.tickets;

CREATE POLICY "Staff/admin can update tickets"
ON public.tickets FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'maintenance'::app_role) OR has_role(auth.uid(), 'support'::app_role))
    AND (
      assigned_to = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
      OR department_id = get_user_department_id(auth.uid())
    )
  )
  OR (created_by = auth.uid())
);
