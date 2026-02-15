
-- Update can_access_ticket to treat maintenance and support like staff
CREATE OR REPLACE FUNCTION public.can_access_ticket(_ticket_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = _ticket_id
    AND (
      public.has_role(_user_id, 'admin')
      OR t.created_by = _user_id
      OR (
        (public.has_role(_user_id, 'staff') OR public.has_role(_user_id, 'maintenance') OR public.has_role(_user_id, 'support'))
        AND (
          t.assigned_to = (SELECT p.id FROM public.profiles p WHERE p.user_id = _user_id)
          OR t.department_id = public.get_user_department_id(_user_id)
        )
        AND (t.department_id != public.get_incidents_department_id() OR public.has_role(_user_id, 'admin'))
      )
    )
  )
$$;

-- Update tickets SELECT policy
DROP POLICY IF EXISTS "Users see own tickets, staff see dept, admin all" ON public.tickets;
CREATE POLICY "Users see own tickets, staff see dept, admin all"
ON public.tickets FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (created_by = auth.uid())
  OR (
    (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'maintenance'::app_role) OR has_role(auth.uid(), 'support'::app_role))
    AND (
      assigned_to = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
      OR department_id = get_user_department_id(auth.uid())
    )
    AND (department_id != get_incidents_department_id() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Update tickets UPDATE policy
DROP POLICY IF EXISTS "Staff/admin can update tickets" ON public.tickets;
CREATE POLICY "Staff/admin can update tickets"
ON public.tickets FOR UPDATE
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
