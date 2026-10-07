-- Migration: Criar tabela CategoriasPersonalizadas e validação dinâmica em CatalogoMateriais
-- Data: 2026-10-07 20:00:00

-- 1. Criar tabela CategoriasPersonalizadas
CREATE TABLE IF NOT EXISTS public."CategoriasPersonalizadas" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public."CategoriasPersonalizadas" ENABLE ROW LEVEL SECURITY;

-- Políticas RLS seguindo padrão do CatalogoMateriais (anon e authenticated podem ler, authenticated pode gerenciar)
DROP POLICY IF EXISTS "categorias_personalizadas_select_anon" ON public."CategoriasPersonalizadas";
CREATE POLICY "categorias_personalizadas_select_anon" ON public."CategoriasPersonalizadas"
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "categorias_personalizadas_select_authenticated" ON public."CategoriasPersonalizadas";
CREATE POLICY "categorias_personalizadas_select_authenticated" ON public."CategoriasPersonalizadas"
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "categorias_personalizadas_insert_authenticated" ON public."CategoriasPersonalizadas";
CREATE POLICY "categorias_personalizadas_insert_authenticated" ON public."CategoriasPersonalizadas"
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "categorias_personalizadas_update_authenticated" ON public."CategoriasPersonalizadas";
CREATE POLICY "categorias_personalizadas_update_authenticated" ON public."CategoriasPersonalizadas"
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "categorias_personalizadas_delete_authenticated" ON public."CategoriasPersonalizadas";
CREATE POLICY "categorias_personalizadas_delete_authenticated" ON public."CategoriasPersonalizadas"
  FOR DELETE TO authenticated USING (true);

-- 2. Trigger para garantir normalização do nome na tabela CategoriasPersonalizadas (trim + colapsar espaços internos)
CREATE OR REPLACE FUNCTION public.normalizar_nome_categoria_personalizada()
RETURNS trigger AS $$
BEGIN
  -- Remove espaços nas pontas e colapsa múltiplos espaços em um único
  NEW.nome := regexp_replace(trim(NEW.nome), '\s+', ' ', 'g');

  IF NEW.nome = '' THEN
    RAISE EXCEPTION 'O nome da categoria não pode ser vazio.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_normalizar_categoria_personalizada" ON public."CategoriasPersonalizadas";
CREATE TRIGGER "trg_normalizar_categoria_personalizada"
  BEFORE INSERT OR UPDATE ON public."CategoriasPersonalizadas"
  FOR EACH ROW
  EXECUTE FUNCTION public.normalizar_nome_categoria_personalizada();

-- 3. Substituir o CHECK estático de CatalogoMateriais.categoria por validação que aceita as 13 fixas OU categorias personalizadas
-- Dropar o CHECK rígido
ALTER TABLE public."CatalogoMateriais"
  DROP CONSTRAINT IF EXISTS "CatalogoMateriais_categoria_check";

-- Função de validação para trigger BEFORE INSERT OR UPDATE em CatalogoMateriais
CREATE OR REPLACE FUNCTION public.validar_categoria_catalogo_materiais()
RETURNS trigger AS $$
DECLARE
  v_nome_normalizado text;
BEGIN
  v_nome_normalizado := regexp_replace(trim(NEW.categoria), '\s+', ' ', 'g');
  NEW.categoria := v_nome_normalizado;

  -- 1. Verifica se pertence à taxonomia fixa de 13 categorias
  IF NEW.categoria = ANY (ARRAY[
    'MDF 15mm'::text,
    'MDF 18mm'::text,
    'MDF 6mm'::text,
    'Fita de Borda'::text,
    'Ferragem'::text,
    'Iluminação'::text,
    'Componentes Elétricos'::text,
    'Parafusos e Sistemas de Fixação'::text,
    'Acessórios'::text,
    'Serralheria Terceirizada'::text,
    'Estofaria Terceirizada'::text,
    'Instalação'::text,
    'Outro'::text
  ]) THEN
    RETURN NEW;
  END IF;

  -- 2. Se não for fixa, verifica se existe em CategoriasPersonalizadas (comparação case-insensitive)
  IF EXISTS (
    SELECT 1 FROM public."CategoriasPersonalizadas"
    WHERE lower(nome) = lower(NEW.categoria)
  ) THEN
    RETURN NEW;
  END IF;

  -- 3. Caso contrário, levanta exceção amigável
  RAISE EXCEPTION 'Categoria "%" não é permitida. Escolha uma das 13 categorias padrão ou cadastre-a em CategoriasPersonalizadas.', NEW.categoria;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_validar_categoria_catalogo" ON public."CatalogoMateriais";
CREATE TRIGGER "trg_validar_categoria_catalogo"
  BEFORE INSERT OR UPDATE ON public."CatalogoMateriais"
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_categoria_catalogo_materiais();
