-- Adiciona a coluna ambientes_json na tabela Orcamentos para suporte a múltiplos ambientes e múltiplos módulos
ALTER TABLE public."Orcamentos"
  ADD COLUMN IF NOT EXISTS ambientes_json JSONB DEFAULT '[]'::jsonb;

-- Comentário explicativo da estrutura esperada em ambientes_json:
-- [
--   {
--     "id": "uuid/string",
--     "nome": "Cozinha",
--     "modulos": [
--       {
--         "id": "uuid/string",
--         "modulo_id": "MOD-1",
--         "nome": "Armário Superior 2 Portas",
--         "dimensoes": { "largura": 1200, "altura": 700, "profundidade": 350 },
--         "mdf_externo": "Branco TX (18mm)",
--         "mdf_interno": "Branco TX (15mm)",
--         "mdf_fundo": "MDF 6mm Branco TX",
--         "padrao_projeto": "comercial",
--         "imagem_url": null,
--         "itens": [...],
--         "subtotal": 1500.00
--       }
--     ],
--     "subtotal": 1500.00
--   }
-- ]
