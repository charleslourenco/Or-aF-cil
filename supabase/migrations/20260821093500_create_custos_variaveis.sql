-- Tabela para armazenar os custos variáveis da estrutura da fábrica
CREATE TABLE IF NOT EXISTS public.custos_variaveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.configuracoes_engenharia(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para acelerar busca por config_id
CREATE INDEX IF NOT EXISTS custos_variaveis_config_id_idx ON public.custos_variaveis(config_id);

-- RLS
ALTER TABLE public.custos_variaveis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "custos_variaveis_read" ON public.custos_variaveis;
CREATE POLICY "custos_variaveis_read" ON public.custos_variaveis
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "custos_variaveis_insert" ON public.custos_variaveis;
CREATE POLICY "custos_variaveis_insert" ON public.custos_variaveis
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "custos_variaveis_update" ON public.custos_variaveis;
CREATE POLICY "custos_variaveis_update" ON public.custos_variaveis
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "custos_variaveis_delete" ON public.custos_variaveis;
CREATE POLICY "custos_variaveis_delete" ON public.custos_variaveis
  FOR DELETE TO authenticated USING (true);
