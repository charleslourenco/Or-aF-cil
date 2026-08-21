-- Migration: Criar tabela perfil_empresa e bucket de storage empresa-logos
-- Idempotente conforme padrões Supabase

CREATE TABLE IF NOT EXISTS public.perfil_empresa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url TEXT,
  razao_social TEXT,
  nome_fantasia TEXT,
  cnpj TEXT,
  inscricao_estadual TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  telefone TEXT,
  email_comercial TEXT,
  instagram TEXT,
  facebook TEXT,
  site TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.perfil_empresa ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para authenticated (e leitura pública para anon/authenticated se necessário para geração de orçamentos)
DROP POLICY IF EXISTS "perfil_empresa_select_auth" ON public.perfil_empresa;
CREATE POLICY "perfil_empresa_select_auth" ON public.perfil_empresa
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "perfil_empresa_select_anon" ON public.perfil_empresa;
CREATE POLICY "perfil_empresa_select_anon" ON public.perfil_empresa
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "perfil_empresa_insert_auth" ON public.perfil_empresa;
CREATE POLICY "perfil_empresa_insert_auth" ON public.perfil_empresa
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "perfil_empresa_insert_anon" ON public.perfil_empresa;
CREATE POLICY "perfil_empresa_insert_anon" ON public.perfil_empresa
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "perfil_empresa_update_auth" ON public.perfil_empresa;
CREATE POLICY "perfil_empresa_update_auth" ON public.perfil_empresa
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "perfil_empresa_update_anon" ON public.perfil_empresa;
CREATE POLICY "perfil_empresa_update_anon" ON public.perfil_empresa
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "perfil_empresa_delete_auth" ON public.perfil_empresa;
CREATE POLICY "perfil_empresa_delete_auth" ON public.perfil_empresa
  FOR DELETE TO authenticated USING (true);

-- Criar bucket público empresa-logos no Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('empresa-logos', 'empresa-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de Storage para o bucket empresa-logos
DROP POLICY IF EXISTS "empresa_logos_public_select" ON storage.objects;
CREATE POLICY "empresa_logos_public_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'empresa-logos');

DROP POLICY IF EXISTS "empresa_logos_public_insert" ON storage.objects;
CREATE POLICY "empresa_logos_public_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'empresa-logos');

DROP POLICY IF EXISTS "empresa_logos_public_update" ON storage.objects;
CREATE POLICY "empresa_logos_public_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'empresa-logos');

DROP POLICY IF EXISTS "empresa_logos_public_delete" ON storage.objects;
CREATE POLICY "empresa_logos_public_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'empresa-logos');
