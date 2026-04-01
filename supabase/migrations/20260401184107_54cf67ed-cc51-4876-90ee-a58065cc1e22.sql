
-- ========== ORDERS ==========
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  order_number text,
  content text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '9 months')
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.order_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size integer,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_attachments ENABLE ROW LEVEL SECURITY;

-- ========== CHANNELS ==========
CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  created_by uuid NOT NULL,
  invite_code text NOT NULL DEFAULT substring(gen_random_uuid()::text from 1 for 8),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.channel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_id, user_id)
);
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.channel_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.channel_posts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.channel_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.channel_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.channel_comments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.channel_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size integer,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.channel_attachments ENABLE ROW LEVEL SECURITY;

-- ========== FUNCTIONS ==========
CREATE OR REPLACE FUNCTION public.is_channel_member(_channel_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.channel_members WHERE channel_id = _channel_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.get_post_channel_id(_post_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT channel_id FROM public.channel_posts WHERE id = _post_id
$$;

-- ========== RLS POLICIES ==========
-- Orders
CREATE POLICY "Authenticated can view orders" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authorized can create orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(), 'admin') OR user_has_permission(auth.uid(), 'orders.create')
);
CREATE POLICY "Authorized can update orders" ON public.orders FOR UPDATE TO authenticated USING (
  has_role(auth.uid(), 'admin') OR (created_by = auth.uid() AND user_has_permission(auth.uid(), 'orders.create'))
);
CREATE POLICY "Authorized can delete orders" ON public.orders FOR DELETE TO authenticated USING (
  has_role(auth.uid(), 'admin') OR created_by = auth.uid()
);

-- Order attachments
CREATE POLICY "Authenticated can view order attachments" ON public.order_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authorized can add order attachments" ON public.order_attachments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner or admin can delete order attachments" ON public.order_attachments FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR user_id = auth.uid());

-- Channels
CREATE POLICY "Members can view their channels" ON public.channels FOR SELECT TO authenticated USING (
  has_role(auth.uid(), 'admin') OR is_channel_member(id, auth.uid())
);
CREATE POLICY "Authorized can create channels" ON public.channels FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(), 'admin') OR user_has_permission(auth.uid(), 'channels.create')
);
CREATE POLICY "Creator or admin can update channels" ON public.channels FOR UPDATE TO authenticated USING (
  has_role(auth.uid(), 'admin') OR created_by = auth.uid()
);
CREATE POLICY "Creator or admin can delete channels" ON public.channels FOR DELETE TO authenticated USING (
  has_role(auth.uid(), 'admin') OR created_by = auth.uid()
);

-- Channel members
CREATE POLICY "Members can view channel members" ON public.channel_members FOR SELECT TO authenticated USING (
  has_role(auth.uid(), 'admin') OR user_id = auth.uid() OR is_channel_member(channel_id, auth.uid())
);
CREATE POLICY "Channel admin can add members" ON public.channel_members FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  (SELECT created_by FROM public.channels WHERE id = channel_id) = auth.uid() OR
  user_id = auth.uid()
);
CREATE POLICY "Channel admin can remove members" ON public.channel_members FOR DELETE TO authenticated USING (
  has_role(auth.uid(), 'admin') OR 
  (SELECT created_by FROM public.channels WHERE id = channel_id) = auth.uid() OR
  user_id = auth.uid()
);

-- Channel posts
CREATE POLICY "Members can view channel posts" ON public.channel_posts FOR SELECT TO authenticated USING (
  has_role(auth.uid(), 'admin') OR is_channel_member(channel_id, auth.uid())
);
CREATE POLICY "Members can create posts" ON public.channel_posts FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND is_channel_member(channel_id, auth.uid())
);
CREATE POLICY "Owner or admin can update posts" ON public.channel_posts FOR UPDATE TO authenticated USING (
  has_role(auth.uid(), 'admin') OR user_id = auth.uid()
);
CREATE POLICY "Owner or admin can delete posts" ON public.channel_posts FOR DELETE TO authenticated USING (
  has_role(auth.uid(), 'admin') OR user_id = auth.uid()
);

-- Channel comments
CREATE POLICY "Members can view comments" ON public.channel_comments FOR SELECT TO authenticated USING (
  has_role(auth.uid(), 'admin') OR is_channel_member(get_post_channel_id(post_id), auth.uid())
);
CREATE POLICY "Members can create comments" ON public.channel_comments FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND is_channel_member(get_post_channel_id(post_id), auth.uid())
);
CREATE POLICY "Owner or admin can delete comments" ON public.channel_comments FOR DELETE TO authenticated USING (
  has_role(auth.uid(), 'admin') OR user_id = auth.uid()
);

-- Channel attachments
CREATE POLICY "Authenticated can view channel attachments" ON public.channel_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can add channel attachments" ON public.channel_attachments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner or admin can delete channel attachments" ON public.channel_attachments FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR user_id = auth.uid());

-- ========== STORAGE ==========
INSERT INTO storage.buckets (id, name, public) VALUES ('order-attachments', 'order-attachments', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('channel-attachments', 'channel-attachments', false);

CREATE POLICY "Auth can view order files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'order-attachments');
CREATE POLICY "Auth can upload order files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'order-attachments');
CREATE POLICY "Admin can delete order files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'order-attachments' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Auth can view channel files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'channel-attachments');
CREATE POLICY "Auth can upload channel files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'channel-attachments');
CREATE POLICY "Admin can delete channel files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'channel-attachments' AND has_role(auth.uid(), 'admin'));

-- ========== PERMISSIONS ==========
INSERT INTO public.permissions (key, label, category) VALUES
  ('orders.create', 'Създаване на заповеди', 'Заповеди'),
  ('channels.create', 'Създаване на канали', 'Канали');

-- ========== REALTIME ==========
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_comments;
