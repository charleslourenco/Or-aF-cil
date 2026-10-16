-- Criação da tabela de vínculos de ferragens genéricas com CatalogoMateriais
CREATE TABLE IF NOT EXISTS public.ferragens_vinculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_ferragem TEXT NOT NULL UNIQUE,
  catalogo_material_id UUID REFERENCES public."CatalogoMateriais"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ferragens_vinculos_nome_idx ON public.ferragens_vinculos (nome_ferragem);
CREATE INDEX IF NOT EXISTS ferragens_vinculos_catalogo_id_idx ON public.ferragens_vinculos (catalogo_material_id);

ALTER TABLE public.ferragens_vinculos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS: leitura pública/autenticada (assim como catalogo) e escrita autenticada
DROP POLICY IF EXISTS "ferragens_vinculos_select_anon" ON public.ferragens_vinculos;
CREATE POLICY "ferragens_vinculos_select_anon" ON public.ferragens_vinculos
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "ferragens_vinculos_select_auth" ON public.ferragens_vinculos;
CREATE POLICY "ferragens_vinculos_select_auth" ON public.ferragens_vinculos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ferragens_vinculos_insert_auth" ON public.ferragens_vinculos;
CREATE POLICY "ferragens_vinculos_insert_auth" ON public.ferragens_vinculos
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "ferragens_vinculos_update_auth" ON public.ferragens_vinculos;
CREATE POLICY "ferragens_vinculos_update_auth" ON public.ferragens_vinculos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ferragens_vinculos_delete_auth" ON public.ferragens_vinculos;
CREATE POLICY "ferragens_vinculos_delete_auth" ON public.ferragens_vinculos
  FOR DELETE TO authenticated USING (true);
