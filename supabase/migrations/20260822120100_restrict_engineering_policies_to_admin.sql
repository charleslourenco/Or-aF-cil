-- Migration: Update RLS policies for engineering tables to restrict write access to admin only

-- 1. configuracoes_engenharia
DROP POLICY IF EXISTS "config_eng_read" ON public.configuracoes_engenharia;
CREATE POLICY "config_eng_read" ON public.configuracoes_engenharia
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "config_eng_insert" ON public.configuracoes_engenharia;
CREATE POLICY "config_eng_insert" ON public.configuracoes_engenharia
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "config_eng_update" ON public.configuracoes_engenharia;
CREATE POLICY "config_eng_update" ON public.configuracoes_engenharia
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "config_eng_delete" ON public.configuracoes_engenharia;
CREATE POLICY "config_eng_delete" ON public.configuracoes_engenharia
  FOR DELETE TO authenticated USING (public.is_admin());

-- 2. custos_fixos
DROP POLICY IF EXISTS "custos_fixos_read" ON public.custos_fixos;
CREATE POLICY "custos_fixos_read" ON public.custos_fixos
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "custos_fixos_insert" ON public.custos_fixos;
CREATE POLICY "custos_fixos_insert" ON public.custos_fixos
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "custos_fixos_update" ON public.custos_fixos;
CREATE POLICY "custos_fixos_update" ON public.custos_fixos
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "custos_fixos_delete" ON public.custos_fixos;
CREATE POLICY "custos_fixos_delete" ON public.custos_fixos
  FOR DELETE TO authenticated USING (public.is_admin());

-- 3. custos_variaveis
DROP POLICY IF EXISTS "custos_variaveis_read" ON public.custos_variaveis;
CREATE POLICY "custos_variaveis_read" ON public.custos_variaveis
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "custos_variaveis_insert" ON public.custos_variaveis;
CREATE POLICY "custos_variaveis_insert" ON public.custos_variaveis
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "custos_variaveis_update" ON public.custos_variaveis;
CREATE POLICY "custos_variaveis_update" ON public.custos_variaveis
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "custos_variaveis_delete" ON public.custos_variaveis;
CREATE POLICY "custos_variaveis_delete" ON public.custos_variaveis
  FOR DELETE TO authenticated USING (public.is_admin());

-- 4. comissoes_personalizadas
DROP POLICY IF EXISTS "comissoes_personalizadas_read" ON public.comissoes_personalizadas;
CREATE POLICY "comissoes_personalizadas_read" ON public.comissoes_personalizadas
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "comissoes_personalizadas_insert" ON public.comissoes_personalizadas;
CREATE POLICY "comissoes_personalizadas_insert" ON public.comissoes_personalizadas
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "comissoes_personalizadas_update" ON public.comissoes_personalizadas;
CREATE POLICY "comissoes_personalizadas_update" ON public.comissoes_personalizadas
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "comissoes_personalizadas_delete" ON public.comissoes_personalizadas;
CREATE POLICY "comissoes_personalizadas_delete" ON public.comissoes_personalizadas
  FOR DELETE TO authenticated USING (public.is_admin());
