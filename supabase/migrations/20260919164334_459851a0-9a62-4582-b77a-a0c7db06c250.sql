CREATE POLICY "Users update own report files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'reports'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'reports'
  AND auth.uid()::text = (storage.foldername(name))[1]
);