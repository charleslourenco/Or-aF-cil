-- Adiciona coluna perfil_construtivo na tabela TemplatesEngenharia
ALTER TABLE public."TemplatesEngenharia" 
ADD COLUMN IF NOT EXISTS perfil_construtivo text DEFAULT 'Fechado Envelopado';

-- Atualização determinística dos módulos existentes por nome e categoria
-- 1) Balcão / Bancada / Pia -> 'Balcão (tampo por conta do cliente)'
UPDATE public."TemplatesEngenharia"
SET perfil_construtivo = 'Balcão (tampo por conta do cliente)'
WHERE lower(nome_template) ~* '(balc[aã]o|bancada|pia)'
   OR lower(coalesce(categoria, '')) ~* '(balc[aã]o|bancada)';

-- 2) Aberto / Painel -> Painel, TV, Rack, Estante aberta, Nicho aberto, Closet aberto
UPDATE public."TemplatesEngenharia"
SET perfil_construtivo = 'Aberto / Painel'
WHERE lower(nome_template) ~* '(painel|tv|rack|estante|nicho|aberto|closet)'
   OR lower(coalesce(categoria, '')) ~* '(painel|estante)';

-- 3) Caixa Simples -> Aéreo simples, nicho fechado básico
UPDATE public."TemplatesEngenharia"
SET perfil_construtivo = 'Caixa Simples'
WHERE lower(nome_template) ~* '(a[eé]reo|suspenso)'
  AND NOT lower(nome_template) ~* '(painel|tv|rack|estante|balc[aã]o)';

-- 4) Fechado Envelopado -> Roupeiro, Armário, Guarda-roupa, Dresser, Gaveteiro, Multiuso e demais como default
UPDATE public."TemplatesEngenharia"
SET perfil_construtivo = 'Fechado Envelopado'
WHERE lower(nome_template) ~* '(roupeiro|arm[aá]rio|guarda.roupa|dresser|gaveteiro|multiuso|sapateira|torre|paneleiro)'
   OR perfil_construtivo IS NULL;

-- Também adiciona na tabela templatesengenharia (em minúsculas) se existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'templatesengenharia') THEN
    ALTER TABLE public.templatesengenharia ADD COLUMN IF NOT EXISTS perfil_construtivo text DEFAULT 'Fechado Envelopado';
    
    UPDATE public.templatesengenharia
    SET perfil_construtivo = 'Balcão (tampo por conta do cliente)'
    WHERE lower(nome_template) ~* '(balc[aã]o|bancada|pia)';

    UPDATE public.templatesengenharia
    SET perfil_construtivo = 'Aberto / Painel'
    WHERE lower(nome_template) ~* '(painel|tv|rack|estante|nicho|aberto|closet)';

    UPDATE public.templatesengenharia
    SET perfil_construtivo = 'Caixa Simples'
    WHERE lower(nome_template) ~* '(a[eé]reo|suspenso)'
      AND NOT lower(nome_template) ~* '(painel|tv|rack|estante|balc[aã]o)';

    UPDATE public.templatesengenharia
    SET perfil_construtivo = 'Fechado Envelopado'
    WHERE lower(nome_template) ~* '(roupeiro|arm[aá]rio|guarda.roupa|dresser|gaveteiro|multiuso|sapateira|torre|paneleiro)'
       OR perfil_construtivo IS NULL;
  END IF;
END $$;
