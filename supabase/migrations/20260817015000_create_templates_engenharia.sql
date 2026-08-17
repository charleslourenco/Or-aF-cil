-- Tabela de templates de engenharia (módulos de marcenaria) utilizada no
-- formulário de Novo Orçamento para o Select dinâmico de Módulos.
CREATE TABLE IF NOT EXISTS public."TemplatesEngenharia" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_template TEXT NOT NULL,
  categoria TEXT,
  dimensoes TEXT,
  material TEXT,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilita RLS
ALTER TABLE public."TemplatesEngenharia" ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (apenas leitura pública para o catálogo de templates)
DROP POLICY IF EXISTS "templates_select_authenticated" ON public."TemplatesEngenharia";
CREATE POLICY "templates_select_authenticated" ON public."TemplatesEngenharia"
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "templates_select_anon" ON public."TemplatesEngenharia";
CREATE POLICY "templates_select_anon" ON public."TemplatesEngenharia"
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "templates_insert_authenticated" ON public."TemplatesEngenharia";
CREATE POLICY "templates_insert_authenticated" ON public."TemplatesEngenharia"
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "templates_update_authenticated" ON public."TemplatesEngenharia";
CREATE POLICY "templates_update_authenticated" ON public."TemplatesEngenharia"
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "templates_delete_authenticated" ON public."TemplatesEngenharia";
CREATE POLICY "templates_delete_authenticated" ON public."TemplatesEngenharia"
  FOR DELETE TO authenticated USING (true);

-- Dados de exemplo para o Select de Módulos
INSERT INTO public."TemplatesEngenharia" (nome_template, categoria, dimensoes, material, descricao) VALUES
  ('Roupeiro 2 Portas — Linha Clássica', 'Quarto', '2000 x 1200 x 600 mm', 'MDP / MDF 18mm', 'Módulo de roupeiro com 2 portas de giro, prateleiras internas ajustáveis e maleiro reforçado.'),
  ('Balcão de Cozinha 2 Portas e 2 Gavetas', 'Cozinha', '850 x 1200 x 580 mm', 'MDF 18mm Ultra', 'Balcão baixo para pia ou tampo de granito, com divisória para gaveteiro e portas inferiores.'),
  ('Armário Aéreo Basculante 1 Porta', 'Cozinha / Sala', '600 x 900 x 350 mm', 'MDF 18mm acetinado', 'Armário suspenso moderno com abertura basculante assistida e sistema de fixação oculta.')
ON CONFLICT DO NOTHING;
