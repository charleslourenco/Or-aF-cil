-- Migration: Atualizar taxonomia de categorias e reclassificar itens no Catálogo e Orçamentos
-- Data: 2026-09-26 03:40:00
-- Itens:
-- 1. Atualizar CHECK constraint da coluna categoria em CatalogoMateriais para permitir as 13 categorias oficiais
-- 2. Mover os 3 itens de LED do catálogo para a categoria 'Iluminação' mantendo nomes, unidades e preços intactos
-- 3. Reclassificar itens avulsos em bom_json e ambientes_json de orçamentos existentes

-- 1. Atualizar constraint de categoria em public."CatalogoMateriais"
ALTER TABLE public."CatalogoMateriais"
  DROP CONSTRAINT IF EXISTS "CatalogoMateriais_categoria_check";

ALTER TABLE public."CatalogoMateriais"
  ADD CONSTRAINT "CatalogoMateriais_categoria_check"
  CHECK (categoria = ANY (ARRAY[
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
  ]));

-- 2. Mover os 3 itens de LED do catálogo para a categoria 'Iluminação' mantendo nomes, unidades e preços intactos
UPDATE public."CatalogoMateriais"
SET categoria = 'Iluminação',
    updated_at = NOW()
WHERE lower(nome_material) IN (
  lower('Perfil de Alumínio para LED'),
  lower('Fita LED 12V'),
  lower('Fonte Slim 12V')
)
AND (categoria != 'Iluminação' OR categoria IS NULL);

-- 3. Atualizar ocorrências de categorias antigas em bom_json de orçamentos existentes
UPDATE public."Orcamentos"
SET bom_json = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem->>'material' = 'Serralheria' THEN jsonb_set(elem, '{material}', '"Serralheria Terceirizada"')
      WHEN elem->>'material' = 'Pedra' THEN jsonb_set(elem, '{material}', '"Outro"')
      WHEN elem->>'material' = 'Iluminacao' OR elem->>'material' = 'ILUMINACAO' OR elem->>'material' = 'iluminação' THEN jsonb_set(elem, '{material}', '"Iluminação"')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(bom_json) AS elem
),
updated_at = NOW()
WHERE bom_json IS NOT NULL
  AND jsonb_typeof(bom_json) = 'array'
  AND (
    bom_json::text ILIKE '%"material": "Serralheria"%'
    OR bom_json::text ILIKE '%"material": "Pedra"%'
    OR bom_json::text ILIKE '%"material": "Iluminacao"%'
  );

-- 4. Atualizar ocorrências de categorias antigas em ambientes_json de orçamentos existentes (itens aninhados nos módulos)
UPDATE public."Orcamentos"
SET ambientes_json = (
  SELECT jsonb_agg(
    jsonb_set(
      amb,
      '{modulos}',
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_set(
              mod,
              '{itens}',
              COALESCE(
                (
                  SELECT jsonb_agg(
                    CASE 
                      WHEN item->>'material' = 'Serralheria' THEN jsonb_set(item, '{material}', '"Serralheria Terceirizada"')
                      WHEN item->>'material' = 'Pedra' THEN jsonb_set(item, '{material}', '"Outro"')
                      WHEN item->>'material' = 'Iluminacao' OR item->>'material' = 'ILUMINACAO' OR item->>'material' = 'iluminação' THEN jsonb_set(item, '{material}', '"Iluminação"')
                      ELSE item
                    END
                  )
                  FROM jsonb_array_elements(mod->'itens') AS item
                ),
                mod->'itens'
              )
            )
          )
          FROM jsonb_array_elements(amb->'modulos') AS mod
        ),
        amb->'modulos'
      )
    )
  )
  FROM jsonb_array_elements(ambientes_json) AS amb
),
updated_at = NOW()
WHERE ambientes_json IS NOT NULL
  AND jsonb_typeof(ambientes_json) = 'array'
  AND (
    ambientes_json::text ILIKE '%"material": "Serralheria"%'
    OR ambientes_json::text ILIKE '%"material": "Pedra"%'
    OR ambientes_json::text ILIKE '%"material": "Iluminacao"%'
  );
