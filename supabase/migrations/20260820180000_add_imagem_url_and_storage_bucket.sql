-- Adiciona a coluna imagem_url na tabela TemplatesEngenharia
ALTER TABLE public."TemplatesEngenharia"
  ADD COLUMN IF NOT EXISTS imagem_url text;

-- Criação e configuração do bucket público 'modulos-imagens' no Supabase Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'modulos-imagens',
  'modulos-imagens',
  true,
  10485760, -- 10MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];

-- Políticas de acesso para o bucket modulos-imagens
DROP POLICY IF EXISTS "Public Select modulos-imagens" ON storage.objects;
CREATE POLICY "Public Select modulos-imagens"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'modulos-imagens');

DROP POLICY IF EXISTS "Public/Anon Insert modulos-imagens" ON storage.objects;
CREATE POLICY "Public/Anon Insert modulos-imagens"
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'modulos-imagens');

DROP POLICY IF EXISTS "Public/Anon Update modulos-imagens" ON storage.objects;
CREATE POLICY "Public/Anon Update modulos-imagens"
  ON storage.objects
  FOR UPDATE
  TO public
  USING (bucket_id = 'modulos-imagens')
  WITH CHECK (bucket_id = 'modulos-imagens');

DROP POLICY IF EXISTS "Public/Anon Delete modulos-imagens" ON storage.objects;
CREATE POLICY "Public/Anon Delete modulos-imagens"
  ON storage.objects
  FOR DELETE
  TO public
  USING (bucket_id = 'modulos-imagens');
