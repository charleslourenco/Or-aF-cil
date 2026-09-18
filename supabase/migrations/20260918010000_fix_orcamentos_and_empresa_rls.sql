-- Migration: Corrigir vulnerabilidade RLS na tabela Orcamentos e restringir permissoes anonimas
-- Removendo politicas permissivas para 'anon' (inclusive delecao/escrita anonima)
-- Implementando modelo de seguranca baseado em papeis:
-- Leitura: todos os autenticados (authenticated)
-- Escrita/Atualizacao: editor e admin (is_editor_or_admin())
-- Delecao: apenas admin (is_admin())

-- 1. Remover TODAS as politicas anon e autenticadas antigas da tabela Orcamentos
DROP POLICY IF EXISTS "orcamentos_select_anon" ON public."Orcamentos";
DROP POLICY IF EXISTS "orcamentos_insert_anon" ON public."Orcamentos";
DROP POLICY IF EXISTS "orcamentos_update_anon" ON public."Orcamentos";
DROP POLICY IF EXISTS "orcamentos_delete_anon" ON public."Orcamentos";

DROP POLICY IF EXISTS "orcamentos_select_authenticated" ON public."Orcamentos";
DROP POLICY IF EXISTS "orcamentos_insert_authenticated" ON public."Orcamentos";
DROP POLICY IF EXISTS "orcamentos_update_authenticated" ON public."Orcamentos";
DROP POLICY IF EXISTS "orcamentos_delete_authenticated" ON public."Orcamentos";

-- 2. Recriar politicas restritas na tabela Orcamentos
-- SELECT: Leitura para todos os usuarios autenticados
CREATE POLICY "orcamentos_select_authenticated" ON public."Orcamentos"
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: Apenas admin e editor podem criar orcamentos
CREATE POLICY "orcamentos_insert_authenticated" ON public."Orcamentos"
  FOR INSERT TO authenticated
  WITH CHECK (public.is_editor_or_admin());

-- UPDATE: Apenas admin e editor podem atualizar orcamentos
CREATE POLICY "orcamentos_update_authenticated" ON public."Orcamentos"
  FOR UPDATE TO authenticated
  USING (public.is_editor_or_admin())
  WITH CHECK (public.is_editor_or_admin());

-- DELETE: Apenas administradores podem excluir orcamentos
CREATE POLICY "orcamentos_delete_authenticated" ON public."Orcamentos"
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 3. Corrigir vulnerabilidades em perfil_empresa (tinha INSERT/UPDATE anonimo liberado)
DROP POLICY IF EXISTS "perfil_empresa_insert_anon" ON public.perfil_empresa;
DROP POLICY IF EXISTS "perfil_empresa_update_anon" ON public.perfil_empresa;
DROP POLICY IF EXISTS "perfil_empresa_select_anon" ON public.perfil_empresa;

DROP POLICY IF EXISTS "perfil_empresa_select_auth" ON public.perfil_empresa;
DROP POLICY IF EXISTS "perfil_empresa_insert_auth" ON public.perfil_empresa;
DROP POLICY IF EXISTS "perfil_empresa_update_auth" ON public.perfil_empresa;
DROP POLICY IF EXISTS "perfil_empresa_delete_auth" ON public.perfil_empresa;

-- SELECT: Autenticados podem ler perfil da empresa
CREATE POLICY "perfil_empresa_select_auth" ON public.perfil_empresa
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: Admin pode criar perfil da empresa
CREATE POLICY "perfil_empresa_insert_auth" ON public.perfil_empresa
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- UPDATE: Admin pode atualizar perfil da empresa
CREATE POLICY "perfil_empresa_update_auth" ON public.perfil_empresa
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- DELETE: Apenas admin
CREATE POLICY "perfil_empresa_delete_auth" ON public.perfil_empresa
  FOR DELETE TO authenticated
  USING (public.is_admin());
