-- Adiciona a coluna assinatura_visual (text[]) na tabela TemplatesEngenharia
-- e povoa os registros existentes + novos módulos para o catálogo da Biblioteca.
-- 100% idempotente: ADD COLUMN IF NOT EXISTS + ON CONFLICT DO NOTHING nos inserts.

ALTER TABLE public."TemplatesEngenharia"
  ADD COLUMN IF NOT EXISTS assinatura_visual text[];

-- Atualiza os 3 registros existentes com suas tags (assinatura_visual).
UPDATE public."TemplatesEngenharia"
  SET assinatura_visual = ARRAY['Quarto', 'Roupeiro', '2 Portas', 'Clássico']
  WHERE nome_template = 'Roupeiro 2 Portas — Linha Clássica';

UPDATE public."TemplatesEngenharia"
  SET assinatura_visual = ARRAY['Cozinha', 'Balcão', 'Gaveteiro', '2 Portas']
  WHERE nome_template = 'Balcão de Cozinha 2 Portas e 2 Gavetas';

UPDATE public."TemplatesEngenharia"
  SET assinatura_visual = ARRAY['Cozinha', 'Sala', 'Aéreo', 'Basculante', 'Suspenso']
  WHERE nome_template = 'Armário Aéreo Basculante 1 Porta';

-- Insere 7 novos módulos variados (cozinha, quarto, sala, banheiro, home office, lavanderia).
-- ON CONFLICT DO NOTHING evita duplicação em re-runs.
INSERT INTO public."TemplatesEngenharia" (
  nome_template, categoria, dimensoes, material, descricao, icon_type, assinatura_visual
) VALUES
  (
    'Gaveteiro de Cozinha 4 Gavetas',
    'Cozinha',
    '400 x 900 x 580 mm',
    'MDF 18mm Ultra',
    'Gaveteiro baixo com 4 gavetas telescópicas e corrediças com amortecimento.',
    'counter',
    ARRAY['Cozinha', 'Gaveteiro', '4 Gavetas', 'Baixo']
  ),
  (
    'Ilha de Cozinha com Bancada',
    'Cozinha',
    '1500 x 900 x 900 mm',
    'MDF 18mm + Tampo Sintético',
    'Ilha central com nicho aberto, gavetas e bancada para refeições.',
    'counter',
    ARRAY['Cozinha', 'Ilha', 'Bancada', 'Centro']
  ),
  (
    'Roupeiro 6 Gavetas Solteiro',
    'Quarto',
    '1800 x 900 x 560 mm',
    'MDP 18mm',
    'Roupeiro compacto com cabideiro e 6 gavetas internas para quarto de solteiro.',
    'wardrobe',
    ARRAY['Quarto', 'Roupeiro', '6 Gavetas', 'Solteiro']
  ),
  (
    'Painel para TV e Rack Sala',
    'Sala',
    '2100 x 2400 x 350 mm',
    'MDF 18mm Frentes Acabadas',
    'Painel decorativo com nichos e base para TV até 70 polegadas.',
    'wardrobe',
    ARRAY['Sala', 'Painel TV', 'Rack', 'Decorativo']
  ),
  (
    'Estante Livros Home Office',
    'Home Office',
    '2000 x 1800 x 300 mm',
    'MDF 15mm',
    'Estante aberta com prateleiras ajustáveis para livros e decoração.',
    'aerial',
    ARRAY['Home Office', 'Estante', 'Livros', 'Aberta']
  ),
  (
    'Mesa Lateral Home Office',
    'Home Office',
    '750 x 1200 x 600 mm',
    'MDF 18mm',
    'Mesa de trabalho com gaveta para teclado e passagem de cabos.',
    'counter',
    ARRAY['Home Office', 'Mesa', 'Trabalho', 'Gaveta']
  ),
  (
    'Gabinete Banheiro Suspenso',
    'Banheiro',
    '500 x 800 x 450 mm',
    'MDF Naval 18mm',
    'Gabinete suspenso para cuba de embutir com 2 portas e prateleira interna.',
    'aerial',
    ARRAY['Banheiro', 'Gabinete', 'Suspenso', '2 Portas']
  ),
  (
    'Tanque Lavanderia Completo',
    'Lavanderia',
    '900 x 900 x 550 mm',
    'MDF Naval 18mm',
    'Móvel para tanque com gavetas e espaço para tanque de embutir.',
    'counter',
    ARRAY['Lavanderia', 'Tanque', 'Gavetas', 'Embutir']
  )
ON CONFLICT (id) DO NOTHING;
