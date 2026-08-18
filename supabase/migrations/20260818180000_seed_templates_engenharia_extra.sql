-- Popula a tabela TemplatesEngenharia com módulos adicionais até totalizar
-- pelo menos 30 registros. Idempotente: só insere os módulos que ainda não
-- existem (comparação por nome_template). Não altera os registros já presentes.
--
-- Ambientes cobertos: Cozinha, Quarto, Sala, Banheiro, Lavanderia, Home Office.

INSERT INTO "TemplatesEngenharia" (
  nome_template, categoria, dimensoes, material, descricao, icon_type, assinatura_visual
)
SELECT t.nome_template, t.categoria, t.dimensoes, t.material, t.descricao, t.icon_type, t.assinatura_visual
FROM (
  VALUES
    -- ===== COZINHA =====
    ('Bancada Pia Cozinha 1200'::text, 'Cozinha'::text, '1200 x 900 x 600 mm'::text, 'MDF 18mm Ultra'::text, 'Balcão baixo para pia com recorte para cuba de embutir e gaveta inferior.'::text, 'counter'::text, ARRAY['Cozinha','Bancada','Pia','Baixo']::text[]),
    ('Despenseiro Deslizante 600'::text, 'Cozinha'::text, '600 x 1800 x 560 mm'::text, 'MDF 18mm'::text, 'Despenseiro alto com prateleiras internas e sistema de portas deslizantes.'::text, 'wardrobe'::text, ARRAY['Cozinha','Despenseiro','Deslizante','Alto']::text[]),
    ('Armário Aéreo Canto 600x600'::text, 'Cozinha'::text, '600 x 700 x 600 mm'::text, 'MDF 15mm'::text, 'Armário aéreo de canto com prateleira giratória interna.'::text, 'aerial'::text, ARRAY['Cozinha','Aéreo','Canto','Suspenso']::text[]),
    ('Nicho Embutido Cozinha 400'::text, 'Cozinha'::text, '400 x 400 x 150 mm'::text, 'MDF 15mm'::text, 'Nicho de parede para micro-ondas e eletrodomésticos compactos.'::text, 'aerial'::text, ARRAY['Cozinha','Nicho','Embutido','Suspenso']::text[]),
    ('Ilha de Cozinha com Cooktop 1800'::text, 'Cozinha'::text, '1800 x 900 x 900 mm'::text, 'MDF 18mm + Tampo Sintético'::text, 'Ilha central com cooktop embutido, gavetas frontais e bancada para refeições.'::text, 'counter'::text, ARRAY['Cozinha','Ilha','Cooktop','Bancada','Premium']::text[]),
    ('Gaveteiro Pantry 5 Gavetas'::text, 'Cozinha'::text, '500 x 1800 x 560 mm'::text, 'MDF 18mm Ultra'::text, 'Coluna gaveteira com 5 gavetas telescópicas para mantimentos e utensílios.'::text, 'wardrobe'::text, ARRAY['Cozinha','Gaveteiro','5 Gavetas','Coluna']::text[]),
    ('Armário Aéreo 2 Portas 800'::text, 'Cozinha'::text, '800 x 700 x 350 mm'::text, 'MDF 15mm Acetinado'::text, 'Armário suspenso com 2 portas de giro e prateleira interna regulável.'::text, 'aerial'::text, ARRAY['Cozinha','Aéreo','2 Portas','Suspenso']::text[]),

    -- ===== QUARTO =====
    ('Roupeiro 6 Portas Casal Premium'::text, 'Quarto'::text, '2500 x 2400 x 600 mm'::text, 'MDF 18mm Frentes Acabadas'::text, 'Roupeiro amplo com 6 portas de giro, maleiro, cabideiros e gaveteiro interno.'::text, 'wardrobe'::text, ARRAY['Quarto','Roupeiro','6 Portas','Casal','Premium']::text[]),
    ('Cômoda 4 Gavetas Solteiro'::text, 'Quarto'::text, '900 x 800 x 450 mm'::text, 'MDF 18mm'::text, 'Cômoda baixa com 4 gavetas com corrediças telescópicas e puxadores embutidos.'::text, 'counter'::text, ARRAY['Quarto','Cômoda','4 Gavetas','Solteiro']::text[]),
    ('Criado-Mudo 1 Gaveta 400'::text, 'Quarto'::text, '400 x 550 x 400 mm'::text, 'MDF 15mm'::text, 'Criado-mudo compacto com 1 gaveta e prateleira inferior aberta.'::text, 'counter'::text, ARRAY['Quarto','Criado-Mudo','1 Gaveta','Compacto']::text[]),
    ('Cabeceira Casal Estofada 1600'::text, 'Quarto'::text, '1600 x 1100 x 120 mm'::text, 'MDF 15mm + Espuma'::text, 'Cabeceira estofada para cama de casal com acabamento em tecido.'::text, 'aerial'::text, ARRAY['Quarto','Cabeceira','Estofada','Casal']::text[]),
    ('Painel Cabeceira Casal com Nichos'::text, 'Quarto'::text, '1800 x 1500 x 300 mm'::text, 'MDF 18mm'::text, 'Painel de cabeceira com nichos laterais e iluminação em LED embutida.'::text, 'aerial'::text, ARRAY['Quarto','Painel','Cabeceira','Nichos','Premium']::text[]),
    ('Roupeiro Deslizante 3 Portas'::text, 'Quarto'::text, '2100 x 2400 x 650 mm'::text, 'MDF 18mm Espelhado'::text, 'Roupeiro com 3 portas deslizantes com espelho e interior modular.'::text, 'wardrobe'::text, ARRAY['Quarto','Roupeiro','Deslizante','Espelho']::text[]),

    -- ===== SALA =====
    ('Rack TV Suspenso 1400'::text, 'Sala'::text, '1400 x 350 x 400 mm'::text, 'MDF 18mm'::text, 'Rack suspenso para TV com gaveta e passagem de cabos.'::text, 'aerial'::text, ARRAY['Sala','Rack','Suspenso','TV']::text[]),
    ('Estante Livros 5 Prateleiras'::text, 'Sala'::text, '1000 x 2000 x 320 mm'::text, 'MDF 18mm'::text, 'Estante fixa com 5 prateleiras reguláveis e fundo fechado.'::text, 'aerial'::text, ARRAY['Sala','Estante','Livros','5 Prateleiras']::text[]),
    ('Home Theater 3 Nichos'::text, 'Sala'::text, '2400 x 1800 x 400 mm'::text, 'MDF 18mm Frentes Acabadas'::text, 'Conjunto home theater com 3 nichos para equipamentos e caixas de som.'::text, 'wardrobe'::text, ARRAY['Sala','Home Theater','Nichos','Equipamentos']::text[]),
    ('Buffet Sala de Jantar 1600'::text, 'Sala'::text, '1600 x 900 x 450 mm'::text, 'MDF 18mm'::text, 'Buffet para sala de jantar com 4 portas e tampo para apoiar louças.'::text, 'counter'::text, ARRAY['Sala','Buffet','Jantar','4 Portas']::text[]),
    ('Painel TV Slim 2000'::text, 'Sala'::text, '2000 x 1800 x 80 mm'::text, 'MDF 15mm'::text, 'Painel decorativo slim para TV até 75 polegadas com nichos embutidos.'::text, 'aerial'::text, ARRAY['Sala','Painel TV','Slim','Decorativo']::text[]),

    -- ===== BANHEIRO =====
    ('Gabinete Banheiro Coluna Dupla'::text, 'Banheiro'::text, '900 x 800 x 450 mm'::text, 'MDF Naval 18mm'::text, 'Gabinete com coluna dupla e prateleiras internas para organização.'::text, 'counter'::text, ARRAY['Banheiro','Gabinete','Coluna','Dupla']::text[]),
    ('Nicho Embutido Banheiro 300'::text, 'Banheiro'::text, '300 x 500 x 150 mm'::text, 'MDF Naval 15mm'::text, 'Nicho embutido para box com prateleira para produtos de higiene.'::text, 'aerial'::text, ARRAY['Banheiro','Nicho','Embutido','Box']::text[]),
    ('Coluna Banheiro Estreita 350'::text, 'Banheiro'::text, '350 x 2000 x 350 mm'::text, 'MDF Naval 18mm'::text, 'Coluna alta para banheiro com prateleiras e espaço para toalhas.'::text, 'wardrobe'::text, ARRAY['Banheiro','Coluna','Alto','Toalhas']::text[]),

    -- ===== LAVANDERIA =====
    ('Armário Lavanderia Aéreo 800'::text, 'Lavanderia'::text, '800 x 700 x 350 mm'::text, 'MDF Naval 15mm'::text, 'Armário suspenso para lavanderia com prateleiras para produtos de limpeza.'::text, 'aerial'::text, ARRAY['Lavanderia','Armário','Aéreo','Suspenso']::text[]),
    ('Bancada Lavanderia 1500'::text, 'Lavanderia'::text, '1500 x 900 x 550 mm'::text, 'MDF Naval 18mm'::text, 'Bancada baixa para tanque e máquina com gavetas e espaço para tanque.'::text, 'counter'::text, ARRAY['Lavanderia','Bancada','Tanque','Baixo']::text[]),
    ('Tanque Armário Embutido 600'::text, 'Lavanderia'::text, '600 x 900 x 550 mm'::text, 'MDF Naval 18mm'::text, 'Armário com tanque de embutir e portas inferiores para armazenagem.'::text, 'counter'::text, ARRAY['Lavanderia','Tanque','Embutir','Portas']::text[]),

    -- ===== HOME OFFICE =====
    ('Escrivaninha Home Office 1200'::text, 'Home Office'::text, '1200 x 750 x 600 mm'::text, 'MDF 18mm'::text, 'Escrivaninha com gaveta para teclado, passagem de cabos e prateleira lateral.'::text, 'counter'::text, ARRAY['Home Office','Escrivaninha','Trabalho','Gaveta']::text[]),
    ('Estante Vertical Office 2000'::text, 'Home Office'::text, '800 x 2000 x 350 mm'::text, 'MDF 18mm'::text, 'Estante vertical com prateleiras ajustáveis para livros e arquivos.'::text, 'wardrobe'::text, ARRAY['Home Office','Estante','Vertical','Arquivos']::text[]),
    ('Gaveteiro Móvel Office 3 Gavetas'::text, 'Home Office'::text, '450 x 650 x 550 mm'::text, 'MDF 18mm'::text, 'Gaveteiro móvel com rodízios e 3 gavetas para arquivamento.'::text, 'counter'::text, ARRAY['Home Office','Gaveteiro','Móvel','Arquivo']::text[])
) AS t(nome_template, categoria, dimensoes, material, descricao, icon_type, assinatura_visual)
WHERE NOT EXISTS (
  SELECT 1 FROM "TemplatesEngenharia" te WHERE te.nome_template = t.nome_template
);
