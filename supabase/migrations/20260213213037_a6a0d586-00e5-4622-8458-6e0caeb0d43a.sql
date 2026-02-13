
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'user');
CREATE TYPE public.ticket_status AS ENUM ('new', 'in_progress', 'waiting_for_user', 'resolved', 'closed');
CREATE TYPE public.ticket_priority AS ENUM ('low', 'normal', 'high', 'urgent');

-- Departments
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  default_assignee_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Update departments FK after profiles exists
ALTER TABLE public.departments ADD CONSTRAINT fk_default_assignee FOREIGN KEY (default_assignee_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- User roles (separate table per security requirements)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Tickets
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  department_id UUID NOT NULL REFERENCES public.departments(id),
  status ticket_status NOT NULL DEFAULT 'new',
  priority ticket_priority NOT NULL DEFAULT 'normal',
  assigned_to UUID REFERENCES public.profiles(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  class_name TEXT,
  room TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ticket messages (public conversation + internal notes)
CREATE TABLE public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ticket attachments
CREATE TABLE public.ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ticket events (history timeline)
CREATE TABLE public.ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_events ENABLE ROW LEVEL SECURITY;

-- Helper functions (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_department_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT department_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_incidents_department_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.departments WHERE name = 'Инциденти' LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.can_access_ticket(_ticket_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = _ticket_id
    AND (
      public.has_role(_user_id, 'admin')
      OR t.created_by = _user_id
      OR (
        public.has_role(_user_id, 'staff')
        AND (
          t.assigned_to = (SELECT p.id FROM public.profiles p WHERE p.user_id = _user_id)
          OR t.department_id = public.get_user_department_id(_user_id)
        )
        AND (t.department_id != public.get_incidents_department_id() OR public.has_role(_user_id, 'admin'))
      )
    )
  )
$$;

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS Policies: departments (everyone can read, admin can manage)
CREATE POLICY "Anyone authenticated can view departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can insert departments" ON public.departments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update departments" ON public.departments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete departments" ON public.departments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies: profiles
CREATE POLICY "Authenticated can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin or self can update profile" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);
CREATE POLICY "Admin can delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies: user_roles
CREATE POLICY "Authenticated can view roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);
CREATE POLICY "Admin can manage roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies: tickets
CREATE POLICY "Users see own tickets, staff see dept, admin all" ON public.tickets FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR created_by = auth.uid()
  OR (
    public.has_role(auth.uid(), 'staff')
    AND (
      assigned_to = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
      OR department_id = public.get_user_department_id(auth.uid())
    )
    AND (department_id != public.get_incidents_department_id() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "Authenticated can create tickets" ON public.tickets FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Staff/admin can update tickets" ON public.tickets FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'staff')
    AND (
      assigned_to = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
      OR department_id = public.get_user_department_id(auth.uid())
    )
  )
  OR created_by = auth.uid()
);
CREATE POLICY "Admin can delete tickets" ON public.tickets FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies: ticket_messages
CREATE POLICY "Can view messages of accessible tickets" ON public.ticket_messages FOR SELECT TO authenticated
USING (public.can_access_ticket(ticket_id, auth.uid()));
CREATE POLICY "Can add messages to accessible tickets" ON public.ticket_messages FOR INSERT TO authenticated
WITH CHECK (public.can_access_ticket(ticket_id, auth.uid()) AND user_id = auth.uid());
CREATE POLICY "Admin can delete messages" ON public.ticket_messages FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

-- RLS Policies: ticket_attachments
CREATE POLICY "Can view attachments of accessible tickets" ON public.ticket_attachments FOR SELECT TO authenticated
USING (public.can_access_ticket(ticket_id, auth.uid()));
CREATE POLICY "Can add attachments to accessible tickets" ON public.ticket_attachments FOR INSERT TO authenticated
WITH CHECK (public.can_access_ticket(ticket_id, auth.uid()) AND user_id = auth.uid());
CREATE POLICY "Admin or owner can delete attachments" ON public.ticket_attachments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

-- RLS Policies: ticket_events
CREATE POLICY "Can view events of accessible tickets" ON public.ticket_events FOR SELECT TO authenticated
USING (public.can_access_ticket(ticket_id, auth.uid()));
CREATE POLICY "Can add events" ON public.ticket_events FOR INSERT TO authenticated
WITH CHECK (public.can_access_ticket(ticket_id, auth.uid()) AND user_id = auth.uid());

-- Insert default departments
INSERT INTO public.departments (name) VALUES
  ('IT поддръжка'),
  ('Поддръжка'),
  ('Администрация'),
  ('Инциденти');

-- Storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('ticket-attachments', 'ticket-attachments', false);

CREATE POLICY "Authenticated can upload attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ticket-attachments');
CREATE POLICY "Authenticated can view own attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'ticket-attachments');
CREATE POLICY "Admin can delete attachments" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'ticket-attachments' AND public.has_role(auth.uid(), 'admin'));
