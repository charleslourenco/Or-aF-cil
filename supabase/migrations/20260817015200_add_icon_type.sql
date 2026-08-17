-- Adiciona coluna icon_type para que os blueprints visuais possam ser
-- renderizados a partir dos dados dinâmicos do Supabase.
ALTER TABLE public."TemplatesEngenharia"
  ADD COLUMN IF NOT EXISTS icon_type TEXT NOT NULL DEFAULT 'wardrobe';

-- Atualiza os registros de exemplo com o tipo de ícone correspondente.
UPDATE public."TemplatesEngenharia" SET icon_type = 'wardrobe'
  WHERE nome_template ILIKE '%Roupeiro%';
UPDATE public."TemplatesEngenharia" SET icon_type = 'counter'
  WHERE nome_template ILIKE '%Balcão%';
UPDATE public."TemplatesEngenharia" SET icon_type = 'aerial'
  WHERE nome_template ILIKE '%Aéreo%';
