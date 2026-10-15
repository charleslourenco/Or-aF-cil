-- Complementos comerciais do orçamento: contato do cliente, endereço da obra,
-- serviços adicionais (instalação, frete...), desconto, validade, prazo de entrega e revisão.
ALTER TABLE public."Orcamentos"
  ADD COLUMN IF NOT EXISTS condicoes_json JSONB;
