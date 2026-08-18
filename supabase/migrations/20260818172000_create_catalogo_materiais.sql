-- ============================================================================
-- Tabela: CatalogoMateriais
-- Catálogo de materiais (chapas MDF, ferragens, fitas de borda e acabamentos)
-- usado pelo motor de precificação da BOM.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public."CatalogoMateriais" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_material TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (
    categoria IN ('MDF 15mm', 'MDF 18mm', 'MDF 6mm', 'Fita de Borda', 'Ferragem')
  ),
  unidade TEXT NOT NULL CHECK (unidade IN ('m²', 'm', 'un', 'par')),
  preco_custo NUMERIC(10,2) NOT NULL,
  nivel_padrao TEXT NOT NULL DEFAULT 'padrao' CHECK (nivel_padrao IN ('padrao', 'premium')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilita RLS
ALTER TABLE public."CatalogoMateriais" ENABLE ROW LEVEL SECURITY;

-- SELECT público (anon + authenticated)
DROP POLICY IF EXISTS "catalogo_select_anon" ON public."CatalogoMateriais";
CREATE POLICY "catalogo_select_anon" ON public."CatalogoMateriais"
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "catalogo_select_authenticated" ON public."CatalogoMateriais";
CREATE POLICY "catalogo_select_authenticated" ON public."CatalogoMateriais"
  FOR SELECT TO authenticated USING (true);

-- INSERT apenas para authenticated
DROP POLICY IF EXISTS "catalogo_insert_authenticated" ON public."CatalogoMateriais";
CREATE POLICY "catalogo_insert_authenticated" ON public."CatalogoMateriais"
  FOR INSERT TO authenticated WITH CHECK (true);

-- UPDATE apenas para authenticated
DROP POLICY IF EXISTS "catalogo_update_authenticated" ON public."CatalogoMateriais";
CREATE POLICY "catalogo_update_authenticated" ON public."CatalogoMateriais"
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- DELETE apenas para authenticated
DROP POLICY IF EXISTS "catalogo_delete_authenticated" ON public."CatalogoMateriais";
CREATE POLICY "catalogo_delete_authenticated" ON public."CatalogoMateriais"
  FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- Seed inicial: 5 materiais padrão (somente se a tabela estiver vazia)
-- ============================================================================
INSERT INTO public."CatalogoMateriais"
  (nome_material, categoria, unidade, preco_custo, nivel_padrao)
SELECT * FROM (VALUES
  ('MDF 15mm Branco TX',          'MDF 15mm',     'm²', 48.00::numeric, 'padrao'),
  ('MDF 18mm Branco TX',          'MDF 18mm',     'm²', 58.00::numeric, 'padrao'),
  ('MDF 6mm Branco TX',           'MDF 6mm',      'm²', 26.00::numeric, 'padrao'),
  ('Fita de Borda 22mm',          'Fita de Borda','m',   1.40::numeric, 'padrao'),
  ('Corrediça Telescópica 450mm', 'Ferragem',     'par',32.00::numeric, 'padrao')
) AS v(nome_material, categoria, unidade, preco_custo, nivel_padrao)
WHERE NOT EXISTS (SELECT 1 FROM public."CatalogoMateriais");
