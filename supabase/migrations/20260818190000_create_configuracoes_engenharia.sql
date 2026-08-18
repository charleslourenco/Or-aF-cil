-- Tabela de configurações de Engenharia Financeira (Custeio por Absorção)
CREATE TABLE IF NOT EXISTS public.configuracoes_engenharia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_faturamento NUMERIC NOT NULL DEFAULT 50000,
  impostos_percent NUMERIC NOT NULL DEFAULT 10.0,
  comissoes_percent NUMERIC NOT NULL DEFAULT 5.0,
  custo_financeiro_percent NUMERIC NOT NULL DEFAULT 3.0,
  markup_padrao NUMERIC NOT NULL DEFAULT 2.5,
  perda_material_percent NUMERIC NOT NULL DEFAULT 20.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de custos fixos da operação (rateio)
CREATE TABLE IF NOT EXISTS public.custos_fixos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.configuracoes_engenharia(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS custos_fixos_config_id_idx ON public.custos_fixos(config_id);

-- Habilita RLS
ALTER TABLE public.configuracoes_engenharia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custos_fixos ENABLE ROW LEVEL SECURITY;

-- Políticas: leitura liberada para anon/authenticated; escrita apenas authenticated
DROP POLICY IF EXISTS "config_eng_read" ON public.configuracoes_engenharia;
CREATE POLICY "config_eng_read" ON public.configuracoes_engenharia
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "config_eng_insert" ON public.configuracoes_engenharia;
CREATE POLICY "config_eng_insert" ON public.configuracoes_engenharia
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "config_eng_update" ON public.configuracoes_engenharia;
CREATE POLICY "config_eng_update" ON public.configuracoes_engenharia
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "config_eng_delete" ON public.configuracoes_engenharia;
CREATE POLICY "config_eng_delete" ON public.configuracoes_engenharia
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "custos_fixos_read" ON public.custos_fixos;
CREATE POLICY "custos_fixos_read" ON public.custos_fixos
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "custos_fixos_insert" ON public.custos_fixos;
CREATE POLICY "custos_fixos_insert" ON public.custos_fixos
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "custos_fixos_update" ON public.custos_fixos;
CREATE POLICY "custos_fixos_update" ON public.custos_fixos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "custos_fixos_delete" ON public.custos_fixos;
CREATE POLICY "custos_fixos_delete" ON public.custos_fixos
  FOR DELETE TO authenticated USING (true);

-- Seed: uma linha padrão de configuração e 3 custos fixos de exemplo (idempotente)
DO $$
DECLARE
  cfg_id UUID;
BEGIN
  SELECT id INTO cfg_id FROM public.configuracoes_engenharia LIMIT 1;
  IF cfg_id IS NULL THEN
    INSERT INTO public.configuracoes_engenharia (meta_faturamento, impostos_percent, comissoes_percent, custo_financeiro_percent, markup_padrao, perda_material_percent)
    VALUES (50000, 10.0, 5.0, 3.0, 2.5, 20.0)
    RETURNING id INTO cfg_id;

    INSERT INTO public.custos_fixos (config_id, descricao, valor) VALUES
      (cfg_id, 'Aluguel', 3000),
      (cfg_id, 'Salários', 8000),
      (cfg_id, 'Contador', 500);
  END IF;
END $$;
