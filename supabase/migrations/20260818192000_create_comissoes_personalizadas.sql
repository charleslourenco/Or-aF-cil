-- Tabela de comissões/variáveis personalizadas por configuração de engenharia
CREATE TABLE IF NOT EXISTS public.comissoes_personalizadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.configuracoes_engenharia(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  percentual NUMERIC(10,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comissoes_personalizadas_config_id_idx
  ON public.comissoes_personalizadas(config_id);

ALTER TABLE public.comissoes_personalizadas ENABLE ROW LEVEL SECURITY;

-- Leitura para anon e authenticated
DROP POLICY IF EXISTS "comissoes_personalizadas_read" ON public.comissoes_personalizadas;
CREATE POLICY "comissoes_personalizadas_read" ON public.comissoes_personalizadas
  FOR SELECT TO anon, authenticated USING (true);

-- Escrita (insert/update/delete) apenas para authenticated
DROP POLICY IF EXISTS "comissoes_personalizadas_insert" ON public.comissoes_personalizadas;
CREATE POLICY "comissoes_personalizadas_insert" ON public.comissoes_personalizadas
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "comissoes_personalizadas_update" ON public.comissoes_personalizadas;
CREATE POLICY "comissoes_personalizadas_update" ON public.comissoes_personalizadas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "comissoes_personalizadas_delete" ON public.comissoes_personalizadas;
CREATE POLICY "comissoes_personalizadas_delete" ON public.comissoes_personalizadas
  FOR DELETE TO authenticated USING (true);
