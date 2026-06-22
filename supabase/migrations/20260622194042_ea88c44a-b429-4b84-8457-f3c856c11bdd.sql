
CREATE POLICY "Staff read attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'attachments' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff upload attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'attachments' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff update attachments"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'attachments' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff delete attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'attachments' AND public.is_staff(auth.uid()));
