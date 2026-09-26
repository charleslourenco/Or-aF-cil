-- Migration: Cadastrar itens de iluminação no catálogo (Ajuste 2)
-- Data: 2026-09-26
-- Itens: Perfil de Alumínio para LED, Fita LED 12V, Fonte Slim 12V

INSERT INTO public."CatalogoMateriais" (nome_material, categoria, unidade, preco_custo, nivel_padrao, ativo)
SELECT 'Perfil de Alumínio para LED', 'Ferragem', 'm', 35.00, 'padrao', true
WHERE NOT EXISTS (
  SELECT 1 FROM public."CatalogoMateriais" WHERE lower(nome_material) = lower('Perfil de Alumínio para LED')
);

INSERT INTO public."CatalogoMateriais" (nome_material, categoria, unidade, preco_custo, nivel_padrao, ativo)
SELECT 'Fita LED 12V', 'Ferragem', 'm', 25.00, 'padrao', true
WHERE NOT EXISTS (
  SELECT 1 FROM public."CatalogoMateriais" WHERE lower(nome_material) = lower('Fita LED 12V')
);

INSERT INTO public."CatalogoMateriais" (nome_material, categoria, unidade, preco_custo, nivel_padrao, ativo)
SELECT 'Fonte Slim 12V', 'Ferragem', 'un', 45.00, 'padrao', true
WHERE NOT EXISTS (
  SELECT 1 FROM public."CatalogoMateriais" WHERE lower(nome_material) = lower('Fonte Slim 12V')
);
