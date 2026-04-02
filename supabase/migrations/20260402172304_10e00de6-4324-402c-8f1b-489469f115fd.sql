
-- Create storage bucket for school logo
INSERT INTO storage.buckets (id, name, public) VALUES ('school-assets', 'school-assets', true);

-- Allow anyone to read (public logo)
CREATE POLICY "Public read school assets" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'school-assets');

-- Only admins can upload/update/delete
CREATE POLICY "Admins manage school assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'school-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update school assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'school-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete school assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'school-assets' AND public.has_role(auth.uid(), 'admin'));
