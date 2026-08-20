-- Adiciona as colunas codigo, pecas_mdf e ferragens na tabela TemplatesEngenharia
ALTER TABLE public."TemplatesEngenharia"
  ADD COLUMN IF NOT EXISTS codigo TEXT,
  ADD COLUMN IF NOT EXISTS pecas_mdf JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ferragens JSONB DEFAULT NULL;
