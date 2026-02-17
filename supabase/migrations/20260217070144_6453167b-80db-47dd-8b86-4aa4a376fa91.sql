
-- Create custom_roles table for dynamic roles
CREATE TABLE public.custom_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  base_role public.app_role NOT NULL DEFAULT 'user',
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create permissions table
CREATE TABLE public.permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create role_permissions junction table
CREATE TABLE public.role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_id UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_id)
);

-- Add custom_role_id to user_roles
ALTER TABLE public.user_roles ADD COLUMN custom_role_id UUID REFERENCES public.custom_roles(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS for custom_roles
CREATE POLICY "Authenticated can view custom_roles" ON public.custom_roles
  FOR SELECT USING (true);
CREATE POLICY "Admin can manage custom_roles" ON public.custom_roles
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update custom_roles" ON public.custom_roles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete custom_roles" ON public.custom_roles
  FOR DELETE USING (public.has_role(auth.uid(), 'admin') AND NOT is_system);

-- RLS for permissions
CREATE POLICY "Authenticated can view permissions" ON public.permissions
  FOR SELECT USING (true);
CREATE POLICY "Admin can manage permissions" ON public.permissions
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS for role_permissions
CREATE POLICY "Authenticated can view role_permissions" ON public.role_permissions
  FOR SELECT USING (true);
CREATE POLICY "Admin can manage role_permissions" ON public.role_permissions
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can delete role_permissions" ON public.role_permissions
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Seed permissions
INSERT INTO public.permissions (key, label, category) VALUES
  ('tickets.create', 'Създаване на заявки', 'Заявки'),
  ('tickets.view_own', 'Преглед на собствени заявки', 'Заявки'),
  ('tickets.view_department', 'Преглед на заявки в отдела', 'Заявки'),
  ('tickets.view_all', 'Преглед на всички заявки', 'Заявки'),
  ('tickets.edit_own', 'Редактиране на собствени заявки', 'Заявки'),
  ('tickets.edit_all', 'Редактиране на всички заявки', 'Заявки'),
  ('tickets.delete', 'Изтриване на заявки', 'Заявки'),
  ('tickets.change_status', 'Промяна на статус', 'Заявки'),
  ('tickets.assign', 'Назначаване на заявки', 'Заявки'),
  ('users.view', 'Преглед на потребители', 'Потребители'),
  ('users.create', 'Създаване на потребители', 'Потребители'),
  ('users.edit', 'Редактиране на потребители', 'Потребители'),
  ('users.deactivate', 'Деактивиране на потребители', 'Потребители'),
  ('users.change_role', 'Промяна на роля', 'Потребители'),
  ('departments.view', 'Преглед на отдели', 'Отдели'),
  ('departments.create', 'Създаване на отдели', 'Отдели'),
  ('departments.edit', 'Редактиране на отдели', 'Отдели'),
  ('departments.delete', 'Изтриване на отдели', 'Отдели'),
  ('reports.view', 'Преглед на отчети', 'Отчети');

-- Seed default system roles
INSERT INTO public.custom_roles (name, description, base_role, is_system) VALUES
  ('Администратор', 'Пълен достъп до системата', 'admin', true),
  ('Учител ИТ', 'Управление на ИТ заявки и оборудване', 'staff', true),
  ('Поддръжка', 'Поддръжка на системите', 'support', true),
  ('Обслужващ персонал', 'Обслужване на сградата', 'maintenance', true),
  ('Учител', 'Подаване и проследяване на заявки', 'user', true);

-- Assign all permissions to Admin role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT cr.id, p.id FROM public.custom_roles cr CROSS JOIN public.permissions p
WHERE cr.name = 'Администратор';

-- Assign permissions to Учител ИТ
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT cr.id, p.id FROM public.custom_roles cr, public.permissions p
WHERE cr.name = 'Учител ИТ' AND p.key IN (
  'tickets.create','tickets.view_own','tickets.view_department','tickets.edit_own',
  'tickets.change_status','tickets.assign','users.view','departments.view','reports.view'
);

-- Assign permissions to Поддръжка
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT cr.id, p.id FROM public.custom_roles cr, public.permissions p
WHERE cr.name = 'Поддръжка' AND p.key IN (
  'tickets.create','tickets.view_own','tickets.view_department','tickets.edit_own',
  'tickets.change_status','users.view','departments.view'
);

-- Assign permissions to Обслужващ персонал
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT cr.id, p.id FROM public.custom_roles cr, public.permissions p
WHERE cr.name = 'Обслужващ персонал' AND p.key IN (
  'tickets.create','tickets.view_own','tickets.view_department','tickets.edit_own',
  'tickets.change_status','users.view','departments.view'
);

-- Assign permissions to Учител
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT cr.id, p.id FROM public.custom_roles cr, public.permissions p
WHERE cr.name = 'Учител' AND p.key IN (
  'tickets.create','tickets.view_own','tickets.edit_own','departments.view'
);

-- Link existing users to matching custom roles
UPDATE public.user_roles ur
SET custom_role_id = cr.id
FROM public.custom_roles cr
WHERE (ur.role = 'admin' AND cr.name = 'Администратор')
   OR (ur.role = 'staff' AND cr.name = 'Учител ИТ')
   OR (ur.role = 'support' AND cr.name = 'Поддръжка')
   OR (ur.role = 'maintenance' AND cr.name = 'Обслужващ персонал')
   OR (ur.role = 'user' AND cr.name = 'Учител');

-- Create function to check user permissions
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.custom_role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id AND p.key = _permission_key
  )
$$;
