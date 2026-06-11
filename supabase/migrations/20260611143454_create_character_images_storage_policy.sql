
CREATE POLICY "public_read_character_images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'character-images');
