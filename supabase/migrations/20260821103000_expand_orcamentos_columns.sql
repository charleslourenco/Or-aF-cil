-- Migration: Adicionar colunas comerciais e técnicas à tabela Orcamentos
ALTER TABLE public."Orcamentos" ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
ALTER TABLE public."Orcamentos" ADD COLUMN IF NOT EXISTS observacoes TEXT;
ALTER TABLE public."Orcamentos" ADD COLUMN IF NOT EXISTS bom_json JSONB;
ALTER TABLE public."Orcamentos" ADD COLUMN IF NOT EXISTS dre_json JSONB;
