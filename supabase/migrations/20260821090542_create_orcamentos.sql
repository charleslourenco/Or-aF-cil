-- Migration: Criar tabela Orcamentos
-- Data: 2026-08-21

CREATE TABLE IF NOT EXISTS public."Orcamentos" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nome TEXT NOT NULL,
  ambiente TEXT,
  modulo TEXT,
  data TIMESTAMPTZ DEFAULT now(),
  valor_total NUMERIC,
  status TEXT DEFAULT 'Rascunho',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public."Orcamentos" ENABLE ROW LEVEL SECURITY;

-- Policies for anon & authenticated so app works seamlessly
DROP POLICY IF EXISTS "orcamentos_select_authenticated" ON public."Orcamentos";
CREATE POLICY "orcamentos_select_authenticated" ON public."Orcamentos"
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "orcamentos_select_anon" ON public."Orcamentos";
CREATE POLICY "orcamentos_select_anon" ON public."Orcamentos"
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "orcamentos_insert_authenticated" ON public."Orcamentos";
CREATE POLICY "orcamentos_insert_authenticated" ON public."Orcamentos"
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "orcamentos_insert_anon" ON public."Orcamentos";
CREATE POLICY "orcamentos_insert_anon" ON public."Orcamentos"
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "orcamentos_update_authenticated" ON public."Orcamentos";
CREATE POLICY "orcamentos_update_authenticated" ON public."Orcamentos"
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "orcamentos_update_anon" ON public."Orcamentos";
CREATE POLICY "orcamentos_update_anon" ON public."Orcamentos"
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "orcamentos_delete_authenticated" ON public."Orcamentos";
CREATE POLICY "orcamentos_delete_authenticated" ON public."Orcamentos"
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "orcamentos_delete_anon" ON public."Orcamentos";
CREATE POLICY "orcamentos_delete_anon" ON public."Orcamentos"
  FOR DELETE TO anon USING (true);
