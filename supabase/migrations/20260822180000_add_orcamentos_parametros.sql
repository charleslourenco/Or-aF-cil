-- Migration: Adicionar dimensoes_json, mdf_externo, mdf_interno, mdf_fundo, padrao_projeto na tabela Orcamentos
ALTER TABLE public."Orcamentos"
  ADD COLUMN IF NOT EXISTS dimensoes_json JSONB,
  ADD COLUMN IF NOT EXISTS mdf_externo TEXT,
  ADD COLUMN IF NOT EXISTS mdf_interno TEXT,
  ADD COLUMN IF NOT EXISTS mdf_fundo TEXT,
  ADD COLUMN IF NOT EXISTS padrao_projeto TEXT;
