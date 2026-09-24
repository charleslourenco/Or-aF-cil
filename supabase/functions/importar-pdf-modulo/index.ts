import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'

interface PecaMdfItem {
  item?: number | string
  codigo?: string
  descricao?: string
  qtd?: number | string
  quantidade?: number | string
  comprimento?: number | string
  largura?: number | string
  espessura?: number | string
}

interface FerragemItem {
  ref?: string
  item?: string
  descricao?: string
  qtd?: number | string
  quantidade?: number | string
  unidade?: string
}

interface ExtractedModuleResponse {
  codigo_modulo?: string
  nome_template?: string
  categoria?: string
  largura_padrao?: number
  altura_padrao?: number
  profundidade_padrao?: number
  dimensoes?: string
  perfil_construtivo?: string
  composicao_mdf?: PecaMdfItem[]
  pecas_mdf?: PecaMdfItem[]
  ferragens?: FerragemItem[]
  regras_parametricas?: Record<string, unknown>
}

function cleanBase64(raw: string): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  if (trimmed.includes(',')) {
    return trimmed.split(',')[1]
  }
  return trimmed
}

function sanitizeJsonString(raw: string): string {
  let cleaned = raw.trim()
  // Remove blocos markdown ```json ... ``` ou ``` ... ```
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '')
  cleaned = cleaned.replace(/\s*```$/, '')
  // Localiza o primeiro { e o último }
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1)
  }
  return cleaned
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'OPENAI_API_KEY não configurada no servidor Supabase.',
          stage: 'ai_config',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const body = await req.json().catch(() => ({}))

    // Suporta múltiplas páginas (paginasBase64 ou imagesBase64) ou página única
    let paginas: string[] = []

    if (Array.isArray(body.paginasBase64) && body.paginasBase64.length > 0) {
      paginas = body.paginasBase64.map(cleanBase64).filter(Boolean)
    } else if (Array.isArray(body.imagesBase64) && body.imagesBase64.length > 0) {
      paginas = body.imagesBase64.map(cleanBase64).filter(Boolean)
    } else {
      const single =
        body.imagemBase64 || body.pdfBase64 || body.image || body.base64 || body.paginaBase64
      if (single) {
        paginas = [cleanBase64(single)].filter(Boolean)
      }
    }

    if (paginas.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            'Nenhuma imagem de página do PDF foi recebida. Por favor, selecione o arquivo novamente.',
          stage: 'input_validation',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Monta o prompt do sistema para extração de fichas técnicas estilo Promob / CorteCloud
    const promptSistema = `Você é um engenheiro de marcenaria industrial e orçamentista sênior do sistema OrçaFácil 3.0.
Sua missão é realizar a LEITURA COMPLETA E EXAUSTIVA de todas as páginas da ficha técnica / composição técnica enviada (gerada tipicamente por Promob, CorteCloud ou similar).

CRÍTICO:
1. NÃO OMITA NENHUMA PEÇA DA TABELA DE COMPOSIÇÃO DE MDF. Se o documento tem 50 peças, retorne TODAS as 50 peças em "composicao_mdf".
   - Cada peça deve ter:
     * "item": número sequencial (ex: 1, 2, 3...)
     * "codigo": código da peça exatamente como escrito (ex: "PRA0219A", "BAS0242A", "LAT0236A", "FUN0469A", "PAD0395A", etc.)
     * "descricao": descrição da peça (ex: "Prateleira Interna Fixa 15mm", "Lateral Esquerda", "Base Inferior", "Gaveta Telescópica", "Fundo", etc.)
     * "qtd": quantidade numérica inteira (se omitido na tabela, assuma 1)
2. NÃO OMITA NENHUMA FERRAGEM DA TABELA DE FERRAGENS (se houver no documento).
   - Cada ferragem deve ter:
     * "ref": código ou referência (ex: "SCANL", "DOBP", "DOBT", "PGOLA02", "PAR.CAI.04x40", etc.)
     * "descricao": descrição completa (ex: "Kit Dobradiça Padrão Curva", "Puxador Gola p/ Porta", "Parafuso para Caixa 04x40mm", etc.)
     * "qtd": quantidade numérica inteira
     * "unidade": unidade de medida (ex: "UN", "PAR", "M")
3. INFERIR DADOS PRINCIPAIS DO MÓDULO:
   - "codigo_modulo": código principal do módulo no cabeçalho (ex: "POR0471A")
   - "nome_template": nome descritivo (ex: "Portas de Giro c/ Rodapé (1800x2340x550)" ou "Guarda-Roupa 4 Portas de Giro c/ Rodapé")
   - "categoria": "Quarto" | "Cozinha" | "Sala" | "Banheiro" | "Lavanderia" | "Geral"
   - "largura_padrao": largura em milímetros (ex: 1800)
   - "altura_padrao": altura em milímetros (ex: 2340)
   - "profundidade_padrao": profundidade em milímetros (ex: 550)
   - "dimensoes": string no formato "L x A x P" (ex: "1800x2340x550")
   - "perfil_construtivo": infira entre:
     * "Fechado Envelopado" (guarda-roupa, roupeiro, armário fechado, balcão fechado completo)
     * "Balcão (tampo por conta do cliente)" (balcões com topo aberto para tampo de granito)
     * "Aberto / Painel" (painéis de TV, estantes abertas, nichos sem tamponamento)
     * "Caixa Simples" (aéreos simples ou módulos básicos)
   - "regras_parametricas": {
       "tipo": "roupeiro" | "balcao" | "aereo" | "painel",
       "qtd_portas": número de portas inferido das peças/ferragens,
       "qtd_gavetas": número de gavetas inferido,
       "prateleiras_internas": número de prateleiras inferido
     }

Retorne ESTRITAMENTE um objeto JSON válido, sem texto introdutório, sem explicações adicionais e sem blocos de markdown.
Formato exato:
{
  "codigo_modulo": "POR0471A",
  "nome_template": "Portas de Giro c/ Rodapé (1800x2340x550)",
  "categoria": "Quarto",
  "largura_padrao": 1800,
  "altura_padrao": 2340,
  "profundidade_padrao": 550,
  "dimensoes": "1800x2340x550",
  "perfil_construtivo": "Fechado Envelopado",
  "composicao_mdf": [
    { "item": 1, "codigo": "PRA0219A", "descricao": "Prateleira Interna Fixa 15mm", "qtd": 1 }
  ],
  "ferragens": [
    { "ref": "DOBT", "descricao": "Kit Dobradiça Padrão Reta", "qtd": 10, "unidade": "UN" }
  ],
  "regras_parametricas": {
    "tipo": "roupeiro",
    "qtd_portas": 4,
    "qtd_gavetas": 8,
    "prateleiras_internas": 8
  }
}`

    // Monta o payload de conteúdo da mensagem de usuário com todas as páginas
    const contentParts: Array<{
      type: string
      text?: string
      image_url?: { url: string; detail?: string }
    }> = [
      {
        type: 'text',
        text: `Analise as ${paginas.length} página(s) deste PDF de ficha técnica Promob. Extraia a lista COMPLETA de todas as peças em MDF (sem pular nenhuma linha) e todas as ferragens listadas no relatório.`,
      },
    ]

    for (let i = 0; i < paginas.length; i++) {
      contentParts.push({
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${paginas[i]}`,
          detail: 'high', // 'high' garante resolução adequada no modelo de visão
        },
      })
    }

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: promptSistema },
          { role: 'user', content: contentParts },
        ],
        // 4096 tokens garante espaço suficiente para 60+ peças + 20+ ferragens + metadados
        max_tokens: 4096,
        temperature: 0.1,
        // response_format json_object garante que a OpenAI nunca quebra o fechamento de chaves
        response_format: { type: 'json_object' },
      }),
    })

    if (!openAIResponse.ok) {
      const errBody = await openAIResponse.text().catch(() => '')
      console.error('Erro na resposta da OpenAI:', openAIResponse.status, errBody)
      return new Response(
        JSON.stringify({
          error: `Falha na comunicação com o modelo de IA (OpenAI status ${openAIResponse.status}): ${errBody}`,
          stage: 'ai_request',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const aiData = await openAIResponse.json()
    const choice = aiData.choices?.[0]
    const finishReason = choice?.finish_reason

    if (finishReason === 'length') {
      console.warn('Aviso: resposta da IA foi truncada por tamanho (finish_reason = length)')
    }

    const rawContent: string = choice?.message?.content || ''
    if (!rawContent) {
      return new Response(
        JSON.stringify({
          error: 'A IA retornou uma resposta vazia para o arquivo enviado.',
          stage: 'ai_parse',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let parsedResult: ExtractedModuleResponse
    try {
      const sanitized = sanitizeJsonString(rawContent)
      parsedResult = JSON.parse(sanitized)
    } catch (parseErr) {
      console.error('Erro no parse de JSON retornado pela IA:', parseErr, 'Raw:', rawContent)
      return new Response(
        JSON.stringify({
          error: `A resposta da IA não pôde ser interpretada como JSON válido (${parseErr instanceof Error ? parseErr.message : 'formato incorreto'}). Motivo de finalização: ${finishReason || 'desconhecido'}.`,
          stage: 'ai_parse',
          raw_sample: rawContent.slice(0, 500),
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Normalização dos campos para compatibilidade com o frontend
    const composicaoMdf = Array.isArray(parsedResult.composicao_mdf)
      ? parsedResult.composicao_mdf
      : Array.isArray(parsedResult.pecas_mdf)
        ? parsedResult.pecas_mdf
        : []

    const ferragens = Array.isArray(parsedResult.ferragens) ? parsedResult.ferragens : []

    // Garante que pecas_mdf e composicao_mdf estejam preenchidos
    parsedResult.composicao_mdf = composicaoMdf
    parsedResult.pecas_mdf = composicaoMdf
    parsedResult.ferragens = ferragens

    // Normaliza dimensões se necessário
    if (!parsedResult.dimensoes) {
      const l = parsedResult.largura_padrao || 0
      const a = parsedResult.altura_padrao || 0
      const p = parsedResult.profundidade_padrao || 0
      if (l > 0 && a > 0 && p > 0) {
        parsedResult.dimensoes = `${l}x${a}x${p}`
      }
    }

    return new Response(JSON.stringify(parsedResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Exceção na Edge Function importar-pdf-modulo:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erro interno ao processar o PDF.',
        stage: 'function_internal',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
